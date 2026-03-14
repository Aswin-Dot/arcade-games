import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const STORAGE_KEY = '@slice-frenzy/highscore';
const { width: SW, height: SH } = Dimensions.get('window');
const PLAY_TOP = 100;
const PLAY_HEIGHT = SH - PLAY_TOP - 60;
const NUM_SHAPES = 8;
const SHAPE_R = 36;
const GRAVITY = 700; // px/s²
const SPAWN_INTERVAL_MS = 1400;
const BOMB_CHANCE = 0.15;

const SHAPES = ['●', '■', '▲', '◆', '★'];
const SHAPE_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#a29bfe', '#ff6b81'];

type Phase = 'idle' | 'playing' | 'over';

interface ShapeData {
  emoji: string;
  color: string;
  isBomb: boolean;
  vx: number; // px/s
  vy: number; // px/s
}

export default function SliceFrenzy() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [shapes, setShapes] = useState<ShapeData[]>(
    Array.from({ length: NUM_SHAPES }, () => ({
      emoji: '●', color: '#ff4757', isBomb: false, vx: 0, vy: 0,
    })),
  );

  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const shapesRef = useRef<ShapeData[]>(shapes);
  const spawnTimerRef = useRef(0);
  // Swipe tracking
  const swipeActiveRef = useRef(false);
  const swipePrevRef = useRef({ x: 0, y: 0 });

  // Individual named SharedValues
  const px0 = useSharedValue(-200); const px1 = useSharedValue(-200);
  const px2 = useSharedValue(-200); const px3 = useSharedValue(-200);
  const px4 = useSharedValue(-200); const px5 = useSharedValue(-200);
  const px6 = useSharedValue(-200); const px7 = useSharedValue(-200);
  const py0 = useSharedValue(-200); const py1 = useSharedValue(-200);
  const py2 = useSharedValue(-200); const py3 = useSharedValue(-200);
  const py4 = useSharedValue(-200); const py5 = useSharedValue(-200);
  const py6 = useSharedValue(-200); const py7 = useSharedValue(-200);
  const vis0 = useSharedValue(0); const vis1 = useSharedValue(0);
  const vis2 = useSharedValue(0); const vis3 = useSharedValue(0);
  const vis4 = useSharedValue(0); const vis5 = useSharedValue(0);
  const vis6 = useSharedValue(0); const vis7 = useSharedValue(0);

  const pxs = useMemo(() => [px0, px1, px2, px3, px4, px5, px6, px7], [px0, px1, px2, px3, px4, px5, px6, px7]);
  const pys = useMemo(() => [py0, py1, py2, py3, py4, py5, py6, py7], [py0, py1, py2, py3, py4, py5, py6, py7]);
  const viss = useMemo(() => [vis0, vis1, vis2, vis3, vis4, vis5, vis6, vis7], [vis0, vis1, vis2, vis3, vis4, vis5, vis6, vis7]);

  const s0 = useAnimatedStyle(() => ({ transform: [{ translateX: px0.value - SHAPE_R }, { translateY: py0.value - SHAPE_R }], opacity: vis0.value }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateX: px1.value - SHAPE_R }, { translateY: py1.value - SHAPE_R }], opacity: vis1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateX: px2.value - SHAPE_R }, { translateY: py2.value - SHAPE_R }], opacity: vis2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateX: px3.value - SHAPE_R }, { translateY: py3.value - SHAPE_R }], opacity: vis3.value }));
  const s4 = useAnimatedStyle(() => ({ transform: [{ translateX: px4.value - SHAPE_R }, { translateY: py4.value - SHAPE_R }], opacity: vis4.value }));
  const s5 = useAnimatedStyle(() => ({ transform: [{ translateX: px5.value - SHAPE_R }, { translateY: py5.value - SHAPE_R }], opacity: vis5.value }));
  const s6 = useAnimatedStyle(() => ({ transform: [{ translateX: px6.value - SHAPE_R }, { translateY: py6.value - SHAPE_R }], opacity: vis6.value }));
  const s7 = useAnimatedStyle(() => ({ transform: [{ translateX: px7.value - SHAPE_R }, { translateY: py7.value - SHAPE_R }], opacity: vis7.value }));
  const animStyles = useMemo(() => [s0, s1, s2, s3, s4, s5, s6, s7], [s0, s1, s2, s3, s4, s5, s6, s7]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v) setHighScore(parseInt(v, 10)); });
  }, []);

  const triggerGameOver = useCallback(async () => {
    phaseRef.current = 'over';
    setPhase('over');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const s = scoreRef.current;
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (s > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, s.toString());
      setHighScore(s);
    }
  }, []);

  const spawnShape = useCallback(() => {
    const freeIdx = Array.from({ length: NUM_SHAPES }, (_, i) => i).find(
      (i) => viss[i].value < 0.5,
    );
    if (freeIdx === undefined) return;

    const isBomb = Math.random() < BOMB_CHANCE;
    const emoji = isBomb ? '💣' : SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = isBomb ? '#ffffff' : SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];
    const x = SHAPE_R + Math.random() * (SW - SHAPE_R * 2);
    const vy = -(500 + Math.random() * 300); // upward
    const vx = (Math.random() - 0.5) * 200;

    const newShapes = [...shapesRef.current];
    newShapes[freeIdx] = { emoji, color, isBomb, vx, vy };
    shapesRef.current = newShapes;
    setShapes([...newShapes]);

    pxs[freeIdx].value = x;
    pys[freeIdx].value = PLAY_HEIGHT + SHAPE_R;
    viss[freeIdx].value = 1;
  }, [pxs, pys, viss]);

  const checkSlice = useCallback(
    (sx: number, sy: number, ex: number, ey: number) => {
      for (let i = 0; i < NUM_SHAPES; i++) {
        if (viss[i].value < 0.5) continue;
        const cx = pxs[i].value;
        const cy = pys[i].value;

        // Check if line segment passes within SHAPE_R of center
        const dx = ex - sx; const dy = ey - sy;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue;
        const t = Math.max(0, Math.min(1, ((cx - sx) * dx + (cy - sy) * dy) / lenSq));
        const closestX = sx + t * dx;
        const closestY = sy + t * dy;
        const dist = Math.sqrt((cx - closestX) ** 2 + (cy - closestY) ** 2);
        if (dist > SHAPE_R) continue;

        viss[i].value = 0;

        if (shapesRef.current[i].isBomb) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) { triggerGameOver(); return; }
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }
      }
    },
    [pxs, pys, viss, triggerGameOver],
  );

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const dtSec = dt / 1000;

      spawnTimerRef.current += dt;
      const interval = Math.max(700, SPAWN_INTERVAL_MS - scoreRef.current * 3);
      if (spawnTimerRef.current >= interval) {
        spawnTimerRef.current = 0;
        spawnShape();
      }

      for (let i = 0; i < NUM_SHAPES; i++) {
        if (viss[i].value < 0.5) continue;
        const shape = shapesRef.current[i];
        const newVy = shape.vy + GRAVITY * dtSec;
        const newPy = pys[i].value + newVy * dtSec;
        const newPx = pxs[i].value + shape.vx * dtSec;

        // Update velocity in ref
        const newShapes = [...shapesRef.current];
        newShapes[i] = { ...newShapes[i], vy: newVy };
        shapesRef.current = newShapes;

        pxs[i].value = newPx;
        pys[i].value = newPy;

        // Fell off screen — lose life (only non-bombs)
        if (newPy > PLAY_HEIGHT + SHAPE_R * 2) {
          viss[i].value = 0;
          if (!shapesRef.current[i].isBomb) {
            livesRef.current -= 1;
            setLives(livesRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (livesRef.current <= 0) { triggerGameOver(); return; }
          }
        }
      }
    },
    [pxs, pys, viss, spawnShape, triggerGameOver],
  );

  useGameLoop(tick, phase === 'playing');

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    spawnTimerRef.current = 0;
    setScore(0);
    setLives(3);
    for (let i = 0; i < NUM_SHAPES; i++) {
      viss[i].value = 0;
      pxs[i].value = -200;
      pys[i].value = -200;
    }
    const empty: ShapeData[] = Array.from({ length: NUM_SHAPES }, () => ({
      emoji: '●', color: '#ff4757', isBomb: false, vx: 0, vy: 0,
    }));
    shapesRef.current = empty;
    setShapes(empty);
    phaseRef.current = 'playing';
    setPhase('playing');
  }, [pxs, pys, viss]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(5)
        .onBegin((e) => {
          if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
            startGame();
            return;
          }
          swipeActiveRef.current = true;
          swipePrevRef.current = { x: e.x, y: e.y - PLAY_TOP };
        })
        .onUpdate((e) => {
          if (phaseRef.current !== 'playing' || !swipeActiveRef.current) return;
          const curr = { x: e.x, y: e.y - PLAY_TOP };
          checkSlice(swipePrevRef.current.x, swipePrevRef.current.y, curr.x, curr.y);
          swipePrevRef.current = curr;
        })
        .onEnd(() => { swipeActiveRef.current = false; })
        .onFinalize(() => { swipeActiveRef.current = false; }),
    [checkSlice, startGame],
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <View style={styles.hud}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <View style={styles.livesRow}>
            {Array.from({ length: 3 }, (_, i) => (
              <Text key={i} style={[styles.heart, { opacity: i < lives ? 1 : 0.2 }]}>♥</Text>
            ))}
          </View>
          <Text style={styles.highScoreText}>Best: {highScore}</Text>
        </View>

        <View style={styles.playArea}>
          {shapes.map((shape, i) => (
            <Animated.View key={`shape-${i}`} style={[styles.shape, animStyles[i]]}>
              <Text style={[styles.shapeText, { color: shape.color }]}>{shape.emoji}</Text>
            </Animated.View>
          ))}
        </View>

        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.titleText}>SLICE FRENZY</Text>
            <Text style={styles.subtitleText}>Swipe to Start</Text>
            <Text style={styles.hintText}>Swipe through shapes to slice them{'\n'}Avoid the 💣 bombs!</Text>
          </View>
        )}

        {phase === 'over' && (
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.subtitleText}>Swipe to Restart</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  hud: {
    position: 'absolute', top: 60, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingLeft: 72, paddingRight: 20, zIndex: 10,
  },
  scoreText: { color: '#ff4757', fontSize: 20, fontWeight: 'bold' },
  livesRow: { flexDirection: 'row', gap: 4 },
  heart: { color: '#ff4757', fontSize: 20 },
  highScoreText: { color: '#ffffff80', fontSize: 14 },
  playArea: {
    position: 'absolute', top: PLAY_TOP, left: 0, right: 0,
    height: PLAY_HEIGHT, overflow: 'hidden',
  },
  shape: { position: 'absolute', width: SHAPE_R * 2, height: SHAPE_R * 2, justifyContent: 'center', alignItems: 'center' },
  shapeText: { fontSize: 40 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#0d0d0ddd',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  titleText: { color: '#ff4757', fontSize: 34, fontWeight: 'bold', letterSpacing: 3, marginBottom: 20 },
  subtitleText: { color: '#ffffff90', fontSize: 18, marginTop: 20 },
  hintText: { color: '#ffffff50', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 22 },
  gameOverText: { color: '#ff4757', fontSize: 36, fontWeight: 'bold', letterSpacing: 3 },
  finalScoreText: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginTop: 16 },
  bestDisplay: { color: '#ff475780', fontSize: 20, marginTop: 8 },
});
