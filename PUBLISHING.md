# Publishing Guide — Simpli Games

This guide covers the complete process for building, submitting, and publishing any game from this monorepo to the Apple App Store. It is designed to be followed by a developer, AI assistant, or automated CI pipeline.

---

## Repository Structure

```
RNGames/
├── app/                      # Expo Router screens (shared game shell)
├── config/games.config.ts    # All 15 game variants with display names, colors
├── shared/ads/AdManager.ts   # TopOn ad SDK integration (ATT + interstitial + rewarded)
├── plugins/withTopOn.js      # Expo config plugin — injects TopOn CocoaPods
├── app.config.js             # Dynamic Expo config — selects variant via APP_VARIANT env
├── eas.json                  # EAS Build profiles (per-game preview + production)
├── documents/                # Per-game App Store submission metadata
│   ├── icons/                # 1024x1024 app icons (PNG, no alpha, no rounded corners)
│   ├── snake.md              # Full submission info for Snake
│   ├── circle-shrink.md      # Full submission info for Circle Shrink
│   ├── laser-dodge.md        # ...
│   ├── pulse-lanes.md
│   └── math-rush.md
├── docs/                     # GitHub Pages site (privacy, terms, support)
│   ├── index.html
│   ├── privacy.html
│   ├── terms.html
│   └── support.html
├── RELEASE_TRACKER.md        # Per-game release status checklist
└── PUBLISHING.md             # This file
```

---

## Prerequisites

