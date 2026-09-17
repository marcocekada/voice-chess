/**
 * Voice Chess Play design tokens.
 * Playful but clear: warm cream background, sage-green board (inspired by the
 * reference vector board), coral accent for calls to action.
 */
export const colors = {
  bg: '#F6F1E4',
  surface: '#FFFCF4',
  surfaceAlt: '#EFE8D6',
  border: '#E1D9C3',

  text: '#26352B',
  textMuted: '#7C897F',
  textOnDark: '#FFFDF6',

  primary: '#4E8A5C',
  primaryDark: '#2F5D3A',
  primarySoft: '#DDEBDD',

  accent: '#F08A5D',
  accentDark: '#D96A3D',
  accentSoft: '#FDE4D8',

  gold: '#F2C14E',
  goldSoft: '#FBF0CD',

  danger: '#D95757',
  dangerSoft: '#F9DEDE',

  white: '#FFFFFF',
  black: '#1E1E1E',

  board: {
    frame: '#78997A',
    frameInner: '#A3B79B',
    light: '#DBD6BC',
    dark: '#6F9472',
    coord: '#E7E1C8',
    selected: 'rgba(242, 193, 78, 0.85)',
    lastMove: 'rgba(242, 193, 78, 0.45)',
    legalDot: 'rgba(38, 53, 43, 0.28)',
    captureRing: 'rgba(240, 138, 93, 0.9)',
    check: 'rgba(217, 87, 87, 0.75)',
  },
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '900' as const, letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '800' as const },
  body: { fontSize: 16, fontWeight: '500' as const },
  bodyBold: { fontSize: 16, fontWeight: '700' as const },
  caption: { fontSize: 13, fontWeight: '600' as const },
  mono: { fontSize: 15, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;

export const shadow = {
  card: {
    shadowColor: '#3A3A2A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  button: {
    shadowColor: '#3A3A2A',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
