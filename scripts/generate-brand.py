#!/usr/bin/env python3
"""Draws Lamma's store-facing brand images:

- assets/images/android-icon-monochrome.png: the themed (Material You) Android icon, a white
  silhouette of the logo's game controller in front of a fan of playing cards.
- assets/images/splash-icon.png: the logo with the wordmark "Lamma" / "لمّة" (via render-splash.swift,
  so it uses the app's own Baloo fonts).

Usage: python3 scripts/generate-brand.py   (needs rsvg-convert and Swift, i.e. macOS with Xcode tools)
"""
import os
import subprocess

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'source', 'brand')
IMAGES = os.path.join(ROOT, 'assets', 'images')

# Everything stays inside the adaptive icon's safe zone (the middle 66%).
CONTROLLER = ('M352 520 C352 488 378 468 408 468 L616 468 C646 468 672 488 672 520 '
              'L702 640 C712 684 674 716 638 698 C612 686 594 660 578 640 L446 640 '
              'C430 660 412 686 386 698 C350 716 312 684 322 640 Z')
DPAD = 'M410 530 h22 v-22 h24 v22 h22 v24 h-22 v22 h-24 v-22 h-22 Z'
BUTTONS = ''.join(f'<circle cx="{x}" cy="{y}" r="13" fill="#000"/>'
                  for x, y in ((604, 518), (632, 546), (576, 546), (604, 574)))
SPADE = ('M0 -38 C14 -18 40 -6 40 16 C40 32 24 40 12 34 C10 44 14 54 20 60 L-20 60 '
         'C-14 54 -10 44 -12 34 C-24 40 -40 32 -40 16 C-40 -6 -14 -18 0 -38 Z')


def monochrome():
    cards = (
        f'<g transform="rotate(-16 452 420)"><rect x="382" y="300" width="140" height="196" rx="20"/></g>'
        f'<g transform="rotate(12 572 410)"><rect x="502" y="290" width="140" height="196" rx="20"/>'
        f'<path transform="translate(572 372) scale(.9)" d="{SPADE}" fill="#000"/></g>'
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <mask id="cards"><rect width="1024" height="1024" fill="#fff"/>{cards.replace('<rect', '<rect fill="#fff"')}
      <path d="{CONTROLLER}" fill="#000" stroke="#000" stroke-width="36" stroke-linejoin="round"/></mask>
    <mask id="pad"><rect width="1024" height="1024" fill="#fff"/><path d="{DPAD}" fill="#000"/>{BUTTONS}</mask>
  </defs>
  <g fill="#fff">
    <g mask="url(#cards)"><g mask="url(#cards)">{cards}</g></g>
    <path d="{CONTROLLER}" mask="url(#pad)"/>
  </g>
</svg>
"""


def main():
    os.makedirs(SRC, exist_ok=True)
    svg = os.path.join(SRC, 'android-icon-monochrome.svg')
    with open(svg, 'w') as f:
        f.write(monochrome())
    subprocess.run(['rsvg-convert', '-w', '1024', '-h', '1024', svg, '-o',
                    os.path.join(IMAGES, 'android-icon-monochrome.png')], check=True)
    print('wrote android-icon-monochrome')
    fonts = os.path.join(ROOT, 'assets', 'fonts')
    subprocess.run(['swift', os.path.join(os.path.dirname(__file__), 'render-splash.swift'),
                    os.path.join(IMAGES, 'lamma-logo.png'),
                    os.path.join(fonts, 'Baloo2_800ExtraBold.ttf'),
                    os.path.join(fonts, 'BalooBhaijaan2_800ExtraBold.ttf'),
                    os.path.join(IMAGES, 'splash-icon.png')], check=True)


if __name__ == '__main__':
    main()
