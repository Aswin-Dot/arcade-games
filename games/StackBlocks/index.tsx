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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameLoop } from '../../shared/hooks/useGameLoop';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = '@stack-blocks/highscore';
const BLOCK_HEIGHT = 44;
const STACK_BASE_Y = SCREEN_HEIGHT - 140;
const INITIAL_WIDTH = SCREEN_WIDTH * 0.55;
const MIN_BLOCK_WIDTH = 20;
const SPEED_START = 200; // px/s

type GamePhase = 'idle' | 'playing' | 'over';

interface PlacedBlock {
  x: number;
  width: number;
  color: string;
}

const BLOCK_COLORS = [
  '#00f5ff', '#a855f7', '#f472b6', '#fb923c',
  '#facc15', '#4ade80', '#38bdf8', '#f87171',
];

export default function StackBlocks() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [placedBlocks, setPlacedBlocks] = useState<PlacedBlock[]>([]);
  const [currentWidth, setCurrentWidth] = useState(INITIAL_WIDTH);

  const phaseRef = useRef<GamePhase>('idle');
  const scoreRef = useRef(0);
  const placedBlocksRef = useRef<PlacedBlock[]>([]);
  const currentWidthRef = useRef(INITIAL_WIDTH);
  const positionRef = useRef(0); // left edge of sliding block
  const directionRef = useRef(1); // 1 = right, -1 = left
  const speedRef = useRef(SPEED_START);
  const colorIdxRef = useRef(0);

  const blockX = useSharedValue(0);
  const blockWidth = useSharedValue(INITIAL_WIDTH);

  const slidingStyle = useAnimatedStyle(() => ({
    left: blockX.value,
    width: blockWidth.value,
  }));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setHighScore(parseInt(val, 10));
    });
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

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const dtSec = dt / 1000;
      const w = currentWidthRef.current;
      const maxLeft = SCREEN_WIDTH - w;

      positionRef.current += directionRef.current * speedRef.current * dtSec;

      if (positionRef.current >= maxLeft) {
        positionRef.current = maxLeft;
        directionRef.current = -1;
      } else if (positionRef.current <= 0) {
        positionRef.current = 0;
        directionRef.current = 1;
      }

      blockX.value = positionRef.current;
    },
    [blockX],
  );

  useGameLoop(tick, phase === 'playing');

  const handleTap = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
      // Start / restart
      const initialWidth = INITIAL_WIDTH;
      scoreRef.current = 0;
      colorIdxRef.current = 0;
      currentWidthRef.current = initialWidth;
      positionRef.current = 0;
      directionRef.current = 1;
      speedRef.current = SPEED_START;

      blockX.value = 0;
      blockWidth.value = initialWidth;

      const base: PlacedBlock = {
        x: (SCREEN_WIDTH - initialWidth) / 2,
        width: initialWidth,
        color: BLOCK_COLORS[0],
      };
      placedBlocksRef.current = [base];
      setPlacedBlocks([base]);
      setCurrentWidth(initialWidth);
      setScore(0);
      colorIdxRef.current = 1;

      phaseRef.current = 'playing';
      setPhase('playing');
      return;
    }

    if (phaseRef.current !== 'playing') return;

    // Drop the block
    const placed = placedBlocksRef.current;
    const lastBlock = placed[placed.length - 1];
    const curX = positionRef.current;
    const curW = currentWidthRef.current;

    const overlapLeft = Math.max(curX, lastBlock.x);
    const overlapRight = Math.min(curX + curW, lastBlock.x + lastBlock.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      triggerGameOver();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newBlock: PlacedBlock = {
      x: overlapLeft,
      width: overlapWidth,
      color: BLOCK_COLORS[colorIdxRef.current % BLOCK_COLORS.length],
    };
    colorIdxRef.current += 1;

    const newPlaced = [...placed, newBlock];
    placedBlocksRef.current = newPlaced;
    setPlacedBlocks(newPlaced);

    scoreRef.current += 1;
    setScore(scoreRef.current);

    // Next block setup
    currentWidthRef.current = overlapWidth;
    setCurrentWidth(overlapWidth);
    blockWidth.value = overlapWidth;
    positionRef.current = 0;
    directionRef.current = 1;
    blockX.value = 0;

    // Speed increases
    speedRef.current = SPEED_START + scoreRef.current * 12;

    if (overlapWidth < MIN_BLOCK_WIDTH) {
      triggerGameOver();
    }
  }, [blockX, blockWidth, triggerGameOver]);

  // Compute vertical offset so blocks stack upward from base
  const blockCount = placedBlocks.length;
  const stackY = STACK_BASE_Y - (blockCount - 1) * BLOCK_HEIGHT;
  // Only show the most recent ~8 placed blocks to avoid clutter
  const visibleBlocks = placedBlocks.slice(-10);

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>
        {/* HUD */}
        <View style={styles.hud}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.highScoreText}>Best: {highScore}</Text>
        </View>

        {/* Stack */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {visibleBlocks.map((b, i) => {
            const globalIdx = placedBlocks.length - visibleBlocks.length + i;
            const yPos = STACK_BASE_Y - globalIdx * BLOCK_HEIGHT;
            return (
              <View
                key={`block-${globalIdx}`}
                style={[
                  styles.placedBlock,
                  {
                    left: b.x,
                    top: yPos,
                    width: b.width,
                    backgroundColor: b.color,
                  },
                ]}
              />
            );
          })}

          {/* Sliding block */}
          {phase === 'playing' && (
            <Animated.View
              style={[
                styles.slidingBlock,
                slidingStyle,
                {
                  top: stackY - BLOCK_HEIGHT,
                  backgroundColor:
                    BLOCK_COLORS[colorIdxRef.current % BLOCK_COLORS.length],
                },
              ]}
            />
          )}
        </View>

        {/* Base platform */}
        <View style={styles.basePlatform} />

        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.titleText}>STACK</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Tap to drop blocks — stack as high as you can</Text>
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
    paddingHorizontal: 20,
    paddingLeft: 72,
    zIndex: 10,
  },
  scoreText: {
    color: '#00f5ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  highScoreText: {
    color: '#ffffff80',
    fontSize: 14,
  },
  placedBlock: {
    position: 'absolute',
    height: BLOCK_HEIGHT - 2,
    borderRadius: 6,
  },
  slidingBlock: {
    position: 'absolute',
    height: BLOCK_HEIGHT - 2,
    borderRadius: 6,
  },
  basePlatform: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#ffffff20',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d2bdd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  titleText: {
    color: '#00f5ff',
    fontSize: 44,
    fontWeight: 'bold',
    letterSpacing: 8,
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
    color: '#f472b6',
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
  bestDisplay: {
    color: '#a855f7',
    fontSize: 20,
    marginTop: 8,
  },
});