1. **Apple Developer Account**: Team ID `HBSR239F25`, Account Holder: Rishi Kumar
2. **EAS CLI**: `npm install -g eas-cli && eas login`
3. **TopOn Account**: Dashboard at [topon.com](https://www.topon.com) with app entries created per game
4. **GitHub Pages enabled**: Settings → Pages → Source: "Deploy from a branch" → `master` `/docs`

---

## How Bundle IDs Work

Each game has a unique bundle ID in `app.config.js`:

| Game | Bundle ID |
|------|-----------|
| Snake | `com.theze.snake` |
| Circle Shrink | `com.theze.circleshrink` |
| Laser Dodge | `com.theze.laserdodge` |
| Pulse Lanes | `com.theze.pulselanes` |
| Math Rush | `com.theze.mathrush` |
| Gravity Flip | `com.theze.gravityflip` |
| Color Clash | `com.theze.colorclash` |
| Stack Blocks | `com.theze.stackblocks` |
| Simon Says | `com.theze.simonsays` |
| Number Order | `com.theze.numberorder` |
| Tap Rhythm | `com.theze.taprhythm` |
| Brick Breaker | `com.theze.brickbreaker` |
| Slice Frenzy | `com.theze.slicefrenzy` |
| Tile Shift | `com.theze.tileshift` |
| Color Flood | `com.theze.colorflood` |

The `APP_VARIANT` env var in `eas.json` tells `app.config.js` which variant to build. Each variant gets its own bundle ID, display name, and ad unit IDs.

---

## Publishing a New Game — Step by Step

### Step 1: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: `Simpli - <Game Name>` (e.g. "Simpli - Snake")
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.theze.<game>` (must match `app.config.js`)
   - **SKU**: `simpli-<game>-001`
4. Click "Create"

### Step 2: Create App in TopOn Dashboard

1. Log into [TopOn Dashboard](https://www.topon.com)
2. Create a new app for this game
3. Create two ad placements:
   - **Interstitial** → note the Placement ID
   - **Rewarded Video** → note the Placement ID
4. Note the **App ID** and **App Key**

### Step 3: Add Credentials to `eas.json`

For each new game, add two profiles to `eas.json`:

```json
"<game>-preview": {
  "extends": "preview",
  "env": {
    "APP_VARIANT": "<game>",
    "EXPO_PUBLIC_APP_VARIANT": "<game>",
    "EXPO_PUBLIC_TOPON_APP_ID": "<TopOn App ID>",
    "EXPO_PUBLIC_TOPON_APP_KEY": "<TopOn App Key>",
    "EXPO_PUBLIC_TOPON_INTERSTITIAL_ID": "<Interstitial Placement ID>",
    "EXPO_PUBLIC_TOPON_REWARDED_ID": "<Rewarded Placement ID>"
  }
},
"<game>-production": {
  "extends": "production",
  "env": {
    "APP_VARIANT": "<game>",
    "EXPO_PUBLIC_APP_VARIANT": "<game>",
    "EXPO_PUBLIC_BUILD_ENV": "production",
    "EXPO_PUBLIC_TOPON_APP_ID": "<TopOn App ID>",
    "EXPO_PUBLIC_TOPON_APP_KEY": "<TopOn App Key>",
    "EXPO_PUBLIC_TOPON_INTERSTITIAL_ID": "<Interstitial Placement ID>",
    "EXPO_PUBLIC_TOPON_REWARDED_ID": "<Rewarded Placement ID>"
  }
}
```

### Step 4: Test on Device (Preview Build)

```bash
eas build --profile <game>-preview --platform ios
```

Install the IPA on a real device. Verify:
- [ ] App launches without crashes
- [ ] ATT permission dialog appears on first launch
- [ ] Game is playable
- [ ] Interstitial ad shows after game over (debug/test ads in preview)
- [ ] Rewarded ad can be triggered (if applicable)

### Step 5: Build for Production

```bash
eas build --profile <game>-production --platform ios
```

This creates a store-ready IPA with:
- Real TopOn ad unit IDs (not test ads)
- Debug mode OFF
- Production bundle ID and signing

### Step 6: Submit to App Store

```bash
eas submit --profile production --platform ios
```

Or manually upload via **Transporter** app.

### Step 7: Fill in App Store Connect Metadata

Use the game's document file (`documents/<game>.md`) to copy-paste:

1. **App Information tab**:
   - Subtitle, category, content rating
   - Privacy Policy URL: `https://theze-games.web.app/privacy.html`

2. **Version tab**:
   - Screenshots (see Screenshot Content Guide in the doc)
   - Description, Keywords, Promotional Text, What's New
   - Support URL: `https://theze-games.web.app/support.html`

3. **App Privacy tab**:
   - Follow the Privacy Nutrition Label section in the doc

4. **App Review tab**:
   - Contact info, review notes

5. **Pricing tab**:
   - Free

### Step 8: Submit for Review

Click "Submit for Review" in App Store Connect. Typical review time: 24-48 hours.

### Step 9: Update Release Tracker

Update `RELEASE_TRACKER.md` with the game's status.

---

## Adding a New Game to the Monorepo

When adding a brand new game (not yet in the codebase):

1. **Add game variant** to `config/games.config.ts`:
   - Add to `GameVariant` union type
   - Add entry in `GAMES_CONFIG` with display name, colors, ad units

2. **Create game screen** in `app/games/<game>.tsx`

3. **Create app icon**: Save as `documents/icons/<game>.png` (1024x1024, no alpha)

4. **Add variant config** to `app.config.js`:
   - Add entry in the `variants` object with `bundleId` and `androidPackage`

5. **Add EAS profiles** to `eas.json`:
   - `<game>-preview` and `<game>-production` profiles

6. **Create submission doc**: Copy an existing `documents/<game>.md` and update all fields

7. **Update RELEASE_TRACKER.md**: Add the new game row

8. **Test → Build → Submit**: Follow Steps 4-9 above

---

## Batch Operations

### Build all 5 initial games (production)

```bash
for game in snake circle-shrink laser-dodge pulse-lanes math-rush; do
  echo "Building $game..."
  eas build --profile ${game}-production --platform ios --non-interactive
done
```

### Submit all built IPAs

```bash
for game in snake circle-shrink laser-dodge pulse-lanes math-rush; do
  echo "Submitting $game..."
  eas submit --profile production --platform ios --non-interactive
done
```

---

## URLs Reference

| Purpose | URL |
|---------|-----|
| Privacy Policy | `https://theze-games.web.app/privacy.html` |
| Terms of Service | `https://theze-games.web.app/terms.html` |
| Support | `https://theze-games.web.app/support.html` |
| Marketing | `https://theze-games.web.app/` |

---

## Common Issues

### "SDK version issue" on Transporter upload
Apple requires iOS 26 SDK (Xcode 26) for submissions after April 28, 2026. Add `"image": "latest"` to the `ios` section of the production profile in `eas.json`.

### Ads not showing in preview build
- TopOn native SDK requires a real device (not simulator)
- Verify TopOn credentials are in the preview profile's `env` block
- Check that `initializeAds()` is called in `app/_layout.tsx`

### ATT dialog not appearing
- Only shows on iOS 14.5+ on a real device
- Only fires once per app install — delete and reinstall to test again

### App rejected for missing privacy policy
- Run `firebase deploy --only hosting` from the repo root to publish/update the site
- Verify URL loads: `https://theze-games.web.app/privacy.html`

---

## Contact

- **Developer Account Holder**: Rishi Kumar
- **Email**: android.dev@theze.in
- **Apple Team ID**: HBSR239F25
