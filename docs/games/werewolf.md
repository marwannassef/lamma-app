# Werewolf: Center-Table Edition — Game Spec

> Save as `docs/games/werewolf.md`. This is game #2 in **Lamma**. Everything in `docs/BRIEF.md` applies: the stack, the code rules, i18n, the design system and privacy. This file covers only what's specific to Werewolf.
> All rule logic must be pure TypeScript (`src/games/werewolf/engine/`), with no React, an injected RNG and full test coverage. The Dart in the original design notes is **not** to be ported; the TypeScript contracts below replace it.

---

## 1. Concept

One phone sits in the **center of the table** and acts as narrator, game master and secret-action device. There's no human moderator: everyone plays.

The loop:

```
SETUP → DISCOVERY PASS (everyone learns their role)
  └─► NIGHT: narration + masking audio → wolves' silent glance (10–12 s) → one action pass around the table
        └─► NIGHT RESOLUTION (pure engine)
              └─► DAY: morning reveal → death effects → discussion timer → point & vote → execution → death effects
                    └─► WIN CHECK → next night
```

- Players: **4–16**.
- **Core change required:** the shared roster must support up to 16 players and **drag-to-reorder into seating order**, because the action pass goes around the table clockwise in roster order. The GameModule's `minPlayers`/`maxPlayers` limit each game, so Spy stays at 3–12.

---

## 2. Phases in detail

### 2.1 Setup

1. Pick or confirm the players, ordered by seating (clockwise).
2. Pick one of the **recommended setups** for this player count (Basic is always offered) or build a **Custom** setup (§5).
3. House rules (§6).
4. Narrator voice pack and volume.
5. `Start game`.

### 2.2 Discovery pass (secret role reveal)

- The screen says "Pass the phone to {name}". The player taps `I'm {name}`, then **holds a wax-seal button** to reveal their card.
- **Releasing hides the card instantly.** Then: "Hand the phone to {next}".
- The role card shows: illustration, role name, team color, ability, notes.
- **Werewolf pack members** (Werewolf, Alpha, Wolf Cub, Lone Wolf) also see their packmates' names. The Sorcerer sees the pack's names; the pack doesn't see the Sorcerer.
- **Cupid picks the two lovers here**, during their own discovery turn (two taps plus a confirm). This is a deliberate change from the original notes; see §9, D1.
- All discovery turns use the same layout and the same minimum hold time (§4), so nobody can tell roles apart by timing.

### 2.3 Night

**A. Call to sleep (hands-free).** The narrator says: "Night falls upon the village… Everyone, close your eyes." A continuous masking ambience starts (rain, wind, thunder, a tavern drone) at the house-rule volume (default 70%).

**B. Werewolf silent glance (10–12 s, configurable).** "Werewolves, open your eyes. Find your pack and silently agree on your victim. Ten seconds." A heartbeat sound plays. The wolves point at their victim; no device input happens here. Then: "Werewolves, close your eyes… Everyone, open your eyes. Pass the phone around the table."

- If Wolf Cub revenge is active: "Tonight the pack hunts **twice**. Agree on two victims."

**C. Single action pass.** One full clockwise rotation, starting at the first living-or-dead seat after a **rotating start seat**: the start moves one seat each night so nobody is permanently first or last.

- **Every seat takes a turn, dead players included,** so the pass rhythm never changes.
- **Each turn:**
  1. A handoff screen ("Pass to {name}", with no secrets on it).
  2. Hold-to-reveal.
  3. The role's action screen.
  4. `Confirm` becomes available only after the minimum turn time.
  5. Back to the handoff screen.

**Action screens by role** (all use the same 2-step skeleton: _choose_ → _hold to confirm_):

