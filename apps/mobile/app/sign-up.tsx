import { emailSchema, passwordSchema, studentIdNumberSchema } from "@chill-hub/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Field, Link, Muted, PasswordField, Screen, Steps } from "../src/components/ui";
import { api, errorMessage } from "../src/lib/api";

interface PublicSettings {
  allowed_email_domains?: string[];
  signup_join_code_required?: boolean;
}

/** Sign-up step 1: student ID number first, then the club's join code (if one is set), name, email and password. */
export default function SignUp() {
  const [studentId, setStudentId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [codeRequired, setCodeRequired] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<PublicSettings>("/settings/public")
      .then((s) => {
        setDomains(s.allowed_email_domains ?? []);
        setCodeRequired(!!s.signup_join_code_required);
      })
      .catch(() => undefined); // only hints; the server still checks
  }, []);

  async function submit() {
    const parsedId = studentIdNumberSchema.safeParse(studentId);
    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);
    const next: Record<string, string> = {};
    if (!parsedId.success) next.studentId = "Enter it like 22/29484";
    if (codeRequired && !joinCode.trim()) next.joinCode = "Enter the club's join code";
    if (!name.trim()) next.name = "Enter your full name";
    if (!parsedEmail.success) next.email = "Enter a valid email address";
    if (!parsedPassword.success) next.password = parsedPassword.error.issues[0]?.message ?? "Enter a password";
    if (password !== confirm) next.confirm = "The passwords don't match";
    setErrors(next);
    setFormError(undefined);
    if (Object.keys(next).length || !parsedId.success || !parsedEmail.success) return;

    setBusy(true);
    try {
      await api("/auth/sign-up/email", {
        method: "POST",
        body: {
          name: name.trim(),
          email: parsedEmail.data,
          password,
          studentIdNumber: parsedId.data,
          ...(joinCode.trim() ? { joinCode: joinCode.trim() } : {}),
        },
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
      <Field
        label="Student ID number"
        value={studentId}
        onChangeText={setStudentId}
        error={errors.studentId}
        hint="Like 22/29484. Only admins can see it."
        autoCapitalize="none"
        autoCorrect={false}
      />
      {codeRequired ? (
        <Field
          label="Club join code"
          value={joinCode}
          onChangeText={setJoinCode}
          error={errors.joinCode}
          hint="Ask the esports club for it."
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      <Field label="Full name" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
      <Field
        label="Email"
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
