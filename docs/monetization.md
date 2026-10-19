# Lamma: Monetization, Content Levels and Protection — Spec

> Save as `docs/monetization.md`. It applies to every game and works together with `docs/BRIEF.md` (the brief points here for anything about money, ads, age, the backend and anti-piracy). Claude Code decides the implementation details; this file sets the rules, the numbers and the behavior.

---

## 1. Summary of decisions

| Topic          | Decision                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Model          | **Free with limits + ads**, plus **Party Pass**, **Annual** and **Lifetime**                                      |
| Free tier      | **Every game is free**, with limits on players, content and options                                               |
| Store rating   | **Teen** (Apple 13+, Google Teen)                                                                                 |
| Content levels | **Kids / Teen** inside Lamma. Adult content isn't in this app (a possible separate "After Dark" app later)        |
| Age            | Platform age signals plus a "Who's playing?" choice and a parent PIN decide the content level and the ad settings |
| Internet       | Not required for every game: a signed **offline pass** (72 h free, 30 days paid)                                  |
| Backend        | Small: Cloud Run + Firestore + Cloud Storage on GCP, managed with Terraform                                       |
| Anti-piracy    | Server-side purchase checks, app integrity checks, premium content only from the server, encrypted at rest        |

---

## 2. Products and prices

| Product        | Type                       | US price      | Egypt (starting point) | Grants               |
| -------------- | -------------------------- | ------------- | ---------------------- | -------------------- |
| **Party Pass** | 7 days, **does not renew** | $2.99         | ~EGP 59                | Premium for 7 days   |
| **Annual**     | Auto-renewing subscription | $14.99 / year | ~EGP 299               | Premium while active |
| **Lifetime**   | One-time purchase          | $24.99        | ~EGP 479               | Premium forever      |

- Other lower-income markets: about **40% of the US price**. Rich markets (US, Gulf, Europe): the US price, using each store's local price levels. Check the exchange rates when setting the EGP prices.
- **Party Pass stacking:** buying another pass while one is active adds 7 days to the end date.
- **Annual:** no free trial at launch (party use is short, and a trial would mostly be used for one night and cancelled). Test a 3-day trial later.
- **Apple Family Sharing:** off at launch for Lifetime and Annual; revisit after looking at the data.
- **Restore purchases:** in Settings and on every paywall (Apple requires it).
- Purchases go through **RevenueCat**. Our server is the source of truth for what a user owns (§9). It works out each Party Pass's end date from the purchase time.

---

## 3. Free vs Premium

|                                | Free                                                                | Premium                                                                     |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Spy**                        | Up to **6 players**, 1 spy, free categories, Light punishments only | 3–12 players, 2 spies, all categories, all punishment levels                |
| **Werewolf**                   | Up to **8 players**, **Basic** setups only                          | 4–16 players, all setups, Custom, Surprise me, all house rules, voice packs |
| **Blend In**                   | Up to **6 players**, Classic mode, Normal difficulty, free topics   | 3–12 players, Undercover mode, all difficulties, all topics                 |
| **Content**                    | 3–4 packs per game per region (Kids or Teen level)                  | All packs, including new ones as they're released                           |
| **Ads**                        | Yes (§5)                                                            | None                                                                        |
| **Offline**                    | 72-hour offline pass                                                | 30-day offline pass                                                         |
| **Scoreboard and punishments** | Yes                                                                 | Yes                                                                         |

**Locked items stay visible** with a 🔒 (categories, player counts above the cap, options). Tapping one opens the paywall at that exact point. Never hide what Premium includes.

Which packs are free is set by the server (remote config), so it can change without an app update.

---

## 4. Paywall

**Where it opens** (the paywall is never shown when the app starts):

1. **Adding a player above the free cap** → "Your group is big! 🎉 Unlock up to {max} players." This is the main moment to sell.
2. Tapping a locked pack, option or mode.
3. At the end of a game (game over or after 5 rounds), at most **once per day**: a soft card "Loved it? Get everything."
4. When the offline pass runs out (§6).
5. Settings → "Lamma Premium".

**Layout:**

- What Premium includes (players, packs, no ads, offline).
- The three products side by side, with **Lifetime marked "Best value"** and selected by default.
- Party Pass worded as "Perfect for tonight's gathering".
- Restore purchases, terms and privacy links.

**Rewarded-ad alternative** (shown on paywall triggers 1 and 2 for free users):

