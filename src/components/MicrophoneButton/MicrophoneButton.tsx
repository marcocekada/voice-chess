import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, shadow } from '../../theme';

interface MicrophoneButtonProps {
  listening: boolean;
  disabled?: boolean;
  onPress: () => void;
  size?: number;
}

export function MicrophoneButton({ listening, disabled, onPress, size = 88 }: MicrophoneButtonProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse2.stopAnimation();
      pulse.setValue(0);
      pulse2.setValue(0);
      return;
    }
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a = make(pulse, 0);
    const b = make(pulse2, 700);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [listening, pulse, pulse2]);

  const ring = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.accent,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });

  const bg = listening ? colors.accentDark : colors.accent;
  const iconSize = size * 0.42;

  return (
    <View style={{ width: size * 2, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? (
        <>
          <Animated.View style={ring(pulse)} />
          <Animated.View style={ring(pulse2)} />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="microphone"
        accessibilityState={{ disabled: !!disabled, selected: listening }}
        disabled={disabled}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onPress();
        }}
        style={({ pressed }) => [
          styles.button,
          shadow.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            opacity: disabled ? 0.45 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
          {listening ? (
            <Rect x="6" y="6" width="12" height="12" rx="3" fill={colors.textOnDark} />
          ) : (
            <>
              <Rect x="9" y="2.5" width="6" height="12" rx="3" fill={colors.textOnDark} />
              <Path
                d="M5.5 11.5a6.5 6.5 0 0 0 13 0"
                stroke={colors.textOnDark}
                strokeWidth={2.2}
                strokeLinecap="round"
                fill="none"
              />
              <Path d="M12 18v3.5M8.5 21.5h7" stroke={colors.textOnDark} strokeWidth={2.2} strokeLinecap="round" />
            </>
          )}
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
  },
});
