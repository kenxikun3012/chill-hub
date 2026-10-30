import type { RoleName } from "@chill-hub/shared";
import { API, as, createTestApp, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

describe("Staff accounts can't use lobbies", () => {
  let ctx: TestContext;
  let game: Awaited<ReturnType<typeof seededGame>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    game = await seededGame(ctx);
  });
  afterAll(() => ctx.app.close());

  const body = (overrides: Record<string, unknown> = {}) => ({
    gameId: game.id,
    modeId: game.modes[0]!.id,
    lobbyCode: "CODE-1",
    visibility: "public",
    capacity: 5,
    startsAt: new Date().toISOString(),
    ...overrides,
  });
  const create = (userId: string, overrides: Record<string, unknown> = {}) =>
    ctx.http().post(`${API}/lobbies`).set(as(userId)).send(body(overrides));

  const STAFF: RoleName[][] = [["admin"], ["moderator"], ["player", "admin"], ["player", "moderator"]];

  it.each(STAFF)("refuses every player lobby action for %s %s", async (...roles) => {
    const staff = await makeUser(ctx, { roles: roles.filter(Boolean) as RoleName[] });
    const host = await makeUser(ctx);
    const lobby = (await create(host.id).expect(201)).body;
    const http = () => ctx.http();
    const res = await create(staff.id).expect(403);
    expect(res.body.message).toMatch(/staff/i);
    await http().get(`${API}/lobbies`).set(as(staff.id)).expect(403);
    const seen = await http().get(`${API}/lobbies/${lobby.id}`).set(as(staff.id)).expect(403);
    expect(JSON.stringify(seen.body)).not.toContain("CODE-1");
    await http().post(`${API}/lobbies/${lobby.id}/members`).set(as(staff.id)).expect(403);
    await http().post(`${API}/lobbies/${lobby.id}/join-requests`).set(as(staff.id)).expect(403);
    await http().get(`${API}/lobbies/${lobby.id}/messages`).set(as(staff.id)).expect(403);
  });

  it("players and organizers keep lobby access", async () => {
    await create((await makeUser(ctx)).id).expect(201);
    await create((await makeUser(ctx, { roles: ["player", "organizer"] })).id).expect(201);
  });

  it("admins can still delete a lobby for moderation; moderators can't", async () => {
    const lobby = (await create((await makeUser(ctx)).id).expect(201)).body;
    const moderator = await makeUser(ctx, { roles: ["moderator"] });
    await ctx.http().delete(`${API}/lobbies/${lobby.id}`).set(as(moderator.id)).expect(403);
    const admin = await makeUser(ctx, { roles: ["admin"] });
    await ctx.http().delete(`${API}/lobbies/${lobby.id}`).set(as(admin.id)).expect(204);
  });

  it("promoting a player takes them out of active lobbies: hosted ones close, others are left", async () => {
    const admin = await makeUser(ctx, { roles: ["admin"] });
    const player = await makeUser(ctx);
    const other = await makeUser(ctx);
    const hosted = (await create(player.id).expect(201)).body;
    await ctx.http().post(`${API}/lobbies/${hosted.id}/members`).set(as(other.id)).expect(201);
    const joined = (await create(other.id).expect(201)).body;
    await ctx.http().post(`${API}/lobbies/${joined.id}/members`).set(as(player.id)).expect(201);
    const privateLobby = (await create(other.id, { visibility: "private" }).expect(201)).body;
    await ctx.http().post(`${API}/lobbies/${privateLobby.id}/join-requests`).set(as(player.id)).expect(201);

    await ctx.http().put(`${API}/users/${player.id}/roles`).set(as(admin.id)).send({ roles: ["moderator"] }).expect(200);

    const closed = await ctx.http().get(`${API}/lobbies/${hosted.id}`).set(as(other.id)).expect(200);
    expect(closed.body.status).toBe("closed");
    const left = await ctx.http().get(`${API}/lobbies/${joined.id}`).set(as(other.id)).expect(200);
    expect(left.body.members.map((m: { userId: string }) => m.userId)).not.toContain(player.id);
    const requests = await ctx.http().get(`${API}/lobbies/${privateLobby.id}/join-requests`).set(as(other.id)).expect(200);
    expect(requests.body).toHaveLength(0);
  });
});
