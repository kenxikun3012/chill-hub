import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Heading, Muted, Screen } from "../src/components/ui";

export default function Welcome() {
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
