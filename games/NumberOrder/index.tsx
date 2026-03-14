import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = '@number-order/highscore';

const NUM_SLOTS = 8;
const BUBBLE_SIZE = 64;
const PLAY_TOP = 130;
const PLAY_BOTTOM = SCREEN_HEIGHT - 100;
const PLAY_HEIGHT = PLAY_BOTTOM - PLAY_TOP;
const SPEED_START = 60; // px/s

type GamePhase = 'idle' | 'playing' | 'over';

interface NumberItem {
  value: number;
  x: number;
}

export default function NumberOrder() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [nextToTap, setNextToTap] = useState(1);
  const [items, setItems] = useState<NumberItem[]>(
    Array.from({ length: NUM_SLOTS }, () => ({ value: 0, x: 0 })),
  );

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const nextToTapRef = useRef(1);
  const nextSpawnValueRef = useRef(1);
  const itemsRef = useRef<NumberItem[]>(
    Array.from({ length: NUM_SLOTS }, () => ({ value: 0, x: 0 })),
  );
  const spawnTimerRef = useRef(0);

  // Individual named SharedValues for y positions and visibility
  const y0 = useSharedValue(-BUBBLE_SIZE);
  const y1 = useSharedValue(-BUBBLE_SIZE);
  const y2 = useSharedValue(-BUBBLE_SIZE);
  const y3 = useSharedValue(-BUBBLE_SIZE);
  const y4 = useSharedValue(-BUBBLE_SIZE);
  const y5 = useSharedValue(-BUBBLE_SIZE);
  const y6 = useSharedValue(-BUBBLE_SIZE);
  const y7 = useSharedValue(-BUBBLE_SIZE);

  const vis0 = useSharedValue(0);
  const vis1 = useSharedValue(0);
  const vis2 = useSharedValue(0);
  const vis3 = useSharedValue(0);
  const vis4 = useSharedValue(0);
  const vis5 = useSharedValue(0);
  const vis6 = useSharedValue(0);
  const vis7 = useSharedValue(0);

  const ys = useMemo(() => [y0, y1, y2, y3, y4, y5, y6, y7], [y0, y1, y2, y3, y4, y5, y6, y7]);
  const viss = useMemo(() => [vis0, vis1, vis2, vis3, vis4, vis5, vis6, vis7], [vis0, vis1, vis2, vis3, vis4, vis5, vis6, vis7]);

  const s0 = useAnimatedStyle(() => ({ transform: [{ translateY: y0.value }], opacity: vis0.value }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value }], opacity: vis1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value }], opacity: vis2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value }], opacity: vis3.value }));
  const s4 = useAnimatedStyle(() => ({ transform: [{ translateY: y4.value }], opacity: vis4.value }));
  const s5 = useAnimatedStyle(() => ({ transform: [{ translateY: y5.value }], opacity: vis5.value }));
  const s6 = useAnimatedStyle(() => ({ transform: [{ translateY: y6.value }], opacity: vis6.value }));
  const s7 = useAnimatedStyle(() => ({ transform: [{ translateY: y7.value }], opacity: vis7.value }));
  const styles2 = useMemo(() => [s0, s1, s2, s3, s4, s5, s6, s7], [s0, s1, s2, s3, s4, s5, s6, s7]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const updateLives = useCallback((l: number) => setLives(l), []);

  const triggerGameOver = useCallback(async () => {
    phaseRef.current = 'over';
    setPhase('over');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const finalScore = scoreRef.current;
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (finalScore > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
      setHighScore(finalScore);
    }
  }, []);

  const spawnNumber = useCallback(() => {
    const freeIdx = Array.from({ length: NUM_SLOTS }, (_, i) => i).find(
      (i) => viss[i].value < 0.5,
    );
    if (freeIdx === undefined) return;

    const padding = BUBBLE_SIZE / 2 + 10;
    const x = padding + Math.random() * (SCREEN_WIDTH - padding * 2);
    const value = nextSpawnValueRef.current;
    nextSpawnValueRef.current = value + 1;

    const newItems = [...itemsRef.current];
    newItems[freeIdx] = { value, x };
    itemsRef.current = newItems;
    setItems([...newItems]);

    ys[freeIdx].value = -BUBBLE_SIZE;
    viss[freeIdx].value = 1;
  }, [ys, viss]);

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const dtSec = dt / 1000;
      const speed = SPEED_START + scoreRef.current * 1.5;

      // Spawn timer
      spawnTimerRef.current += dt;
      const spawnInterval = Math.max(600, 1800 - scoreRef.current * 15);
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0;
        spawnNumber();
      }

      // Move numbers down
      for (let i = 0; i < NUM_SLOTS; i++) {
        if (viss[i].value < 0.5) continue;
        ys[i].value += speed * dtSec;

        // Hit bottom = lose life
        if (ys[i].value >= PLAY_HEIGHT) {
          const fallenValue = itemsRef.current[i].value;
          viss[i].value = 0;
          ys[i].value = -BUBBLE_SIZE;

          // If the required next number fell off, advance past it to unblock the sequence
          if (fallenValue === nextToTapRef.current) {
            nextToTapRef.current += 1;
            setNextToTap(nextToTapRef.current);
          }

          livesRef.current -= 1;
          updateLives(livesRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (livesRef.current <= 0) {
            triggerGameOver();
          }
        }
      }
    },
    [ys, viss, spawnNumber, updateLives, triggerGameOver],
  );

  useGameLoop(tick, phase === 'playing');

  const handleBubbleTap = useCallback(
    (idx: number) => {
      if (phaseRef.current !== 'playing') return;
      if (viss[idx].value < 0.5) return;

      const tappedValue = itemsRef.current[idx].value;

      if (tappedValue === nextToTapRef.current) {
        // Correct
        viss[idx].value = 0;
        ys[idx].value = -BUBBLE_SIZE;
        nextToTapRef.current += 1;
        setNextToTap(nextToTapRef.current);
        scoreRef.current += 10;
        setScore(scoreRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Wrong
        livesRef.current -= 1;
        updateLives(livesRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (livesRef.current <= 0) {
          triggerGameOver();
        }
      }
    },
    [ys, viss, updateLives, triggerGameOver],
  );

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    nextToTapRef.current = 1;
    nextSpawnValueRef.current = 1;
    spawnTimerRef.current = 0;
    setScore(0);
    setLives(3);
    setNextToTap(1);

    for (let i = 0; i < NUM_SLOTS; i++) {
      viss[i].value = 0;
      ys[i].value = -BUBBLE_SIZE;
    }
    const emptyItems = Array.from({ length: NUM_SLOTS }, () => ({ value: 0, x: 0 }));
    itemsRef.current = emptyItems;
    setItems(emptyItems);

    phaseRef.current = 'playing';
    setPhase('playing');
  }, [ys, viss]);

  const handleScreenTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over') {
      startGame();
    }
  }, [phase, startGame]);

  return (
    <View style={styles.container}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <View style={styles.livesRow}>
          {Array.from({ length: 3 }, (_, i) => (
            <Text key={i} style={[styles.heart, { opacity: i < lives ? 1 : 0.2 }]}>♥</Text>
          ))}
        </View>
        <Text style={styles.highScoreText}>Best: {highScore}</Text>
      </View>

      {phase === 'playing' && (
        <Text style={styles.nextLabel}>Next: {nextToTap}</Text>
      )}

      {/* Play area */}
      <View style={styles.playArea} pointerEvents="box-none">
        {items.map((item, i) => (
          <Animated.View
            key={`num-${i}`}
            style={[styles.bubble, { left: item.x - BUBBLE_SIZE / 2 }, styles2[i]]}
          >
            <Pressable style={styles.bubbleInner} onPress={() => handleBubbleTap(i)}>
              <Text style={styles.bubbleText}>{item.value}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {phase === 'idle' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>NUMBER ORDER</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap numbers in order — 1, 2, 3...</Text>
          </View>
        </TouchableWithoutFeedback>
      )}

      {phase === 'over' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.subtitleText}>Tap to Restart</Text>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
    paddingLeft: 72,
    zIndex: 10,
  },
  scoreText: {
    color: '#60a5fa',
    fontSize: 20,
    fontWeight: 'bold',
  },
  livesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  heart: {
    color: '#f87171',
    fontSize: 20,
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  nextLabel: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 10,
  },
  playArea: {
    position: 'absolute',
    top: PLAY_TOP,
    left: 0,
    right: 0,
    height: PLAY_HEIGHT,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
  },
  bubbleInner: {
    flex: 1,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
    borderColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a1628dd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#60a5fa',
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 20,
  },
  subtitleText: {
    color: '#ffffff90',
    fontSize: 18,
    marginTop: 20,
  },
  hintText: {
    color: '#ffffff50',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  gameOverText: {
    color: '#f87171',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#60a5fa',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#f87171',
    fontSize: 20,
    marginTop: 8,
  },
});
