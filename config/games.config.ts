import Constants from 'expo-constants';

export type GameVariant = 'snake' | 'circle-shrink' | 'laser-dodge' | 'pulse-lanes' | 'math-rush' | 'gravity-flip' | 'color-clash' | 'stack-blocks' | 'simon-says' | 'number-order' | 'tap-rhythm' | 'brick-breaker' | 'slice-frenzy' | 'tile-shift' | 'color-flood';

export interface GameConfig {
  id: GameVariant;
  displayName: string;
  primaryColor: string;
  backgroundColor: string;
  accentColor: string;
}

export const GAMES_CONFIG: Record<GameVariant, GameConfig> = {
  snake: {
    id: 'snake',
    displayName: 'Snake Classic',
    primaryColor: '#4CAF50',
    backgroundColor: '#0a0a0f',
    accentColor: '#FFD700',
  },
  'circle-shrink': {
    id: 'circle-shrink',
    displayName: 'Circle Shrink',
    primaryColor: '#4ecdc4',
    backgroundColor: '#0f0f23',
    accentColor: '#feca57',
  },
  'laser-dodge': {
    id: 'laser-dodge',
    displayName: 'Laser Dodge',
    primaryColor: '#ff0040',
    backgroundColor: '#0a0014',
    accentColor: '#00f5ff',
  },
  'pulse-lanes': {
    id: 'pulse-lanes',
    displayName: 'Pulse Lanes',
    primaryColor: '#00f5ff',
    backgroundColor: '#0a0a1a',
    accentColor: '#a855f7',
  },
  'math-rush': {
    id: 'math-rush',
    displayName: 'Math Rush',
    primaryColor: '#feca57',
    backgroundColor: '#0d0d2b',
    accentColor: '#ff6b6b',
  },
  'gravity-flip': {
    id: 'gravity-flip',
    displayName: 'Gravity Flip',
    primaryColor: '#39ff14',
    backgroundColor: '#060614',
    accentColor: '#ff00ff',
  },
  'color-clash': {
    id: 'color-clash',
    displayName: 'Color Clash',
    primaryColor: '#ff4444',
    backgroundColor: '#0f0a1e',
    accentColor: '#ffdd00',
  },
  'stack-blocks': {
    id: 'stack-blocks',
    displayName: 'Stack Blocks',
    primaryColor: '#00f5ff',
    backgroundColor: '#0d0d2b',
    accentColor: '#a855f7',
  },
  'simon-says': {
    id: 'simon-says',
    displayName: 'Simon Says',
    primaryColor: '#ffd700',
    backgroundColor: '#0a0a1e',
    accentColor: '#44dd66',
  },
  'number-order': {
    id: 'number-order',
    displayName: 'Number Order',
    primaryColor: '#60a5fa',
    backgroundColor: '#0a1628',
    accentColor: '#f87171',
  },
  'tap-rhythm': {
    id: 'tap-rhythm',
    displayName: 'Tap Rhythm',
    primaryColor: '#ff00ff',
    backgroundColor: '#0d001a',
    accentColor: '#ffd700',
  },
  'brick-breaker': {
    id: 'brick-breaker',
    displayName: 'Brick Breaker',
    primaryColor: '#ff6b35',
    backgroundColor: '#0a0a1a',
    accentColor: '#ffffff',
  },
  'slice-frenzy': {
    id: 'slice-frenzy',
    displayName: 'Slice Frenzy',
    primaryColor: '#ff4757',
    backgroundColor: '#0d0d0d',
    accentColor: '#ffa502',
  },
  'tile-shift': {
    id: 'tile-shift',
    displayName: 'Tile Shift',
    primaryColor: '#ffd700',
    backgroundColor: '#1a1000',
    accentColor: '#ff6b35',
  },
  'color-flood': {
    id: 'color-flood',
    displayName: 'Color Flood',
    primaryColor: '#a855f7',
    backgroundColor: '#0d0a1a',
    accentColor: '#2ed573',
  },
};

const rawVariant =
  Constants.expoConfig?.extra?.appVariant ||
  process.env.EXPO_PUBLIC_APP_VARIANT ||
  process.env.APP_VARIANT;
const fallbackVariant: GameVariant = 'snake';

const isGameVariant = (value: unknown): value is GameVariant => {
  return (
    value === 'snake' ||
    value === 'circle-shrink' ||
    value === 'laser-dodge' ||
    value === 'pulse-lanes' ||
    value === 'math-rush' ||
    value === 'gravity-flip' ||
    value === 'color-clash' ||
    value === 'stack-blocks' ||
    value === 'simon-says' ||
    value === 'number-order' ||
    value === 'tap-rhythm' ||
    value === 'brick-breaker' ||
    value === 'slice-frenzy' ||
    value === 'tile-shift' ||
    value === 'color-flood'
  );
};

export const currentVariant: GameVariant = isGameVariant(rawVariant)
  ? rawVariant
  : fallbackVariant;
export const currentGameConfig = GAMES_CONFIG[currentVariant];
export const configuredVariant: GameVariant | null = isGameVariant(rawVariant)
  ? rawVariant
  : null;
