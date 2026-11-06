import { useColorScheme } from "react-native";

/** The Arena palette as hex, for props that can't take a class name (icons, placeholders, switches). Keep in step with global.css. */
const palette = {
  light: { ink: "#12142a", muted: "#565c7d", accent: "#6d3fe0", accentText: "#6d3fe0", line: "#d9dcef", ok: "#0e7490", bad: "#c62828", card: "#ffffff", page: "#f3f4fa", onAccent: "#ffffff" },
  dark: { ink: "#eef0fb", muted: "#9aa1c2", accent: "#7c4ce8", accentText: "#a78bfa", line: "#2a2f4a", ok: "#22d3ee", bad: "#ff8a80", card: "#151829", page: "#0b0d17", onAccent: "#ffffff" },
};

export function useColors() {
  return useColorScheme() === "dark" ? palette.dark : palette.light;
}
