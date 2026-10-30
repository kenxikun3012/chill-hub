import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, CodeField, Heading, Muted, Screen, Steps } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";
import { useSession } from "../src/lib/session";

const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const { startSession } = useSession();
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await api<{ token: string }>("/auth/email-otp/verify-email", { method: "POST", body: { email, otp: code } });
      await startSession(res.token); // moves on to the details screen
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function resend() {
    setError(undefined);
    setWait(RESEND_SECONDS);
    try {
      await api("/auth/email-otp/send-verification-otp", { method: "POST", body: { email, type: "email-verification" } });
      setNotice("We sent a new code. It replaces the old one.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen title="Verify email" back>
      <Steps current={2} label="Check your email" />
      <Heading>Check your email</Heading>
      <Muted>We sent a 6-digit code to {email}. It expires in 10 minutes.</Muted>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      <CodeField value={code} onChangeText={setCode} />
      <Button title="Verify" onPress={verify} busy={busy} disabled={code.length !== 6} />
      <Button title={wait > 0 ? `Resend code in ${wait}s` : "Resend code"} variant="ghost" onPress={resend} disabled={wait > 0} />
    </Screen>
  );
}
