// stt_align.py가 만든 시각표를 음성 문서에 덧붙임(음성 자체는 그대로) — 각 기기는 config/public.fixed를 보고 새로 받음
import { Firestore } from '@google-cloud/firestore';
import fs from 'node:fs';
const db = new Firestore({ projectId: 'verse-sheet' });
const j = JSON.parse(fs.readFileSync('out/al.json', 'utf8')); const fixed = {};
for (const [ref, v] of Object.entries(j)) {
  if (!Array.isArray(v.al) || v.al.length !== v.n || v.al.some((x, i) => typeof x !== 'number' || (i && x < v.al[i - 1]))) { console.log('건너뜀(형식 오류) ' + ref); continue; }
  const d = db.doc('audio/' + v.key); const cur = await d.get(); if (!cur.exists) { console.log('건너뜀(음성 없음) ' + ref); continue; }
  if (Array.isArray(cur.data().al) && cur.data().al.length === v.n) { console.log('이미 있음 ' + ref); continue; }
  await d.set({ al: v.al, alBy: 'whisper', alTs: Date.now() }, { merge: true }); fixed[v.key] = Date.now(); console.log('시각표 추가 ' + ref);
}
if (Object.keys(fixed).length) await db.doc('config/public').set({ fixed, ts: Date.now() }, { merge: true });
console.log('WROTE=' + Object.keys(fixed).length);
