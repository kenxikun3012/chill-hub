import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Text } from "react-native";
import { LobbyCard } from "../../src/components/lobby";
import { Banner, Button, Heading, Muted, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import type { Lobby, Page } from "../../src/lib/lobby";
import { isStaffAccount, useSession } from "../../src/lib/session";

/** Home: the player's active lobbies come first, since that's the most urgent thing. */
export default function Home() {
  const { account, logOut } = useSession();
  const staff = isStaffAccount(account);
  const [lobbies, setLobbies] = useState<Lobby[]>();
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      if (staff) return;
      api<Page<Lobby>>("/lobbies?mine=true")
        .then((page) => {
          setLobbies(page.items);
          setError(undefined);
        })
        .catch((err) => setError(errorMessage(err)));
    }, [staff]),
  );

  return (
    <Screen title="Chill Hub" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      <Heading>Hi, {account?.profile?.displayName}</Heading>
      {account?.status === "suspended" ? (
        <Banner tone="bad">
          Your account is suspended{account.suspendedUntil ? ` until ${new Date(account.suspendedUntil).toLocaleString()}` : ""}. You can
          view content but not change anything.
        </Banner>
      ) : null}
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {staff ? <Muted>This is a staff account, so lobbies aren't available.</Muted> : (
      <Text accessibilityRole="header" className="text-sm font-semibold uppercase tracking-wide text-muted">
        My lobbies
      </Text>
      )}
      {lobbies?.map((lobby) => (
        <LobbyCard key={lobby.id} lobby={lobby} />
      ))}
      {lobbies && !lobbies.length ? (
        <>
          <Muted>You're not in any lobbies yet.</Muted>
          <Button title="Find a lobby" onPress={() => router.push("/lobbies")} />
          <Button title="Create a lobby" variant="secondary" onPress={() => router.push("/create")} />
        </>
      ) : null}
      {Platform.OS === "web" && account?.roles.includes("admin") ? (
        <Button title="Sign-up approvals" variant="secondary" onPress={() => router.push("/admin")} />
      ) : null}
    </Screen>
  );
}
