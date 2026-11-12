# 글자별 시각표가 없는 음성에 시각표 만들어 주기 — 받아쓰기의 낱말 시각을 기대 문장 글자에 맞춰 붙임(무료, 러너에서 실행)
import json, re, subprocess, difflib
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("medium", device="cpu", compute_type="int8")
keep = lambda c: re.match(r"[0-9A-Za-z가-힣]", c) is not None
out = {}
for l in open("out/all.jsonl", encoding="utf8"):
    r = json.loads(l); full = r["full"]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"out/all/{r['n']}.mp3", "-ar", "16000", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    au = np.frombuffer(raw, dtype=np.float32); dur = len(au) / 16000
    segs, _ = m.transcribe(au, language="ko", beam_size=5, condition_on_previous_text=False, word_timestamps=True)
    hc, hs, he = [], [], []
    for s in segs:
        for w in (s.words or []):
            cs = [c for c in w.word if keep(c)]
            for i, c in enumerate(cs):
                hc.append(c); hs.append(w.start + (w.end - w.start) * i / len(cs)); he.append(w.start + (w.end - w.start) * (i + 1) / len(cs))
    idx = [i for i, c in enumerate(full) if keep(c)]; ec = [full[i] for i in idx]
    S = [None] * len(full); E = [None] * len(full); hit = 0
    for b in difflib.SequenceMatcher(None, ec, hc, autojunk=False).get_matching_blocks():
        for k in range(b.size): S[idx[b.a + k]] = hs[b.b + k]; E[idx[b.a + k]] = he[b.b + k]; hit += 1
    # 못 맞춘 글자는 앞뒤 사이를 고르게 나눔
    known = [(-1, 0.0)] + [(i, E[i]) for i in range(len(full)) if E[i] is not None] + [(len(full), dur)]
    al = [None] * len(full)
    for (i0, t0), (i1, t1) in zip(known, known[1:]):
        for i in range(i0 + 1, i1): al[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
        if i1 < len(full): al[i1] = t1
    # 띄어쓰기·문장부호의 끝 시각 = 다음 글자가 시작하는 때
    for i, c in enumerate(full):
        if not keep(c):
            nx = next((S[j] for j in range(i + 1, len(full)) if S[j] is not None and keep(full[j])), None)
            if nx is not None and (i + 1 < len(full)) and S[i + 1] is not None: al[i] = max(al[i - 1] if i else 0, nx)
    for i in range(1, len(al)): al[i] = max(al[i], al[i - 1])
    al = [round(min(dur, x), 2) for x in al]
    print(f"ALIGN {r['ref']} 맞춘 글자 {hit}/{len(ec)} 길이 {dur:.2f}s", flush=True)
    if hit / max(1, len(ec)) >= 0.8: out[r["ref"]] = {"key": r["key"], "al": al, "n": len(full)}
    else: print("  일치율이 낮아 건너뜀")
json.dump(out, open("out/al.json", "w", encoding="utf8"), ensure_ascii=False)
