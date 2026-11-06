import { Text as RNText, type TextProps } from "react-native";

/**
 * Text in the app's fonts: Barlow for reading, Chakra Petch for headings (add the `font-display` class).
 * One font file per weight, so the weight classes pick the file instead of setting fontWeight.
 */
export function Text({ className = "", style, ...props }: TextProps & { className?: string }) {
  const display = className.includes("font-display");
  const family = display
    ? "ChakraPetch_600SemiBold"
    : /\bfont-(bold|extrabold)\b/.test(className)
      ? "Barlow_700Bold"
      : /\bfont-semibold\b/.test(className)
        ? "Barlow_600SemiBold"
        : /\bfont-medium\b/.test(className)
          ? "Barlow_500Medium"
          : className.includes("font-mono")
            ? undefined
            : "Barlow_400Regular";
  return <RNText {...props} className={className} style={[family ? { fontFamily: family, fontWeight: "normal" } : null, style]} />;
}
