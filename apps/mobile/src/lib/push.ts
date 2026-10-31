import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform } from "react-native";
import { api } from "./api";

type Notifications = typeof import("expo-notifications");

let registeredToken: string | null = null;

/**
 * Push needs a development or store build. Expo Go on Android no longer supports it and reports an error
 * if the module is even loaded, so it's only loaded where it can work.
 */
function loadNotifications(): Notifications | null {
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as Notifications;
}

/** Asks for permission and registers this device. Does nothing, quietly, where push isn't available. */
export async function registerForPush() {
  const Notifications = loadNotifications();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!Notifications || !projectId) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Chill Hub", importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return;

  const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api("/me/push-tokens", { method: "POST", body: { expoToken, platform: Platform.OS } });
  registeredToken = expoToken;
}

/** So a logged-out phone stops receiving this user's alerts. */
export async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api(`/me/push-tokens/${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => undefined);
}

/** Shows alerts while the app is open, and opens the lobby when one is tapped. Returns a clean-up function. */
export function listenForPush() {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const lobbyId = response.notification.request.content.data?.lobbyId;
    router.push(typeof lobbyId === "string" ? `/lobby/${lobbyId}` : "/notifications");
  });
  return () => subscription.remove();
}
