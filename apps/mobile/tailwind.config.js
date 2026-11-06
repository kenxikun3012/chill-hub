/**
 * Arena theme. The colours are CSS variables (see global.css) so the same class names work in light and dark,
 * and both follow the phone's setting. The hex values for icons and other non-class props live in src/lib/theme.ts.
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class" stops NativeWind throwing on web when something changes <html>'s class. Dark still follows the phone: the colours switch in global.css with prefers-color-scheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: c("page"),
        card: c("card"),
        raised: c("raised"),
        line: c("line"),
        ink: c("ink"),
        muted: c("muted"),
        accent: c("accent"),
        "accent-text": c("accent-text"),
        "accent-soft": c("accent-soft"),
        "soft-text": c("soft-text"),
        "on-accent": c("on-accent"),
        ok: c("ok"),
        "ok-soft": c("ok-soft"),
        warn: c("warn"),
        bad: c("bad"),
        "bad-soft": c("bad-soft"),
        "bad-solid": c("bad-solid"),
      },
      borderRadius: { tag: "6px", panel: "10px" },
    },
  },
  plugins: [],
};
