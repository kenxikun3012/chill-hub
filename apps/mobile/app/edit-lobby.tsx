import { lobbyCodeSchema } from "@chill-hub/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ChipGroup, LobbyNeedsFields, StartTimeField, toOptions, type LobbyNeeds } from "../src/components/lobby";
import { Banner, Button, Field, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import { startLabel, type LobbyDetail, type LobbyGame } from "../src/lib/lobby";

/** Host edits (LOB-07). Changing the code tells every member; the API handles that. */
export default function EditLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lobby, setLobby] = useState<LobbyDetail>();
  const [game, setGame] = useState<LobbyGame>();
  const [code, setCode] = useState("");
  const [modeId, setModeId] = useState<string | null>(null);
  const [needs, setNeeds] = useState<LobbyNeeds>();
  const [start, setStart] = useState<{ kind: "now" | "keep" } | { kind: "at"; date: Date } | null>({ kind: "keep" });
  const [codeError, setCodeError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<LobbyDetail>(`/lobbies/${id}`)
      .then(async (l) => {
        setGame(await api<LobbyGame>(`/games/${l.game.id}`));
        setLobby(l);
        setCode(l.lobbyCode ?? "");
        setModeId(l.mode.id);
        setNeeds({
          playersNeeded: l.capacity - 1,
          minRankId: l.minRank?.id ?? null,
          maxRankId: l.maxRank?.id ?? null,
          neededRoleIds: l.neededRoles.map((r) => r.id),
          voiceChat: l.voiceChat,
          note: l.note ?? "",
        });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  async function save() {
    if (!needs || !modeId || !start) return;
    if (!lobbyCodeSchema.safeParse(code).success) {
      setCodeError("Enter the lobby code from the game. Players can't join without it.");
      return;
    }
    setCodeError(undefined);
    setError(undefined);
    setBusy(true);
    try {
      await api(`/lobbies/${id}`, {
        method: "PATCH",
        body: {
          modeId,
          lobbyCode: code.trim(),
          capacity: needs.playersNeeded + 1,
          minRankId: needs.minRankId,
          maxRankId: needs.maxRankId,
          neededRoleIds: needs.neededRoleIds,
          voiceChat: needs.voiceChat,
          note: needs.note.trim() || null,
          ...(start.kind === "at" ? { startsAt: start.date.toISOString() } : start.kind === "now" ? { startsAt: new Date().toISOString() } : {}),
        },
      });
      router.back();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen title="Edit lobby" back>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {lobby && game && needs ? (
        <>
          <Field label="In-game lobby code" value={code} onChangeText={setCode} error={codeError} hint="Changing it tells every member." autoCapitalize="none" autoCorrect={false} maxLength={64} />
          <ChipGroup label="Mode" options={toOptions(game.modes)} value={modeId} onChange={(m) => m && setModeId(m)} />
          <LobbyNeedsFields game={game} needs={needs} onChange={setNeeds} minPlayersNeeded={Math.max(1, lobby.memberCount - 1)} />
          <StartTimeField onChange={setStart} keepLabel={`Keep: ${startLabel(lobby.startsAt)}`} />
          <Muted>The lobby stays {lobby.visibility}.</Muted>
          <Button title="Save changes" onPress={save} busy={busy} disabled={!start} />
        </>
      ) : null}
    </Screen>
  );
}
