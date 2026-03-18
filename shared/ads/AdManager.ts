/**
 * AdManager — TopOn ADX v6.4.87
 *
 * Uses react-native-topon (TurboModule bridge) for Interstitial and Rewarded ads.
 * No Google/AdMob dependency — TopOn mediates directly across 15+ ad networks.
 *
 * Ad flow:
 *   initializeAds() → SDK.init(appId, appKey)
 *                   → loadInterstitial() + loadRewarded()
 *                   → auto-reload on Close event
 *
 * ATT (iOS 14+):
 *   requestTrackingPermissionsAsync() fires BEFORE SDK.init so TopOn
 *   receives the IDFA if the user grants permission.
 *
 * Env vars (set per build profile in eas.json):
 *   EXPO_PUBLIC_TOPON_APP_ID          — TopOn App ID for this game
 *   EXPO_PUBLIC_TOPON_APP_KEY         — TopOn App Key for this game
 *   EXPO_PUBLIC_TOPON_INTERSTITIAL_ID — Interstitial placement ID
 *   EXPO_PUBLIC_TOPON_REWARDED_ID     — Rewarded video placement ID
 *
 * In __DEV__ builds, TopOn's official test placement IDs are used automatically.
 */

import { NativeEventEmitter, Platform } from 'react-native';

// ─── TopOn test placement IDs (from TopOn SDK documentation) ─────────────────
const TEST_INTERSTITIAL_ID = 'b5bacbc59b0253';
const TEST_REWARDED_ID     = 'b5b449fb3d89d7';

// ─── State ────────────────────────────────────────────────────────────────────
let initialized      = false;
let interstitialReady = false;
let rewardedReady     = false;
let _emitter: NativeEventEmitter | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTopOn() {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-topon');
  } catch {
    return null;
  }
}

function getEmitter(): NativeEventEmitter | null {
  if (_emitter) return _emitter;
  const mod = getTopOn();
  if (!mod) return null;
  try {
    _emitter = new NativeEventEmitter(mod.default?.NativeModule ?? mod.NativeModule);
    return _emitter;
  } catch {
    return null;
  }
}

function interstitialPlacementId(): string {
  if (__DEV__) return TEST_INTERSTITIAL_ID;
  return process.env.EXPO_PUBLIC_TOPON_INTERSTITIAL_ID || TEST_INTERSTITIAL_ID;
}

function rewardedPlacementId(): string {
  if (__DEV__) return TEST_REWARDED_ID;
  return process.env.EXPO_PUBLIC_TOPON_REWARDED_ID || TEST_REWARDED_ID;
}

// ─── Ad loading ───────────────────────────────────────────────────────────────

function loadInterstitial(): void {
  const mod = getTopOn();
  if (!mod) return;
  try {
    mod.Interstitial.loadAd(interstitialPlacementId());
  } catch (e) {
    console.warn('[AdManager] Interstitial load error:', e);
  }
}

function loadRewarded(): void {
  const mod = getTopOn();
  if (!mod) return;
  try {
    mod.RewardedVideo.loadAd(rewardedPlacementId());
  } catch (e) {
    console.warn('[AdManager] Rewarded load error:', e);
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

function setupEventListeners(): void {
  const em = getEmitter();
  const mod = getTopOn();
  if (!em || !mod) return;

  const { ToponEvents } = mod;

  // Interstitial
  em.addListener(ToponEvents.Interstitial.Loaded,   () => { interstitialReady = true; });
  em.addListener(ToponEvents.Interstitial.LoadFail, () => { interstitialReady = false; });
  em.addListener(ToponEvents.Interstitial.Close,    () => {
    interstitialReady = false;
    loadInterstitial(); // pre-load next
  });

  // Rewarded
  em.addListener(ToponEvents.RewardedVideo.Loaded,   () => { rewardedReady = true; });
  em.addListener(ToponEvents.RewardedVideo.LoadFail, () => { rewardedReady = false; });
  em.addListener(ToponEvents.RewardedVideo.Close,    () => {
    rewardedReady = false;
    loadRewarded(); // pre-load next
  });
}

// ─── ATT (iOS 14+) ────────────────────────────────────────────────────────────

async function requestATTPermission(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
    const { status } = await requestTrackingPermissionsAsync();
    console.log('[AdManager] ATT status:', status);
  } catch (e) {
    console.warn('[AdManager] ATT request failed:', e);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call once at app startup (e.g. in app/_layout.tsx useEffect).
 * Requests ATT on iOS → inits TopOn SDK → pre-loads first interstitial + rewarded.
 */
export async function initializeAds(): Promise<void> {
  if (initialized || Platform.OS === 'web') {
    initialized = true;
    return;
  }

  // Step 1: ATT permission (must come before any ad SDK init on iOS 14+)
  await requestATTPermission();

  // Step 2: Init TopOn SDK
  const appId  = process.env.EXPO_PUBLIC_TOPON_APP_ID  || '';
  const appKey = process.env.EXPO_PUBLIC_TOPON_APP_KEY || '';

  const mod = getTopOn();
  if (!mod) {
    initialized = true;
    return;
  }

  try {
    mod.SDK.init(appId, appKey);
    setupEventListeners();
    loadInterstitial();
    loadRewarded();
    initialized = true;
  } catch (e) {
    console.warn('[AdManager] TopOn init failed:', e);
  }
}

/**
 * Show an interstitial ad if one is ready.
 * Resolves when the user closes the ad (or immediately if no ad is ready).
 */
export async function showInterstitial(): Promise<void> {
  const mod = getTopOn();
  if (!mod || !interstitialReady) return;

  return new Promise((resolve) => {
    const em = getEmitter();
    if (!em) { resolve(); return; }

    const { ToponEvents } = mod;
    const sub = em.addListener(ToponEvents.Interstitial.Close, () => {
      sub.remove();
      resolve();
    });

    try {
      mod.Interstitial.showAd(interstitialPlacementId());
    } catch (e) {
      sub.remove();
      console.warn('[AdManager] Interstitial show error:', e);
      resolve();
    }
  });
}

/**
 * Show a rewarded ad if one is ready.
 * Resolves with `true` if the user earned the reward, `false` otherwise.
 */
export async function showRewarded(): Promise<boolean> {
  const mod = getTopOn();
  if (!mod || !rewardedReady) return false;

  return new Promise((resolve) => {
    const em = getEmitter();
    if (!em) { resolve(false); return; }

    const { ToponEvents } = mod;
    let earned = false;

    const rewardSub = em.addListener(ToponEvents.RewardedVideo.Reward, () => {
      earned = true;
    });
    const closeSub = em.addListener(ToponEvents.RewardedVideo.Close, () => {
      rewardSub.remove();
      closeSub.remove();
      resolve(earned);
    });

    try {
      mod.RewardedVideo.showAd(rewardedPlacementId());
    } catch (e) {
      rewardSub.remove();
      closeSub.remove();
      console.warn('[AdManager] Rewarded show error:', e);
      resolve(false);
    }
  });
}

/** Returns true if an interstitial is loaded and ready. */
export function isInterstitialReady(): boolean {
  return interstitialReady;
}

/** Returns true if a rewarded ad is loaded and ready. */
export function isRewardedReady(): boolean {
  return rewardedReady;
}
