import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "./text";
import { useLiveReload } from "../lib/realtime";
import { useSession } from "../lib/session";
import { useColors } from "../lib/theme";
import { Banner, Button, Heading, Muted } from "./ui";

function TimelineRow({ title, tone }: { title: string; tone: "done" | "now" | "later" }) {
  const colors = useColors();
  const circle = { done: "bg-ok-soft", now: "bg-accent", later: "bg-raised" }[tone];
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-7 w-7 items-center justify-center rounded-full ${circle}`}>
        {tone === "done" ? <Ionicons name="checkmark" size={18} color={colors.ok} /> : tone === "now" ? <Ionicons name="time-outline" size={16} color={colors.onAccent} /> : null}
      </View>
      <Text className={tone === "later" ? "text-muted" : "font-semibold text-ink"}>{title}</Text>
    </View>
  );
}

/**
 * Shown on Home while an admin checks a new account. Until then the app is read-only (ACC-06).
 * The decision arrives as a notification, so the screen checks again by itself when one does.
 */
export function WaitingCard() {
  const { refresh } = useSession();
  const [checking, setChecking] = useState(false);
  useLiveReload(["notifications:changed"], () => void refresh());

  async function check() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  return (
    <View className="gap-3">
      <Heading>Almost there!</Heading>
      <Muted>
        An admin is checking your details. This usually takes less than a day. Meanwhile you can look at the lobbies, but you can't join or
        create one yet.
      </Muted>
      <View className="gap-3 py-2">
        <TimelineRow title="Account created" tone="done" />
        <TimelineRow title="Email verified" tone="done" />
        <TimelineRow title="Admin review" tone="now" />
        <TimelineRow title="Start playing" tone="later" />
      </View>
      <Banner>We'll email you when an admin has decided.</Banner>
      <Button title="Check again" variant="secondary" onPress={check} busy={checking} />
    </View>
  );
}
