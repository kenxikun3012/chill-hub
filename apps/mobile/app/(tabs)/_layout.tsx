import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { isStaffAccount, useSession } from "../../src/lib/session";

/** Main navigation for approved players. Knowledge joins when it's built. */
export default function TabsLayout() {
  const { account } = useSession();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4f46e5", tabBarInactiveTintColor: "#6f6f6f" }}>
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Protected guard={!isStaffAccount(account)}>
      <Tabs.Screen
        name="lobbies"
        options={{ title: "Lobbies", tabBarIcon: ({ color, size }) => <Ionicons name="game-controller-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: "Create", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color as string} size={size} /> }}
      />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
