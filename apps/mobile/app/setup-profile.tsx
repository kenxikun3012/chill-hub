import { displayNameSchema } from "@chill-hub/shared";
import { useState } from "react";
import { Banner, Button, Field, Heading, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import { useSession } from "../src/lib/session";

/** First login after approval: everyone needs a display name before using the app. */
export default function SetupProfile() {
  const { refresh, logOut } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = displayNameSchema.safeParse(name);
    setFormError(undefined);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await api("/me/profile", { method: "PUT", body: { displayName: parsed.data } });
      await refresh(); // moves on to the app
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen title="Chill Hub" right={<Button title="Log out" variant="ghost" onPress={logOut} />}>
      <Heading>You're in! Pick a display name</Heading>
      <Muted>This is what other players see. Your real name, email and student ID stay private.</Muted>
      {formError ? <Banner tone="bad">{formError}</Banner> : null}
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        error={error}
        hint="3–24 characters: letters, numbers, _ . -"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
      />
      <Button title="Continue" onPress={submit} busy={busy} />
    </Screen>
  );
}
