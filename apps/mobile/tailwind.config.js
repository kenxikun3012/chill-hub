/** Colours come from the wireframes (wireframes/index.html). */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // The app is light-only. "class" also stops NativeWind throwing on web when something changes <html>'s class.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#1f1f1f",
        muted: "#6f6f6f",
        faint: "#9a9a9a",
        line: "#cfcfcf",
        fill: "#e9e9e9",
        page: "#fafafa",
        accent: "#4f46e5",
        "accent-soft": "#e8e7fd",
        ok: "#2f7d4f",
        "ok-soft": "#e4f3ea",
        bad: "#b42318",
        "bad-soft": "#fdecea",
      },
    },
  },
  plugins: [],
};
