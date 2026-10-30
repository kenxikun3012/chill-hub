import { DOMAIN, API, as, createTestApp, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

const AUTH = `${API}/auth`;
const PASSWORD = "correct-horse-1";

describe("Authentication (step 3a)", () => {
  let ctx: TestContext;
  let gameId: string;
  let counter = 0;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    gameId = (await seededGame(ctx)).id;
  });
  afterAll(() => ctx.app.close());

  const newEmail = () => `auth${Date.now().toString(36)}${++counter}@${DOMAIN}`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const details = (studentIdNumber = `S-${Date.now().toString(36)}${++counter}`) => ({
    studentIdNumber,
    inGameAccount: { gameId, inGameName: "player#1" },
  });
  const signUp = (email: string, password = PASSWORD) =>
    ctx.http().post(`${AUTH}/sign-up/email`).send({ name: "New Student", email, password });
  const logIn = (email: string, password = PASSWORD) =>
    ctx.http().post(`${AUTH}/sign-in/email`).send({ email, password });

  /** Sign-up steps 1 and 2. Returns the session token. */
  async function verifiedUser(email = newEmail()) {
    await signUp(email).expect(200);
    const res = await ctx
      .http()
      .post(`${AUTH}/email-otp/verify-email`)
      .send({ email, otp: ctx.mail.lastCode(email) })
      .expect(200);
    return { email, token: res.body.token as string };
  }

  describe("sign-up", () => {
    it("ACC-02: refuses emails outside the college domains", async () => {
      const res = await signUp("someone@gmail.com").expect(400);
      expect(res.body.message).toMatch(/college email/);
      expect(ctx.mail.sent.some((m) => m.to === "someone@gmail.com")).toBe(false);
    });

    it("refuses short passwords", async () => {
      await signUp(newEmail(), "short").expect(400);
    });

    it("sends a code, and login is refused until the email is verified", async () => {
      const email = newEmail();
      await signUp(email).expect(200);
      expect(ctx.mail.lastCode(email)).toMatch(/^\d{6}$/);
      await logIn(email).expect(403);
    });

    it("a wrong code is refused; the right one logs the user in as pending", async () => {
      const email = newEmail();
      await signUp(email).expect(200);
      const code = ctx.mail.lastCode(email)!;
      const wrong = code === "000000" ? "111111" : "000000";
      await ctx.http().post(`${AUTH}/email-otp/verify-email`).send({ email, otp: wrong }).expect(400);

      const res = await ctx.http().post(`${AUTH}/email-otp/verify-email`).send({ email, otp: code }).expect(200);
      const me = await ctx.http().get(`${API}/me`).set(bearer(res.body.token)).expect(200);
      expect(me.body).toMatchObject({ email, status: "pending", emailVerified: true, studentIdNumber: null, roles: [] });
    });

    it("stores no plain password or plain code", async () => {
      const email = newEmail();
      await signUp(email).expect(200);
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } });
      expect(user.accounts[0]!.password).not.toContain(PASSWORD);
      const stored = await ctx.prisma.verification.findMany({ where: { identifier: { contains: email } } });
      expect(stored.length).toBeGreaterThan(0);
      expect(stored.every((v) => !v.value.includes(ctx.mail.lastCode(email)!))).toBe(true);
    });

    it("offers no passwordless login", async () => {
      const email = newEmail();
      await ctx.http().post(`${AUTH}/sign-in/email-otp`).send({ email, otp: "123456" }).expect(404);
    });

    it("ACC-06: a verified user without approval can't use the app", async () => {
      const { token } = await verifiedUser();
      await ctx.http().get(`${API}/lobbies`).set(bearer(token)).expect(403);
    });
  });

  describe("sign-up step 3 and approval", () => {
    it("an approval request needs the student ID number and an in-game ID", async () => {
      const { token } = await verifiedUser();
      await ctx.http().post(`${API}/me/approval-requests`).set(bearer(token)).expect(400);
    });

    it("ACC-03: details put the user in the queue, once", async () => {
      const { token } = await verifiedUser();
      const res = await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(details()).expect(200);
      expect(res.body.status).toBe("pending");
      const me = await ctx.http().get(`${API}/me`).set(bearer(token)).expect(200);
      expect(me.body.studentIdNumber).toEqual(expect.any(String));
      await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(details()).expect(409);
    });

    it("refuses a student ID number that's already used, and unknown games", async () => {
      const first = await verifiedUser();
      const shared = `S-shared-${Date.now().toString(36)}`;
      await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(first.token)).send(details(shared)).expect(200);
      const second = await verifiedUser();
      await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(second.token)).send(details(shared)).expect(409);
      await ctx
        .http()
        .put(`${API}/me/sign-up-details`)
        .set(bearer(second.token))
        .send({ studentIdNumber: "S-unknown-game", inGameAccount: { gameId: "no-such-game", inGameName: "x" } })
        .expect(400);
    });

    it("ACC-05, ACC-06: rejected users are emailed, fix details and re-apply; once approved they can play", async () => {
      const admin = await makeUser(ctx, { roles: ["admin", "player"] });
      const { email, token } = await verifiedUser();
      const first = await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(details()).expect(200);

      await ctx
        .http()
        .patch(`${API}/approval-requests/${first.body.id}`)
        .set(as(admin.id))
        .send({ decision: "reject", rejectReason: "Student ID number is wrong" })
        .expect(200);
      expect(ctx.mail.sent.at(-1)).toMatchObject({ to: email, text: expect.stringContaining("Student ID number is wrong") });

      const fixed = details();
      const second = await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(fixed).expect(200);
      expect(second.body.id).not.toBe(first.body.id);
      const history = await ctx.http().get(`${API}/me/approval-requests`).set(bearer(token)).expect(200);
      expect(history.body).toHaveLength(2);

      await ctx.http().patch(`${API}/approval-requests/${second.body.id}`).set(as(admin.id)).send({ decision: "approve" }).expect(200);
      expect(ctx.mail.sent.at(-1)).toMatchObject({ to: email, subject: expect.stringContaining("approved") });

      const login = await logIn(email).expect(200);
      await ctx.http().get(`${API}/lobbies`).set(bearer(login.body.token)).expect(200);
      const me = await ctx.http().get(`${API}/me`).set(bearer(login.body.token)).expect(200);
      expect(me.body).toMatchObject({ status: "approved", roles: ["player"], studentIdNumber: fixed.studentIdNumber });
    });
  });

  describe("login, logout and sessions", () => {
    it("refuses a wrong password", async () => {
      const { email } = await verifiedUser();
      await logIn(email, "wrong-password-1").expect(401);
    });

    it("works with a cookie (web) and with a bearer token (app)", async () => {
      const { email } = await verifiedUser();
      const login = await logIn(email).expect(200);
      const cookies = login.headers["set-cookie"] as unknown as string[];
      expect(cookies.join(";")).toMatch(/HttpOnly/i);
      await ctx.http().get(`${API}/me`).set("Cookie", cookies).expect(200);
      expect(login.headers["set-auth-token"]).toEqual(expect.any(String));
      await ctx.http().get(`${API}/me`).set(bearer(login.headers["set-auth-token"] as string)).expect(200);
    });

    it("accepts the app (no Origin) and trusted websites; refuses other websites", async () => {
      const { email } = await verifiedUser();
      const login = (origin?: string) => {
        const req = ctx.http().post(`${AUTH}/sign-in/email`);
        if (origin) void req.set("Origin", origin);
        return req.send({ email, password: PASSWORD });
      };
      await login().expect(200);
      await login("http://localhost:8081").expect(200);
      await login("https://evil.example").expect(403);
    });

    it("sessions last 30 days", async () => {
      const { email, token } = await verifiedUser();
      const session = await ctx.prisma.session.findUniqueOrThrow({ where: { token } });
      const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThanOrEqual(30);
      expect(email).toBeTruthy();
    });

    it("logout ends the session", async () => {
      const { token } = await verifiedUser();
      await ctx.http().post(`${AUTH}/sign-out`).set(bearer(token)).send({}).expect(200);
      await ctx.http().get(`${API}/me`).set(bearer(token)).expect(401);
    });

    it("ACC-09: a ban logs the user out everywhere and blocks login; suspension doesn't", async () => {
      const admin = await makeUser(ctx, { roles: ["admin", "player"] });
      const { email, token } = await verifiedUser();
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });

      await ctx.http().patch(`${API}/users/${user.id}`).set(as(admin.id)).send({ status: "suspended" }).expect(200);
      await ctx.http().get(`${API}/me`).set(bearer(token)).expect(200);

      await ctx.http().patch(`${API}/users/${user.id}`).set(as(admin.id)).send({ status: "banned" }).expect(200);
      await ctx.http().get(`${API}/me`).set(bearer(token)).expect(401);
      await logIn(email).expect(403);
    });

    it("deleting an account ends its sessions and login", async () => {
      const { email, token } = await verifiedUser();
      await ctx.http().delete(`${API}/me`).set(bearer(token)).expect(204);
      await ctx.http().get(`${API}/me`).set(bearer(token)).expect(401);
      await logIn(email).expect(401);
    });
  });

  describe("password reset (ACC-07)", () => {
    const NEW_PASSWORD = "new-password-22";

    it("a code resets the password and ends old sessions", async () => {
      const { email, token } = await verifiedUser();
      await ctx.http().post(`${AUTH}/email-otp/request-password-reset`).send({ email }).expect(200);
      const otp = ctx.mail.lastCode(email);
      await ctx.http().post(`${AUTH}/email-otp/reset-password`).send({ email, otp, password: NEW_PASSWORD }).expect(200);

      await ctx.http().get(`${API}/me`).set(bearer(token)).expect(401);
      await logIn(email).expect(401);
      await logIn(email, NEW_PASSWORD).expect(200);
    });

    it("a wrong code changes nothing", async () => {
      const { email } = await verifiedUser();
      await ctx.http().post(`${AUTH}/email-otp/request-password-reset`).send({ email }).expect(200);
      const wrong = ctx.mail.lastCode(email) === "000000" ? "111111" : "000000";
      await ctx.http().post(`${AUTH}/email-otp/reset-password`).send({ email, otp: wrong, password: NEW_PASSWORD }).expect(400);
      await logIn(email).expect(200);
    });

    it("doesn't reveal whether an email is registered", async () => {
      const email = newEmail();
      await ctx.http().post(`${AUTH}/email-otp/request-password-reset`).send({ email }).expect(200);
      expect(ctx.mail.lastCode(email)).toBeUndefined();
    });
  });
});

describe("Authentication settings", () => {
  it("the x-dev-user-id header does nothing when DEV_AUTH is off", async () => {
    const ctx = await createTestApp({ DEV_AUTH: "false" });
    const user = await makeUser(ctx);
    await ctx.http().get(`${API}/me`).set(as(user.id)).expect(401);
    await ctx.app.close();
  });

  it("NFR-09: repeated login attempts are rate limited", async () => {
    const ctx = await createTestApp({ AUTH_RATE_LIMIT: "true" });
    const attempt = () =>
      ctx
        .http()
        .post(`${AUTH}/sign-in/email`)
        .set("x-forwarded-for", "203.0.113.9")
        .send({ email: `nobody@${DOMAIN}`, password: "wrong-password-1" });
    for (let i = 0; i < 5; i++) await attempt().expect(401);
    await attempt().expect(429);
    await ctx.app.close();
  });
});