- "Watch a short ad to play with your whole group this session." This lifts the player cap until the app is closed or 3 hours pass.
- "Watch an ad to unlock {pack} for 24 hours."
- At most **3 rewarded unlocks per day**. The reward is granted only after the server confirms the ad was watched (§9).

**Experiments:** the paywall layout and prices must be changeable from the server (RevenueCat offerings and experiments), so they can be A/B tested without an app update.

---

## 5. Ads (free users only)

- **Interstitial:** only on the scoreboard screen after a round, at most **one every 3 rounds** and **one every 4 minutes**.
- **No ads in a user's first 3 games ever.** Never during card passes, the clue circle, Werewolf nights or any secret screen.
- **Rewarded:** only when the user chooses it (§4).
- **No banners** (one phone is shared at the table, so the screen space matters).
- Ad SDK: **Google Mobile Ads (AdMob)**, with Google's consent tool (UMP) where required (EEA, UK and similar).
- **Ad settings follow the age and content level** (§7):

| Situation                         | Ad settings                                           |
| --------------------------------- | ----------------------------------------------------- |
| Kids mode, or age signal under 13 | Child-directed, non-personalized, max ad rating **G** |
| Age signal 13–17                  | Non-personalized, max rating **T**                    |
| Adult or unknown, consent given   | Personalized, max rating **T**                        |
| Adult or unknown, no consent      | Non-personalized, max rating **T**                    |

- **iOS tracking permission (ATT):** ask only after the user's 3rd game, preceded by a short explanation screen. If declined, use non-personalized ads.
- Ad frequency, the first-games grace period and the rewarded caps all come from remote config.

---

## 6. Offline pass

- When online, the app gets a **signed pass** from our server: about 72 h for free users, 30 days for Premium. It's tied to the install and to what the user owns.
- While the pass is valid, the app works **fully offline** at the user's tier.
- **Free pass expired and offline → limited mode:** Spy only, free Kids/Teen packs, up to 6 players, plus a friendly card: "Connect to the internet to unlock everything, or go Premium to play offline anywhere." No error screens.
- The pass renews quietly whenever the app is online (at launch and when returning to the app).
- The pass is checked on the device with a public key, so the check works offline. The private key is only on the server.
- Pass lengths come from remote config.

---

## 7. Content levels and age

### Levels

Every pack (and, where needed, every word) has a level:

- **Kids:** fine for any age.
- **Teen:** crude humor and mild cheekiness, e.g. the **Cheeky** pack (diaper, burp, fart, underwear, bald spot). Nothing sexual, nothing violent beyond cartoonish, no drugs or alcohol.
- **Adult:** never shipped in Lamma. Reserved for a possible separate "Lamma After Dark" app built from the same code.

Punishments get levels too: anything with physical contact or embarrassment beyond mild is Teen.

### How the level is decided

1. **Platform age signal**, read once at first launch and refreshed occasionally:
   - iOS 26+: Apple's **Declared Age Range** (ask for ranges at 13 and 18).
   - Android: Google **Play Age Signals**, where available.
   - Otherwise: **unknown**.
2. **"Who's playing tonight?"**, asked at first launch: _Kids are playing_ → Kids; _Teens and adults_ → Teen. It can be changed in Settings.
3. **Parent PIN:** switching from Kids to Teen needs a 4-digit PIN, set the first time Kids mode is chosen. It can be reset by reinstalling, which is acceptable for a party game.

**Effective level = the lower of the age-signal cap and the chosen level:**

