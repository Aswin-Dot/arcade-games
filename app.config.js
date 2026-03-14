const baseConfig = require("./app.json").expo;

const VARIANTS = {
  snake: {
    name: "Snake Classic",
    slug: "snake-classic",
    bundleId: "com.rngames.snake",
    androidPackage: "com.rngames.snake",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "circle-shrink": {
    name: "Circle Shrink",
    slug: "circle-shrink",
    bundleId: "com.rngames.circleshrink",
    androidPackage: "com.rngames.circleshrink",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "laser-dodge": {
    name: "Laser Dodge",
    slug: "laser-dodge",
    bundleId: "com.rngames.laserdodge",
    androidPackage: "com.rngames.laserdodge",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "pulse-lanes": {
    name: "Pulse Lanes",
    slug: "pulse-lanes",
    bundleId: "com.rngames.pulselanes",
    androidPackage: "com.rngames.pulselanes",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "math-rush": {
    name: "Math Rush",
    slug: "math-rush",
    bundleId: "com.rngames.mathrush",
    androidPackage: "com.rngames.mathrush",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "gravity-flip": {
    name: "Gravity Flip",
    slug: "gravity-flip",
    bundleId: "com.rngames.gravityflip",
    androidPackage: "com.rngames.gravityflip",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "color-clash": {
    name: "Color Clash",
    slug: "color-clash",
    bundleId: "com.rngames.colorclash",
    androidPackage: "com.rngames.colorclash",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "stack-blocks": {
    name: "Stack Blocks",
    slug: "stack-blocks",
    bundleId: "com.rngames.stackblocks",
    androidPackage: "com.rngames.stackblocks",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "simon-says": {
    name: "Simon Says",
    slug: "simon-says",
    bundleId: "com.rngames.simonsays",
    androidPackage: "com.rngames.simonsays",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "number-order": {
    name: "Number Order",
    slug: "number-order",
    bundleId: "com.rngames.numberorder",
    androidPackage: "com.rngames.numberorder",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "tap-rhythm": {
    name: "Tap Rhythm",
    slug: "tap-rhythm",
    bundleId: "com.rngames.taprhythm",
    androidPackage: "com.rngames.taprhythm",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "brick-breaker": {
    name: "Brick Breaker",
    slug: "brick-breaker",
    bundleId: "com.rngames.brickbreaker",
    androidPackage: "com.rngames.brickbreaker",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "slice-frenzy": {
    name: "Slice Frenzy",
    slug: "slice-frenzy",
    bundleId: "com.rngames.slicefrenzy",
    androidPackage: "com.rngames.slicefrenzy",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "tile-shift": {
    name: "Tile Shift",
    slug: "tile-shift",
    bundleId: "com.rngames.tileshift",
    androidPackage: "com.rngames.tileshift",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
  "color-flood": {
    name: "Color Flood",
    slug: "color-flood",
    bundleId: "com.rngames.colorflood",
    androidPackage: "com.rngames.colorflood",
    icon: "./assets/images/icon.png",
    splash: "./assets/images/splash-icon.png",
    adaptiveForeground: "./assets/images/android-icon-foreground.png",
  },
};

const requestedVariant =
  process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT;
const variant =
  requestedVariant && VARIANTS[requestedVariant]
    ? requestedVariant
    : undefined;
const selectedVariant = variant ? VARIANTS[variant] : null;
const VARIANT_EAS_PROJECT_IDS = {
  snake:
    process.env.EAS_PROJECT_ID_SNAKE ||
    "681d3af1-1308-4f47-82ee-750db188cae2",
  "circle-shrink": process.env.EAS_PROJECT_ID_CIRCLE_SHRINK,
  "laser-dodge": process.env.EAS_PROJECT_ID_LASER_DODGE,
  "pulse-lanes": process.env.EAS_PROJECT_ID_PULSE_LANES,
};
const resolvedEasProjectId =
  process.env.EAS_PROJECT_ID ||
  (variant ? VARIANT_EAS_PROJECT_IDS[variant] : undefined);
const DEFAULT_ANDROID_ADMOB_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const DEFAULT_IOS_ADMOB_APP_ID = "ca-app-pub-3940256099942544~1458002511";

const plugins = Array.isArray(baseConfig.plugins)
  ? baseConfig.plugins
      .filter((plugin) =>
        Array.isArray(plugin)
          ? plugin[0] !== "react-native-google-mobile-ads"
          : plugin !== "react-native-google-mobile-ads",
      )
      .concat([
        [
          "react-native-google-mobile-ads",
          {
            androidAppId:
              process.env.ADMOB_ANDROID_APP_ID || DEFAULT_ANDROID_ADMOB_APP_ID,
            iosAppId: process.env.ADMOB_IOS_APP_ID || DEFAULT_IOS_ADMOB_APP_ID,
          },
        ],
      ])
  : [
      [
        "react-native-google-mobile-ads",
        {
          androidAppId:
            process.env.ADMOB_ANDROID_APP_ID || DEFAULT_ANDROID_ADMOB_APP_ID,
          iosAppId: process.env.ADMOB_IOS_APP_ID || DEFAULT_IOS_ADMOB_APP_ID,
        },
      ],
    ];

module.exports = {
  expo: {
    ...baseConfig,
    plugins,
    name: selectedVariant ? selectedVariant.name : baseConfig.name,
    slug: selectedVariant ? selectedVariant.slug : baseConfig.slug,
    icon: selectedVariant ? selectedVariant.icon : baseConfig.icon,
    splash: selectedVariant
      ? {
          image: selectedVariant.splash,
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#000000" },
        }
      : baseConfig.splash,
    ios: {
      ...baseConfig.ios,
      bundleIdentifier: selectedVariant
        ? selectedVariant.bundleId
        : baseConfig.ios?.bundleIdentifier,
      infoPlist: {
        ...(baseConfig.ios?.infoPlist || {}),
        GADApplicationIdentifier:
          process.env.ADMOB_IOS_APP_ID || DEFAULT_IOS_ADMOB_APP_ID,
      },
    },
    android: {
      ...baseConfig.android,
      package: selectedVariant
        ? selectedVariant.androidPackage
        : baseConfig.android?.package,
      adaptiveIcon: {
        ...baseConfig.android?.adaptiveIcon,
        foregroundImage: selectedVariant
          ? selectedVariant.adaptiveForeground
          : baseConfig.android?.adaptiveIcon?.foregroundImage,
      },
    },
    extra: {
      ...(baseConfig.extra || {}),
      eas: {
        ...(baseConfig.extra?.eas || {}),
        ...(resolvedEasProjectId ? { projectId: resolvedEasProjectId } : {}),
      },
      ...(variant ? { appVariant: variant } : {}),
    },
  },
};
