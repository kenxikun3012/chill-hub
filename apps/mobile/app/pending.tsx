import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Button, Heading, Muted, Screen } from "../src/components/ui";
import { useSession } from "../src/lib/session";

function TimelineRow({ mark, title, tone }: { mark: string; title: string; tone: "done" | "now" | "later" }) {
  const circle = { done: "bg-ok", now: "bg-accent", later: "bg-fill" }[tone];
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-7 w-7 items-center justify-center rounded-full ${circle}`}>
        <Text className="text-sm font-bold text-white">{mark}</Text>
      </View>
      <Text className={tone === "later" ? "text-muted" : "font-semibold text-ink"}>{title}</Text>
    </View>
  );
}

export default function Pending() {
  const { refresh, logOut } = useSession();
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  return (
    <Screen title="Chill Hub" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      <Heading>Almost there!</Heading>
      <Muted>An admin is checking your details. This usually takes less than a day.</Muted>
      <View className="gap-3 py-2">
        <TimelineRow mark="✓" title="Account created" tone="done" />
        <TimelineRow mark="✓" title="Email verified" tone="done" />
        <TimelineRow mark="…" title="Admin review" tone="now" />
        <TimelineRow mark="" title="Start playing" tone="later" />
      </View>
      <Banner>We'll email you when an admin has decided.</Banner>
      <Button title="Check again" variant="secondary" onPress={check} busy={checking} />
    </Screen>
  );
}
