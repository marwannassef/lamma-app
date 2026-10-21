# Store and RevenueCat setup

The app's purchase code is ready (`src/core/entitlements/purchases.ts`). It stays on "unavailable"
until the steps below are done and the two public RevenueCat keys are set. Prices and products follow
`docs/monetization.md` §2.

| Our name   | Product ID (both stores) | Type                                             | US price      | Egypt (start) |
| ---------- | ------------------------ | ------------------------------------------------ | ------------- | ------------- |
| Party Pass | `lamma_party_pass_7d`    | Consumable (one-time, can be bought again)       | $2.99         | ~EGP 59       |
| Annual     | `lamma_premium_annual`   | Auto-renewing subscription, 1 year               | $14.99 / year | ~EGP 299      |
| Lifetime   | `lamma_premium_lifetime` | Non-consumable (iOS) / one-time product (Google) | $24.99        | ~EGP 479      |

Other lower-income markets: about 40% of the US price. Rich markets: the US price.

## 1. App Store Connect

1. **Apps → + → New App**: platform iOS, name "Lamma", bundle ID `com.anventureslabs.lamma`,
   SKU `lamma`. (Register the bundle ID first under Certificates, IDs & Profiles if it isn't listed;
   turn on the **In-App Purchase** capability.)
2. **Agreements, Tax and Banking**: accept the Paid Apps agreement and add bank and tax details.
   Purchases don't work until this is active.
3. **Monetization → In-App Purchases → +**:
   - Consumable, reference name "Party Pass", product ID `lamma_party_pass_7d`.
   - Non-Consumable, "Lifetime", `lamma_premium_lifetime`.
4. **Monetization → Subscriptions**: create a group "Lamma Premium", then a subscription
   "Annual", product ID `lamma_premium_annual`, duration 1 year.
5. For each product: price, an English and an Arabic display name and description, and a review
   screenshot of the paywall.
6. **Users and Access → Integrations → In-App Purchase**: generate an **In-App Purchase key**
   (.p8) for RevenueCat. Note the Key ID and Issuer ID.

## 2. Google Play Console

1. **Create app**: "Lamma", game, free. Package `com.anventureslabs.lamma`.
2. Upload one build to **Internal testing** first: Play only lets you create products after a
   build that includes billing has been uploaded. (`bunx eas-cli build -p android --profile
preview`, or ask Claude to run it.)
3. **Monetize → Products → In-app products**:
   - `lamma_party_pass_7d`, "Party Pass".
   - `lamma_premium_lifetime`, "Lifetime".
4. **Monetize → Products → Subscriptions**: `lamma_premium_annual`, with one auto-renewing base plan,
   billing period 1 year.
5. Prices, English and Arabic names and descriptions, then **Activate** each one.
6. Give RevenueCat access: follow RevenueCat's "Google Play service credentials" guide (a Google
   Cloud service account JSON, invited in Play Console with financial permissions).
7. **Setup → License testing**: add your Google account so test purchases are free.

## 3. RevenueCat

1. Sign up at app.revenuecat.com and create a project "Lamma".
2. **Apps**: add an App Store app (bundle ID `com.anventureslabs.lamma`, upload the .p8 key with its
   Key ID and Issuer ID) and a Play Store app (package `com.anventureslabs.lamma`, upload the
   service account JSON).
3. **Products**: import the three products from each store.
4. **Entitlements**: create `lamma_pro` (the identifier the app checks) and attach **Annual and
   Lifetime only**. Don't attach the
   Party Pass: RevenueCat would treat a consumable as "forever". The app counts 7 days from each
   Party Pass purchase itself, adding a week when one is bought while another is running.
5. **Offerings**: the `default` offering (mark it current) with three packages:
   - Annual (`$rc_annual`) → `lamma_premium_annual`
   - Lifetime (`$rc_lifetime`) → `lamma_premium_lifetime`
   - Custom, identifier `party_pass` → `lamma_party_pass_7d`
6. **API keys**: copy the **public** SDK key for each app (`appl_…` and `goog_…`). These are meant
   to ship inside the app; never use a secret key (`sk_…`) here.

## 4. Give the keys to the app

