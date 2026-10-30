import { emailSchema } from "@chill-hub/shared";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Field, Heading, Link, Muted, PasswordField, Screen } from "../src/components/ui";
import { api, ApiError, errorMessage } from "../src/lib/api";
import { useSession } from "../src/lib/session";

export default function LogIn() {
  const { startSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || !password) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ token: string }>("/auth/sign-in/email", {
        method: "POST",
        body: { email: parsed.data, password },
      });
      await startSession(res.token);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        // The API has just emailed a new code.
        router.push({ pathname: "/verify-email", params: { email: parsed.data } });
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return (
    <Screen title="Log in" back>
      <Heading>Welcome back</Heading>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <Field
        label="College email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <PasswordField label="Password" value={password} onChangeText={setPassword} autoComplete="current-password" />
      <View className="items-end">
        <Muted>
          <Link onPress={() => router.push("/forgot-password")}>Forgot password?</Link>
        </Muted>
      </View>
      <Button title="Log in" onPress={submit} busy={busy} />
      <Muted center>
        New here? <Link onPress={() => router.replace("/sign-up")}>Create account</Link>
      </Muted>
    </Screen>
  );
}
