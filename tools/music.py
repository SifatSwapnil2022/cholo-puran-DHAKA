"""Soft travel cue for the Cholo Puran Dhaka video. Every sound is synthesized here.

75 BPM in D major: warm pad, felt-piano arpeggios, a slow pentatonic melody,
round sine bass, a hush of river water and a very light shaker.
Bars are 3.2 s and start at 0.6 s, so the final chord lands on the end card at 23.0 s.
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
DUR = 26.0
N = int(SR * DUR)
rng = np.random.default_rng(2610)
L = np.zeros(N); R = np.zeros(N)
BEAT = 0.8
BAR = 4 * BEAT
T0 = 0.6

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    R[i:i + len(sig)] += sig * gain * r * 1.414

def lp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'low'); return lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high'); return lfilter(b, a, x)

def felt(m, dur, vel=1.0):
    """Soft felt piano: few partials, quick hammer, long gentle decay."""
    f = hz(m); n = int(SR * dur); t = np.arange(n) / SR
    s = np.zeros(n)
    for h, a, d in [(1, 1.0, 1.6), (2, 0.35, 0.9), (3, 0.12, 0.5), (4, 0.05, 0.3)]:
        s += a * np.sin(2 * np.pi * f * h * 1.0004 ** (h - 1) * t + rng.uniform(0, 6)) * np.exp(-t / (d * (1.4 - 0.3 * vel)))
    s += 0.04 * lp(rng.normal(0, 1, n), 2500) * np.exp(-t / 0.008)   # hammer felt
    env = np.minimum(1, t / 0.006) * np.minimum(1, (dur - t) / 0.15)
    return lp(s * env, 3000 + 2500 * vel)

def pad(ms, dur):
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for m in ms:
        f = hz(m)
        for det in (-0.004, 0.0, 0.0045):
            for h, a in [(1, 1.0), (2, 0.3), (3, 0.12)]:
                s += a * np.sin(2 * np.pi * f * h * (1 + det) * t + rng.uniform(0, 6))
    s *= 1 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    env = np.minimum(1, t / 1.4) * np.minimum(1, (dur - t) / 1.4)
    return lp(s * env, 1100)

def bass(m, dur):
    t = np.arange(int(SR * dur)) / SR
    s = np.sin(2 * np.pi * hz(m) * t) + 0.2 * np.sin(2 * np.pi * hz(m) * 2 * t)
    return s * np.minimum(1, t / 0.04) * np.exp(-t / 1.8) * np.minimum(1, (dur - t) / 0.3)

def shaker(g=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return hp(rng.normal(0, 1, n), 5500) * (1 - np.exp(-t / 0.015)) * np.exp(-t / 0.035) * g

def thump():
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = 62 + 30 * np.exp(-t / 0.04)
    return lp(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22), 300)

# chords: (root for bass, pad notes, arpeggio notes)
D  = (38, [50, 54, 57, 62], [62, 69, 74, 78, 81, 78, 74, 69])
A  = (33, [49, 52, 57, 61], [57, 64, 69, 73, 76, 73, 69, 64])
Bm = (35, [50, 54, 59, 62], [59, 66, 71, 74, 78, 74, 71, 66])
G  = (31, [50, 55, 59, 62], [55, 62, 67, 71, 74, 71, 67, 62])
PROG = [D, A, Bm, G, D, A, G, D]

# river hush under the opening overview, fading as the music settles
n = N; t = np.arange(n) / SR
water = lp(hp(rng.normal(0, 1, n), 300), 1800) * (1 + 0.5 * np.sin(2 * np.pi * 0.17 * t))
water *= np.clip(1 - (t - 2.0) / 5.0, 0, 1) * np.minimum(1, t / 0.8)
add(water, 0.0, 0.025)

for k, (root, pnotes, arp) in enumerate(PROG):
    t0 = T0 + k * BAR
    last = k == len(PROG) - 1
    span = DUR - t0 if last else BAR + 1.2
    add(pad(pnotes, span), t0, 0.017, 0.0)
    add(bass(root + 12, min(span, BAR + 0.4)), t0, 0.08 if k else 0.04, 0.0)
    if last:  # final chord, rolled and left to ring
        for j, m in enumerate([62, 69, 74, 78, 86]):
            add(felt(m, 3.0, 0.6), t0 + j * 0.06, 0.13, -0.2 + j * 0.1)
        continue
    for j, m in enumerate(arp):
        vel = 0.55 if j % 2 else 0.7
        add(felt(m, 1.6, vel), t0 + j * BEAT / 2, 0.075 if k else 0.06, -0.25 + 0.5 * (j % 2))

# slow melody (bar, beat, midi, beats)
MEL = [
    (1, 0, 76, 1.5), (1, 1.5, 74, 0.5), (1, 2, 69, 2),
    (2, 0, 71, 1), (2, 1, 74, 1), (2, 2, 78, 2),
    (3, 0, 76, 1), (3, 1, 74, 1), (3, 2, 71, 2),
    (4, 0, 74, 1), (4, 1, 78, 1), (4, 2, 81, 2),
    (5, 0, 83, 1), (5, 1, 81, 1), (5, 2, 76, 2),
    (6, 0, 78, 1), (6, 1, 76, 1), (6, 2, 74, 1), (6, 3, 71, 1),
]
for bar, beat, m, d in MEL:
    add(felt(m + 12, d * BEAT + 1.4, 0.8), T0 + bar * BAR + beat * BEAT, 0.11, 0.12)

# very light pulse from bar 2 to the end card
for k in range(2, 7):
    t0 = T0 + k * BAR
    add(thump(), t0, 0.045)
    add(thump(), t0 + 2 * BEAT, 0.028)
    for j in range(8):
        if j % 2: add(shaker(1.0), t0 + j * BEAT / 2, 0.05 if k < 5 else 0.065, -0.35)

# master: roomy reverb, gentle fades, normalise
ir_n = int(2.4 * SR); t = np.arange(ir_n) / SR
irL = lp(rng.normal(0, 1, ir_n) * np.exp(-t / 0.7), 3000)
irR = lp(rng.normal(0, 1, ir_n) * np.exp(-t / 0.7), 3000)
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L2 = L + 0.35 * fftconvolve(L, irL)[:N]
R2 = R + 0.35 * fftconvolve(R, irR)[:N]
mix = hp(np.stack([L2, R2]), 75)
fade = np.ones(N); fi = int(0.4 * SR); fo = int(2.2 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix = (mix * fade).T
mix = np.tanh(mix / np.abs(mix).max() * 1.1) * 0.85
out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('ok', out, mix.shape)
