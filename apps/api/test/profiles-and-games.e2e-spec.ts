import { API, as, createTestApp, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

describe("Profiles, in-game accounts and the games catalogue", () => {
  let ctx: TestContext;
  let admin: { id: string };
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    admin = await makeUser(ctx, { roles: ["player", "admin"] });
  });
  afterAll(() => ctx.app.close());

  describe("profiles (PRO-01 to PRO-04)", () => {
    it("a pending user can create their profile during sign-up", async () => {
      const pending = await makeUser(ctx, { status: "pending", displayName: null });
      await ctx.http().get(`${API}/me/profile`).set(as(pending.id)).expect(404);
      const res = await ctx
        .http()
        .put(`${API}/me/profile`)
        .set(as(pending.id))
        .send({ displayName: "NightOwl", bio: "Tank main", year: 3 })
        .expect(200);
      expect(res.body).toMatchObject({ displayName: "NightOwl", bio: "Tank main", year: 3, department: null });
    });

    it("display names are unique and limited to safe characters", async () => {
      const other = await makeUser(ctx, { displayName: null });
      await ctx.http().put(`${API}/me/profile`).set(as(other.id)).send({ displayName: "NightOwl" }).expect(409);
      const res = await ctx.http().put(`${API}/me/profile`).set(as(other.id)).send({ displayName: "no spaces!" }).expect(400);
      expect(res.body.details[0]).toMatch(/displayName/);
    });

    it("public profiles never include email, real name or student ID (PRO-04)", async () => {
      const player = await makeUser(ctx);
      const viewer = await makeUser(ctx);
      const res = await ctx.http().get(`${API}/profiles/${player.id}`).set(as(viewer.id)).expect(200);
      const text = JSON.stringify(res.body);
      expect(res.body.displayName).toBe(player.displayName);
      expect(text).not.toContain(player.email);
      expect(text).not.toMatch(/studentIdNumber|S-/);
    });
  });

  describe("in-game accounts", () => {
    it("adds an account with rank and preferred roles from the same game", async () => {
      const player = await makeUser(ctx);
      const game = await seededGame(ctx, "mobile-legends");
      const roles = game.roles.filter((r) => ["Tank", "Support"].includes(r.name));
      const res = await ctx
        .http()
        .post(`${API}/me/in-game-accounts`)
        .set(as(player.id))
        .send({ gameId: game.id, inGameName: "12345678 (2041)", rankId: game.ranks[4]!.id, preferredRoleIds: roles.map((r) => r.id) })
        .expect(201);
      expect(res.body).toMatchObject({ inGameName: "12345678 (2041)", rank: { name: "Epic" } });
      expect(res.body.preferredRoles.map((r: { name: string }) => r.name).sort()).toEqual(["Support", "Tank"]);

      // One account per game.
      await ctx.http().post(`${API}/me/in-game-accounts`).set(as(player.id)).send({ gameId: game.id, inGameName: "again" }).expect(409);

      // Edit: change rank, replace roles.
      const edit = await ctx
        .http()
        .patch(`${API}/me/in-game-accounts/${res.body.id}`)
        .set(as(player.id))
        .send({ rankId: game.ranks[5]!.id, preferredRoleIds: [roles[0]!.id] })
        .expect(200);
      expect(edit.body.rank.name).toBe("Legend");
      expect(edit.body.preferredRoles).toHaveLength(1);

      // Others can't touch it.
      const other = await makeUser(ctx);
      await ctx.http().delete(`${API}/me/in-game-accounts/${res.body.id}`).set(as(other.id)).expect(404);
      await ctx.http().delete(`${API}/me/in-game-accounts/${res.body.id}`).set(as(player.id)).expect(204);
    });

    it("refuses a rank or role from another game", async () => {
      const player = await makeUser(ctx);
      const valorant = await seededGame(ctx, "valorant");
      const mlbb = await seededGame(ctx, "mobile-legends");
      await ctx
        .http()
        .post(`${API}/me/in-game-accounts`)
        .set(as(player.id))
        .send({ gameId: valorant.id, inGameName: "x#1", rankId: mlbb.ranks[0]!.id })
        .expect(400);
      await ctx
        .http()
        .post(`${API}/me/in-game-accounts`)
        .set(as(player.id))
        .send({ gameId: valorant.id, inGameName: "x#1", preferredRoleIds: [mlbb.roles[0]!.id] })
        .expect(400);
    });
  });

  describe("games catalogue (GAM-01 to GAM-03)", () => {
    it("is public, and hides inactive games from non-admins", async () => {
      const res = await ctx.http().get(`${API}/games`).expect(200);
      expect(res.body.map((g: { slug: string }) => g.slug)).toEqual(
        expect.arrayContaining(["valorant", "mobile-legends", "pubg-mobile", "ea-fc", "league-of-legends"]),
      );
      expect(res.body[0].ranks.length).toBeGreaterThan(0);
    });

    it("admins manage games; players can't", async () => {
      const player = await makeUser(ctx);
      const body = { slug: "chess", name: "Chess", platforms: ["pc", "mobile"], teamSize: 1, maxLobbySize: 2, inGameIdLabel: "Username" };
      await ctx.http().post(`${API}/games`).set(as(player.id)).send(body).expect(403);
      await ctx.http().post(`${API}/games`).set(as(admin.id)).send({ ...body, maxLobbySize: 0 }).expect(400);
      const res = await ctx.http().post(`${API}/games`).set(as(admin.id)).send(body).expect(201);
      const rank = await ctx.http().post(`${API}/games/${res.body.id}/ranks`).set(as(admin.id)).send({ name: "Beginner", tierOrder: 1 }).expect(201);
      await ctx.http().post(`${API}/games/${res.body.id}/ranks`).set(as(admin.id)).send({ name: "Duplicate tier", tierOrder: 1 }).expect(409);
      await ctx.http().patch(`${API}/games/${res.body.id}/ranks/${rank.body.id}`).set(as(admin.id)).send({ name: "Novice" }).expect(200);

      // Hide it: gone from the public list, still visible to admins.
      await ctx.http().patch(`${API}/games/${res.body.id}`).set(as(admin.id)).send({ isActive: false }).expect(200);
      const publicList = await ctx.http().get(`${API}/games`).expect(200);
      expect(publicList.body.map((g: { slug: string }) => g.slug)).not.toContain("chess");
      const adminList = await ctx.http().get(`${API}/games?includeInactive=true`).set(as(admin.id)).expect(200);
      expect(adminList.body.map((g: { slug: string }) => g.slug)).toContain("chess");

      await ctx.http().delete(`${API}/games/${res.body.id}`).set(as(admin.id)).expect(204);
    });

    it("a game in use can't be deleted (409)", async () => {
      const player = await makeUser(ctx);
      const game = await seededGame(ctx, "valorant");
      await ctx.http().post(`${API}/me/in-game-accounts`).set(as(player.id)).send({ gameId: game.id, inGameName: "a#1" }).expect(201);
      const res = await ctx.http().delete(`${API}/games/${game.id}`).set(as(admin.id)).expect(409);
      expect(res.body.message).toMatch(/isActive/);
    });
  });
});
