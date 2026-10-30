import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

/** Main navigation for approved players. Lobbies, Create and Knowledge join as they're built. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4f46e5", tabBarInactiveTintColor: "#6f6f6f" }}>
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
