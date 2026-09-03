# 📱 PantryButler Mobile

Native **iOS** and **Android** apps for PantryButler, built with **Expo SDK 57** and **React Native**. This is the mobile companion to the main PantryButler web app — the full kitchen-management suite (recipes, pantry & kitchen layout, meal planning, grocery lists, nutrition, and settings).

> PantryButler is a self-hosted kitchen management application. See the project [`README.md`](../README.md) at the repo root for an overview of the full product and how to self-host an instance. The mobile apps connect to any PantryButler instance over its REST API.

- **Default instance:** [`https://pantrybutler.mythologic.al`](https://pantrybutler.mythologic.al)
- **Bundle/package ID:** `al.mythologic.pantrybutler`

---

## ✨ What the app does

The mobile app mirrors the web app's features, grouped into five main tabs plus a settings stack:

### 🧑‍🍳 Recipes
- Browse, search, and filter recipes by folder
- Full recipe detail: ingredients, steps, servings scaler, nutrition facts label
- Create / edit / delete recipes, manage tags & folders
- Import recipes from a URL (with a review screen)
- Make recipes public and share a link
- Add a recipe's ingredients to the grocery list

### 🛒 Grocery List
- Recipe-based and custom grocery items
- Toggle purchased / unpurchased, add/remove recipes, clear the list
- **Consolidate** the list into a grouped, unit-converted shopping list
- Unit conversion using the instance's preferred unit settings (e.g. metric, imperial, baker's percentages)

### 🗓️ Meal Planner (Calendar)
- Weekly calendar of meals with breakfast / lunch / dinner / snack slots
- Add, remove, and mark meals as cooked
- Push one meal or the whole week to the grocery list

### 🥫 Pantry & Kitchen
- Pantry inventory: quantities, locations, notes, unlimited items
- **Kitchen layout editor**: build a visual 2D kitchen — models, elements (cabinets, appliances, shelves, etc.), and shelving
- Place pantry items & equipment onto kitchen elements/shelves and browse them grouped by location
- Ingredients reference (with unit conversions) and equipment CRUD

### ⚙️ Settings, Users & Administration
- Instance settings: unit system, currency, dark/vibrant mode, nutrition & cost tracking
- Announcements (view + admin compose)
- User management with roles (admin / user / viewer)
- Superadmin-only **Admin** screen: manage instances and platform config
- Profile management and switching between kitchen instances

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 57 (managed / CNG) |
| UI | React Native 0.86, React 19 |
| Language | TypeScript (strict) |
| Navigation | React Navigation (native-stack + bottom tabs) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Secure storage | `expo-secure-store` (tokens, server URL, session) |
| Networking | Custom `ApiClient` (fetch) in `src/api/client.ts` |
| Offline detection | `@react-native-community/netinfo` (shows an offline banner) |

### Project layout

```
mobile/
├── App.tsx                     # Navigation root (auth ↔ app stacks, offline provider)
├── app.json                    # Native config: icons, splash, bundle IDs, plugins
├── eas.json                    # EAS Build / submit profiles (TestFlight, Play internal)
├── assets/                     # App icons + splash imagery
└── src/
    ├── api/                    # API client + shared types (client.ts, types.ts)
    ├── components/             # Shared UI (LoadingState, EmptyState, ErrorBanner, NutritionLabel)
    ├── contexts/               # AuthContext, OfflineProvider
    ├── lib/                    # conversions, kitchen element configs
    ├── screens/                # One file per screen
    └── theme/                  # Colors, spacing, radii tokens
```

---

## 🔐 Authentication & networking

- The app connects to a PantryButler server URL chosen on first launch (defaulting to the public instance).
- Sign-in returns a **JWT** used for instance switching, token minting, member and admin endpoints.
- A **scoped API token** (`pb_...`), bound to an instance, is used for instance data calls (pantry, kitchen, settings, announcements, etc.).
- Credentials are stored in the platform SecureStore, never as plaintext files.
- No secrets are committed to the repo.

---

## 🚀 Getting started (development)

```bash
cd mobile
npm install
npx expo start          # launch the dev workflow (QR code → Expo Go / dev client)
```

Platform-specific:

```bash
npm run android         # expo run:android (native build via prebuild)
npm run ios             # expo run:ios
npx expo start --web    # web preview
```

### Notes for this repo

- **`mobile/.npmrc` sets `allow-scripts=true`.** This is required because the repo-wide npm policy blocks lifecycle scripts. Keep it scoped under `mobile/`.
- **Prefer plain `npm install <pkg>`** for adding dependencies (`npx expo install` can fail in this environment). Install at the versions in `node_modules/expo/bundledNativeModules.json`.
- Native folders (`/ios`, `/android`) are gitignored and regenerated on demand via `expo prebuild` (Continuous Native Generation).

### Verify / build

```bash
npx tsc --noEmit                 # type-check
npx expo-doctor                  # health checks (expo, deps, config)
npx expo export --platform android   # bundling smoke test
npx expo prebuild --platform android  # generate the native project
```

### Distribution (EAS Build)

[`eas.json`](eas.json) defines build and submit profiles for iOS (App Store / TestFlight) and Android (Play internal). To ship:

```bash
eas login
eas build --platform ios --profile preview    # TestFlight path
eas build --platform android --profile preview # Play internal path
eas submit -p ios
eas submit -p android
```

You'll need your Expo, Apple, and Google credentials (see the `@appleId` / `@serviceAccountKeyPath` placeholders in `eas.json`).
