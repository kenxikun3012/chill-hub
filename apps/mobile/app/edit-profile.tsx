import { displayNameSchema } from "@chill-hub/shared";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Avatar } from "../src/components/profile";
import { Banner, Button, Chip, Field, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import type { CatalogueGame, InGameAccount, Profile } from "../src/lib/profile";
import { useSession } from "../src/lib/session";

const YEARS = [1, 2, 3, 4, 5, 6];

/** One game's in-game ID, rank (self-reported, PRO-03) and preferred roles. Saved on its own. */
function GameEditor({
  game,
  account,
  onSaved,
  onCancel,
}: {
  game: CatalogueGame;
  account?: InGameAccount;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [inGameName, setInGameName] = useState(account?.inGameName ?? "");
  const [rankId, setRankId] = useState<string | null>(account?.rank?.id ?? null);
  const [roleIds, setRoleIds] = useState<string[]>(account?.preferredRoles.map((r) => r.id) ?? []);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      await action();
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!inGameName.trim()) {
      setError(`Enter your ${game.inGameIdLabel}`);
      return;
    }
    const fields = { inGameName: inGameName.trim(), rankId, preferredRoleIds: roleIds };
    void run(() =>
      account
        ? api(`/me/in-game-accounts/${account.id}`, { method: "PATCH", body: fields })
        : api("/me/in-game-accounts", { method: "POST", body: { gameId: game.id, ...fields } }),
    );
  }

  return (
    <View className="gap-3 rounded-[10px] border border-line bg-white p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text accessibilityRole="header" className="flex-1 font-semibold text-ink">
          {game.name}
        </Text>
        {account ? (
          <Button
            title={confirmRemove ? "Tap again to remove" : "Remove"}
            variant="ghost"
            onPress={() => (confirmRemove ? void run(() => api(`/me/in-game-accounts/${account.id}`, { method: "DELETE" })) : setConfirmRemove(true))}
          />
        ) : onCancel ? (
          <Button title="Cancel" variant="ghost" onPress={onCancel} />
        ) : null}
      </View>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {saved ? <Banner tone="ok">Saved</Banner> : null}
      <Field label={game.inGameIdLabel} value={inGameName} onChangeText={setInGameName} autoCapitalize="none" autoCorrect={false} maxLength={64} />
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Rank</Text>
        <View className="flex-row flex-wrap gap-2">
          {game.ranks.map((rank) => (
            <Chip key={rank.id} label={rank.name} selected={rank.id === rankId} onPress={() => setRankId(rank.id === rankId ? null : rank.id)} />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">Preferred roles</Text>
        <View className="flex-row flex-wrap gap-2">
          {game.roles.map((role) => (
            <Chip
              key={role.id}
              label={role.name}
              selected={roleIds.includes(role.id)}
              onPress={() => setRoleIds((ids) => (ids.includes(role.id) ? ids.filter((id) => id !== role.id) : [...ids, role.id]))}
            />
          ))}
        </View>
      </View>
      <Button title={`Save ${game.name}`} variant="secondary" onPress={save} busy={busy} />
    </View>
  );
}

export default function EditProfile() {
  const { refresh } = useSession();
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<InGameAccount[]>([]);
  const [games, setGames] = useState<CatalogueGame[]>([]);
  const [addingGameId, setAddingGameId] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(() => {
    api<InGameAccount[]>("/me/in-game-accounts").then(setAccounts).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    api<Profile>("/me/profile")
      .then((p) => {
        setDisplayName(p.displayName);
        setBio(p.bio ?? "");
        setDepartment(p.department ?? "");
        setYear(p.year);
        setAccounts(p.inGameAccounts);
        setLoaded(true);
      })
      .catch((err) => setError(errorMessage(err)));
    api<CatalogueGame[]>("/games").then(setGames).catch((err) => setError(errorMessage(err)));
  }, []);

  async function save() {
    const parsed = displayNameSchema.safeParse(displayName);
    setError(undefined);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    setBusy(true);
    try {
      await api("/me/profile", {
        method: "PUT",
        body: { displayName: parsed.data, bio: bio.trim() || null, department: department.trim() || null, year },
      });
      await refresh(); // the home page shows the display name
      router.back();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const unusedGames = games.filter((g) => !accounts.some((a) => a.game.id === g.id));
  const addingGame = games.find((g) => g.id === addingGameId);

  return (
    <Screen title="Edit profile" back>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {loaded ? (
        <>
          <View className="flex-row items-center gap-3">
            <Avatar name={displayName || "?"} large />
            <View className="flex-1">
              <Muted>Profile photos are coming later.</Muted>
            </View>
          </View>
          <Field
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            error={nameError}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
          />
          <Field label="Bio" value={bio} onChangeText={setBio} maxLength={200} multiline hint="Up to 200 characters" />
          <Field label="Department (optional)" value={department} onChangeText={setDepartment} maxLength={80} />
          <View className="gap-2">
            <Text className="text-sm font-medium text-ink">Year (optional)</Text>
            <View className="flex-row flex-wrap gap-2">
              {YEARS.map((y) => (
                <Chip key={y} label={`${y}`} selected={year === y} onPress={() => setYear(year === y ? null : y)} />
              ))}
            </View>
          </View>
          <Button title="Save profile" onPress={save} busy={busy} />

          <Text accessibilityRole="header" className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Games
          </Text>
          {accounts.map((account) => {
            const game = games.find((g) => g.id === account.game.id);
            return game ? <GameEditor key={account.id} game={game} account={account} onSaved={loadAccounts} /> : null;
          })}
          {addingGame ? (
            <GameEditor
              key={addingGame.id}
              game={addingGame}
              onCancel={() => setAddingGameId(undefined)}
              onSaved={() => {
                setAddingGameId(undefined);
                loadAccounts();
              }}
            />
          ) : unusedGames.length ? (
            <View className="gap-2">
              <Muted>Add a game:</Muted>
              <View className="flex-row flex-wrap gap-2">
                {unusedGames.map((g) => (
                  <Chip key={g.id} label={g.name} onPress={() => setAddingGameId(g.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
