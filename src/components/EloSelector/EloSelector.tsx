import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Chip, Label } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { useI18n } from '../../i18n';

export const ELO_MIN = 200;
export const ELO_MAX = 3400;
export const ELO_STEP = 50;
export const ELO_PRESETS = [400, 800, 1200, 1600, 2000, 2400, 2800, 3200];

interface EloSelectorProps {
  value: number;
  onChange: (elo: number) => void;
}

export function presetLabelFor(elo: number, presets: Record<number, string>): string {
  let best = ELO_PRESETS[0];
  for (const p of ELO_PRESETS) if (Math.abs(p - elo) < Math.abs(best - elo)) best = p;
  return presets[best];
}

export function EloSelector({ value, onChange }: EloSelectorProps) {
  const { t } = useI18n();
  const label = presetLabelFor(value, t.newGame.presets);
  const progress = (value - ELO_MIN) / (ELO_MAX - ELO_MIN);

  return (
    <View>
      <View style={styles.header}>
        <Label>{t.newGame.eloApprox}</Label>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColor(progress) }]}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={ELO_MIN}
        maximumValue={ELO_MAX}
        step={ELO_STEP}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accentDark}
      />

      <View style={styles.presets}>
        {ELO_PRESETS.map((p) => (
          <Chip key={p} label={String(p)} small selected={value === p} onPress={() => onChange(p)} />
        ))}
      </View>
    </View>
  );
}

function badgeColor(progress: number): string {
  if (progress < 0.25) return colors.primarySoft;
  if (progress < 0.55) return colors.goldSoft;
  return colors.accentSoft;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  value: {
    ...typography.display,
    fontSize: 44,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
