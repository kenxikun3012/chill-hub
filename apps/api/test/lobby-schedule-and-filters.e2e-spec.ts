import { API, as, createTestApp, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

const HOUR = 3_600_000;

describe("Lobby scheduling limit and voice filter (step 3c)", () => {
  let ctx: TestContext;
  let game: Awaited<ReturnType<typeof seededGame>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    game = await seededGame(ctx);
  });
  afterAll(() => ctx.app.close());

  const create = (hostId: string, overrides: Record<string, unknown> = {}) =>
    ctx
      .http()
      .post(`${API}/lobbies`)
      .set(as(hostId))
      .send({
        gameId: game.id,
        modeId: game.modes[0]!.id,
        lobbyCode: "CODE-1",
        visibility: "public",
        capacity: 5,
        startsAt: new Date().toISOString(),
        ...overrides,
      });

  it("LOB-01: a lobby can start up to 24 hours ahead, and no later", async () => {
    const host = await makeUser(ctx);
    const res = await create(host.id, { startsAt: new Date(Date.now() + 25 * HOUR).toISOString() }).expect(400);
    expect(res.body.message).toMatch(/24 hours/);
    const ok = await create(host.id, { startsAt: new Date(Date.now() + 23 * HOUR).toISOString() }).expect(201);
    await ctx.http().patch(`${API}/lobbies/${ok.body.id}`).set(as(host.id)).send({ startsAt: new Date(Date.now() + 25 * HOUR).toISOString() }).expect(400);
  });

  it("LOB-06: browse filters by voice chat", async () => {
    const withVoice = await create((await makeUser(ctx)).id, { voiceChat: true }).expect(201);
    const noVoice = await create((await makeUser(ctx)).id, { voiceChat: false }).expect(201);
    const viewer = await makeUser(ctx);
    const ids = async (value: boolean) => {
      const res = await ctx.http().get(`${API}/lobbies?voiceChat=${value}`).set(as(viewer.id)).expect(200);
      return res.body.items.map((l: { id: string }) => l.id);
    };
    expect(await ids(true)).toContain(withVoice.body.id);
    expect(await ids(true)).not.toContain(noVoice.body.id);
    expect(await ids(false)).toContain(noVoice.body.id);
    expect(await ids(false)).not.toContain(withVoice.body.id);
  });

  it("gives a requester their request id, so the app can cancel it", async () => {
    const host = await makeUser(ctx);
    const lobby = await create(host.id, { visibility: "private" }).expect(201);
    const player = await makeUser(ctx);
    const request = await ctx.http().post(`${API}/lobbies/${lobby.body.id}/join-requests`).set(as(player.id)).expect(201);
    const seen = await ctx.http().get(`${API}/lobbies/${lobby.body.id}`).set(as(player.id)).expect(200);
    expect(seen.body.viewer).toMatchObject({ joinRequestStatus: "pending", joinRequestId: request.body.id });
    expect(seen.body.lobbyCode).toBeNull();
  });
});
