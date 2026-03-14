# Multi-Game React Native App — Architecture & Cursor Guide

## 🎯 Purpose & Goal

This project builds multiple simple mobile games using React Native and Expo.
Each game is published as a completely separate app on the Google Play Store and
Apple App Store, with its own app name, icon, splash screen, bundle ID, and store listing.

### What this architecture achieves:
- Maintain ALL games inside a single codebase/repository for efficient development
- Share common infrastructure across all games: ad integration, game UI components,
  audio, score tracking, and analytics
- Compile and ship each game as a fully independent APK/AAB/IPA using Expo EAS build
  profiles and environment-variable-driven app.config.js
- Each game is publishable independently — no game's release affects others
- Monetize each game with AdMob (interstitial + banner ads) with per-game ad unit IDs

### What this is NOT:
This is NOT a monorepo with separate packages (no Turborepo, Nx, or Yarn Workspaces).
It is a single Expo app whose identity (name, icon, bundleId, splash) is dynamically
switched at build time using APP_VARIANT environment variables read inside app.config.js.

---

## 📁 Folder Structure

/assets
/shared/ ← shared fonts, sounds, common images
/snake/ ← icon.png (1024x1024), splash.png, adaptive-icon.png
/puzzle/
/flappy/
... (one folder per game)

/src
/games/
/snake/
index.tsx ← game entry point (default export = game screen)
GameScreen.tsx
engine.ts ← game loop / logic
constants.ts
/puzzle/
index.tsx
GameScreen.tsx
engine.ts
constants.ts
/flappy/
...

/shared/
/ads/
AdManager.ts ← initialize AdMob, expose showInterstitial(), showBanner()
adUnitIds.ts ← map of APP_VARIANT → ad unit IDs (test IDs as fallback)
/components/
PauseMenu.tsx
ScoreBoard.tsx
GameOverModal.tsx
SoundToggle.tsx
/hooks/
useGameLoop.ts ← requestAnimationFrame-based game loop hook
useScore.ts
useSoundEffects.ts
/utils/
storage.ts ← AsyncStorage helpers for high score persistence
analytics.ts ← Firebase/Mixpanel event tracking wrapper
/navigation/
RootNavigator.tsx ← simple stack: Splash → Home → Game

/config/
games.config.ts ← central registry of all games with metadata

/store-assets/
/snake/ ← Play Store screenshots, feature graphic, description.txt
/puzzle/
/flappy/

app.config.js ← dynamic config driven by APP_VARIANT env variable
eas.json ← one build profile per game per environment
.env.snake ← env vars for snake game (AD_UNIT_INTERSTITIAL, etc.)
.env.puzzle

text

---

## ⚙️ Implementation Details

### 1. `app.config.js` — Dynamic App Identity

Replace or extend `app.json` with a dynamic `app.config.js` that:
- Reads `process.env.APP_VARIANT` (e.g., `"snake"`, `"puzzle"`, `"flappy"`)
- Switches `name`, `slug`, `ios.bundleIdentifier`, `android.package`,
  `android.adaptiveIcon.foregroundImage`, `icon`, `splash.image` per variant
- Falls back to a default dev variant if APP_VARIANT is not set
- Keeps `version`, `sdkVersion`, and `plugins` shared across all variants

