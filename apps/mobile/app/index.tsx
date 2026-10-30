import { Redirect, router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, Heading, Muted, Screen } from "../src/components/ui";
import { useSession, type Stage } from "../src/lib/session";

const STAGE_SCREENS: Record<Exclude<Stage, "loading" | "guest">, Href> = {
  details: "/sign-up-details",
  pending: "/pending",
  rejected: "/rejected",
  setup: "/setup-profile",
  approved: "/home",
};

/** The entry point: the welcome page for guests. Anyone else goes to the screen for their account stage. */
export default function Index() {
  const { stage } = useSession();
  if (stage === "loading") return null;
  if (stage !== "guest") return <Redirect href={STAGE_SCREENS[stage]} />;
  return (
    <Screen>
      <View className="grow items-center justify-center gap-3">
        <View className="h-24 w-24 items-center justify-center rounded-3xl bg-accent">
          <Text className="text-3xl font-bold text-white">CH</Text>
        </View>
        <Heading>Chill Hub</Heading>
        <Muted center>Find teammates. Share game knowledge. Play together on campus.</Muted>
      </View>
      <Button title="Create account" onPress={() => router.push("/sign-up")} />
      <Button title="Log in" variant="secondary" onPress={() => router.push("/log-in")} />
      <Muted center>Only for students of our college. Every account is checked by an admin.</Muted>
    </Screen>
  );
}
