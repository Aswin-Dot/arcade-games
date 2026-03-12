import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_CIRCLES = 8;
const CIRCLE_MAX_SIZE = 80;
const PLAY_AREA_TOP = 140;
const PLAY_AREA_BOTTOM = SCREEN_HEIGHT - 60;
const PLAY_AREA_HEIGHT = PLAY_AREA_BOTTOM - PLAY_AREA_TOP;
const STORAGE_KEY = '@circle_shrink_high_score';

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];

type GamePhase = 'idle' | 'playing' | 'over';

interface CircleData {
  x: number;
  y: number;
  active: boolean;
  progress: number; // 0 to 1 (1 = fully shrunk)
  colorIdx: number;
  shrinkSpeed: number; // progress per ms
}

export default function CircleShrink() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const spawnTimerRef = useRef(0);
  const circlesRef = useRef<CircleData[]>(
    Array.from({ length: MAX_CIRCLES }, (): CircleData => ({
      x: 0,
      y: 0,
      active: false,
      progress: 0,
      colorIdx: 0,
      shrinkSpeed: 0.0004,
    }))
  );

  const circleScales = Array.from({ length: MAX_CIRCLES }, () => useSharedValue(0));
  const circleOpacities = Array.from({ length: MAX_CIRCLES }, () => useSharedValue(0));
  const ringScales = Array.from({ length: MAX_CIRCLES }, () => useSharedValue(1.3));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const updateScore = useCallback((s: number) => setScore(s), []);
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

  const loseLife = useCallback(() => {
    livesRef.current -= 1;
    updateLives(livesRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (livesRef.current <= 0) {
      triggerGameOver();
    }
  }, [triggerGameOver, updateLives]);

  const spawnCircle = useCallback(() => {
    const circles = circlesRef.current;
    const idx = circles.findIndex((c) => !c.active);
    if (idx === -1) return;

    const padding = CIRCLE_MAX_SIZE / 2 + 10;
    const x = padding + Math.random() * (SCREEN_WIDTH - padding * 2);
    const y = padding + Math.random() * (PLAY_AREA_HEIGHT - padding * 2);
    const colorIdx = Math.floor(Math.random() * COLORS.length);
    const baseShrinkSpeed = 0.0004 + scoreRef.current * 0.000005;

    circles[idx] = {
      x,
      y,
      active: true,
      progress: 0,
      colorIdx,
      shrinkSpeed: baseShrinkSpeed,
    };
    circleScales[idx].value = 1;
    circleOpacities[idx].value = 1;
    ringScales[idx].value = 1.4;
  }, []);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (phaseRef.current !== 'playing') return;
    const dt = timeSincePreviousFrame ?? 16;

    // Spawn timer
    spawnTimerRef.current += dt;
    const spawnInterval = Math.max(400, 1200 - scoreRef.current * 8);
    if (spawnTimerRef.current >= spawnInterval) {
      spawnTimerRef.current = 0;
      runOnJS(spawnCircle)();
    }

    // Update circles
    const circles = circlesRef.current;
    for (let i = 0; i < MAX_CIRCLES; i++) {
      if (!circles[i].active) continue;

      circles[i].progress += circles[i].shrinkSpeed * dt;
      const scale = Math.max(0, 1 - circles[i].progress);
      circleScales[i].value = scale;
      ringScales[i].value = 1.4 - circles[i].progress * 0.6;

      if (circles[i].progress >= 1) {
        circles[i].active = false;
        circleOpacities[i].value = 0;
        runOnJS(loseLife)();
      }
    }
  });

  const handleCircleTap = useCallback(
    (idx: number) => {
      if (phaseRef.current !== 'playing') return;
      const circle = circlesRef.current[idx];
      if (!circle.active) return;

      circle.active = false;
      circleOpacities[idx].value = 0;

      // Score based on how small the circle was
      const bonus = Math.floor(circle.progress * 40);
      const points = 10 + bonus;
      scoreRef.current += points;
      updateScore(scoreRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [updateScore]
  );

  const startGame = useCallback(() => {
    phaseRef.current = 'playing';
    setPhase('playing');
    scoreRef.current = 0;
    setScore(0);
    livesRef.current = 3;
    setLives(3);
    spawnTimerRef.current = 0;
    circlesRef.current.forEach((c, i) => {
      c.active = false;
      circleOpacities[i].value = 0;
    });
  }, []);

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
        <View style={styles.livesContainer}>
          {Array.from({ length: 3 }, (_, i) => (
            <View
              key={i}
              style={[styles.heart, { opacity: i < lives ? 1 : 0.2 }]}
            >
              <Text style={styles.heartText}>{'♥'}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.highScoreText}>Best: {highScore}</Text>
      </View>

      {/* Play area */}
      <View style={styles.playArea}>
        {circlesRef.current.map((circle, i) => {
          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: circleScales[i].value }],
            opacity: circleOpacities[i].value,
          }));

          const ringStyle = useAnimatedStyle(() => ({
            transform: [{ scale: ringScales[i].value }],
            opacity: circleOpacities[i].value * 0.4,
          }));

          return (
            <Pressable
              key={`circle-${i}`}
              onPress={() => handleCircleTap(i)}
              style={[
                styles.circleHitArea,
                {
                  left: circle.x - CIRCLE_MAX_SIZE / 2,
                  top: circle.y - CIRCLE_MAX_SIZE / 2,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.ring,
                  ringStyle,
                  { borderColor: COLORS[circle.colorIdx] },
                ]}
              />
              <Animated.View
                style={[
                  styles.circle,
                  animatedStyle,
                  { backgroundColor: COLORS[circle.colorIdx] },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Overlays */}
      {phase === 'idle' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>CIRCLE SHRINK</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap circles before they vanish</Text>
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
    backgroundColor: '#0f0f23',
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  scoreText: {
    color: '#4ecdc4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  livesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  heart: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartText: {
    color: '#ff6b6b',
    fontSize: 20,
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  playArea: {
    position: 'absolute',
    top: PLAY_AREA_TOP,
    left: 0,
    width: SCREEN_WIDTH,
    height: PLAY_AREA_HEIGHT,
  },
  circleHitArea: {
    position: 'absolute',
    width: CIRCLE_MAX_SIZE,
    height: CIRCLE_MAX_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: CIRCLE_MAX_SIZE * 0.7,
    height: CIRCLE_MAX_SIZE * 0.7,
    borderRadius: CIRCLE_MAX_SIZE * 0.35,
  },
  ring: {
    position: 'absolute',
    width: CIRCLE_MAX_SIZE,
    height: CIRCLE_MAX_SIZE,
    borderRadius: CIRCLE_MAX_SIZE / 2,
    borderWidth: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f23dd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#4ecdc4',
    fontSize: 34,
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
  },
  gameOverText: {
    color: '#ff6b6b',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#4ecdc4',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#feca57',
    fontSize: 20,
    marginTop: 8,
  },
});
