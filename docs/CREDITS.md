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
| `death-bell.m4a` | Werewolf morning with a death |
| `reveal-wolves.m4a`, `reveal-village.m4a` | Werewolf role reveal on banishment and game over |
| `fanfare.m4a` | Win screens |
| `chime.m4a` | Blend In turn change |
| `tick.m4a`, `countdown.m4a` | Countdowns |
| `swoosh.m4a` | Blend In Chameleon reveal |

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
