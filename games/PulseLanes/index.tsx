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
  withRepeat,
  withSequence,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LANE_COUNT = 3;
const LANE_WIDTH = SCREEN_WIDTH / LANE_COUNT;
const PLAYER_SIZE = 40;
const OBSTACLE_WIDTH = LANE_WIDTH * 0.6;
const OBSTACLE_HEIGHT = 30;
const PLAYER_Y = SCREEN_HEIGHT - 160;
const MAX_OBSTACLES = 6;
const STORAGE_KEY = '@pulse_lanes_high_score';

const NEON_COLORS = ['#00f5ff', '#ff00ff', '#39ff14', '#ff6b6b', '#feca57', '#a855f7'];

type GamePhase = 'idle' | 'playing' | 'over';

interface ObstacleData {
  lane: number;
  y: number;
  active: boolean;
  colorIdx: number;
}

export default function PulseLanes() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerLane, setPlayerLane] = useState(1);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const playerLaneRef = useRef(1);
  const speedRef = useRef(4);
  const spawnTimerRef = useRef(0);
  const obstaclesRef = useRef<ObstacleData[]>(
    Array.from({ length: MAX_OBSTACLES }, () => ({
      lane: 0,
      y: -100,
      active: false,
      colorIdx: 0,
    }))
  );

  const playerX = useSharedValue(LANE_WIDTH * 1 + LANE_WIDTH / 2 - PLAYER_SIZE / 2);
  const obstacleYs = Array.from({ length: MAX_OBSTACLES }, () => useSharedValue(-100));
  const obstacleXs = Array.from({ length: MAX_OBSTACLES }, () => useSharedValue(0));
  const obstacleOpacities = Array.from({ length: MAX_OBSTACLES }, () => useSharedValue(0));
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 500 }),
        withTiming(0.9, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const updateScore = useCallback((s: number) => {
    setScore(s);
  }, []);

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

  const spawnObstacle = useCallback(() => {
    const obs = obstaclesRef.current;
    const idx = obs.findIndex((o) => !o.active);
    if (idx === -1) return;

    const lane = Math.floor(Math.random() * LANE_COUNT);
    const colorIdx = Math.floor(Math.random() * NEON_COLORS.length);
    obs[idx] = { lane, y: -OBSTACLE_HEIGHT, active: true, colorIdx };
    obstacleXs[idx].value = lane * LANE_WIDTH + (LANE_WIDTH - OBSTACLE_WIDTH) / 2;
    obstacleYs[idx].value = -OBSTACLE_HEIGHT;
    obstacleOpacities[idx].value = 1;
  }, []);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (phaseRef.current !== 'playing') return;
    const dt = (timeSincePreviousFrame ?? 16) / 16;
    const speed = speedRef.current;

    // Update score
    scoreRef.current += 1;
    if (scoreRef.current % 10 === 0) {
      runOnJS(updateScore)(scoreRef.current);
    }

    // Increase speed over time
    speedRef.current = 4 + scoreRef.current * 0.003;
2
    // Spawn timer
    spawnTimerRef.current += dt;
    const spawnInterval = Math.max(20, 60 - scoreRef.current * 0.03);
    if (spawnTimerRef.current >= spawnInterval) {
      spawnTimerRef.current = 0;
      runOnJS(spawnObstacle)();
    }

    // Update obstacles
    const obs = obstaclesRef.current;
    const pLane = playerLaneRef.current;
    const pLeft = pLane * LANE_WIDTH + (LANE_WIDTH - PLAYER_SIZE) / 2;
    const pRight = pLeft + PLAYER_SIZE;
    const pTop = PLAYER_Y;
    const pBottom = PLAYER_Y + PLAYER_SIZE;

    for (let i = 0; i < MAX_OBSTACLES; i++) {
      if (!obs[i].active) continue;
      obs[i].y += speed * dt;
      obstacleYs[i].value = obs[i].y;

      // Off screen
      if (obs[i].y > SCREEN_HEIGHT + 50) {
        obs[i].active = false;
        obstacleOpacities[i].value = 0;
        continue;
      }

      // Collision
      const oLeft = obs[i].lane * LANE_WIDTH + (LANE_WIDTH - OBSTACLE_WIDTH) / 2;
      const oRight = oLeft + OBSTACLE_WIDTH;
      const oTop = obs[i].y;
      const oBottom = obs[i].y + OBSTACLE_HEIGHT;

      if (pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop) {
        obs[i].active = false;
        obstacleOpacities[i].value = 0;
        runOnJS(triggerGameOver)();
        return;
      }
    }
  });

  const handleTap = useCallback(
    (evt: { nativeEvent: { locationX: number } }) => {
      if (phase === 'idle' || phase === 'over') {
        // Start/restart
        phaseRef.current = 'playing';
        setPhase('playing');
        scoreRef.current = 0;
        setScore(0);
        speedRef.current = 4;
        spawnTimerRef.current = 0;
        playerLaneRef.current = 1;
        setPlayerLane(1);
        playerX.value = withTiming(LANE_WIDTH * 1 + LANE_WIDTH / 2 - PLAYER_SIZE / 2, {
          duration: 0,
        });
        obstaclesRef.current.forEach((o, i) => {
          o.active = false;
          o.y = -100;
          obstacleYs[i].value = -100;
          obstacleOpacities[i].value = 0;
        });
        return;
      }

      const x = evt.nativeEvent.locationX;
      let newLane = playerLaneRef.current;
      if (x < SCREEN_WIDTH / 2) {
        newLane = Math.max(0, newLane - 1);
      } else {
        newLane = Math.min(LANE_COUNT - 1, newLane + 1);
      }
      if (newLane !== playerLaneRef.current) {
        playerLaneRef.current = newLane;
        setPlayerLane(newLane);
        playerX.value = withTiming(
          newLane * LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_SIZE / 2,
          { duration: 100 }
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [phase]
  );

  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerX.value }],
  }));

  const obstacleStyles = obstacleYs.map((y, i) =>
    useAnimatedStyle(() => ({
      transform: [{ translateX: obstacleXs[i].value }, { translateY: y.value }],
      opacity: obstacleOpacities[i].value,
    }))
  );

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>
        {/* Lane dividers */}
        {[1, 2].map((i) => (
          <View
            key={i}
            style={[styles.laneDivider, { left: LANE_WIDTH * i }]}
          />
        ))}

        {/* Obstacles */}
        {obstacleStyles.map((style, i) => (
          <Animated.View key={`obs-${i}`} style={[styles.obstacle, style]}>
            <Animated.View
              style={[
                styles.obstacleInner,
                pulseStyle,
                {
                  backgroundColor:
                    NEON_COLORS[obstaclesRef.current[i]?.colorIdx ?? 0],
                  shadowColor:
                    NEON_COLORS[obstaclesRef.current[i]?.colorIdx ?? 0],
                },
              ]}
            />
          </Animated.View>
        ))}

        {/* Player */}
        <Animated.View style={[styles.playerContainer, playerStyle]}>
          <View style={styles.playerGlow} />
          <View style={styles.player} />
        </Animated.View>

        {/* HUD */}
        <View style={styles.hud}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.highScoreText}>Best: {highScore}</Text>
        </View>

        {/* Overlays */}
        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.titleText}>PULSE LANES</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap left/right to switch lanes</Text>
          </View>
        )}

        {phase === 'over' && (
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.highScoreDisplay}>Best: {highScore}</Text>
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
    backgroundColor: '#0a0a1a',
  },
  laneDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#ffffff15',
  },
  obstacle: {
    position: 'absolute',
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  obstacleInner: {
    width: OBSTACLE_WIDTH,
    height: OBSTACLE_HEIGHT,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  playerContainer: {
    position: 'absolute',
    top: PLAYER_Y,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  player: {
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    backgroundColor: '#00f5ff',
  },
  playerGlow: {
    position: 'absolute',
    width: PLAYER_SIZE + 20,
    height: PLAYER_SIZE + 20,
    borderRadius: (PLAYER_SIZE + 20) / 2,
    backgroundColor: '#00f5ff30',
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  scoreText: {
    color: '#00f5ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a1acc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#00f5ff',
    fontSize: 36,
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
  },
  gameOverText: {
    color: '#ff0040',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#00f5ff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  highScoreDisplay: {
    color: '#feca57',
    fontSize: 20,
    marginTop: 8,
  },
});
