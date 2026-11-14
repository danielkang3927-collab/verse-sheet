// 헤드리스 연기 테스트 — 실제 브라우저로 페이지를 열어 탭마다 오류 없이 그려지는지, 핵심 흐름이 도는지
import { chromium } from 'playwright';
import path from 'node:path';
const file = 'file://' + path.resolve(new URL('../index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/firebase|net::|favicon|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });
// 테스트는 로그인 없이(외부 요청 차단) 돌려 결과가 환경에 따라 달라지지 않게 함
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(file); await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const out = {}; document.getElementById('gate').hidden = true; S.daily.started = S.daily.started || [];
  // 탭 전부 열기
  for (const v of ['learn', 'cards', 'exam', 'log', 'notes', 'list', 'guide']) { show(v); out['tab_' + v] = !document.getElementById('v-' + v).hidden; }
  // 학습 흐름: 새 구절 1단계 → 채점 통과
  show('learn'); cur = nextItem(); lastFb = null; renderWork(); const ta = document.getElementById('ans'); if (!ta) throw new Error('입력칸 없음');
  await new Promise(r => setTimeout(r, 700)); ta.value = verseOf(cur.ref).text; submit(); out.learnPass = !!(lastFb && lastFb.r.pass);
  // 끊어 읽기 표·사용법 자동 채움
  out.phrases = Object.keys(TTS.PHRASES).length; show('guide'); out.guideVer = document.querySelector('[data-g="ver"]').textContent;
  out.changelog = document.getElementById('changelog').children.length;
  // 종이 시험지 열고 닫고 다시 열기
  show('exam'); renderExam(); document.getElementById('ppR').value = 'a'; document.getElementById('ppGo').click(); document.getElementById('pClose').click(); document.getElementById('ppGo').click();
  const pages = [...document.querySelectorAll('.ppage')]; out.sheetPages = pages.length; out.sheetOverflow = pages.some(p => p.scrollHeight > p.clientHeight + 1);
  // 합치기 안전: 빈 상태와 합쳐도 기록이 줄지 않음
  const before = Object.keys(S.progress).length; const m = mergeState(S, { progress: {}, errors: [], stats: { days: {}, badges: {} }, verses: S.verses, settings: S.settings, daily: {} }); out.mergeKeeps = Object.keys(m.progress).length >= before;
  return out;
});
// 마우스 휠로 페이지가 움직이는지(스크롤 막대로만 움직이던 오류 재발 방지) + 휴대폰 너비에서 가로 넘침 없음
await page.evaluate(() => { show('guide'); window.scrollTo(0, 0); }); await page.mouse.move(500, 400);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); } await page.waitForTimeout(150);
r.wheelScroll = await page.evaluate(() => Math.round(window.scrollY));
await page.setViewportSize({ width: 390, height: 800 }); await page.evaluate(() => show('learn')); await page.waitForTimeout(150);
r.phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await browser.close();
console.log(JSON.stringify(r));
const bad = [];
if (!Object.entries(r).filter(([k]) => k.startsWith('tab_')).every(([, v]) => v)) bad.push('탭 표시 실패');
if (!r.learnPass) bad.push('학습 채점 흐름 실패');
if (r.phrases < 160) bad.push('끊어 읽기 표 부족');
if (!/^v\d+$/.test(r.guideVer)) bad.push('사용법 버전 자동 채움 실패');
if (r.sheetPages < 2 || r.sheetOverflow) bad.push('종이 시험지 쪽 나누기 실패');
if (!r.mergeKeeps) bad.push('합치기가 기록을 줄임');
if (!(r.wheelScroll > 100)) bad.push('마우스 휠로 페이지가 움직이지 않음');
if (r.phoneOverflow > 1) bad.push('휴대폰 너비에서 가로로 넘침');
if (errors.length) bad.push(...errors);
if (bad.length) { console.error('연기 테스트 실패:\n' + bad.join('\n')); process.exit(1); }
console.log('연기 테스트 통과');
