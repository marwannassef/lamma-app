#!/usr/bin/env python3
"""Draws the Mafia theme art (docs/games/werewolf.md §15.3, "noir city"): the home tile, a role
card for every role, the TOP SECRET stamp and the city backdrop. Night-black and deep navy with
neon magenta and cyan from the brand palette. No guns or blood anywhere.

Usage: python3 scripts/generate-mafia-art.py   (needs `rsvg-convert`, e.g. `brew install librsvg`)
Writes assets/source/mafia/*.svg and PNGs under assets/images/. See docs/CREDITS.md.
"""
import os
import random
import subprocess

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'source', 'mafia')
ROLE_OUT = os.path.join(ROOT, 'assets', 'images', 'mafia-roles')
SCENE_OUT = os.path.join(ROOT, 'assets', 'images', 'mafia')
GAME_OUT = os.path.join(ROOT, 'assets', 'images', 'games')
PX = 384

INK = '#04060E'
CYAN = '#2FB8C9'
MAGENTA = '#D23C82'
ORANGE = '#EF7A3C'
GOLD = '#F3C64A'
NEON = {'village': CYAN, 'wolves': MAGENTA, 'neutral': ORANGE}
SKY = ('#03050C', '#0B1330', '#16224D')


def rim(color):
    return f'stroke="{color}" stroke-opacity=".7" stroke-width="4" stroke-linejoin="round"'


def rain(rnd, w=512, h=512, n=40, op=.18):
    lines = ''.join(
        f'<path d="M{x:.0f} {y:.0f} l-10 34"/>'
        for x, y in ((rnd.uniform(0, w + 40), rnd.uniform(-20, h)) for _ in range(n)))
    return f'<g stroke="#9FB7FF" stroke-width="1.6" stroke-linecap="round" opacity="{op}">{lines}</g>'


def skyline(rnd, base=440, w=512, fill='#070A18'):
    out, x = [], -10
    while x < w:
        bw, bh = rnd.randint(40, 80), rnd.randint(60, 170)
        out.append(f'<rect x="{x}" y="{base - bh}" width="{bw}" height="{512 - base + bh}"/>')
        for wy in range(base - bh + 14, base, 22):
            for wx in range(x + 8, x + bw - 10, 16):
                if rnd.random() < .22:
                    out.append(f'<rect x="{wx}" y="{wy}" width="7" height="10" fill="{GOLD}" opacity="{rnd.uniform(.25, .6):.2f}"/>')
        x += bw + rnd.randint(2, 10)
    return f'<g fill="{fill}">{"".join(out)}</g>'


# A head-and-shoulders silhouette centred on x=256 (head top ~150, shoulders to the bottom).
BUST = ('<path d="M256 168 C290 168 312 194 312 228 C312 256 298 278 282 290 L282 306'
        ' C332 318 368 344 382 384 L394 520 L118 520 L130 384 C144 344 180 318 230 306 L230 290'
        ' C214 278 200 256 200 228 C200 194 222 168 256 168 Z"/>')
FEDORA = ('<path d="M168 214 C196 200 316 200 344 214 C332 224 180 224 168 214 Z"/>'
          '<path d="M198 210 L206 156 C214 140 236 134 256 134 C276 134 298 140 306 156 L314 210 Z"/>')
CAP = ('<path d="M196 214 C196 176 222 156 256 156 C292 156 318 176 318 210 L344 222 C330 230 300 228 290 222 Z"/>')
COLLAR = '<path d="M230 306 L256 352 L282 306 L298 318 L256 392 L214 318 Z" fill="#0B1330"/>'


def tie(color):
    return f'<path d="M248 330 L264 330 L270 392 L256 410 L242 392 Z" fill="{color}"/>'


def figure(*parts, color):
    return f'<g fill="{INK}" {rim(color)}>{"".join(parts)}</g>'


