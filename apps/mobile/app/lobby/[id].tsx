import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar } from "../../src/components/profile";
import { Banner, Button, Chip, Muted, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import { isActive, rankRange, startLabel, type ChatMessage, type JoinRequest, type LobbyDetail, type Page } from "../../src/lib/lobby";
import { useSession } from "../../src/lib/session";

const LOBBY_REFRESH_MS = 10_000;
const CHAT_REFRESH_MS = 5_000;

function CodeBar({ code, visibility }: { code: string | null; visibility: string }) {
  const [copied, setCopied] = useState(false);
  if (!code) {
    return <Banner>🔒 The code is shown after the host accepts you.</Banner>;
  }
  return (
    <View className="flex-row items-center gap-2 rounded-[10px] bg-accent-soft p-3">
      <View className="flex-1">
        <Muted>Lobby code · {visibility}</Muted>
        <Text selectable className="font-mono text-lg font-bold text-ink">
          {code}
        </Text>
      </View>
      <Button
        title={copied ? "Copied" : "Copy"}
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(code);
          setCopied(true);
        }}
      />
    </View>
  );
}

/** Two taps, because a native confirm dialog doesn't exist on web. */
function ConfirmButton({ title, confirm, onConfirm, primary }: { title: string; confirm: string; onConfirm: () => void; primary?: boolean }) {
  const [armed, setArmed] = useState(false);
  return <Button title={armed ? confirm : title} variant={primary ? "primary" : "secondary"} onPress={() => (armed ? onConfirm() : setArmed(true))} />;
}

