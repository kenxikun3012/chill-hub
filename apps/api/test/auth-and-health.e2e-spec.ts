import * as Shared from "@chill-hub/shared";
import * as Enums from "../src/generated/prisma/enums";
import { API, as, createTestApp, makeUser, resetDb, type TestContext } from "./helpers";

describe("Health, dev auth and access rules", () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
  });
  afterAll(() => ctx.app.close());

  it("GET /health reports the database as reachable", async () => {
    const res = await ctx.http().get(`${API}/health`).expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
  });

  it("rejects requests without the dev header, or with an unknown user (401)", async () => {
    const missing = await ctx.http().get(`${API}/lobbies`).expect(401);
    expect(missing.body).toEqual({ statusCode: 401, error: "Unauthorized", message: "Please log in" });
    await ctx.http().get(`${API}/lobbies`).set(as("no-such-user")).expect(401);
  });

  it("ACC-06: pending users can reach their own account but nothing else", async () => {
    const pending = await makeUser(ctx, { status: "pending" });
    await ctx.http().get(`${API}/me`).set(as(pending.id)).expect(200);
    await ctx.http().get(`${API}/me/notifications`).set(as(pending.id)).expect(200);
    const res = await ctx.http().get(`${API}/lobbies`).set(as(pending.id)).expect(403);
    expect(res.body.message).toMatch(/approved/);
  });

  it("banned users are refused everywhere", async () => {
    const banned = await makeUser(ctx, { status: "banned" });
    await ctx.http().get(`${API}/me`).set(as(banned.id)).expect(403);
  });

  it("MOD-06: suspended users can read but not change anything", async () => {
    const suspended = await makeUser(ctx, { status: "suspended", suspendedUntil: new Date(Date.now() + 86_400_000) });
    await ctx.http().get(`${API}/lobbies`).set(as(suspended.id)).expect(200);
    const res = await ctx.http().post(`${API}/lobbies`).set(as(suspended.id)).send({}).expect(403);
    expect(res.body.message).toMatch(/suspended until/);
  });

  it("role checks: players can't use admin endpoints", async () => {
    const player = await makeUser(ctx);
    await ctx.http().get(`${API}/approval-requests`).set(as(player.id)).expect(403);
    await ctx.http().get(`${API}/settings`).set(as(player.id)).expect(403);
  });

  it("returns 400 with readable details for invalid input", async () => {
    const player = await makeUser(ctx);
    const res = await ctx.http().get(`${API}/lobbies?limit=999`).set(as(player.id)).expect(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.details[0]).toMatch(/^limit:/);
  });

  it("refuses all non-public routes when DEV_AUTH is off", async () => {
    const offCtx = await createTestApp({ DEV_AUTH: "false" });
    const player = await makeUser(offCtx);
    await offCtx.http().get(`${API}/lobbies`).set(as(player.id)).expect(401);
    await offCtx.http().get(`${API}/health`).expect(200);
    await offCtx.app.close();
  });

  it("shared enums match the database enums exactly", () => {
    const pairs: [readonly string[], Record<string, string>][] = [
      [Shared.USER_STATUSES, Enums.UserStatus],
      [Shared.ROLE_NAMES, Enums.RoleName],
      [Shared.APPROVAL_STATUSES, Enums.ApprovalStatus],
      [Shared.DEVICE_PLATFORMS, Enums.DevicePlatform],
      [Shared.LOBBY_VISIBILITIES, Enums.LobbyVisibility],
      [Shared.LOBBY_STATUSES, Enums.LobbyStatus],
      [Shared.JOIN_REQUEST_STATUSES, Enums.JoinRequestStatus],
      [Shared.CHAT_MESSAGE_KINDS, Enums.ChatMessageKind],
      [Shared.RATING_VALUES, Enums.RatingValue],
      [Shared.NOTIFICATION_GROUPS, Enums.NotificationGroup],
      [Shared.NOTIFICATION_TYPES, Enums.NotificationType],
    ];
    for (const [shared, prisma] of pairs) expect([...shared].sort()).toEqual(Object.values(prisma).sort());
  });
});
