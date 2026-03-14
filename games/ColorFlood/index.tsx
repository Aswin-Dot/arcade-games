import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@color-flood/highscore';
const { width: SW } = Dimensions.get('window');
const GRID_SIZE = 8;
const MAX_MOVES = 25;
const CELL_GAP = 3;
const BOARD_PAD = 16;
const CELL_SIZE = (SW - BOARD_PAD * 2 - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE;

const COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#a29bfe'];
const COLOR_LABELS = ['RED', 'ORG', 'GRN', 'BLU', 'PRP'];

type Phase = 'playing' | 'won' | 'over';

function makeGrid(): number[] {
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, () =>
    Math.floor(Math.random() * COLORS.length),
  );
}

function floodFill(grid: number[], newColor: number): { grid: number[]; captured: number } {
  const start = grid[0];
  if (start === newColor) return { grid, captured: 0 };

  const next = [...grid];
  const visited = new Set<number>();
  const queue = [0];
  let captured = 0;

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    if (next[idx] !== start) continue;
    visited.add(idx);
    next[idx] = newColor;
    captured++;

    const row = Math.floor(idx / GRID_SIZE);
    const col = idx % GRID_SIZE;
    if (col > 0) queue.push(idx - 1);
    if (col < GRID_SIZE - 1) queue.push(idx + 1);
    if (row > 0) queue.push(idx - GRID_SIZE);
    if (row < GRID_SIZE - 1) queue.push(idx + GRID_SIZE);
  }

  // Also flood-fill the already-captured region (cells connected to origin with newColor)
  // Run a second pass to expand the newColor territory
  const captured2 = expandTerritory(next, newColor);
  return { grid: captured2, captured };
}

function expandTerritory(grid: number[], color: number): number[] {
  const next = [...grid];
  const visited = new Set<number>();
  const queue = [0];

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    if (next[idx] !== color) continue;
    visited.add(idx);

    const row = Math.floor(idx / GRID_SIZE);
    const col = idx % GRID_SIZE;
    const neighbors = [];
    if (col > 0) neighbors.push(idx - 1);
    if (col < GRID_SIZE - 1) neighbors.push(idx + 1);
    if (row > 0) neighbors.push(idx - GRID_SIZE);
    if (row < GRID_SIZE - 1) neighbors.push(idx + GRID_SIZE);

    for (const n of neighbors) {
      if (!visited.has(n)) {
        if (next[n] === color) {
          queue.push(n);
        }
      }
    }
  }

  return next;
}

function countOwned(grid: number[]): number {
  const color = grid[0];
  const visited = new Set<number>();
  const queue = [0];
  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    if (grid[idx] !== color) continue;
    visited.add(idx);
    const row = Math.floor(idx / GRID_SIZE);
    const col = idx % GRID_SIZE;
    if (col > 0) queue.push(idx - 1);
    if (col < GRID_SIZE - 1) queue.push(idx + 1);
    if (row > 0) queue.push(idx - GRID_SIZE);
    if (row < GRID_SIZE - 1) queue.push(idx + GRID_SIZE);
  }
  return visited.size;
}

