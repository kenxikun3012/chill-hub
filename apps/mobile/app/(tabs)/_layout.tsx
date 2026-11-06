import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { isStaffAccount, useSession } from "../../src/lib/session";
import { useColors } from "../../src/lib/theme";

/** Main navigation. Students waiting for approval only get Home and Lobbies, to look around. Knowledge joins when it's built. */
export default function TabsLayout() {
  const { account, stage } = useSession();
  const approved = stage === "approved";
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "fade",
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: "Barlow_600SemiBold", fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Protected guard={!isStaffAccount(account)}>
        <Tabs.Screen
          name="lobbies"
          options={{ title: "Lobbies", tabBarIcon: ({ color, size }) => <Ionicons name="game-controller-outline" color={color as string} size={size} /> }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={approved && !isStaffAccount(account)}>
        <Tabs.Screen
          name="create"
          options={{ title: "Create", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color as string} size={size} /> }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={approved}>
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
