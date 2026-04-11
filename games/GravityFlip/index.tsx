import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showInterstitial, recordGameCompleted } from '@/shared/ads/AdManager';
import GameOverScreen from '@/shared/components/GameOverScreen';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = '@gravity-flip/highscore';

const PLAYER_SIZE = 28;
const PLAYER_X = SCREEN_WIDTH * 0.2;
const GRAVITY = 380; // px/s² — gentle pull
const FLIP_IMPULSE = 280; // px/s — soft push on flip
const MAX_VELOCITY = 340; // px/s — prevents runaway speed
const OBSTACLE_WIDTH = 28;
const GAP_HEIGHT = 240;
const OBS_COUNT = 4;
const PLAY_TOP = 100;
const PLAY_BOTTOM = SCREEN_HEIGHT - 60;
const PLAY_HEIGHT = PLAY_BOTTOM - PLAY_TOP;
const SPEED_START = 120; // px/s — obstacles scroll slowly at first
const GAP_HALF = GAP_HEIGHT / 2;
/** Minimum horizontal gap between consecutive obstacles */
const MIN_OBS_SPACING = SCREEN_WIDTH * 0.55;
/** Grace period — no obstacles for the first N seconds */
const GRACE_PERIOD_MS = 1500;

type GamePhase = 'idle' | 'playing' | 'over';

