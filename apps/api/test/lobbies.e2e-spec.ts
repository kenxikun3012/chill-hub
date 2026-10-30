import { API, as, createTestApp, lobbyBody, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

describe("Lobbies, members, join requests, chat and ratings", () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
  });
  afterAll(() => ctx.app.close());

  const create = async (hostId: string, overrides: Record<string, unknown> = {}) =>
    ctx.http().post(`${API}/lobbies`).set(as(hostId)).send(await lobbyBody(ctx, overrides));

  describe("creating (LOB-01, LOB-02, LOB-13)", () => {
    it("creates a lobby; the host is its first member and sees the code", async () => {
      const host = await makeUser(ctx);
      const res = await create(host.id, { visibility: "private" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: "open",
        memberCount: 1,
        lobbyCode: "7KQ2-XP",
        codeVisible: true,
        viewer: { isHost: true, isMember: true },
        host: { id: host.id, displayName: host.displayName },
      });
      expect(res.body.members).toEqual([expect.objectContaining({ userId: host.id, isHost: true })]);
    });

    it("refuses a missing or blank lobby code (LOB-02)", async () => {
      const host = await makeUser(ctx);
      const blank = await create(host.id, { lobbyCode: "   " });
      expect(blank.status).toBe(400);
      expect(blank.body.details.join(" ")).toMatch(/lobbyCode/);
      const body = await lobbyBody(ctx);
      delete (body as Record<string, unknown>)["lobbyCode"];
      await ctx.http().post(`${API}/lobbies`).set(as(host.id)).send(body).expect(400);
    });

    it("checks capacity, start time and that mode/rank/roles belong to the game", async () => {
      const host = await makeUser(ctx);
      const mlbb = await seededGame(ctx, "mobile-legends");
      const valorant = await seededGame(ctx, "valorant");
      expect((await create(host.id, { capacity: 11 })).status).toBe(400);
      expect((await create(host.id, { startsAt: new Date(Date.now() - 3_600_000).toISOString() })).status).toBe(400);
      expect((await create(host.id, { modeId: mlbb.modes[0]!.id })).status).toBe(400);
      expect((await create(host.id, { neededRoleIds: [mlbb.roles[0]!.id] })).status).toBe(400);
      const backwards = await create(host.id, { minRankId: valorant.ranks[5]!.id, maxRankId: valorant.ranks[1]!.id });
      expect(backwards.status).toBe(400);
      expect(backwards.body.message).toMatch(/lowest rank/);
    });

    it("limits how many active lobbies a player can be in (LOB-13)", async () => {
      const admin = await makeUser(ctx, { roles: ["player", "admin"] });
      await ctx.http().put(`${API}/settings/max_active_lobbies_per_player`).set(as(admin.id)).send({ value: 2 }).expect(200);
      const host = await makeUser(ctx);
      expect((await create(host.id)).status).toBe(201);
      expect((await create(host.id)).status).toBe(201);
      const third = await create(host.id);
      expect(third.status).toBe(409);
      expect(third.body.message).toMatch(/limit is 2/);
      await ctx.http().put(`${API}/settings/max_active_lobbies_per_player`).set(as(admin.id)).send({ value: 3 }).expect(200);
    });
  });

  describe("code privacy (NFR-06, LOB-03, LOB-09)", () => {
    it("hides a private lobby's code from non-members, in lists and in detail", async () => {
      const host = await makeUser(ctx);
      const viewer = await makeUser(ctx);
      const lobby = (await create(host.id, { visibility: "private", lobbyCode: "SECRET-1" })).body;

      const detail = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(viewer.id)).expect(200);
      expect(detail.body).toMatchObject({ lobbyCode: null, codeVisible: false });
      const list = await ctx.http().get(`${API}/lobbies?visibility=private`).set(as(viewer.id)).expect(200);
      expect(JSON.stringify(list.body)).not.toContain("SECRET-1");
    });

    it("shows a public lobby's code to any approved player", async () => {
      const host = await makeUser(ctx);
      const viewer = await makeUser(ctx);
      const lobby = (await create(host.id, { lobbyCode: "OPEN-1" })).body;
      const detail = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(viewer.id)).expect(200);
      expect(detail.body).toMatchObject({ lobbyCode: "OPEN-1", codeVisible: true, viewer: { isMember: false } });
    });
  });

  describe("public lobbies: join, full, leave (LOB-04, LOB-08, LOB-10)", () => {
    it("fills up, disappears from browse, and reopens when someone leaves", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const p2 = await makeUser(ctx);
      const lobby = (await create(host.id, { capacity: 2, lobbyCode: "FILL-1" })).body;

      const joined = await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(201);
      expect(joined.body).toMatchObject({ status: "full", memberCount: 2, viewer: { isMember: true } });
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(409);
      const full = await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p2.id)).expect(409);
      expect(full.body.message).toMatch(/full/);

      const browse = await ctx.http().get(`${API}/lobbies?limit=100`).set(as(p2.id)).expect(200);
      expect(browse.body.items.map((l: { id: string }) => l.id)).not.toContain(lobby.id);

      await ctx.http().delete(`${API}/lobbies/${lobby.id}/members/${p1.id}`).set(as(p1.id)).expect(204);
      const after = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(host.id)).expect(200);
      expect(after.body).toMatchObject({ status: "open", memberCount: 1 });

      const hostInbox = await ctx.http().get(`${API}/me/notifications`).set(as(host.id)).expect(200);
      expect(hostInbox.body.items.map((n: { type: string }) => n.type)).toEqual(["lobby_member_left", "lobby_member_joined"]);
    });

    it("can't join a private lobby directly; the host can't leave their own lobby", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const lobby = (await create(host.id, { visibility: "private" })).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(403);
      const res = await ctx.http().delete(`${API}/lobbies/${lobby.id}/members/${host.id}`).set(as(host.id)).expect(409);
      expect(res.body.message).toMatch(/Close the lobby/);
    });
  });

  describe("private lobbies: join requests (LOB-05)", () => {
    it("request → host sees it with reputation → accept → requester sees the code", async () => {
      const host = await makeUser(ctx);
      const player = await makeUser(ctx);
      const lobby = (await create(host.id, { visibility: "private", lobbyCode: "PRIV-9" })).body;

      const req = await ctx.http().post(`${API}/lobbies/${lobby.id}/join-requests`).set(as(player.id)).expect(201);
      await ctx.http().post(`${API}/lobbies/${lobby.id}/join-requests`).set(as(player.id)).expect(409);

      await ctx.http().get(`${API}/lobbies/${lobby.id}/join-requests`).set(as(player.id)).expect(403);
      const list = await ctx.http().get(`${API}/lobbies/${lobby.id}/join-requests`).set(as(host.id)).expect(200);
      expect(list.body[0].player).toMatchObject({ userId: player.id, reputation: { good: 0, noShow: 0 } });

      const asPlayer = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(player.id)).expect(200);
      expect(asPlayer.body).toMatchObject({ lobbyCode: null, viewer: { joinRequestStatus: "pending" } });

      await ctx.http().patch(`${API}/lobbies/${lobby.id}/join-requests/${req.body.id}`).set(as(player.id)).send({ status: "accepted" }).expect(403);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}/join-requests/${req.body.id}`).set(as(host.id)).send({ status: "accepted" }).expect(200);

      const accepted = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(player.id)).expect(200);
      expect(accepted.body).toMatchObject({ lobbyCode: "PRIV-9", viewer: { isMember: true, joinRequestStatus: "accepted" } });
      const inbox = await ctx.http().get(`${API}/me/notifications`).set(as(player.id)).expect(200);
      expect(inbox.body.items[0].type).toBe("join_request_accepted");
    });

    it("decline, then ask again; the requester can cancel", async () => {
      const host = await makeUser(ctx);
      const player = await makeUser(ctx);
      const lobby = (await create(host.id, { visibility: "private" })).body;
      const req = await ctx.http().post(`${API}/lobbies/${lobby.id}/join-requests`).set(as(player.id)).expect(201);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}/join-requests/${req.body.id}`).set(as(host.id)).send({ status: "declined" }).expect(200);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}/join-requests/${req.body.id}`).set(as(host.id)).send({ status: "accepted" }).expect(409);

      const again = await ctx.http().post(`${API}/lobbies/${lobby.id}/join-requests`).set(as(player.id)).expect(201);
      expect(again.body.id).toBe(req.body.id);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}/join-requests/${req.body.id}`).set(as(player.id)).send({ status: "cancelled" }).expect(200);
    });
  });

  describe("host edits, chat and closing (LOB-07, LOB-11)", () => {
    it("changing the code adds a system message and notifies members", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const outsider = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(201);

      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(p1.id)).send({ lobbyCode: "NEW" }).expect(403);
      const edited = await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ lobbyCode: "NEW-CODE" }).expect(200);
      expect(edited.body.lobbyCode).toBe("NEW-CODE");

      const inbox = await ctx.http().get(`${API}/me/notifications`).set(as(p1.id)).expect(200);
      expect(inbox.body.items[0].type).toBe("lobby_code_changed");

      await ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(p1.id)).send({ body: "gg, ready?" }).expect(201);
      await ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(outsider.id)).send({ body: "hi" }).expect(403);
      await ctx.http().get(`${API}/lobbies/${lobby.id}/messages`).set(as(outsider.id)).expect(403);
      const chat = await ctx.http().get(`${API}/lobbies/${lobby.id}/messages`).set(as(host.id)).expect(200);
      expect(chat.body.items.map((m: { kind: string; body: string }) => `${m.kind}:${m.body}`)).toEqual([
        "user:gg, ready?",
        "system:The host changed the lobby code.",
        `system:${p1.displayName} joined the lobby`,
      ]);

      // Capacity can't drop below the current number of players.
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ capacity: 2 }).expect(200);
      const tooSmall = await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ capacity: 1 }).expect(400);
      expect(tooSmall.body.details.join(" ")).toMatch(/capacity/);
    });

    it("closing: code hidden, chat read-only, everyone asked to rate", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(201);
      const closed = await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ status: "closed" }).expect(200);
      expect(closed.body).toMatchObject({ status: "closed", lobbyCode: null, codeVisible: false });
      expect(closed.body.closedAt).not.toBeNull();

      await ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(p1.id)).send({ body: "late" }).expect(409);
      await ctx.http().get(`${API}/lobbies/${lobby.id}/messages`).set(as(p1.id)).expect(200);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ note: "x" }).expect(409);
      const inbox = await ctx.http().get(`${API}/me/notifications`).set(as(p1.id)).expect(200);
      expect(inbox.body.items[0]).toMatchObject({ type: "rate_teammates", data: { lobbyId: lobby.id } });
    });

    it("hosts delete only empty lobbies; admins can delete any", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const admin = await makeUser(ctx, { roles: ["player", "admin"] });
      const empty = (await create(host.id)).body;
      await ctx.http().delete(`${API}/lobbies/${empty.id}`).set(as(host.id)).expect(204);
      const busy = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${busy.id}/members`).set(as(p1.id)).expect(201);
      await ctx.http().delete(`${API}/lobbies/${busy.id}`).set(as(host.id)).expect(409);
      await ctx.http().delete(`${API}/lobbies/${busy.id}`).set(as(admin.id)).expect(204);
    });
  });

  describe("browse filters (LOB-06)", () => {
    it("filters by game, role, rank range and 'mine'", async () => {
      await resetDb(ctx);
      const valorant = await seededGame(ctx, "valorant");
      const controller = valorant.roles.find((r) => r.name === "Controller")!;
      const [iron, , silver, gold, plat] = valorant.ranks;
      const host = await makeUser(ctx);
      const viewer = await makeUser(ctx);
      const a = (await create(host.id, { neededRoleIds: [controller.id], minRankId: silver!.id, maxRankId: gold!.id })).body;
      const b = (await create(host.id, { minRankId: plat!.id })).body;
      const mlbb = await seededGame(ctx, "mobile-legends");
      await create(host.id, { gameId: mlbb.id, modeId: mlbb.modes[0]!.id });

      const ids = async (qs: string, who = viewer.id) =>
        (await ctx.http().get(`${API}/lobbies?${qs}`).set(as(who)).expect(200)).body.items.map((l: { id: string }) => l.id);

      expect((await ids(`gameId=${valorant.id}`)).sort()).toEqual([a.id, b.id].sort());
      expect(await ids(`roleId=${controller.id}`)).toEqual([a.id]);
      expect(await ids(`rankId=${gold!.id}`)).toEqual([a.id]);
      expect(await ids(`rankId=${iron!.id}`)).toEqual([]);
      expect(await ids("mine=true")).toEqual([]);
      expect(await ids("mine=true", host.id)).toHaveLength(3);
    });

    it("paginates with a cursor", async () => {
      const viewer = await makeUser(ctx);
      const first = await ctx.http().get(`${API}/lobbies?limit=2`).set(as(viewer.id)).expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toBe(first.body.items[1].id);
      const second = await ctx.http().get(`${API}/lobbies?limit=2&cursor=${first.body.nextCursor}`).set(as(viewer.id)).expect(200);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();
    });
  });

  describe("post-match ratings (REP-01 to REP-03)", () => {
    it("rate teammates after the lobby ends; change within the window; then it locks", async () => {
      const host = await makeUser(ctx);
      const p1 = await makeUser(ctx);
      const outsider = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(p1.id)).expect(201);

      const early = await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(host.id)).send({ value: "good" }).expect(409);
      expect(early.body.message).toMatch(/when the lobby ends/);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ status: "closed" }).expect(200);

      await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${host.id}`).set(as(host.id)).send({ value: "good" }).expect(400);
      await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(outsider.id)).send({ value: "good" }).expect(403);
      await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${outsider.id}`).set(as(host.id)).send({ value: "good" }).expect(400);
      await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(host.id)).send({ value: "maybe" }).expect(400);

      const rated = await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(host.id)).send({ value: "no_show" }).expect(200);
      const changed = await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(host.id)).send({ value: "good" }).expect(200);
      expect(changed.body).toMatchObject({ id: rated.body.id, value: "good" });
      await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${host.id}`).set(as(p1.id)).send({ value: "good" }).expect(200);

      const mine = await ctx.http().get(`${API}/lobbies/${lobby.id}/ratings/mine`).set(as(host.id)).expect(200);
      expect(mine.body).toEqual([expect.objectContaining({ rateeId: p1.id, value: "good" })]);

      const rep = await ctx.http().get(`${API}/users/${p1.id}/reputation`).set(as(outsider.id)).expect(200);
      expect(rep.body).toEqual({ good: 1, noShow: 0, totalRatings: 1, noShowRate: 0, lobbiesPlayed: 1 });
      expect(JSON.stringify(rep.body)).not.toContain(host.id);

      await ctx.prisma.rating.updateMany({ where: { lobbyId: lobby.id }, data: { editableUntil: new Date(Date.now() - 1000) } });
      const locked = await ctx.http().put(`${API}/lobbies/${lobby.id}/ratings/${p1.id}`).set(as(host.id)).send({ value: "no_show" }).expect(409);
      expect(locked.body.message).toMatch(/locked/);
    });
  });
});
