import { passwordSchema } from "@chill-hub/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Banner, Button, CodeField, Muted, PasswordField, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";

export default function ResetPassword() {
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api("/auth/email-otp/reset-password", { method: "POST", body: { email, otp: code, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen title="Reset password">
        <Banner tone="ok">Your password is changed. Any other devices have been logged out.</Banner>
        <Button title="Log in" onPress={() => router.dismissTo("/log-in")} />
      </Screen>
    );
  }

  return (
    <Screen title="Reset password" back>
      <Muted>If an account exists for {email}, a code is on its way. It expires in 10 minutes.</Muted>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <CodeField value={code} onChangeText={setCode} />
      <PasswordField
        label="New password"
        value={password}
        onChangeText={setPassword}
        hint="At least 8 characters"
        autoComplete="new-password"
      />
      <Button title="Set new password" onPress={submit} busy={busy} disabled={code.length !== 6} />
    </Screen>
  );
}
