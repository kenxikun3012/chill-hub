import { emailSchema } from "@chill-hub/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Banner, Button, Field, Muted, Screen } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api("/auth/email-otp/request-password-reset", { method: "POST", body: { email: parsed.data } });
      router.replace({ pathname: "/reset-password", params: { email: parsed.data } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen title="Reset password" back>
      <Muted>Enter your college email and we'll send you a 6-digit code to set a new password.</Muted>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <Field
        label="College email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Button title="Send code" onPress={submit} busy={busy} />
    </Screen>
  );
}
