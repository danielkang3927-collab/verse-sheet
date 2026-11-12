# 진단용 받아쓰기(무료, 러너에서 실행) — out/의 음원을 받아써서 출력
import sys, glob, json
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1] if len(sys.argv) > 1 else "medium", device="cpu", compute_type="int8")
labels = json.load(open("out/labels.json", encoding="utf8"))
def tr(p):
    segs, _ = m.transcribe(p, language="ko", beam_size=5, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segs)
print("FULL:", tr("out/full.mp3"))
for i, p in enumerate(sorted(glob.glob("out/chunk*.wav"))):
    print(f"CHUNK{i} 기대[{labels[i]}] 들림[{tr(p)}]")
