import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Button, Card, Heading, IconButton, Screen } from '../components/ui';
import { BackIcon } from './NewGameScreen';
import { colors, radius, spacing, typography } from '../theme';
import { useI18n } from '../i18n';
import { gameRepository } from '../storage/gameRepository';
import type { SavedGame } from '../chess/types';
import type { RootScreenProps } from '../navigation/types';
import { buildPgn, fullMoveCount, playerWon, restoreChess } from '../chess/game';
import * as Clipboard from 'expo-clipboard';

export function HistoryScreen({ navigation }: RootScreenProps<'History'>) {
  const { t, locale } = useI18n();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPgn = async (game: SavedGame) => {
    try {
      const { chess } = restoreChess(game);
      await Clipboard.setStringAsync(buildPgn(game, chess, t));
      setCopiedId(game.id);
      setTimeout(() => setCopiedId((id) => (id === game.id ? null : id)), 1800);
    } catch {
      // ignore
    }
  };

  const reload = useCallback(() => {
    gameRepository.list().then(setGames);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const remove = (game: SavedGame) => {
    Alert.alert(t.common.delete, t.history.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => gameRepository.remove(game.id).then(reload),
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton accessibilityLabel={t.common.back} onPress={() => navigation.goBack()}>
          <BackIcon />
        </IconButton>
        <Heading>{t.history.title}</Heading>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>♟️</Text>
            <Text style={styles.emptyText}>{t.history.empty}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = item.status === 'active';
          const won = playerWon(item);
          const date = new Date(item.updatedAt).toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          const tone = isActive ? 'gold' : won === true ? 'default' : won === false ? 'soft' : 'default';
          return (
            <Card tone={tone} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {date} — {t.history.vs(item.opponentElo)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.playerColor === 'white' ? t.common.white : t.common.black} · {fullMoveCount(item.moveHistory)}{' '}
                    {t.common.moves}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? colors.gold
                        : won === true
                          ? colors.primary
                          : won === false
                            ? colors.accent
                            : colors.textMuted,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {isActive ? t.history.inProgress : item.result ?? t.status[item.status]}
                  </Text>
                </View>
              </View>
              {!isActive ? <Text style={styles.cardStatus}>{t.status[item.status]}</Text> : null}
              <View style={styles.cardActions}>
                <Button
                  title={isActive ? t.history.resume : t.history.view}
                  variant={isActive ? 'accent' : 'secondary'}
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('Game', { gameId: item.id })}
                />
                <IconButton
                  accessibilityLabel={t.game.copyMoves}
                  tone={copiedId === item.id ? 'accent' : 'default'}
                  onPress={() => void copyPgn(item)}
                >
                  <CopyIcon />
                </IconButton>
                <IconButton accessibilityLabel={t.common.delete} tone="danger" onPress={() => remove(item)}>
                  <TrashIcon />
                </IconButton>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function CopyIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M9 9h10v11H9zM5 15V4h10"
        stroke={colors.text}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"
        stroke={colors.danger}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
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
  list: {
    padding: spacing.md,
    gap: spacing.md,
    flexGrow: 1,
  },
  card: {
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textOnDark,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
