# Credits

Every audio and art asset in Lamma must be original or commercially licensed (werewolf.md §10).

## Audio

All sounds in `assets/audio/` are **original**, synthesized from scratch by
[`scripts/generate-sounds.py`](../scripts/generate-sounds.py) (pure Python, fixed seed). There are no
samples or third-party recordings. License: same as this repository.

| File | Used for |
| --- | --- |
| `night-ambience.m4a` | Werewolf night loop (wind, rain, low drone); masks the action pass |
| `heartbeat.m4a` | Werewolf wolves' glance |
| `tavern.m4a` | Werewolf discussion music (speeds up in the last 30 s) |
| `lounge.m4a` | Blend In clue circle |
| `night-fall.m4a` | Werewolf "night falls" stinger |
| `dawn-sting.m4a` | Werewolf morning with a death (a low thump and a minor chord, no bells) |
| `reveal-wolves.m4a`, `reveal-village.m4a` | Werewolf role reveal on banishment and game over |
| `fanfare.m4a` | Win screens |
| `chime.m4a` | Blend In turn change |
| `tick.m4a`, `countdown.m4a` | Countdowns |
| `swoosh.m4a` | Blend In Chameleon reveal |
| `city-ambience.m4a` | Mafia night loop (rain on glass, traffic hum, a far siren); masks the action pass |
| `noir-jazz.m4a` | Mafia discussion music |
| `siren.m4a`, `jail-clang.m4a`, `camera-flash.m4a` | Mafia stingers: a deadly dawn, an arrest, a reveal |
| `soft-knock.m4a` | Kids mode: replaces the harsh Mafia stingers |

To regenerate (macOS, needs `afconvert`):

```bash
python3 scripts/generate-sounds.py
```

## Narration

The narrator uses the device's text-to-speech voice (`expo-speech`). Recorded voice packs will be
listed here when they ship.

## Werewolf role art

All 17 role icons in `assets/images/roles/` are **original** vector art, drawn in code by
[`scripts/generate-role-art.py`](../scripts/generate-role-art.py) in the style of the Werewolf game
logo (a moonlit sky tinted by team, with a dark silhouette). The SVG sources are in
`assets/source/roles/`. The same script draws the wax seal and the moonlit-village backdrop in
`assets/images/werewolf/`. License: same as this repository.

To regenerate (needs `rsvg-convert`, e.g. `brew install librsvg`):

```bash
python3 scripts/generate-role-art.py
```

## Mafia theme art

The Mafia home tile (`assets/images/games/mafia.png`), the role portraits in
`assets/images/mafia-roles/`, the TOP SECRET stamp and the city backdrop (`assets/images/mafia/`) are
**original**, drawn as SVG by [`scripts/generate-mafia-art.py`](../scripts/generate-mafia-art.py)
(sources in `assets/source/mafia/`). Noir city style with neon brand colours; no guns or blood
(werewolf.md §15.3). License: same as this repository.
