#!/usr/bin/env python3
"""Draws the Werewolf role icons in the same style as the game logo (assets/source/games/werewolf.svg):
a rounded night-sky tile tinted by team, a glowing moon, and a dark silhouette with a moonlit rim.

Usage: python3 scripts/generate-role-art.py   (needs `rsvg-convert`, e.g. `brew install librsvg`)
Writes assets/source/roles/*.svg and assets/images/roles/*.png. See docs/CREDITS.md.
"""
import os
import subprocess

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'source', 'roles')
OUT = os.path.join(ROOT, 'assets', 'images', 'roles')
PX = 384

INK = '#090415'
RIM = 'stroke="#FFE7A8" stroke-opacity=".45" stroke-width="3" stroke-linejoin="round"'
GOLD = '#F3C64A'

SKY = {
    'village': ('#08122B', '#1A3470', '#2C58A8'),
    'wolves': ('#0B0620', '#2A1259', '#4B1E80'),
    'neutral': ('#160A05', '#4E200E', '#8C3A12'),
}
MOON = {
    'cream': ('#FFFBEA', '#F3D58E'),
    'blood': ('#FFE1D6', '#E0645A'),
}

# The howling wolf from the game logo.
HOWL = """<path d="M150 404 C118 412 92 404 78 386 L92 388 L84 378 L100 382 C112 384 122 384 130 382
  C120 356 130 326 150 310 C166 296 178 282 186 264 L180 254 L192 250 L186 238 L198 236 L194 224 L206 224
  C208 210 210 200 216 192 L206 160 L230 182 L234 156 L248 180 C256 176 262 170 268 162 L294 136
  C302 128 314 134 310 144 L292 162 L306 164 L300 172 L282 186 L276 188 L284 190 L272 194 L280 202
  L268 206 L274 214 L264 218 C268 242 272 266 270 292 C268 322 264 352 266 380 C268 394 276 400 284 408
  L250 410 C248 390 246 368 244 352 C236 366 228 386 232 408 Z"/>"""

# A wolf's head, facing us, centred on x=256.
WOLF_HEAD = """<path d="M256 420 L222 386 L184 336 L168 276 L170 196 L176 132 L222 196 L256 188 L290 196
  L336 132 L342 196 L344 276 L328 336 L290 386 Z"/>"""

BUST = """<path d="M256 150 C292 150 316 178 316 216 C316 248 300 272 282 284 L282 300
  C334 312 372 340 386 380 L398 470 L114 470 L126 380 C140 340 178 312 230 300 L230 284
  C212 272 196 248 196 216 C196 178 220 150 256 150 Z"/>"""


def eyes(color, y=262, glow=True):
    halo = f'<g fill="{color}" opacity=".35"><circle cx="226" cy="{y}" r="16"/><circle cx="286" cy="{y}" r="16"/></g>' if glow else ''
    return (halo + f'<g fill="{color}"><path d="M206 {y - 8} L244 {y + 2} L212 {y + 8} Z"/>'
            f'<path d="M306 {y - 8} L268 {y + 2} L300 {y + 8} Z"/></g>')


def hill(fill=INK):
    return f'<path d="M0 512 L0 440 C90 418 170 410 256 414 C350 418 430 404 512 388 L512 512 Z" fill="{fill}"/>'


def silhouette(body):
    return f'<g fill="{INK}" {RIM}>{body}</g>'


ROLES = {}


def role(rid, team, moon='cream', moon_xy=(256, 216), moon_r=150, crescent=False):
    def wrap(fn):
        ROLES[rid] = (team, moon, moon_xy, moon_r, crescent, fn)
        return fn
    return wrap


