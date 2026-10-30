import { emailSchema, passwordSchema } from "@chill-hub/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Field, Link, Muted, PasswordField, Screen, Steps } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ allowed_email_domains?: string[] }>("/settings/public")
      .then((s) => setDomains(s.allowed_email_domains ?? []))
      .catch(() => undefined); // only a hint; the server still checks
  }, []);

  async function submit() {
    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter your full name";
    if (!parsedEmail.success) next.email = "Enter a valid email address";
    if (!parsedPassword.success) next.password = parsedPassword.error.issues[0]?.message ?? "Enter a password";
    if (password !== confirm) next.confirm = "The passwords don't match";
    setErrors(next);
    setFormError(undefined);
    if (Object.keys(next).length || !parsedEmail.success) return;

    setBusy(true);
    try {
      await api("/auth/sign-up/email", {
        method: "POST",
        body: { name: name.trim(), email: parsedEmail.data, password },
      });
      router.push({ pathname: "/verify-email", params: { email: parsedEmail.data } });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Create account" back>
      <Steps current={1} label="Your account" />
      {formError ? <Banner tone="bad">{formError}</Banner> : null}
      <Field label="Full name" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
      <Field
        label="College email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        hint={`${domains.length ? `Must end in @${domains.join(" or @")}. ` : ""}We'll send a code to check it.`}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint="At least 8 characters"
        autoComplete="new-password"
      />
      <PasswordField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        autoComplete="new-password"
      />
      <Button title="Next" onPress={submit} busy={busy} />
      <Muted center>
        Already have an account? <Link onPress={() => router.replace("/log-in")}>Log in</Link>
      </Muted>
    </Screen>
  );
}
