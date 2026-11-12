# 진단용 받아쓰기(무료, 러너에서 실행) — out/의 음원을 받아써서 출력
import sys, glob, json, subprocess
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1] if len(sys.argv) > 1 else "medium", device="cpu", compute_type="int8")
labels = json.load(open("out/labels.json", encoding="utf8"))
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ar", "16000", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def tr(p, prompt=None):
    segs, _ = m.transcribe(load(p), language="ko", beam_size=5, condition_on_previous_text=False, initial_prompt=prompt)
    return " ".join(s.text.strip() for s in segs)
print("FULL:", tr("out/full.mp3"))
print("FULL(숫자 한글로):", tr("out/full.mp3", "숫자는 모두 한글로 적는다. 창세기 일 장 일 절. 시편 백십구 편 백오 절."))
for i, p in enumerate(sorted(glob.glob("out/chunk*.wav"))):
    print(f"CHUNK{i} 기대[{labels[i]}] 들림[{tr(p)}]" + (f" 한글[{tr(p, '숫자는 모두 한글로 적는다. 창세기 일 장 일 절. 시편 백십구 편 백오 절.')}]" if i == 0 else ""))
