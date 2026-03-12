import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { allGames } from '@/games/registry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const [highScores, setHighScores] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      const keys = allGames.map((g) => g.storageKey);
      AsyncStorage.multiGet(keys).then((results) => {
        const scores: Record<string, string> = {};
        results.forEach(([key, value]) => {
          if (value) scores[key] = value;
        });
        setHighScores(scores);
      });
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ARCADE</Text>
        <Text style={styles.subtitle}>{allGames.length} Games</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {allGames.map((game) => {
          const score = highScores[game.storageKey];
          return (
            <Pressable
              key={game.id}
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: pressed ? game.color : game.color + '40',
                  shadowColor: game.color,
                  shadowOpacity: pressed ? 0.6 : 0.2,
                },
              ]}
              onPress={() => router.push(`/game/${game.id}`)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: game.color + '15' },
                ]}
              >
                <Ionicons
                  name={game.icon as any}
                  size={28}
                  color={game.color}
                />
              </View>
              <Text style={[styles.cardTitle, { color: game.color }]}>
                {game.name}
              </Text>
              <Text style={styles.cardDescription}>{game.description}</Text>
              {score && (
                <Text style={styles.cardScore}>
                  Best: {score}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 16,
    textShadowColor: 'rgba(0,245,255,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 4,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: CARD_GAP,
    paddingBottom: 40,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 16,
  },
  cardScore: {
    fontSize: 11,
    color: '#feca57',
    marginTop: 8,
    fontWeight: '600',
  },
});
