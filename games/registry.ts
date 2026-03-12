import type { ComponentType } from 'react';
import SnakeGame from './Snake';
import CircleShrink from './CircleShrink';
import LaserDodge from './LaserDodge';
import PulseLanes from './PulseLanes';

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
    storageKey: '@snake_high_score',
  },
  {
    id: 'circle-shrink',
    name: 'Circle Shrink',
    component: CircleShrink,
    description: 'Tap circles before they vanish',
    color: '#4ecdc4',
    icon: 'radio-button-on',
    storageKey: '@circle_shrink_high_score',
  },
  {
    id: 'laser-dodge',
    name: 'Laser Dodge',
    component: LaserDodge,
    description: 'Dodge lasers from all edges',
    color: '#ff0040',
    icon: 'flash',
    storageKey: '@laser_dodge_high_score',
  },
  {
    id: 'pulse-lanes',
    name: 'Pulse Lanes',
    component: PulseLanes,
    description: 'Switch lanes to dodge obstacles',
    color: '#00f5ff',
    icon: 'pulse',
    storageKey: '@pulse_lanes_high_score',
  },
];
