import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Button, Card, Chip, IconButton, Screen } from '../components/ui';
import { ChessBoard } from '../components/ChessBoard/ChessBoard';
import { MicrophoneButton } from '../components/MicrophoneButton/MicrophoneButton';
import { BackIcon } from './NewGameScreen';
import { colors, radius, spacing, typography } from '../theme';
import { useI18n } from '../i18n';
import { useChessGame } from '../hooks/useChessGame';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import type { RootScreenProps } from '../navigation/types';

export function GameScreen({ navigation, route }: RootScreenProps<'Game'>) {
  const { t } = useI18n();
  const game = useChessGame(route.params);
  const voice = useVoiceCommands(game.submitCommand);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [draft, setDraft] = useState('');

  // Without native speech recognition (Expo Go) the keyboard is the way in.
  useEffect(() => {
    if (!voice.available) setKeyboardMode(true);
  }, [voice.available]);

  useEffect(() => {
    if (game.loadError) navigation.goBack();
  }, [game.loadError, navigation]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    game.submitCommand(text);
    setDraft('');
  };

  const confirmResign = () => {
    Alert.alert(t.game.resign, t.game.resignConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.game.resign, style: 'destructive', onPress: () => void game.resign() },
    ]);
  };

  const statusLine = useMemo(() => {
    if (game.isGameOver) return t.status[game.status];
    if (game.isEngineThinking) return t.game.computerThinking;
    if (voice.listening) return t.game.listening;
    return game.inCheck ? `${t.game.yourTurn} · ${t.game.check}` : t.game.yourTurn;
  }, [game.inCheck, game.isEngineThinking, game.isGameOver, game.status, t, voice.listening]);

  const messageColor =
    game.message?.kind === 'error'
      ? colors.danger
      : game.message?.kind === 'question'
        ? colors.accentDark
        : game.message?.kind === 'success'
          ? colors.primaryDark
          : colors.text;

  const outcome = game.isGameOver
    ? game.result === '1/2-1/2'
      ? 'draw'
      : (game.result === '1-0') === (game.playerColor === 'white')
        ? 'win'
        : 'loss'
    : null;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton accessibilityLabel={t.game.exit} onPress={() => navigation.goBack()}>
            <BackIcon />
          </IconButton>
          <View style={styles.turnRow}>
            <TurnPill
              label={t.common.you}
              color={game.playerColor}
              active={!game.isGameOver && game.isPlayerTurn}
            />
            <TurnPill
              label={`${t.common.computer} ${game.opponentElo}`}
              color={game.playerColor === 'white' ? 'black' : 'white'}
              active={!game.isGameOver && !game.isPlayerTurn}
              thinking={game.isEngineThinking}
            />
          </View>
          {game.isGameOver ? (
            <View style={{ width: 44 }} />
          ) : (
            <IconButton accessibilityLabel={t.game.resign} tone="danger" onPress={confirmResign}>
              <FlagIcon />
            </IconButton>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {game.loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <ChessBoard
              fen={game.fen}
              orientation={game.playerColor}
              lastMove={game.lastMove}
              selectedSquare={game.selectedSquare}
              legalTargets={game.legalTargets}
              checkSquare={game.checkSquare}
              onSquarePress={game.pressSquare}
              disabled={game.isGameOver || !game.isPlayerTurn}
            />
          )}

          {/* Status + feedback */}
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLine}>{statusLine}</Text>
              {game.isEngineThinking ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            {voice.listening && voice.partial ? (
              <Text style={styles.partial}>“{voice.partial}”</Text>
            ) : game.message ? (
              <Text style={[styles.message, { color: messageColor }]}>{game.message.text}</Text>
            ) : (
              <Text style={styles.hint}>{keyboardMode ? t.game.hintTouch : t.game.tapToSpeak}</Text>
            )}
            {game.lastCommand ? (
              <Text style={styles.lastCommand}>
                {t.game.lastCommand}: “{game.lastCommand}”
              </Text>
            ) : null}
            {voice.error ? <Text style={styles.voiceError}>{voice.error}</Text> : null}
          </Card>

          {/* Clarification */}
          {game.clarification && !game.isGameOver ? (
            <Card tone="accent" style={styles.clarifyCard}>
              <Text style={styles.clarifyTitle}>
                {game.clarification.candidates.every((m) => m.promotion)
                  ? t.game.promotionTitle
                  : t.game.clarificationTitle}
              </Text>
              <Text style={styles.clarifyHint}>{t.game.chooseCandidate}</Text>
              <View style={styles.chips}>
                {game.clarification.candidates.map((m) => (
                  <Chip
                    key={`${m.from}${m.to}${m.promotion ?? ''}`}
                    label={
                      m.promotion && game.clarification!.candidates.every((c) => c.promotion)
                        ? t.pieces[m.promotion]
                        : `${game.describeMove(m)} (${m.from})`
                    }
                    onPress={() => game.chooseCandidate(m)}
                  />
                ))}
                <Chip label={t.common.cancel} small onPress={game.cancelClarification} />
              </View>
            </Card>
          ) : null}

          {/* Game over */}
          {game.isGameOver ? (
            <Card tone={outcome === 'win' ? 'gold' : outcome === 'loss' ? 'soft' : 'default'} style={styles.overCard}>
              <Text style={styles.overEmoji}>{outcome === 'win' ? '🏆' : outcome === 'loss' ? '🤝' : '⚖️'}</Text>
              <Text style={styles.overTitle}>
                {outcome === 'win' ? t.game.youWin : outcome === 'loss' ? t.game.youLose : t.game.draw}
              </Text>
              <Text style={styles.overSubtitle}>
                {t.status[game.status]} · {game.result}
              </Text>
              <View style={styles.overActions}>
                <Button
                  title={t.game.playAgain}
                  variant="accent"
                  style={{ flex: 1 }}
                  onPress={() => navigation.replace('NewGame')}
                />
                <Button
                  title={t.game.backHome}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => navigation.popToTop()}
                />
              </View>
            </Card>
          ) : null}

          {/* Move list */}
          {game.history.length > 0 ? (
            <View style={styles.moveList}>
              <Text style={styles.moveListTitle}>{t.game.moveList}</Text>
              <Text style={styles.moveListText}>
                {game.history
                  .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san))
                  .join('  ')}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Controls */}
        {!game.isGameOver ? (
          <View style={styles.controls}>
            {keyboardMode ? (
              <View style={styles.inputRow}>
                {voice.available ? (
                  <IconButton accessibilityLabel="voice" onPress={() => setKeyboardMode(false)}>
                    <MicSmallIcon />
                  </IconButton>
                ) : null}
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={send}
                  placeholder={t.game.typeCommand}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  style={styles.input}
                  editable={game.isPlayerTurn}
                />
                <Pressable
                  onPress={send}
                  disabled={!draft.trim() || !game.isPlayerTurn}
                  style={({ pressed }) => [
                    styles.sendButton,
                    { opacity: !draft.trim() || !game.isPlayerTurn ? 0.4 : pressed ? 0.8 : 1 },
                  ]}
                >
                  <SendIcon />
                </Pressable>
              </View>
            ) : (
              <View style={styles.voiceRow}>
                <IconButton accessibilityLabel="keyboard" onPress={() => setKeyboardMode(true)}>
                  <KeyboardIcon />
                </IconButton>
                <MicrophoneButton
                  listening={voice.listening}
                  disabled={!game.isPlayerTurn}
                  onPress={voice.toggle}
                />
                <View style={{ width: 44 }} />
              </View>
            )}
          </View>
        ) : (
          <View style={{ height: spacing.md }} />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TurnPill({
  label,
  color,
  active,
  thinking,
}: {
  label: string;
  color: 'white' | 'black';
  active: boolean;
  thinking?: boolean;
}) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : null]}>
      <View
        style={[
          styles.pillDot,
          { backgroundColor: color === 'white' ? colors.white : colors.black, borderColor: colors.text },
        ]}
      />
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]} numberOfLines={1}>
        {label}
        {thinking ? '…' : ''}
      </Text>
    </View>
  );
}

function FlagIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M5 21V4m0 0h11l-1.5 3.5L16 11H5"
        stroke={colors.danger}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function KeyboardIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x="3" y="6" width="18" height="12" rx="3" stroke={colors.text} strokeWidth={2} fill="none" />
      <Path d="M7 10h1M11 10h1M15 10h1M8 14h8" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function MicSmallIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x="9" y="2.5" width="6" height="12" rx="3" fill={colors.text} />
      <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function SendIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M4 12h14M13 6l6 6-6 6" stroke={colors.textOnDark} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
    gap: spacing.sm,
  },
  turnRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    maxWidth: 150,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  pillText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pillTextActive: {
    color: colors.textOnDark,
  },
  content: {
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.md,
    gap: spacing.sm + 4,
  },
  statusCard: {
    gap: 4,
    paddingVertical: spacing.sm + 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLine: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  message: {
    ...typography.bodyBold,
    fontSize: 17,
  },
  partial: {
    ...typography.body,
    color: colors.accentDark,
    fontStyle: 'italic',
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
  },
  lastCommand: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  voiceError: {
    ...typography.caption,
    color: colors.danger,
  },
  clarifyCard: {
    gap: spacing.xs,
  },
  clarifyTitle: {
    ...typography.heading,
    color: colors.accentDark,
  },
  clarifyHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  overCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  overEmoji: {
    fontSize: 40,
  },
  overTitle: {
    ...typography.title,
    color: colors.text,
  },
  overSubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  overActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  moveList: {
    paddingHorizontal: spacing.xs,
  },
  moveListTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  moveListText: {
    ...typography.mono,
    color: colors.text,
    lineHeight: 22,
  },
  controls: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
