import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";
import { nextOccurrence, rankRange, startLabel, type Lobby, type LobbyGame, type Named } from "../lib/lobby";
import { useColors } from "../lib/theme";
import Animated from "react-native-reanimated";
import { LiveDot, Press, rise } from "./motion";
import { Button, Chip, Field, Muted, SlotBar, Tag } from "./ui";

/** "VAL" for Valorant, "ML" for Mobile Legends: a short mark for the game tile. */
const GAME_MARKS: Record<string, string> = { "PUBG Mobile": "PUBG", "Chess.com": "CC", "Dota 2": "D2" };

function gameMark(name: string) {
  if (GAME_MARKS[name]) return GAME_MARKS[name];
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words.map((w) => w[0]).join("") : name.slice(0, 3)).toUpperCase().slice(0, 4);
}

export function LobbyCard({ lobby, index = 0 }: { lobby: Lobby; index?: number }) {
  const title = `${lobby.game.name} · ${lobby.mode.name}`;
  const colors = useColors();
  const live = ["Started", "Starts now"].includes(startLabel(lobby.startsAt));
  const tags = [rankRange(lobby), ...lobby.neededRoles.map((r) => `Needs ${r.name}`)];
  return (
    <Animated.View entering={rise(index)}>
    <Press
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={() => router.push(`/lobby/${lobby.id}`)}
      className="gap-2.5 rounded-[10px] border border-line bg-card px-4 py-3.5 active:bg-raised"
    >
      <View className="flex-row items-center gap-3">
        <View accessibilityElementsHidden importantForAccessibility="no" className="h-11 w-11 items-center justify-center rounded-[10px] bg-accent-soft">
          <Text className="font-display text-sm text-soft-text">{gameMark(lobby.game.name)}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="font-bold text-ink">{title}</Text>
            {lobby.visibility === "private" ? <Ionicons name="lock-closed" size={14} color={colors.muted} accessibilityLabel="Private" /> : null}
          </View>
          <View className="flex-row items-center gap-1.5">
            {live ? <LiveDot /> : null}
            <Muted>
              {startLabel(lobby.startsAt)} · {lobby.voiceChat ? "Voice" : "No voice"}
            </Muted>
          </View>
        </View>
        <View className="items-end gap-1.5">
          <Text className="font-bold text-ink">
            {lobby.memberCount}/{lobby.capacity}
          </Text>
          <SlotBar taken={lobby.memberCount} total={lobby.capacity} />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </View>
      <Muted>
        {lobby.viewer.isHost ? "You're the host" : lobby.viewer.isMember ? `Host ${lobby.host.displayName ?? "unknown"} · you're in` : `Host ${lobby.host.displayName ?? "unknown"}`}
      </Muted>
      {lobby.viewer.isMember && lobby.lobbyCode ? (
        <View className="flex-row items-center gap-2 rounded-[10px] bg-raised px-3 py-2">
          <Text className="text-sm text-muted">Code</Text>
          <Text className="font-mono text-base font-bold tracking-widest text-ink">{lobby.lobbyCode}</Text>
        </View>
      ) : null}
    </Press>
    </Animated.View>
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
      {game.ranks.length ? (
        <>
          <ChipGroup label="Lowest rank" options={toOptions(game.ranks)} value={needs.minRankId} onChange={(minRankId) => set({ minRankId })} />
          <ChipGroup label="Highest rank" options={toOptions(game.ranks)} value={needs.maxRankId} onChange={(maxRankId) => set({ maxRankId })} />
        </>
      ) : null}
      {game.roles.length ? (
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Roles needed</Text>
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
      ) : null}
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-medium text-ink">Voice chat</Text>
        <Chip label={needs.voiceChat ? "Voice on" : "No voice"} selected={needs.voiceChat} onPress={() => set({ voiceChat: !needs.voiceChat })} />
      </View>
      <Field label="Note" value={needs.note} onChangeText={(note) => set({ note })} maxLength={300} multiline placeholder="e.g. Chill games, mic required" />
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

/** The "Games" dropdown button: shows how many games are picked. */
export function GamesButton({ count, open, onPress }: { count: number; open: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={count ? `Games, ${count} selected` : "Games, all"}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      className={`min-h-[44px] flex-1 flex-row items-center gap-2 rounded-[10px] border bg-card px-3.5 ${count ? "border-accent" : "border-line"}`}
    >
      <Text className="flex-1 font-semibold text-ink">{count ? "Games" : "All games"}</Text>
      {count ? (
        <View className="h-[22px] min-w-[22px] items-center justify-center rounded-tag bg-accent px-1.5">
          <Text className="text-xs font-bold text-on-accent">{count}</Text>
        </View>
      ) : null}
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
    </Press>
  );
}

/** A multi-select list of games. Tapping a row picks or clears it right away. */
export function GamesPanel({ games, selected, onChange, onDone }: { games: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void; onDone: () => void }) {
  const colors = useColors();
  return (
    <View accessibilityRole="menu" className="overflow-hidden rounded-[10px] border border-accent bg-card">
      {games.map((g) => {
        const on = selected.includes(g.id);
        return (
          <Pressable
            key={g.id}
            accessibilityRole="checkbox"
            accessibilityLabel={g.name}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? selected.filter((id) => id !== g.id) : [...selected, g.id])}
            className="min-h-[48px] flex-row items-center gap-3 border-b border-line px-3.5 active:bg-raised"
          >
            <View className={`h-[22px] w-[22px] items-center justify-center rounded-tag ${on ? "bg-accent" : "border-2 border-line"}`}>
              {on ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
            </View>
            <Text className={`flex-1 ${on ? "font-bold text-ink" : "font-medium text-ink"}`}>{g.name}</Text>
          </Pressable>
        );
      })}
      <View className="flex-row gap-2 bg-raised p-3">
        <View>
          <Button title="Clear" variant="secondary" disabled={!selected.length} onPress={() => onChange([])} />
        </View>
        <View className="flex-1">
          <Button title="Done" onPress={onDone} />
        </View>
      </View>
    </View>
  );
}
