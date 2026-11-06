import { lobbyCodeSchema } from "@chill-hub/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../src/components/text";
import { ChipGroup, LobbyNeedsFields, StartTimeField, toOptions, type LobbyNeeds } from "../../src/components/lobby";
import { Banner, Button, Disclosure, Field, Muted, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import type { Lobby, LobbyGame, Page } from "../../src/lib/lobby";

const NEEDS: LobbyNeeds = { playersNeeded: 1, minRankId: null, maxRankId: null, neededRoleIds: [], voiceChat: false, note: "" };

function VisibilityChoice({ title, text, selected, onPress }: { title: string; text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`gap-0.5 rounded-[10px] border p-3 ${selected ? "border-accent bg-accent-soft" : "border-line bg-card"}`}
    >
      <Text className="font-semibold text-ink">{title}</Text>
      <Muted>{text}</Muted>
    </Pressable>
  );
}

/**
 * Create a lobby on one screen (LOB-01). Only the game, the mode and the in-game code are required (LOB-02);
 * everything else has a sensible default and sits under "More options".
 */
export default function CreateLobby() {
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [needs, setNeeds] = useState(NEEDS);
  const [start, setStart] = useState<{ kind: "now" | "keep" } | { kind: "at"; date: Date } | null>({ kind: "now" });
  // StartTimeField keeps its own text, so a new key clears it after publishing.
  const [formKey, setFormKey] = useState(0);
  const [limit, setLimit] = useState<{ used: number; max: number }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<LobbyGame[]>("/games").then(setGames).catch((err) => setError(errorMessage(err)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api<Page<Lobby>>("/lobbies?mine=true"), api<{ max_active_lobbies_per_player?: number }>("/settings/public")])
        .then(([mine, settings]) => setLimit({ used: mine.items.length, max: settings.max_active_lobbies_per_player ?? 3 }))
        .catch(() => undefined); // only a hint; the API enforces the limit
    }, []),
  );

  const game = games.find((g) => g.id === gameId);
  const full = !!limit && limit.used >= limit.max;

  function chooseGame(id: string | null) {
    setGameId(id);
    setModeId(null);
    const chosen = games.find((g) => g.id === id);
    setNeeds({ ...NEEDS, playersNeeded: chosen ? Math.max(1, Math.min(chosen.teamSize, chosen.maxLobbySize) - 1) : 1 });
  }

  function reset() {
    setGameId(null);
    setModeId(null);
    setCode("");
    setVisibility("public");
    setNeeds(NEEDS);
    setStart({ kind: "now" });
    setFormKey((k) => k + 1);
  }

  async function publish() {
    if (!gameId || !modeId || !start) return;
    if (!lobbyCodeSchema.safeParse(code).success) {
      setCodeError("Enter the lobby code from the game. Players can't join without it.");
      return;
    }
    setCodeError(undefined);
    setBusy(true);
    setError(undefined);
    try {
      const lobby = await api<Lobby>("/lobbies", {
        method: "POST",
        body: {
          gameId,
          modeId,
          lobbyCode: code.trim(),
          visibility,
          capacity: needs.playersNeeded + 1,
          minRankId: needs.minRankId,
          maxRankId: needs.maxRankId,
          neededRoleIds: needs.neededRoleIds,
          voiceChat: needs.voiceChat,
          startsAt: (start.kind === "at" ? start.date : new Date()).toISOString(),
          note: needs.note.trim() || null,
        },
      });
      reset();
      router.push(`/lobby/${lobby.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Create lobby">
      {limit && full ? <Banner tone="bad">{`You're already in ${limit.used} of ${limit.max} allowed lobbies. Leave or close one first.`}</Banner> : null}
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <ChipGroup label="Game" options={toOptions(games)} value={gameId} onChange={chooseGame} />
      {game ? <ChipGroup label="Mode" options={toOptions(game.modes)} value={modeId} onChange={setModeId} /> : null}
      {game && modeId ? (
        <Field
          label="Lobby code"
          value={code}
          onChangeText={setCode}
          error={codeError}
          hint={`Make the party in ${game.name}, then paste its code here.`}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={64}
        />
      ) : null}
      {game ? (
        <Disclosure title="More options">
          <LobbyNeedsFields game={game} needs={needs} onChange={setNeeds} />
          <StartTimeField key={formKey} onChange={setStart} />
          <View className="gap-2">
            <Text className="text-sm font-medium text-ink">Who can see the code?</Text>
            <VisibilityChoice title="Public" text="Any approved player can take a slot." selected={visibility === "public"} onPress={() => setVisibility("public")} />
            <VisibilityChoice title="Private" text="Players send a request first." selected={visibility === "private"} onPress={() => setVisibility("private")} />
          </View>
        </Disclosure>
      ) : null}
      <Button title="Publish lobby" onPress={publish} busy={busy} disabled={!gameId || !modeId || !code.trim() || !start || full} />
    </Screen>
  );
}
