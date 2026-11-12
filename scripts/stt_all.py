# 전 구절 받아쓰기 점검 — 저장된 음성을 받아써서 기대 문장과 다른 정도를 잰다(무료, 러너에서 실행)
import sys, json, re, subprocess, difflib
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1] if len(sys.argv) > 1 else "medium", device="cpu", compute_type="int8")
norm = lambda t: re.sub(r"[^0-9A-Za-z가-힣]", "", t)
rows = [json.loads(l) for l in open("out/all.jsonl", encoding="utf8")]
res = []
for r in rows:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"out/all/{r['n']}.mp3", "-ar", "16000", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = m.transcribe(np.frombuffer(raw, dtype=np.float32), language="ko", beam_size=5, condition_on_previous_text=False)
    words = [s.text.strip() for s in segs]; heard = " ".join(words)
    addr = r["full"].split(". ")[0]; ha = heard[: len(addr) + 6]
    ra = difflib.SequenceMatcher(None, norm(addr), norm(heard)[: len(norm(addr))]).ratio()
    rt = difflib.SequenceMatcher(None, norm(r["full"]), norm(heard)).ratio()
    res.append((ra, rt, r["ref"], addr, heard)); print(f"ROW {r['ref']} addr={ra:.2f} all={rt:.2f} | {heard}", flush=True)
print("=== 주소가 다르게 들린 구절")
for ra, rt, ref, addr, heard in sorted(res):
    if ra < 0.999: print(f"ADDR {ref} {ra:.2f} 기대[{addr}] 들림[{heard[:len(addr)+8]}]")
print("=== 본문 일치도 낮은 순 30")
for ra, rt, ref, addr, heard in sorted(res, key=lambda x: x[1])[:30]: print(f"TEXT {ref} {rt:.2f} | {heard}")
