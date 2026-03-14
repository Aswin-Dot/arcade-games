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
const STORAGE_KEY = '@math-rush/highscore';
const TIMER_BAR_WIDTH = SCREEN_WIDTH - 40;

type GamePhase = 'idle' | 'playing' | 'over';

interface Question {
  text: string;
  answer: number;
  choices: number[];
}

const BUTTON_COLORS = ['#ff6b6b', '#4ecdc4', '#feca57', '#a29bfe'];

function makeQuestion(score: number): Question {
  const level = Math.floor(score / 5);
  let a: number;
  let b: number;
  let answer: number;
  let text: string;

  const op = Math.floor(Math.random() * (level < 3 ? 2 : 3));

  if (op === 0) {
    a = Math.floor(Math.random() * (10 + level * 5)) + 1;
    b = Math.floor(Math.random() * (10 + level * 5)) + 1;
    answer = a + b;
    text = `${a} + ${b}`;
  } else if (op === 1) {
    a = Math.floor(Math.random() * (10 + level * 5)) + 5;
    b = Math.floor(Math.random() * Math.min(a, 10 + level * 3)) + 1;
    answer = a - b;
    text = `${a} - ${b}`;
  } else {
    a = Math.floor(Math.random() * (5 + level)) + 2;
    b = Math.floor(Math.random() * (5 + level)) + 2;
    answer = a * b;
    text = `${a} × ${b}`;
  }

  // Generate 3 wrong answers that are distinct and close to correct
  const wrongs = new Set<number>();
  while (wrongs.size < 3) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = answer + offset;
    if (wrong !== answer && wrong >= 0 && !wrongs.has(wrong)) {
      wrongs.add(wrong);
    }
  }

  const choices = [answer, ...Array.from(wrongs)];
  // Shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { text, answer, choices };
}

function getTimeLimit(score: number): number {
  return Math.max(2000, 5000 - score * 80);
}

export default function MathRush() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<Question>(() => makeQuestion(0));
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const isAnsweringRef = useRef(false);

  const timerProgress = useSharedValue(1);

  const timerBarStyle = useAnimatedStyle(() => ({
    width: timerProgress.value * TIMER_BAR_WIDTH,
    backgroundColor:
      timerProgress.value > 0.5
        ? '#feca57'
        : timerProgress.value > 0.25
          ? '#ff9f43'
          : '#ff6b6b',
  }));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const nextQuestion = useCallback((currentScore: number) => {
    isAnsweringRef.current = false;
    const q = makeQuestion(currentScore);
    setQuestion(q);
    const limit = getTimeLimit(currentScore);
    cancelAnimation(timerProgress);
    timerProgress.value = 1;
    timerProgress.value = withTiming(0, {
      duration: limit,
      easing: Easing.linear,
    });
  }, [timerProgress]);

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

  // useGameLoop tick — checks if timer ran out
  const tick = useCallback(
    (_dt: number) => {
      if (phaseRef.current !== 'playing') return;
      if (isAnsweringRef.current) return;

      // Timer hit zero
      if (timerProgress.value <= 0.005) {
        isAnsweringRef.current = true;
        streakRef.current = 0;
        setStreak(0);
        setFlashColor('#ff6b6b');
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            nextQuestion(scoreRef.current);
          }
        }, 300);
      }
    },
    [timerProgress, nextQuestion],
  );

  useGameLoop(tick, phase === 'playing');

  const handleAnswer = useCallback(
    (choice: number) => {
      if (phaseRef.current !== 'playing' || isAnsweringRef.current) return;
      isAnsweringRef.current = true;
      cancelAnimation(timerProgress);

      if (choice === question.answer) {
        streakRef.current += 1;
        const streakBonus = streakRef.current > 0 && streakRef.current % 3 === 0 ? 5 : 0;
        const points = 10 + streakBonus;
        scoreRef.current += points;
        setScore(scoreRef.current);
        setStreak(streakRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFlashColor('#4ecdc4');
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            nextQuestion(scoreRef.current);
          }
        }, 200);
      } else {
        streakRef.current = 0;
        setStreak(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setFlashColor('#ff6b6b');
        setTimeout(() => {
          setFlashColor(null);
          if (phaseRef.current === 'playing') {
            triggerGameOver();
          }
        }, 400);
      }
    },
    [question, timerProgress, nextQuestion, triggerGameOver],
  );

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    streakRef.current = 0;
    isAnsweringRef.current = false;
    setScore(0);
    setStreak(0);
    setFlashColor(null);
    const q = makeQuestion(0);
    setQuestion(q);
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
    <View style={[styles.container, flashColor ? { backgroundColor: flashColor + '22' } : null]}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        {streak >= 3 && (
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
          <Text style={styles.questionText}>{question.text}</Text>
          <Text style={styles.equalsText}>=  ?</Text>
          <View style={styles.choicesGrid}>
            {question.choices.map((choice, i) => (
              <Pressable
                key={`${choice}-${i}`}
                style={({ pressed }) => [
                  styles.choiceButton,
                  { backgroundColor: BUTTON_COLORS[i] + (pressed ? 'cc' : '22') },
                  { borderColor: BUTTON_COLORS[i] },
                ]}
                onPress={() => handleAnswer(choice)}
              >
                <Text style={[styles.choiceText, { color: BUTTON_COLORS[i] }]}>
                  {choice}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {phase === 'idle' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>MATH RUSH</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Answer fast — one wrong ends the run</Text>
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
    backgroundColor: '#0d0d2b',
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
    color: '#feca57',
    fontSize: 20,
    fontWeight: 'bold',
  },
  streakBadge: {
    backgroundColor: '#ff6b6b22',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  streakText: {
    color: '#ff6b6b',
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
  },
  questionText: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  equalsText: {
    color: '#ffffff60',
    fontSize: 28,
    marginBottom: 48,
  },
  choicesGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  choiceButton: {
    width: (SCREEN_WIDTH - 60) / 2,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d2bdd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#feca57',
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
    color: '#ff6b6b',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#feca57',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  bestDisplay: {
    color: '#ff6b6b',
    fontSize: 20,
    marginTop: 8,
  },
});