def eyes(color, y=238):
    return (f'<g fill="{color}" opacity=".35"><circle cx="234" cy="{y}" r="12"/><circle cx="278" cy="{y}" r="12"/></g>'
            f'<g fill="{color}"><path d="M220 {y - 5} L246 {y + 1} L224 {y + 5} Z"/><path d="M292 {y - 5} L266 {y + 1} L288 {y + 5} Z"/></g>')


def glow(cx, cy, r, color, op=.55):
    return (f'<radialGradient id="g{cx}{cy}" cx="{cx}" cy="{cy}" r="{r}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{color}" stop-opacity="{op}"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#g{cx}{cy})"/>')


ROLES = {}


def role(rid, team):
    def wrap(fn):
        ROLES[rid] = (team, fn)
        return fn
    return wrap


@role('villager', 'village')
def villager(c):  # Citizen: flat cap, umbrella overhead
    return (figure(BUST, CAP, color=c) +
            f'<path d="M110 132 C150 70 362 70 402 132 Z" fill="{c}" opacity=".85"/>'
            f'<path d="M256 76 L256 60" stroke="{c}" stroke-width="6" stroke-linecap="round"/>'
            f'<path d="M256 132 L256 150" stroke="{c}" stroke-width="5"/>')


@role('werewolf', 'wolves')
def werewolf(c):  # Mafia: fedora, glowing eyes, neon tie
    return figure(BUST, FEDORA, color=c) + COLLAR + tie(c) + eyes(c)


@role('alpha', 'wolves')
def alpha(c):  # Mafia Boss: gold hat band, gold tie, a small crown
    return (figure(BUST, FEDORA, color=GOLD) + COLLAR + tie(GOLD) + eyes(c) +
            f'<path d="M200 204 L312 204 L310 194 L202 194 Z" fill="{GOLD}"/>'
            f'<path d="M216 112 L230 84 L246 104 L256 78 L266 104 L282 84 L296 112 Z" fill="{GOLD}"/>')


@role('wolfCub', 'wolves')
def wolf_cub(c):  # Rookie: newsboy cap, smaller frame
    return ('<g transform="translate(64 70) scale(.75)">' + figure(BUST, CAP, color=c) + COLLAR + tie(c) +
            eyes(c) + '</g>')


@role('loneWolf', 'wolves')
def lone_wolf(c):  # Rogue: fedora and a domino mask
    return (figure(BUST, FEDORA, color=c) + COLLAR +
            f'<path d="M206 226 C226 214 286 214 306 226 C302 248 272 250 256 240 C240 250 210 248 206 226 Z" fill="{c}"/>'
            f'<g fill="{INK}"><ellipse cx="234" cy="232" rx="10" ry="6"/><ellipse cx="278" cy="232" rx="10" ry="6"/></g>')


@role('sorcerer', 'wolves')
def sorcerer(c):  # Informant: turned-up collar, a whisper bubble
    return (figure(BUST, FEDORA, '<path d="M200 300 L180 250 L230 290 Z"/><path d="M312 300 L332 250 L282 290 Z"/>', color=c) +
            f'<path d="M330 120 C330 92 400 92 400 120 C400 146 370 150 352 148 L336 162 L340 144 C332 140 330 132 330 120 Z" fill="{c}"/>'
            f'<g fill="{INK}"><circle cx="350" cy="121" r="5"/><circle cx="365" cy="121" r="5"/><circle cx="380" cy="121" r="5"/></g>')


@role('seer', 'village')
def seer(c):  # Detective: fedora and a big magnifying glass
    return (figure(BUST, FEDORA, color=c) + COLLAR +
            f'<circle cx="356" cy="330" r="52" fill="{c}" fill-opacity=".18" stroke="{c}" stroke-width="12"/>'
            f'<path d="M392 368 L440 420" stroke="{c}" stroke-width="18" stroke-linecap="round"/>')