@role('villager', 'village')
def villager():
    return hill() + silhouette(
        # farmer in a straw hat with a pitchfork
        '<path d="M172 470 L176 360 C178 318 200 296 236 292 C272 296 292 318 296 360 L300 470 Z"/>'
        '<circle cx="236" cy="246" r="40"/>'
        '<path d="M160 214 C190 200 282 200 312 214 C300 222 172 222 160 214 Z"/>'
        '<path d="M202 210 C204 176 218 164 236 164 C254 164 268 176 270 210 Z"/>'
        '<path d="M282 330 L338 300 L346 314 L292 346 Z"/>'
        '<rect x="336" y="150" width="14" height="320" rx="4"/>'
        '<path d="M306 160 L306 92 L316 92 L316 148 L337 148 L337 80 L349 80 L349 148 L370 148 L370 92 L380 92 L380 160 Z"/>'
    )


@role('werewolf', 'wolves', moon_xy=(300, 200), moon_r=130)
def werewolf():
    return hill() + silhouette(HOWL)


@role('alpha', 'wolves')
def alpha():
    return hill() + silhouette(WOLF_HEAD) + eyes(GOLD) + (
        f'<path d="M196 150 L204 92 L230 122 L256 78 L282 122 L308 92 L316 150 Z" fill="{GOLD}" '
        'stroke="#7A4A08" stroke-width="4" stroke-linejoin="round"/>'
        '<g fill="#B3123E"><circle cx="256" cy="128" r="8"/></g>'
    )


@role('wolfCub', 'wolves', moon_r=130)
def wolf_cub():
    cub = f'<g transform="translate(250 410) scale(.78) translate(-180 -408)">{HOWL}</g>'
    paws = ''.join(
        f'<g transform="translate({x} {y}) rotate({r})" fill="{GOLD}" opacity=".9">'
        '<ellipse cx="0" cy="8" rx="13" ry="11"/><circle cx="-14" cy="-8" r="5"/><circle cx="-5" cy="-15" r="5"/>'
        '<circle cx="5" cy="-15" r="5"/><circle cx="14" cy="-8" r="5"/></g>'
        for x, y, r in ((120, 470, -20), (170, 436, 10), (360, 452, 20), (406, 418, -10)))
    return hill() + silhouette(cub) + paws


@role('loneWolf', 'wolves', moon_xy=(330, 170), moon_r=110, crescent=True)
def lone_wolf():
    rock = f'<path d="M40 512 L70 420 L150 398 L250 404 L300 430 L330 512 Z" fill="{INK}"/>'
    stars = '<g fill="#fff"><circle cx="420" cy="320" r="3"/><circle cx="380" cy="380" r="2"/></g>'
    return stars + rock + silhouette(f'<g transform="translate(-20 -8)">{HOWL}</g>')


@role('sorcerer', 'wolves', moon_r=140)
def sorcerer():
    return hill() + silhouette(
        '<path d="M150 470 L196 300 C210 270 236 262 256 262 C276 262 302 270 316 300 L346 470 Z"/>'
        '<path d="M186 258 C210 248 302 248 326 258 C312 270 200 270 186 258 Z"/>'
        '<path d="M206 252 L250 92 L320 150 L276 140 L304 252 Z"/>'
        '<rect x="356" y="190" width="12" height="280" rx="4"/>'
        '<path d="M316 352 L360 320 L366 334 L326 366 Z"/>'
    ) + (
        '<circle cx="362" cy="176" r="34" fill="#B07CFF" opacity=".35"/>'
        '<circle cx="362" cy="176" r="20" fill="#E9D8FF"/>'
        f'<g fill="{GOLD}"><circle cx="240" cy="296" r="6"/><circle cx="272" cy="296" r="6"/></g>'
    )


@role('seer', 'village', moon_r=140)
def seer():
    return (
        '<defs><radialGradient id="ball" cx=".38" cy=".32" r=".75">'
        '<stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#C9B6FF"/>'
        '<stop offset="1" stop-color="#4B2A9E"/></radialGradient></defs>'
        + hill()
        + silhouette('<path d="M176 470 L198 400 L314 400 L336 470 Z"/><rect x="186" y="378" width="140" height="26" rx="10"/>')
        + '<circle cx="256" cy="282" r="104" fill="url(#ball)" stroke="#FFE7A8" stroke-opacity=".6" stroke-width="4"/>'
        + f'<path d="M196 284 C222 250 290 250 316 284 C290 318 222 318 196 284 Z" fill="{INK}" opacity=".85"/>'
        + f'<circle cx="256" cy="284" r="20" fill="{GOLD}"/><circle cx="256" cy="284" r="9" fill="{INK}"/>'
    )


