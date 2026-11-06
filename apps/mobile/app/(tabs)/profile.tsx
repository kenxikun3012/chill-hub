import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ProfileDetails } from "../../src/components/profile";
import { Banner, Button, Screen } from "../../src/components/ui";
import { api, errorMessage } from "../../src/lib/api";
import type { Profile, Reputation } from "../../src/lib/profile";
import { useSession } from "../../src/lib/session";

export default function MyProfile() {
  const { account, logOut } = useSession();
  const [profile, setProfile] = useState<Profile>();
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [error, setError] = useState<string>();

  // Reload on every visit, so edits show straight away.
  useFocusEffect(
    useCallback(() => {
      if (!account) return;
      api<Profile>("/me/profile")
        .then((p) => {
          setProfile(p);
          setError(undefined);
        })
        .catch((err) => setError(errorMessage(err)));
      api<Reputation>(`/users/${account.id}/reputation`)
        .then(setReputation)
        .catch(() => setReputation(null)); // the rest of the page still works
    }, [account]),
  );

  return (
    <Screen title="Profile" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {profile ? (
        <>
          <ProfileDetails profile={profile} reputation={reputation} />
          <Button title="Edit profile" variant="secondary" onPress={() => router.push("/edit-profile")} />
        </>
      ) : null}
    </Screen>
  );
}
