import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { nextOccurrence, rankRange, startLabel, type Lobby, type LobbyGame, type Named } from "../lib/lobby";
import { Button, Chip, Field, Muted } from "./ui";

export function LobbyCard({ lobby }: { lobby: Lobby }) {
  const title = `${lobby.game.name} · ${lobby.mode.name}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={() => router.push(`/lobby/${lobby.id}`)}
      className="gap-1 rounded-[10px] border border-line bg-white p-3"
    >
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-semibold text-ink">
          {title}
          {lobby.visibility === "private" ? " 🔒" : ""}
        </Text>
        <Text className="font-semibold text-accent">
          {lobby.memberCount}/{lobby.capacity}
        </Text>
      </View>
      <Muted>
        {startLabel(lobby.startsAt)} · {rankRange(lobby)} · {lobby.voiceChat ? "Voice" : "No voice"}
      </Muted>
      {lobby.neededRoles.length ? <Muted>Needs {lobby.neededRoles.map((r) => r.name).join(", ")}</Muted> : null}
      <Muted>
        {lobby.viewer.isHost ? "You're the host" : lobby.viewer.isMember ? `Host ${lobby.host.displayName ?? "unknown"} · you're in` : `Host ${lobby.host.displayName ?? "unknown"}`}
      </Muted>
      {lobby.viewer.isMember && lobby.lobbyCode ? <Text className="font-mono font-bold text-ink">Code {lobby.lobbyCode}</Text> : null}
    </Pressable>
  );
}

export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  /** The selected value; tap it again to clear. */
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value === value ? null : o.value)} />
        ))}
      </View>
    </View>
  );
}

const toOptions = (items: Named[]) => items.map((i) => ({ value: i.id, label: i.name }));

export { toOptions };

/** Who the host needs: shared by create step 3 and the edit screen. */
export interface LobbyNeeds {
  playersNeeded: number;
  minRankId: string | null;
  maxRankId: string | null;
  neededRoleIds: string[];
  voiceChat: boolean;
  note: string;
}

export function LobbyNeedsFields({
  game,
  needs,
  onChange,
  minPlayersNeeded = 1,
}: {
  game: LobbyGame;
  needs: LobbyNeeds;
  onChange: (needs: LobbyNeeds) => void;
  /** Can't drop below the players already in the lobby. */
  minPlayersNeeded?: number;
}) {
  const max = game.maxLobbySize - 1;
  const set = (patch: Partial<LobbyNeeds>) => onChange({ ...needs, ...patch });
  return (
    <>
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Players needed (besides you)</Text>
        <View className="flex-row items-center gap-3">
          <Button title="−" variant="secondary" disabled={needs.playersNeeded <= minPlayersNeeded} onPress={() => set({ playersNeeded: needs.playersNeeded - 1 })} />
          <Text accessibilityLiveRegion="polite" className="w-8 text-center text-lg font-semibold text-ink">
            {needs.playersNeeded}
          </Text>
          <Button title="+" variant="secondary" disabled={needs.playersNeeded >= max} onPress={() => set({ playersNeeded: needs.playersNeeded + 1 })} />
        </View>
        <Muted>Up to {max} for {game.name}.</Muted>
      </View>
      <ChipGroup label="Lowest rank (optional)" options={toOptions(game.ranks)} value={needs.minRankId} onChange={(minRankId) => set({ minRankId })} />
      <ChipGroup label="Highest rank (optional)" options={toOptions(game.ranks)} value={needs.maxRankId} onChange={(maxRankId) => set({ maxRankId })} />
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Roles needed (optional)</Text>
        <View className="flex-row flex-wrap gap-2">
          {game.roles.map((role) => (
            <Chip
              key={role.id}
              label={role.name}
              selected={needs.neededRoleIds.includes(role.id)}
              onPress={() =>
                set({
                  neededRoleIds: needs.neededRoleIds.includes(role.id) ? needs.neededRoleIds.filter((id) => id !== role.id) : [...needs.neededRoleIds, role.id],
                })
              }
            />
          ))}
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-medium text-ink">Voice chat</Text>
        <Chip label={needs.voiceChat ? "Voice on" : "No voice"} selected={needs.voiceChat} onPress={() => set({ voiceChat: !needs.voiceChat })} />
      </View>
      <Field label="Note (optional)" value={needs.note} onChangeText={(note) => set({ note })} maxLength={300} multiline placeholder="e.g. Chill games, mic required" />
    </>
  );
}

/** Now, or a clock time within the next 24 hours. Returns null while a typed time can't be read. */
export function StartTimeField({ onChange, keepLabel }: { onChange: (start: { kind: "now" | "keep" } | { kind: "at"; date: Date } | null) => void; keepLabel?: string }) {
  const first = keepLabel ? "keep" : "now";
  const [mode, setMode] = useState<"now" | "keep" | "at">(first);
  const [text, setText] = useState("");
  const parsed = mode === "at" ? nextOccurrence(text) : null;

  function choose(next: "now" | "keep" | "at") {
    setMode(next);
    onChange(next === "at" ? nextOccurrence(text) && { kind: "at", date: nextOccurrence(text)! } : { kind: next });
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">Start</Text>
      <View className="flex-row flex-wrap gap-2">
        {keepLabel ? <Chip label={keepLabel} selected={mode === "keep"} onPress={() => choose("keep")} /> : null}
        <Chip label="Now" selected={mode === "now"} onPress={() => choose("now")} />
        <Chip label="Schedule" selected={mode === "at"} onPress={() => choose("at")} />
      </View>
      {mode === "at" ? (
        <Field
          label="Start time"
          value={text}
          placeholder="e.g. 8:30 PM or 20:30"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => {
            setText(value);
            const date = nextOccurrence(value);
            onChange(date ? { kind: "at", date } : null);
          }}
          error={text && !parsed ? "Enter a time like 8:30 PM or 20:30" : undefined}
          hint={parsed ? startLabel(parsed.toISOString()) : "Lobbies can be scheduled up to 24 hours ahead."}
        />
      ) : null}
    </View>
  );
}