@role('apprenticeSeer', 'village', moon_r=140)
def apprentice_seer():
    return (
        '<defs><radialGradient id="ball" cx=".38" cy=".32" r=".75">'
        '<stop offset="0" stop-color="#FFFFFF"/><stop offset=".4" stop-color="#C9B6FF"/>'
        '<stop offset="1" stop-color="#4B2A9E"/></radialGradient></defs>'
        + hill()
        + '<circle cx="256" cy="190" r="56" fill="url(#ball)" stroke="#FFE7A8" stroke-opacity=".6" stroke-width="3"/>'
        + silhouette(
            # an open book
            '<path d="M256 330 C220 300 170 292 110 300 L110 430 C170 422 220 430 256 456 Z"/>'
            '<path d="M256 330 C292 300 342 292 402 300 L402 430 C342 422 292 430 256 456 Z"/>'
        )
        + '<g stroke="#FFE7A8" stroke-opacity=".5" stroke-width="4" stroke-linecap="round">'
        '<path d="M140 336 C180 330 214 336 238 352"/><path d="M140 370 C180 364 214 370 238 386"/>'
        '<path d="M372 336 C332 330 298 336 274 352"/><path d="M372 370 C332 364 298 370 274 386"/></g>'
    )


@role('doctor', 'village')
def doctor():
    # the plague doctor
    return hill() + silhouette(
        '<path d="M150 470 L178 336 C196 306 222 296 248 296 C274 296 300 306 318 336 L346 470 Z"/>'
        '<circle cx="236" cy="252" r="56"/>'
        '<path d="M280 236 C340 244 380 282 404 344 C356 316 318 302 282 290 Z"/>'
        '<path d="M140 200 C170 186 302 186 332 200 C318 210 154 210 140 200 Z"/>'
        '<path d="M184 198 L190 128 C214 116 258 116 282 128 L288 198 Z"/>'
    ) + (
        f'<circle cx="262" cy="244" r="15" fill="{GOLD}"/><circle cx="262" cy="244" r="6" fill="{INK}"/>'
        f'<path d="M238 380 h20 v-20 h20 v20 h20 v20 h-20 v20 h-20 v-20 h-20 Z" fill="{GOLD}"/>'
    )


@role('witch', 'village')
def witch():
    return hill() + silhouette(
        # pointed hat with a bent tip
        '<path d="M110 300 C170 280 342 280 402 300 C372 318 140 318 110 300 Z"/>'
        '<path d="M176 294 L232 140 C238 112 262 88 296 92 C280 104 270 120 274 146 L336 294 Z"/>'
        # cauldron
        '<path d="M150 360 L362 360 C366 420 330 462 256 462 C182 462 146 420 150 360 Z"/>'
        '<rect x="138" y="346" width="236" height="22" rx="10"/>'
    ) + (
        f'<rect x="196" y="262" width="120" height="20" rx="4" fill="{GOLD}"/>'
        f'<rect x="242" y="258" width="28" height="28" rx="4" fill="none" stroke="{INK}" stroke-width="6"/>'
        '<g fill="#7CFFB0"><circle cx="220" cy="336" r="14"/><circle cx="258" cy="326" r="18"/>'
        '<circle cx="296" cy="338" r="12"/><circle cx="276" cy="300" r="8" opacity=".8"/></g>'
    )


