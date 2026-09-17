import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Button, Card, Heading, IconButton, Label, Screen } from '../components/ui';
import { EloSelector } from '../components/EloSelector/EloSelector';
import { PIECE_SVGS } from '../components/ChessBoard/pieceSvgs';
import { colors, radius, spacing, typography } from '../theme';
import { useI18n } from '../i18n';
import type { RootScreenProps } from '../navigation/types';
import type { PlayerColor } from '../chess/types';
import Svg, { Path } from 'react-native-svg';

type ColorChoice = PlayerColor | 'random';

export function NewGameScreen({ navigation }: RootScreenProps<'NewGame'>) {
  const { t } = useI18n();
  const [color, setColor] = useState<ColorChoice>('white');
  const [elo, setElo] = useState(1200);

  const start = () => {
    const playerColor: PlayerColor = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    navigation.replace('Game', { newGame: { playerColor, opponentElo: elo } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t.common.back} onPress={() => navigation.goBack()}>
          <BackIcon />
        </IconButton>
        <Heading>{t.newGame.title}</Heading>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Label style={{ marginBottom: spacing.sm }}>{t.newGame.yourColor}</Label>
          <View style={styles.colorRow}>
            <ColorOption
              label={t.common.white}
              selected={color === 'white'}
              onPress={() => setColor('white')}
              piece={PIECE_SVGS.wK}
            />
            <ColorOption
              label={t.common.random}
              selected={color === 'random'}
              onPress={() => setColor('random')}
              piece={null}
            />
            <ColorOption
              label={t.common.black}
              selected={color === 'black'}
              onPress={() => setColor('black')}
              piece={PIECE_SVGS.bK}
            />
          </View>
        </Card>

        <Card>
          <Label style={{ marginBottom: spacing.sm }}>{t.newGame.opponentStrength}</Label>
          <EloSelector value={elo} onChange={setElo} />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t.newGame.start} variant="accent" size="lg" onPress={start} />
      </View>
    </Screen>
  );
}

function ColorOption({
  label,
  selected,
  onPress,
  piece,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  piece: string | null;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.colorOption,
        selected ? styles.colorOptionSelected : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={styles.colorIcon}>
        {piece ? (
          <SvgXml xml={piece} width="100%" height="100%" />
        ) : (
          <View style={styles.randomIcon}>
            <View style={[styles.randomHalf, { backgroundColor: colors.white, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }]} />
            <View style={[styles.randomHalf, { backgroundColor: colors.black, borderTopRightRadius: 20, borderBottomRightRadius: 20 }]} />
          </View>
        )}
      </View>
      <Text style={[styles.colorLabel, selected ? { color: colors.primaryDark } : null]}>{label}</Text>
    </Pressable>
  );
}

export function BackIcon({ color = colors.text }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colorOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  colorIcon: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
  },
  randomIcon: {
    flex: 1,
    flexDirection: 'row',
    margin: 4,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.text,
  },
  randomHalf: {
    flex: 1,
  },
  colorLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
  },
});
