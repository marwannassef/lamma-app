# Lamma: Party Games — Build Brief

> Hand this file to Claude Code at the root of the repo (save it as `docs/BRIEF.md`).
>
> - `docs/reference/spy-prototype.html` is a working single-file prototype of the first game. It's the source of truth for Spy's **behavior**, its Egypt word pack and the punishments. Don't copy its visuals; §8 replaces them.
> - `docs/brand/an-ventures-labs.jpg` is the publisher logo, and the source of the palette in §8.
> - Game specs: `docs/games/werewolf.md` (game 2) and `docs/games/blend-in.md` (game 3).
> - **`docs/monetization.md`** covers prices, free limits, paywalls, ads, content levels and age, the offline pass, the backend and anti-piracy. Where it differs from older lines here, it wins.

---

## 1. Product

|                     |                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App name            | **Lamma** (from Arabic لمّة, "the gathering")                                                                                  |
| Store title         | `Lamma: Spy, Mafia & Werewolf` (localized per store locale; adjust as games ship)                                              |
| Tagline             | One phone. Everyone plays.                                                                                                     |
| Publisher           | AN Ventures Labs                                                                                                               |
| Repo                | `lamma`                                                                                                                        |
| Bundle / package id | `com.anventureslabs.lamma`                                                                                                     |
| Markets             | Worldwide. Launch locales are **English** and **Arabic**; the architecture must let us add a locale by adding files, not code. |

**What it is:** a collection of pass-the-phone party games. One phone gets passed around the group and everyone plays in person. Launch games: **Spy**, **Werewolf / Mafia** (one game, two themes) and **Blend In**; later games (Heads Up, Taboo, Charades and others) are modules inside the same app.

**Audience and rating:** teens, adults and families. Store rating **Teen** (Apple 13+, Google Teen). Content has two levels inside the app, **Kids** and **Teen**, decided by platform age signals, a "Who's playing?" choice and a parent PIN (`docs/monetization.md` §7). Adult content never ships in Lamma.

**Business model:** every game is free with limits and ads; **Party Pass**, **Annual** and **Lifetime** unlock everything (`docs/monetization.md`).

**Non-negotiables**

- Plays offline within a signed offline pass (72 h free, 30 days Premium); a friendly limited mode after that. No accounts. A small backend handles purchases, content delivery, integrity checks and remote config.
- Data collection is minimal, consented where required and disclosed exactly in the store privacy forms.
- One codebase for iOS and Android, with a native feel at 60fps on mid-range Android.
- First card on screen within 10 seconds of a cold start.
- Full RTL support (not just mirrored text). Accessible: dynamic type, screen reader labels, reduced motion.
- Adult-level content is never bundled in Lamma builds (§6).

---

## 2. Tech stack

