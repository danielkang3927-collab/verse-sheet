import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const file = process.argv[2] || path.resolve(new URL('../index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.dismiss());
await page.addInitScript(() => { const orig = EventTarget.prototype.addEventListener; window.__L = new WeakSet(); EventTarget.prototype.addEventListener = function (t, f, o) { if ((t === 'click' || t === 'change') && this instanceof Element) window.__L.add(this); return orig.call(this, t, f, o); }; });
await page.goto('file://' + file); await page.waitForTimeout(800);
const setup = () => page.evaluate(() => { document.getElementById('gate').hidden = true; S.daily.started = S.daily.started || []; const t = today();
  S.verses.slice(0, 6).forEach(v => Object.assign(P(v.ref), { stage: 4, box: 2, due: addDays(t, 2) }));
  if (!S.errors.length) for (let i = 0; i < 3; i++) S.errors.push({ ref: S.verses[1].ref, wi: 3, exp: 'x', got: 'y', type: '어휘', d: t, m: 'review:3' });
  window.speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(), 10); window.print = () => {}; navigator.share = undefined; });
await setup();
// 1) unbound controls
const unbound = await page.evaluate(() => { const delegated = ['copyLearned', 'shareLearned', 'showLearned', 'hearFb', 'coachLink', 'expGo', 'impFile']; const readAtUse = ['ttsRep', 'exR', 'exN', 'exNc', 'ppR', 'ppN', 'ppNc', 'ppS', 'ppKey', 'preVoice', 'cardJump', 'nick', 'rsTxt', 'addrIn', 'elKey']; const out = [];
  for (const v of ['learn', 'cards', 'exam', 'log', 'notes', 'list', 'guide']) { show(v); if (v === 'learn') { cur = nextItem(); lastFb = null; renderAll(); }
    document.querySelectorAll('#v-' + v + ' button, #v-' + v + ' a[href="#"], #v-' + v + ' select, #v-' + v + ' input').forEach(el => { const has = el.onclick || el.onchange || el.oninput || window.__L.has(el) || delegated.includes(el.id) || readAtUse.includes(el.id) || el.closest('summary'); if (!has) out.push(v + ':' + (el.id || el.textContent.trim().slice(0, 14) || el.tagName)); }); }
  return out; });
// 2) click every button per tab (skip destructive/navigation)
const skip = ['authBtn', 'gbtn', 'rsY', 'homeBtn', 'elVoices', 'elTest', 'preGo', 'elKeySave', 'bkNow', 'pPdf', 'hideBtn'];
const clicked = [];
for (const v of ['learn', 'cards', 'exam', 'log', 'notes', 'list', 'guide']) {
  await page.evaluate(v => { show(v); if (v === 'learn') { cur = nextItem(); lastFb = null; renderAll(); } }, v);
  const ids = await page.evaluate(v => [...document.querySelectorAll('#v-' + v + ' button')].filter(b => !b.closest('[hidden]') && b.offsetParent !== null).map((b, i) => { if (!b.id) b.id = '__b_' + v + '_' + i; return b.id; }), v);
  for (const id of ids) { if (skip.includes(id)) continue; const before = errs.length;
    await page.evaluate(v => { show(v); }, v);
    const ok = await page.evaluate(id => { const b = document.getElementById(id); if (!b || b.disabled) return 'gone'; b.click(); return 'ok'; }, id);
    await page.waitForTimeout(120);
    await page.evaluate(() => { try { TTS.stop(); } catch (e) { } const ov = document.getElementById('printOv'); if (ov && !ov.hidden) { const c = document.getElementById('pClose'); if (c) c.click(); } const cv = document.getElementById('cover'); if (cv && !cv.hidden) cv.hidden = true; });
    clicked.push(v + ':' + id + (errs.length > before ? ' ✗ ' + errs.slice(before).join('|') : '')); }
}
// 3) export → import round trip
await page.evaluate(() => show('list'));
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.click('#expGo'); const d = await dl; let round = 'no download';
if (d) { const pth = '/tmp/export.json'; await d.saveAs(pth); const j = JSON.parse(fs.readFileSync(pth, 'utf8')); const learnedBefore = await page.evaluate(() => learnedRefs().length);
  await page.evaluate(() => { S.progress = {}; });
  await page.setInputFiles('#impFile', pth); await page.waitForTimeout(600);
  round = { verses: j.verses.length, msgExport: 'ok', learnedBefore, learnedAfterImport: await page.evaluate(() => learnedRefs().length), msg: await page.evaluate(() => document.getElementById('bkMsg').textContent) }; }
console.log(JSON.stringify({ unbound, failedClicks: clicked.filter(c => c.includes('✗')), clickedCount: clicked.length, round, errs: errs.slice(0, 5) }, null, 1));
await browser.close();
if (unbound.length || clicked.some(c => c.includes('✗')) || !d || errs.length) process.exit(1);
