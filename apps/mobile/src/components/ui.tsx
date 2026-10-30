import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
                <Text className="text-2xl text-ink">‹</Text>
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" className="flex-1 text-lg font-semibold text-ink">
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

export function Heading({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold text-ink">{children}</Text>;
}

export function Muted({ children, center }: { children: ReactNode; center?: boolean }) {
  return <Text className={`text-sm leading-5 text-muted ${center ? "text-center" : ""}`}>{children}</Text>;
}

export function Link({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} className="font-semibold text-accent">
      {children}
    </Text>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, ...input }: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9a9a9a"
        className={`min-h-[48px] rounded-[10px] border bg-white px-3 text-base text-ink ${error ? "border-bad" : "border-line"}`}
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
        <Text className="text-sm font-semibold text-accent">{visible ? "Hide" : "Show"}</Text>
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
  const styles = {
    primary: { box: "bg-accent", text: "text-white" },
    secondary: { box: "border border-line bg-white", text: "text-ink" },
    ghost: { box: "", text: "text-accent" },
  }[variant];
  const off = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      className={`min-h-[48px] items-center justify-center rounded-[10px] px-4 ${styles.box} ${off ? "opacity-50" : ""}`}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? "#ffffff" : "#4f46e5"} />
      ) : (
        <Text className={`text-base font-semibold ${styles.text}`}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`min-h-[40px] justify-center rounded-full border px-4 ${selected ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
    >
      <Text className={selected ? "font-semibold text-accent" : "text-ink"}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "ok" | "bad"; children: ReactNode }) {
  const styles = {
    info: { box: "bg-accent-soft", text: "text-ink" },
    ok: { box: "bg-ok-soft", text: "text-ok" },
    bad: { box: "bg-bad-soft", text: "text-bad" },
  }[tone];
  return (
    <View accessibilityRole={tone === "bad" ? "alert" : undefined} className={`rounded-[10px] p-3 ${styles.box}`}>
      <Text className={`text-sm leading-5 ${styles.text}`}>{children}</Text>
    </View>
  );
}

/** Progress through the three sign-up steps. */
export function Steps({ current, label }: { current: 1 | 2 | 3; label: string }) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-1">
        {[1, 2, 3].map((step) => (
          <View key={step} className={`h-1 flex-1 rounded-full ${step <= current ? "bg-accent" : "bg-fill"}`} />
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
