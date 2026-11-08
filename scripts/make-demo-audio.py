# -*- coding: utf-8 -*-
"""
============================================================
 生成 3 段「内置免费演示 BGM」
------------------------------------------------------------
 纯标准库合成（无采样、无第三方素材、无版权风险）：
   · 加法合成的和弦铺底 + 琶音 + 贝斯
   · 简易鼓组（kick 正弦扫频 / hat 噪声）
   · 单极点低通制造 Lo-fi 闷感，叠加极轻微底噪
 输出：public/audio/*.wav（22.05kHz / 单声道 / 16bit）
 用法：python scripts/make-demo-audio.py
============================================================
"""
import math
import os
import random
import struct
import wave

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio")

# 音名 → 频率（A4 = 440）
NOTE = {}
_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
for _i, _n in enumerate(_NAMES):
    NOTE[_n] = 440.0 * 2 ** ((_i - 9) / 12.0)


def freq(name, octave):
    """例如 freq('F', 3)"""
    return NOTE[name] * 2 ** (octave - 4)


def env_adsr(t, dur, a=0.01, d=0.08, s=0.7, r=0.25):
    """简单 ADSR 包络（0~1）"""
    if t < a:
        return t / a
    if t < a + d:
        return 1.0 - (1.0 - s) * ((t - a) / d)
    if t < dur:
        return s
    rt = t - dur
    return max(0.0, s * (1.0 - rt / r))


def add_pad(buf, t0, dur, notes, amp=0.10, harm=4):
    """柔和铺底：多个正弦泛音叠加，慢起慢落"""
    n0 = int(t0 * SR)
    n1 = int((t0 + dur + 0.4) * SR)
    for f in notes:
        for h in range(1, harm + 1):
            a = amp / (h * h)
            w = 2 * math.pi * f * h
            for i in range(n0, min(n1, len(buf))):
                t = i / SR - t0
                e = env_adsr(t, dur, a=0.35, d=0.4, s=0.75, r=0.45)
                if e <= 0:
                    continue
                buf[i] += a * e * math.sin(w * t)


def add_arp(buf, t0, dur, f, amp=0.13, harm=5):
    """琶音：方波感的加法合成，短促跳跃"""
    n0 = int(t0 * SR)
    n1 = int((t0 + dur) * SR)
    for h in range(1, harm + 1, 2):
        a = amp / (h * h)
        w = 2 * math.pi * f * h
        for i in range(n0, min(n1, len(buf))):
            t = i / SR - t0
            e = env_adsr(t, dur * 0.85, a=0.006, d=0.06, s=0.35, r=0.10)
            buf[i] += a * e * math.sin(w * t)


def add_bass(buf, t0, dur, f, amp=0.22):
    """贝斯：正弦 + 二次谐波，末端柔和衰减"""
    n0 = int(t0 * SR)
    n1 = int((t0 + dur) * SR)
    for i in range(n0, min(n1, len(buf))):
        t = i / SR - t0
        e = env_adsr(t, dur * 0.8, a=0.01, d=0.15, s=0.6, r=0.2)
        v = math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t)
        buf[i] += amp * e * (v * 0.5)


def add_kick(buf, t0, amp=0.55):
    """底鼓：120Hz → 45Hz 扫频 + 快速衰减"""
    n0 = int(t0 * SR)
    n = int(0.28 * SR)
    phase = 0.0
    for i in range(n0, min(n0 + n, len(buf))):
        t = i / SR - t0
        f = 45 + 75 * math.exp(-t * 26)
        phase += 2 * math.pi * f / SR
        buf[i] += amp * math.sin(phase) * math.exp(-t * 9)


def add_snare(buf, t0, amp=0.20):
    """军鼓：噪声 + 短促音高体"""
    n0 = int(t0 * SR)
    n = int(0.16 * SR)
    for i in range(n0, min(n0 + n, len(buf))):
        t = i / SR - t0
        e = math.exp(-t * 22)
        buf[i] += amp * e * (random.uniform(-1, 1) * 0.7 + math.sin(2 * math.pi * 190 * t) * 0.3)


def add_hat(buf, t0, amp=0.07, decay=46):
    """踩镲：高通感噪声"""
    n0 = int(t0 * SR)
    n = int(0.06 * SR)
    prev = 0.0
    for i in range(n0, min(n0 + n, len(buf))):
        t = i / SR - t0
        white = random.uniform(-1, 1)
        hp = white - prev  # 一阶差分 = 简易高通
        prev = white
        buf[i] += amp * hp * math.exp(-t * decay)


def lowpass(buf, cutoff=3200.0):
    """单极点低通，制造 Lo-fi 的闷感"""
    a = 1.0 - math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    for i in range(len(buf)):
        y += a * (buf[i] - y)
        buf[i] = y


def add_hiss(buf, level=0.0016, crackle=0.004):
    """唱片 / 磁带底噪，量极小只做氛围"""
    rnd = random.Random(7)
    for i in range(len(buf)):
        buf[i] += rnd.uniform(-level, level)
    n = len(buf)
    for _ in range(int(n / 900)):
        i = rnd.randrange(n)
        buf[i] += rnd.uniform(-crackle, crackle)