@role('apprenticeSeer', 'village')
def apprentice_seer(c):  # Junior Detective: cap, notebook and a small magnifier
    return (figure(BUST, CAP, color=c) +
            f'<rect x="126" y="338" width="70" height="90" rx="6" fill="{c}" opacity=".9"/>'
            f'<g stroke="{INK}" stroke-width="4"><path d="M138 362 h46"/><path d="M138 380 h46"/><path d="M138 398 h30"/></g>'
            f'<circle cx="366" cy="350" r="30" fill="{c}" fill-opacity=".18" stroke="{c}" stroke-width="9"/>'
            f'<path d="M388 372 L418 402" stroke="{c}" stroke-width="12" stroke-linecap="round"/>')


@role('doctor', 'village')
def doctor(c):  # Doctor: head mirror and stethoscope
    return (figure(BUST, color=c) +
            f'<circle cx="256" cy="190" r="18" fill="{c}"/><circle cx="256" cy="190" r="7" fill="{INK}"/>'
            f'<path d="M226 320 C226 380 286 380 286 320" fill="none" stroke="{c}" stroke-width="8"/>'
            f'<path d="M286 360 C320 380 330 410 316 430" fill="none" stroke="{c}" stroke-width="8"/>'
            f'<circle cx="314" cy="436" r="14" fill="{c}"/>')


@role('witch', 'village')
def witch(c):  # Chemist: goggles and two vials
    return (figure(BUST, color=c) +
            f'<g fill="none" stroke="{c}" stroke-width="7"><circle cx="234" cy="226" r="16"/><circle cx="278" cy="226" r="16"/><path d="M250 226 h12"/></g>'
            f'<path d="M120 330 h40 v20 l26 70 a14 14 0 0 1 -13 18 h-66 a14 14 0 0 1 -13 -18 l26 -70 Z" fill="#6DBE45" opacity=".9"/>'
            f'<path d="M352 330 h40 v20 l26 70 a14 14 0 0 1 -13 18 h-66 a14 14 0 0 1 -13 -18 l26 -70 Z" fill="{MAGENTA}" opacity=".9"/>')


@role('hunter', 'village')
def hunter(c):  # Avenger: fedora and a raised fist (no weapons)
    return (figure(BUST, FEDORA, color=c) + COLLAR +
            f'<g fill="{c}"><rect x="352" y="250" width="56" height="70" rx="16"/><rect x="360" y="316" width="40" height="90" rx="10"/>'
            f'<path d="M352 270 h-14 a10 10 0 0 0 0 26 h14 Z"/></g>'
            f'<g stroke="{INK}" stroke-width="4"><path d="M366 252 v40"/><path d="M380 252 v40"/><path d="M394 252 v40"/></g>')


@role('cupid', 'village')
def cupid(c):  # Matchmaker: two linked rings and a heart
    return (figure(BUST, color=c) +
            f'<g fill="none" stroke="{GOLD}" stroke-width="10"><circle cx="226" cy="120" r="34"/><circle cx="286" cy="120" r="34"/></g>'
            f'<path d="M256 420 C210 384 196 356 216 338 C232 324 250 334 256 346 C262 334 280 324 296 338 C316 356 302 384 256 420 Z" fill="{MAGENTA}"/>')


@role('mayor', 'village')
def mayor(c):  # Mayor: top hat, sash and a star badge
    return (figure(BUST, '<path d="M180 214 C200 204 312 204 332 214 C320 222 192 222 180 214 Z"/><rect x="212" y="120" width="88" height="94" rx="8"/>', color=c) +
            f'<path d="M180 330 L300 470 L330 450 L214 316 Z" fill="{GOLD}" opacity=".85"/>'
            f'<path d="M330 330 l12 26 28 3 -21 19 6 28 -25 -14 -25 14 6 -28 -21 -19 28 -3 Z" fill="{GOLD}"/>')


@role('lycan', 'village')
def lycan(c):  # Suspect: a police line-up wall and a question mark
    lines = ''.join(f'<path d="M40 {y} h432" />' for y in range(150, 500, 40))
    return (f'<g stroke="#9FB7FF" stroke-width="2" opacity=".25">{lines}</g>' + figure(BUST, CAP, color=c) +
            f'<text x="256" y="128" text-anchor="middle" font-family="Helvetica" font-weight="800" font-size="110" fill="{MAGENTA}">?</text>')


