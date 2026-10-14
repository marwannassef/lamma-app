# Lamma: Party Games — Build Brief

> Hand this file to Claude Code at the root of the repo (save it as `docs/BRIEF.md`).
>
> - `docs/reference/spy-prototype.html` is a working single-file prototype of the first game. It's the source of truth for Spy's **behavior**, its Egypt word pack and the punishments. Don't copy its visuals; §8 replaces them.
> - `docs/brand/an-ventures-labs.jpg` is the publisher logo, and the source of the palette in §8.

---

## 1. Product

|                     |                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App name            | **Lamma** (from Arabic لمّة, "the gathering")                                                                                  |
| Store title         | `Lamma: Spy & Party Games` (localized per store locale; add game names as they ship)                                           |
| Tagline             | One phone. Everyone plays.                                                                                                     |
| Publisher           | AN Ventures Labs                                                                                                               |
| Repo                | `lamma`                                                                                                                        |
| Bundle / package id | `com.anventureslabs.lamma`                                                                                                     |
| Markets             | Worldwide. Launch locales are **English** and **Arabic**; the architecture must let us add a locale by adding files, not code. |

**What it is:** a collection of offline pass-the-phone party games. One phone gets passed around the group and everyone plays in person. Game 1 is **Spy**; later games (Werewolf, Heads Up, Taboo, Charades and others) are modules inside the same app.

**Audience:** families and friend groups, ages 7+. The default content is family-safe in every locale.

**Non-negotiables**

- Fully offline. No accounts and no backend in v1. **No data is collected**: no analytics, no ads, no tracking SDKs.
- One codebase for iOS and Android, with a native feel at 60fps on mid-range Android.
- First card on screen within 10 seconds of a cold start.
- Full RTL support (not just mirrored text). Accessible: dynamic type, screen reader labels, reduced motion.
- Adult content is excluded from store builds at build time (§6).

---

## 2. Tech stack

