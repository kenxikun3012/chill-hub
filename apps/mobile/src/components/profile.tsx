import { View } from "react-native";
import { Text } from "./text";
import type { Profile, Reputation } from "../lib/profile";
import { Muted } from "./ui";

/** Initials in a coloured circle. Photo uploads arrive with file storage in a later increment. */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      className={`items-center justify-center rounded-full border border-line bg-accent-soft ${large ? "h-20 w-20" : "h-10 w-10"}`}
    >
      <Text className={`font-display uppercase text-soft-text ${large ? "text-2xl" : "text-sm"}`}>{name.slice(0, 2)}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="font-display text-xs uppercase tracking-widest text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-[10px] border border-line bg-card p-3">
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
            <View key={account.id} className="gap-2 rounded-[10px] border border-line bg-card p-3">
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{account.game.name}</Text>
                  <Muted>{account.inGameName}</Muted>
                </View>
                {account.rank ? (
                  <View className="rounded-full bg-accent-soft px-3 py-1">
                    <Text className="text-sm font-semibold text-accent-text">{account.rank.name}</Text>
                  </View>
                ) : null}
              </View>
              {account.preferredRoles.length ? (
                <View className="flex-row flex-wrap gap-1">
                  {account.preferredRoles.map((role) => (
                    <View key={role.id} className="rounded-full bg-raised px-3 py-1">
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
            <Stat value={`${reputation.good}`} label="Thumbs-up" />
            <Stat value={`${reputation.noShowRate}%`} label="No-show rate" />
            <Stat value={`${reputation.lobbiesPlayed}`} label="Lobbies played" />
          </View>
        </Section>
      ) : null}
    </>
  );
}
