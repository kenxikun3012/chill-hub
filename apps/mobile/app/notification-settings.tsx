import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { Banner, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import { isStaffAccount, useSession } from "../src/lib/session";

type Channel = "push" | "email" | "inApp";

interface Preference {
  group: string;
  push: boolean;
  email: boolean;
  inApp: boolean;
  locked: boolean;
}

const GROUPS: Record<string, { title: string; text: string; lobbies?: boolean; channels?: Channel[] }> = {
  account: { title: "Account & security", text: "Approval and suspensions. Always on." },
  lobbies: { title: "Lobbies", text: "Join requests, accepted or declined, code changes, start reminders.", lobbies: true },
  lobby_chat: { title: "Lobby chat messages", text: "A push for every chat message. Off by default.", lobbies: true, channels: ["push"] },
  knowledge: { title: "Knowledge", text: "Answers to your questions, comments on your guides." },
  news: { title: "News", text: "Campus news and patch notes." },
};

const CHANNEL_LABELS: Record<Channel, string> = { push: "Push", email: "Email", inApp: "In-app" };
const ALL_CHANNELS: Channel[] = ["push", "email", "inApp"];

/** One switch per channel for each group (NOT-03). */
export default function NotificationSettings() {
  const { account } = useSession();
  const [preferences, setPreferences] = useState<Preference[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<Preference[]>("/me/notification-preferences").then(setPreferences).catch((err) => setError(errorMessage(err)));
  }, []);

  async function toggle(preference: Preference, channel: Channel, value: boolean) {
    const next = { ...preference, [channel]: value };
    const replace = (p: Preference) => setPreferences((list) => list?.map((item) => (item.group === p.group ? p : item)));
    replace(next);
    setError(undefined);
    try {
      await api(`/me/notification-preferences/${preference.group}`, {
        method: "PUT",
        body: { push: next.push, email: next.email, inApp: next.inApp },
      });
    } catch (err) {
      replace(preference);
      setError(errorMessage(err));
    }
  }

  const staff = isStaffAccount(account);
  return (
    <Screen title="Notification settings" back>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {preferences
        ?.filter((p) => GROUPS[p.group] && !(staff && GROUPS[p.group]!.lobbies))
        .map((p) => {
          const group = GROUPS[p.group]!;
          return (
            <View key={p.group} className="gap-2 rounded-[10px] border border-line bg-white p-3">
              <Text accessibilityRole="header" className="font-semibold text-ink">
                {group.title}
              </Text>
              <Muted>{group.text}</Muted>
              <View className="flex-row flex-wrap gap-4">
                {(group.channels ?? ALL_CHANNELS).map((channel) => (
                  <View key={channel} className="flex-row items-center gap-2">
                    <Switch
                      accessibilityLabel={`${group.title}: ${CHANNEL_LABELS[channel]}`}
                      value={p[channel]}
                      disabled={p.locked}
                      onValueChange={(value) => void toggle(p, channel, value)}
                      trackColor={{ true: "#4f46e5" }}
                    />
                    <Text className="text-sm text-ink">{CHANNEL_LABELS[channel]}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      <Muted>Push alerts need the mobile app, with notifications allowed on your phone.</Muted>
    </Screen>
  );
}
