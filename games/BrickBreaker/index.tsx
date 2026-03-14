import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const STORAGE_KEY = '@brick-breaker/highscore';
const { width: SW, height: SH } = Dimensions.get('window');

const PLAY_TOP = 100;
const PLAY_HEIGHT = SH - PLAY_TOP - 60;
const PLAY_WIDTH = SW;

const PADDLE_W = 90;
const PADDLE_H = 12;
const PADDLE_Y = PLAY_HEIGHT - 50;
const BALL_R = 9;
const BALL_SPEED_START = 420; // px/s

const BRICK_COLS = 7;
const BRICK_ROWS = 6;
const BRICK_H = 22;
const BRICK_GAP = 4;
const BRICK_AREA_TOP = 60;
const BRICK_W = (PLAY_WIDTH - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;

const BRICK_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#a29bfe'];

type Phase = 'idle' | 'playing' | 'over';

interface Brick {
  hp: number; // 0 = destroyed
  color: string;
}

function makeBricks(): Brick[] {
  return Array.from({ length: BRICK_ROWS * BRICK_COLS }, (_, i) => {
    const row = Math.floor(i / BRICK_COLS);
    const hp = row < 2 ? 2 : 1;
    return { hp, color: BRICK_COLORS[row % BRICK_COLORS.length] };
  });
}

function brickRect(idx: number) {
  const col = idx % BRICK_COLS;
  const row = Math.floor(idx / BRICK_COLS);
  const x = BRICK_GAP + col * (BRICK_W + BRICK_GAP);
  const y = BRICK_AREA_TOP + row * (BRICK_H + BRICK_GAP);
  return { x, y, w: BRICK_W, h: BRICK_H };
}

export default function BrickBreaker() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [bricks, setBricks] = useState<Brick[]>(makeBricks());

  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const bricksRef = useRef<Brick[]>(makeBricks());
  const velXRef = useRef(0);
  const velYRef = useRef(0);
  const ballSpeedRef = useRef(BALL_SPEED_START);
  const paddleXRef = useRef(SW / 2 - PADDLE_W / 2);
  const launched = useRef(false);

  // SharedValues for smooth animation
  const ballX = useSharedValue(SW / 2);
  const ballY = useSharedValue(PADDLE_Y - BALL_R - 2);
  const paddleX = useSharedValue(SW / 2 - PADDLE_W / 2);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ballX.value - BALL_R }, { translateY: ballY.value - BALL_R }],
  }));
  const paddleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: paddleX.value }],
  }));

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

  const resetBall = useCallback(() => {
    const px = paddleXRef.current;
    ballX.value = px + PADDLE_W / 2;
    ballY.value = PADDLE_Y - BALL_R - 2;
    velXRef.current = 0;
    velYRef.current = 0;
    launched.current = false;
  }, [ballX, ballY]);

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const dtSec = dt / 1000;

      if (!launched.current) {
        // Ball sits on paddle before launch
        ballX.value = paddleXRef.current + PADDLE_W / 2;
        return;
      }

      const spd = ballSpeedRef.current;
      let nx = ballX.value + velXRef.current * spd * dtSec;
      let ny = ballY.value + velYRef.current * spd * dtSec;
      let vx = velXRef.current;
      let vy = velYRef.current;

      // Wall bounces
      if (nx - BALL_R < 0) { nx = BALL_R; vx = Math.abs(vx); }
      if (nx + BALL_R > PLAY_WIDTH) { nx = PLAY_WIDTH - BALL_R; vx = -Math.abs(vx); }
      if (ny - BALL_R < 0) { ny = BALL_R; vy = Math.abs(vy); }

      // Ball fell below paddle
      if (ny - BALL_R > PLAY_HEIGHT + 20) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (livesRef.current <= 0) { triggerGameOver(); return; }
        resetBall();
        return;
      }

      // Paddle collision
      const px = paddleXRef.current;
      const pTop = PADDLE_Y - PADDLE_H / 2;
      const pBot = PADDLE_Y + PADDLE_H / 2;
      if (
        ny + BALL_R >= pTop && ny - BALL_R <= pBot &&
        nx >= px && nx <= px + PADDLE_W &&
        vy > 0
      ) {
        ny = pTop - BALL_R;
        vy = -Math.abs(vy);
        // Angle based on hit position (-1..1 from center)
        const hitPos = (nx - (px + PADDLE_W / 2)) / (PADDLE_W / 2);
        vx = hitPos * 1.2;
        const mag = Math.sqrt(vx * vx + vy * vy);
        vx /= mag; vy /= mag;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Brick collisions
      const newBricks = [...bricksRef.current];
      let hitAny = false;
      let addScore = 0;

      for (let i = 0; i < newBricks.length; i++) {
        if (newBricks[i].hp <= 0) continue;
        const { x: bx, y: by, w: bw, h: bh } = brickRect(i);

        const closest = {
          x: Math.max(bx, Math.min(nx, bx + bw)),
          y: Math.max(by, Math.min(ny, by + bh)),
        };
        const dist = Math.sqrt((nx - closest.x) ** 2 + (ny - closest.y) ** 2);
        if (dist > BALL_R) continue;

        // Determine bounce axis
        const overlapX = Math.min(nx - bx, bx + bw - nx);
        const overlapY = Math.min(ny - by, by + bh - ny);
        if (overlapX < overlapY) { vx *= -1; } else { vy *= -1; }

        newBricks[i] = { ...newBricks[i], hp: newBricks[i].hp - 1 };
        addScore += 10;
        hitAny = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break; // one brick per frame
      }

      if (hitAny) {
        bricksRef.current = newBricks;
        setBricks([...newBricks]);
        scoreRef.current += addScore;
        setScore(scoreRef.current);

        // Check win (all bricks cleared)
        if (newBricks.every((b) => b.hp <= 0)) {
          ballSpeedRef.current += 40;
          bricksRef.current = makeBricks();
          setBricks(makeBricks());
          resetBall();
          scoreRef.current += 200;
          setScore(scoreRef.current);
        }
      }

      velXRef.current = vx;
      velYRef.current = vy;
      ballX.value = nx;
      ballY.value = ny;
    },
    [ballX, ballY, triggerGameOver, resetBall],
  );

  useGameLoop(tick, phase === 'playing');

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          if (phaseRef.current !== 'playing') return;
          const newX = Math.max(0, Math.min(PLAY_WIDTH - PADDLE_W, e.x - PADDLE_W / 2));
          paddleX.value = newX;
          paddleXRef.current = newX;
          // Launch ball on first drag
          if (!launched.current) {
            launched.current = true;
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4);
            velXRef.current = Math.cos(angle);
            velYRef.current = Math.sin(angle);
          }
        }),
    [paddleX],
  );

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    ballSpeedRef.current = BALL_SPEED_START;
    const px = SW / 2 - PADDLE_W / 2;
    paddleXRef.current = px;
    paddleX.value = px;
    ballX.value = SW / 2;
    ballY.value = PADDLE_Y - BALL_R - 2;
    velXRef.current = 0;
    velYRef.current = 0;
    launched.current = false;
    const fresh = makeBricks();
    bricksRef.current = fresh;
    setBricks(fresh);
    setScore(0);
    setLives(3);
    phaseRef.current = 'playing';
    setPhase('playing');
  }, [ballX, ballY, paddleX]);

  const handleTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over') { startGame(); return; }
    // Tap to launch if not yet launched
    if (phase === 'playing' && !launched.current) {
      launched.current = true;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4);
      velXRef.current = Math.cos(angle);
      velYRef.current = Math.sin(angle);
    }
  }, [phase, startGame]);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* HUD */}
        <View style={styles.hud}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <View style={styles.livesRow}>
            {Array.from({ length: 3 }, (_, i) => (
              <Text key={i} style={[styles.heart, { opacity: i < lives ? 1 : 0.2 }]}>●</Text>
            ))}
          </View>
          <Text style={styles.highScoreText}>Best: {highScore}</Text>
        </View>

        {/* Play area */}
        <View style={styles.playArea} onTouchEnd={handleTap}>
          {/* Bricks */}
          {bricks.map((brick, i) => {
            if (brick.hp <= 0) return null;
            const { x, y, w, h } = brickRect(i);
            return (
              <View
                key={i}
                style={[
                  styles.brick,
                  {
                    left: x, top: y, width: w, height: h,
                    backgroundColor: brick.color,
                    opacity: brick.hp === 2 ? 1 : 0.6,
                  },
                ]}
              />
            );
          })}

          {/* Ball */}
          <Animated.View style={[styles.ball, ballStyle]} />

          {/* Paddle */}
          <Animated.View style={[styles.paddle, paddleStyle]} />
        </View>

        {phase === 'idle' && (
          <View style={styles.overlay} onTouchEnd={handleTap}>
            <Text style={styles.titleText}>BRICK BREAKER</Text>
            <Text style={styles.subtitleText}>Drag to move paddle</Text>
            <Text style={styles.hintText}>Tap or drag to launch the ball</Text>
          </View>
        )}

        {phase === 'over' && (
          <View style={styles.overlay} onTouchEnd={handleTap}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalScoreText}>Score: {score}</Text>
            <Text style={styles.bestDisplay}>Best: {highScore}</Text>
            <Text style={styles.subtitleText}>Tap to Restart</Text>
          </View>
        )}

        {phase === 'playing' && !launched.current && (
          <Text style={styles.launchHint}>Tap or drag to launch</Text>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  hud: {
    position: 'absolute', top: 60, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingLeft: 72, paddingRight: 20, zIndex: 10,
  },
  scoreText: { color: '#ff6b35', fontSize: 20, fontWeight: 'bold' },
  livesRow: { flexDirection: 'row', gap: 6 },
  heart: { color: '#ff6b35', fontSize: 14 },
  highScoreText: { color: '#ffffff80', fontSize: 14 },
  playArea: {
    position: 'absolute', top: PLAY_TOP, left: 0, right: 0,
    height: PLAY_HEIGHT, overflow: 'hidden',
  },
  brick: { position: 'absolute', borderRadius: 4 },
  ball: {
    position: 'absolute', width: BALL_R * 2, height: BALL_R * 2,
    borderRadius: BALL_R, backgroundColor: '#ffffff',
    shadowColor: '#ff6b35', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 8,
  },
  paddle: {
    position: 'absolute', top: PADDLE_Y - PADDLE_H / 2,
    width: PADDLE_W, height: PADDLE_H,
    backgroundColor: '#ff6b35', borderRadius: PADDLE_H / 2,
    shadowColor: '#ff6b35', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a1add',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  titleText: { color: '#ff6b35', fontSize: 34, fontWeight: 'bold', letterSpacing: 3, marginBottom: 20 },
  subtitleText: { color: '#ffffff90', fontSize: 18, marginTop: 20 },
  hintText: { color: '#ffffff50', fontSize: 14, marginTop: 10 },
  gameOverText: { color: '#ff6b35', fontSize: 36, fontWeight: 'bold', letterSpacing: 3 },
  finalScoreText: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginTop: 16 },
  bestDisplay: { color: '#ff6b3580', fontSize: 20, marginTop: 8 },
  launchHint: {
    position: 'absolute', bottom: 110, left: 0, right: 0,
    textAlign: 'center', color: '#ffffff40', fontSize: 13,
  },
});