export default function ColorFlood() {
  const [phase, setPhase] = useState<Phase>('playing');
  const [grid, setGrid] = useState<number[]>(makeGrid);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [owned, setOwned] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v) setHighScore(parseInt(v, 10)); });
  }, []);

  useEffect(() => {
    setOwned(countOwned(grid));
  }, [grid]);

  const handleColorTap = useCallback(
    async (colorIdx: number) => {
      if (phase !== 'playing') return;
      if (grid[0] === colorIdx) return; // Same color, skip

      const { grid: newGrid } = floodFill(grid, colorIdx);
      const newMoves = moves + 1;
      const newOwned = countOwned(newGrid);
      const total = GRID_SIZE * GRID_SIZE;

      setGrid(newGrid);
      setMoves(newMoves);
      setOwned(newOwned);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (newOwned === total) {
        // Won
        const finalScore = (MAX_MOVES - newMoves + 1) * 100;
        setScore(finalScore);
        setPhase('won');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const prev = stored ? parseInt(stored, 10) : 0;
        if (finalScore > prev) {
          await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
          setHighScore(finalScore);
        }
      } else if (newMoves >= MAX_MOVES) {
        // Out of moves
        const finalScore = Math.floor((newOwned / total) * 500);
        setScore(finalScore);
        setPhase('over');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const prev = stored ? parseInt(stored, 10) : 0;
        if (finalScore > prev) {
          await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
          setHighScore(finalScore);
        }
      }
    },
    [phase, grid, moves],
  );

  const restart = useCallback(() => {
    const fresh = makeGrid();
    setGrid(fresh);
    setMoves(0);
    setScore(0);
    setOwned(countOwned(fresh));
    setPhase('playing');
  }, []);

  const total = GRID_SIZE * GRID_SIZE;
  const progressPct = Math.round((owned / total) * 100);

  return (
    <View style={styles.container}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.movesText}>Moves: {moves}/{MAX_MOVES}</Text>
        <Text style={styles.progressText}>{progressPct}% captured</Text>
        <Text style={styles.highScoreText}>Best: {highScore}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
      </View>

      {/* Board */}
      <View style={styles.board}>
        {grid.map((colorIdx, i) => (
          <View
            key={i}
            style={[styles.cell, { backgroundColor: COLORS[colorIdx] }]}
          />
        ))}
      </View>

      {/* Color picker */}
      <View style={styles.colorPicker}>
        {COLORS.map((color, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.colorBtn,
              { backgroundColor: color },
              grid[0] === i && styles.colorBtnActive,
            ]}
            onPress={() => handleColorTap(i)}
            activeOpacity={0.7}
          >
            <Text style={styles.colorBtnLabel}>{COLOR_LABELS[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>Flood-fill the grid with one color</Text>

      {phase === 'won' && (
        <TouchableWithoutFeedback onPress={restart}>
          <View style={styles.overlay}>
            <Text style={styles.wonText}>YOU WIN! 🎉</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.movesUsedText}>Cleared in {moves} moves</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.restartText}>Tap to Play Again</Text>
          </View>
        </TouchableWithoutFeedback>
      )}

      {phase === 'over' && (
        <TouchableWithoutFeedback onPress={restart}>
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>OUT OF MOVES</Text>
            <Text style={styles.capturedText}>{progressPct}% captured</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.restartText}>Tap to Retry</Text>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0a1a', alignItems: 'center' },
  hud: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingHorizontal: 20, paddingTop: 64, paddingBottom: 8,
    paddingLeft: 72,
  },
  movesText: { color: '#a855f7', fontSize: 16, fontWeight: 'bold' },
  progressText: { color: '#ffffff', fontSize: 14 },
  highScoreText: { color: '#ffffff80', fontSize: 14 },
  progressBar: {
    width: SW - 32, height: 6, backgroundColor: '#2a1f3d',
    borderRadius: 3, marginBottom: 12, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#a855f7', borderRadius: 3 },
  board: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: SW - BOARD_PAD * 2, gap: CELL_GAP,
    marginBottom: 24,
  },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3 },
  colorPicker: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  colorBtn: {
    flex: 1, height: 48, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorBtnActive: { borderColor: '#ffffff', transform: [{ scale: 1.1 }] },
  colorBtnLabel: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  hint: { color: '#ffffff25', fontSize: 12, marginTop: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#0d0a1aee',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  wonText: { color: '#a855f7', fontSize: 34, fontWeight: 'bold', letterSpacing: 2 },
  gameOverText: { color: '#ff4757', fontSize: 30, fontWeight: 'bold', letterSpacing: 2 },
  capturedText: { color: '#ffffff80', fontSize: 20, marginTop: 8 },
  finalScoreText: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  movesUsedText: { color: '#ffffff80', fontSize: 16, marginTop: 6 },
  bestDisplay: { color: '#a855f780', fontSize: 18, marginTop: 6 },
  restartText: { color: '#ffffff90', fontSize: 18, marginTop: 24 },
});
