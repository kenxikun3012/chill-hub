import { Inject, Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import { idSchema } from "@chill-hub/shared";
import type { Server, Socket } from "socket.io";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { BROWSE_ROOM, lobbyRoom, RealtimeBus, userRoom } from "./realtime-bus";

/**
 * Socket.IO connection (NFR-02). Sockets are identified like API requests: session cookie on web,
 * token in the app. Rooms only receive "reload this" signals, so being in one reveals nothing.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly bus: RealtimeBus,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  afterInit(server: Server) {
    this.bus.attach(server);
    server.use((socket, next) => {
      this.admit(socket)
        .then(() => next())
        .catch((err: unknown) => {
          this.logger.debug(err instanceof Error ? err.message : String(err));
          next(new Error("Please log in"));
        });
    });
  }

  private async identify(socket: Socket): Promise<string | undefined> {
    const auth = socket.handshake.auth as { token?: unknown; devUserId?: unknown };
    if (this.env.DEV_AUTH && typeof auth.devUserId === "string") return auth.devUserId;
    const headers = new Headers();
    if (socket.handshake.headers.cookie) headers.set("cookie", socket.handshake.headers.cookie);
    if (typeof auth.token === "string") headers.set("authorization", `Bearer ${auth.token}`);
    const session = await this.authService.auth.api.getSession({ headers });
    return session?.user.id;
  }

  private async admit(socket: Socket) {
    const userId = await this.identify(socket);
    if (!userId) throw new Error("No session");
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: true, approvalRequests: { where: { status: "pending" }, select: { id: true }, take: 1 } },
    });
    if (!user || user.status === "banned") throw new Error("Account can't connect");

    await socket.join(userRoom(user.id));
    // Same rule as the lobby routes: approved players, and students waiting to be approved (details sent) who can only look. Never staff.
    const staff = user.roles.some((r) => r.role === "admin" || r.role === "moderator");
    const waiting = user.status === "pending" && user.approvalRequests.length > 0;
    const canUseLobbies = !staff && (user.status === "approved" || user.status === "suspended" || waiting);
    socket.data = { canUseLobbies };
    if (canUseLobbies) await socket.join(BROWSE_ROOM);
  }

  @SubscribeMessage("lobby:watch")
  async watch(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: unknown) {
    const parsed = idSchema.safeParse(lobbyId);
    if ((socket.data as { canUseLobbies?: boolean }).canUseLobbies && parsed.success) await socket.join(lobbyRoom(parsed.data));
  }

  @SubscribeMessage("lobby:unwatch")
  async unwatch(@ConnectedSocket() socket: Socket, @MessageBody() lobbyId: unknown) {
    const parsed = idSchema.safeParse(lobbyId);
    if (parsed.success) await socket.leave(lobbyRoom(parsed.data));
  }
}
