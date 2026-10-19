#!/usr/bin/env python3
"""Synthesizes Lamma's original sound effects and loops (no third-party audio, so no licensing).

Usage: python3 scripts/generate-sounds.py   (macOS: needs `afconvert` to make the .m4a files)
Writes assets/audio/*.m4a. See docs/CREDITS.md.
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
rng = random.Random(7)  # fixed seed: the same files every run


def silence(sec):
    return [0.0] * int(sec * RATE)


def mix(dst, src, at=0.0, gain=1.0):
    i0 = int(at * RATE)
    if i0 + len(src) > len(dst):
        dst.extend([0.0] * (i0 + len(src) - len(dst)))
    for i, v in enumerate(src):
        dst[i0 + i] += v * gain
    return dst


def lowpass(x, cutoff):
    a = 1 - math.exp(-2 * math.pi * cutoff / RATE)
    y, out = 0.0, []
    for v in x:
        y += a * (v - y)
        out.append(y)
    return out


def highpass(x, cutoff):
    lp = lowpass(x, cutoff)
    return [a - b for a, b in zip(x, lp)]


def noise(sec):
    return [rng.uniform(-1, 1) for _ in range(int(sec * RATE))]


def env_ad(n, attack, decay_tau):
    a = int(attack * RATE)
    return [(i / a if i < a else math.exp(-(i - a) / (decay_tau * RATE))) for i in range(n)]


def tone(freq, sec, partials=((1, 1.0),), attack=0.01, decay=0.5):
    n = int(sec * RATE)
    e = env_ad(n, attack, decay)
    return [
        e[i] * sum(amp * math.sin(2 * math.pi * freq * k * i / RATE) for k, amp in partials)
        for i in range(n)
    ]


def pluck(freq, sec, damping=0.996):
    """Karplus-Strong plucked string."""
    period = max(2, int(RATE / freq))
    buf = [rng.uniform(-1, 1) for _ in range(period)]
    out = []
    for i in range(int(sec * RATE)):
        v = buf[i % period]
        nxt = buf[(i + 1) % period]
        buf[i % period] = damping * 0.5 * (v + nxt)
        out.append(v)
    return out


def bell(freq, sec):
    """Church-bell-like: inharmonic partials with long decay."""
    parts = [(0.5, 0.6, 3.0), (1.0, 1.0, 2.2), (1.19, 0.5, 1.6), (1.56, 0.4, 1.2), (2.0, 0.35, 1.0), (2.74, 0.2, 0.6)]
    n = int(sec * RATE)
    return [
        sum(a * math.exp(-i / (d * RATE)) * math.sin(2 * math.pi * freq * r * i / RATE) for r, a, d in parts)
        for i in range(n)
    ]


def normalize(x, peak=0.85):
    m = max(1e-9, max(abs(v) for v in x))
    return [v * peak / m for v in x]


def fade(x, fin=0.01, fout=0.05):
    n, a, b = len(x), int(fin * RATE), int(fout * RATE)
    return [v * min(1.0, i / max(1, a), (n - i) / max(1, b)) for i, v in enumerate(x)]


def loopable(x, xfade=1.0):
    """Crossfades the tail into the head so the loop has no click."""
    k = int(xfade * RATE)
    head, body, tail = x[:k], x[k:-k], x[-k:]
    blended = [h * (i / k) + t * (1 - i / k) for i, (h, t) in enumerate(zip(head, tail))]
    return blended + body


def write(name, samples):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, name + '.wav')
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in samples))
        out = os.path.join(OUT, name + '.m4a')
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', wav, out], check=True)
    print('wrote', name)


# ---- loops -------------------------------------------------------------------------------------

def night_ambience():
    sec = 26
    wind = lowpass(noise(sec), 300)
    lfo = [0.55 + 0.45 * math.sin(2 * math.pi * i / (RATE * 6.5)) for i in range(len(wind))]
    wind = [w * l for w, l in zip(wind, lfo)]
    rain = highpass(noise(sec), 2500)
    rain = [r * 0.18 for r in rain]
    drone = tone(55, sec, ((1, 0.5), (1.5, 0.25), (2, 0.15)), attack=2.0, decay=999)
    out = [w * 1.6 + r + d * 0.25 for w, r, d in zip(wind, rain, drone)]
    rumble = lowpass(noise(4.0), 80)
    rumble = [v * e for v, e in zip(rumble, env_ad(len(rumble), 0.6, 1.2))]
    mix(out, rumble, at=11.0, gain=2.5)
    return normalize(loopable(out, 1.5), 0.6)


def heartbeat():
    out = silence(1.0)
    for at, gain in ((0.0, 1.0), (0.22, 0.7)):
        thump = tone(52, 0.25, ((1, 1.0), (2, 0.3)), attack=0.005, decay=0.06)
        mix(out, lowpass(thump, 200), at=at, gain=gain)
    return normalize(out, 0.9)


SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10, 12]


def note(root, degree, octave=0):
    semis = SCALE_MINOR[degree % 7] + 12 * (degree // 7 + octave)
    return root * 2 ** (semis / 12)


def tavern():
    """A minor folk tune: plucked melody over a strummed drone, 4 bars at 110 bpm, loops."""
    beat = 60 / 110
    bars = 8
    out = silence(bars * 4 * beat + 1)
    root = 146.83  # D3
    melody = [4, 3, 2, 3, 4, 4, 4, None, 3, 3, 3, None, 4, 6, 6, None,
              4, 3, 2, 3, 4, 4, 4, 4, 3, 3, 4, 3, 2, None, None, None]
    for i, d in enumerate(melody):
        if d is not None:
            mix(out, pluck(note(root * 2, d), beat * 1.6), at=i * beat, gain=0.55)
    chords = [0, 0, 3, 4, 0, 0, 4, 0]
    for b, c in enumerate(chords):
        for k in range(4):
            for off in (0, 2, 4):
                mix(out, pluck(note(root, c + off), beat * 0.9, 0.99), at=(b * 4 + k) * beat + off * 0.012, gain=0.18)
    out = out[: int(bars * 4 * beat * RATE)]
    return normalize(loopable(out, 0.05), 0.7)


def lounge():
    """Soft electric-piano chords for Blend In's clue circle."""
    beat = 60 / 84
    chords = [(0, 4, 7, 11), (2, 5, 9, 12), (4, 7, 11, 14), (2, 5, 9, 12)]  # Cmaj7 Dm7 Em7 Dm7
    out = silence(len(chords) * 4 * beat + 1)
    root = 130.81
    for b, ch in enumerate(chords):
        for k in (0, 2.5):
            for s in ch:
                f = root * 2 ** (s / 12)
                mix(out, tone(f, beat * 3, ((1, 1.0), (2, 0.25), (3, 0.08)), attack=0.02, decay=0.9),
                    at=(b * 4 + k) * beat, gain=0.18)
        mix(out, tone(root / 2 * 2 ** (ch[0] / 12), beat * 4, ((1, 1.0),), attack=0.02, decay=1.5), at=b * 4 * beat, gain=0.3)
    out = out[: int(len(chords) * 4 * beat * RATE)]
    return normalize(loopable(out, 0.1), 0.6)


