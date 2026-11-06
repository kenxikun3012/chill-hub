import "../global.css";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { useFonts } from "expo-font";
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from "@expo-google-fonts/barlow";
import { ChakraPetch_600SemiBold } from "@expo-google-fonts/chakra-petch";
import { useColors } from "../src/lib/theme";
import { listenForPush, registerForPush } from "../src/lib/push";
import { RealtimeProvider } from "../src/lib/realtime";
import { isStaffAccount, SessionProvider, useSession } from "../src/lib/session";

/** Each account stage only reaches its own screens (ACC-06); moving between stages redirects automatically. */
function Routes() {
  const { stage, account } = useSession();
  const colors = useColors();
  const approved = stage === "approved";
  const looking = approved || stage === "pending"; // a student waiting for approval can look around (ACC-06)

  useEffect(() => listenForPush(), []);
  useEffect(() => {
    if (approved) void registerForPush().catch(() => undefined); // the app works without push
  }, [approved]);

  // The admin panel is a website only. The API checks the role on every request too.
  const isAdmin = Platform.OS === "web" && stage === "approved" && !!account?.roles.includes("admin");
  if (stage === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-page">
        <ActivityIndicator color={colors.accentText} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={stage === "guest"}>
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
      <Stack.Protected guard={stage === "setup"}>
        <Stack.Screen name="setup-profile" />
      </Stack.Protected>
      <Stack.Protected guard={looking}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="players/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={approved}>
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
      </Stack.Protected>
      <Stack.Protected guard={looking && !isStaffAccount(account)}>
        <Stack.Screen name="lobby/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={approved && !isStaffAccount(account)}>
        <Stack.Screen name="edit-lobby" />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady] = useFonts({ Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold, ChakraPetch_600SemiBold });
  if (!fontsReady) return null;
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <RealtimeProvider>
        <Routes />
      </RealtimeProvider>
    </SessionProvider>
  );
}
