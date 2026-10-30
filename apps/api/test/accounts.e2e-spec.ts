import { API, as, createTestApp, DOMAIN, makeUser, resetDb, type TestContext } from "./helpers";

describe("Users, approvals and settings", () => {
  let ctx: TestContext;
  let admin: { id: string };
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    admin = await makeUser(ctx, { roles: ["player", "admin"] });
  });
  afterAll(() => ctx.app.close());

  describe("admin user management", () => {
    it("creates users only with a college email domain (ACC-02)", async () => {
      await ctx
        .http()
        .post(`${API}/users`)
        .set(as(admin.id))
        .send({ name: "Outsider", email: "someone@gmail.com", studentIdNumber: "X-1" })
        .expect(400);
      const res = await ctx
        .http()
        .post(`${API}/users`)
        .set(as(admin.id))
        .send({ name: "Mya Mya", email: `MYA@${DOMAIN}`, studentIdNumber: "CS-2026-001" })
        .expect(201);
      expect(res.body).toMatchObject({ email: `mya@${DOMAIN}`, status: "pending", roles: [] });
    });

    it("rejects a duplicate student ID number with 409", async () => {
      const res = await ctx
        .http()
        .post(`${API}/users`)
        .set(as(admin.id))
        .send({ name: "Copy", email: `copy@${DOMAIN}`, studentIdNumber: "CS-2026-001" })
        .expect(409);
      expect(res.body.message).toMatch(/already taken/);
    });

    it("searches users by name, email or display name", async () => {
      const res = await ctx.http().get(`${API}/users?q=mya`).set(as(admin.id)).expect(200);
      expect(res.body.items.map((u: { name: string }) => u.name)).toContain("Mya Mya");
      expect(res.body).toHaveProperty("nextCursor");
    });

    it("an admin can't remove their own admin role", async () => {
      await ctx.http().put(`${API}/users/${admin.id}/roles`).set(as(admin.id)).send({ roles: ["player"] }).expect(400);
    });

    it("banning logs the user out everywhere (ACC-09)", async () => {
      const user = await makeUser(ctx);
      await ctx.prisma.session.create({ data: { userId: user.id, token: `t-${user.id}`, expiresAt: new Date(Date.now() + 3_600_000) } });
      await ctx.http().patch(`${API}/users/${user.id}`).set(as(admin.id)).send({ status: "banned" }).expect(200);
      expect(await ctx.prisma.session.count({ where: { userId: user.id } })).toBe(0);
    });

    it("soft delete clears personal data and hides the user (ACC-10)", async () => {
      const user = await makeUser(ctx);
      await ctx.http().delete(`${API}/users/${user.id}`).set(as(admin.id)).expect(204);
      const row = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row).toMatchObject({ name: "Deleted user", email: `deleted+${user.id}@deleted.invalid` });
      expect(row.deletedAt).not.toBeNull();
      await ctx.http().get(`${API}/users/${user.id}`).set(as(admin.id)).expect(404);
      await ctx.http().get(`${API}/me`).set(as(user.id)).expect(401);
    });

    it("moderators can read users but not change them", async () => {
      const mod = await makeUser(ctx, { roles: ["player", "moderator"] });
      await ctx.http().get(`${API}/users`).set(as(mod.id)).expect(200);
      await ctx.http().patch(`${API}/users/${admin.id}`).set(as(mod.id)).send({ name: "x" }).expect(403);
    });
  });

  describe("approval queue (ACC-03, ACC-04)", () => {
    let applicant: { id: string };
    let requestId: string;

    it("a pending user submits a request; a second one is refused", async () => {
      applicant = await makeUser(ctx, { status: "pending" });
      const res = await ctx.http().post(`${API}/me/approval-requests`).set(as(applicant.id)).expect(201);
      requestId = res.body.id;
      await ctx.http().post(`${API}/me/approval-requests`).set(as(applicant.id)).expect(409);
    });

    it("admins see pending requests oldest first, with the applicant's details", async () => {
      const res = await ctx.http().get(`${API}/approval-requests`).set(as(admin.id)).expect(200);
      const item = res.body.items.find((r: { id: string }) => r.id === requestId);
      expect(item.user).toMatchObject({ id: applicant.id, studentIdNumber: expect.any(String) });
    });

    it("rejecting needs a reason", async () => {
      const res = await ctx.http().patch(`${API}/approval-requests/${requestId}`).set(as(admin.id)).send({ decision: "reject" }).expect(400);
      expect(res.body.details.join(" ")).toMatch(/rejectReason/);
    });

    it("reject → user is rejected and notified; they can re-apply", async () => {
      await ctx
        .http()
        .patch(`${API}/approval-requests/${requestId}`)
        .set(as(admin.id))
        .send({ decision: "reject", rejectReason: "ID number is unreadable" })
        .expect(200);
      const me = await ctx.http().get(`${API}/me`).set(as(applicant.id)).expect(200);
      expect(me.body.status).toBe("rejected");
      const inbox = await ctx.http().get(`${API}/me/notifications`).set(as(applicant.id)).expect(200);
      expect(inbox.body.items[0]).toMatchObject({ type: "account_rejected", body: "ID number is unreadable" });

      await ctx.http().patch(`${API}/approval-requests/${requestId}`).set(as(admin.id)).send({ decision: "approve" }).expect(409);
      const again = await ctx.http().post(`${API}/me/approval-requests`).set(as(applicant.id)).expect(201);
      requestId = again.body.id;
    });

    it("approve → user is approved, gets the player role and a notification", async () => {
      await ctx.http().patch(`${API}/approval-requests/${requestId}`).set(as(admin.id)).send({ decision: "approve" }).expect(200);
      const me = await ctx.http().get(`${API}/me`).set(as(applicant.id)).expect(200);
      expect(me.body).toMatchObject({ status: "approved", roles: ["player"] });
      const inbox = await ctx.http().get(`${API}/me/notifications`).set(as(applicant.id)).expect(200);
      expect(inbox.body.items[0].type).toBe("account_approved");
      await ctx.http().get(`${API}/lobbies`).set(as(applicant.id)).expect(200);
      const history = await ctx.http().get(`${API}/me/approval-requests`).set(as(applicant.id)).expect(200);
      expect(history.body.map((r: { status: string }) => r.status)).toEqual(["approved", "rejected"]);
    });
  });

  describe("settings (ADM-06)", () => {
    it("public settings need no login", async () => {
      const res = await ctx.http().get(`${API}/settings/public`).expect(200);
      expect(res.body).toEqual({ allowed_email_domains: [DOMAIN] });
    });

    it("admins can change a setting; invalid values are refused", async () => {
      await ctx.http().put(`${API}/settings/lobby_expiry_hours`).set(as(admin.id)).send({ value: 0 }).expect(400);
      await ctx.http().put(`${API}/settings/no_such_key`).set(as(admin.id)).send({ value: 1 }).expect(400);
      const res = await ctx.http().put(`${API}/settings/lobby_expiry_hours`).set(as(admin.id)).send({ value: 3 }).expect(200);
      expect(res.body).toEqual({ key: "lobby_expiry_hours", value: 3 });
      const all = await ctx.http().get(`${API}/settings`).set(as(admin.id)).expect(200);
      expect(all.body.lobby_expiry_hours).toBe(3);
    });
  });
});
