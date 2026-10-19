# Lamma

**One phone. Everyone plays.** Offline pass-the-phone party games for iOS and Android, by AN Ventures Labs. Game 1 is Spy.

The full product and engineering spec is [docs/BRIEF.md](docs/BRIEF.md).

## Stack

Expo SDK 57 · React Native · TypeScript (strict) · Expo Router · Zustand + MMKV · Reanimated · i18next (en, ar with RTL) · Jest · Maestro · EAS.

## Getting started

Requires Node 22+, Xcode (iOS) and/or Android Studio (Android). MMKV is a native module, so the app runs in a **development build**, not Expo Go.

```bash
npm install
npm run android              # or: npm run ios
```

After the first native build, `npm start` is enough for JS changes.

## Scripts

| Command                 | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `npm run typecheck`     | TypeScript, no emit                                                             |
| `npm run lint`          | ESLint (Expo config, strict TS, RTL-safe style rule, game isolation) + Prettier |
| `npm run i18n:check`    | Every shipped locale has every key and every plural form                        |
| `npm run content:check` | Word packs and punishments are complete and valid                               |
| `npm test`              | Jest unit tests                                                                 |
| `npm run e2e`           | Maestro flows in `.maestro/` against a running dev build                        |

## Layout

```
app/              Expo Router routes (thin)
src/core/         shared core: theme, i18n, settings, storage, ui, players, session, punishments, content, rng
src/games/        game modules + registry
locales/<code>/   meta.json, native.json (app name), common.json, spy.json
content/          word packs (packs/, each tagged kids/teen and free/premium), punishments/<locale>.json and punishment-levels.json
assets/           fonts (SIL OFL), images; assets/source has the icon SVGs
docs/             brief, prototype, brand
```

**Adding a language:** create `locales/<code>/` with the same files as `locales/en/` (`meta.json` sets `nativeName` and `dir`). No code changes; `npm run i18n:check` lists anything missing.

## Builds and releases

EAS profiles in `eas.json`: `development` (dev client), `preview` (internal), `production` (store). Adult content never ships in Lamma (docs/BRIEF.md §6). Tags `v*` trigger store builds in GitHub Actions (needs the `EXPO_TOKEN` secret). One-time setup: `npx eas-cli@latest init` to link the Expo project and enable EAS Update.

## Privacy

No accounts, no backend, no analytics, no ads, no crash reporting. No data is collected.