export default function GravityFlip() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gravityUp, setGravityUp] = useState(false);
  const [interstitialShown, setInterstitialShown] = useState(false);
  const hasContinuedRef = useRef(false);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const velocityRef = useRef(0);
  const gravityDirRef = useRef(1); // 1 = down, -1 = up
  const speedRef = useRef(SPEED_START);
  const invincibleRef = useRef(false);
  const elapsedRef = useRef(0);

  // Individual named SharedValues (rules of hooks compliance)
  const playerY = useSharedValue(PLAY_HEIGHT / 2);

  const obsX0 = useSharedValue(SCREEN_WIDTH + 20);
  const obsX1 = useSharedValue(SCREEN_WIDTH + 20);
  const obsX2 = useSharedValue(SCREEN_WIDTH + 20);
  const obsX3 = useSharedValue(SCREEN_WIDTH + 20);

  const obsVis0 = useSharedValue(0);
  const obsVis1 = useSharedValue(0);
  const obsVis2 = useSharedValue(0);
  const obsVis3 = useSharedValue(0);

  // Gap center as SharedValues — drives both rendering AND collision detection
  // so they are always in sync on the same thread
  const gc0 = useSharedValue(PLAY_HEIGHT / 2);
  const gc1 = useSharedValue(PLAY_HEIGHT / 2);
  const gc2 = useSharedValue(PLAY_HEIGHT / 2);
  const gc3 = useSharedValue(PLAY_HEIGHT / 2);

  const obsXs = useMemo(() => [obsX0, obsX1, obsX2, obsX3], [obsX0, obsX1, obsX2, obsX3]);
  const obsViss = useMemo(
    () => [obsVis0, obsVis1, obsVis2, obsVis3],
    [obsVis0, obsVis1, obsVis2, obsVis3],
  );
  const gcs = useMemo(() => [gc0, gc1, gc2, gc3], [gc0, gc1, gc2, gc3]);

  // Player animated style
  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: playerY.value - PLAYER_SIZE / 2 }],
  }));

  // Obstacle group translate + opacity
  const obsStyle0 = useAnimatedStyle(() => ({
    transform: [{ translateX: obsX0.value }],
    opacity: obsVis0.value,
  }));
  const obsStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateX: obsX1.value }],
    opacity: obsVis1.value,
  }));
  const obsStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateX: obsX2.value }],
    opacity: obsVis2.value,
  }));
  const obsStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateX: obsX3.value }],
    opacity: obsVis3.value,
  }));
  const obsStyles = useMemo(
    () => [obsStyle0, obsStyle1, obsStyle2, obsStyle3],
    [obsStyle0, obsStyle1, obsStyle2, obsStyle3],
  );

  // Top pillar heights — derived from gapCenter SharedValues
  const topH0 = useAnimatedStyle(() => ({ height: Math.max(0, gc0.value - GAP_HALF) }));
  const topH1 = useAnimatedStyle(() => ({ height: Math.max(0, gc1.value - GAP_HALF) }));
  const topH2 = useAnimatedStyle(() => ({ height: Math.max(0, gc2.value - GAP_HALF) }));
  const topH3 = useAnimatedStyle(() => ({ height: Math.max(0, gc3.value - GAP_HALF) }));
  const topHs = useMemo(() => [topH0, topH1, topH2, topH3], [topH0, topH1, topH2, topH3]);

  // Bottom pillar heights
  const botH0 = useAnimatedStyle(() => ({
    height: Math.max(0, PLAY_HEIGHT - gc0.value - GAP_HALF),
  }));
  const botH1 = useAnimatedStyle(() => ({
    height: Math.max(0, PLAY_HEIGHT - gc1.value - GAP_HALF),
  }));
  const botH2 = useAnimatedStyle(() => ({
    height: Math.max(0, PLAY_HEIGHT - gc2.value - GAP_HALF),
  }));
  const botH3 = useAnimatedStyle(() => ({
    height: Math.max(0, PLAY_HEIGHT - gc3.value - GAP_HALF),
  }));
  const botHs = useMemo(() => [botH0, botH1, botH2, botH3], [botH0, botH1, botH2, botH3]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const triggerGameOver = useCallback(async () => {
    phaseRef.current = 'over';
    setPhase('over');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    recordGameCompleted();
    const adShown = await showInterstitial();
    setInterstitialShown(adShown);
    const finalScore = Math.floor(scoreRef.current);
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (finalScore > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
      setHighScore(finalScore);
    }
  }, []);

  const spawnObstacle = useCallback(
    (idx: number, x: number) => {
      const margin = GAP_HEIGHT * 0.6;
      const gapCenter = margin + Math.random() * (PLAY_HEIGHT - margin * 2);
      // Set gapCenter SharedValue directly — rendering and collision both read this,
      // so they are guaranteed to be in sync with no React state lag
      gcs[idx].value = gapCenter;
      obsXs[idx].value = x;
      obsViss[idx].value = 1;
    },
    [gcs, obsXs, obsViss],
  );

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const dtSec = dt / 1000;
      elapsedRef.current += dt;

      // Physics
      const grav = gravityDirRef.current * GRAVITY;
      velocityRef.current += grav * dtSec;
      // Clamp velocity so the player can't fly uncontrollably
      velocityRef.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocityRef.current));
      const newY = playerY.value + velocityRef.current * dtSec;

      // Wall collision — bounce off with dampened velocity instead of instant death
      if (newY <= 0) {
        playerY.value = 1;
        velocityRef.current = Math.abs(velocityRef.current) * 0.3;
      } else if (newY >= PLAY_HEIGHT) {
        playerY.value = PLAY_HEIGHT - 1;
        velocityRef.current = -Math.abs(velocityRef.current) * 0.3;
      } else {
        playerY.value = newY;
      }

      // Score + speed (gentler ramp)
      scoreRef.current += dtSec * 10;
      const roundedScore = Math.floor(scoreRef.current);
      setScore(roundedScore);
      speedRef.current = SPEED_START + roundedScore * 0.15;

      // Move obstacles
      for (let i = 0; i < OBS_COUNT; i++) {
        if (obsViss[i].value < 0.5) continue;
        obsXs[i].value -= speedRef.current * dtSec;
        if (obsXs[i].value < -OBSTACLE_WIDTH) {
          obsViss[i].value = 0;
        }
      }

      // Grace period — no obstacles until player has had time to orient
      if (elapsedRef.current < GRACE_PERIOD_MS) return;

      // Spawn based on rightmost active obstacle — ensures proper spacing
      const activeXs = Array.from({ length: OBS_COUNT }, (_, i) =>
        obsViss[i].value > 0.5 ? obsXs[i].value : null,
      ).filter((x): x is number => x !== null);
      const maxObsX = activeXs.length > 0 ? Math.max(...activeXs) : -Infinity;
      if (maxObsX < SCREEN_WIDTH - MIN_OBS_SPACING || activeXs.length === 0) {
        const freeIdx = Array.from({ length: OBS_COUNT }, (_, i) => i).find(
          (i) => obsViss[i].value < 0.5,
        );
        if (freeIdx !== undefined) {
          spawnObstacle(freeIdx, SCREEN_WIDTH + 20);
        }
      }

      // Collision detection — reads gcs[i].value directly (same source as rendering)
      if (invincibleRef.current) return;
      const pY = playerY.value;
      for (let i = 0; i < OBS_COUNT; i++) {
        if (obsViss[i].value < 0.5) continue;
        const ox = obsXs[i].value;
        const hitX =
          ox < PLAYER_X + PLAYER_SIZE / 2 && ox + OBSTACLE_WIDTH > PLAYER_X - PLAYER_SIZE / 2;
        if (!hitX) continue;
        const gapCenter = gcs[i].value;
        const inGap = pY > gapCenter - GAP_HALF && pY < gapCenter + GAP_HALF;
        if (!inGap) {
          triggerGameOver();
          return;
        }
      }
    },
    [playerY, obsXs, obsViss, gcs, triggerGameOver, spawnObstacle],
  );

  useGameLoop(tick, phase === 'playing');

  const handleFlip = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    gravityDirRef.current *= -1;
    velocityRef.current = gravityDirRef.current * FLIP_IMPULSE;
    setGravityUp(gravityDirRef.current === -1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleContinue = useCallback(() => {
    playerY.value = PLAY_HEIGHT / 2;
    velocityRef.current = 0;
    gravityDirRef.current = 1;
    setGravityUp(false);
    for (let i = 0; i < OBS_COUNT; i++) {
      if (obsViss[i].value > 0.5 && obsXs[i].value < PLAYER_X + PLAYER_SIZE * 3) {
        obsViss[i].value = 0;
      }
    }
    invincibleRef.current = true;
    setTimeout(() => {
      invincibleRef.current = false;
    }, 1000);
    hasContinuedRef.current = true;
    phaseRef.current = 'playing';
    setPhase('playing');
  }, [playerY, obsXs, obsViss]);

  const launchGame = useCallback(() => {
    hasContinuedRef.current = false;
    setInterstitialShown(false);
    scoreRef.current = 0;
    velocityRef.current = 0;
    gravityDirRef.current = 1;
    speedRef.current = SPEED_START;
    elapsedRef.current = 0;
    setScore(0);
    setGravityUp(false);
    playerY.value = PLAY_HEIGHT / 2;

    for (let i = 0; i < OBS_COUNT; i++) {
      obsViss[i].value = 0;
      obsXs[i].value = SCREEN_WIDTH + 20;
      gcs[i].value = PLAY_HEIGHT / 2;
    }

    phaseRef.current = 'playing';
    setPhase('playing');
  }, [playerY, obsXs, obsViss, gcs]);

  const handleScreenTap = useCallback(() => {
    if (phase === 'idle') {
      launchGame();
    } else if (phase === 'playing') {
      handleFlip();
    }
  }, [phase, launchGame, handleFlip]);

  return (
    <TouchableWithoutFeedback onPress={handleScreenTap}>
      <View style={styles.container}>
        {/* HUD */}
        <View style={styles.hud}>
          <Text style={styles.scoreText}>Score: {Math.floor(score)}</Text>
          <Text style={styles.gravText}>{gravityUp ? '↑ FLIPPED' : '↓ NORMAL'}</Text>
          <Text style={styles.highScoreText}>Best: {highScore}</Text>
        </View>

        {/* Play area */}
        <View style={styles.playArea}>
          <Animated.View style={[styles.player, playerStyle]} />

          {([0, 1, 2, 3] as const).map((i) => (
            <Animated.View key={`obs-${i}`} style={[styles.obstacleGroup, obsStyles[i]]}>
              {/* Top pillar — height driven by gapCenter SharedValue */}
              <Animated.View style={[styles.pillar, topHs[i]]} />
              {/* Gap — fixed height spacer, transparent */}
              <View style={styles.gap} />
              {/* Bottom pillar — height driven by gapCenter SharedValue */}
              <Animated.View style={[styles.pillar, botHs[i]]} />
            </Animated.View>
          ))}

          <View style={styles.floorLine} />
          <View style={styles.ceilLine} />
        </View>

        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.titleText}>GRAVITY FLIP</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap to flip gravity — dodge the pillars</Text>
          </View>
        )}

        {phase === 'over' && (
          <GameOverScreen
            score={score}
            highScore={highScore}
            accentColor="#39ff14"
            onReplay={launchGame}
            onContinue={handleContinue}
            showContinue={!hasContinuedRef.current && !interstitialShown}
            continueSubtext="Respawn safely and keep your score by watching an ad"
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060614',
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
    color: '#39ff14',
    fontSize: 20,
    fontWeight: 'bold',
  },
  gravText: {
    color: '#ff00ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  playArea: {
    position: 'absolute',
    top: PLAY_TOP,
    left: 0,
    right: 0,
    height: PLAY_HEIGHT,
    overflow: 'hidden',
  },
  player: {
    position: 'absolute',
    left: PLAYER_X - PLAYER_SIZE / 2,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: 6,
    backgroundColor: '#39ff14',
    shadowColor: '#39ff14',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  obstacleGroup: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: OBSTACLE_WIDTH,
    height: PLAY_HEIGHT,
    flexDirection: 'column',
  },
  pillar: {
    width: OBSTACLE_WIDTH,
    backgroundColor: '#ff00ff',
    borderRadius: 4,
  },
  gap: {
    width: OBSTACLE_WIDTH,
    height: GAP_HEIGHT,
  },
  floorLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#39ff1440',
  },
  ceilLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#39ff1440',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#060614dd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#39ff14',
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
    color: '#39ff14',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#ff00ff',
    fontSize: 20,
    marginTop: 8,
  },
});