@role('cursed', 'village')
def cursed(c):  # Recruit: an envelope with a wax seal (the offer)
    return (figure(BUST, CAP, color=c) +
            f'<rect x="300" y="320" width="130" height="90" rx="8" fill="#E9DFC7"/>'
            f'<path d="M300 322 L365 372 L430 322" fill="none" stroke="#8A7A5A" stroke-width="5"/>'
            f'<circle cx="365" cy="372" r="16" fill="{MAGENTA}"/>')


@role('tanner', 'neutral')
def tanner(c):  # Jester: the jester's hat
    return (figure(BUST, '<path d="M196 214 C190 170 150 140 120 150 C150 160 170 186 180 214 Z"/>'
                   '<path d="M316 214 C322 170 362 140 392 150 C362 160 342 186 332 214 Z"/>'
                   '<path d="M210 214 C214 160 240 120 256 100 C272 120 298 160 302 214 Z"/>', color=c) +
            f'<g fill="{c}"><circle cx="118" cy="150" r="13"/><circle cx="394" cy="150" r="13"/><circle cx="256" cy="98" r="13"/></g>')


@role('serialKiller', 'neutral')
def serial_killer(c):  # Serial Killer / The Shadow: a faceless long-coat shadow and a calling card
    return (figure('<path d="M256 150 C296 150 318 180 318 220 L326 300 C360 320 384 360 392 420 L404 520'
                   ' L108 520 L120 420 C128 360 152 320 186 300 L194 220 C194 180 216 150 256 150 Z"/>', FEDORA, color=c) +
            eyes('#FFFFFF', 236) +
            f'<g transform="rotate(-14 380 350)"><rect x="340" y="300" width="80" height="110" rx="8" fill="#F4EBDD"/>'
            f'<text x="380" y="372" text-anchor="middle" font-family="Georgia" font-size="56" fill="{c}">♠</text></g>')


def tile(rid):
    team, fn = ROLES[rid]
    c = NEON[team]
    rnd = random.Random(rid)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{SKY[0]}"/><stop offset=".6" stop-color="{SKY[1]}"/><stop offset="1" stop-color="{SKY[2]}"/>
    </linearGradient>
    <clipPath id="tile"><rect width="512" height="512" rx="104"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="512" height="512" fill="url(#sky)"/>
    {glow(256, 250, 250, c, .35)}
    {skyline(rnd)}
    {rain(rnd)}
    {fn(c)}
  </g>
</svg>
"""


def game_tile():
    """The Mafia home tile: a fedora-and-trench figure from behind under a streetlight, neon sign, rain."""
    rnd = random.Random(7)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#03050C"/><stop offset=".55" stop-color="#0B1330"/><stop offset="1" stop-color="#1B2A5C"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE9B0" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9B0" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="tile"><rect width="512" height="512" rx="104"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="512" height="512" fill="url(#sky)"/>
    {skyline(rnd, base=400)}
    {glow(120, 150, 150, MAGENTA, .5)}
    <rect x="60" y="120" width="120" height="44" rx="10" fill="none" stroke="{MAGENTA}" stroke-width="7"/>
    <text x="120" y="152" text-anchor="middle" font-family="Helvetica" font-weight="800" font-size="28" fill="{MAGENTA}">JAZZ</text>
    <path d="M360 60 L360 470" stroke="#0A0F22" stroke-width="12"/>
    <path d="M360 64 C360 50 330 50 318 60" fill="none" stroke="#0A0F22" stroke-width="10"/>
    <path d="M300 66 L336 66 L384 470 L230 470 Z" fill="url(#beam)"/>
    <ellipse cx="318" cy="66" rx="20" ry="8" fill="#FFE9B0"/>
    <path d="M0 470 L512 470 L512 512 L0 512 Z" fill="#05070F"/>
    <ellipse cx="300" cy="474" rx="110" ry="10" fill="#FFE9B0" opacity=".18"/>
    <g fill="{INK}" stroke="{CYAN}" stroke-opacity=".6" stroke-width="4" stroke-linejoin="round">
      <path d="M262 470 L270 380 C252 370 244 330 248 290 C252 252 264 238 286 232 L314 232 C336 238 348 252 352 290
        C356 330 348 370 330 380 L338 470 L310 470 L300 400 L292 470 Z"/>
      <circle cx="300" cy="212" r="26"/>
      <path d="M254 204 C268 196 332 196 346 204 C338 212 262 212 254 204 Z"/>
      <path d="M274 202 L280 172 C290 162 310 162 320 172 L326 202 Z"/>
    </g>
    {rain(rnd, n=60, op=.25)}
  </g>
</svg>
"""


