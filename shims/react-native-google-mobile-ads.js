// Web no-op shim for react-native-google-mobile-ads
// This module is native-only and cannot run on web.
// AdManager guards against this at runtime, but Metro still bundles it —
// this shim prevents the native codegenNativeComponent import from failing.

const noop = () => {};
const noopAsync = async () => {};

const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
  CLICKED: 'clicked',
};

const RewardedAdEventType = {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
};

const InterstitialAd = {
  createForAdRequest: () => ({
    addAdEventListener: noop,
    load: noop,
    show: noopAsync,
  }),
};

const RewardedAd = {
  createForAdRequest: () => ({
    addAdEventListener: noop,
    load: noop,
    show: noopAsync,
  }),
};

const BannerAd = noop;
BannerAd.displayName = 'BannerAd';

const MobileAds = () => ({
  initialize: noopAsync,
  setAppVolume: noop,
  setAppMuted: noop,
});

const TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

module.exports = {
  AdEventType,
  RewardedAdEventType,
  InterstitialAd,
  RewardedAd,
  BannerAd,
  MobileAds,
  TestIds,
};