| Role                                    | Screen                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Villager / dead player / inactive role  | "You're dreaming. Tap a house to check the roof." The player taps any player; the choice is discarded.                                                                        |
| Werewolf / Alpha / Wolf Cub / Lone Wolf | The living non-pack roster, with packmates labeled (the Alpha's pick shows a crown icon). The player taps the agreed victim, or two victims when revenge is active.           |
| Seer                                    | Living players. Tap one: the card flips for 3 s showing 🐺 _Werewolf_ or 👤 _Not a werewolf_.                                                                                 |
| Sorcerer                                | Living players. Tap one: 🔮 _Is the Seer_ or ❌ _Not the Seer_, for 3 s.                                                                                                      |
| Doctor                                  | Living players. Tap one to protect. Can't pick the same player as the previous night (house rule: self-protect allowed on night 1 only, §6).                                  |
| Witch                                   | Two toggles: **"Use healing potion on tonight's werewolf victim"** (blind; see §9, D2) and **"Use poison"**, which reveals the roster. Each potion can be used once per game. |
| Serial Killer                           | Living players except themselves. Tap one.                                                                                                                                    |
| Apprentice Seer                         | The dummy screen until promoted; after that, the Seer screen.                                                                                                                 |
| Cursed (after being bitten)             | A banner "You were bitten. You are now a Werewolf." plus the pack screen.                                                                                                     |
| Lovers (any role)                       | A banner on every night screen: "❤️ Your lover: {name}".                                                                                                                      |

Roles without an action (Hunter, Tanner, Mayor, Lycan, unbitten Cursed) get the dummy screen.

### 2.4 Night resolution

This runs `resolveNight()` from §7 and produces a `NightReport`.

### 2.5 Day

1. **Morning reveal (narrated):**
   - Deaths: "The church bells toll… {name} did not survive the night."
   - Nobody died: "A violent struggle in the dark… but no one was harmed."
   - Several deaths: "A bloodbath in the shadows…"
   - The narration **never reveals which role saved someone or the cause of death**, unless the "Detailed narration" house rule is on.
2. **Role reveal on death:** following the house rule, either the role is revealed, or the player dies silently (hardcore mode).
3. **Death effects** (interactive, public, in this order):
   1. Hunter's last shot: hand the phone to the Hunter, who picks a target.
   2. The Mayor's badge handoff: the dying Mayor picks a successor.
   3. Effects cascade, e.g. lovers' heartbreak triggered by the Hunter's shot.
4. **Win check** (§8).
5. **Day 1 only, if the Mayor is set to "elected":** the town votes by pointing and the host selects the Mayor on the device.
6. **Discussion timer:** 60/120/180 s or untimed. Tavern music plays and speeds up for the last 30 s. The host can pause, add 30 s, or end it early.
7. **Vote:** the narrator counts down "3… 2… 1… Point!". The host taps the most-pointed player, or chooses **"Tie"** or **"No execution"**.
   - **Tie with a living Mayor:** hand the phone to the Mayor, who picks one of the tied players or "Spare everyone".
   - **Tie without a Mayor:** nobody is executed.
8. **Execution:** a dramatic reveal ("The village has banished {name}! They were… a Werewolf!"), then death effects, then the win check, then night.

---

## 3. Roles

Roles are **data plus behavior hooks** in a role registry, so adding a role never touches the engine core.

```ts
type Team = 'village' | 'wolves' | 'neutral';
type RoleId =
  | 'villager'
  | 'werewolf'
  | 'alpha'
  | 'wolfCub'
  | 'loneWolf'
  | 'sorcerer'
  | 'seer'
  | 'apprenticeSeer'
  | 'doctor'
  | 'witch'
  | 'hunter'
  | 'cupid'
  | 'mayor'
  | 'lycan'
  | 'cursed'
  | 'tanner'
  | 'serialKiller';

interface RoleDef {
  id: RoleId;
  team: Team;
  isPackWolf: boolean; // counts as a wolf for parity, knows the pack
  seerSeesAs: 'werewolf' | 'innocent';
  nightAction:
    'none' | 'wolfKill' | 'inspectWolf' | 'inspectSeer' | 'protect' | 'witch' | 'soloKill' | 'none';
  maxPerGame: number;
  i18nKey: string; // name, short ability, long description
  art: ImageSourcePropType;
  release: 'core' | 'expansion';
}
```

### 3.1 Core set (ships first)

| Role           | Team    | Rule                                                                                                                                        |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Villager       | Village | No ability.                                                                                                                                 |
| Werewolf       | Wolves  | Picks the night kill with the pack. Disagreements are resolved by §7 step 1.                                                                |
| Alpha Werewolf | Wolves  | Their pick overrides the rest of the pack.                                                                                                  |
| Seer           | Village | Each night, learns whether one player _appears_ to be a werewolf.                                                                           |
| Doctor         | Village | Protects one player per night from **wolf and Serial Killer** attacks (not from poison). Can't protect the same player two nights in a row. |
| Witch          | Village | One blind heal per game (saves the wolves' primary victim) and one poison per game (an unblockable kill).                                   |
| Hunter         | Village | On death (day or night), immediately shoots one living player.                                                                              |
| Cupid          | Village | During discovery, links two players as Lovers (Cupid may pick themselves).                                                                  |
| Tanner         | Neutral | Wins **alone, immediately**, if executed by the day vote. Dying at night doesn't count.                                                     |

### 3.2 Expansion set (behind the same engine, enabled later)

| Role                        | Team             | Rule                                                                                                                                                                                  |
| --------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wolf Cub                    | Wolves           | If killed by any means, the pack kills **two** players the following night.                                                                                                           |
| Lone Wolf                   | Wolves           | Part of the pack. Wins only if, at the moment wolves win, **every other pack wolf is dead**. Otherwise the pack wins and the Lone Wolf loses.                                         |
| Sorcerer                    | Wolves           | Knows the pack, while the pack doesn't know them. Each night checks whether one player is the Seer. Doesn't count as a wolf for parity, and the Seer sees them as innocent.           |
| Apprentice Seer             | Village          | Becomes the Seer from the night after the Seer dies.                                                                                                                                  |
| Mayor                       | Village          | Public role, assigned at setup or elected on day 1. Breaks day-vote ties. Passes the badge on death.                                                                                  |
| Lycan                       | Village          | An innocent villager whom the **Seer sees as a werewolf**.                                                                                                                            |
| Cursed                      | Village → Wolves | If the wolves' attack would kill them, they **turn into a pack werewolf** instead of dying. They're notified on their next action screen, and the pack sees them from the next night. |
| Serial Killer               | Neutral          | Kills one player every night. **Immune to wolf attacks.** The Doctor can block them; the Witch's heal can't. Wins if alive with at most one other player left.                        |
| Lovers (status, not a role) | —                | If one lover dies, the other dies immediately of heartbreak. If they're on **different teams**, both become team `lovers` and can only win as the last two players alive.             |

**Removed: Insomniac.** This edition has no role-swapping, so the role has nothing to verify (§9, D5).

---

## 4. Anti-cheat and table-safety requirements

- **Identical turn rhythm:** every turn, including dummy and dead-player turns, uses the same layout and the same 2-step interaction.
  - The minimum turn time defaults to **4.5 s** and is configurable from 3 to 8 s.
  - `Confirm` is a **hold-to-confirm** ring that only fills after the minimum time.
  - The Seer/Sorcerer result shows for 3 s; dummy turns show a "dream" card for the same 3 s.
- **Soft maximum:** after 15 s, every screen pulses gently. This keeps a long Witch turn from standing out.
- **Stealth display during secret phases:**
  - Near-black OLED background `#0A0710`, low-contrast text, no bright brand gradients.
  - Dim the app's brightness during the pass with `expo-brightness` (app-level brightness, so no system permission is needed) and restore it afterwards.
- **Identical haptics on every turn.** No audio cues on selection.
- **Leak guards:**
  - Hide secret screens in the app-switcher snapshot.
  - Block back gestures and hardware back during secret phases.
  - After `Confirm`, go straight to the neutral handoff screen.
  - A crash or relaunch **resumes at a handoff screen**, never at a secret screen.
- **Masking ambience** keeps playing quietly under the whole action pass.

---

## 5. Role setup recommendations

**Goal:** every group gets a good game without knowing the roles. When the player count is set, the app shows **2–4 recommended setups as cards** and preselects the best fit. **Basic is always there.** A **Custom** card is always last.

### 5.1 How a setup is judged

Each recommended setup is built to meet four rules:

1. **Wolf count follows the table size.** The pack is about ¼ of the players: 1 for 4–6 players, 2 for 7–9, 3 for 10–15, 4 for 16. A Serial Killer counts as an extra killer. All killers together stay at or below ⅓ of the table.
2. **Balance score.** Each role has a weight (§5.5). The sum of the weights, plus +1 for each Villager, gives the score. Recommended setups aim for **−2 to +2 ("Balanced")**. Below 7 players a slight village lean is intended, because small games end fast and one bad vote decides them.
3. **Enough plain Villagers.** Special roles need cover, so the village keeps at least 1 plain Villager from 7 players and 2 from 10. If everyone has a power, every claim is easy to check and bluffing dies.
4. **Complexity tier.** Each tier adds roles on top of the one before, so groups learn step by step:

| Tier        | Adds                                                             | Shown from         | For                               |
| ----------- | ---------------------------------------------------------------- | ------------------ | --------------------------------- |
| **Basic**   | Werewolves, Seer, Doctor (from 7 players), Villagers             | 4 players (always) | First game, kids, mixed groups    |
| **Gentle**  | Basic plus a Doctor in tiny games                                | 4–6 players        | Longer, friendlier small games    |
| **Classic** | Alpha Werewolf, Hunter, Witch                                    | 5 players          | Groups who've played before       |
| **Party**   | Cupid, Tanner, Mayor, Wolf Cub, Apprentice Seer, Lycan, Sorcerer | 7 players          | Experienced groups wanting twists |
| **Chaos**   | Serial Killer, Lone Wolf, plus Party roles                       | 10 players         | Big, experienced groups           |

### 5.2 Recommended setups (curated, verified)

These are the built-in recommendations. Use the curated table; don't generate them at runtime. Every row sums to the player count. Scores use the weights in §5.5.

| Players | Setup   | Roles                                                                                                                  | Balance             |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 4       | Basic   | Werewolf, Seer, 2× Villager                                                                                            | +3 Leans village    |
| 4       | Gentle  | Werewolf, Seer, Doctor, 1× Villager                                                                                    | +7 Village-friendly |
| 5       | Basic   | Werewolf, Seer, 3× Villager                                                                                            | +4 Leans village    |
| 5       | Gentle  | Werewolf, Seer, Doctor, 2× Villager                                                                                    | +8 Village-friendly |
| 5       | Classic | Werewolf, Seer, Hunter, 2× Villager                                                                                    | +6 Village-friendly |
| 6       | Basic   | Werewolf, Seer, 4× Villager                                                                                            | +5 Leans village    |
| 6       | Gentle  | Werewolf, Seer, Doctor, 3× Villager                                                                                    | +9 Village-friendly |
| 6       | Classic | 2× Werewolf, Seer, Doctor, 2× Villager                                                                                 | +2 Balanced         |
| 7       | Basic   | 2× Werewolf, Seer, Doctor, 3× Villager                                                                                 | +3 Leans village    |
| 7       | Classic | 2× Werewolf, Seer, Hunter, 3× Villager                                                                                 | +1 Balanced         |
| 7       | Party   | Werewolf, Wolf Cub, Seer, Doctor, Witch, Tanner, 1× Villager                                                           | +1 Balanced         |
| 8       | Basic   | 2× Werewolf, Seer, Doctor, 4× Villager                                                                                 | +4 Leans village    |
| 8       | Classic | 2× Werewolf, Seer, Witch, 4× Villager                                                                                  | +3 Leans village    |
| 8       | Party   | 2× Werewolf, Seer, Doctor, Cupid, Mayor, 2× Villager                                                                   | +1 Balanced         |
| 9       | Basic   | 2× Werewolf, Seer, Doctor, 5× Villager                                                                                 | +5 Leans village    |
| 9       | Classic | Alpha Werewolf, Werewolf, Seer, Hunter, 5× Villager                                                                    | +1 Balanced         |
| 9       | Party   | Werewolf, Wolf Cub, Seer, Doctor, Mayor, Tanner, 3× Villager                                                           | +1 Balanced         |
| 10      | Basic   | 3× Werewolf, Seer, Doctor, 5× Villager                                                                                 | -1 Balanced         |
| 10      | Classic | Alpha Werewolf, 2× Werewolf, Seer, Doctor, Witch, 4× Villager                                                          | +0 Balanced         |
| 10      | Party   | Werewolf, Wolf Cub, Seer, Doctor, Hunter, Cupid, Tanner, 3× Villager                                                   | -1 Balanced         |
| 10      | Chaos   | 2× Werewolf, Serial Killer, Seer, Doctor, Witch, Hunter, Tanner, 2× Villager                                           | -1 Balanced         |
| 11      | Basic   | 3× Werewolf, Seer, Doctor, 6× Villager                                                                                 | +0 Balanced         |
| 11      | Classic | Alpha Werewolf, 2× Werewolf, Seer, Witch, Hunter, 5× Villager                                                          | -1 Balanced         |
| 11      | Party   | 2× Werewolf, Wolf Cub, Seer, Doctor, Hunter, Mayor, Lycan, 3× Villager                                                 | -1 Balanced         |
| 11      | Chaos   | Alpha Werewolf, Werewolf, Lone Wolf, Seer, Doctor, Hunter, 5× Villager                                                 | +1 Balanced         |
| 12      | Basic   | 3× Werewolf, Seer, Doctor, 7× Villager                                                                                 | +1 Balanced         |
| 12      | Classic | Alpha Werewolf, 2× Werewolf, Seer, Doctor, Hunter, 6× Villager                                                         | +1 Balanced         |
| 12      | Party   | Alpha Werewolf, Werewolf, Wolf Cub, Seer, Apprentice Seer, Doctor, Mayor, 5× Villager                                  | +1 Balanced         |
| 12      | Chaos   | Alpha Werewolf, Werewolf, Serial Killer, Seer, Doctor, Witch, Hunter, Tanner, 4× Villager                              | -1 Balanced         |
| 13      | Basic   | 3× Werewolf, Seer, Doctor, 8× Villager                                                                                 | +2 Balanced         |
| 13      | Classic | Alpha Werewolf, 2× Werewolf, Seer, Witch, Hunter, 7× Villager                                                          | +1 Balanced         |
| 13      | Party   | Alpha Werewolf, Werewolf, Wolf Cub, Seer, Doctor, Hunter, Mayor, 6× Villager                                           | +1 Balanced         |
| 13      | Chaos   | 2× Werewolf, Lone Wolf, Serial Killer, Seer, Doctor, Witch, Hunter, 5× Villager                                        | -1 Balanced         |
| 14      | Basic   | 3× Werewolf, Seer, Doctor, 9× Villager                                                                                 | +3 Leans village    |
| 14      | Classic | Alpha Werewolf, 3× Werewolf, Seer, Doctor, Witch, Hunter, 6× Villager                                                  | -1 Balanced         |
| 14      | Party   | Alpha Werewolf, Werewolf, Wolf Cub, Sorcerer, Seer, Apprentice Seer, Doctor, Hunter, Mayor, 5× Villager                | +1 Balanced         |
| 14      | Chaos   | 2× Werewolf, Lone Wolf, Serial Killer, Seer, Apprentice Seer, Doctor, Witch, Hunter, Cupid, 4× Villager                | -1 Balanced         |
| 15      | Basic   | 3× Werewolf, Seer, Doctor, 10× Villager                                                                                | +4 Leans village    |
| 15      | Classic | Alpha Werewolf, 3× Werewolf, Seer, Doctor, Witch, Hunter, 7× Villager                                                  | +0 Balanced         |
| 15      | Party   | Alpha Werewolf, Werewolf, Wolf Cub, Seer, Apprentice Seer, Doctor, Mayor, Tanner, 7× Villager                          | +1 Balanced         |
| 15      | Chaos   | 2× Werewolf, Lone Wolf, Serial Killer, Seer, Apprentice Seer, Doctor, Witch, Hunter, Cupid, 5× Villager                | +0 Balanced         |
| 16      | Basic   | 4× Werewolf, Seer, Doctor, 10× Villager                                                                                | -2 Balanced         |
| 16      | Classic | Alpha Werewolf, 3× Werewolf, Seer, Doctor, Witch, Hunter, 8× Villager                                                  | +1 Balanced         |
| 16      | Party   | Alpha Werewolf, 2× Werewolf, Wolf Cub, Seer, Apprentice Seer, Doctor, Witch, Mayor, 7× Villager                        | +1 Balanced         |
| 16      | Chaos   | 2× Werewolf, Lone Wolf, Serial Killer, Seer, Apprentice Seer, Doctor, Witch, Hunter, Cupid, Mayor, Tanner, 4× Villager | -1 Balanced         |

A setup that uses roles not yet shipped (Party/Chaos roles before milestone W5) is **hidden**. It's never shown greyed out.

**Free tier** (`docs/monetization.md` §3): up to 8 players and the **Basic** setups only. Classic, Party, Chaos, Gentle, Surprise me and Custom cards stay visible with a 🔒 and open the paywall. Narration lines tagged Teen are skipped in Kids mode.

### 5.3 What each card shows

- Tier name and a one-line pitch, e.g. _Classic: "The Hunter takes someone down with them."_
- Role chips with counts, in team colors.
- A balance meter with its label: Village-friendly, Leans village, Balanced, Leans wolves, Wolf-friendly.
- A complexity rating of 1–3 dots.
- **Game length:** "up to N rounds", where N is how many rounds the game lasts if the village guesses wrong every day: `ceil((non-wolves − wolves) / 2)`. Also an estimated time: N × (discussion timer + 2 min).
- Buttons: `Play this` and `Edit`. `Edit` opens Custom pre-filled with this setup.

### 5.4 Which card is preselected

1. **Last setup used at this player count**, if it's still valid.
2. Otherwise, the **group experience** setting, asked once on first launch and editable later:
   - "First time" → Basic.
   - "We've played before" → Classic.
   - "Experts" → Party.
   - Chaos is never preselected.
3. **Nudge:** after the same setup is played 3 times in a row, the next tier's card gets a small "Try next" badge.
4. If the player count changes, recompute the cards and keep the same tier selected when it exists at the new count. Otherwise fall back to Basic.

**Extra card, "🎲 Surprise me" (from 7 players):** build a random setup from the roles of the group's tier and the one below it. Keep the wolf count from rule 1 and every constraint in §5.6. Retry until the score is between −2 and +2, up to 500 tries. Seed the randomness so tests are repeatable. If nothing fits, show the Party card instead.

### 5.5 Role weights

These are starting values. Tune them with playtest results and store them in one config file.

| Role            | Weight | Role          | Weight |
| --------------- | ------ | ------------- | ------ |
| Villager        | +1     | Hunter        | +3     |
| Werewolf        | −6     | Cupid         | −3     |
| Alpha Werewolf  | −8     | Mayor         | +2     |
| Wolf Cub        | −8     | Lycan         | −1     |
| Lone Wolf       | −5     | Cursed        | −3     |
| Sorcerer        | −3     | Tanner        | −2     |
| Seer            | +7     | Serial Killer | −8     |
| Apprentice Seer | +4     | Doctor        | +5     |
| Witch           | +4     |               |        |

**Score labels:** ≥ +6 Village-friendly, +3 to +5 Leans village, −2 to +2 Balanced, −5 to −3 Leans wolves, ≤ −6 Wolf-friendly.

### 5.6 Custom setup

Custom uses a role list with − / + steppers, grouped by team. Villagers **fill in automatically**, so the total always equals the player count. A live balance meter, the length estimate and the warnings update on every change.

**Hard rules** (`Start` is disabled, with the reason shown inline):

- At least 1 pack wolf or a Serial Killer.
- Killers below half of the players.
- Special roles can't outnumber the players.
- Apprentice Seer, Sorcerer and Lycan need a Seer.
- Alpha Werewolf and Wolf Cub need at least 2 pack wolves in total; Lone Wolf needs at least 3.
- Only one each of Seer, Apprentice Seer, Doctor, Witch, Hunter, Cupid, Mayor, Tanner, Serial Killer, Sorcerer and Alpha.

**Soft warnings** (the setup can still start):

- The score is outside −5 to +5 ("This setup strongly favors the village/wolves").
- Pack wolves make up ⅓ or more of the players.
- Cupid or Tanner with fewer than 7 players.
- A Serial Killer with fewer than 9 players.
- No plain Villagers from 7 players.
- More than 3 information roles (Seer, Apprentice Seer, Sorcerer).

Players can **save a custom setup** with a name. Saved setups appear as cards for matching player counts.

---

## 6. House rules (settings, persisted)

| Rule                                          | Options                                 | Default                       |
| --------------------------------------------- | --------------------------------------- | ----------------------------- |
| Discussion timer                              | 60 / 120 / 180 s / untimed              | 120 s                         |
| Silent glance length                          | 8–15 s                                  | 10 s                          |
| Minimum turn time                             | 3–8 s                                   | 4.5 s                         |
| Role reveal on death                          | reveal / hardcore (silent)              | reveal                        |
| Doctor self-protect                           | never / night 1 only / always           | night 1 only                  |
| Detailed narration (reveals saves and causes) | on / off                                | off                           |
| Mayor                                         | off / assigned at setup / elected day 1 | off                           |
| Masking ambience volume                       | 0–100%                                  | 70%                           |
| Dead players may talk                         | yes / no                                | no (shown as a reminder only) |

---

## 7. Night resolution (authoritative)

```ts
interface NightActions {
  wolfVotes: Record<PlayerId, [PlayerId] | [PlayerId, PlayerId]>; // per living pack wolf
  doctorTarget?: PlayerId;
  witchHeal: boolean; // blind heal on the primary wolf victim
  witchPoison?: PlayerId;
  serialKillerTarget?: PlayerId;
  // Seer and Sorcerer results are computed live during the pass (pure helper) and also logged
}
interface NightReport {
  deaths: { playerId: PlayerId; cause: 'wolves' | 'serialKiller' | 'poison' | 'heartbreak' }[];
  saves: { playerId: PlayerId; by: 'doctor' | 'witch' | 'immune' }[];
  conversions: PlayerId[]; // Cursed turned into wolves
  witchHealConsumed: boolean;
  witchPoisonConsumed: boolean;
  pending: { hunterShot?: PlayerId; mayorHandoff?: PlayerId };
  nextNight: { wolfKills: 1 | 2; promotedApprentice?: PlayerId };
}

function resolveNight(
  state: GameState,
  actions: NightActions,
  rng: Rng,
): { state: GameState; report: NightReport };
```

Resolve in **exactly this order**:

1. **Wolf targets.** Use the living Alpha's pick if there is one. Otherwise take the plurality of the living pack wolves' votes; on a tie, choose randomly among the tied targets with `rng`. With 2 kills, resolve the second pick the same way, excluding the first target. If no wolf voted, there's no attack. Wolves can't target pack members.
2. **Protection set:** `P = { doctorTarget }`, if the Doctor is alive.
3. **Wolf attacks**, for each wolf target `t` (the primary target first):
   1. If `t ∈ P`, `t` is saved by the doctor.
   2. Otherwise, if `t` is the primary target and `witchHeal` is set, `t` is saved by the witch and the heal is consumed. **The heal isn't consumed if the Doctor already saved `t`.**
   3. Otherwise, if `t` is the Serial Killer, they're immune and nothing happens.
   4. Otherwise, if `t` is an unbitten Cursed, they **convert** to a pack werewolf (no death).
   5. Otherwise, `t` dies (cause `wolves`).
4. **Serial Killer:** if `s ∈ P`, `s` is saved by the doctor. Otherwise `s` dies (cause `serialKiller`), even if `s` is a wolf. The Witch's heal doesn't apply.
5. **Witch poison:** the target dies (cause `poison`), ignoring protection. The poison is consumed.
6. **Lovers:** for every lover who died, the partner dies (cause `heartbreak`). Repeat until nothing changes.
7. **Triggers:**
   - Wolf Cub died → `nextNight.wolfKills = 2`.
   - Seer died → promote the Apprentice Seer.
   - Hunter died → `pending.hunterShot`.
   - Mayor died → `pending.mayorHandoff`.
8. **De-duplicate deaths** (a player dies once; keep the first cause) and return the report.

Day-time deaths (execution, the Hunter's shot) go through the same `applyDeaths()` helper as steps 6–8, so lovers, the Wolf Cub, the Apprentice Seer, the Hunter and the Mayor behave identically by day and by night.

---

## 8. Win check (after every batch of deaths, in this order)

1. **Tanner executed by the day vote:** the Tanner wins alone and the game ends immediately.
2. **Everyone is dead:** draw.
3. **Cross-team lovers** are the only two players alive: the Lovers win.
4. The **Serial Killer** is alive and at most 2 players are alive: the Serial Killer wins.
5. **No Serial Killer alive** and living pack wolves ≥ living non-wolves: **the wolves win.** The Sorcerer wins with them. The Lone Wolf wins only if they're the sole living pack wolf; otherwise the Lone Wolf loses.
6. **No pack wolves alive and no Serial Killer alive:** the **Village wins.** Cross-team lovers lose unless step 3 applied.
7. Otherwise, the game continues.

Parity counts pack wolves only: Werewolf, Alpha, Wolf Cub, Lone Wolf, and the Cursed once converted. The Sorcerer and cross-team lovers count as non-wolves.

**Scoring with the Lamma scoreboard (`usesScores: true`):** each winner gets +1, and a solo winner (Tanner, Serial Killer, Lone Wolf, or the Lovers) gets +2. Losers go to the shared punishment flow (`usesPunishments: true`).

---

## 9. Design decisions (conflicts in the original notes, resolved)

- **D1, Cupid moves to the discovery pass.** In a single clockwise pass, a lover seated before Cupid would never find out they're linked on night 1. Picking during discovery means every lover sees their banner on the first night's pass.
- **D2, the Witch's heal is blind.** The original said the Witch "knows who the wolves targeted", but in one rotation the wolves may not have entered their pick yet when the Witch's turn comes. Showing the victim would be inconsistent and would depend on seating. The heal applies to "tonight's werewolf victim", whoever it is, and the Witch finds out in the morning.
- **D3, a single resolution order.** The original priority list and the Dart code disagreed about whether the Doctor blocks the Serial Killer and whether the heal was consumed when it wasn't needed. §7 is now the only source of truth.
- **D4, Lycan and Cursed are two separate roles.** The original merged them. The Lycan only _appears_ to be a wolf; the Cursed _turns into_ one when bitten.
- **D5, Insomniac removed.** It needs a role-swapping mechanic this edition doesn't have.
- **D6, the Lone Wolf** is defined so that it never conflicts with the wolves' parity win.
- **D7, presets were replaced by curated recommendations per player count** (§5.2), all scored with the same weights. The original Chaos preset (5 killers at 11 players) was too strong for wolves.
- **D8, the starting seat rotates each night** so position in the pass reveals nothing over time.

---

## 10. Audio and narration

- **Engine:** `expo-audio` (or `expo-av`) with **layered channels**: an ambience loop, a music loop, voice lines and stingers. Voice ducks the ambience by 40%.
- **Script:** every line is an i18n key with variants, chosen with `rng` so repeat games don't sound robotic:
  - `night.fall.1..3`
  - `wolves.wake`, `wolves.sleep`, `wolves.twice`
  - `pass.start`
  - `morning.death.single.1..3`, `morning.death.multi.1..2`, `morning.none.1..3`
  - `vote.countdown`
  - `execution.reveal.{team}`
  - `win.{outcome}`
  - Lines with names insert the player name using **device TTS (`expo-speech`)** between recorded clips. A full-TTS fallback is available behind a setting.
- **Voice packs** (data-driven):
  - _Tavern Keeper_ (en)
  - _Gothic Lord_ (en)
  - _Arabic Folk Narrator_ (ar). Recorded natively, not translated by machine.
  - **v1 can ship with full device TTS plus recorded ambience and stingers**; recorded voice packs come in a later update.
- **Host controls** (always visible on public screens): pause, replay the last line, skip, volume.
- **Licensing:** every audio and art asset must be original or commercially licensed. Track them in `docs/CREDITS.md` with the source and license.

---

## 11. Visual direction

Werewolf uses its own **"moonlit village"** sub-theme on top of the Lamma tokens:

- Secret screens: OLED black `#0A0710`, text `#8C86A0`, accent violet `#6B3FC6` at 60% opacity.
- Public screens (morning, day, vote): `night` `#1A1030` with brand gradient accents. **Team colors:** Village blue `#4F8FDB`, Wolves magenta-red `#D23C82`, Neutral orange `#EF7A3C`.
- **Role cards:** illustrated (commission the art; v1 placeholder = a large role glyph on a team-color gradient), wax-seal hold-to-reveal, and a flip animation (instant with reduced motion).
- The day timer is a big circular countdown that turns orange in the last 30 s.

---

## 12. State machine and structure

```
src/games/werewolf/
  index.ts                 # GameModule { id:'werewolf', minPlayers:4, maxPlayers:16, usesScores:true, usesPunishments:true }
  engine/
    roles.ts               # role registry
    setup.ts               # dealRoles(roster, preset|custom, rng), balance()
    night.ts               # resolveNight, wolf target selection
    day.ts                 # vote resolution, mayor tie-break
    deaths.ts              # applyDeaths (cascades, triggers)
    win.ts                 # checkWin
    reducer.ts             # gameReducer(state, event) — the only way state changes
    types.ts
  audio/                   # narrator, channels, voice packs
  screens/                 # Setup, Discovery, NightIntro, Glance, Pass(Handoff/Action), Morning, DeathEffects, Discussion, Vote, Execution, GameOver
  content/                 # presets, narration script keys
```

**Phases** form a discriminated union, and `gameReducer` is pure:

```ts
type Phase =
  | { t: 'setup' }
  | { t: 'discovery'; seat: number; revealed: boolean }
  | { t: 'nightIntro'; night: number }
  | { t: 'glance'; endsAt: number }
  | { t: 'pass'; seat: number; step: 'handoff' | 'action'; startedAt: number }
  | { t: 'morning'; report: NightReport }
  | { t: 'deathEffects'; queue: Effect[] }
  | { t: 'mayorElection' }
  | { t: 'discussion'; endsAt: number | null; paused: boolean }
  | { t: 'vote' }
  | { t: 'mayorTieBreak'; tied: PlayerId[] }
  | { t: 'execution'; playerId: PlayerId | null }
  | { t: 'gameOver'; result: WinResult };
```

The full `GameState` is persisted after every event. On resume, a secret phase maps back to its handoff step (§4).

---

## 13. Tests (all required before any UI work is accepted)

- **Setup:** every curated row in §5.2 sums to its player count, passes the hard rules and has the score shown; Basic exists for every count from 4 to 16; preselection logic (§5.4); Surprise me always returns a valid setup scoring −2 to +2 (seeded); every Custom hard rule and soft warning; deals are deterministic with a seeded RNG.
- **Wolf target selection:** Alpha override; plurality; random tie-break (seeded); a two-kill night; no-vote night; pack members can't be targeted.
- **Resolution (§7):** one test per step, including:
  - Doctor + heal on the same target (heal not consumed).
  - Heal when the Doctor protected someone else (heal consumed).
  - Wolves attack the Serial Killer (immune).
  - The Serial Killer targets a protected player (saved).
  - Poison on a protected player (dies).
  - Cursed bitten (converts, joins the pack next night).
  - A lover dies to poison (partner dies of heartbreak).
  - A Hunter lover chain.
  - Wolf Cub killed at night and by day (next night has 2 kills).
  - Seer dies (apprentice promoted next night).
  - The Mayor dies (handoff queued).
- **Win check (§8):** every rule plus ordering conflicts, such as:
  - The Tanner executed while wolves reach parity in the same event (the Tanner wins).
  - The Serial Killer alive with wolves at parity (no wolf win).
  - Cross-team lovers as the last two players.
  - Lone Wolf wins vs loses.
  - Everyone dead (draw).
- **Day vote:** a tie with and without a Mayor; "No execution"; a Mayor tie-break where the Mayor spares everyone.
- **Anti-cheat:** `Confirm` is impossible before the minimum time (fake timers); dead seats still get turns; the start seat rotates each night; resuming never lands on a secret step.
- **E2E (Maestro):** a Beginner game with 5 players to a village win, and a Classic game with 8 players to a wolf win, both in en and ar.

---

## 14. Milestones (stop for review after each)

- **W1, engine:** types, roles (core set), setup and presets, `resolveNight`, `applyDeaths`, `checkWin`, reducer, plus all of §13's unit tests.
- **W2, roster upgrade in core:** up to 16 players and seating reorder (drag), without breaking Spy.
- **W3, flows:**
  - Setup, discovery pass and action pass, with the anti-cheat behavior from §4.
  - Morning, death effects, discussion, vote, execution and game over.
- **W4, audio:** the channel mixer, masking ambience, TTS narration with the script keys in en/ar, music and stingers, host controls.
- **W5, expansion roles:** Wolf Cub, Lone Wolf, Sorcerer, Apprentice Seer, Mayor, Lycan, Cursed, Serial Killer, all behind the existing engine hooks, with their tests.
- **W6, polish:** role art, card animations, the moonlit theme, accessibility (screen-reader labels on public screens only; secret screens must not announce roles out loud, so use haptics and visual cues there), and recorded voice packs when they're ready.
