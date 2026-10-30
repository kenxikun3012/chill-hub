import { API, as, createTestApp, makeUser, resetDb, type TestContext } from "./helpers";
import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("Notifications inbox, preferences and push tokens (NOT-01 to NOT-04)", () => {
  let ctx: TestContext;
  let notifications: NotificationsService;
  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    notifications = ctx.app.get(NotificationsService);
  });
  afterAll(() => ctx.app.close());

  const send = (userId: string, title: string) =>
    notifications.notify([userId], { type: "lobby_starting_soon", title, body: "Starts in 10 minutes", data: { lobbyId: "x" } });

  it("lists newest first, counts unread, marks read, deletes", async () => {
    const user = await makeUser(ctx);
    await send(user.id, "first");
    await send(user.id, "second");
    await send(user.id, "third");

    const list = await ctx.http().get(`${API}/me/notifications`).set(as(user.id)).expect(200);
    expect(list.body.items.map((n: { title: string }) => n.title)).toEqual(["third", "second", "first"]);
    expect((await ctx.http().get(`${API}/me/notifications/unread-count`).set(as(user.id))).body).toEqual({ unread: 3 });

    const id = list.body.items[0].id;
    const read = await ctx.http().patch(`${API}/me/notifications/${id}`).set(as(user.id)).send({ read: true }).expect(200);
    expect(read.body.readAt).not.toBeNull();
    const unreadOnly = await ctx.http().get(`${API}/me/notifications?unreadOnly=true`).set(as(user.id)).expect(200);
    expect(unreadOnly.body.items).toHaveLength(2);

    expect((await ctx.http().post(`${API}/me/notifications/read-all`).set(as(user.id)).expect(200)).body).toEqual({ updated: 2 });
    await ctx.http().delete(`${API}/me/notifications/${id}`).set(as(user.id)).expect(204);

    const other = await makeUser(ctx);
    await ctx.http().delete(`${API}/me/notifications/${list.body.items[1].id}`).set(as(other.id)).expect(404);
  });

  it("returns grouped preferences with defaults; account can't be turned off", async () => {
    const user = await makeUser(ctx);
    const prefs = await ctx.http().get(`${API}/me/notification-preferences`).set(as(user.id)).expect(200);
    expect(prefs.body.map((p: { group: string }) => p.group)).toEqual(["account", "lobbies", "lobby_chat", "knowledge", "news"]);
    expect(prefs.body[0]).toMatchObject({ group: "account", locked: true });
    await ctx
      .http()
      .put(`${API}/me/notification-preferences/account`)
      .set(as(user.id))
      .send({ push: false, email: false, inApp: false })
      .expect(400);
  });

  it("turning in-app off for a group stops those notifications reaching the inbox", async () => {
    const user = await makeUser(ctx);
    await ctx
      .http()
      .put(`${API}/me/notification-preferences/lobbies`)
      .set(as(user.id))
      .send({ push: true, email: false, inApp: false })
      .expect(200);
    expect(await send(user.id, "muted")).toBe(0);
    // Account notifications always arrive.
    expect(await notifications.notify([user.id], { type: "account_approved", title: "ok", body: "" })).toBe(1);
  });

  it("registers push tokens, moves them between users, and removes them", async () => {
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const token = "ExponentPushToken[abc123]";
    await ctx.http().post(`${API}/me/push-tokens`).set(as(a.id)).send({ expoToken: "not-a-token", platform: "android" }).expect(400);
    await ctx.http().post(`${API}/me/push-tokens`).set(as(a.id)).send({ expoToken: token, platform: "android" }).expect(201);
    await ctx.http().post(`${API}/me/push-tokens`).set(as(b.id)).send({ expoToken: token, platform: "ios" }).expect(201);
    expect(await ctx.prisma.pushToken.findUniqueOrThrow({ where: { expoToken: token } })).toMatchObject({ userId: b.id, platform: "ios" });
    await ctx.http().delete(`${API}/me/push-tokens/${encodeURIComponent(token)}`).set(as(a.id)).expect(404);
    await ctx.http().delete(`${API}/me/push-tokens/${encodeURIComponent(token)}`).set(as(b.id)).expect(204);
  });
});
