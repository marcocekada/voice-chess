import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Move, Square } from 'chess.js';
import { PIECE_SVGS, type PieceCode } from './pieceSvgs';
import { colors } from '../../theme';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export interface LegalTarget {
  square: Square;
  capture: boolean;
}

interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: Pick<Move, 'from' | 'to' | 'flags'> | null;
  selectedSquare?: Square | null;
  legalTargets?: LegalTarget[];
  checkSquare?: Square | null;
  onSquarePress?: (square: Square) => void;
  size?: number;
  disabled?: boolean;
}

interface PlacedPiece {
  code: PieceCode;
  square: Square;
}

function parseFenPieces(fen: string): PlacedPiece[] {
  const placement = fen.split(' ')[0];
  const rows = placement.split('/');
  const pieces: PlacedPiece[] = [];
  rows.forEach((row, rowIdx) => {
    const rank = 8 - rowIdx;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const code = `${color}${ch.toUpperCase()}` as PieceCode;
      pieces.push({ code, square: `${FILES[file]}${rank}` as Square });
      file++;
    }
  });
  return pieces;
}

/** Squares whose piece should animate from another square after `lastMove`. */
function animationSources(lastMove: ChessBoardProps['lastMove']): Partial<Record<Square, Square>> {
  if (!lastMove) return {};
  const map: Partial<Record<Square, Square>> = { [lastMove.to]: lastMove.from };
  const rank = lastMove.to[1];
  if (lastMove.flags.includes('k')) {
    map[`f${rank}` as Square] = `h${rank}` as Square;
  } else if (lastMove.flags.includes('q')) {
    map[`d${rank}` as Square] = `a${rank}` as Square;
  }
  return map;
}

