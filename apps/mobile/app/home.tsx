import { router } from "expo-router";
import { Platform } from "react-native";
import { Banner, Button, Heading, Muted, Screen } from "../src/components/ui";
import { useSession } from "../src/lib/session";

/** Placeholder until profiles and lobbies arrive in steps 3b and 3c. */
export default function Home() {
  const { account, logOut } = useSession();
  return (
    <Screen title="Chill Hub" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      <Heading>Hi, {account?.name}</Heading>
      {account?.status === "suspended" ? (
        <Banner tone="bad">
          Your account is suspended{account.suspendedUntil ? ` until ${new Date(account.suspendedUntil).toLocaleString()}` : ""}. You can
          view content but not change anything.
        </Banner>
      ) : (
        <Banner tone="ok">You're approved. Welcome to Chill Hub!</Banner>
      )}
      <Muted>Lobbies and profiles are coming next.</Muted>
      {Platform.OS === "web" && account?.roles.includes("admin") ? (
        <Button title="Sign-up approvals" variant="secondary" onPress={() => router.push("/admin")} />
      ) : null}
    </Screen>
  );
}
