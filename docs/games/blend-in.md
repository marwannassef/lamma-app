# Blend In 🦎 — Game Spec (Game #3)

> Save as `docs/games/blend-in.md`. This is game #3 in **Lamma**. `docs/BRIEF.md` covers the stack, code rules, i18n, design system and privacy. This file describes **the game only**; Claude Code decides how to build it, reusing the shared pieces already built for Spy and Werewolf: player roster, pass-the-phone screens, hold-to-reveal card, narrator/audio, scoreboard, punishments and word packs.

---

## 1. The game in one paragraph

Everyone secretly learns the same **secret word** from a topic, except one player: the **Chameleon** (🦎), who only knows the topic. The phone then sits in the middle of the table showing a **grid of 16 possible words**, and each player in turn says **one word** as a clue. Innocents try to prove they know the word without giving it away; the Chameleon bluffs. Everyone then points at who they think the Chameleon is. If the Chameleon is caught, they still get one chance to **escape by guessing the secret word** from the grid.

**Name:** "Blend In" (in-app title, with 🦎 as the game icon). Avoid calling it "The Chameleon": that's the trademarked name of a commercial board game. The mechanic is fine to use; the name and branding aren't.

---

## 2. How it differs from Spy (game #1)

The two games share a premise (one player doesn't know the word), so the difference has to be obvious to players:

|                      | Spy                           | Blend In                                                                 |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| Talking              | Free questions back and forth | **Exactly one word each**, in order                                      |
| Round length         | 5–10 min                      | **2–4 min**                                                              |
| The odd one out sees | The category                  | The topic **and the 16-word grid** (knows the candidates, not which one) |
| Escape guess         | Out loud, judged by the group | **Taps the word on the grid** (judged by the app)                        |
| Phone during play    | Away after the pass           | **Center of the table**, showing the grid and driving the turns          |

Both games use the **same scoring** (§7), so the shared scoreboard feels consistent.

---

## 3. Players and setup

- **Players:** 3–12. Recommended 4–8 (the setup screen shows a hint outside that range).
- **Setup options:**

| Option                       | Choices                                                | Default           |
| ---------------------------- | ------------------------------------------------------ | ----------------- |
| Mode                         | Classic (Chameleon knows nothing) / Undercover (§8)    | Classic           |
| Topic                        | A specific topic / 🎲 Random (no topic twice in a row) | Random            |
| Game length                  | 3 / 5 / 8 rounds, or first to 10 points                | 5 rounds          |
| Clue rounds before voting    | 1 / 2                                                  | 1                 |
| Clue timer per player        | Off / 10 s / 15 s / 20 s                               | 15 s              |
| Escape difficulty            | Easy: 4 choices / Normal: 8 / Hard: all 16             | Normal            |
| Chameleon never speaks first | On / Off                                               | On                |
| Punishments for losers       | Same levels as Spy                                     | Same as last used |

---

## 4. Round flow

### Step 1: Secret peek pass (about 30 s)

The phone goes around the table once, exactly like Spy's pass: "Pass the phone to {name}" → hold to reveal → release to hide → next player.

- **Innocent card:** topic, **the secret word** (big), and the same word highlighted on a small preview of the grid. Instruction: "Give a one-word clue that proves you know the word, without making it easy for the Chameleon."
- **Chameleon card:** topic, "🦎 You're the Chameleon!", and: "Listen to the clues, give a believable one-word clue, and work out the secret word."
- Both cards take the same hold time and look structurally alike (same layout, same size), so nobody can tell from across the table.

### Step 2: The clue circle (phone in the center)

- The screen shows the **topic and the 4×4 word grid** for everyone. The secret word is **not** highlighted here.
- The narrator announces: "The topic is {topic}. {name}, you start. One word."
- The **starting player rotates** each round. If "Chameleon never speaks first" is on, the starter is never the Chameleon (going first with no clues to hear is nearly impossible).
- Turns go clockwise. The screen shows whose turn it is, a timer ring (if on) and the order of the remaining players. The host taps **Next** after each clue (or it advances when the timer ends).
- If **2 clue rounds** are set, the circle repeats once before voting.

**Clue rules** (shown on a "How to play" sheet and as a one-line reminder on the clue screen):

- One word only. No gestures, no sound effects.
- You can't say the secret word, part of it, or a translation of it.
- You can't repeat a clue someone already said.
- If someone breaks a rule, the host taps **"Rule broken"**: the round ends and the Chameleon scores as if they escaped (+1, §7).

### Step 3: Point

- Optional 30–60 s free discussion ("Who seemed off?"). Skippable.
- The narrator counts "3… 2… 1… Point!". Everyone points at one player.
- The host taps the most-pointed player.
- **Tie:** the tied players each defend themselves in one sentence, then one more point among only them. Still tied → the Chameleon escapes (counts as not caught).

### Step 4: The outcome

- **Wrong person accused:** the screen reveals the Chameleon ("It was {name} all along! 🦎") and the secret word. The Chameleon wins the round.
- **Chameleon accused:** the screen turns red: "You caught the Chameleon! But can they escape?" The phone goes to the Chameleon, who sees the **escape choices** (§6) and taps one word.
  - Correct: "{name} blended in and escaped!" The Chameleon wins.
  - Wrong: "The town wins!" The secret word is revealed.
- Then: points (§7), the scoreboard with this round's gains, punishments for losers if on, and **Next round**.

---

## 5. The word grid

- Each topic card has **exactly 16 words** from one topic, all of a similar kind (e.g. 16 fast-food chains, 16 animals), so the grid gives nothing away by itself.
- Grids come from the word packs. A pack with more than 16 words produces a **fresh random set of 16** each round; the secret word is picked from those 16.
- No word is the secret word twice per topic until the topic's words have all been used (same rule as Spy).
- On a phone, a 4×4 grid must fit without scrolling. Long words wrap to two lines and shrink; they must never be cut off.

---

## 6. The escape guess

The Chameleon picks from the grid:

- **Easy:** 4 choices — the secret word plus 3 others from the grid.
- **Normal:** 8 choices from the grid, including the secret word.
- **Hard:** all 16.

The choices appear in a random order (the secret word must not always be in the same position). One tap, then a short dramatic pause before the result.

---

## 7. Scoring (same as Spy)

| Outcome                      | Points                       |
| ---------------------------- | ---------------------------- |
| Chameleon not caught         | Chameleon **+2**             |
| Caught, but guessed the word | Chameleon **+1**             |
| Caught and guessed wrong     | **every other player +1**    |
| A rule was broken            | Chameleon **+1**, round ends |

The original design gave the Chameleon +2 for escaping too. Escaping after being caught is worth less here than never being caught, matching Spy, so a clever bluff is still the best play.

**Game end:** after the chosen number of rounds, or when someone reaches 10 points. The winner screen shows the final scoreboard. Ties share the win.

**Losers** (for punishments) are the players who gained 0 points this round, exactly as in Spy.

---

## 8. Undercover mode (second mode)

A twist that makes the game feel fresh after a few rounds:

- The odd one out gets a **different but close word** (e.g. everyone has _McDonald's_; the Undercover gets _Burger King_). They **don't know they're the odd one out**: their card looks exactly like everyone else's.
- No grid is shown in this mode (it would reveal the pair). The clue circle works the same way.
- Outcomes:
  - Undercover not caught: Undercover **+2**.
  - Undercover caught: **every other player +1**. There's no escape guess, since they never knew.
- Content needs **word pairs**: two words in the same topic that are close enough to cause confusion (tea/coffee, cat/dog, Messi/Ronaldo-style pairs without real people for kids packs). Pairs live inside the topic packs.

---

## 9. Content

- Reuse Spy's pack system (regions, languages, content levels, free/premium tier) with two additions per topic:
  - Words that work well in a grid of 16 (at least 16 per topic; 20+ preferred so grids vary).
  - **Pairs** for Undercover mode (at least 8 per topic).
- Launch with at least 12 topics per region, family-safe by default. Examples:
  - Global: Animals, Food, Jobs, Sports, Fruits, School, Transport, Instruments, Weather, Clothes, Places in a city, Superpowers.
  - Egypt: Egyptian food, Places in Egypt, Ramadan & Eid, Beach & summer, Things at home, Street life (tok tok, kiosk, microbus…).
- **No real living people** in family packs (avoids disputes and keeps it kid-safe). Fictional characters are fine only if generic (pirate, ghost, robot), never branded.
- Every word shows with the same EN / Franco / AR display rules as Spy packs.

---

## 10. Audio and narration

Reuse the narrator from Werewolf with a lighter tone:

- Background: a relaxed lounge loop during the clue circle; a ticking clock that speeds up during the countdown.
- Lines (each with 2–3 variants so repeat rounds don't sound robotic):
  - Round start: "The topic is {topic}. {name}, you start. One word."
  - Turn change (optional, can be off): "{name}."
  - Countdown: "3… 2… 1… Point at the Chameleon!"
  - Caught: "Caught! But can the Chameleon escape?"
  - Escaped / town wins / wrong person: one line each.
- Sound effects: a soft chime per turn, a "camouflage" swoosh when the Chameleon is revealed.
- Everything can be muted; host controls (pause, replay, skip) are always reachable.

---

## 11. Visual direction

- Theme accent: **leaf green `#6DBE45`** from the brand palette (the chameleon), with the standard Lamma tokens.
- Chameleon card: green-to-violet gradient with a subtle scale texture.
- Clue circle screen: the grid fills the top two-thirds; the current speaker's name is large at the bottom with the timer ring around it, so people across the table can read it.
- Reveal moments (wrong person / caught / escaped) get one short animation each; instant with reduced motion.

---

## 12. Edge cases and decisions

- **Decoy clue (from the original notes):** dropped. The grid already gives the Chameleon a fair chance, and the notes never defined what the decoy was.
- **3 players:** allowed but hard for the Chameleon; show the hint "Best with 4–8".
- **Host is the Chameleon:** fine; the host taps on behalf of the table, and the escape screen still goes to the Chameleon.
- **Accidental tap on the wrong accused player:** the accuse screen has a 3-second **Undo** before anything is revealed.
- **App closed mid-round:** resume at the last public screen (clue circle or vote). Never resume on a secret card.
- **Same Chameleon too often:** the random pick avoids making the same player Chameleon two rounds in a row (when there are 4+ players).

---

## 13. What "done" looks like

- A 5-player Classic game of 5 rounds plays start to finish with correct points every round, including one round of each outcome: wrong person, caught + escaped, caught + failed, rule broken.
- An Undercover round: the Undercover's card is indistinguishable from others; both outcomes score correctly.
- The starter rotates; the Chameleon never starts when that setting is on; the same player is never Chameleon twice in a row.
- Escape choices always contain the secret word and appear in random order at every difficulty.
- Grids never repeat a word inside the same grid; secret words don't repeat in a topic until it's exhausted.
- Tie flow works (revote, then Chameleon escapes on a second tie).
- Scores and punishments use the shared Lamma scoreboard and punishment flow.
- Everything works in English and Arabic (RTL), including the grid.