export function ChessBoard({
  fen,
  orientation,
  lastMove,
  selectedSquare,
  legalTargets = [],
  checkSquare,
  onSquarePress,
  size,
  disabled,
}: ChessBoardProps) {
  const { width } = useWindowDimensions();
  const total = size ?? Math.min(width - 24, 520);
  const frame = Math.round(total * 0.072);
  const inner = total - frame * 2;
  const rim = Math.max(3, Math.round(inner * 0.012));
  const cell = (inner - rim * 2) / 8;
  const gap = Math.max(1.5, cell * 0.05);
  const squareRadius = cell * 0.16;

  const pieces = useMemo(() => parseFenPieces(fen), [fen]);
  const sources = useMemo(() => animationSources(lastMove), [lastMove]);
  const legalMap = useMemo(() => {
    const m = new Map<Square, boolean>();
    legalTargets.forEach((t) => m.set(t.square, t.capture));
    return m;
  }, [legalTargets]);

  const squareToXY = (square: Square) => {
    const f = FILES.indexOf(square[0] as (typeof FILES)[number]);
    const r = RANKS.indexOf(square[1] as (typeof RANKS)[number]);
    const col = orientation === 'white' ? f : 7 - f;
    const row = orientation === 'white' ? 7 - r : r;
    return { x: rim + col * cell, y: rim + row * cell };
  };

  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];

  const coordFont = Math.max(11, Math.round(frame * 0.58));

  return (
    <View style={[styles.frame, { width: total, height: total, borderRadius: total * 0.06, padding: frame }]}>
      {/* Coordinates: files top & bottom */}
      {[0, 1].map((side) => (
        <View
          key={`files-${side}`}
          pointerEvents="none"
          style={[
            styles.filesRow,
            { left: frame + rim, width: inner - rim * 2, height: frame },
            side === 0 ? { top: 0 } : { bottom: 0 },
          ]}
        >
          {files.map((f) => (
            <Text key={f} style={[styles.coord, { fontSize: coordFont, width: cell }]}>
              {f}
            </Text>
          ))}
        </View>
      ))}
      {/* Coordinates: ranks left & right */}
      {[0, 1].map((side) => (
        <View
          key={`ranks-${side}`}
          pointerEvents="none"
          style={[
            styles.ranksCol,
            { top: frame + rim, height: inner - rim * 2, width: frame },
            side === 0 ? { left: 0 } : { right: 0 },
          ]}
        >
          {ranks.map((r) => (
            <Text key={r} style={[styles.coord, { fontSize: coordFont, height: cell, lineHeight: cell }]}>
              {r}
            </Text>
          ))}
        </View>
      ))}

      {/* Inner board */}
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: total * 0.03, padding: rim }]}>
        {ranks.map((r, rowIdx) => (
          <View key={r} style={styles.row}>
            {files.map((f, colIdx) => {
              const square = `${f}${r}` as Square;
              const isDark = (rowIdx + colIdx) % 2 === 1;
              const isSelected = selectedSquare === square;
              const isLast = lastMove?.from === square || lastMove?.to === square;
              const legal = legalMap.get(square);
              const isCheck = checkSquare === square;
              return (
                <Pressable
                  key={square}
                  disabled={disabled || !onSquarePress}
                  onPress={() => onSquarePress?.(square)}
                  accessibilityLabel={square}
                  style={{ width: cell, height: cell, padding: gap / 2 }}
                >
                  <View
                    style={[
                      styles.square,
                      {
                        borderRadius: squareRadius,
                        backgroundColor: isDark ? colors.board.dark : colors.board.light,
                      },
                    ]}
                  >
                    {isLast ? (
                      <View style={[styles.overlay, { borderRadius: squareRadius, backgroundColor: colors.board.lastMove }]} />
                    ) : null}
                    {isSelected ? (
                      <View style={[styles.overlay, { borderRadius: squareRadius, backgroundColor: colors.board.selected }]} />
                    ) : null}
                    {isCheck ? (
                      <View
                        style={[
                          styles.overlay,
                          { borderRadius: squareRadius, borderWidth: cell * 0.08, borderColor: colors.board.check },
                        ]}
                      />
                    ) : null}
                    {legal !== undefined ? (
                      legal ? (
                        <View
                          style={[
                            styles.overlay,
                            { borderRadius: squareRadius, borderWidth: cell * 0.09, borderColor: colors.board.captureRing },
                          ]}
                        />
                      ) : (
                        <View
                          style={{
                            width: cell * 0.3,
                            height: cell * 0.3,
                            borderRadius: cell * 0.15,
                            backgroundColor: colors.board.legalDot,
                          }}
                        />
                      )
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Pieces layer */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {pieces.map((p) => {
            const from = sources[p.square];
            return (
              <AnimatedPiece
                key={`${p.square}:${p.code}`}
                code={p.code}
                to={squareToXY(p.square)}
                from={from ? squareToXY(from) : undefined}
                size={cell}
                lifted={selectedSquare === p.square}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function AnimatedPiece({
  code,
  to,
  from,
  size,
  lifted,
}: {
  code: PieceCode;
  to: { x: number; y: number };
  from?: { x: number; y: number };
  size: number;
  lifted: boolean;
}) {
  const pos = useRef(new Animated.ValueXY(from ?? to)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (from) {
      pos.setValue(from);
      Animated.spring(pos, {
        toValue: to,
        useNativeDriver: true,
        speed: 22,
        bounciness: 4,
      }).start();
    } else {
      pos.setValue(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to.x, to.y]);

  useEffect(() => {
    Animated.spring(scale, { toValue: lifted ? 1.12 : 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [lifted, scale]);

  const pad = size * 0.04;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        padding: pad,
        transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }],
      }}
    >
      <SvgXml xml={PIECE_SVGS[code]} width="100%" height="100%" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.board.frame,
    position: 'relative',
    alignSelf: 'center',
  },
  inner: {
    backgroundColor: colors.board.frameInner,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  filesRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ranksCol: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coord: {
    color: colors.board.coord,
    fontWeight: '900',
    textAlign: 'center',
  },
});