| Concern             | Choice                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Expo** (latest stable SDK) + React Native + **TypeScript strict**                                                        |
| Navigation          | **Expo Router** (file-based)                                                                                               |
| State               | **Zustand** slices with `persist`                                                                                          |
| Storage             | **react-native-mmkv** behind a `storage` adapter (so a dev build is needed; that's fine)                                   |
| Animation           | **react-native-reanimated** + react-native-gesture-handler                                                                 |
| i18n                | **i18next** + react-i18next + **expo-localization**; ICU plurals                                                           |
| Native              | expo-haptics, expo-keep-awake, expo-font, expo-splash-screen, expo-screen-orientation, expo-av (sfx, later)                |
| Fonts               | Bundled locally (§8)                                                                                                       |
| Unit tests          | Jest + @testing-library/react-native                                                                                       |
| E2E                 | **Maestro** flows                                                                                                          |
| Lint / format       | ESLint (expo config + strict TS rules) + Prettier                                                                          |
| Build / release     | **EAS Build**, **EAS Submit**, **EAS Update** (OTA updates for JS and content fixes)                                       |
| CI                  | GitHub Actions: typecheck, lint, tests on PRs; EAS builds triggered on tags                                                |
| Purchases           | **RevenueCat** (Party Pass, Annual, Lifetime)                                                                              |
| Ads                 | **react-native-google-mobile-ads** (AdMob) + Google UMP consent; iOS ATT                                                   |
| Age signals         | Native module for Apple **Declared Age Range** and Google **Play Age Signals**                                             |
| Integrity           | Native module for **Play Integrity** and **App Attest**                                                                    |
| Analytics / crashes | **Firebase Analytics** + **Crashlytics** (consent-aware)                                                                   |
| Backend             | **Cloud Run** (TypeScript) + **Firestore** + **Cloud Storage** + Secret Manager, **Terraform**, deployed by GitHub Actions |

Why Expo and not Flutter or Capacitor: it uses the owner's React/TS skills, has native animation and sensors (needed by future games like Heads Up), and EAS takes care of cloud builds, store submission and OTA updates.

---

## 3. Architecture

The app is a **shell plus a shared core plus game modules**. A game may import from `core`, but never from another game.

```
app/                          # Expo Router routes (thin: compose screens only)
  _layout.tsx
  index.tsx                   # Home: game picker
  settings.tsx
  games/[gameId]/...          # mounted from the game registry
src/
  core/
    players/                  # roster (count, names)
    session/                  # scoreboard, round counter
    punishments/              # levels, decks, draw/swap engine
    content/                  # pack types, loader, filters (locale, region, level, tier)
    i18n/                     # i18next setup, locale detection, RTL handling
    settings/                 # language, content region, content level, haptics, sound
    storage/                  # MMKV adapter
    rng/                      # injectable RNG: shuffle, pick, int
    ui/                       # design-system components (§8)
    theme/                    # tokens, ThemeProvider
  games/
    registry.ts
    spy/
      index.ts                # GameModule
      logic.ts                # pure rules
      store.ts                # spy-specific state
      screens/                # Setup, Pass, Card, Round
    entitlements/             # tier, caps, paywall triggers, offline pass
    ads/                      # AdMob wrapper, frequency rules, rewarded flow
    age/                      # age signals, content level, parent PIN
    protection/               # attestation, encrypted content store, min version
    remoteConfig/
server/                       # Cloud Run service (TypeScript) + Terraform in server/infra
shared/                       # types shared by app and server (entitlements, packs, config)
locales/
  en/{common,spy}.json
  ar/{common,spy}.json
content/
  packs/<packId>.json         # word packs (§5)
  punishments/<locale>.json
docs/
```

### GameModule contract

```ts
export interface GameModule {
  id: string; // "spy"
  titleKey: string; // i18n key
  icon: ImageSourcePropType;
  minPlayers: number;
  maxPlayers: number;
  usesScores: boolean;
  usesPunishments: boolean;
  entryRoute: Href;
}
```

### Rules for the code

1. **Game rules are pure functions** (`logic.ts`): no React, no storage, an injected RNG, 100% branch coverage.
2. **No hardcoded user-facing strings.** Everything goes through i18n, and CI fails if a string is missing in any shipped locale.
3. **RTL-safe layout:** use `start`/`end` (never `left`/`right`), flip directional icons, and test every screen in Arabic.
4. Never block on native dialogs for game flow. Use inline confirmations (`ConfirmInline`). The prototype had a bug from blocked browser dialogs.
5. Don't leave an action disabled without explaining why. Keep it tappable and show an inline hint (another prototype bug).
6. When an action reveals content below, scroll it into view.
7. Touch targets of at least 48dp, every interactive element labeled for screen readers, and no information conveyed by color alone.

---

## 4. Shared core features

### Players

Up to 20 players (each game sets its own min/max; free-tier caps in `docs/monetization.md` §3), default 5. Optional names (max 14 characters) default to "Player N" localized. The list can be **drag-reordered into seating order** (Werewolf needs it). It's persisted and shared by every game.

### Scoreboard

- Persisted and sorted descending, with a 👑 for the leader(s) once someone has more than 0 points.
- Each row shows the latest round's gain.
- Reset uses `ConfirmInline` and also resets the round counter.

### Punishments

- Levels: `off | light | medium | hard | public | mix` (default `mix`); `mix` picks a real level at random for each draw.
- Text comes from `content/punishments/<locale>.json`. Port the ~25 English items per level from the prototype and write natural Arabic versions (not literal translations).
- A Fisher–Yates **deck per level**, with no repeats until the deck runs out.
- **Losers** = players who gained 0 points this round. More than 3 losers get **one group punishment**; otherwise each loser gets their own.
- Each card can be **swapped once**.
- Safety rules for punishment content: no props, possible anywhere, nothing involving strangers, no food or drink dares, nothing that risks injury, culturally neutral, and no humiliation based on body, gender or religion.

### Settings

Language (system / en / ar), **content region** (§5), **who's playing / content level** with the parent PIN (§6), haptics, sound, Lamma Premium and Restore purchases, privacy choices (consent), and an About screen (publisher, version, privacy policy).

---

## 5. Content model (worldwide-ready)

Content is organized into **packs**. A pack belongs to a region and declares how a word is displayed on the card.

```ts
type LocaleCode = string; // "en", "ar", ...

interface Pack {
  id: string; // "egypt-food"
  region: 'global' | 'eg' | string; // ISO-ish region or "global"
  game: 'spy' | string;
  emoji: string;
  name: Record<LocaleCode, string>;
  subtitle?: Record<LocaleCode, string>; // e.g. Franco name "Akl masry"
  level: 'kids' | 'teen'; // adult is never allowed in Lamma
  tier: 'free' | 'premium'; // default; the server can override which packs are free
  display: {
    primary: LocaleCode | 'ui'; // big line on the card ("ui" = the user's UI language)
    secondary?: LocaleCode | 'translit'; // medium line
    tertiary?: LocaleCode; // small line
  };
  words: Array<{
    id: string;
    text: Record<LocaleCode, string>;
    translit?: string; // Franco/Arabizi, romaji, etc.
    level?: 'kids' | 'teen'; // optional per-word override (stricter or looser than the pack)
  }>;
}
```

**Launch packs**

- **Global** (region `global`, `en` + `ar` text): universal categories such as Food, Animals, Jobs, School, Transport, Home, Sports, Places (world landmarks), Games & toys, Beach & summer. On the card: the UI language is primary and the other language is secondary.
- **Egypt** (region `eg`): port **every** category from the prototype (Egyptian food, Things at home, Places in Egypt, Animals, Jobs, School, Transport, Fruits & veggies, Games & toys, Ramadan & Eid, Beach & summer). Card display: **English big, Franco medium, Arabic small**, exactly like the prototype, because many Egyptian kids read English/Franco more easily than Arabic script.

**Region selection:** the default comes from the device region (Egypt → Global + Egypt; anywhere else → Global). The user can change it in Settings, and random mode picks only from enabled regions and only from packs the user's tier and content level allow.

**Where packs live:** free packs are bundled in the app. Premium packs are downloaded from the server and stored encrypted (`docs/monetization.md` §9).

**Validation script** (`npm run content:check`, run in CI): every word has text for each locale the pack declares; at least 20 words per pack; unique ids; no duplicate words inside a pack; every pack has a level and a tier; no pack or word at an adult level.

**Writing guidelines:** words a 7–12-year-old knows, but not so obvious that the spy guesses them instantly. Franco uses the common numerals (2 = ء/ق, 3 = ع, 5 = خ, 7 = ح) with the most common spelling (e.g. `ta3meya`, `ma7shy`, `tok tok`).

---

## 6. Content levels and the Cheeky pack

- Two levels ship in Lamma: **Kids** and **Teen**. How the level is chosen (age signals, "Who's playing?", parent PIN) is in `docs/monetization.md` §7.
- The prototype's `🔥 +18 Spicy` pack is **split**:
  - **Cheeky** (`level: "teen"`, region `eg`, subtitle "Kalam kharg"): Diaper (bambers), Always pad, Panty (kalout), Bra (sentian), Boxers, Undershirt (fanella dakhleya), Shapewear (mashad), Toilet paper, Bidet sprayer (shattaf), Smelly socks, Armpit, Sweat, Burp (tekree3a), Silent fart (faswa), Laxative (molayyen), Razor, Waxing, Beer belly (kersh), Bald spot (sal3a), Dentures, Wig (barouka), Fake lashes, Mother-in-law (7amatak), Marriage officiant (ma2zoon), Bathrobe, Honeymoon, Kiss (bousa). Write a Global Cheeky pack in the same spirit.
  - **Not shipped in Lamma:** Wedding night, Condom and Nightgown (قميص نوم). Remove them from the repo's content; they belong to a possible future "After Dark" app with its own content.
- Teen packs keep the in-game confirmation ("Everyone at the table OK with cheeky words?") the first time per session.
- The old `EXPO_PUBLIC_ENABLE_ADULT` flag is removed.

---

## 7. Game 1: Spy

Port the prototype's behavior exactly; only the visuals change (§8).

### Setup

- Players stepper.
- Spies stepper: 1, or up to 2 when there are 7+ players. Clamp it when the player count drops.
- Names.
- Scoreboard, shown only when someone has points.
- **🎲 Random mode** (the default): a new category every round, **never the same category twice in a row**.
- Category grid: emoji, localized name and subtitle.
- Punishment level.
- `Spy sees category` (default on).
- Primary button: `Start round N`.
- Free-tier limits (6 players, 1 spy, free categories, Light punishments) and the paywall moments are in `docs/monetization.md` §3–4.

### Round setup (pure)

1. Choose the category (respecting region, content level and tier).
2. Choose a word with **no repeats inside a pack** until it's exhausted. The used ids are persisted per pack.
3. Pick the spies by shuffling the players.
4. Pick a random first asker.
5. Increment the round counter.

### Pass screen

"Pass the phone to" + the name, or "Player" + a big number. Progress dots, "Make sure nobody else is looking 👀", and `Show my card`.

### Card screen

- **Normal card:** category tag plus the word lines from `pack.display`.
- **Spy card:** "You're the spy!" plus the category if spy-sees-category is on; otherwise "Listen to their questions and guess the word".
- A Reanimated flip-in (instant with reduced motion), a light haptic when the card appears, and a medium haptic for the spy.
- `Got it, hide` goes to the next player or to the Round screen.
- The card must be unreadable in the app switcher snapshot (blur or cover it when the app goes to the background).

### Round screen

- "Round N started!", the category pill (random mode with spy-sees-category on only), "{name} asks the first question.", and the rules line.
- `Reveal the answer` shows the word and the spies, then the **Who won?** panel. For each spy: "Did you catch {spy}?", and if caught, "Did {spy} guess the word right?".
- `Add points`. If something is unanswered, show the inline hint "Answer the questions above first 👆".

### Scoring (pure, fully tested)

| For each spy             | Points               |
| ------------------------ | -------------------- |
| Not caught               | that spy **+2**      |
| Caught, guessed the word | that spy **+1**      |
| Caught, guessed wrong    | **every non-spy +1** |

- Result title: all spies lost → "Players win! 🎉"; all spies won → "Spy wins!" / "Spies win!"; mixed → "Split round! 🤝".
- Then the scoreboard with gains, punishments for the losers (`Draw punishment 🎁`), and the `Next round` / `Change settings` buttons.

### Nice-to-have (v1.1)

An optional discussion timer, and an in-app voting screen where each player taps a suspect.

---

## 8. Design system (from the AN Ventures Labs logo)

The palette is sampled from the publisher logo: the **blue → violet → magenta → orange** ribbon gradient on warm cream, with cocoa-brown script text and leaf-green accents.

```ts
export const palette = {
  // brand
  sky: '#4F8FDB', // logo blue
  cyan: '#2FB8C9', // circuit accents
  violet: '#6B3FC6', // logo purple
  grape: '#3A1D6E', // deep purple, from the ribbon shadows
  magenta: '#D23C82', // logo pink-magenta
  coral: '#E8605A',
  orange: '#EF7A3C', // logo orange
  leaf: '#6DBE45', // leaves (success)
  // neutrals
  cream: '#FDFAF1', // logo background
  sand: '#F4EBDD',
  cocoa: '#89553D', // logo script text
  ink: '#2B1A12',
  night: '#1A1030', // dark theme background
  nightUp: '#261A44',
};
export const gradients = {
  brand: ['#4F8FDB', '#6B3FC6', '#D23C82', '#EF7A3C'], // the LABS wordmark
  spy: ['#3A1D6E', '#6B3FC6', '#D23C82'],
};
```

**Themes**

- **Light (default for setup and results):** cream background, ink text with cocoa for secondary text, sand surfaces, primary button orange, secondary actions violet.
- **Dark ("party night," used for the Pass and Card screens so the card glows in a dim room):** night background and nightUp surfaces, with cream text.
- Follow the system appearance, with a manual override in Settings.

**Semantic tokens** (components use only these, never raw palette values): `bg`, `surface`, `surfaceRaised`, `text`, `textMuted`, `primary`, `onPrimary`, `secondary`, `onSecondary`, `danger`, `success`, `border`, `focus`. Verify WCAG AA contrast for each text/background pair. Notably, button labels on orange use `ink`, not white.

**Key components**

- **Primary button:** orange, ink label, a 6dp darker-orange bottom "lip" that presses down on tap with a haptic.
- **Word card:** cream, 28dp radius, a 6dp border in the brand gradient.
- **Spy card:** the `spy` gradient fill, cream text, a soft glow.
- **Background motif:** faint sparkles and dots inspired by the logo's confetti (≤6% opacity, static).
- **Typography:**
  - Display: **Baloo 2** (Latin) / **Baloo Bhaijaan 2** (Arabic), a matched rounded pair.
  - Body: **Nunito** / **Cairo**.
  - All are open fonts; bundle them. Pick the family by script automatically.
- **Icon set:** rounded, 2dp stroke (e.g. Phosphor "bold").

**App icon:** a new mark, **not the publisher logo** (its detail disappears at 60px). It should be a bold, simple shape on the brand gradient, e.g. a speech bubble with a spy hat silhouette. Provide iOS, Android adaptive (foreground + background layers) and monochrome (Android 13+) variants.

**Splash:** the brand gradient with the Lamma wordmark, and "by AN Ventures Labs" small at the bottom.

---

## 9. Release, privacy and compliance

- **Privacy, consent, data collected, store privacy forms:** `docs/monetization.md` §8. Publish a privacy policy page and link it in About.
- **Age rating:** answer the Apple questionnaire and IARC honestly for **Teen** content (crude humor). Expect Apple 13+ and Google Teen.
- **Don't enroll in Apple's Kids Category or Google's Designed for Families.** Store text and screenshots target teens, adults and families, never young children specifically.
- **Store listings:** localized title, subtitle and description for en and ar, and screenshots for both (Arabic screenshots must show the RTL UI). In-app purchases listed with localized names.
- **Pricing:** `docs/monetization.md` §2.
- **Launch timing:** a few weeks before Ramadan, when family gatherings peak.
- **Versioning:** semver; `1.0.0` = Spy, Werewolf and Blend In with monetization. JS and content fixes go out through EAS Update channels (`production`, `preview`). A server-side minimum version can force updates.

---

## 10. Milestones and acceptance criteria

Stop after each milestone and summarize the work for review before continuing.

**M1: Scaffold**
Expo + TS strict, Expo Router, ESLint/Prettier, Jest, Maestro, MMKV, Zustand, i18next with en/ar and RTL switching, theme tokens and fonts, CI workflow, EAS config (`development`, `preview`, `production` profiles).
✅ The dev build runs on an iOS simulator and an Android emulator, the home screen renders in en and ar (RTL), and CI is green.

**M2: Core**
Storage adapter, players, session/scoreboard, RNG, punishment engine, content loader with region/locale/level/tier filters, the `content:check` script, and the UI kit (Button, Card, Stepper, Toggle, Chip, Panel, ConfirmInline, Scoreboard).
✅ Unit tests: deck no-repeat, mix, group punishment when there are more than 3 losers, swap once, filters, persistence round-trip. Every UI kit component renders in both themes and both directions.

**M3: Spy logic**
`games/spy/logic.ts`.
✅ Tests for every scoring row, 1 and 2 spies, no category twice in a row, word no-repeat until exhaustion, spies clamped when players < 7, result titles.

**M4: Spy screens**
Setup, Pass, Card, Round, the Who won? panel, results and punishments; app-switcher privacy cover; haptics; keep-awake during a game.
✅ A Maestro flow plays 5 players through 2 rounds and checks that the scores persist after relaunch. The same flow passes in Arabic.

**M5: Content**
Port the Egypt packs, the **Cheeky** pack (§6) and punishments from the prototype, write the Global packs (en + ar, including a Global Cheeky pack) and Arabic punishments. Tag every pack with a level and a tier.
✅ `content:check` passes. No adult-level word exists anywhere in the repo.

**M6: Polish**
App icon, splash, sound effects (toggleable), animations, accessibility audit (VoiceOver/TalkBack), and dynamic type up to 200% without clipping.

**After M6:** Werewolf (`docs/games/werewolf.md`, W1–W6), Blend In (`docs/games/blend-in.md`), then monetization P1–P6 (`docs/monetization.md` §11).

**M7: Release**
EAS production builds, store metadata for en and ar, in-app products, screenshots, privacy policy and forms, and submission with EAS Submit.

---

## 11. Roadmap (keep the core flexible for these)

- **Heads Up:** phone on the forehead, tilt to answer (expo-sensors), timed rounds, reuses the word packs.
- **Taboo:** describe the word without the forbidden words; teams.
- **Charades:** act it out, timer, team scores.
- **Who am I?:** region packs of famous people and things.
- **Lamma After Dark:** an 18+ app from the same codebase with adult content and its own store listing (launch after Eid at the earliest).
- Huawei AppGallery build (Huawei purchases, ads and integrity checks).
- More locales: es, fr, pt-BR, tr and de are the next candidates by market size for party games.
