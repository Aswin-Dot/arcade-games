/**
 * Expo Config Plugin — TopOn ADX iOS SDK v6.4.88
 *
 * Injects TopOn CocoaPods into the Podfile during `expo prebuild` / EAS Build.
 * All 15 ad-network adapter pods from the TopOn integration guide are included.
 * Only the core SDK (TPNiOS) is mandatory; adapters can be commented out if a
 * network isn't activated in your TopOn dashboard.
 */
const { withPodfile } = require('@expo/config-plugins');

const TOPON_PODS = `
  # ── TopOn ADX v6.4.88 ──────────────────────────────────────────────────────
  # Core SDK (required)
  pod 'TPNiOS', '6.4.88'

  # Ad-network adapters — comment out any network not enabled in TopOn dashboard
  pod 'TPNStartAppSDKAdapter',   '6.4.88'
  pod 'TPNVungleSDKAdapter',     '6.4.88.1'
  pod 'TPNUnityAdsSDKAdapter',   '6.4.88'
  pod 'TPNIronSourceSDKAdapter', '6.4.88'
  pod 'TPNBigoSDKAdapter',       '6.4.88'
  pod 'TPNPubNativeSDKAdapter',  '6.4.88'
  pod 'TPNSmaatoSDKAdapter',     '6.4.88'
  pod 'TPNPangleSDKAdapter',     '6.4.88'
  pod 'TPNKwaiSDKAdapter',       '6.4.88'
  pod 'TPNInmobiSDKAdapter',     '6.4.88'
  pod 'TPNApplovinSDKAdapter',   '6.4.88'
  pod 'TPNMintegralSDKAdapter',  '6.4.88'
  pod 'TPNChartboostSDKAdapter', '6.4.88'
  pod 'TPNYandexSDKAdapter',     '6.4.88'
  pod 'TPNFyberSDKAdapter',      '6.4.88'
  # ────────────────────────────────────────────────────────────────────────────
`;

module.exports = function withTopOn(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    // Guard against double-injection on re-runs
    if (contents.includes('TPNiOS')) {
      return config;
    }
    // Insert before the final `end` of the target block
    config.modResults.contents = contents.replace(
      /(\n\s*end\s*\n*$)/,
      `${TOPON_PODS}$1`
    );
    return config;
  });
};
