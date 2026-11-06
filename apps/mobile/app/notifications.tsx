import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../src/components/text";
import { Banner, Button, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import type { Page } from "../src/lib/lobby";
import { useLiveReload, useRealtime } from "../src/lib/realtime";
import { isStaffAccount, useSession } from "../src/lib/session";

interface Notification {
  id: string;
  title: string;
  body: string;
  data: { lobbyId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

function ago(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(date).toLocaleDateString();
}

/** The inbox (NOT-04). */
export default function Notifications() {
  const { account } = useSession();
  const { refreshUnread } = useRealtime();
  const [items, setItems] = useState<Notification[]>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Notification>>("/me/notifications");
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useLiveReload(["notifications:changed"], () => void load());

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await api<Page<Notification>>(`/me/notifications?cursor=${nextCursor}`);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function readAll() {
    const now = new Date().toISOString();
    try {
      await api("/me/notifications/read-all", { method: "POST" });
      setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      refreshUnread();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function open(n: Notification) {
    if (!n.readAt) {
      setItems((current) => current?.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)));
      await api(`/me/notifications/${n.id}`, { method: "PATCH", body: { read: true } })
        .then(refreshUnread)
        .catch(() => undefined); // it stays unread next time
    }
    if (n.data?.lobbyId && !isStaffAccount(account)) router.push(`/lobby/${n.data.lobbyId}`);
  }

  const hasUnread = items?.some((n) => !n.readAt);
  return (
    <Screen title="Notifications" back right={hasUnread ? <Button title="Mark all read" variant="ghost" onPress={readAll} /> : undefined}>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {items?.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          accessibilityLabel={`${n.readAt ? "" : "Unread: "}${n.title}. ${n.body}`}
          onPress={() => void open(n)}
          className={`gap-0.5 rounded-[10px] border p-3 ${n.readAt ? "border-line bg-card" : "border-accent bg-accent-soft"}`}
        >
          <Text className={n.readAt ? "text-ink" : "font-semibold text-ink"}>{n.title}</Text>
          {n.body ? <Muted>{n.body}</Muted> : null}
          <Text className="text-xs text-muted">{ago(n.createdAt)}</Text>
        </Pressable>
      ))}
      {items && !items.length ? <Muted center>Nothing here yet.</Muted> : null}
      {nextCursor ? <Button title="Load more" variant="secondary" onPress={loadMore} /> : null}
      <View className="items-center">
        <Button title="Notification settings" variant="ghost" onPress={() => router.push("/notification-settings")} />
      </View>
    </Screen>
  );
}
