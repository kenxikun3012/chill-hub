import { Text, View } from "react-native";
import type { Profile, Reputation } from "../lib/profile";
import { Muted } from "./ui";

const AVATAR_COLOURS = ["bg-accent", "bg-ok", "bg-bad", "bg-ink", "bg-muted"];

/** Initials in a coloured circle. Photo uploads arrive with file storage in a later increment. */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const colour = AVATAR_COLOURS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLOURS.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      className={`items-center justify-center rounded-full ${colour} ${large ? "h-20 w-20" : "h-10 w-10"}`}
    >
      <Text className={`font-bold uppercase text-white ${large ? "text-2xl" : "text-sm"}`}>{name.slice(0, 2)}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-[10px] border border-line bg-white p-3">
      <Text className="text-xl font-bold text-ink">{value}</Text>
      <Text className="text-center text-xs text-muted">{label}</Text>
    </View>
  );
}

/** The parts of a profile everyone can see (PRO-01, PRO-02). Never includes email or student ID (PRO-04). */
export function ProfileDetails({ profile, reputation }: { profile: Profile; reputation: Reputation | null }) {
  const study = [profile.department, profile.year ? `Year ${profile.year}` : null].filter(Boolean).join(", ");
  return (
    <>
      <View className="flex-row items-center gap-4">
        <Avatar name={profile.displayName} large />
        <View className="flex-1 gap-0.5">
          <Text className="text-xl font-bold text-ink">{profile.displayName}</Text>
          {study ? <Muted>{study}</Muted> : null}
          {profile.bio ? <Text className="text-sm text-ink">{profile.bio}</Text> : null}
        </View>
      </View>

      <Section title="Games">
        {profile.inGameAccounts.length ? (
          profile.inGameAccounts.map((account) => (
            <View key={account.id} className="gap-2 rounded-[10px] border border-line bg-white p-3">
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{account.game.name}</Text>
                  <Muted>{account.inGameName}</Muted>
                </View>
                {account.rank ? (
                  <View className="rounded-full bg-accent-soft px-3 py-1">
                    <Text className="text-sm font-semibold text-accent">{account.rank.name}</Text>
                  </View>
                ) : null}
              </View>
              {account.preferredRoles.length ? (
                <View className="flex-row flex-wrap gap-1">
                  {account.preferredRoles.map((role) => (
                    <View key={role.id} className="rounded-full bg-fill px-3 py-1">
                      <Text className="text-sm text-ink">{role.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Muted>No games added yet.</Muted>
        )}
      </Section>

      {reputation ? (
        <Section title="Reputation">
          <View className="flex-row gap-2">
            <Stat value={`👍 ${reputation.good}`} label="Good teammate" />
            <Stat value={`${reputation.noShowRate}%`} label="No-show rate" />
            <Stat value={`${reputation.lobbiesPlayed}`} label="Lobbies played" />
          </View>
        </Section>
      ) : null}
    </>
  );
}