def normalize(buf, peak=0.82):
    m = max(abs(v) for v in buf) or 1.0
    g = peak / m
    for i in range(len(buf)):
        buf[i] *= g


def fade(buf, fi=0.06, fo=0.5):
    n = len(buf)
    a = int(fi * SR)
    b = int(fo * SR)
    for i in range(a):
        buf[i] *= i / a
    for i in range(b):
        buf[n - 1 - i] *= i / b


def write_wav(path, buf):
    data = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v)) * 32000)
        data += struct.pack("<h", s)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(data))


def build(name, bpm, bars, progression, top, bass_oct, rng_seed, cutoff, hiss):
    """按 4/4 拍、每小节 4 拍、每小节一个和弦生成一段循环"""
    random.seed(rng_seed)
    beat = 60.0 / bpm
    bar = beat * 4
    total = bar * bars
    buf = [0.0] * int(total * SR)

    for b in range(bars):
        t0 = b * bar
        chord, roots, scale = progression[b % len(progression)]
        # 铺底：整小节长音
        add_pad(buf, t0, bar * 0.96, [freq(n, 3) for n in chord] + [freq(chord[0], 4)], amp=0.085)
        # 贝斯：1、3 拍
        add_bass(buf, t0, beat * 0.9, freq(roots, bass_oct), amp=0.24)
        add_bass(buf, t0 + beat * 2.5, beat * 0.7, freq(roots, bass_oct), amp=0.16)
        # 琶音：8 分音符走音阶
        for k in range(8):
            n = scale[(b * 3 + k) % len(scale)]
            add_arp(buf, t0 + k * beat / 2, beat / 2 * 0.9, freq(n, top), amp=0.11)
        # 鼓：kick 在 1、3(+切分)，snare 在 2、4，hat 走 8 分
        add_kick(buf, t0)
        add_kick(buf, t0 + beat * 2)
        if b % 2 == 1:
            add_kick(buf, t0 + beat * 2.75)
        add_snare(buf, t0 + beat)
        add_snare(buf, t0 + beat * 3)
        for k in range(8):
            add_hat(buf, t0 + k * beat / 2, amp=0.06 if k % 2 == 0 else 0.035)

    lowpass(buf, cutoff)
    add_hiss(buf, level=hiss)
    normalize(buf)
    fade(buf)
    out = os.path.join(OUT_DIR, name)
    write_wav(out, buf)
    print(f"  ✓ {name}  {total:.1f}s  {os.path.getsize(out)/1048576:.2f} MB")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("生成内置演示 BGM → public/audio/")

    # 1) Midnight Turntable：F 大调 ii-V-I 走向，慢速 Lo-fi
    build(
        "midnight-turntable.wav",
        bpm=76,
        bars=8,
        progression=[
            (["F", "A", "C", "E"], "F", ["F", "A", "C", "E", "D", "C", "A", "G"]),
            (["D", "F", "A", "C"], "D", ["D", "F", "A", "C", "A", "G", "F", "E"]),
            (["A#", "D", "F", "A"], "A#", ["A#", "D", "F", "A", "G", "F", "D", "C"]),
            (["C", "E", "G", "A#"], "C", ["C", "E", "G", "A#", "A", "G", "E", "D"]),
        ],
        top=5,
        bass_oct=2,
        rng_seed=11,
        cutoff=2600,
        hiss=0.0022,
    )

    # 2) Cassette Sunset：Am - F - C - G，Chillwave
    build(
        "cassette-sunset.wav",
        bpm=92,
        bars=8,
        progression=[
            (["A", "C", "E", "G"], "A", ["A", "C", "E", "G", "E", "D", "C", "B"]),
            (["F", "A", "C", "E"], "F", ["F", "A", "C", "E", "C", "A", "G", "F"]),
            (["C", "E", "G", "B"], "C", ["C", "E", "G", "B", "G", "E", "D", "C"]),
            (["G", "B", "D", "F"], "G", ["G", "B", "D", "F", "D", "B", "A", "G"]),
        ],
        top=5,
        bass_oct=2,
        rng_seed=23,
        cutoff=4200,
        hiss=0.0014,
    )

    # 3) Neon Arcade：Synthwave，更亮更快
    build(
        "neon-arcade.wav",
        bpm=110,
        bars=8,
        progression=[
            (["A", "C", "E"], "A", ["A", "C", "E", "A", "E", "C", "E", "G"]),
            (["F", "A", "C"], "F", ["F", "A", "C", "F", "C", "A", "C", "E"]),
            (["C", "E", "G"], "C", ["C", "E", "G", "C", "G", "E", "G", "B"]),
            (["G", "B", "D"], "G", ["G", "B", "D", "G", "D", "B", "D", "F"]),
        ],
        top=5,
        bass_oct=2,
        rng_seed=37,
        cutoff=6000,
        hiss=0.0008,
    )

    print("完成。")


if __name__ == "__main__":
    main()
