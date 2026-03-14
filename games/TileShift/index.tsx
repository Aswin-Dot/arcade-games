import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@tile-shift/highscore';
const { width: SW } = Dimensions.get('window');
const GRID = 4;
const CELL_GAP = 8;
const BOARD_PADDING = 16;
const CELL_SIZE = (SW - BOARD_PADDING * 2 - CELL_GAP * (GRID + 1)) / GRID;

type Phase = 'playing' | 'over';

// Tile colors by value (powers of 2)
function tileColor(val: number): string {
  if (val === 0) return '#1a1a2e';
  const colors: Record<number, string> = {
    2: '#2d2d5e', 4: '#3d3d7a', 8: '#ff6b35', 16: '#ff4757',
    32: '#ffa502', 64: '#ff6348', 128: '#ffd700', 256: '#2ed573',
    512: '#1e90ff', 1024: '#a29bfe', 2048: '#ff00ff',
  };
  return colors[val] ?? '#ff00ff';
}

function initGrid(): number[] {
  const g = Array(GRID * GRID).fill(0);
  return spawnTile(spawnTile(g));
}

function emptyIndices(g: number[]): number[] {
  return g.reduce<number[]>((acc, v, i) => { if (v === 0) acc.push(i); return acc; }, []);
}

function spawnTile(g: number[]): number[] {
  const empties = emptyIndices(g);
  if (empties.length === 0) return g;
  const idx = empties[Math.floor(Math.random() * empties.length)];
  const next = [...g];
  next[idx] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]): { result: number[]; score: number } {
  const vals = row.filter((v) => v !== 0);
  let score = 0;
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i] === vals[i + 1]) {
      vals[i] *= 2;
      score += vals[i];
      vals.splice(i + 1, 1);
    }
  }
  while (vals.length < GRID) vals.push(0);
  return { result: vals, score };
}

function moveGrid(
  g: number[],
  dir: 'left' | 'right' | 'up' | 'down',
): { grid: number[]; score: number; moved: boolean } {
  const rows: number[][] = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => g[r * GRID + c]),
  );

  let totalScore = 0;
  let moved = false;

  const processRows = (lines: number[][]): number[][] =>
    lines.map((line) => {
      const { result, score } = slideRow(line);
      if (score > 0 || result.some((v, i) => v !== line[i])) moved = true;
      totalScore += score;
      return result;
    });

  let processed: number[][];
  if (dir === 'left') {
    processed = processRows(rows);
  } else if (dir === 'right') {
    processed = processRows(rows.map((r) => [...r].reverse())).map((r) => [...r].reverse());
  } else if (dir === 'up') {
    const cols = Array.from({ length: GRID }, (_, c) => rows.map((r) => r[c]));
    const slid = processRows(cols);
    processed = rows.map((_, r) => slid.map((col) => col[r]));
  } else {
    const cols = Array.from({ length: GRID }, (_, c) => rows.map((r) => r[c]).reverse());
    const slid = processRows(cols);
    processed = rows.map((_, r) => slid.map((col) => [...col].reverse()[r]));
  }

  const grid = processed.flat();
  return { grid, score: totalScore, moved };
}

function hasValidMove(g: number[]): boolean {
  if (emptyIndices(g).length > 0) return true;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = g[r * GRID + c];
      if (c < GRID - 1 && g[r * GRID + c + 1] === v) return true;
      if (r < GRID - 1 && g[(r + 1) * GRID + c] === v) return true;
    }
  }
  return false;
}

// 16 individual SharedValues for merge pop animations
function useCellScales() {
  const c0 = useSharedValue(1); const c1 = useSharedValue(1);
  const c2 = useSharedValue(1); const c3 = useSharedValue(1);
  const c4 = useSharedValue(1); const c5 = useSharedValue(1);
  const c6 = useSharedValue(1); const c7 = useSharedValue(1);
  const c8 = useSharedValue(1); const c9 = useSharedValue(1);
  const c10 = useSharedValue(1); const c11 = useSharedValue(1);
  const c12 = useSharedValue(1); const c13 = useSharedValue(1);
  const c14 = useSharedValue(1); const c15 = useSharedValue(1);
  return useMemo(
    () => [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15],
    [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15],
  );
}