@role('hunter', 'village')
def hunter():
    return hill() + (
        f'<g fill="none" stroke="{INK}" stroke-linecap="round">'
        '<path d="M180 104 C330 160 330 380 180 436" stroke-width="22"/>'
        '<path d="M180 104 L180 436" stroke-width="5"/></g>'
        '<g fill="none" stroke="#FFE7A8" stroke-opacity=".45" stroke-width="3">'
        '<path d="M180 104 C330 160 330 380 180 436"/></g>'
        f'<path d="M150 270 L384 270" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>'
        f'<path d="M384 254 L424 270 L384 286 Z" fill="{GOLD}"/>'
        f'<path d="M150 270 L118 250 L132 270 L118 290 Z" fill="{GOLD}"/>'
    )


@role('cupid', 'village', moon_r=140)
def cupid():
    heart = ('<path d="M256 432 C196 384 132 334 132 262 C132 218 164 188 202 188 C228 188 246 202 256 222 '
             'C266 202 284 188 310 188 C348 188 380 218 380 262 C380 334 316 384 256 432 Z"/>')
    return hill() + (
        f'<path d="M100 400 L318 232" stroke="{GOLD}" stroke-width="10" stroke-linecap="round"/>'
        f'<path d="M100 400 L84 384 L104 386 Z M100 400 L86 418 L104 408 Z" fill="{GOLD}"/>'
    ) + silhouette(heart) + (
        '<path d="M224 240 C204 240 188 256 188 276" fill="none" stroke="#FF6FB5" stroke-width="10" stroke-linecap="round"/>'
        f'<path d="M318 232 L412 160" stroke="{GOLD}" stroke-width="10" stroke-linecap="round"/>'
        f'<path d="M412 160 L394 162 L420 136 L418 174 Z" fill="{GOLD}"/>'
    )


@role('mayor', 'village')
def mayor():
    return hill() + silhouette(
        '<path d="M120 236 C160 222 352 222 392 236 C378 252 134 252 120 236 Z"/>'
        '<path d="M176 236 L184 102 C220 92 292 92 328 102 L336 236 Z"/>'
    ) + (
        f'<rect x="182" y="196" width="148" height="24" fill="{GOLD}"/>'
        '<path d="M222 270 L256 330 L290 270 Z" fill="#B3123E" stroke="#FFE7A8" stroke-opacity=".45" stroke-width="3"/>'
        f'<circle cx="256" cy="372" r="56" fill="{GOLD}" stroke="#7A4A08" stroke-width="5"/>'
        '<path d="M256 334 L267 362 L296 362 L272 380 L281 408 L256 391 L231 408 L240 380 L216 362 L245 362 Z" fill="#7A4A08"/>'
    )


@role('lycan', 'village', moon_r=160)
def lycan():
    shadow = f'<g fill="#2A1259" opacity=".85"><g transform="translate(256 300) scale(1.25) translate(-256 -300)">{WOLF_HEAD}</g></g>'
    return hill() + shadow + silhouette(BUST) + (
        f'<g fill="{GOLD}"><circle cx="236" cy="214" r="7"/><circle cx="276" cy="214" r="7"/></g>'
    )


@role('cursed', 'village', moon='blood')
def cursed():
    return hill() + silhouette(BUST) + (
        '<g fill="#FF3B5C"><circle cx="236" cy="214" r="8"/><circle cx="276" cy="214" r="8"/></g>'
        '<g fill="#FF3B5C"><circle cx="290" cy="300" r="7"/><circle cx="312" cy="306" r="7"/>'
        '<path d="M290 307 C292 322 288 332 286 340 C284 332 286 320 290 307 Z"/></g>'
    )


@role('tanner', 'neutral')
def tanner():
    rope = '#C8A06A'
    return hill() + (
        f'<path d="M256 0 L256 236" stroke="{INK}" stroke-width="20"/>'
        f'<path d="M256 0 L256 236" stroke="{rope}" stroke-width="10"/>'
        f'<ellipse cx="256" cy="344" rx="62" ry="80" fill="none" stroke="{INK}" stroke-width="26"/>'
        f'<ellipse cx="256" cy="344" rx="62" ry="80" fill="none" stroke="{rope}" stroke-width="14"/>'
        + ''.join(f'<rect x="230" y="{y}" width="52" height="18" rx="8" fill="{rope}" stroke="{INK}" stroke-width="5"/>'
                  for y in (222, 240, 258))
    )


