import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { showRewarded } from '@/shared/ads/AdManager';

interface GameOverScreenProps {
  score: number;
  highScore: number;
  /** Label for the score (default: "Score") — use "Time" for survival games */
  scoreLabel?: string;
  /** Format the score for display (default: String(score)) */
  formatScore?: (score: number) => string;
  /** Accent color for buttons and highlights */
  accentColor?: string;
  /** Called when user taps Replay — should start game immediately (no ad) */
  onReplay: () => void;
  /**
   * Called when user earns continue reward — game-specific resume logic.
   * If not provided, Continue button is hidden entirely.
   */
  onContinue?: () => void;
  /** Description shown below Continue button explaining the reward */
  continueSubtext?: string;
  /**
   * Whether to show the Continue button. Set to false when:
   * - An interstitial just played (no back-to-back ads)
   * - Player already used continue this session
   */
  showContinue?: boolean;
}

export default function GameOverScreen({
  score,
  highScore,
  scoreLabel = 'Score',
  formatScore,
  accentColor = '#00f5ff',
  onReplay,
  onContinue,
  continueSubtext,
  showContinue = true,
}: GameOverScreenProps) {
  const router = useRouter();
  const isNewHigh = score > 0 && score >= highScore;
  const displayScore = formatScore ? formatScore(score) : String(score);
  const displayBest = formatScore ? formatScore(highScore) : String(highScore);
  const [loadingAd, setLoadingAd] = useState(false);

  const canContinue = showContinue && !!onContinue && !loadingAd;

  const handleContinue = async () => {
    if (!onContinue) return;
    setLoadingAd(true);
    try {
      const earned = await showRewarded();
      if (earned) {
        onContinue();
      }
    } finally {
      setLoadingAd(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Text style={styles.gameOverText}>GAME OVER</Text>

      {isNewHigh && (
        <Text style={styles.newHighText}>★ NEW HIGH SCORE ★</Text>
      )}

      <Text style={[styles.scoreText, { color: accentColor }]}>
        {scoreLabel}: {displayScore}
      </Text>

      {!isNewHigh && (
        <Text style={styles.bestText}>Best: {displayBest}</Text>
      )}

      {/* Continue button — opt-in rewarded ad */}
      {canContinue && (
        <View style={styles.continueContainer}>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: accentColor }]}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>
              ▶ CONTINUE
            </Text>
          </TouchableOpacity>
          {continueSubtext && (
            <Text style={styles.continueSubtext}>{continueSubtext}</Text>
          )}
        </View>
      )}

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.button, { borderColor: accentColor }]}
          onPress={onReplay}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, { color: accentColor }]}>REPLAY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.menuButton]}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, styles.menuButtonText]}>MAIN MENU</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    gap: 12,
  },
  gameOverText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ff4444',
    letterSpacing: 6,
    textShadowColor: 'rgba(255, 68, 68, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    marginBottom: 4,
  },
  newHighText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffd700',
    letterSpacing: 3,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  bestText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  continueContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 10,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 2,
  },
  continueSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 15,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  menuButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  menuButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