function Chat({ lobbyId, readOnly }: { lobbyId: string; readOnly: boolean }) {
  const { account } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]); // oldest first
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const atBottom = useRef(true);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map([...current, ...incoming].map((m) => [m.id, m]));
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const page = await api<Page<ChatMessage>>(`/lobbies/${lobbyId}/messages`);
      merge(page.items);
      setOlderCursor((c) => c ?? page.nextCursor);
    } catch {
      // The next refresh tries again; sending shows its own errors.
    }
  }, [lobbyId, merge]);

  useFocusEffect(
    useCallback(() => {
      void poll();
      if (readOnly) return;
      const timer = setInterval(poll, CHAT_REFRESH_MS);
      return () => clearInterval(timer);
    }, [poll, readOnly]),
  );

  async function loadOlder() {
    if (!olderCursor) return;
    atBottom.current = false;
    const page = await api<Page<ChatMessage>>(`/lobbies/${lobbyId}/messages?cursor=${olderCursor}`);
    merge(page.items);
    setOlderCursor(page.nextCursor);
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(undefined);
    try {
      merge([await api<ChatMessage>(`/lobbies/${lobbyId}/messages`, { method: "POST", body: { body } })]);
      setText("");
      atBottom.current = true;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="flex-1 gap-2">
      <ScrollView
        ref={scroller}
        className="flex-1"
        contentContainerClassName="gap-2 py-1"
        onContentSizeChange={() => {
          if (atBottom.current) scroller.current?.scrollToEnd({ animated: false });
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
        }}
        scrollEventThrottle={200}
      >
        {olderCursor ? <Button title="Load earlier messages" variant="ghost" onPress={loadOlder} /> : null}
        {!messages.length ? <Muted center>No messages yet. Say hi!</Muted> : null}
        {messages.map((m) => {
          if (m.kind === "system" || !m.sender) {
            return (
              <Text key={m.id} className="text-center text-xs text-muted">
                {m.body}
              </Text>
            );
          }
          const mine = m.sender.userId === account?.id;
          return (
            <View key={m.id} className={`max-w-[85%] gap-0.5 rounded-[10px] p-2 ${mine ? "self-end bg-accent-soft" : "self-start border border-line bg-white"}`}>
              {mine ? null : <Text className="text-xs font-semibold text-muted">{m.sender.displayName ?? "Player"}</Text>}
              <Text selectable className="text-ink">
                {m.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {readOnly ? (
        <Muted center>This lobby has ended, so the chat is read-only.</Muted>
      ) : (
        <View className="flex-row items-end gap-2">
          <TextInput
            accessibilityLabel="Message the lobby"
            placeholder="Message the lobby…"
            placeholderTextColor="#9a9a9a"
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            maxLength={1000}
            className="min-h-[48px] flex-1 rounded-[10px] border border-line bg-white px-3 text-base text-ink"
          />
          <Button title="Send" onPress={send} busy={sending} disabled={!text.trim()} />
        </View>
      )}
    </View>
  );
}

/** One lobby: everything a visitor, member or host can see and do (LOB-04, 05, 07, 10, 11). */
export default function LobbyPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account } = useSession();
  const [lobby, setLobby] = useState<LobbyDetail>();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [tab, setTab] = useState<"details" | "chat">("details");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api<LobbyDetail>(`/lobbies/${id}`);
      setLobby(next);
      setRequests(next.viewer.isHost && isActive(next) ? await api<JoinRequest[]>(`/lobbies/${id}/join-requests`) : []);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(load, LOBBY_REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const inLobby = !!lobby && (lobby.viewer.isMember || lobby.viewer.isHost);
  useEffect(() => {
    if (!inLobby) setTab("details"); // removed from the lobby while on the chat tab
  }, [inLobby]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
      void load(); // a slot may have just gone, so show the latest state
    } finally {
      setBusy(false);
    }
  }

  const title = lobby ? `${lobby.game.name} · ${lobby.mode.name}` : "Lobby";
  if (!lobby) {
    return (
      <Screen title={title} back>
        {error ? <Banner tone="bad">{error}</Banner> : null}
      </Screen>
    );
  }

  const active = isActive(lobby);
  const isHost = lobby.viewer.isHost;
  const hasSlot = lobby.memberCount < lobby.capacity;
  const openSlots = active ? Math.max(0, lobby.capacity - lobby.memberCount) : 0;
  const tabs = inLobby ? (
    <View className="flex-row gap-2">
      <Chip label="Details" selected={tab === "details"} onPress={() => setTab("details")} />
      <Chip label="Chat" selected={tab === "chat"} onPress={() => setTab("chat")} />
    </View>
  ) : null;

  if (tab === "chat") {
    return (
      <Screen title={title} back fixed>
        {tabs}
        {active ? <CodeBar code={lobby.lobbyCode} visibility={lobby.visibility} /> : null}
        <Chat lobbyId={lobby.id} readOnly={!active} />
      </Screen>
    );
  }

  return (
    <Screen title={title} back>
      {tabs}
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {active ? (
        <CodeBar code={lobby.lobbyCode} visibility={lobby.visibility} />
      ) : (
        <Banner tone="bad">This lobby has {lobby.status === "expired" ? "expired" : "closed"}. Its code is no longer shown.</Banner>
      )}
      <Muted>
        {startLabel(lobby.startsAt)} · {lobby.visibility === "private" ? "Private" : "Public"} · {lobby.status.replace("_", " ")}
      </Muted>

      {isHost && requests.length ? (
        <View className="gap-2">
          <Text accessibilityRole="header" className="text-sm font-semibold uppercase tracking-wide text-muted">
            Join requests ({requests.length})
          </Text>
          {requests.map((r) => {
            const a = r.player.inGameAccount;
            const about = [a?.rank?.name, a?.preferredRoles.map((role) => role.name).join(", "), r.player.reputation ? `👍 ${r.player.reputation.good}` : null, r.player.reputation?.noShow ? `${r.player.reputation.noShow} no-shows` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <View key={r.id} className="gap-2 rounded-[10px] border border-line bg-white p-3">
                <Text className="font-semibold text-ink" onPress={() => router.push(`/players/${r.player.userId}`)}>
                  {r.player.displayName ?? "Player"}
                </Text>
                {about ? <Muted>{about}</Muted> : null}
                <View className="flex-row justify-end gap-2">
                  <Button title="Decline" variant="secondary" disabled={busy} onPress={() => act(() => api(`/lobbies/${id}/join-requests/${r.id}`, { method: "PATCH", body: { status: "declined" } }))} />
                  <Button title="Accept" disabled={busy || !hasSlot} onPress={() => act(() => api(`/lobbies/${id}/join-requests/${r.id}`, { method: "PATCH", body: { status: "accepted" } }))} />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View className="gap-2 rounded-[10px] border border-line bg-white p-3">
        <Text className="font-semibold text-ink">
          Players {lobby.memberCount}/{lobby.capacity}
        </Text>
        {lobby.members.map((m) => {
          const name = m.displayName ?? "Player";
          const you = m.userId === account?.id;
          return (
            <View key={m.userId} className="flex-row items-center gap-2">
              <Pressable accessibilityRole="link" accessibilityLabel={`View ${name}`} onPress={() => router.push(you ? "/profile" : `/players/${m.userId}`)} className="flex-1 flex-row items-center gap-2">
                <Avatar name={name} />
                <Text className="flex-1 text-ink">
                  {name}
                  {you ? " (you)" : ""}
                  {m.isHost ? " · Host" : ""}
                </Text>
              </Pressable>
              {isHost && active && !m.isHost ? (
                <ConfirmButton title="Remove" confirm="Tap again" onConfirm={() => act(() => api(`/lobbies/${id}/members/${m.userId}`, { method: "DELETE" }))} />
              ) : null}
            </View>
          );
        })}
        {openSlots ? (
          <Muted>
            {openSlots} open slot{openSlots === 1 ? "" : "s"}
            {lobby.neededRoles.length ? ` · ${lobby.neededRoles.map((r) => r.name).join(", ")} wanted` : ""}
          </Muted>
        ) : null}
      </View>

      <Muted>Rank: {rankRange(lobby)}</Muted>
      <Muted>Voice: {lobby.voiceChat ? "On" : "No voice"}</Muted>
      {lobby.note ? <Muted>Note: {lobby.note}</Muted> : null}

      {active && !inLobby && lobby.visibility === "public" ? (
        <Button title={hasSlot ? "Take a slot" : "Lobby is full"} disabled={!hasSlot} busy={busy} onPress={() => act(() => api(`/lobbies/${id}/members`, { method: "POST" }))} />
      ) : null}
      {active && !inLobby && lobby.visibility === "private" ? (
        lobby.viewer.joinRequestStatus === "pending" && lobby.viewer.joinRequestId ? (
          <>
            <Banner>Request sent. Waiting for the host.</Banner>
            <Button title="Cancel request" variant="secondary" busy={busy} onPress={() => act(() => api(`/lobbies/${id}/join-requests/${lobby.viewer.joinRequestId}`, { method: "PATCH", body: { status: "cancelled" } }))} />
          </>
        ) : (
          <>
            {lobby.viewer.joinRequestStatus === "declined" ? <Banner tone="bad">The host declined your last request.</Banner> : null}
            <Button title={hasSlot ? "Request to join" : "Lobby is full"} disabled={!hasSlot} busy={busy} onPress={() => act(() => api(`/lobbies/${id}/join-requests`, { method: "POST" }))} />
          </>
        )
      ) : null}
      {active && lobby.viewer.isMember && !isHost ? (
        <ConfirmButton title="Leave lobby" confirm="Tap again to leave" onConfirm={() => act(() => api(`/lobbies/${id}/members/${account?.id}`, { method: "DELETE" }))} />
      ) : null}
      {active && isHost ? (
        <>
          <Button title="Edit lobby" variant="secondary" onPress={() => router.push({ pathname: "/edit-lobby", params: { id } })} />
          <ConfirmButton title="Close lobby" confirm="Tap again to close" onConfirm={() => act(() => api(`/lobbies/${id}`, { method: "PATCH", body: { status: "closed" } }))} />
        </>
      ) : null}
    </Screen>
  );
}
