import { DOMAIN, API, as, createTestApp, lobbyBody, makeUser, newStudentId, resetDb, seededGame, type TestContext } from "./helpers";

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
  /** Sign-up step 3: the main game. The student ID number is only sent to correct it. */
  const details = (studentIdNumber?: string) => ({
    ...(studentIdNumber ? { studentIdNumber } : {}),
    inGameAccount: { gameId, inGameName: "player#1" },
  });
  /** Sign-up step 1: a new student ID number each time, unless the test gives one. */
  const signUp = (email: string, password = PASSWORD, extra: Record<string, unknown> = {}) =>
    ctx.http().post(`${AUTH}/sign-up/email`).send({ name: "New Student", email, password, studentIdNumber: newStudentId(), ...extra });
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
      const id = newStudentId();
      await signUp(email, PASSWORD, { studentIdNumber: id }).expect(200);
      const code = ctx.mail.lastCode(email)!;
      const wrong = code === "000000" ? "111111" : "000000";
      await ctx.http().post(`${AUTH}/email-otp/verify-email`).send({ email, otp: wrong }).expect(400);

      const res = await ctx.http().post(`${AUTH}/email-otp/verify-email`).send({ email, otp: code }).expect(200);
      const me = await ctx.http().get(`${API}/me`).set(bearer(res.body.token)).expect(200);
      expect(me.body).toMatchObject({ email, status: "pending", emailVerified: true, studentIdNumber: id, roles: [] });
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
    it("an approval request needs an in-game ID", async () => {
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

    it("a corrected student ID number can't be one that's already used; unknown games are refused", async () => {
      const first = await verifiedUser();
      const taken = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: first.email } })).studentIdNumber!;
      const second = await verifiedUser();
      await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(second.token)).send(details(taken)).expect(409);
      await ctx
        .http()
        .put(`${API}/me/sign-up-details`)
        .set(bearer(second.token))
        .send({ inGameAccount: { gameId: "no-such-game", inGameName: "x" } })
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

      const fixedId = newStudentId();
      const fixed = details(fixedId);
      const second = await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(fixed).expect(200);
      expect(second.body.id).not.toBe(first.body.id);
      const history = await ctx.http().get(`${API}/me/approval-requests`).set(bearer(token)).expect(200);
      expect(history.body).toHaveLength(2);

      await ctx.http().patch(`${API}/approval-requests/${second.body.id}`).set(as(admin.id)).send({ decision: "approve" }).expect(200);
      expect(ctx.mail.sent.at(-1)).toMatchObject({ to: email, subject: expect.stringContaining("approved") });

      const login = await logIn(email).expect(200);
      await ctx.http().get(`${API}/lobbies`).set(bearer(login.body.token)).expect(200);
      const me = await ctx.http().get(`${API}/me`).set(bearer(login.body.token)).expect(200);
      expect(me.body).toMatchObject({ status: "approved", roles: ["player"], studentIdNumber: fixedId });
    });
  });

  describe("sign-up rules: student ID, join code, any email", () => {
    let admin: { id: string };
    const setSetting = (key: string, value: unknown) =>
      ctx.http().put(`${API}/settings/${key}`).set(as(admin.id)).send({ value }).expect(200);
    beforeAll(async () => {
      admin = await makeUser(ctx, { roles: ["admin", "player"] });
    });

    it("any email can sign up when no email domain is set", async () => {
      await signUp("someone@gmail.com").expect(200);
      expect(ctx.mail.sent.some((m) => m.to === "someone@gmail.com")).toBe(true);
    });

    it("ACC-02: when email domains are set, other emails are refused", async () => {
      await setSetting("allowed_email_domains", [DOMAIN]);
      try {
        const res = await signUp("other@gmail.com").expect(400);
        expect(res.body.message).toMatch(/college email/);
        await signUp(newEmail()).expect(200);
      } finally {
        await setSetting("allowed_email_domains", []);
      }
    });

    it("needs a student ID number written like 22/29484", async () => {
      const missing = await ctx.http().post(`${AUTH}/sign-up/email`).send({ name: "N", email: newEmail(), password: PASSWORD }).expect(400);
      expect(missing.body.message).toMatch(/like 22\/29484/);
      for (const bad of ["S-123", "2229484", "22/12", "22-29484"]) {
        await signUp(newEmail(), PASSWORD, { studentIdNumber: bad }).expect(400);
      }
    });

    it("needs the club's join code when one is set, ignoring case and spaces; the code stays private", async () => {
      await setSetting("signup_join_code", "Chill-2026");
      try {
        const pub = await ctx.http().get(`${API}/settings/public`).expect(200);
        expect(pub.body.signup_join_code_required).toBe(true);
        expect(JSON.stringify(pub.body)).not.toMatch(/chill-2026/i);

        const missing = await signUp(newEmail()).expect(400);
        expect(missing.body.message).toMatch(/join code/);
        await signUp(newEmail(), PASSWORD, { joinCode: "wrong" }).expect(400);
        await signUp(newEmail(), PASSWORD, { joinCode: "  chill-2026 " }).expect(200);
      } finally {
        await setSetting("signup_join_code", "");
      }
      const pub = await ctx.http().get(`${API}/settings/public`).expect(200);
      expect(pub.body.signup_join_code_required).toBe(false);
    });

    it("a student ID can't be used twice, whether or not the first sign-up is verified yet", async () => {
      const id = newStudentId();
      const email = newEmail();
      await signUp(email, PASSWORD, { studentIdNumber: id }).expect(200);

      const unverified = await signUp(newEmail(), PASSWORD, { studentIdNumber: id }).expect(400);
      expect(unverified.body.message).toMatch(/isn't verified yet/);

      await ctx.http().post(`${AUTH}/email-otp/verify-email`).send({ email, otp: ctx.mail.lastCode(email) }).expect(200);
      const taken = await signUp(newEmail(), PASSWORD, { studentIdNumber: id }).expect(400);
      expect(taken.body.message).toMatch(/already registered/);
    });

    it("an unverified sign-up whose code has expired no longer holds the student ID", async () => {
      const id = newStudentId();
      const stale = newEmail();
      await signUp(stale, PASSWORD, { studentIdNumber: id }).expect(200);
      await ctx.prisma.user.update({ where: { email: stale }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });

      const fresh = newEmail();
      await signUp(fresh, PASSWORD, { studentIdNumber: id }).expect(200);
      expect(await ctx.prisma.user.findUnique({ where: { email: stale } })).toBeNull();
      expect((await ctx.prisma.user.findUniqueOrThrow({ where: { email: fresh } })).studentIdNumber).toBe(id);
    });
  });

  describe("waiting for approval: look around, don't act (ACC-06)", () => {
    it("a student with details in can browse but sees no lobby codes and can't act; approval changes that", async () => {
      const host = await makeUser(ctx);
      const admin = await makeUser(ctx, { roles: ["admin", "player"] });
      const lobby = (await ctx.http().post(`${API}/lobbies`).set(as(host.id)).send(await lobbyBody(ctx)).expect(201)).body;

      const { token } = await verifiedUser();
      const request = (await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(details()).expect(200)).body;

      const list = await ctx.http().get(`${API}/lobbies`).set(bearer(token)).expect(200);
      expect(list.body.items.map((l: { id: string }) => l.id)).toContain(lobby.id);
      expect(JSON.stringify(list.body)).not.toContain("7KQ2-XP");
      const detail = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(bearer(token)).expect(200);
      expect(detail.body).toMatchObject({ lobbyCode: null, codeVisible: false });
      await ctx.http().get(`${API}/games`).set(bearer(token)).expect(200);

      const create = await ctx.http().post(`${API}/lobbies`).set(bearer(token)).send(await lobbyBody(ctx)).expect(403);
      expect(create.body.message).toMatch(/look around/);
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(bearer(token)).expect(403);
      await ctx.http().put(`${API}/me/profile`).set(bearer(token)).send({ displayName: "Waiting" }).expect(200); // own details stay editable

      await ctx.http().patch(`${API}/approval-requests/${request.id}`).set(as(admin.id)).send({ decision: "approve" }).expect(200);
      const approved = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(bearer(token)).expect(200);
      expect(approved.body).toMatchObject({ lobbyCode: "7KQ2-XP", codeVisible: true });
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(bearer(token)).expect(201);
    });

    it("a rejected student can't browse until they re-apply and are approved", async () => {
      const admin = await makeUser(ctx, { roles: ["admin", "player"] });
      const { token } = await verifiedUser();
      const request = (await ctx.http().put(`${API}/me/sign-up-details`).set(bearer(token)).send(details()).expect(200)).body;
      await ctx
        .http()
        .patch(`${API}/approval-requests/${request.id}`)
        .set(as(admin.id))
        .send({ decision: "reject", rejectReason: "Details don't match" })
        .expect(200);
      await ctx.http().get(`${API}/lobbies`).set(bearer(token)).expect(403);
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