| Age signal     | Highest level allowed                |
| -------------- | ------------------------------------ |
| Under 13       | Kids (and the PIN can't override it) |
| 13–17          | Teen                                 |
| 18+ or unknown | Teen                                 |

- Teen packs also keep the existing in-game confirmation ("Everyone at the table OK with cheeky words?") the first time per session.
- Kids mode changes ads (§5), hides Teen packs everywhere (category grids, random mode, Werewolf narration lines tagged Teen, punishments) and shows a small "Kids mode" badge on the home screen.

---

## 8. Privacy and compliance (replaces "no data collected")

- **Data collected:** an anonymous install ID, purchase status, ad identifiers (with consent), basic usage events (§10) and crash reports. No names, no player names leave the device, no contacts, no location beyond the region the stores provide.
- Update the **App Store privacy label** and the **Play Data safety form** to match exactly. Publish a privacy policy page.
- **Consent:** UMP in required regions; iOS ATT as in §5; analytics and crash reporting follow the same consent.
- **Kids:** the app isn't directed at children (Teen rating, teen and adult marketing), but Kids mode exists for families. Store listing text and screenshots must not target young children. **Don't** enroll in Apple's Kids Category or Google's Designed for Families.
- **Age rating questionnaires:** answer for the Teen content (crude humor) honestly.

---

## 9. Backend and anti-piracy

### Backend (small, on GCP)

- **Cloud Run** service in TypeScript (shares types with the app), **Firestore**, **Cloud Storage** for content, **Secret Manager** for keys. Everything managed with **Terraform**, deployed by **GitHub Actions**.
- Responsibilities:
  1. **Register and attest an install:** check Play Integrity / App Attest, then issue the offline pass.
  2. **Entitlements:** receive RevenueCat webhooks and keep each install's/user's entitlement (including Party Pass end dates).
  3. **Content:** serve the content manifest, the encrypted premium packs and their keys, only to attested installs with the right entitlement.
  4. **Rewarded ads:** receive AdMob server-side verification callbacks and record rewards; the app unlocks only after the server confirms.
  5. **Remote config:** free packs, caps, ad frequency, pass lengths, minimum supported app version, kill switches.
- Expected cost at launch: tens of dollars per month.

### Anti-piracy rules

1. **Nothing valuable is decided on the device alone.** No `isPremium` flag the app trusts by itself; entitlements come from the server (cached in the signed pass for offline use).
2. **App integrity:** Google **Play Integrity** (Android) and Apple **App Attest** (iOS). Installs that fail get the free tier only: no premium content, no premium pass.
3. **Premium content isn't in the app.** The app ships with free content only. Premium packs, voice packs and future games' premium content are downloaded after the checks, stored **encrypted**, and decrypted only in memory.
4. **Turn on Google Play's automatic protection** in Play Console (anti-tampering checks and a prompt to reinstall from Play).
5. **Make tampering harder:** Hermes bytecode, R8/ProGuard on Android, no secrets or private keys in the app.
6. **Old and cracked versions die:** a server-side minimum version (older versions get a friendly "Please update" screen and the limited mode), and content keys rotate each release.
7. **Don't punish false positives:** rooted phones, custom ROMs and phones without Google services get the **free tier with ads** (or limited mode if no ads are possible). They never get a broken app.

### Phones without Google Play services (e.g. newer Huawei)

- No Play Billing, AdMob or Play Integrity on these phones. At launch they get the **free tier without ads** and a short offline pass.
- Later: an **AppGallery** build with Huawei's in-app purchases, ads and integrity checks.

---

## 10. Analytics (needed to see if the model works)

- **Firebase Analytics** and **Crashlytics**, following consent (§8). No personal data, no player names.
- **Events:** `app_open`, `game_start` (game, players, tier), `round_end`, `game_end`, `cap_hit` (which limit), `paywall_view` (trigger), `purchase_start` / `purchase_success` (product), `restore`, `rewarded_offer` / `rewarded_complete`, `interstitial_shown`, `offline_limited_mode`, `content_level_set`.
- **Key numbers to watch:**
  - share of games that hit a cap
  - paywall-to-purchase conversion per trigger
  - day-1 and day-7 retention for users who see ads vs those who don't
  - average revenue per daily user, by country

---

## 11. Milestones (after the games' own milestones; stop for review after each)

- **P1, backend skeleton:** Terraform for Cloud Run, Firestore, Storage and secrets; CI deploy; remote config endpoint; health checks.
- **P2, content levels and age:** level tags on all content, the age signals, "Who's playing?", the parent PIN, the Kids mode filters everywhere.
- **P3, purchases:** RevenueCat, the three products, entitlement webhooks, paywall with its triggers, restore, the free caps in all three games.
- **P4, offline pass and protection:** install attestation, signed passes, limited mode, minimum version, encrypted premium content delivery.
- **P5, ads:** AdMob with consent, the frequency rules, rewarded unlocks with server-side verification, ad settings by age/level.
- **P6, analytics:** events, Crashlytics, the privacy label and Data safety updates, privacy policy.

**Done means:**

- A free user hits each cap and sees the right paywall.
- A Party Pass expires after exactly 7 days, and stacking works.
- A Lifetime purchase restores on a new phone.
- Kids mode hides every Teen item in all three games.
- Under-13 signals force Kids mode and child-safe ads.
- Offline for 4 days on the free tier → limited mode. Premium offline for 4 days → everything works.
- A modified build fails attestation and gets free content only.
- An old version below the minimum sees the update screen.
