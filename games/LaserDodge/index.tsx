import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ARENA_PADDING = 30;
const ARENA_TOP = 140;
const ARENA_LEFT = ARENA_PADDING;
const ARENA_WIDTH = SCREEN_WIDTH - ARENA_PADDING * 2;
const ARENA_HEIGHT = SCREEN_HEIGHT - ARENA_TOP - 100;
const PLAYER_SIZE = 30;
const MAX_LASERS = 8;
const STORAGE_KEY = "@laser-dodge/highscore";

type GamePhase = "idle" | "playing" | "over";
type LaserEdge = "top" | "bottom" | "left" | "right";
type LaserState = "inactive" | "warning" | "firing";

interface LaserData {
  edge: LaserEdge;
  position: number; // 0-1 along edge
  state: LaserState;
  timer: number;
  warningDuration: number;
  fireDuration: number;
}

export default function LaserDodge() {
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [survivalTime, setSurvivalTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  const phaseRef = useRef<GamePhase>("idle");
  const timeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const difficultyRef = useRef(1);
  const lasersRef = useRef<LaserData[]>(
    Array.from(
      { length: MAX_LASERS },
      (): LaserData => ({
        edge: "top",
        position: 0.5,
        state: "inactive",
        timer: 0,
        warningDuration: 1200,
        fireDuration: 500,
      }),
    ),
  );

  const playerX = useSharedValue(ARENA_WIDTH / 2);
  const playerY = useSharedValue(ARENA_HEIGHT / 2);
  const isPlaying = useSharedValue(false);
  const startX = useSharedValue(ARENA_WIDTH / 2);
  const startY = useSharedValue(ARENA_HEIGHT / 2);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const laserOpacity0 = useSharedValue(0);
  const laserOpacity1 = useSharedValue(0);
  const laserOpacity2 = useSharedValue(0);
  const laserOpacity3 = useSharedValue(0);
  const laserOpacity4 = useSharedValue(0);
  const laserOpacity5 = useSharedValue(0);
  const laserOpacity6 = useSharedValue(0);
  const laserOpacity7 = useSharedValue(0);
  const laserOpacities = useMemo(
    () => [
      laserOpacity0,
      laserOpacity1,
      laserOpacity2,
      laserOpacity3,
      laserOpacity4,
      laserOpacity5,
      laserOpacity6,
      laserOpacity7,
    ],
    [
      laserOpacity0,
      laserOpacity1,
      laserOpacity2,
      laserOpacity3,
      laserOpacity4,
      laserOpacity5,
      laserOpacity6,
      laserOpacity7,
    ],
  );

  const laserThickness0 = useSharedValue(1);
  const laserThickness1 = useSharedValue(1);
  const laserThickness2 = useSharedValue(1);
  const laserThickness3 = useSharedValue(1);
  const laserThickness4 = useSharedValue(1);
  const laserThickness5 = useSharedValue(1);
  const laserThickness6 = useSharedValue(1);
  const laserThickness7 = useSharedValue(1);
  const laserThicknesses = useMemo(
    () => [
      laserThickness0,
      laserThickness1,
      laserThickness2,
      laserThickness3,
      laserThickness4,
      laserThickness5,
      laserThickness6,
      laserThickness7,
    ],
    [
      laserThickness0,
      laserThickness1,
      laserThickness2,
      laserThickness3,
      laserThickness4,
      laserThickness5,
      laserThickness6,
      laserThickness7,
    ],
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setBestTime(parseFloat(val));
    });
  }, []);

  const updateTime = useCallback((t: number) => {
    setSurvivalTime(t);
  }, []);

  const triggerGameOver = useCallback(async () => {
    phaseRef.current = "over";
    isPlaying.value = false;
    setPhase("over");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const finalTime = Math.floor(timeRef.current * 10) / 10;
    setSurvivalTime(finalTime);
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const prev = stored ? parseFloat(stored) : 0;
    if (finalTime > prev) {
      await AsyncStorage.setItem(STORAGE_KEY, finalTime.toString());
      setBestTime(finalTime);
    }
  }, [isPlaying]);

  const spawnLaser = useCallback(() => {
    const lasers = lasersRef.current;
    const idx = lasers.findIndex((l) => l.state === "inactive");
    if (idx === -1) return;

    const edges: LaserEdge[] = ["top", "bottom", "left", "right"];
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const position = 0.1 + Math.random() * 0.8;
    const diff = difficultyRef.current;
    const warningDuration = Math.max(140, 520 - diff * 30);
    const fireDuration = 420;

    lasers[idx] = {
      edge,
      position,
      state: "warning",
      timer: 0,
      warningDuration,
      fireDuration,
    };
    laserOpacities[idx].value = 0.45;
    laserThicknesses[idx].value = 3;
  }, [laserOpacities, laserThicknesses]);

  const tick = useCallback(
    (dt: number) => {
      if (phaseRef.current !== "playing") return;

      timeRef.current += dt / 1000;
      difficultyRef.current = 1 + timeRef.current / 5;

      if (Math.floor(timeRef.current * 10) % 3 === 0) {
        updateTime(Math.floor(timeRef.current * 10) / 10);
      }

      // Spawn
      spawnTimerRef.current += dt;
      const spawnInterval = Math.max(200, 800 - difficultyRef.current * 60);
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0;
        spawnLaser();
      }

      // Update lasers & collision
      const lasers = lasersRef.current;
      const px = playerX.value;
      const py = playerY.value;

      for (let i = 0; i < MAX_LASERS; i++) {
        const l = lasers[i];
        if (l.state === "inactive") continue;

        l.timer += dt;

        if (l.state === "warning" && l.timer >= l.warningDuration) {
          l.state = "firing";
          l.timer = 0;
          laserOpacities[i].value = 1;
          laserThicknesses[i].value = 10;
        } else if (l.state === "firing" && l.timer >= l.fireDuration) {
          l.state = "inactive";
          laserOpacities[i].value = 0;
          laserThicknesses[i].value = 1;
          continue;
        }

        // Collision with firing lasers
        if (l.state === "firing") {
          const halfPlayer = PLAYER_SIZE / 2;
          let hit = false;

          if (l.edge === "top" || l.edge === "bottom") {
            const laserX = l.position * ARENA_WIDTH;
            if (Math.abs(px - laserX) < halfPlayer + 4) hit = true;
          } else {
            const laserY = l.position * ARENA_HEIGHT;
            if (Math.abs(py - laserY) < halfPlayer + 4) hit = true;
          }

          if (hit) {
            triggerGameOver();
            return;
          }
        }
      }
    },
    [
      playerX,
      playerY,
      spawnLaser,
      triggerGameOver,
      updateTime,
      laserOpacities,
      laserThicknesses,
    ],
  );

  useEffect(() => {
    if (phase !== "playing") {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (phaseRef.current !== "playing") {
        lastFrameTimeRef.current = null;
        return;
      }

      const last = lastFrameTimeRef.current ?? timestamp;
      const dt = Math.max(0, timestamp - last);
      lastFrameTimeRef.current = timestamp;
      tick(dt);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [phase, tick]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = playerX.value;
      startY.value = playerY.value;
    })
    .onUpdate((e) => {
      if (!isPlaying.value) return;
      const newX = Math.max(
        PLAYER_SIZE / 2,
        Math.min(ARENA_WIDTH - PLAYER_SIZE / 2, startX.value + e.translationX),
      );
      const newY = Math.max(
        PLAYER_SIZE / 2,
        Math.min(ARENA_HEIGHT - PLAYER_SIZE / 2, startY.value + e.translationY),
      );
      playerX.value = newX;
      playerY.value = newY;
    });

  const startGame = useCallback(() => {
    if (phase === "idle" || phase === "over") {
      phaseRef.current = "playing";
      isPlaying.value = true;
      setPhase("playing");
      timeRef.current = 0;
      setSurvivalTime(0);
      spawnTimerRef.current = 0;
      difficultyRef.current = 1;
      playerX.value = ARENA_WIDTH / 2;
      playerY.value = ARENA_HEIGHT / 2;
      startX.value = ARENA_WIDTH / 2;
      startY.value = ARENA_HEIGHT / 2;
      lasersRef.current.forEach((l, i) => {
        l.state = "inactive";
        l.timer = 0;
        laserOpacities[i].value = 0;
        laserThicknesses[i].value = 1;
      });
    }
  }, [
    phase,
    isPlaying,
    playerX,
    playerY,
    startX,
    startY,
    laserOpacities,
    laserThicknesses,
  ]);

  const playerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: playerX.value - PLAYER_SIZE / 2 },
      { translateY: playerY.value - PLAYER_SIZE / 2 },
    ],
  }));

  const laserStyle0 = useAnimatedStyle(() => ({
    opacity: laserOpacity0.value,
  }));
  const laserStyle1 = useAnimatedStyle(() => ({
    opacity: laserOpacity1.value,
  }));
  const laserStyle2 = useAnimatedStyle(() => ({
    opacity: laserOpacity2.value,
  }));
  const laserStyle3 = useAnimatedStyle(() => ({
    opacity: laserOpacity3.value,
  }));
  const laserStyle4 = useAnimatedStyle(() => ({
    opacity: laserOpacity4.value,
  }));
  const laserStyle5 = useAnimatedStyle(() => ({
    opacity: laserOpacity5.value,
  }));
  const laserStyle6 = useAnimatedStyle(() => ({
    opacity: laserOpacity6.value,
  }));
  const laserStyle7 = useAnimatedStyle(() => ({
    opacity: laserOpacity7.value,
  }));
  const laserStyles = useMemo(
    () => [
      laserStyle0,
      laserStyle1,
      laserStyle2,
      laserStyle3,
      laserStyle4,
      laserStyle5,
      laserStyle6,
      laserStyle7,
    ],
    [
      laserStyle0,
      laserStyle1,
      laserStyle2,
      laserStyle3,
      laserStyle4,
      laserStyle5,
      laserStyle6,
      laserStyle7,
    ],
  );

  const renderLasers = () => {
    return lasersRef.current.map((laser, i) => {
      if (laser.state === "inactive") return null;
      const isVertical = laser.edge === "top" || laser.edge === "bottom";
      const thickness = laser.state === "firing" ? 10 : 3;
      const color = laser.state === "firing" ? "#ff0040" : "#ff004066";

      if (isVertical) {
        const x = laser.position * ARENA_WIDTH;
        return (
          <Animated.View
            key={`laser-${i}`}
            style={[
              {
                position: "absolute",
                left: x - thickness / 2,
                top: 0,
                width: thickness,
                height: ARENA_HEIGHT,
                backgroundColor: color,
                shadowColor: "#ff0040",
                shadowOpacity: laser.state === "firing" ? 0.8 : 0.2,
                shadowRadius: laser.state === "firing" ? 15 : 3,
                shadowOffset: { width: 0, height: 0 },
              },
              laserStyles[i],
            ]}
          />
        );
      } else {
        const y = laser.position * ARENA_HEIGHT;
        return (
          <Animated.View
            key={`laser-${i}`}
            style={[
              {
                position: "absolute",
                top: y - thickness / 2,
                left: 0,
                height: thickness,
                width: ARENA_WIDTH,
                backgroundColor: color,
                shadowColor: "#ff0040",
                shadowOpacity: laser.state === "firing" ? 0.8 : 0.2,
                shadowRadius: laser.state === "firing" ? 15 : 3,
                shadowOffset: { width: 0, height: 0 },
              },
              laserStyles[i],
            ]}
          />
        );
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.timeText}>{survivalTime.toFixed(1)}s</Text>
        <Text style={styles.bestText}>Best: {bestTime.toFixed(1)}s</Text>
      </View>

      {/* Arena */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.arena}>
          {/* Lasers */}
          {renderLasers()}

          {/* Player */}
          <Animated.View style={[styles.playerOuter, playerStyle]}>
            <View style={styles.playerGlow} />
            <View style={styles.player} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Overlays */}
      {phase === "idle" && (
        <TouchableWithoutFeedback onPress={startGame}>
          <View style={styles.overlay}>
            <Text style={styles.titleText}>LASER DODGE</Text>
            <Text style={styles.subtitleText}>Tap to Start</Text>
            <Text style={styles.hintText}>Drag to move, dodge the lasers</Text>
          </View>
        </TouchableWithoutFeedback>
      )}

      {phase === "over" && (
        <TouchableWithoutFeedback onPress={startGame}>
          <View style={styles.overlay}>
            <Text style={styles.gameOverText}>GAME OVER</Text>
            <Text style={styles.finalTimeText}>{survivalTime.toFixed(1)}s</Text>
            <Text style={styles.bestDisplay}>Best: {bestTime.toFixed(1)}s</Text>
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
    backgroundColor: "#0a0014",
  },
  hud: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: 20,
    paddingLeft: 72,
    zIndex: 10,
  },
  timeText: {
    color: "#00f5ff",
    fontSize: 24,
    fontWeight: "bold",
  },
  bestText: {
    color: "#ffffff80",
    fontSize: 16,
    alignSelf: "center",
  },
  arena: {
    position: "absolute",
    top: ARENA_TOP,
    left: ARENA_LEFT,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    borderWidth: 1,
    borderColor: "#ff004040",
    borderRadius: 4,
    overflow: "hidden",
  },
  playerOuter: {
    position: "absolute",
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  player: {
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    backgroundColor: "#00f5ff",
  },
  playerGlow: {
    position: "absolute",
    width: PLAYER_SIZE + 20,
    height: PLAYER_SIZE + 20,
    borderRadius: (PLAYER_SIZE + 20) / 2,
    backgroundColor: "#00f5ff25",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0014dd",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  titleText: {
    color: "#ff0040",
    fontSize: 36,
    fontWeight: "bold",
    letterSpacing: 4,
    marginBottom: 20,
  },
  subtitleText: {
    color: "#ffffff90",
    fontSize: 18,
    marginTop: 20,
  },
  hintText: {
    color: "#ffffff50",
    fontSize: 14,
    marginTop: 10,
  },
  gameOverText: {
    color: "#ff0040",
    fontSize: 36,
    fontWeight: "bold",
    letterSpacing: 3,
  },
  finalTimeText: {
    color: "#00f5ff",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 16,
  },
  bestDisplay: {
    color: "#feca57",
    fontSize: 20,
    marginTop: 8,
  },
});
