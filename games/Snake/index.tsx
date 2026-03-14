/**
 * Snake Game - React Native
 *
 * A classic snake game with swipe and D-pad controls.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID_SIZE = 18;
const INITIAL_SPEED = 160;
const STORAGE_KEY = '@snake/highscore';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'DEAD';
type Point = { x: number; y: number };

const DIRS: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
const OPPOSITES: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface GameState {
  snake: Point[];
  food: Point;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  level: number;
  speed: number;
  status: GameStatus;
}

const randomFood = (snake: Point[]): Point => {
  let pos: Point;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
};

const getInitialState = (): GameState => ({
  snake: [
    { x: 9, y: 9 },
    { x: 8, y: 9 },
    { x: 7, y: 9 },
  ],
  food: { x: 4, y: 4 },
  direction: 'RIGHT',
  nextDirection: 'RIGHT',
  score: 0,
  level: 1,
  speed: INITIAL_SPEED,
  status: 'IDLE',
});

const DEFAULT_BOARD = 340;

function computeBoard(containerWidth: number) {
  const boardSize = Math.min(containerWidth - 32, 380);
  const cell = Math.floor(boardSize / GRID_SIZE);
  return { boardSize, cell };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SnakeGame() {
  const [layout, setLayout] = useState(() => computeBoard(DEFAULT_BOARD + 32));
  const { boardSize, cell } = layout;

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setLayout(computeBoard(w));
  }, []);

  const [state, setState] = useState<GameState>(getInitialState());
  const [highScore, setHighScore] = useState(0);
  const stateRef = useRef(state);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<(() => void) | null>(null);

  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  // ── Game loop tick ──────────────────────────────────────────────────────────
  tickRef.current = () => {
    const s = stateRef.current;
    if (s.status !== 'RUNNING') return;

    const dir = DIRS[s.nextDirection];
    const head: Point = { x: s.snake[0].x + dir.x, y: s.snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setHighScore((hs) => {
        const newHigh = Math.max(hs, s.score);
        if (s.score > hs) {
          AsyncStorage.setItem(STORAGE_KEY, s.score.toString());
        }
        return newHigh;
      });
      setState((prev) => ({ ...prev, status: 'DEAD' as const }));
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Self collision
    if (s.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      setHighScore((hs) => {
        const newHigh = Math.max(hs, s.score);
        if (s.score > hs) {
          AsyncStorage.setItem(STORAGE_KEY, s.score.toString());
        }
        return newHigh;
      });
      setState((prev) => ({ ...prev, status: 'DEAD' as const }));
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const ate = head.x === s.food.x && head.y === s.food.y;
    const newSnake = ate ? [head, ...s.snake] : [head, ...s.snake.slice(0, -1)];
    const newScore = ate ? s.score + 10 : s.score;
    const newLevel = Math.floor(newScore / 100) + 1;
    const newSpeed = Math.max(60, INITIAL_SPEED - (newLevel - 1) * 8);
    const newFood = ate ? randomFood(newSnake) : s.food;

    setState((prev) => ({
      ...prev,
      snake: newSnake,
      food: newFood,
      score: newScore,
      level: newLevel,
      speed: newSpeed,
      direction: prev.nextDirection,
    }));

    // Adjust interval speed on level up
    if (ate && newSpeed !== s.speed) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => tickRef.current?.(), newSpeed);
    }
  };

  // ── Controls ────────────────────────────────────────────────────────────────
  const changeDir = useCallback((newDir: Direction) => {
    setState((prev) => {
      if (prev.status !== 'RUNNING') return prev;
      if (OPPOSITES[newDir] === prev.direction) return prev;
      return { ...prev, nextDirection: newDir };
    });
  }, []);

  const startGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const fresh: GameState = { ...getInitialState(), status: 'RUNNING' };
    setState(fresh);
    intervalRef.current = setInterval(() => tickRef.current?.(), INITIAL_SPEED);
  }, []);

  const togglePause = useCallback(() => {
    setState((prev) => {
      if (prev.status === 'RUNNING') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return { ...prev, status: 'PAUSED' };
      }
      if (prev.status === 'PAUSED') {
        intervalRef.current = setInterval(() => tickRef.current?.(), prev.speed);
        return { ...prev, status: 'RUNNING' };
      }
      return prev;
    });
  }, []);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  // ── Swipe detection ─────────────────────────────────────────────────────────
  const touchStart = useRef<Point | null>(null);
  const handleTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    touchStart.current = { x: t.pageX, y: t.pageY };
  };
  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (!touchStart.current) return;
    const t = e.nativeEvent.changedTouches[0];
    const dx = t.pageX - touchStart.current.x;
    const dy = t.pageY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      changeDir(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDir(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStart.current = null;
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const snakeSet = new Set(state.snake.map((s) => `${s.x},${s.y}`));
  const headKey = `${state.snake[0].x},${state.snake[0].y}`;

  const renderBoard = () => {
    const cells: React.JSX.Element[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = `${x},${y}`;
        const isHead = key === headKey;
        const isSnake = snakeSet.has(key);
        const isFood = state.food.x === x && state.food.y === y;
        const segIdx = isSnake ? state.snake.findIndex((s) => s.x === x && s.y === y) : -1;
        const opacity =
          isSnake && !isHead ? Math.max(0.35, 1 - (segIdx / state.snake.length) * 0.6) : 1;

        cells.push(
          <View
            key={key}
            style={[
              styles.cell,
              { left: x * cell, top: y * cell, width: cell, height: cell },
            ]}>
            {isFood && (
              <View
                style={{
                  width: cell - 6,
                  height: cell - 6,
                  borderRadius: (cell - 6) / 2,
                  backgroundColor: '#ff5500',
                  shadowColor: '#ff5500',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 8,
                }}
              />
            )}
            {isHead && (
              <View
                style={{
                  width: cell - 4,
                  height: cell - 4,
                  backgroundColor: '#00ff88',
                  borderRadius: 5,
                  shadowColor: '#00ff88',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 6,
                  position: 'relative',
                }}>
                <View style={styles.eyeLeft} />
                <View style={styles.eyeRight} />
              </View>
            )}
            {isSnake && !isHead && (
              <View
                style={{
                  width: cell - 5,
                  height: cell - 5,
                  backgroundColor: '#00cc6a',
                  borderRadius: 4,
                  opacity,
                }}
              />
            )}
            {!isFood && !isSnake && <View style={styles.dot} />}
          </View>,
        );
      }
    }
    return cells;
  };

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {/* ── Title ── */}
      <Text style={styles.title}>SNAKE</Text>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <StatBox label="SCORE" value={state.score} color="#00ff88" />
        <StatBox label="LEVEL" value={state.level} color="#ff6b35" />
        <StatBox label="BEST" value={highScore} color="#a855f7" />
      </View>

      {/* ── Board ── */}
      <View
        style={[styles.boardWrapper, { width: boardSize + 4, height: boardSize + 4 }]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        <View style={[styles.board, { width: boardSize, height: boardSize }]}>
          {renderBoard()}
        </View>

        {/* Overlay */}
        {state.status !== 'RUNNING' && (
          <View style={styles.overlay}>
            {state.status === 'IDLE' && (
              <>
                <Text style={styles.overlayTitle}>READY?</Text>
                <Text style={styles.overlayHint}>Swipe or use D-Pad to move</Text>
              </>
            )}
            {state.status === 'DEAD' && (
              <>
                <Text style={[styles.overlayTitle, { color: '#ff4444' }]}>GAME OVER</Text>
                <Text style={styles.overlayScore}>Score: {state.score}</Text>
                {state.score > 0 && state.score >= highScore && (
                  <Text style={styles.newHigh}>{'\u2605'} NEW HIGH SCORE {'\u2605'}</Text>
                )}
              </>
            )}
            {state.status === 'PAUSED' && <Text style={styles.overlayTitle}>PAUSED</Text>}
            <TouchableOpacity
              style={styles.startBtn}
              onPress={state.status === 'PAUSED' ? togglePause : startGame}
              activeOpacity={0.7}>
              <Text style={styles.startBtnText}>
                {state.status === 'PAUSED'
                  ? 'RESUME'
                  : state.status === 'DEAD'
                    ? 'PLAY AGAIN'
                    : 'START GAME'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── D-Pad ── */}
      <View style={styles.dpad}>
        <View style={styles.dpadRow}>
          <DPadBtn label={'\u25B2'} onPress={() => changeDir('UP')} />
        </View>
        <View style={styles.dpadRow}>
          <DPadBtn label={'\u25C4'} onPress={() => changeDir('LEFT')} />
          <DPadBtn label={'\u23F8'} onPress={togglePause} accent />
          <DPadBtn label={'\u25BA'} onPress={() => changeDir('RIGHT')} />
        </View>
        <View style={styles.dpadRow}>
          <DPadBtn label={'\u25BC'} onPress={() => changeDir('DOWN')} />
        </View>
      </View>

      <Text style={styles.hint}>Swipe the board or use the D-Pad</Text>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{String(value).padStart(4, '0')}</Text>
    </View>
  );
}

function DPadBtn({
  label,
  onPress,
  accent = false,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.dpadBtn, accent && styles.dpadBtnAccent]}
      onPress={onPress}
      activeOpacity={0.6}>
      <Text style={[styles.dpadBtnText, accent && { color: '#00ff88' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    paddingVertical: 12,
    gap: 14,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#00ff88',
    letterSpacing: 14,
    textShadowColor: 'rgba(0,255,136,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    marginTop: 2,
  },

  // Board
  boardWrapper: {
    padding: 2,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(0,255,136,0.5)',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  board: {
    backgroundColor: '#0d0d14',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  eyeLeft: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0a0a0f',
  },
  eyeRight: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0a0a0f',
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    gap: 10,
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00ff88',
    letterSpacing: 6,
    textShadowColor: 'rgba(0,255,136,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  overlayScore: {
    fontSize: 18,
    color: '#fff',
    letterSpacing: 2,
  },
  overlayHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  newHigh: {
    fontSize: 12,
    color: '#ffd700',
    letterSpacing: 2,
    fontWeight: '700',
  },
  startBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#00ff88',
    borderRadius: 4,
  },
  startBtnText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },

  // D-Pad
  dpad: {
    alignItems: 'center',
    gap: 4,
  },
  dpadRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dpadBtn: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadBtnAccent: {
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderColor: '#00ff88',
  },
  dpadBtnText: {
    fontSize: 20,
    color: '#aaa',
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1,
  },
});
