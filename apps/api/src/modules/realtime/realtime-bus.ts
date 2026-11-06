import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

export const userRoom = (userId: string) => `user:${userId}`;
export const lobbyRoom = (lobbyId: string) => `lobby:${lobbyId}`;
export const BROWSE_ROOM = "lobbies";

/**
 * Tells connected clients that something changed. Events only say what to reload, never the data:
 * the client refetches through the API, which decides what the viewer may see (NFR-06).
 * Rooms live in this process, which suits the single API server we run. A second server would need a shared adapter.
 */
@Injectable()
export class RealtimeBus {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  /** The inbox has something new. */
  notificationsChanged(userId: string) {
    this.server?.to(userRoom(userId)).emit("notifications:changed");
  }

  /** A lobby's details, members or requests changed (NFR-02). */
  lobbyChanged(lobbyId: string) {
    this.server?.to(lobbyRoom(lobbyId)).emit("lobby:changed", { lobbyId });
    this.server?.to(BROWSE_ROOM).emit("lobbies:changed");
  }

  chatMessage(lobbyId: string) {
    this.server?.to(lobbyRoom(lobbyId)).emit("chat:message", { lobbyId });
  }
}
