import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewProps, type TextInputProps } from "react-native";
import { Text } from "./text";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { ZoomIn, FadeInDown, ReduceMotion } from "react-native-reanimated";
import { useRealtime } from "../lib/realtime";
import { useColors } from "../lib/theme";
import { Press, SlotBarSeat, ease } from "./motion";

/** A page: safe area, keyboard handling, scrolling, and a phone-width column on large web screens. */
export function Screen({
  title,
  back,
  right,
  wide,
  fixed,
  refreshControl,
  children,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  /** Desktop width, for the admin pages. */
  wide?: boolean;
  /** Fills the screen without scrolling, for pages that scroll a part of themselves (chat). */
  fixed?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
  children: ReactNode;
}) {
  const colors = useColors();
  const width = wide ? "max-w-[1100px]" : "max-w-[480px]";
  return (
    <SafeAreaView className="flex-1 bg-page">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {title || back ? (
          <View className={`mx-auto w-full ${width} flex-row items-center gap-2 px-4 py-3`}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                className="h-11 w-11 items-center justify-center rounded-lg"
              >
                <Ionicons name="chevron-back" size={24} color={colors.ink} />
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" className="flex-1 font-display text-xl uppercase tracking-wide text-ink">
              {title}
            </Text>
            {right}
          </View>
        ) : null}
        {fixed ? (
          <View className={`mx-auto w-full ${width} flex-1 gap-3 px-4 pb-3 pt-2`}>{children}</View>
        ) : (
          <ScrollView contentContainerClassName="grow" keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            <View className={`mx-auto w-full ${width} grow gap-4 px-4 pb-6 pt-2`}>{children}</View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Opens the inbox, showing the unread count (NOT-04). */
export function NotificationBell() {
  const { unread } = useRealtime();
  const colors = useColors();
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
      onPress={() => router.push("/notifications")}
      className="h-11 w-11 items-center justify-center"
    >
      <Ionicons name="notifications-outline" size={24} color={colors.ink} />
      {unread ? (
        <Animated.View key={unread} entering={ZoomIn.duration(260).easing(ease).reduceMotion(ReduceMotion.System)} style={{ position: "absolute", right: 2, top: 2 }}>
          <View className="h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1">
            <Text className="text-xs font-bold text-on-accent">{unread > 99 ? "99+" : unread}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Press>
  );
}

/** Seats taken in a lobby, as a row of small bars. */
export function SlotBar({ taken, total }: { taken: number; total: number }) {
  return (
    <View accessibilityRole="image" accessibilityLabel={`${taken} of ${total} slots taken`} className="flex-row gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <SlotBarSeat key={i} on={i < taken} index={i} />
      ))}
    </View>
  );
}

/** A small label such as a rank or a needed role. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-tag bg-raised px-2 py-0.5">
      <Text className="text-xs font-semibold text-muted">{children}</Text>
    </View>
  );
}

/** Extra details that are never required. Closed by default so the form stays short. */
export function Disclosure({ title, children, openByDefault = false }: { title: string; children: ReactNode; openByDefault?: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const colors = useColors();
  return (
    <View className="overflow-hidden rounded-[10px] border border-line bg-card">
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${title}, optional`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="min-h-[52px] flex-row items-center gap-2 px-4"
      >
        <Text className="flex-1 font-semibold text-ink">{title}</Text>
        <Tag>Optional</Tag>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
      </Press>
      {open ? (
        <Animated.View entering={FadeInDown.duration(260).easing(ease).reduceMotion(ReduceMotion.System)}>
          <View className="gap-4 border-t border-line p-4">{children}</View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" className="font-display text-2xl uppercase tracking-wide text-ink">{children}</Text>;
}

export function Muted({ children, center }: { children: ReactNode; center?: boolean }) {
  return <Text className={`text-sm leading-5 text-muted ${center ? "text-center" : ""}`}>{children}</Text>;
}

export function Link({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} className="font-semibold text-accent-text">
      {children}
    </Text>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, onFocus, onBlur, ...input }: FieldProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        cursorColor={colors.accentText}
        selectionColor={colors.accent}
        className={`min-h-[48px] rounded-[10px] border bg-card px-3 text-base text-ink ${error ? "border-bad border-2" : focused ? "border-accent" : "border-line"}`}
        style={{ fontFamily: "Barlow_400Regular" }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...input}
      />
      {error ? <Text className="text-sm text-bad">{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export function PasswordField(props: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Field {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        onPress={() => setVisible(!visible)}
        className="absolute right-1 top-6 h-12 justify-center px-3"
      >
        <Text className="text-sm font-semibold text-accent-text">{visible ? "Hide" : "Show"}</Text>
      </Pressable>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = {
    primary: { box: "bg-accent", text: "text-on-accent" },
    secondary: { box: "border border-line bg-card", text: "text-ink" },
    ghost: { box: "", text: "text-accent-text" },
  }[variant];
  const off = busy || disabled;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      className={`min-h-[48px] items-center justify-center rounded-[10px] px-4 ${styles.box} ${off ? "opacity-50" : ""}`}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.onAccent : colors.accentText} />
      ) : (
        <Text className={`text-base font-semibold ${styles.text}`}>{title}</Text>
      )}
    </Press>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`min-h-[44px] justify-center rounded-[10px] border px-4 ${selected ? "border-accent bg-accent" : "border-line bg-card"}`}
    >
      <Text className={selected ? "font-semibold text-on-accent" : "font-medium text-ink"}>{label}</Text>
    </Press>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "ok" | "bad"; children: ReactNode }) {
  const styles = {
    info: { box: "bg-accent-soft", text: "text-soft-text" },
    ok: { box: "bg-ok-soft", text: "text-ok" },
    bad: { box: "bg-bad-soft", text: "text-bad" },
  }[tone];
  return (
    <Animated.View entering={FadeInDown.duration(300).easing(ease).reduceMotion(ReduceMotion.System)}>
      <View accessibilityRole={tone === "bad" ? "alert" : undefined} className={`rounded-[10px] p-3 ${styles.box}`}>
        <Text className={`text-sm leading-5 ${styles.text}`}>{children}</Text>
      </View>
    </Animated.View>
  );
}

/** Progress through the three sign-up steps. */
export function Steps({ current, label }: { current: 1 | 2 | 3; label: string }) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-1">
        {[1, 2, 3].map((step) => (
          <View key={step} className={`h-1 flex-1 rounded-full ${step <= current ? "bg-accent" : "bg-raised"}`} />
        ))}
      </View>
      <Muted>
        Step {current} of 3 · {label}
      </Muted>
    </View>
  );
}

/** One box for the 6-digit code, so pasting and phone autofill just work. */
export function CodeField({ value, onChangeText, error }: { value: string; onChangeText: (code: string) => void; error?: string }) {
  return (
    <Field
      label="6-digit code"
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 6))}
      error={error}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
    />
  );
}
