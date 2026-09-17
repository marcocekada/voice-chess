import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, spacing, typography } from '../../theme';

/* ---------------------------------- Screen --------------------------------- */

export function Screen({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg' | 'sm';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  subtitle?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; fg: string; border?: string; shadow?: boolean }> = {
  primary: { bg: colors.primary, fg: colors.textOnDark, shadow: true },
  accent: { bg: colors.accent, fg: colors.textOnDark, shadow: true },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border, shadow: true },
  ghost: { bg: 'transparent', fg: colors.primaryDark },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function Button({
  title,
  subtitle,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  textStyle,
  haptic = true,
  onPress,
  disabled,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const padV = size === 'lg' ? 18 : size === 'sm' ? 8 : 14;
  const padH = size === 'lg' ? 24 : size === 'sm' ? 14 : 20;
  const fontSize = size === 'lg' ? 19 : size === 'sm' ? 14 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: v.bg,
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        v.shadow && !disabled ? shadow.button : null,
        style,
      ]}
      {...rest}
    >
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <View style={styles.buttonTextWrap}>
        <Text style={[styles.buttonText, { color: v.fg, fontSize }, textStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.buttonSubtitle, { color: v.fg }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'accent' | 'gold' | 'danger';
}) {
  const bg =
    tone === 'soft'
      ? colors.surfaceAlt
      : tone === 'accent'
        ? colors.accentSoft
        : tone === 'gold'
          ? colors.goldSoft
          : tone === 'danger'
            ? colors.dangerSoft
            : colors.surface;
  return <View style={[styles.card, { backgroundColor: bg }, shadow.card, style]}>{children}</View>;
}

/* ----------------------------------- Chip ---------------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  style,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        selected ? styles.chipSelected : null,
        pressed ? { opacity: 0.8 } : null,
        style,
      ]}
    >
      <Text style={[styles.chipText, small && { fontSize: 13 }, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------- Heading --------------------------------- */

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/* --------------------------------- IconButton ------------------------------- */

export function IconButton({
  children,
  onPress,
  style,
  accessibilityLabel,
  tone = 'default',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  tone?: 'default' | 'accent' | 'danger';
}) {
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'danger' ? colors.dangerSoft : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: bg, transform: [{ scale: pressed ? 0.94 : 1 }] },
        shadow.button,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    minHeight: 48,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonTextWrap: {
    alignItems: 'center',
  },
  buttonText: {
    ...typography.bodyBold,
    letterSpacing: 0.2,
  },
  buttonSubtitle: {
    ...typography.caption,
    opacity: 0.85,
    marginTop: 2,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    fontSize: 14,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.textOnDark,
  },
  heading: {
    ...typography.heading,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
