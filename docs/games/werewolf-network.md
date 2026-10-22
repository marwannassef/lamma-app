# Werewolf / Mafia: Network Mode (every player on their own phone)

> Extends `docs/games/werewolf.md`. Both themes (Werewolf and Mafia, §15) get network mode; nothing here is theme-specific. Pass-and-play stays the default and is unchanged.
> Engine rules from `werewolf.md` stay authoritative. Network mode changes **who sees what and where input happens**, never how the night resolves or who wins.

---

## 1. Decisions (agreed 2026-10-22)

| Question | Decision |
| --- | --- |
| Connection | **Local network, no internet needed.** One phone hosts; the others join over the same local network: venue Wi-Fi, or **one phone's hotspot** when there's no Wi-Fi (the hotspot doesn't need mobile data). |
| Host phone | **Narrates in the middle of the table** (voice, ambience, timers, the public day screens) **and belongs to one player**, who also uses it for their own secret turns. |
| Player phones | Private: their role card, their night action, and their own interactive effects (Hunter's shot, Mayor's badge or tie-break). |
| Premium | **The host's Premium covers the room.** Joining is always free. A free host gets the free-tier limits (§7). |

### 1.1 Why not phone-to-phone with no network at all

Router-free peer-to-peer exists (Apple Multipeer Connectivity, Google Nearby Connections), but:

- It **only connects iPhone↔iPhone or Android↔Android**; a mixed group can't play.
- On Android it needs **location, Bluetooth and nearby-devices permissions**, which is a poor fit for a Families-policy app.

A phone hotspot gives the same "no Wi-Fi, no internet" experience for mixed groups with no such permissions. Same-platform P2P stays a possible later add-on behind the same transport interface (§4).

---

## 2. Flow

```
HOST: Werewolf/Mafia setup → "Play on everyone's phone" → room open (code shown)
GUESTS: home → Werewolf/Mafia → "Join a game" → host found automatically (or type code) → enter name
LOBBY: host sees names arrive, drags them into seating order, picks the setup → Start
DISCOVERY: every phone shows its own hold-to-reveal card at the same time; host shows "Ready 5/8"
NIGHT: host narrates + glance as today → "Everyone, take your turn" → ALL phones show their action
       screen at once (host phone too, for its owner) → host waits for all → resolve
DAY: host narrates the dawn story; phones show the public result; Hunter/Mayor act on their own phone;
     discussion timer + pointing vote on the host as today → execution → night
GAME OVER: every phone shows the result and its owner's role; host offers "Play again" to the same room
```

### 2.1 What each screen shows

| Phase | Host phone (public, middle of the table) | Player phone (private) |
| --- | --- | --- |
| Lobby | Room code, joined players, seating, setup, Start | "Waiting for the host…", their name and seat |
| Discovery | "Look at your role. Ready 5/8" | Hold-to-reveal card, then `I've seen it` |
| Night intro, glance | Narration and ambience as today | Stealth dark screen: "Eyes closed 🌙" |
| Action turn | First: **its owner's** private action turn, behind a hold-to-reveal. Then the public "Waiting… 6/8" with **no names**. | Their action screen (same skeleton, min time, hold-to-confirm as §4 of werewolf.md), then "Done. Eyes closed." |
| Morning, day | Dawn story, discussion, vote, execution as today | The public outcome (who died, revealed roles if the house rule is on) and a "Your role" peek |
| Hunter / Mayor effect | "Waiting for {name}…" | The picker, on the Hunter's or Mayor's own phone |
| Game over | Result, scoreboard, Play again | Result and their own role |

The host player's turns on the host phone work like today's pass-and-play turn: hold to reveal, act, confirm, back to the public screen.

### 2.2 Anti-cheat (adds to werewolf.md §4)

- **Everyone acts at once, dead players and villagers included.** Every phone shows the same layout, minimum time and hold-to-confirm, so phones look identical from across the table.
- The host never shows **who** has finished, only a count. The count updates no faster than the minimum turn time.
- Guest phones get **only their own secrets**: their role, their action options and their results. The full game state never leaves the host (§3.2).
- The leak guards apply on every phone: stealth background, dimmed brightness, the app-switcher snapshot hidden, back blocked during secret phases, relaunch lands on a neutral screen.
- Wolves still find each other in the silent glance. Their action screens also label packmates, as today.

---

## 3. Architecture

### 3.1 Host-authoritative

- The **host runs the existing pure engine** (`gameReducer`) and is the only source of truth.
- Guests send **intents**: `seen`, `seatAction`, `hunterShoot`, `passBadge`, `mayorDecide`. The host validates them with the engine (`validAction` and the rest) and broadcasts new views.
- Guests never compute game logic, so a modified client can't change outcomes. It can only submit its own seat's choices.

### 3.2 Per-seat views (new pure functions, full test coverage)

`viewFor(state, seat): SeatView` returns only what that seat may know:

- the public game: phase kind, alive or dead players, revealed roles, the dawn story keys, timers;
- their own role, lover and pack;
- their pending action: kind, valid targets, limits such as the Doctor's last target or the Witch's potions;
- their private results: the Seer's and Sorcerer's answers.

`publicView(state)` is the host-screen subset. A test asserts **no view leaks another seat's role** for every phase and role combination.

### 3.3 Engine change: a parallel night

The pass phase today is sequential: one seat at a time in rotation. Night resolution already doesn't depend on order (the Witch's heal is blind, §9 D2), so network mode adds:

- phase `{ t: 'actions'; done: PlayerId[]; startedAt }`, entered instead of `pass` when `mode === 'network'`;
- event `{ t: 'seatAction'; seat; action }`, accepted once per seat, in any order, validated per seat;
- when every seat is done, the **same** `resolveNight` and `tellDawn` run.

Discovery gets the same treatment: phase `{ t: 'reveal'; seen: PlayerId[] }`.

`GameState.mode: 'pass' | 'network'` defaults to `'pass'`, so saved games and pass-and-play are untouched.

### 3.4 Protocol (JSON lines over TCP)

```
guest → host  hello { v, deviceId, name, lang }      (deviceId is random per install, used to rejoin)
host  → guest welcome { seat | null, roomName, theme, kids }
host  → guest view { rev, view: SeatView }           (after every change; rev increases)
guest → host  intent { rev, intent }                 (rejected if stale or invalid)
both          ping / pong every 2 s
```

- Every message carries a protocol version. A guest on an older app version gets "Update Lamma to join".
- Messages are short JSON, under 4 KB.

### 3.5 Disconnects and rejoining

- A guest who drops (screen lock, app switch, Wi-Fi blip) **rejoins automatically with the same deviceId** and gets their current view back. The host shows "{name} reconnecting…".
- If a seat is offline when its action is needed, the host waits. After 30 s it offers **"Play {name}'s turn on this phone"**, a pass-and-play fallback for that seat.
- If the **host** drops, guests show "Host lost, waiting…". The host's game is saved like today (MMKV), so reopening the app resumes the room and guests rejoin.

---

## 4. Transport

- An interface `Transport` with `host()`, `join()`, `send()` and `onMessage()`. There's an in-memory **FakeTransport** for tests, and a **TCP implementation** for devices.
- **Discovery:**
  - The host advertises a Bonjour/NSD service `_lamma._tcp`. Guests list the rooms nearby.
  - Fallback: a **room code**, the host's local IP and port encoded as 6 characters, which guests can type.
- **Native libraries:** `react-native-tcp-socket` and `react-native-zeroconf`, or a small local Expo module if either fails on RN 0.86 with the New Architecture. Either way it needs **new store builds**; an OTA update can't add native code.
- **Config** (`app.json` / config plugin only, never edit `ios/` or `android/`):
  - iOS: `NSLocalNetworkUsageDescription` (en and ar) and `NSBonjourServices: ["_lamma._tcp"]`;
  - Android: `ACCESS_WIFI_STATE` and `CHANGE_WIFI_MULTICAST_STATE`. **No location permission.**
- **Privacy:** traffic stays on the local network. Nothing goes to any server, so the store privacy labels and Data safety answers don't change.

---

## 5. UI entry points

- **Setup → Play tab:** a "📶 Play on everyone's phone" button next to Start. On first use it explains: "Everyone needs Lamma and the same Wi-Fi, or join this phone's hotspot."
- **Home and setup:** "Join a game" for guests. It lists nearby rooms and has a "Type a code" option.
- **Lobby (host):** room code in large type, joined players with drag-to-seat (reusing `ReorderList`), the setup summary, Start. Start is disabled with a visible reason (no unexplained disabled buttons) until the player count fits the setup.
- **Help sheet:** "Can't see the room?" covers same Wi-Fi, turning on hotspot, and allowing Local Network on iPhone (Settings → Lamma → Local Network).

---

## 6. Kids mode, language and content

- The **host's** content level applies to the room. In Kids mode, guests see the Kids role names and story variants.
- **Each phone uses its own language** for its private screens. A guest can read Arabic while the host narrates in English. The host sends **keys and parameters, not text**.

---

## 7. Premium

- The host's tier decides the room. A **free host gets the free-tier Werewolf limits** (up to 8 players, Basic setups) in network mode too. A Premium host unlocks everything for everyone.
- Guests never see a paywall for joining. Bought role cards count only on the host.

---

## 8. Tests (required before UI work is accepted)

- Engine: parallel night with any submission order gives results identical to the sequential pass; duplicate or invalid `seatAction`s are rejected; discovery `reveal` completes.
- Views: the no-leak property for every phase and role, plus snapshots of the key views.
- Host session over FakeTransport: a full game with 6–12 simulated guests; rejoin mid-night; a stale `rev` is rejected; the offline-seat fallback works.
- A protocol version mismatch gives a clear message.
- Device test: 2 iPhones and 1 Android on a hotspot, with no internet. The Maestro flows for pass-and-play stay green.

---

## 9. Milestones (stop for review after each)

| # | Scope | Native build needed? |
| --- | --- | --- |
| N1 | Engine: `mode`, parallel night, reveal phase, `viewFor`/`publicView`, intents; tests | No |
| N2 | Session layer: host and guest state machines, protocol, FakeTransport, rejoin; tests | No |
| N3 | Real transport: TCP + Bonjour/NSD, room code, app.json permissions; 2-device smoke test | **Yes** (dev build) |
| N4 | Screens: join, lobby, guest phone screens, host waiting and owner turns, help sheet; en + ar | Yes |
| N5 | Edge cases: offline seat fallback, host relaunch, Play again, Kids mode, free-tier caps | Yes |
| N6 | Store: new iOS and Android builds, TestFlight and Internal testing on mixed devices | Yes |

---

## 10. Open questions

1. **Voting on phones?** v1 keeps "point and the host taps" (§2.5 of werewolf.md). Secret phone voting could come later.
2. **Spy and Blend In** could reuse the same transport later. They're out of scope here.
