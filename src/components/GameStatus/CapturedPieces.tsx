import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Move, PieceSymbol } from 'chess.js';
import { PIECE_SVGS, type PieceCode } from '../ChessBoard/pieceSvgs';
import { colors, radius, spacing, typography } from '../../theme';
import { useI18n } from '../../i18n';

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

interface Props {
  history: Move[];
  fen: string;
}

/** Material on the board per color, from the FEN (handles promotions exactly). */
function materialFromFen(fen: string): { w: number; b: number } {
  let w = 0;
  let b = 0;
  for (const ch of fen.split(' ')[0]) {
    const lower = ch.toLowerCase() as PieceSymbol;
    if (!(lower in VALUES)) continue;
    if (ch === lower) b += VALUES[lower];
    else w += VALUES[lower];
  }
  return { w, b };
}

export function CapturedPieces({ history, fen }: Props) {
  const { t } = useI18n();

  const data = useMemo(() => {
    const byWhite: PieceSymbol[] = []; // black pieces taken by White
    const byBlack: PieceSymbol[] = []; // white pieces taken by Black
    for (const m of history) {
      if (!m.captured) continue;
      (m.color === 'w' ? byWhite : byBlack).push(m.captured);
    }
    const sort = (list: PieceSymbol[]) => [...list].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const material = materialFromFen(fen);
    return { byWhite: sort(byWhite), byBlack: sort(byBlack), diff: material.w - material.b };
  }, [history, fen]);

  if (data.byWhite.length === 0 && data.byBlack.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.game.captured}</Text>
        <Text style={styles.title}>{t.game.material}</Text>
      </View>
      <Row label={t.common.white} pieces={data.byWhite} color="b" score={data.diff} even={t.game.even} />
      <Row label={t.common.black} pieces={data.byBlack} color="w" score={-data.diff} even={t.game.even} />
    </View>
  );
}

function Row({
  label,
  pieces,
  color,
  score,
  even,
}: {
  label: string;
  pieces: PieceSymbol[];
  /** color of the captured pieces to draw */
  color: 'w' | 'b';
  score: number;
  even: string;
}) {
  const ahead = score > 0;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pieces}>
        {pieces.map((p, i) => (
          <View key={`${p}${i}`} style={styles.piece}>
            <SvgXml xml={PIECE_SVGS[`${color}${p.toUpperCase()}` as PieceCode]} width="100%" height="100%" />
          </View>
        ))}
        {pieces.length === 0 ? <Text style={styles.none}>–</Text> : null}
      </View>
      <View style={[styles.score, ahead ? styles.scoreAhead : null]}>
        <Text style={[styles.scoreText, ahead ? styles.scoreTextAhead : null]}>
          {score > 0 ? `+${score}` : score === 0 ? even : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 30,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    width: 54,
  },
  pieces: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  piece: {
    width: 24,
    height: 24,
    marginRight: -6,
  },
  none: {
    ...typography.caption,
    color: colors.textMuted,
  },
  score: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  scoreAhead: {},
  scoreText: {
    ...typography.mono,
    color: colors.textMuted,
  },
  scoreTextAhead: {
    color: colors.primaryDark,
  },
});
