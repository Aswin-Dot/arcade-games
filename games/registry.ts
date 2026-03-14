import type { ComponentType } from 'react';
import SnakeGame from './Snake';
import CircleShrink from './CircleShrink';
import LaserDodge from './LaserDodge';
import PulseLanes from './PulseLanes';
import MathRush from './MathRush';
import GravityFlip from './GravityFlip';
import ColorClash from './ColorClash';
import StackBlocks from './StackBlocks';
import SimonSays from './SimonSays';
import NumberOrder from './NumberOrder';
import TapRhythm from './TapRhythm';
import BrickBreaker from './BrickBreaker';
import SliceFrenzy from './SliceFrenzy';
import TileShift from './TileShift';
import ColorFlood from './ColorFlood';

export interface GameEntry {
  id: string;
  name: string;
  component: ComponentType;
  description: string;
  color: string;
  icon: string; // Ionicons name
  storageKey: string;
}

export const allGames: GameEntry[] = [
  {
    id: 'snake',
    name: 'Snake',
    component: SnakeGame,
    description: 'Classic snake on a neon grid',
    color: '#00ff88',
    icon: 'game-controller',
    storageKey: '@snake/highscore',
  },
  {
    id: 'circle-shrink',
    name: 'Circle Shrink',
    component: CircleShrink,
    description: 'Tap circles before they vanish',
    color: '#4ecdc4',
    icon: 'radio-button-on',
    storageKey: '@circle-shrink/highscore',
  },
  {
    id: 'laser-dodge',
    name: 'Laser Dodge',
    component: LaserDodge,
    description: 'Dodge lasers from all edges',
    color: '#ff0040',
    icon: 'flash',
    storageKey: '@laser-dodge/highscore',
  },
  {
    id: 'pulse-lanes',
    name: 'Pulse Lanes',
    component: PulseLanes,
    description: 'Switch lanes to dodge obstacles',
    color: '#00f5ff',
    icon: 'pulse',
    storageKey: '@pulse-lanes/highscore',
  },
  {
    id: 'math-rush',
    name: 'Math Rush',
    component: MathRush,
    description: 'Quick mental math under pressure',
    color: '#feca57',
    icon: 'calculator',
    storageKey: '@math-rush/highscore',
  },
  {
    id: 'gravity-flip',
    name: 'Gravity Flip',
    component: GravityFlip,
    description: 'Flip gravity to dodge the pillars',
    color: '#39ff14',
    icon: 'swap-vertical',
    storageKey: '@gravity-flip/highscore',
  },
  {
    id: 'color-clash',
    name: 'Color Clash',
    component: ColorClash,
    description: 'Tap the ink color, not the word',
    color: '#ff4444',
    icon: 'color-palette',
    storageKey: '@color-clash/highscore',
  },
  {
    id: 'stack-blocks',
    name: 'Stack Blocks',
    component: StackBlocks,
    description: 'Drop blocks to build the tallest tower',
    color: '#00f5ff',
    icon: 'layers',
    storageKey: '@stack-blocks/highscore',
  },
  {
    id: 'simon-says',
    name: 'Simon Says',
    component: SimonSays,
    description: 'Memorize and repeat the color sequence',
    color: '#ffd700',
    icon: 'grid',
    storageKey: '@simon-says/highscore',
  },
  {
    id: 'number-order',
    name: 'Number Order',
    component: NumberOrder,
    description: 'Tap falling numbers in sequence',
    color: '#60a5fa',
    icon: 'list-circle',
    storageKey: '@number-order/highscore',
  },
  {
    id: 'tap-rhythm',
    name: 'Tap Rhythm',
    component: TapRhythm,
    description: 'Tap in sync with the beat',
    color: '#ff00ff',
    icon: 'musical-notes',
    storageKey: '@tap-rhythm/highscore',
  },
  {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    component: BrickBreaker,
    description: 'Break all the bricks with your ball',
    color: '#ff6b35',
    icon: 'tennisball',
    storageKey: '@brick-breaker/highscore',
  },
  {
    id: 'slice-frenzy',
    name: 'Slice Frenzy',
    component: SliceFrenzy,
    description: 'Swipe to slice shapes, avoid the bombs',
    color: '#ff4757',
    icon: 'cut',
    storageKey: '@slice-frenzy/highscore',
  },
  {
    id: 'tile-shift',
    name: 'Tile Shift',
    component: TileShift,
    description: 'Swipe to merge tiles and reach 2048',
    color: '#ffd700',
    icon: 'apps',
    storageKey: '@tile-shift/highscore',
  },
  {
    id: 'color-flood',
    name: 'Color Flood',
    component: ColorFlood,
    description: 'Flood-fill the grid in 25 moves',
    color: '#a855f7',
    icon: 'color-fill',
    storageKey: '@color-flood/highscore',
  },
];
