import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { io, type Socket } from "socket.io-client";
import { api, SERVER_URL, tokenStore } from "./api";
import { useSession } from "./session";

interface RealtimeValue {
  socket: Socket | null;
  unread: number;
  refreshUnread: () => void;
}

const RealtimeContext = createContext<RealtimeValue>({ socket: null, unread: 0, refreshUnread: () => undefined });

/** The live connection, while logged in. Events only say what changed; screens reload it through the API. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { account } = useSession();
  const userId = account?.id;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    api<{ unread: number }>("/me/notifications/unread-count")
      .then((res) => setUnread(res.unread))
      .catch(() => undefined); // the badge can wait for the next change
  }, []);

  useEffect(() => {
    if (!userId) return;
    const connection = io(SERVER_URL, {
      auth: (send) => {
        void tokenStore.get().then((token) => send(token ? { token } : {}));
      },
      withCredentials: true,
      // Apps have no browser cookies or cross-origin limits, so they can go straight to WebSocket.
      transports: Platform.OS === "web" ? ["polling", "websocket"] : ["websocket"],
    });
    connection.on("notifications:changed", refreshUnread);
    connection.on("connect", refreshUnread);
    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
      setUnread(0);
    };
  }, [userId, refreshUnread]);

  const value = useMemo(() => ({ socket, unread, refreshUnread }), [socket, unread, refreshUnread]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

/**
 * Reloads when any of these events arrive and after reconnecting, since events are missed while offline.
 * Only while this screen is open. Bursts are combined, so one change doesn't cause several reloads.
 */
export function useLiveReload(events: string[], reload: () => void, delayMs = 150) {
  const { socket } = useRealtime();
  const latest = useRef(reload);
  latest.current = reload;
  const names = events.join(" ");

  useFocusEffect(
    useCallback(() => {
      if (!socket) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let connectedBefore = socket.connected;
      const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(() => latest.current(), delayMs);
      };
      const onConnect = () => {
        if (connectedBefore) fire();
        connectedBefore = true;
      };
      const list = names.split(" ");
      for (const event of list) socket.on(event, fire);
      socket.on("connect", onConnect);
      return () => {
        clearTimeout(timer);
        for (const event of list) socket.off(event, fire);
        socket.off("connect", onConnect);
      };
    }, [socket, names, delayMs]),
  );
}

/** Joins a lobby's room while its page is open, including after reconnecting. */
export function useWatchLobby(lobbyId: string | undefined) {
  const { socket } = useRealtime();
  useFocusEffect(
    useCallback(() => {
      if (!socket || !lobbyId) return;
      const watch = () => socket.emit("lobby:watch", lobbyId);
      if (socket.connected) watch();
      socket.on("connect", watch);
      return () => {
        socket.off("connect", watch);
        socket.emit("lobby:unwatch", lobbyId);
      };
    }, [socket, lobbyId]),
  );
}