```js
// app.config.js
const GAMES = {
  snake: {
    name: "Snake Classic",
    slug: "snake-classic",
    icon: "./assets/snake/icon.png",
    splash: "./assets/snake/splash.png",
    bundleId: "com.yourname.snake",
    androidPackage: "com.yourname.snake",
  },
  puzzle: {
    name: "Block Puzzle",
    slug: "block-puzzle",
    icon: "./assets/puzzle/icon.png",
    splash: "./assets/puzzle/splash.png",
    bundleId: "com.yourname.puzzle",
    androidPackage: "com.yourname.puzzle",
  },
};

const variant = process.env.APP_VARIANT || "snake";
const game = GAMES[variant];

export default {
  name: game.name,
  slug: game.slug,
  version: "1.0.0",
  icon: game.icon,
  splash: { image: game.splash, resizeMode: "contain", backgroundColor: "#000000" },
  ios: { bundleIdentifier: game.bundleId, supportsTablet: false },
  android: {
    package: game.androidPackage,
    adaptiveIcon: { foregroundImage: game.icon, backgroundColor: "#000000" },
  },
  plugins: ["react-native-google-mobile-ads"],
};
2. src/config/games.config.ts — Game Registry
Central registry that maps APP_VARIANT to all game metadata.
This is the single source of truth for adding a new game.

ts
// src/config/games.config.ts
export type GameVariant = "snake" | "puzzle" | "flappy";

export interface GameConfig {
  displayName: string;
  primaryColor: string;
  backgroundColor: string;
  accentColor: string;
  adUnits: {
    interstitial: string;
    banner: string;
    rewarded?: string;
  };
}

const TEST_IDS = {
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  banner: "ca-app-pub-3940256099942544/6300978111",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
};

export const GAMES_CONFIG: Record<GameVariant, GameConfig> = {
  snake: {
    displayName: "Snake Classic",
    primaryColor: "#4CAF50",
    backgroundColor: "#1a1a2e",
    accentColor: "#FFD700",
    adUnits: __DEV__ ? TEST_IDS : {
      interstitial: "ca-app-pub-XXXX/YYYY",
      banner: "ca-app-pub-XXXX/ZZZZ",
    },
  },
  puzzle: {
    displayName: "Block Puzzle",
    primaryColor: "#2196F3",
    backgroundColor: "#0d0d1a",
    accentColor: "#FF5722",
    adUnits: __DEV__ ? TEST_IDS : {
      interstitial: "ca-app-pub-XXXX/AAAA",
      banner: "ca-app-pub-XXXX/BBBB",
    },
  },
  flappy: {
    displayName: "Flappy Bird",
    primaryColor: "#FF9800",
    backgroundColor: "#87CEEB",
    accentColor: "#4CAF50",
    adUnits: __DEV__ ? TEST_IDS : {
      interstitial: "ca-app-pub-XXXX/CCCC",
      banner: "ca-app-pub-XXXX/DDDD",
    },
  },
};

export const currentVariant = (process.env.APP_VARIANT || "snake") as GameVariant;
export const currentGameConfig = GAMES_CONFIG[currentVariant];

3. src/shared/ads/AdManager.ts
Ad integration using react-native-google-mobile-ads:

ts
// src/shared/ads/AdManager.ts
import {
  InterstitialAd,
  AdEventType,
  MobileAds,
} from "react-native-google-mobile-ads";
import { currentGameConfig } from "../../config/games.config";

let interstitial: InterstitialAd | null = null;

export const initializeAds = async () => {
  await MobileAds().initialize();
  loadInterstitial();
};

const loadInterstitial = () => {
  interstitial = InterstitialAd.createForAdRequest(
    currentGameConfig.adUnits.interstitial
  );
  interstitial.addAdEventListener(AdEventType.CLOSED, () => loadInterstitial());
  interstitial.load();
};

export const showInterstitial = (): Promise<void> => {
  return new Promise((resolve) => {
    if (interstitial?.loaded) {
      interstitial.addAdEventListener(AdEventType.CLOSED, () => resolve());
      interstitial.show();
    } else {
      resolve(); // fail gracefully
    }
  });
};

4. src/shared/hooks/useGameLoop.ts
Reusable requestAnimationFrame game loop:

ts
// src/shared/hooks/useGameLoop.ts
import { useEffect, useRef, useState } from "react";

export const useGameLoop = (
  update: (deltaTime: number) => void,
  isRunning: boolean
) => {
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = (timestamp: number) => {
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      setFps(Math.round(1000 / delta));
      update(delta);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, update]);

  return { fps };
};

5. eas.json — Build Profiles
One preview (APK) and one production (AAB) profile per game:

json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "snake-preview": {
      "env": { "APP_VARIANT": "snake" },
      "android": { "buildType": "apk" }
    },
    "snake-production": {
      "env": { "APP_VARIANT": "snake" },
      "android": { "buildType": "app-bundle" }
    },
    "puzzle-preview": {
      "env": { "APP_VARIANT": "puzzle" },
      "android": { "buildType": "apk" }
    },
    "puzzle-production": {
      "env": { "APP_VARIANT": "puzzle" },
      "android": { "buildType": "app-bundle" }
    },
    "flappy-preview": {
      "env": { "APP_VARIANT": "flappy" },
      "android": { "buildType": "apk" }
    },
    "flappy-production": {
      "env": { "APP_VARIANT": "flappy" },
      "android": { "buildType": "app-bundle" }
    }
  }
}

6. App.tsx — Entry Point
tsx
// App.tsx
import React, { useEffect } from "react";
import { currentVariant } from "./src/config/games.config";
import { initializeAds } from "./src/shared/ads/AdManager";
import RootNavigator from "./src/shared/navigation/RootNavigator";

export default function App() {
  useEffect(() => {
    initializeAds();
  }, []);

  return <RootNavigator variant={currentVariant} />;
}

7. package.json Scripts
json
"scripts": {
  "start:snake": "APP_VARIANT=snake expo start",
  "start:puzzle": "APP_VARIANT=puzzle expo start",
  "start:flappy": "APP_VARIANT=flappy expo start",
  "build:snake": "eas build --profile snake-production --platform android",
  "build:puzzle": "eas build --profile puzzle-production --platform android",
  "build:flappy": "eas build --profile flappy-production --platform android",
  "build:all:android": "npm run build:snake && npm run build:puzzle && npm run build:flappy",
  "preview:snake": "eas build --profile snake-preview --platform android",
  "preview:puzzle": "eas build --profile puzzle-preview --platform android"
}

🔒 Rules & Constraints
Use TypeScript throughout — strict mode preferred

Use react-native-google-mobile-ads (not the deprecated expo-ads-admob)

Do NOT use monorepo tooling (Turborepo, Nx, Yarn Workspaces)

Do NOT hardcode any game-specific values outside of games.config.ts and app.config.js

Each game in /src/games/<name>/ must be self-contained — no cross-game imports

Shared components in /src/shared/ must be game-agnostic (no game-specific logic inside)

AsyncStorage keys must be namespaced by game: @snake/highscore, @puzzle/highscore

All ad unit IDs must live in games.config.ts, never inline in components

Store assets (screenshots, descriptions) live in /store-assets/<game>/ and are
uploaded manually per Play Store / App Store listing — independent of the codebase

📦 Checklist: Adding a New Game
When adding a new game called X, follow this checklist in order:

 Create /src/games/X/ with index.tsx, GameScreen.tsx, engine.ts, constants.ts

 Add X to the GameVariant type and GAMES_CONFIG in games.config.ts

 Add X's asset folder /assets/X/ with placeholder icon.png and splash.png

 Add X's variant entry to the GAMES map in app.config.js

 Add X-preview and X-production build profiles to eas.json

 Add start:X, preview:X, and build:X scripts to package.json

 Create /store-assets/X/ folder with a description.txt template

 Register the game's component in RootNavigator.tsx

🚀 Cursor AI Instructions
When using Cursor to implement or extend this architecture:

Always run @Codebase analysis first before making changes — identify existing
files that need to be moved vs modified vs created fresh

Migration order: app.config.js → games.config.ts → AdManager.ts →
eas.json → useGameLoop.ts → RootNavigator.tsx → individual game screens

When adding a new game: Reference this file with @ARCHITECTURE.md and say
"Add a new game called X following the checklist in ARCHITECTURE.md"

If app.json exists: Convert it to app.config.js while preserving all
existing Expo config values — do not discard existing plugin or permission configs

Show proposed file tree first, then implement file by file with no skipped steps

🗺️ How It All Connects
text
APP_VARIANT=snake (env var)
       │
       ▼
app.config.js        → sets app name, icon, bundleId for THIS build
games.config.ts      → provides theme colors, ad unit IDs for THIS game
       │
       ▼
App.tsx              → initializeAds() + renders RootNavigator
RootNavigator.tsx    → loads the correct game component based on variant
       │
       ▼
/src/games/snake/    → self-contained game logic and screens
/src/shared/ads/     → AdMob integration (shared, config-driven)
/src/shared/hooks/   → useGameLoop, useScore (shared, game-agnostic)
       │
       ▼
eas build --profile snake-production
       │
       ▼
Standalone Snake APK/AAB → uploaded to Play Store as its own app listing