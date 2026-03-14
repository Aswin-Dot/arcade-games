import { NativeModules, Platform } from 'react-native';

import { currentGameConfig } from '@/config/games.config';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

let mobileAdsLib: GoogleMobileAdsModule | null = null;
let interstitial: ReturnType<GoogleMobileAdsModule['InterstitialAd']['createForAdRequest']> | null =
  null;
let interstitialLoaded = false;
let initialized = false;

const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

const hasNativeAdsModule = () => {
  return Boolean((NativeModules as Record<string, unknown>).RNGoogleMobileAdsModule);
};

const getMobileAdsLib = (): GoogleMobileAdsModule | null => {
  if (mobileAdsLib) {
    return mobileAdsLib;
  }

  if (Platform.OS === 'web' || !hasNativeAdsModule()) {
    return null;
  }

  try {
    mobileAdsLib = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
    return mobileAdsLib;
  } catch {
    return null;
  }
};

const getInterstitialUnitId = () => {
  return currentGameConfig.adUnits.interstitial || TEST_INTERSTITIAL_ID;
};

const loadInterstitial = () => {
  const ads = getMobileAdsLib();
  if (!ads) {
    interstitial = null;
    interstitialLoaded = false;
    return;
  }

  interstitial = ads.InterstitialAd.createForAdRequest(getInterstitialUnitId());
  interstitialLoaded = false;

  interstitial.addAdEventListener(ads.AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });

  interstitial.addAdEventListener(ads.AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial();
  });

  interstitial.addAdEventListener(ads.AdEventType.ERROR, () => {
    interstitialLoaded = false;
  });

  interstitial.load();
};

export const initializeAds = async () => {
  if (initialized) {
    return;
  }

  const ads = getMobileAdsLib();
  if (!ads) {
    initialized = true;
    return;
  }

  try {
    await ads.MobileAds().initialize();
    loadInterstitial();
    initialized = true;
  } catch {
    initialized = false;
  }
};

export const showInterstitial = async (): Promise<void> => {
  const ads = getMobileAdsLib();
  if (!ads || !interstitial || !interstitialLoaded) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = interstitial!.addAdEventListener(ads.AdEventType.CLOSED, () => {
      unsubscribe();
      resolve();
    });

    interstitial!.show();
  });
};
