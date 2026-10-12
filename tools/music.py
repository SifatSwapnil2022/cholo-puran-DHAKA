"""Original travel cue for the Cholo Puran Dhaka video. Every sound is synthesized here.

Raag Bhupali (D major pentatonic: Sa Re Ga Pa Dha = D E F# A B), tanpura-style drone,
plucked dotara-like lead (Karplus-Strong), dholak groove in kaharwa, shaker, soft night pad.
Tempo 150 BPM (0.4 s per beat) so the video's cuts at 2.6, 7.0, 11.0, 14.2, 17.0, 20.2 and 23.0 s land on beats.
"""
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
DUR = 26.0
N = int(SR * DUR)
rng = np.random.default_rng(1608)
L = np.zeros(N); R = np.zeros(N)
BEAT = 0.4
G0 = 2.6  # groove starts here

SA = 293.66  # D4
DEG = {'S': 0, 'R': 2, 'G': 4, 'P': 7, 'D': 9}
def freq(note):
    oct = note.count("'") - note.count(',')
    return SA * 2 ** ((DEG[note[0]] + 12 * oct) / 12)

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
def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)

def pluck(f, dur, bright=0.5, decay=0.996):
    # Karplus-Strong, computed one period at a time (vectorised)
    n = int(SR * dur); p = max(2, int(SR / f))
    buf = lp(rng.uniform(-1, 1, p), 1500 + 5000 * bright, 1)
    blocks = []; total = 0
    while total < n:
        blocks.append(buf); total += p
        buf = decay * 0.5 * (buf + np.roll(buf, -1))
    out = np.concatenate(blocks)[:n]
    env = np.minimum(1, np.arange(n) / (0.002 * SR))
    return out * env

def tanpura_note(f, dur):
    t = np.arange(int(SR * dur)) / SR
    s = np.zeros_like(t)
    for h in range(1, 14):
        s += np.sin(2 * np.pi * f * h * t * (1 + 0.0007 * np.sin(2 * np.pi * 0.3 * t)) + rng.uniform(0, 6)) / (h ** 1.1) * (1 + 0.6 * np.sin(2 * np.pi * (0.4 + h * 0.07) * t))
    env = (1 - np.exp(-t / 0.03)) * np.exp(-t / (dur * 0.55))
    return s * env

def dha(): # low dholak stroke with pitch drop
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 75 + 70 * np.exp(-t / 0.05)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    s += lp(rng.normal(0, 1, n), 900) * np.exp(-t / 0.012) * 0.35
    return s
def na(gain=1.0): # bright rim stroke
    n = int(0.16 * SR); t = np.arange(n) / SR
    s = bp(rng.normal(0, 1, n), 1800, 5200) * np.exp(-t / 0.022) * 0.7
    s += np.sin(2 * np.pi * 440 * t) * np.exp(-t / 0.05) * 0.5
    return s * gain
def shaker(gain=1.0):
    n = int(0.09 * SR); t = np.arange(n) / SR
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.03)
    return hp(rng.normal(0, 1, n), 6000) * env * gain

def pad(fs, dur):
    t = np.arange(int(SR * dur)) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t) + 0.3 * np.sin(2 * np.pi * f * 2.001 * t) for f in fs)
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.9)
    return lp(s, 1800) * env

# ---------- drone across the whole cue (Pa Sa Sa Sa, every 1.6 s) ----------
for k, t in enumerate(np.arange(0.0, 24.6, 0.4)):
    f = [110.0, 146.83, 146.83, 73.42][k % 4]
    add(tanpura_note(f, 2.4), t, 0.055, pan=[-0.3, 0.2, -0.1, 0.0][k % 4])

# ---------- intro (0-2.6 s): sparse rising plucks ----------
for t, n in [(0.15, 'S'), (0.55, 'P'), (0.95, "S'"), (1.35, 'G'), (1.75, 'P'), (2.05, 'D'), (2.35, "S'")]:
    add(pluck(freq(n), 1.6, 0.35, 0.9975), t, 0.32, pan=0.25)