function CellView({ value, scale }: { value: number; scale: ReturnType<typeof useSharedValue> }) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.cell, { backgroundColor: tileColor(value) }, animStyle]}>
      {value > 0 && (
        <Text style={[styles.cellText, { fontSize: value >= 1000 ? 20 : value >= 100 ? 24 : 28 }]}>
          {value}
        </Text>
      )}
    </Animated.View>
  );
}

export default function TileShift() {
  const [phase, setPhase] = useState<Phase>('playing');
  const [grid, setGrid] = useState<number[]>(initGrid);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [bestTile, setBestTile] = useState(0);

  const scoreRef = React.useRef(0);
  const gridRef = React.useRef(grid);
  const cellScales = useCellScales();

  useEffect(() => { gridRef.current = grid; }, [grid]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v) setHighScore(parseInt(v, 10)); });
  }, []);

  const saveHighScore = useCallback(async (s: number) => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (s > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, s.toString());
      setHighScore(s);
    }
  }, []);

  const doMove = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      if (phase !== 'playing') return;
      const { grid: newGrid, score: gained, moved } = moveGrid(gridRef.current, dir);
      if (!moved) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const withNew = spawnTile(newGrid);
      gridRef.current = withNew;
      setGrid(withNew);

      // Pop animation on merged cells
      withNew.forEach((v, i) => {
        if (v > 0 && v !== gridRef.current[i]) {
          cellScales[i].value = withSequence(
            withTiming(1.2, { duration: 80 }),
            withTiming(1.0, { duration: 100 }),
          );
        }
      });

      scoreRef.current += gained;
      setScore(scoreRef.current);
      setBestTile(Math.max(...withNew));
      saveHighScore(scoreRef.current);

      if (!hasValidMove(withNew)) {
        setPhase('over');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [phase, cellScales, saveHighScore],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(20)
        .onEnd((e) => {
          if (phase !== 'playing') return;
          const { translationX: dx, translationY: dy } = e;
          if (Math.abs(dx) > Math.abs(dy)) {
            doMove(dx > 0 ? 'right' : 'left');
          } else {
            doMove(dy > 0 ? 'down' : 'up');
          }
        }),
    [phase, doMove],
  );

  const restart = useCallback(() => {
    scoreRef.current = 0;
    const fresh = initGrid();
    gridRef.current = fresh;
    setGrid(fresh);
    setScore(0);
    setBestTile(0);
    setPhase('playing');
  }, []);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* HUD */}
        <View style={styles.hud}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <Text style={styles.titleText}>2048</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{highScore}</Text>
          </View>
        </View>

        {bestTile >= 2048 && (
          <Text style={styles.winBanner}>🏆 2048!</Text>
        )}

        {/* Board */}
        <View style={styles.board}>
          {grid.map((val, i) => (
            <CellView key={i} value={val} scale={cellScales[i]} />
          ))}
        </View>

        <Text style={styles.hint}>Swipe to shift tiles • Match to merge</Text>

        {phase === 'over' && (
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.restartText} onPress={restart}>Tap to Restart</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1000', alignItems: 'center' },
  hud: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingHorizontal: 20, paddingTop: 64, paddingBottom: 12,
    paddingLeft: 72,
  },
  scoreBox: { alignItems: 'center', backgroundColor: '#2a1f00', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  scoreLabel: { color: '#ffd70099', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  scoreValue: { color: '#ffd700', fontSize: 20, fontWeight: 'bold' },
  titleText: { color: '#ffd700', fontSize: 32, fontWeight: 'bold' },
  winBanner: { color: '#ffd700', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  board: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: SW - BOARD_PADDING * 2,
    backgroundColor: '#2a1f00',
    borderRadius: 12, padding: CELL_GAP, gap: CELL_GAP,
    marginTop: 16,
  },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  cellText: { color: '#ffffff', fontWeight: 'bold' },
  hint: { color: '#ffffff30', fontSize: 13, marginTop: 20 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#1a1000ee',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  gameOverText: { color: '#ffd700', fontSize: 36, fontWeight: 'bold', letterSpacing: 3 },
  finalScoreText: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginTop: 16 },
  bestDisplay: { color: '#ffd70080', fontSize: 20, marginTop: 8 },
  restartText: { color: '#ffffff90', fontSize: 18, marginTop: 28 },
});
