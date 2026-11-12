// 음원 진단 — 저장된 음성을 실제 앱 코드(따라 말하기 자르기)로 잘라 보고, 자른 자리의 소리 크기를 잰다.
// 사용: node scripts/tts-diag.mjs --voice <voiceId> [--ref "사 40:8"]   (ref를 주면 그 구절의 덩어리 WAV·원본 MP3를 out/에 저장)
import { Firestore } from '@google-cloud/firestore';
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(Boolean));
const VOICE = args.voice, REF = typeof args.ref === 'string' ? args.ref : '';
const db = new Firestore({ projectId: 'verse-sheet' });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.route(/^https?:\/\//, r => r.abort());
await page.goto('file://' + path.resolve(new URL('../index.html', import.meta.url).pathname)); await page.waitForTimeout(800);
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const list = (await page.evaluate(() => { S.settings.ttsAddr = true; return S.verses.map(x => ({ ref: x.ref, full: TTS.textOf(x.ref) })); })).map(x => ({ ...x, key: `el_${VOICE}_eleven_flash_v2_5_${hash(x.full)}` }));
console.log('구절', list.length, '예시 키', list[0].key);
fs.mkdirSync('out', { recursive: true });
const rows = []; let miss = 0;
for (const v of list) {
  if (REF && v.ref !== REF) continue;
  const d = await db.doc('audio/' + v.key).get(); if (!d.exists) { miss++; console.log('음성 없음', v.ref, v.key); continue; }
  const { b64, al } = d.data();
  const r = await page.evaluate(async ({ v, b64, al, keep }) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ent = { blob: new Blob([u], { type: 'audio/mpeg' }), al: al || null };
    const pre = (v.full.length - verseOf(v.ref).text.length);
    const cs = await TTS._chunkBlobs(ent, v.full, pre, v.ref);
    const C = window.AudioContext || window.webkitAudioContext; const ac = new C(); const buf = await ac.decodeAudioData(await ent.blob.arrayBuffer()); const ch = buf.getChannelData(0), sr = buf.sampleRate;
    const rms = (t0, t1) => { const a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(ch.length, Math.ceil(t1 * sr)); let e = 0; for (let i = a; i < b; i++) e += ch[i] * ch[i]; return Math.sqrt(e / Math.max(1, b - a)); };
    const fr = []; for (let t = 0; t + 0.02 < buf.duration; t += 0.02) fr.push(rms(t, t + 0.02)); fr.sort((a, b) => a - b); const loud = fr[Math.floor(fr.length * 0.9)] || 1e-6;
    const tAt = i => al ? (i <= 0 ? 0 : al[Math.min(i, al.length) - 1]) : buf.duration * i / v.full.length;
    // 예전 방식의 끝 지점(글자 끝 + 0.12초)도 함께 재어 비교
    let pos = pre; const ends = [pre]; for (const c of cs.slice(1)) { const s = v.full.indexOf(c.label, pos); pos = s + c.label.length; ends.push(pos); }
    const b = []; for (let k = 0; k < cs.length - 1; k++) { const c = ent.cuts[k + 1]; const old = Math.min(buf.duration, tAt(ends[k]) + 0.12);
      b.push({ after: cs[k].label.slice(-6), next: cs[k + 1].label.slice(0, 6), cut: +c.toFixed(3), tail: +(rms(c - 0.03, c) / loud).toFixed(3), head: +(rms(c, c + 0.02) / loud).toFixed(3), oldCut: +old.toFixed(3), oldTail: +(rms(old - 0.05, old) / loud).toFixed(3) }); }
    let files = null; if (keep) { files = []; for (const c of cs) { const ab = await c.blob.arrayBuffer(); let s = ''; const uu = new Uint8Array(ab); for (let i = 0; i < uu.length; i += 8192) s += String.fromCharCode.apply(null, uu.subarray(i, i + 8192)); files.push({ label: c.label, b64: btoa(s) }); } }
    return { dur: +buf.duration.toFixed(2), hasAl: !!al, alOk: !!al && al.length === v.full.length, preTimes: al ? [...v.full.slice(0, pre)].map((c, i) => c + ':' + al[i]).join(' ') : '', pre: v.full.slice(0, pre), preEnd: +tAt(pre).toFixed(2), b, files };
  }, { v, b64, al, keep: !!REF });
  rows.push({ ref: v.ref, ...r });
  if (args.saveall) { fs.mkdirSync('out/all', { recursive: true }); const n = String(rows.length).padStart(3, '0'); fs.writeFileSync(`out/all/${n}.mp3`, Buffer.from(b64, 'base64')); fs.appendFileSync('out/all.jsonl', JSON.stringify({ n, ref: v.ref, full: v.full }) + '\n'); }
  if (REF) { fs.writeFileSync('out/full.mp3', Buffer.from(b64, 'base64')); r.files.forEach((f, i) => fs.writeFileSync(`out/chunk${String(i).padStart(2, '0')}.wav`, Buffer.from(f.b64, 'base64'))); fs.writeFileSync('out/labels.json', JSON.stringify(r.files.map(f => f.label))); console.log(JSON.stringify({ ...r, files: undefined }, null, 1)); }
}
await browser.close();
console.log('시각표 없는 구절: ' + rows.filter(r => !r.alOk).map(r => r.ref).join(', '));
const all = rows.flatMap(r => r.b.map(x => ({ ref: r.ref, ...x })));
const bad = all.filter(x => x.tail > 0.2 || x.head > 0.2), oldBad = all.filter(x => x.oldTail > 0.2);
console.log(`SUMMARY 구절 ${rows.length}, 음성 없음 ${miss}, 시각표 없음 ${rows.filter(r => !r.alOk).length}, 경계 ${all.length}, 새 방식 소리 남는 경계 ${bad.length}, 예전 방식 소리 남던 경계 ${oldBad.length}`);
bad.sort((a, b) => Math.max(b.tail, b.head) - Math.max(a.tail, a.head)).slice(0, 60).forEach(x => console.log(`남음 ${x.ref} …${x.after} | ${x.next}… tail=${x.tail} head=${x.head} (예전 ${x.oldTail})`));