| Concern                   | Choice                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Framework                 | **Expo** (latest stable SDK) + React Native + **TypeScript strict**                                         |
| Navigation                | **Expo Router** (file-based)                                                                                |
| State                     | **Zustand** slices with `persist`                                                                           |
| Storage                   | **react-native-mmkv** behind a `storage` adapter (so a dev build is needed; that's fine)                    |
| Animation                 | **react-native-reanimated** + react-native-gesture-handler                                                  |
| i18n                      | **i18next** + react-i18next + **expo-localization**; ICU plurals                                            |
| Native                    | expo-haptics, expo-keep-awake, expo-font, expo-splash-screen, expo-screen-orientation, expo-av (sfx, later) |
| Fonts                     | Bundled locally (§8)                                                                                        |
| Unit tests                | Jest + @testing-library/react-native                                                                        |
| E2E                       | **Maestro** flows                                                                                           |
| Lint / format             | ESLint (expo config + strict TS rules) + Prettier                                                           |
| Build / release           | **EAS Build**, **EAS Submit**, **EAS Update** (OTA updates for JS and content fixes)                        |
| CI                        | GitHub Actions: typecheck, lint, tests on PRs; EAS builds triggered on tags                                 |
| Purchases (later, not v1) | RevenueCat; keep `isLocked` hooks only                                                                      |

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
    content/                  # pack types, loader, filters (locale, adult)
    i18n/                     # i18next setup, locale detection, RTL handling
    settings/                 # language, content region, adult mode, haptics, sound
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

3 to 12 players (default 5), with optional names (max 14 characters) defaulting to "Player N" localized. They're persisted and shared by every game.

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

Language (system / en / ar), **content region** (§5), haptics, sound, adult mode (only exists in builds where it's enabled), and an About screen (publisher, version, privacy statement).

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
  adult?: boolean;
  display: {
    primary: LocaleCode | 'ui'; // big line on the card ("ui" = the user's UI language)
    secondary?: LocaleCode | 'translit'; // medium line
    tertiary?: LocaleCode; // small line
  };
  words: Array<{
    id: string;
    text: Record<LocaleCode, string>;
    translit?: string; // Franco/Arabizi, romaji, etc.
  }>;
}
```

**Launch packs**

- **Global** (region `global`, `en` + `ar` text): universal categories such as Food, Animals, Jobs, School, Transport, Home, Sports, Places (world landmarks), Games & toys, Beach & summer. On the card: the UI language is primary and the other language is secondary.
- **Egypt** (region `eg`): port **every** category from the prototype (Egyptian food, Things at home, Places in Egypt, Animals, Jobs, School, Transport, Fruits & veggies, Games & toys, Ramadan & Eid, Beach & summer). Card display: **English big, Franco medium, Arabic small**, exactly like the prototype, because many Egyptian kids read English/Franco more easily than Arabic script.

**Region selection:** the default comes from the device region (Egypt → Global + Egypt; anywhere else → Global). The user can change it in Settings, and random mode picks only from enabled regions.

**Validation script** (`npm run content:check`, run in CI): every word has text for each locale the pack declares; at least 20 words per pack; unique ids; no duplicate words inside a pack; adult packs flagged correctly.

**Writing guidelines:** words a 7–12-year-old knows, but not so obvious that the spy guesses them instantly. Franco uses the common numerals (2 = ء/ق, 3 = ع, 5 = خ, 7 = ح) with the most common spelling (e.g. `ta3meya`, `ma7shy`, `tok tok`).

---

## 6. Adult content

- The prototype has a `🔥 +18 Spicy` pack ("Kalam kharg", Egypt region). Port it to `content/packs/adult/` as an **adult** pack.
- Gate it behind `EXPO_PUBLIC_ENABLE_ADULT`, which is **false in every store profile**. When it's false, the adult packs and the setting are **not bundled at all** (exclude them at build time, not just hide them).
- When it's enabled (internal/dev builds), turning it on asks for inline 18+ confirmation, and confirming selects the pack. Turning it off hides the pack, removes it from random mode, and resets the selection to random.
- Reason: the store age rating (Apple and IARC on Google Play) covers everything in the binary. Whether adult content ever ships, for example as a separate app, is a later business decision.

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

### Round setup (pure)

1. Choose the category (respecting region and adult filters).
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

- **Privacy:** no data collected. App Store privacy label "Data Not Collected"; Play Data safety "No data collected or shared". Add a simple privacy policy page (required by both stores). Mention it in About.
- **Age rating:** answer the Apple questionnaire and IARC truthfully for the store build without adult content; expect a low rating.
- **Don't enroll in Apple's Kids Category or Google's Designed for Families in v1.** Their extra requirements limit future monetization. Revisit later.
- **Store listings:** localized title, subtitle and description for en and ar, and screenshots for both (Arabic screenshots must show the RTL UI).
- **Regional pricing:** free in v1.
- **Versioning:** semver; `1.0.0` = Spy. JS and content fixes go out through EAS Update channels (`production`, `preview`).
- **Crash reporting:** off in v1, so the "Data Not Collected" label stays true. Reconsider later with an opt-in.

---

## 10. Milestones and acceptance criteria

Stop after each milestone and summarize the work for review before continuing.

**M1: Scaffold**
Expo + TS strict, Expo Router, ESLint/Prettier, Jest, Maestro, MMKV, Zustand, i18next with en/ar and RTL switching, theme tokens and fonts, CI workflow, EAS config (`development`, `preview`, `production` profiles; adult flag false outside `development`).
✅ The dev build runs on an iOS simulator and an Android emulator, the home screen renders in en and ar (RTL), and CI is green.

**M2: Core**
Storage adapter, players, session/scoreboard, RNG, punishment engine, content loader with region/locale/adult filters, the `content:check` script, and the UI kit (Button, Card, Stepper, Toggle, Chip, Panel, ConfirmInline, Scoreboard).
✅ Unit tests: deck no-repeat, mix, group punishment when there are more than 3 losers, swap once, filters, persistence round-trip. Every UI kit component renders in both themes and both directions.

**M3: Spy logic**
`games/spy/logic.ts`.
✅ Tests for every scoring row, 1 and 2 spies, no category twice in a row, word no-repeat until exhaustion, spies clamped when players < 7, result titles.

**M4: Spy screens**
Setup, Pass, Card, Round, the Who won? panel, results and punishments; app-switcher privacy cover; haptics; keep-awake during a game.
✅ A Maestro flow plays 5 players through 2 rounds and checks that the scores persist after relaunch. The same flow passes in Arabic.

**M5: Content**
Port the Egypt packs, adult pack and punishments from the prototype, write the Global packs (en + ar), and Arabic punishments.
✅ `content:check` passes. The adult pack is absent from a production build (verify the bundle).

**M6: Polish**
App icon, splash, sound effects (toggleable), animations, accessibility audit (VoiceOver/TalkBack), and dynamic type up to 200% without clipping.

**M7: Release**
EAS production builds, store metadata for en and ar, screenshots, privacy policy, and submission with EAS Submit.

---

## 11. Roadmap (keep the core flexible for these)

- **Werewolf / Mafia:** secret roles by pass-the-phone, a guided narrator for night/day phases with timers and audio cues, elimination tracking.
- **Heads Up:** phone on the forehead, tilt to answer (expo-sensors), timed rounds, reuses the word packs.
- **Taboo:** describe the word without the forbidden words; teams.
- **Charades:** act it out, timer, team scores.
- **Who am I?:** region packs of famous people and things.
- Monetization: premium packs and a "game night pass" via RevenueCat.
- More locales: es, fr, pt-BR, tr and de are the next candidates by market size for party games.
