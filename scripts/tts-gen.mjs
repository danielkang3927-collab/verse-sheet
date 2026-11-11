// 음성 일괄 생성/점검 — GitHub Actions에서 실행 (Firestore는 서비스 계정, ElevenLabs 키는 config/tts에서 읽음)
// 사용: node scripts/tts-gen.mjs --voice <voiceId> --name <표시이름> [--check]
import { Firestore, FieldValue } from '@google-cloud/firestore';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(Boolean));
const VOICE = args.voice, NAME = args.name || VOICE, CHECK = !!args.check;
if (!VOICE) { console.error('--voice 필요'); process.exit(2); }

// ---- 앱과 같은 규칙 (index.html과 반드시 일치) ----
const BOOKS = { 창: '창세기', 출: '출애굽기', 레: '레위기', 민: '민수기', 신: '신명기', 수: '여호수아', 삿: '사사기', 룻: '룻기', 삼상: '사무엘상', 삼하: '사무엘하', 왕상: '열왕기상', 왕하: '열왕기하', 대상: '역대상', 대하: '역대하', 스: '에스라', 느: '느헤미야', 에: '에스더', 욥: '욥기', 시: '시편', 잠: '잠언', 전: '전도서', 아: '아가', 사: '이사야', 렘: '예레미야', 애: '예레미야애가', 겔: '에스겔', 단: '다니엘', 호: '호세아', 욜: '요엘', 암: '아모스', 옵: '오바댜', 욘: '요나', 미: '미가', 나: '나훔', 합: '하박국', 습: '스바냐', 학: '학개', 슥: '스가랴', 말: '말라기', 마: '마태복음', 막: '마가복음', 눅: '누가복음', 요: '요한복음', 행: '사도행전', 롬: '로마서', 고전: '고린도전서', 고후: '고린도후서', 갈: '갈라디아서', 엡: '에베소서', 빌: '빌립보서', 골: '골로새서', 살전: '데살로니가전서', 살후: '데살로니가후서', 딤전: '디모데전서', 딤후: '디모데후서', 딛: '디도서', 몬: '빌레몬서', 히: '히브리서', 약: '야고보서', 벧전: '베드로전서', 벧후: '베드로후서', 요일: '요한일서', 요이: '요한이서', 요삼: '요한삼서', 유: '유다서', 계: '요한계시록' };
function spokenRef(ref) { const m = ref.match(/^(\S+)\s+(\d+):(\d+)(?:-(\d+))?/); if (!m) return ref; const b = BOOKS[m[1]] || m[1]; let t = `${b} ${m[2]}${m[1] === '시' ? '편' : '장'} ${m[3]}절`; if (m[4]) t += `에서 ${m[4]}절`; return t; }
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const MODEL = 'eleven_flash_v2_5';
const keyOf = (text, voice) => `el_${voice}_${MODEL}_${hash(text)}`;

// ---- 구절 목록: index.html의 SAMPLE에서 ----
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const i0 = html.indexOf('const SAMPLE = `'); const j0 = i0 + 'const SAMPLE = `'.length; const k0 = html.indexOf('`', j0);
const verses = html.slice(j0, k0).split('\n').map(l => l.match(/^(\S+ \S+) \[\d\] (.*?) \/\//)).filter(Boolean).map(m => ({ ref: m[1], text: m[2] }));
if (verses.length < 100) { console.error('구절 파싱 실패', verses.length); process.exit(2); }
const fullOf = v => spokenRef(v.ref) + '. ' + v.text;

const db = new Firestore({ projectId: 'verse-sheet' });
const cfg = (await db.doc('config/tts').get()).data() || {};
let have = 0, made = 0, fail = 0, chars = 0; const missing = [];
for (const v of verses) { const k = keyOf(fullOf(v), VOICE); const d = await db.doc('audio/' + k).get(); if (d.exists) have++; else missing.push(v); }
console.log(`${NAME}: 있음 ${have}/${verses.length}, 없음 ${missing.length}`);
if (CHECK || !missing.length) {
  if (!missing.length) await db.doc('config/public').set({ ready: FieldValue.arrayUnion(VOICE), readyNames: { [VOICE]: NAME }, ts: Date.now() }, { merge: true });
  console.log('READY=' + JSON.stringify(((await db.doc('config/public').get()).data() || {}).ready || []));
  process.exit(0);
}
const key = cfg.key; if (!key) { console.error('config/tts에 ElevenLabs 키가 없습니다(설정 탭에서 키 공유 켜기).'); process.exit(3); }
for (const v of missing) {
  const text = fullOf(v); const k = keyOf(text, VOICE);
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: MODEL }) });
    if (!r.ok) { const t = await r.text(); fail++; console.log(`실패 ${v.ref}: ${r.status} ${t.slice(0, 160)}`); if (/401|quota|limit|exceed/i.test(r.status + t)) break; continue; }
    const j = await r.json(); let al = null; const A = j.alignment || j.normalized_alignment;
    if (A && A.characters && A.characters.join('') === text) al = A.character_end_times_seconds.map(x => Math.round(x * 100) / 100);
    await db.doc('audio/' + k).set(Object.assign({ b64: j.audio_base64, ref: v.ref, voice: VOICE, model: MODEL, speed: 1, ts: Date.now(), by: 'gh-action' }, al ? { al } : {}));
    made++; chars += text.length; console.log(`생성 ${made}/${missing.length} ${v.ref} (${text.length}자)`);
    await new Promise(r => setTimeout(r, 400));
  } catch (e) { fail++; console.log(`오류 ${v.ref}: ${e.message}`); }
}
const after = await (async () => { let n = 0; for (const v of verses) { if ((await db.doc('audio/' + keyOf(fullOf(v), VOICE)).get()).exists) n++; } return n; })();
if (after === verses.length) await db.doc('config/public').set({ ready: FieldValue.arrayUnion(VOICE), readyNames: { [VOICE]: NAME }, ts: Date.now() }, { merge: true });
console.log(`SUMMARY ${NAME}: 새로 ${made}개, 실패 ${fail}개, 사용 ${chars}자(≈${Math.round(chars / 2)}크레딧), 완료 ${after}/${verses.length}`);
process.exit(fail && after !== verses.length ? 1 : 0);