# ---- one-shots ---------------------------------------------------------------------------------

def death_bell():
    return normalize(fade(bell(196, 4.0), 0.002, 1.0), 0.8)


def night_fall():
    sweep = []
    sec = 3.0
    for i in range(int(sec * RATE)):
        t = i / RATE
        f = 220 * (1 - 0.6 * t / sec)
        sweep.append(math.sin(2 * math.pi * f * t) * math.exp(-t / 1.6) * min(1, t / 0.3))
    pad = lowpass(noise(sec), 400)
    return normalize(fade([a + b * 0.3 for a, b in zip(sweep, pad)], 0.2, 0.8), 0.7)


def reveal_wolves():
    out = silence(2.6)
    for f in (73.42, 77.78, 110.0):  # D2, Eb2, A2: dissonant
        mix(out, tone(f, 2.6, ((1, 1.0), (2, 0.5), (3, 0.3), (4, 0.2)), attack=0.03, decay=0.9), gain=0.4)
    return normalize(fade(lowpass(out, 1200)), 0.8)


def reveal_village():
    out = silence(2.2)
    for i, f in enumerate((261.63, 329.63, 392.0, 523.25)):  # C major arpeggio
        mix(out, tone(f, 1.6, ((1, 1.0), (2, 0.3)), attack=0.01, decay=0.5), at=i * 0.09, gain=0.4)
    return normalize(fade(out), 0.8)


def fanfare():
    out = silence(3.0)
    seq = [(392.0, 0.0), (392.0, 0.18), (523.25, 0.36), (659.25, 0.62), (783.99, 0.9)]
    for f, at in seq:
        mix(out, tone(f, 1.4, ((1, 1.0), (2, 0.5), (3, 0.25)), attack=0.01, decay=0.4), at=at, gain=0.45)
    return normalize(fade(out), 0.85)


def chime():
    return normalize(fade(tone(1046.5, 0.8, ((1, 1.0), (2.76, 0.3)), attack=0.002, decay=0.25)), 0.6)


def tick():
    click = highpass(noise(0.03), 3000)
    return normalize(fade([v * e for v, e in zip(click, env_ad(len(click), 0.001, 0.006))], 0.0, 0.01), 0.7)


def swoosh():
    n = int(0.7 * RATE)
    raw = noise(0.7)
    out, y = [], 0.0
    for i, v in enumerate(raw):
        cutoff = 200 + 5000 * math.sin(math.pi * i / n)
        a = 1 - math.exp(-2 * math.pi * cutoff / RATE)
        y += a * (v - y)
        out.append(y * math.sin(math.pi * i / n))
    return normalize(out, 0.7)


def countdown_beep():
    return normalize(fade(tone(880, 0.18, ((1, 1.0),), attack=0.003, decay=0.08)), 0.6)


if __name__ == '__main__':
    for name, fn in [
        ('night-ambience', night_ambience),
        ('heartbeat', heartbeat),
        ('tavern', tavern),
        ('lounge', lounge),
        ('death-bell', death_bell),
        ('night-fall', night_fall),
        ('reveal-wolves', reveal_wolves),
        ('reveal-village', reveal_village),
        ('fanfare', fanfare),
        ('chime', chime),
        ('tick', tick),
        ('swoosh', swoosh),
        ('countdown', countdown_beep),
    ]:
        write(name, fn())
