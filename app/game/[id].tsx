import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { allGames } from '@/games/registry';
import { configuredVariant } from '@/config/games.config';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const activeId = configuredVariant ?? id;
  const game = allGames.find((g) => g.id === activeId);

  if (configuredVariant && id !== configuredVariant) {
    return <Redirect href={`/game/${configuredVariant}`} />;
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Game not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const GameComponent = game.component;

  return (
    <View style={styles.container}>
      <GameComponent />
      {!configuredVariant && (
        <Pressable
          style={[styles.floatingBack, { borderColor: game.color + '80' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  floatingBack: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  backBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#ffffff40',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
  },
});