@role('serialKiller', 'neutral', moon='blood')
def serial_killer():
    return hill() + (
        '<defs><linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#F4F2FA"/>'
        '<stop offset=".5" stop-color="#C9C6D8"/><stop offset="1" stop-color="#8E8AA6"/></linearGradient></defs>'
        f'<path d="M256 70 L292 140 L292 330 L220 330 L220 140 Z" fill="url(#steel)" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>'
        f'<path d="M256 80 L256 326" stroke="{INK}" stroke-opacity=".35" stroke-width="4"/>'
    ) + silhouette(
        '<rect x="168" y="326" width="176" height="28" rx="12"/>'
        '<rect x="236" y="354" width="40" height="86" rx="10"/>'
        '<circle cx="256" cy="452" r="18"/>'
    ) + (
        '<path d="M276 330 C278 352 272 362 270 372 C266 362 266 350 276 330 Z" fill="#B3123E"/>'
    )


def tile(rid):
    team, moon, (mx, my), mr, crescent, fn = ROLES[rid]
    top, mid, bottom = SKY[team]
    m0, m1 = MOON[moon]
    # A crescent is the moon with a disc cut out of it (a mask, so the halo shows through).
    cut = (f'<mask id="cut"><rect width="512" height="512" fill="#fff"/>'
           f'<circle cx="{mx + mr * 0.45}" cy="{my - mr * 0.25}" r="{mr * 0.92}" fill="#000"/></mask>'
           if crescent else '')
    bite = ('' if crescent else
            f'<g fill="{m1}" opacity=".45"><circle cx="{mx - mr * .35}" cy="{my - mr * .3}" r="{mr * .17}"/>'
            f'<circle cx="{mx + mr * .3}" cy="{my + mr * .23}" r="{mr * .12}"/>'
            f'<circle cx="{mx + mr * .23}" cy="{my - mr * .46}" r="{mr * .08}"/></g>')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{top}"/><stop offset=".6" stop-color="{mid}"/><stop offset="1" stop-color="{bottom}"/>
    </linearGradient>
    <radialGradient id="halo" cx="{mx}" cy="{my}" r="{mr * 1.6}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFE9B0" stop-opacity=".5"/><stop offset=".55" stop-color="#FFB7E0" stop-opacity=".12"/><stop offset="1" stop-color="#FFB7E0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="moon" cx="{mx - mr * .2}" cy="{my - mr * .2}" r="{mr * 1.15}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{m0}"/><stop offset="1" stop-color="{m1}"/>
    </radialGradient>
    {cut}
    <clipPath id="tile"><rect width="512" height="512" rx="104"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="512" height="512" fill="url(#sky)"/>
    <g fill="#fff" opacity=".7">
      <circle cx="70" cy="80" r="2.5"/><circle cx="120" cy="150" r="1.6"/><circle cx="450" cy="70" r="2"/>
      <circle cx="470" cy="300" r="1.6"/><circle cx="60" cy="250" r="1.8"/><circle cx="160" cy="60" r="1.4"/>
    </g>
    <circle cx="{mx}" cy="{my}" r="{mr * 1.6}" fill="url(#halo)"/>
    <circle cx="{mx}" cy="{my}" r="{mr}" fill="url(#moon)"{' mask="url(#cut)"' if crescent else ''}/>
    {bite}
    {fn()}
  </g>
</svg>
"""


def kebab(rid):
    return ''.join('-' + c.lower() if c.isupper() else c for c in rid)


if __name__ == '__main__':
    os.makedirs(SRC, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for rid in ROLES:
        svg = os.path.join(SRC, kebab(rid) + '.svg')
        with open(svg, 'w') as f:
            f.write(tile(rid))
        subprocess.run(['rsvg-convert', '-w', str(PX), '-h', str(PX), svg, '-o',
                        os.path.join(OUT, kebab(rid) + '.png')], check=True)
        print('wrote', rid)
