import React, { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { Button, Chip, Screen } from '../components/ui';
import { PIECE_SVGS } from '../components/ChessBoard/pieceSvgs';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { useI18n, type Language } from '../i18n';
import { useSettings } from '../hooks/useSettings';
import { gameRepository } from '../storage/gameRepository';
import type { SavedGame } from '../chess/types';
import type { RootScreenProps } from '../navigation/types';
import { fullMoveCount } from '../chess/game';
import { ABOUT } from '../config/about';

export function HomeScreen({ navigation }: RootScreenProps<'Home'>) {
  const { t, language, setLanguage } = useI18n();
  const { voiceFeedback, setVoiceFeedback } = useSettings();
  const [active, setActive] = useState<SavedGame | null>(null);
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      gameRepository.list().then((games) => {
        if (cancelled) return;
        setCount(games.length);
        setActive(games.find((g) => g.status === 'active') ?? null);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <View style={[styles.logoBlob, shadow.card]}>
              <SvgXml xml={PIECE_SVGS.wN} width="70%" height="70%" />
            </View>
            <View style={[styles.logoBadge, shadow.button]}>
              <Text style={styles.logoBadgeText}>🎙️</Text>
            </View>
          </View>
          <Text style={styles.title}>{t.common.appName}</Text>
          <Text style={styles.tagline}>{t.common.tagline}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={t.home.newGame}
            variant="accent"
            size="lg"
            onPress={() => navigation.navigate('NewGame')}
          />
          {active ? (
            <Button
              title={t.home.resume}
              subtitle={t.home.resumeSubtitle(active.opponentElo, fullMoveCount(active.moveHistory))}
              variant="primary"
              size="lg"
              onPress={() => navigation.navigate('Game', { gameId: active.id })}
            />
          ) : null}
          <Button
            title={t.home.history}
            subtitle={t.home.historySubtitle(count)}
            variant="secondary"
            size="lg"
            onPress={() => navigation.navigate('History')}
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{t.common.language}</Text>
            <View style={styles.langChips}>
              {(['it', 'en'] as Language[]).map((lang) => (
                <Chip
                  key={lang}
                  small
                  label={lang === 'it' ? 'Italiano' : 'English'}
                  selected={language === lang}
                  onPress={() => void setLanguage(lang)}
                />
              ))}
            </View>
          </View>
          <Pressable style={styles.settingRow} onPress={() => setVoiceFeedback(!voiceFeedback)}>
            <Text style={styles.settingLabel}>{t.common.voiceFeedback}</Text>
            <Switch
              value={voiceFeedback}
              onValueChange={setVoiceFeedback}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </Pressable>
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutText}>
            <Text onPress={() => Linking.openURL(ABOUT.STOCKFISH_URL)} style={styles.aboutLink}>
              {t.about.engine}
            </Text>
            {'  ·  '}
            {t.about.license}
            {'  ·  '}
            <Text onPress={() => Linking.openURL(ABOUT.SOURCE_CODE_URL)} style={styles.aboutLink}>
              {t.about.sourceCode}
            </Text>
          </Text>
          <Text onPress={() => Linking.openURL(ABOUT.PIECES_URL)} style={styles.aboutText}>
            {t.about.pieces}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  logoWrap: {
    width: 150,
    height: 150,
    marginBottom: spacing.lg,
  },
  logoBlob: {
    width: 150,
    height: 150,
    borderRadius: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  logoBadge: {
    position: 'absolute',
    right: -8,
    bottom: -4,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  logoBadgeText: {
    fontSize: 26,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
  footer: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  settingLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  langChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  about: {
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
  },
  aboutText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  aboutLink: {
    color: colors.primaryDark,
    textDecorationLine: 'underline',
  },
});
