// 특정 구절 음성 다시 만들기 — 잘못 읽은 구절을 고칠 때.
// 만든 음성을 받아쓰기(STT)로 되읽어 '반드시 들어가야 할 말'이 있고 '나오면 안 되는 말'이 없는지 확인한 뒤에만 교체.
// 사용: node scripts/tts-fix.mjs --voice <id> --ref "출 19:5-6" --expect "내게 대하여" [--reject "나에게 대하여"]
import { Firestore } from '@google-cloud/firestore';
import fs from 'node:fs';
const args = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1]; });
const VOICE = args.voice, REF = args.ref, EXPECT = (args.expect || '').trim(), REJECT = (args.reject || '').trim();
if (!VOICE || !REF) { console.error('--voice, --ref 필요'); process.exit(2); }
const src = fs.readFileSync(new URL('./tts-gen.mjs', import.meta.url), 'utf8');
const BOOKS = eval('(' + src.match(/const BOOKS = (\{[^\n]*\});/)[1] + ')');
function spokenRef(ref) { const m = ref.match(/^(\S+)\s+(\d+):(\d+)(?:-(\d+))?/); if (!m) return ref; const b = BOOKS[m[1]] || m[1]; let t = `${b} ${m[2]}${m[1] === '시' ? '편' : '장'} ${m[3]}절`; if (m[4]) t += `에서 ${m[4]}절`; return t; }
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const KEYMODEL = 'eleven_flash_v2_5';   // 앱이 찾는 저장 이름(변경 금지)
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const i0 = html.indexOf('const SAMPLE = `'); const j0 = i0 + 'const SAMPLE = `'.length; const k0 = html.indexOf('`', j0);
const v = html.slice(j0, k0).split('\n').map(l => l.match(/^(\S+ \S+) \[\d\] (.*?) \/\//)).filter(Boolean).map(m => ({ ref: m[1], text: m[2] })).find(x => x.ref === REF);
if (!v) { console.error('구절을 찾지 못함: ' + REF); process.exit(2); }
const text = spokenRef(v.ref) + '. ' + v.text; const docKey = `el_${VOICE}_${KEYMODEL}_${hash(text)}`;
const db = new Firestore({ projectId: 'verse-sheet' });
const key = ((await db.doc('config/tts').get()).data() || {}).key;
if (!key) { console.log('KEY_PRESENT=no'); console.error('config/tts에 키가 없습니다 — 앱 설정 탭에서 「자동 생성용으로 키를 저장소에 보관」을 켜세요.'); process.exit(3); }
const squash = s => s.replace(/[\s.,!?·"'“”‘’]/g, '');
async function tts(model, extra) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ text, model_id: model }, extra || {})) });
  if (!r.ok) throw new Error('TTS ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); let al = null; const A = j.alignment || j.normalized_alignment;
  if (A && A.characters && A.characters.join('') === text) al = A.character_end_times_seconds.map(x => Math.round(x * 100) / 100);
  return { b64: j.audio_base64, al };
}
async function stt(b64) {
  const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'ko'); fd.append('file', new Blob([Buffer.from(b64, 'base64')], { type: 'audio/mpeg' }), 'a.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  if (!r.ok) throw new Error('STT ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json()).text || '';
}
const attempts = [['eleven_multilingual_v2', { apply_text_normalization: 'off' }], ['eleven_flash_v2_5', { apply_text_normalization: 'off' }], ['eleven_multilingual_v2', { seed: 7 }], ['eleven_multilingual_v2', { seed: 21, voice_settings: { stability: 0.7, similarity_boost: 0.75 } }], ['eleven_flash_v2_5', { seed: 3 }]];
let chosen = null, verified = false, firstOk = null;
for (const [model, extra] of attempts) {
  let a; try { a = await tts(model, extra); } catch (e) { console.log(`시도 실패(${model}): ${e.message}`); if (/401|quota|limit|exceed/i.test(e.message)) break; continue; }
  firstOk = firstOk || a;
  let heard = null; try { heard = await stt(a.b64); } catch (e) { console.log('받아쓰기 확인 불가: ' + e.message); }
  if (heard === null) { continue; }
  const h = squash(heard); const okE = !EXPECT || h.includes(squash(EXPECT)); const okR = !REJECT || !h.includes(squash(REJECT));
  console.log(`시도(${model}) 받아쓰기: ${heard.slice(0, 200)}`); console.log(`  기대어 포함=${okE} 금지어 없음=${okR}`);
  if (okE && okR) { chosen = a; verified = true; break; }
}
if (!chosen) { console.log('RESULT=not_verified — 확인된 음성을 만들지 못해 기존 음성을 그대로 둡니다.'); process.exit(4); }
await db.doc('audio/' + docKey).set(Object.assign({ b64: chosen.b64, ref: v.ref, voice: VOICE, model: KEYMODEL, speed: 1, ts: Date.now(), by: 'gh-fix', verified }, chosen.al ? { al: chosen.al } : {}));
await db.doc('config/public').set({ fixed: { [docKey]: Date.now() }, ts: Date.now() }, { merge: true });
console.log(`RESULT=replaced ${v.ref} (${docKey}) verified=${verified}`);
