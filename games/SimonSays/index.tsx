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
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@simon-says/highscore';
const FLASH_ON = 420;
const FLASH_OFF = 200;
const SEQUENCE_GAP = 250;

const PANELS = [
  { color: '#ff4444', dimColor: '#5a1010', label: 'RED' },
  { color: '#44dd66', dimColor: '#0f4a1a', label: 'GREEN' },
  { color: '#4499ff', dimColor: '#103070', label: 'BLUE' },
  { color: '#ffdd00', dimColor: '#4a3e00', label: 'YELLOW' },
];

type GamePhase = 'idle' | 'showing' | 'input' | 'over';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_SIZE = Math.min((SCREEN_WIDTH - 60) / 2, 200);

export default function SimonSays() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [activePanel, setActivePanel] = useState<number | null>(null);

  const phaseRef = useRef<GamePhase>('idle');
  const sequenceRef = useRef<number[]>([]);
  const inputIdxRef = useRef(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Shared values for panel glow
  const glow0 = useSharedValue(0);
  const glow1 = useSharedValue(0);
  const glow2 = useSharedValue(0);
  const glow3 = useSharedValue(0);
  const glows = [glow0, glow1, glow2, glow3];

  const panelStyle0 = useAnimatedStyle(() => ({ opacity: 0.25 + glow0.value * 0.75 }));
  const panelStyle1 = useAnimatedStyle(() => ({ opacity: 0.25 + glow1.value * 0.75 }));
  const panelStyle2 = useAnimatedStyle(() => ({ opacity: 0.25 + glow2.value * 0.75 }));
  const panelStyle3 = useAnimatedStyle(() => ({ opacity: 0.25 + glow3.value * 0.75 }));
  const panelStyles = [panelStyle0, panelStyle1, panelStyle2, panelStyle3];

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
  }, []);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const flashPanel = useCallback(
    (panelIdx: number) => {
      glows[panelIdx].value = withSequence(
        withTiming(1, { duration: FLASH_ON * 0.3 }),
        withTiming(1, { duration: FLASH_ON * 0.4 }),
        withTiming(0, { duration: FLASH_ON * 0.3 }),
      );
    },
    [glows],
  );

  const showSequence = useCallback(
    (seq: number[]) => {
      phaseRef.current = 'showing';
      setPhase('showing');
      setActivePanel(null);

      let delay = 400;
      seq.forEach((panelIdx) => {
        const t1 = setTimeout(() => {
          setActivePanel(panelIdx);
          flashPanel(panelIdx);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, delay);
        const t2 = setTimeout(() => {
          setActivePanel(null);
        }, delay + FLASH_ON);
        timeoutsRef.current.push(t1, t2);
        delay += FLASH_ON + FLASH_OFF + SEQUENCE_GAP;
      });

      const doneTimer = setTimeout(() => {
        phaseRef.current = 'input';
        setPhase('input');
        inputIdxRef.current = 0;
      }, delay);
      timeoutsRef.current.push(doneTimer);
    },
    [flashPanel],
  );

  const triggerGameOver = useCallback(async () => {
    clearTimeouts();
    phaseRef.current = 'over';
    setPhase('over');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const finalScore = sequenceRef.current.length - 1;
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseInt(stored, 10) : 0;
    if (finalScore > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, finalScore.toString());
      setHighScore(finalScore);
    }
  }, [clearTimeouts]);

  const handlePanelPress = useCallback(
    (panelIdx: number) => {
      if (phaseRef.current !== 'input') return;

      flashPanel(panelIdx);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const seq = sequenceRef.current;
      if (panelIdx !== seq[inputIdxRef.current]) {
        triggerGameOver();
        return;
      }

      inputIdxRef.current += 1;

      if (inputIdxRef.current >= seq.length) {
        // Round complete — add next step
        const next = Math.floor(Math.random() * 4);
        const newSeq = [...seq, next];
        sequenceRef.current = newSeq;
        setSequence(newSeq);
        setScore(newSeq.length - 1);

        const t = setTimeout(() => {
          showSequence(newSeq);
        }, 600);
        timeoutsRef.current.push(t);
      }
    },
    [flashPanel, triggerGameOver, showSequence],
  );

  const startGame = useCallback(() => {
    clearTimeouts();
    glows.forEach((g) => { g.value = 0; });
    const first = Math.floor(Math.random() * 4);
    const initial = [first];
    sequenceRef.current = initial;
    setSequence(initial);
    setScore(0);
    setActivePanel(null);
    inputIdxRef.current = 0;
    showSequence(initial);
  }, [clearTimeouts, glows, showSequence]);

  const handleScreenTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over') {
      startGame();
    }
  }, [phase, startGame]);

  const phaseLabel =
    phase === 'showing' ? 'Watch...' : phase === 'input' ? 'Your turn!' : '';

  return (
    <View style={styles.container}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.scoreText}>Round: {score}</Text>
        <Text style={styles.phaseLabel}>{phaseLabel}</Text>
        <Text style={styles.highScoreText}>Best: {highScore}</Text>
      </View>

      {/* Panels */}
      <View style={styles.panelsContainer}>
        {PANELS.map((panel, i) => (
          <Pressable
            key={panel.label}
            onPress={() => handlePanelPress(i)}
            disabled={phase !== 'input'}
            style={styles.panelWrapper}
          >
            <Animated.View
              style={[
                styles.panel,
                { backgroundColor: activePanel === i ? panel.color : panel.dimColor },
                panelStyles[i],
              ]}
            >
              <Text style={[styles.panelLabel, { color: panel.color }]}>{panel.label}</Text>
            </Animated.View>
          </Pressable>
        ))}
      </View>

      {phase === 'idle' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>SIMON SAYS</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Watch the sequence — repeat it back</Text>
          </View>
        </TouchableWithoutFeedback>
      )}

      {phase === 'over' && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>WRONG!</Text>
            <Text style={styles.finalScoreText}>Round: {score}</Text>
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
    backgroundColor: '#0a0a1e',
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
    color: '#ffd700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  phaseLabel: {
    color: '#ffffff80',
    fontSize: 14,
    fontStyle: 'italic',
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  panelsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  panelWrapper: {
    width: PANEL_SIZE,
    height: PANEL_SIZE,
  },
  panel: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a1edd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#ffd700',
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
    color: '#ff4444',
    fontSize: 40,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  finalScoreText: {
    color: '#ffd700',
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
