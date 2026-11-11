// 배포 전 자동 점검 — 버전·변경 기록·문법·끊어 읽기 표·보안 규칙의 일관성
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);

// 1) 버전 표기 세 곳 일치: <meta app-build>, 로그인 화면 >vNN<, CHANGELOG 맨 위
const meta = (html.match(/name="app-build" content="(v\d+)"/) || [])[1];
const tags = [...html.matchAll(/>(v\d+)</g)].map(m => m[1]);
const cl = (html.match(/const CHANGELOG=\[\s*\n\s*\['(v\d+)'/) || [])[1];
if (!meta) fail('app-build 메타가 없습니다'); else ok('빌드 ' + meta);
if (tags.some(t => t !== meta)) fail(`화면의 버전 표기가 다릅니다: ${[...new Set(tags)].join(',')} vs ${meta}`); else ok('화면 버전 표기 일치');
if (cl !== meta) fail(`CHANGELOG 맨 위(${cl})가 현재 버전(${meta})이 아닙니다 — 사용법 탭 「이번 버전에서 바뀐 것」에 이번 변경을 적으세요`); else ok('CHANGELOG 기록 있음');

// 2) 스크립트 문법
const i = html.lastIndexOf('<script>'); const j = html.lastIndexOf('</script>');
fs.writeFileSync('/tmp/_app.js', html.slice(i + 8, j));
try { execSync('node --check /tmp/_app.js', { stdio: 'pipe' }); ok('문법 OK'); } catch (e) { fail('문법 오류: ' + e.stderr); }

// 3) 끊어 읽기 표가 167구절 본문과 글자 단위로 일치
const i0 = html.indexOf('const SAMPLE = `'); const j0 = i0 + 'const SAMPLE = `'.length; const k0 = html.indexOf('`', j0);
const verses = html.slice(j0, k0).split('\n').map(l => l.match(/^(\S+ \S+) \[\d\] (.*?) \/\//)).filter(Boolean).map(m => ({ ref: m[1], text: m[2] }));
const pi = html.indexOf('const PHRASES=(()=>{const m={};`'); const pj = pi + 'const PHRASES=(()=>{const m={};`'.length; const pk = html.indexOf('`', pj);
const ph = {}; html.slice(pj, pk).split('\n').forEach(l => { const [r, t] = l.split('\t'); if (r && t) ph[r.trim()] = t.trim().split(' / '); });
const bad = verses.filter(v => !ph[v.ref] || ph[v.ref].join(' ') !== v.text).map(v => v.ref);
if (verses.length < 160) fail('구절 수 이상: ' + verses.length); else ok('구절 ' + verses.length + '개');
if (bad.length) fail('끊어 읽기 표 불일치: ' + bad.join(', ')); else ok('끊어 읽기 표 일치');

// 4) 보안 규칙: 사용자 데이터 삭제 금지·관리자 전용 키 문서가 그대로인지
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
if (!/allow delete: if false/.test(rules)) fail('규칙에 삭제 금지가 없습니다'); else ok('규칙: 기록 삭제 금지');
if (!/match \/config\/tts \{\s*allow read, write: if isAdmin\(\);/.test(rules)) fail('config/tts 가 관리자 전용이 아닙니다'); else ok('규칙: 키 문서 관리자 전용');
if (/allow read, write: if true/.test(rules)) fail('규칙에 전체 공개 쓰기가 있습니다');
if (/match \/users\/\{uid\}\/\{[a-z]+=\*\*\}/.test(rules)) fail('users 아래 포괄 허용 규칙이 있으면 삭제 금지·축소 거부가 무력화됩니다(규칙은 OR로 합쳐짐)'); else ok('규칙: 포괄 허용 없음');

// 5) 안내 문구: 새 기능 키워드가 사용법에 있는지 (느슨한 확인)
const guide = html.slice(html.indexOf('id="v-guide"'), html.indexOf('</section>', html.indexOf('id="v-guide"')));
[['오답 코치', '오답 코치'], ['학습 시간', '학습 시간'], ['예상 완료일', '예상 완료일'], ['따라 말하기', '따라 말하기'], ['종이 시험지', '종이 시험지'], ['PDF', 'PDF']].forEach(([k, l]) => { if (!guide.includes(k)) fail('사용법에 「' + l + '」 설명이 없습니다'); });
ok('사용법 키워드 확인');
if (process.exitCode) { console.error('점검 실패 — 배포 중단'); } else console.log('점검 통과');