# ---------- melody (beats are 0.4 s, starting at G0) ----------
A = [(0, 'G', .5), (.5, 'P', .5), (1, 'D', .5), (1.5, "S'", 1), (2.5, 'D', .5), (3, 'P', .5), (3.5, 'G', .5), (4, 'R', 1), (5, 'G', .5), (5.5, 'P', 1.5), (7, 'G', .5), (7.5, 'R', .5)]
A2 = [(0, 'P', .5), (.5, 'D', .5), (1, "S'", .5), (1.5, "R'", 1), (2.5, "S'", .5), (3, 'D', .5), (3.5, 'P', .5), (4, 'G', 1), (5, 'P', .5), (5.5, 'D', 1.5), (7, 'P', .5), (7.5, 'G', .5)]
B = [(0, "S'", .5), (.5, "R'", .5), (1, "G'", 1), (2, "R'", .5), (2.5, "S'", .5), (3, 'D', 1), (4, 'P', .5), (4.5, 'D', .5), (5, "S'", 1), (6, 'D', .5), (6.5, 'P', .5), (7, 'G', 1)]
FILL = [(0, 'G', .25), (.25, 'P', .25), (.5, 'D', .25), (.75, "S'", .25), (1, "R'", .5), (1.5, "G'", .5)]
def play(phrase, start_t, gain=0.36, upto=99, shift=0, pan=0.18, bright=0.55):
    for b, n, d in phrase:
        if b >= upto: continue
        f = freq(n) * 2 ** (shift / 12)
        add(pluck(f, max(0.5, d * BEAT + 0.6), bright, 0.9965), start_t + b * BEAT, gain, pan)
        if d >= 1:  # dotara-style re-strike an octave down for long notes
            add(pluck(f / 2, 0.9, 0.3, 0.996), start_t + b * BEAT + 0.2, gain * 0.35, -pan)

play(A, G0)                         # 2.6  swoop
play(FILL, G0 + 8 * BEAT, 0.3)      # into the card
play(A2, 7.0, 0.30)                 # 7.0  card
play(B, 11.0, 0.38)                 # 11.0 walk
play(A, 11.0 + 8 * BEAT, 0.36, upto=7)
play(B, 17.0, 0.26, shift=0, bright=0.35)   # 17.0 night, softer
play(A2, 20.2, 0.36, upto=7)        # 20.2 Bangla / Guide
for t, n, g in [(23.0, 'G', .34), (23.2, 'R', .30), (23.4, 'S', .40), (23.4, "S'", .22), (23.4, 'P,', .20)]:
    add(pluck(freq(n), 3.0, 0.45, 0.9978), t, g, 0.1)

# ---------- bass (plucked, roots of the drone) ----------
def bass_line(t0, beats, pattern):
    for k in range(beats):
        n = pattern[k % len(pattern)]
        if n: add(lp(pluck(freq(n) / 4, 0.5, 0.2, 0.994), 600), t0 + k * BEAT, 0.42, 0.0)
bass_line(G0, 11, ['S', None, 'S', 'P', None, 'S', 'D,', None])
bass_line(7.0, 10, ['S', None, 'S', 'P', None, 'S', 'D,', None])
bass_line(11.0, 15, ['S', 'S', None, 'P', 'S', None, 'D,', 'P'])
bass_line(20.2, 7, ['S', None, 'S', 'P', None, 'S', 'D,'])

# ---------- dholak (kaharwa in eighths) and shaker ----------
KAHARWA = ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dhi', 'na']
def dholak(t0, t1, gain=1.0, busy=False):
    k = 0; t = t0
    while t < t1 - 1e-6:
        s = KAHARWA[k % 8]
        if s in ('dha', 'dhi'): add(dha(), t, 0.55 * gain); add(na(0.6), t, 0.25 * gain, 0.15)
        elif s == 'ge': add(dha(), t, 0.32 * gain)
        elif s == 'na': add(na(), t, 0.30 * gain, 0.15)
        else: add(na(0.45), t, 0.20 * gain, -0.15)
        if busy and k % 8 == 7: add(na(0.5), t + 0.1, 0.18 * gain, 0.2)
        add(shaker(0.8 if k % 2 else 0.45), t + 0.1, 0.10 * gain, -0.35)
        t += BEAT / 2; k += 1
dholak(G0, 7.0)
dholak(7.0, 11.0, 0.85)
dholak(11.0, 17.0, 1.0, busy=True)
dholak(17.0, 20.2, 0.35)
dholak(20.2, 23.0, 1.0)
add(dha(), 23.0, 0.7); add(na(), 23.0, 0.3)
for t in [G0 + 10.5 * BEAT, 10.6, 16.6, 22.6]:  # small fills before cuts
    add(na(0.8), t, 0.3, 0.2); add(na(0.6), t + 0.1, 0.25, -0.2)

# ---------- night pad ----------
add(pad([146.83, 220.0, 293.66, 369.99], 4.0), 16.8, 0.06)

# ---------- master: light reverb, glue, fades ----------
ir_n = int(0.9 * SR); t = np.arange(ir_n) / SR
ir = rng.normal(0, 1, ir_n) * np.exp(-t / 0.28); ir = lp(ir, 3500); ir /= np.abs(ir).sum() / 6
def verb(x): return fftconvolve(x, ir)[:N]
L2 = L + 0.22 * verb(L); R2 = R + 0.22 * verb(R)
mix = np.stack([L2, R2], 1)
mix = hp(mix.T, 30).T
fade = np.ones(N); fi = int(0.25 * SR); fo = int(1.8 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix / (np.abs(mix).max() * 0.9) * 1.25) * 0.86   # soft clip and normalise
wavfile.write('music.wav', SR, (mix * 32767).astype(np.int16))
print('ok', mix.shape, float(np.abs(mix).max()))
