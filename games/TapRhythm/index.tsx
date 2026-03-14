import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const STORAGE_KEY = '@tap-rhythm/highscore';
const BPM = 90;
const BEAT_INTERVAL = 60000 / BPM; // ms per beat
const PERFECT_WINDOW = 120; // ±ms
const GOOD_WINDOW = 250; // ±ms
const MISS_WINDOW = 400; // ms after beat = miss

type GamePhase = 'idle' | 'playing' | 'over';
type TapResult = 'perfect' | 'good' | 'miss' | null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = 200;

export default function TapRhythm() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [tapResult, setTapResult] = useState<TapResult>(null);
  const [combo, setCombo] = useState(0);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const beatTimerRef = useRef(0); // ms since last beat
  const beatTappedRef = useRef(false); // whether current beat was tapped
  const resultTimerRef = useRef(0); // ms to show result label

  const pulseScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.3);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: ringOpacity.value,
  }));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const triggerBeat = useCallback(() => {
    pulseScale.value = withSequence(
      withTiming(1.25, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1.0, { duration: 180, easing: Easing.in(Easing.quad) }),
    );
    ringOpacity.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0.3, { duration: 300 }),
    );
  }, [pulseScale, ringOpacity]);

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

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;

      beatTimerRef.current += dt;

      // Show/hide result label
      if (resultTimerRef.current > 0) {
        resultTimerRef.current -= dt;
        if (resultTimerRef.current <= 0) {
          setTapResult(null);
        }
      }

      // Beat fires
      if (beatTimerRef.current >= BEAT_INTERVAL) {
        // Check if last beat was missed
        if (!beatTappedRef.current) {
          livesRef.current -= 1;
          setLives(livesRef.current);
          comboRef.current = 0;
          setCombo(0);
          setTapResult('miss');
          resultTimerRef.current = 600;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (livesRef.current <= 0) {
            triggerGameOver();
            return;
          }
        }

        beatTimerRef.current -= BEAT_INTERVAL;
        beatTappedRef.current = false;
        triggerBeat();
      }
    },
    [triggerBeat, triggerGameOver],
  );

  useGameLoop(tick, phase === 'playing');

  const handleTap = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
      // Start / restart
      scoreRef.current = 0;
      livesRef.current = 3;
      comboRef.current = 0;
      beatTimerRef.current = 0;
      beatTappedRef.current = false;
      resultTimerRef.current = 0;
      setScore(0);
      setLives(3);
      setCombo(0);
      setTapResult(null);
      pulseScale.value = 1;
      ringOpacity.value = 0.3;
      phaseRef.current = 'playing';
      setPhase('playing');
      return;
    }

    if (phaseRef.current !== 'playing') return;

    if (beatTappedRef.current) return; // already tapped this beat

    const offset = beatTimerRef.current; // time since last beat
    // Also check if we're anticipating next beat
    const timeToNext = BEAT_INTERVAL - offset;
    const distance = Math.min(offset, timeToNext);

    let result: TapResult = null;
    let points = 0;

    if (distance <= PERFECT_WINDOW) {
      result = 'perfect';
      comboRef.current += 1;
      points = 100 + comboRef.current * 10;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (distance <= GOOD_WINDOW) {
      result = 'good';
      comboRef.current += 1;
      points = 50 + comboRef.current * 5;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (offset <= MISS_WINDOW) {
      // Too early — counts as miss for this beat
      result = 'miss';
      livesRef.current -= 1;
      setLives(livesRef.current);
      comboRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (livesRef.current <= 0) {
        setTapResult(result);
        triggerGameOver();
        return;
      }
    } else {
      // Tapping very late — give GOOD grace
      result = 'good';
      comboRef.current += 1;
      points = 30;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (points > 0) {
      scoreRef.current += points;
      setScore(scoreRef.current);
      beatTappedRef.current = true;
    }

    setCombo(comboRef.current);
    setTapResult(result);
    resultTimerRef.current = 500;

    // Visual feedback
    pulseScale.value = withSequence(
      withTiming(0.85, { duration: 60 }),
      withTiming(1.0, { duration: 120 }),
    );
  }, [pulseScale, ringOpacity, triggerGameOver]);

  const resultColor =
    tapResult === 'perfect' ? '#ffd700' : tapResult === 'good' ? '#44dd66' : '#ff4444';

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
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
          <Text style={styles.comboText}>
            {combo >= 3 ? `x${combo} COMBO` : ''}
          </Text>
        )}

        {/* Beat circle */}
        <View style={styles.beatArea}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.beatCircle} />
          {phase === 'playing' && tapResult && (
            <Text style={[styles.resultLabel, { color: resultColor }]}>
              {tapResult === 'perfect' ? 'PERFECT!' : tapResult === 'good' ? 'GOOD' : 'MISS'}
            </Text>
          )}
        </View>

        {/* BPM indicator */}
        {phase === 'playing' && (
          <Text style={styles.bpmText}>{BPM} BPM</Text>
        )}

        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.titleText}>TAP RHYTHM</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap in sync with the beat — stay on tempo</Text>
          </View>
        )}

        {phase === 'over' && (
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.subtitleText}>Tap to Restart</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d001a',
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
    paddingLeft: 72,
    zIndex: 10,
  },
  scoreText: {
    color: '#ff00ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  livesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  heart: {
    color: '#ff4444',
    fontSize: 20,
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  comboText: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffd700',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 10,
  },
  beatArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ff00ff',
  },
  beatCircle: {
    width: RING_SIZE * 0.6,
    height: RING_SIZE * 0.6,
    borderRadius: (RING_SIZE * 0.6) / 2,
    backgroundColor: '#2a0040',
    borderWidth: 2,
    borderColor: '#ff00ff80',
  },
  resultLabel: {
    position: 'absolute',
    top: RING_SIZE / 2 + 20,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  bpmText: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffffff30',
    fontSize: 12,
    letterSpacing: 3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d001add',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#ff00ff',
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 4,
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
    color: '#ff00ff',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#ff00ff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#ffffff80',
    fontSize: 20,
    marginTop: 8,
  },
});
