import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { io, type Socket } from "socket.io-client";
import { NotificationDeliveryService } from "../src/modules/notifications/notification-delivery.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { LobbyJobsService } from "../src/modules/lobbies/lobby-jobs.service";
import { API, as, createTestApp, makeUser, resetDb, seededGame, type TestContext } from "./helpers";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TOKEN = (n: string) => `ExponentPushToken[test-${n}-${Date.now()}]`;

describe("Delivery, lobby jobs and live updates (step 3d)", () => {
  let ctx: TestContext;
  let game: Awaited<ReturnType<typeof seededGame>>;
  let delivery: NotificationDeliveryService;
  let jobs: LobbyJobsService;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
    game = await seededGame(ctx);
    delivery = ctx.app.get(NotificationDeliveryService);
    jobs = ctx.app.get(LobbyJobsService);
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => {
    ctx.push.sent = [];
    ctx.push.invalid = [];
    ctx.mail.sent = [];
  });

  const create = (hostId: string, overrides: Record<string, unknown> = {}) =>
    ctx
      .http()
      .post(`${API}/lobbies`)
      .set(as(hostId))
      .send({ gameId: game.id, modeId: game.modes[0]!.id, lobbyCode: "SECRET-1", visibility: "public", capacity: 5, startsAt: new Date().toISOString(), ...overrides })
      .expect(201);
  const registerPush = async (userId: string) => {
    const expoToken = TOKEN(userId);
    await ctx.http().post(`${API}/me/push-tokens`).set(as(userId)).send({ expoToken, platform: "android" }).expect(201);
    return expoToken;
  };
  const setPrefs = (userId: string, group: string, prefs: { push: boolean; email: boolean; inApp: boolean }) =>
    ctx.http().put(`${API}/me/notification-preferences/${group}`).set(as(userId)).send(prefs).expect(200);
  const inbox = async (userId: string) => (await ctx.http().get(`${API}/me/notifications`).set(as(userId)).expect(200)).body.items as { type: string }[];

  describe("delivery (NOT-01, NOT-03)", () => {
    it("sends a push for each device, once", async () => {
      const user = await makeUser(ctx);
      const token = await registerPush(user.id);
      await ctx.app.get(NotificationsService).notify([user.id], { type: "lobby_code_changed", title: "Code changed", body: "See it", data: { lobbyId: "L1" } });
      await delivery.flush();
      await delivery.flush();
      expect(ctx.push.sent.filter((m) => m.to === token)).toHaveLength(1);
      expect(ctx.push.sent[0]).toMatchObject({ title: "Code changed", data: { lobbyId: "L1" } });
    });

    it("respects each channel separately", async () => {
      const user = await makeUser(ctx);
      const token = await registerPush(user.id);
      await setPrefs(user.id, "lobbies", { push: false, email: true, inApp: false });
      await ctx.app.get(NotificationsService).notify([user.id], { type: "lobby_code_changed", title: "Code changed", body: "See it" });
      await delivery.flush();
      expect(ctx.push.sent.filter((m) => m.to === token)).toHaveLength(0);
      expect(ctx.mail.sent.filter((m) => m.to === user.email)).toHaveLength(1);
      expect(await inbox(user.id)).toHaveLength(0);
    });

    it("removes push tokens that no longer work", async () => {
      const user = await makeUser(ctx);
      const token = await registerPush(user.id);
      ctx.push.invalid = [token];
      await ctx.app.get(NotificationsService).notify([user.id], { type: "lobby_code_changed", title: "x", body: "y" });
      await delivery.flush();
      expect(await ctx.prisma.pushToken.count({ where: { expoToken: token } })).toBe(0);
    });

    it("never puts chat in the inbox; chat push is off unless turned on", async () => {
      const host = await makeUser(ctx);
      const member = await makeUser(ctx);
      const hostToken = await registerPush(host.id);
      const lobby = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/members`).set(as(member.id)).expect(201);
      await delivery.flush();
      ctx.push.sent = [];
      const say = () => ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(member.id)).send({ body: "hello" }).expect(201);

      await say();
      await delivery.flush();
      expect(ctx.push.sent).toHaveLength(0);

      await setPrefs(host.id, "lobby_chat", { push: true, email: true, inApp: true });
      await say();
      await delivery.flush();
      expect(ctx.push.sent.filter((m) => m.to === hostToken && m.body.includes("hello"))).toHaveLength(1);
      expect(ctx.mail.sent).toHaveLength(0);
      expect((await inbox(host.id)).filter((n) => n.type === "chat_message")).toHaveLength(0);
    });
  });

  describe("lobby jobs", () => {
    it("LOB-09: expires a lobby after its time, hides the code and asks for ratings", async () => {
      const host = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.prisma.lobby.update({ where: { id: lobby.id }, data: { startsAt: new Date(Date.now() - 3 * HOUR) } });
      await jobs.runAll();
      const seen = await ctx.http().get(`${API}/lobbies/${lobby.id}`).set(as(host.id)).expect(200);
      expect(seen.body).toMatchObject({ status: "expired", lobbyCode: null });
      expect((await inbox(host.id)).map((n) => n.type)).toContain("rate_teammates");
      const mine = await ctx.http().get(`${API}/lobbies?mine=true`).set(as(host.id)).expect(200);
      expect(mine.body.items).toHaveLength(0);
    });

    it("leaves a lobby alone before its expiry time", async () => {
      const host = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await jobs.runAll();
      expect((await ctx.prisma.lobby.findUniqueOrThrow({ where: { id: lobby.id } })).status).toBe("open");
    });

    it("LOB-12: reminds members once, before a scheduled start", async () => {
      const host = await makeUser(ctx);
      const lobby = (await create(host.id, { startsAt: new Date(Date.now() + HOUR).toISOString() })).body;
      await jobs.runAll();
      expect((await inbox(host.id)).map((n) => n.type)).not.toContain("lobby_starting_soon");

      await ctx.prisma.lobby.update({ where: { id: lobby.id }, data: { startsAt: new Date(Date.now() + 5 * MINUTE) } });
      await ctx.prisma.lobby.update({ where: { id: lobby.id }, data: { createdAt: new Date(Date.now() - HOUR) } });
      await jobs.runAll();
      await jobs.runAll();
      expect((await inbox(host.id)).filter((n) => n.type === "lobby_starting_soon")).toHaveLength(1);
    });

    it("sends no reminder for a lobby starting right away", async () => {
      const host = await makeUser(ctx);
      await create(host.id, { startsAt: new Date(Date.now() + 2 * MINUTE).toISOString() });
      await jobs.runAll();
      expect((await inbox(host.id)).map((n) => n.type)).not.toContain("lobby_starting_soon");
    });

    it("moving the start time allows a new reminder", async () => {
      const host = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.prisma.lobby.update({ where: { id: lobby.id }, data: { reminderSentAt: new Date() } });
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ startsAt: new Date(Date.now() + HOUR).toISOString() }).expect(200);
      expect((await ctx.prisma.lobby.findUniqueOrThrow({ where: { id: lobby.id } })).reminderSentAt).toBeNull();
    });

    it("LOB-11: deletes chat 7 days after a lobby ends, and not before", async () => {
      const host = await makeUser(ctx);
      const lobby = (await create(host.id)).body;
      await ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(host.id)).send({ body: "hi" }).expect(201);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ status: "closed" }).expect(200);
      await jobs.runAll();
      expect(await ctx.prisma.chatMessage.count({ where: { lobbyId: lobby.id } })).toBeGreaterThan(0);
      await ctx.prisma.lobby.update({ where: { id: lobby.id }, data: { closedAt: new Date(Date.now() - 8 * 24 * HOUR) } });
      await jobs.runAll();
      expect(await ctx.prisma.chatMessage.count({ where: { lobbyId: lobby.id } })).toBe(0);
    });
  });

  describe("live updates (NFR-02)", () => {
    let url: string;
    const sockets: Socket[] = [];

    beforeAll(async () => {
      await ctx.app.listen(0);
      url = `http://127.0.0.1:${((ctx.app.getHttpServer() as Server).address() as AddressInfo).port}`;
    });
    afterEach(() => {
      for (const s of sockets.splice(0)) s.disconnect();
    });

    const connect = (auth: Record<string, string>) =>
      new Promise<Socket>((resolve, reject) => {
        const socket = io(url, { auth, transports: ["websocket"], reconnection: false });
        sockets.push(socket);
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", reject);
      });
    const next = <T = unknown>(socket: Socket, event: string) =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No ${event} event`)), 5000);
        socket.once(event, (payload: T) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });
    const never = (socket: Socket, event: string) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(true), 1000);
        socket.once(event, () => {
          clearTimeout(timer);
          resolve(false);
        });
      });
    const watch = async (socket: Socket, lobbyId: string) => {
      socket.emit("lobby:watch", lobbyId);
      await new Promise((r) => setTimeout(r, 200));
    };

    it("refuses connections without a session, and banned users", async () => {
      await expect(connect({})).rejects.toThrow(/log in/);
      const banned = await makeUser(ctx, { status: "banned" });
      await expect(connect({ devUserId: banned.id })).rejects.toThrow(/log in/);
    });

    it("signals browse, lobby and chat changes, without any lobby data", async () => {
      const host = await makeUser(ctx);
      const viewer = await makeUser(ctx);
      const socket = await connect({ devUserId: viewer.id });
      const browse = next(socket, "lobbies:changed");
      const lobby = (await create(host.id, { visibility: "private" })).body;
      await browse;

      await watch(socket, lobby.id);
      const changed = next(socket, "lobby:changed");
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ lobbyCode: "SECRET-2" }).expect(200);
      const payload = await changed;
      expect(payload).toEqual({ lobbyId: lobby.id });
      expect(JSON.stringify(payload)).not.toContain("SECRET");

      const chat = next(socket, "chat:message");
      await ctx.http().post(`${API}/lobbies/${lobby.id}/messages`).set(as(host.id)).send({ body: "private words" }).expect(201);
      expect(await chat).toEqual({ lobbyId: lobby.id });
    });

    it("tells a user their inbox changed, and nobody else", async () => {
      const user = await makeUser(ctx);
      const other = await makeUser(ctx);
      const mine = await connect({ devUserId: user.id });
      const theirs = await connect({ devUserId: other.id });
      const quiet = never(theirs, "notifications:changed");
      const signal = next(mine, "notifications:changed");
      await ctx.app.get(NotificationsService).notify([user.id], { type: "lobby_code_changed", title: "x", body: "y" });
      await delivery.flush();
      await signal;
      expect(await quiet).toBe(true);
    });

    it("gives staff, and pending students who haven't sent their details, no lobby signals", async () => {
      const host = await makeUser(ctx);
      const staff = await connect({ devUserId: (await makeUser(ctx, { roles: ["moderator"] })).id });
      const pending = await connect({ devUserId: (await makeUser(ctx, { status: "pending" })).id });
      const lobby = (await create(host.id)).body;
      await watch(staff, lobby.id);
      await watch(pending, lobby.id);
      const quiet = Promise.all([never(staff, "lobby:changed"), never(pending, "lobby:changed"), never(staff, "lobbies:changed")]);
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ note: "changed" }).expect(200);
      expect(await quiet).toEqual([true, true, true]);
    });

    it("gives students waiting for approval lobby signals, which carry no data (ACC-06)", async () => {
      const host = await makeUser(ctx);
      const student = await makeUser(ctx, { status: "pending" });
      await ctx.prisma.approvalRequest.create({ data: { userId: student.id } });
      const socket = await connect({ devUserId: student.id });
      const lobby = (await create(host.id, { visibility: "private", lobbyCode: "SECRET-3" })).body;
      await watch(socket, lobby.id);
      const changed = next(socket, "lobby:changed");
      await ctx.http().patch(`${API}/lobbies/${lobby.id}`).set(as(host.id)).send({ note: "changed" }).expect(200);
      const payload = await changed;
      expect(payload).toEqual({ lobbyId: lobby.id });
      expect(JSON.stringify(payload)).not.toContain("SECRET");
    });
  });
});
