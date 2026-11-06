import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { ChipGroup, GamesButton, GamesPanel, LobbyCard, toOptions } from "../../src/components/lobby";
import { Banner, Button, Muted, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import type { Lobby, LobbyGame, Page } from "../../src/lib/lobby";
import { useLiveReload } from "../../src/lib/realtime";
import { useSession } from "../../src/lib/session";

type Voice = "on" | "off";
type When = "soon" | "later";
const HOUR = 3_600_000;

interface Filters {
  gameIds: string[];
  modeId: string | null;
  rankId: string | null;
  roleId: string | null;
  voice: Voice | null;
  visibility: "public" | "private" | null;
  when: When | null;
}

const NO_FILTERS: Filters = { gameIds: [], modeId: null, rankId: null, roleId: null, voice: null, visibility: null, when: null };

function toQuery(f: Filters) {
  const q = new URLSearchParams();
  if (f.gameIds.length) q.set("gameIds", f.gameIds.join(","));
  if (f.modeId) q.set("modeId", f.modeId);
  if (f.rankId) q.set("rankId", f.rankId);
  if (f.roleId) q.set("roleId", f.roleId);
  if (f.voice) q.set("voiceChat", String(f.voice === "on"));
  if (f.visibility) q.set("visibility", f.visibility);
  if (f.when === "soon") q.set("startsBefore", new Date(Date.now() + HOUR).toISOString());
  if (f.when === "later") q.set("startsAfter", new Date(Date.now() + HOUR).toISOString());
  return q.toString();
}

/** Browse open lobbies (LOB-06). Full lobbies are hidden by the API (LOB-08). */
export default function Lobbies() {
  const waiting = useSession().stage === "pending"; // can look, but not join (ACC-06)
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Lobby>>(`/lobbies?${toQuery(filters)}`);
      setLobbies(page.items);
      setNextCursor(page.nextCursor);
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, [filters]);

  useEffect(() => {
    api<LobbyGame[]>("/games").then(setGames).catch((err) => setError(errorMessage(err)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLiveReload(["lobbies:changed"], () => void load(), 500);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await api<Page<Lobby>>(`/lobbies?${toQuery(filters)}&cursor=${nextCursor}`);
      setLobbies((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // Mode, rank and role belong to one game, so they only show when exactly one game is picked.
  const game = filters.gameIds.length === 1 ? games.find((g) => g.id === filters.gameIds[0]) : undefined;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeCount = [filters.modeId, filters.rankId, filters.roleId, filters.voice, filters.visibility, filters.when].filter(Boolean).length;

  return (
    <Screen title="Lobbies" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {waiting ? <Banner>Waiting for approval. You can look around, but you can't join a lobby yet.</Banner> : null}
      <View className="flex-row items-center gap-2">
        <GamesButton count={filters.gameIds.length} open={showGames} onPress={() => setShowGames(!showGames)} />
        <View>
          <Button title={activeCount ? `Filters · ${activeCount}` : "Filters"} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
        </View>
      </View>
      {showGames ? (
        <GamesPanel
          games={games}
          selected={filters.gameIds}
          onChange={(gameIds) => setFilters({ ...filters, gameIds, modeId: null, rankId: null, roleId: null })}
          onDone={() => setShowGames(false)}
        />
      ) : null}

      {showFilters ? (
        <View className="gap-3 rounded-[10px] border border-line bg-card p-3">
          {game ? (
            <>
              <ChipGroup label="Mode" options={toOptions(game.modes)} value={filters.modeId} onChange={(modeId) => set({ modeId })} />
              <ChipGroup label="Fits my rank" options={toOptions(game.ranks)} value={filters.rankId} onChange={(rankId) => set({ rankId })} />
              <ChipGroup label="Role needed" options={toOptions(game.roles)} value={filters.roleId} onChange={(roleId) => set({ roleId })} />
            </>
          ) : null}
          <ChipGroup<Voice>
            label="Voice chat"
            options={[
              { value: "on", label: "Voice on" },
              { value: "off", label: "No voice" },
            ]}
            value={filters.voice}
            onChange={(voice) => set({ voice })}
          />
          <ChipGroup<When>
            label="Start time"
            options={[
              { value: "soon", label: "Within an hour" },
              { value: "later", label: "Later" },
            ]}
            value={filters.when}
            onChange={(when) => set({ when })}
          />
          <ChipGroup<"public" | "private">
            label="Lobby type"
            options={[
              { value: "public", label: "Public" },
              { value: "private", label: "Private" },
            ]}
            value={filters.visibility}
            onChange={(visibility) => set({ visibility })}
          />
          <Button title="Reset filters" variant="ghost" onPress={() => setFilters({ ...NO_FILTERS, gameIds: filters.gameIds })} />
        </View>
      ) : null}

      {error ? <Banner tone="bad">{error}</Banner> : null}
      {lobbies.map((lobby, i) => (
        <LobbyCard key={lobby.id} lobby={lobby} index={i} />
      ))}
      {loaded && !lobbies.length && !error ? <Muted center>{waiting ? "No open lobbies match." : "No open lobbies match. Why not create one?"}</Muted> : null}
      {nextCursor ? <Button title="Load more" variant="secondary" onPress={loadMore} /> : null}
    </Screen>
  );
}
