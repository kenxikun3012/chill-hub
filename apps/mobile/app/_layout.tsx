import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { SessionProvider, useSession } from "../src/lib/session";

/** Each account stage only reaches its own screens (ACC-06); moving between stages redirects automatically. */
function Routes() {
  const { stage, account } = useSession();
  // The admin panel is a website only. The API checks the role on every request too.
  const isAdmin = Platform.OS === "web" && stage === "approved" && !!account?.roles.includes("admin");
  if (stage === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-page">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={stage === "guest"}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="log-in" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={stage === "rejected"}>
        <Stack.Screen name="rejected" />
      </Stack.Protected>
      <Stack.Protected guard={stage === "details" || stage === "rejected"}>
        <Stack.Screen name="sign-up-details" />
      </Stack.Protected>
      <Stack.Protected guard={stage === "pending"}>
        <Stack.Screen name="pending" />
      </Stack.Protected>
      <Stack.Protected guard={stage === "approved"}>
        <Stack.Screen name="home" />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Routes />
    </SessionProvider>
  );
}