The app reads them from these environment variables:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
```

- **Local builds:** put them in a `.env.local` file at the repo root (git-ignored), then restart
  Metro.
- **EAS builds:** add both as EAS environment variables (`bunx eas-cli env:create` or the Expo
  dashboard → Environment variables) for the preview and production environments.

Then rebuild the app (the SDK is native code), open the paywall, and the prices come from the store.

## 5. Test

- iOS: a Sandbox tester (App Store Connect → Users and Access → Sandbox) on a real iPhone, or a
  StoreKit configuration file in the simulator.
- Android: a license tester account on a device or emulator signed in to Google Play, with the
  app installed from the Internal testing track.
- Check: buy each product, restore on a second install, a Party Pass ends after 7 days (or set a
  shorter sandbox time), and Annual shows Premium while active.

## Later (monetization §9, P4)

Our own backend will take over from RevenueCat's client-side info: RevenueCat webhooks → our server
→ a signed offline pass the app checks.

## Before submitting to the App Store

- **Remove the tester Premium switch.** TestFlight builds are made with `EXPO_PUBLIC_TESTER_PREMIUM=1`
  (an EAS environment variable on the production environment), which shows "Preview Premium" in
  Settings so the app can be tested before store purchases work. Delete it before the release build:
  `bunx eas-cli env:delete --variable-name EXPO_PUBLIC_TESTER_PREMIUM --variable-environment production`
  (or in the Expo dashboard → Environment variables), then build. Without it the switch doesn't exist.

## Shop items (single word packs and role cards)

The Shop (🛍️ on the home screen, and "Buy just this" on a locked item's paywall) sells each Premium
word pack and each Werewolf role card outside Basic on its own. Premium includes all of them.

Create each product below in **both stores** as a **non-consumable** one-time product
(App Store: Non-Consumable; Play: one-time product with purchase option `buy`, then import it in
RevenueCat as **Non-consumable**). Suggested price **$0.99** (Tier 1; lower in Tiers 2–3). Do
**not** attach them to the `lamma_pro` entitlement or add them to an offering: the app buys them
by product ID and unlocks them from the purchase itself. Items not created yet stay listed, and
buying one explains it isn't on sale yet.

| Product ID                      | Name                                  | Type           |
| ------------------------------- | ------------------------------------- | -------------- |
| `lamma_pack_egypt_beach`        | Beach & summer (Egypt) word pack      | Non-consumable |
| `lamma_pack_egypt_cheeky`       | Cheeky (Egypt) word pack              | Non-consumable |
| `lamma_pack_egypt_fruit`        | Fruits & veggies (Egypt) word pack    | Non-consumable |
| `lamma_pack_egypt_games`        | Games & toys (Egypt) word pack        | Non-consumable |
| `lamma_pack_egypt_jobs`         | Jobs (Egypt) word pack                | Non-consumable |
| `lamma_pack_egypt_ramadan`      | Ramadan & Eid (Egypt) word pack       | Non-consumable |
| `lamma_pack_egypt_school`       | School (Egypt) word pack              | Non-consumable |
| `lamma_pack_egypt_street`       | Street life (Egypt) word pack         | Non-consumable |
| `lamma_pack_egypt_transport`    | Transport (Egypt) word pack           | Non-consumable |
| `lamma_pack_global_beach`       | Beach & summer (Worldwide) word pack  | Non-consumable |
| `lamma_pack_global_cheeky`      | Cheeky (Worldwide) word pack          | Non-consumable |
| `lamma_pack_global_clothes`     | Clothes (Worldwide) word pack         | Non-consumable |
| `lamma_pack_global_games`       | Games & toys (Worldwide) word pack    | Non-consumable |
| `lamma_pack_global_instruments` | Instruments (Worldwide) word pack     | Non-consumable |
| `lamma_pack_global_landmarks`   | World landmarks (Worldwide) word pack | Non-consumable |
| `lamma_pack_global_school`      | School (Worldwide) word pack          | Non-consumable |
| `lamma_pack_global_sports`      | Sports (Worldwide) word pack          | Non-consumable |
| `lamma_pack_global_transport`   | Transport (Worldwide) word pack       | Non-consumable |
| `lamma_role_alpha`              | Alpha Werewolf role card              | Non-consumable |
| `lamma_role_wolf_cub`           | Wolf Cub role card                    | Non-consumable |
| `lamma_role_lone_wolf`          | Lone Wolf role card                   | Non-consumable |
| `lamma_role_sorcerer`           | Sorcerer role card                    | Non-consumable |
| `lamma_role_apprentice_seer`    | Apprentice Seer role card             | Non-consumable |
| `lamma_role_witch`              | Witch role card                       | Non-consumable |
| `lamma_role_hunter`             | Hunter role card                      | Non-consumable |
| `lamma_role_cupid`              | Cupid role card                       | Non-consumable |
| `lamma_role_mayor`              | Mayor role card                       | Non-consumable |
| `lamma_role_lycan`              | Lycan role card                       | Non-consumable |
| `lamma_role_cursed`             | Cursed role card                      | Non-consumable |
| `lamma_role_tanner`             | Tanner role card                      | Non-consumable |
| `lamma_role_serial_killer`      | Serial Killer role card               | Non-consumable |
