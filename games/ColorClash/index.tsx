import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = '@color-clash/highscore';
const TIMER_BAR_WIDTH = SCREEN_WIDTH - 40;

type GamePhase = 'idle' | 'playing' | 'over';

// Stroop effect: word name vs ink color
const COLORS = ['#ff4444', '#44dd66', '#4499ff', '#ffdd00'] as const;
const COLOR_NAMES = ['RED', 'GREEN', 'BLUE', 'YELLOW'] as const;
type ColorIndex = 0 | 1 | 2 | 3;

interface Round {
  wordIdx: ColorIndex;   // which name is displayed
  inkIdx: ColorIndex;    // which color is the ink
  // Player must tap the ink color (inkIdx)
}

function makeRound(lastInkIdx: ColorIndex | null): Round {
  const inkIdx = (Math.floor(Math.random() * 4)) as ColorIndex;
  // Make word different from ink to create Stroop conflict most of the time (70%)
  let wordIdx: ColorIndex;
  if (Math.random() < 0.7) {
    let w: number;
    do {
      w = Math.floor(Math.random() * 4);
    } while (w === inkIdx);
    wordIdx = w as ColorIndex;
  } else {
    wordIdx = inkIdx;
  }
  return { wordIdx, inkIdx };
}

function getTimeLimit(score: number): number {
  return Math.max(1500, 4000 - score * 60);
}

export default function ColorClash() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState<Round>(() => makeRound(null));
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const isAnsweringRef = useRef(false);
  const lastInkRef = useRef<ColorIndex | null>(null);

  const timerProgress = useSharedValue(1);

  const timerBarStyle = useAnimatedStyle(() => ({
    width: timerProgress.value * TIMER_BAR_WIDTH,
    backgroundColor:
      timerProgress.value > 0.5
        ? '#ffdd00'
        : timerProgress.value > 0.25
          ? '#ff9f43'
          : '#ff4444',
  }));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const nextRound = useCallback(
    (currentScore: number) => {
      isAnsweringRef.current = false;
      const r = makeRound(lastInkRef.current);
      lastInkRef.current = r.inkIdx;
      setRound(r);
      const limit = getTimeLimit(currentScore);
      cancelAnimation(timerProgress);
      timerProgress.value = 1;
      timerProgress.value = withTiming(0, {
        duration: limit,
        easing: Easing.linear,
      });
    },
    [timerProgress],
  );

  const triggerGameOver = useCallback(async () => {
    phaseRef.current = 'over';
    setPhase('over');
    cancelAnimation(timerProgress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const finalScore = scoreRef.current;
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (finalScore > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
      setHighScore(finalScore);
    }
  }, [timerProgress]);

  const tick = useCallback(
    (_dt: number) => {
      if (phaseRef.current !== 'playing') return;
      if (isAnsweringRef.current) return;

      if (timerProgress.value <= 0.005) {
        isAnsweringRef.current = true;
        streakRef.current = 0;
        setStreak(0);
        setFlashColor('#ff4444');
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            triggerGameOver();
          }
        }, 400);
      }
    },
    [timerProgress, triggerGameOver],
  );

  useGameLoop(tick, phase === 'playing');

  const handleTap = useCallback(
    (tappedIdx: ColorIndex) => {
      if (phaseRef.current !== 'playing' || isAnsweringRef.current) return;
      isAnsweringRef.current = true;
      cancelAnimation(timerProgress);

      if (tappedIdx === round.inkIdx) {
        streakRef.current += 1;
        const streakBonus = streakRef.current > 0 && streakRef.current % 5 === 0 ? 10 : 0;
        const points = 10 + streakBonus;
        scoreRef.current += points;
        setScore(scoreRef.current);
        setStreak(streakRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFlashColor(COLORS[tappedIdx]);
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            nextRound(scoreRef.current);
          }
        }, 150);
      } else {
        streakRef.current = 0;
        setStreak(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setFlashColor('#ff4444');
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            triggerGameOver();
          }
        }, 400);
      }
    },
    [round, timerProgress, nextRound, triggerGameOver],
  );

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    isAnsweringRef.current = false;
    lastInkRef.current = null;
    setScore(0);
    setStreak(0);
    setFlashColor(null);
    const r = makeRound(null);
    lastInkRef.current = r.inkIdx;
    setRound(r);
    phaseRef.current = 'playing';
    setPhase('playing');
    const limit = getTimeLimit(0);
    cancelAnimation(timerProgress);
    timerProgress.value = 1;
    timerProgress.value = withTiming(0, {
      duration: limit,
      easing: Easing.linear,
    });
  }, [timerProgress]);

  const handleScreenTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over') {
      startGame();
    }
  }, [phase, startGame]);

  return (
    <View
      style={[
        styles.container,
        flashColor ? { backgroundColor: flashColor + '18' } : null,
      ]}
    >
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        {streak >= 5 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}</Text>
          </View>
        )}
        <Text style={styles.highScoreText}>Best: {highScore}</Text>
      </View>

      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerBar, timerBarStyle]} />
      </View>

      {phase === 'playing' && (
        <View style={styles.gameArea}>
          <Text style={styles.promptText}>Tap the color of the text</Text>

          {/* The Stroop word — shown in ink color, not word color */}
          <Text style={[styles.wordText, { color: COLORS[round.inkIdx] }]}>
            {COLOR_NAMES[round.wordIdx]}
          </Text>

          {/* 4 color buttons */}
          <View style={styles.buttonsGrid}>
            {COLORS.map((color, i) => (
              <Pressable
                key={color}
                style={({ pressed }) => [
                  styles.colorButton,
                  { backgroundColor: color + (pressed ? 'cc' : '55') },
                  { borderColor: color },
                ]}
                onPress={() => handleTap(i as ColorIndex)}
              >
                <View style={[styles.colorSwatch, { backgroundColor: color }]} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {phase === 'idle' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>COLOR CLASH</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>
              {'Tap the COLOR of the text,\nnot what it says!'}
            </Text>
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

const BUTTON_SIZE = (SCREEN_WIDTH - 60) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0a1e',
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
    color: '#ff4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  streakBadge: {
    backgroundColor: '#ffdd0022',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffdd00',
  },
  streakText: {
    color: '#ffdd00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  timerTrack: {
    position: 'absolute',
    top: 110,
    left: 20,
    right: 20,
    height: 8,
    backgroundColor: '#ffffff15',
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 10,
  },
  timerBar: {
    height: '100%',
    borderRadius: 4,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    gap: 24,
  },
  promptText: {
    color: '#ffffff60',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  wordText: {
    fontSize: 64,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
  },
  buttonsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    marginTop: 16,
  },
  colorButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE * 0.65,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatch: {
    width: BUTTON_SIZE * 0.45,
    height: BUTTON_SIZE * 0.3,
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0a1edd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#ff4444',
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
    lineHeight: 22,
  },
  gameOverText: {
    color: '#ff4444',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#ffdd00',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#ff4444',
    fontSize: 20,
    marginTop: 8,
  },
});
