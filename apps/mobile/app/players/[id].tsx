import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ProfileDetails } from "../../src/components/profile";
import { Banner, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import type { Profile, Reputation } from "../../src/lib/profile";

/** Another player's public profile. "Report user" arrives with moderation. */
export default function PlayerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile>();
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<Profile>(`/profiles/${id}`).then(setProfile).catch((err) => setError(errorMessage(err)));
    api<Reputation>(`/users/${id}/reputation`).then(setReputation).catch(() => setReputation(null));
  }, [id]);

  return (
    <Screen title={profile?.displayName ?? "Player"} back>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {profile ? <ProfileDetails profile={profile} reputation={reputation} /> : null}
    </Screen>
  );
}
