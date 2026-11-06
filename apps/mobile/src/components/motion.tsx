import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Text } from "./text";

/** Confident arrival: fast start, long soft landing. Same curve as the website mockups. */
export const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Entrance for an item in a list. The stagger is capped, so a long list never makes anyone wait. */
export function rise(index = 0) {
  return FadeInDown.duration(420)
    .delay(Math.min(index, 5) * 50)
    .easing(ease)
    .reduceMotion(ReduceMotion.System);
}

/** A Pressable that dips to 97% while held. Feedback stays even with Reduce Motion, since it confirms the tap. */
export function Press({ children, onPressIn, onPressOut, ...rest }: PressableProps & { className?: string }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Pressable
        {...rest}
        onPressIn={(e) => {
          scale.value = withTiming(0.97, { duration: 90 });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withTiming(1, { duration: 160, easing: ease });
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** One seat in a lobby. Taken and open seats both slide in from the left, one after another. */
export function SlotBarSeat({ on, index }: { on: boolean; index: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(180 + index * 60, withTiming(1, { duration: 340, easing: ease }));
  }, [index, p, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.15, 1]),
    transform: [{ scaleX: interpolate(p.value, [0, 1], [0.15, 1]) }],
  }));
  return (
    <Animated.View style={[{ width: 14, height: 6, transformOrigin: "left center" }, style]}>
      <View className={`flex-1 rounded-sm ${on ? "bg-accent" : "bg-line"}`} />
    </Animated.View>
  );
}

/** A small pulse for lobbies that are starting or running. Stops with Reduce Motion. */
export function LiveDot() {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(p);
  }, [p, reduce]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + 1.6 * p.value }] }));
  return (
    <View accessibilityLabel="Live" className="h-2 w-2 items-center justify-center">
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        <View className="flex-1 rounded-full bg-ok" />
      </Animated.View>
      <View className="h-2 w-2 rounded-full bg-ok" />
    </View>
  );
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** The lobby code resolving left to right. A screen reader always gets the real code. */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text : text.replace(/[^- ]/g, "•"));
  useEffect(() => {
    if (reduce) {
      setShown(text);
      return;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      const locked = Math.floor(frame / 2);
      if (locked >= text.length) {
        clearInterval(id);
        setShown(text);
        return;
      }
      setShown(
        [...text].map((ch, i) => (i < locked || ch === "-" || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(""),
      );
    }, 40);
    return () => clearInterval(id);
  }, [text, reduce]);
  return (
    <Text selectable accessibilityLabel={text} className={className}>
      {shown}
    </Text>
  );
}

/**
 * A panel with two cut corners (top right, bottom left), the Arena signature. A light bar sweeps across it once when it first appears.
 * The bar stays inside the cut corners, so it never draws outside the shape.
 */
export function ChamferPanel({ fill, cut = 14, sweep, children }: { fill: string; cut?: number; sweep?: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const p = useSharedValue(0);
  useEffect(() => {
    if (sweep && !reduce) p.value = withDelay(450, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }));
  }, [sweep, reduce, p]);
  const barW = 56;
  const bar = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 0.85, 1], [0, 0.28, 0.28, 0]),
    transform: [{ translateX: interpolate(p.value, [0, 1], [cut, Math.max(cut, size.w - cut - barW)]) }],
  }));
  const { w, h } = size;
  return (
    <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={`M0 0 H${w - cut} L${w} ${cut} V${h} H${cut} L0 ${h - cut} Z`} fill={fill} />
        </Svg>
      ) : null}
      {children}
      {sweep && w > 0 ? <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, width: barW, backgroundColor: "#ffffff" }, bar]} /> : null}
    </View>
  );
}