def stamp():
    """The TOP SECRET stamp, pressed to reveal a role (replaces Werewolf's wax seal)."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360">
  <g transform="rotate(-12 180 180)">
    <rect x="30" y="110" width="300" height="140" rx="18" fill="none" stroke="{MAGENTA}" stroke-width="14"/>
    <rect x="46" y="126" width="268" height="108" rx="10" fill="none" stroke="{MAGENTA}" stroke-width="4" opacity=".7"/>
    <text x="180" y="174" text-anchor="middle" font-family="Courier New, Courier" font-weight="900" font-size="56" fill="{MAGENTA}">TOP</text>
    <text x="180" y="226" text-anchor="middle" font-family="Courier New, Courier" font-weight="900" font-size="56" fill="{MAGENTA}">SECRET</text>
  </g>
</svg>
"""


def city():
    """Backdrop for Mafia's public screens: rain on glass over a neon city at night."""
    rnd = random.Random(11)
    w, h = 1080, 2340
    base = h - 260
    blocks, x = [], -20
    while x < w:
        bw, bh = rnd.randint(110, 200), rnd.randint(260, 760)
        blocks.append(f'<rect x="{x}" y="{base - bh}" width="{bw}" height="{h - base + bh}"/>')
        for wy in range(base - bh + 30, base, 46):
            for wx in range(x + 18, x + bw - 24, 34):
                if rnd.random() < .18:
                    col = rnd.choice([GOLD, GOLD, CYAN, MAGENTA])
                    blocks.append(f'<rect x="{wx}" y="{wy}" width="14" height="22" fill="{col}" opacity="{rnd.uniform(.2, .55):.2f}"/>')
        x += bw + rnd.randint(4, 20)
    drops = ''.join(
        f'<ellipse cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h):.0f}" rx="{rnd.uniform(2, 5):.1f}" ry="{rnd.uniform(4, 9):.1f}"/>'
        for _ in range(160))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="{h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#03050C"/><stop offset=".55" stop-color="#0A1028"/><stop offset="1" stop-color="#141E45"/>
    </linearGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#sky)"/>
  {glow(860, 300, 420, MAGENTA, .28)}
  {glow(180, 1500, 520, CYAN, .18)}
  <g fill="#070A18">{''.join(blocks)}</g>
  {rain(rnd, w, h, n=220, op=.14)}
  <g fill="#BFD0FF" opacity=".10">{drops}</g>
</svg>
"""


def kebab(rid):
    return ''.join('-' + ch.lower() if ch.isupper() else ch for ch in rid)


def render(svg_text, name, out_dir, w, h):
    svg = os.path.join(SRC, name + '.svg')
    with open(svg, 'w') as f:
        f.write(svg_text)
    os.makedirs(out_dir, exist_ok=True)
    subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), svg, '-o', os.path.join(out_dir, name + '.png')], check=True)
    print('wrote', name)


if __name__ == '__main__':
    os.makedirs(SRC, exist_ok=True)
    for rid in ROLES:
        render(tile(rid), kebab(rid), ROLE_OUT, PX, PX)
    render(game_tile(), 'mafia', GAME_OUT, 432, 432)
    render(stamp(), 'stamp', SCENE_OUT, 360, 360)
    render(city(), 'city', SCENE_OUT, 1080, 2340)
