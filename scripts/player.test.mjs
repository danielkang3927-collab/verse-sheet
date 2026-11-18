// 암송카드 음성 재생기 시험 — 저절로 다음 구절로 넘어가기, 잠금 화면 동작(일시정지→재생→다음→이전), 잠시 멈춤/이어 듣기, 이 구절 반복, 한 구절만
import { chromium } from 'playwright';
import path from 'node:path';
const file = 'file://' + path.resolve(new URL('../index.html', import.meta.url).pathname);
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1100,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_|net::|firebase/i.test(m.text()))errs.push('c:'+m.text());});await p.route(/^https?:\/\//,r=>r.abort());await p.goto(file);await p.waitForTimeout(500);
const r=await p.evaluate(async()=>{document.getElementById('gate').hidden=true;const W=ms=>new Promise(r=>setTimeout(r,ms));const o={};const $=id=>document.getElementById(id);
 const wav=sec=>{const sr=8000,n=Math.round(sr*sec);const ab=new ArrayBuffer(44+n*2),dv=new DataView(ab);const w=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};w(0,'RIFF');dv.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,sr,true);dv.setUint32(28,sr*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,n*2,true);for(let i=0;i<n;i++)dv.setInt16(44+i*2,(Math.random()*2-1)*6000,true);let s='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);};
 const b64=wav(0.8);let fetches=0;window.__fsAudioGet=async k=>{fetches++;await W(120);return {b64};};
 S.settings.ttsEngine='el';S.settings.elVoice='Xb7hH8MSUJpSbSDYk0k2';S.settings.ttsGap=0.5;S.settings.ttsRate=1;show('cards');await W(100);
 const a=$('ttsAudio');const log=[];const D=()=>TTS._dbg();const snap=t=>log.push(t+':'+D().vi+(a.paused?'P':'▶'));
 $('ttsMode').value='seq';$('ttsMode').dispatchEvent(new Event('change'));$('ttsRep').value='1';$('ttsEcho').checked=false;$('ttsGap')&&($('ttsGap').value='0.5');
 // 끝남 순간에 다음 음원이 준비돼 있었는지, 그리고 기다림 없이 곧바로 재생으로 넘어갔는지
 const trans=[];a.addEventListener('ended',()=>{const before=D();const t0=performance.now();queueMicrotask(()=>{trans.push({from:before.vi,to:D().vi,sameTick:!a.paused||a.src!=='',kind:D().cur,ms:+(performance.now()-t0).toFixed(1)});});});
 TTS.toggle();await W(500);o.start=[D().vi,!a.paused,D().cur,+a.duration.toFixed(2),$('ttsPlay').textContent,$('ttsMsg').textContent];
 await W(3300);o.auto=[D().vi,!a.paused,trans.slice()];                                     // 1.3초짜리 구절 → 두세 번 저절로 넘어감
 // ── 잠금 화면에서: 일시정지 → (암송) → 재생 → 다음 → 이후에도 계속 이어지는지
 const ms=TTS._ms();const tBefore=a.currentTime,srcBefore=a.src;ms.pause();await W(100);const t1=D().softT;const v1=D().vi;o.paused=[D().soft&&!a.paused&&a.src!==srcBefore&&a.loop,D().isPaused,$('ttsPlay').textContent,$('ttsMsg').textContent,Math.abs(t1-tBefore)<0.2];
 await W(1500);o.stillPaused=[D().soft&&!a.paused,D().softT===t1,D().vi===v1];   // 일시정지 동안: 무음이 돌며 자리를 지킴(구절·위치 그대로)
 ms.play();await W(250);o.resumed=[!a.paused&&!D().soft&&a.src===srcBefore,D().vi===v1,a.currentTime>=t1-0.05&&a.currentTime<t1+0.6];
 ms.next();const vn=D().vi;o.nextImmediate=[vn===v1+1,!a.paused||a.readyState<3,D().cur];await W(300);o.nextPlaying=[!a.paused,D().vi];
 const nT=trans.length;await W(3200);o.continues=[D().vi>vn,!a.paused,trans.length-nT];        // 다음 뒤에도 계속 자동으로 넘어감
 ms.prev();await W(250);o.prev=[!a.paused,D().cur];
 // ── 앱의 큰 버튼: 잠시 멈춤 / 이어 듣기, 정지
 TTS.toggle();await W(100);o.btnPause=[D().soft,$('ttsPlay').textContent,TTS.isPlaying()];TTS.toggle();await W(250);o.btnResume=[!a.paused,$('ttsPlay').textContent];
 $('ttsStop').click();await W(100);o.stopped=[a.paused||!a.src,TTS.isPlaying(),$('ttsPlay').textContent];
 // ── 이 구절 반복: 파일 하나를 되풀이, 잠금 화면 '다음'은 다음 구절로 가서 그 구절을 되풀이
 $('ttsMode').value='rone';$('ttsMode').dispatchEvent(new Event('change'));TTS.toggle();await W(600);const vr=D().vi;let wraps=0,lt=0;const tu=()=>{if(a.currentTime<lt-0.2)wraps++;lt=a.currentTime;};a.addEventListener('timeupdate',tu);
 await W(3000);o.rone=[a.loop,!a.paused,wraps>=1,D().vi===vr,$('ttsMsg').textContent];TTS._ms().pause();await W(1200);o.ronePauseKeeps=[D().soft,D().vi===vr];TTS._ms().pause();/* 일시정지 중에 '일시정지'가 또 와도 이어 듣기 */await W(250);o.roneToggle=[!D().soft,!a.paused,a.loop];TTS._ms().pause();await W(300);TTS._ms().play();await W(200);TTS._ms().next();await W(400);wraps=0;lt=0;await W(3000);o.roneNext=[D().vi===vr+1,a.loop,!a.paused,wraps>=1];
 // 재생 중 빠르기 변경 → 이어짐
 $('ttsSpeed').value='1.5';$('ttsSpeed').dispatchEvent(new Event('change',{bubbles:true}));await W(700);o.speed=[!a.paused,a.playbackRate,a.loop];TTS.stop();
 // ── 한 구절만: 끝나면 멈춤
 $('ttsSpeed').value='1';$('ttsSpeed').dispatchEvent(new Event('change',{bubbles:true}));$('ttsMode').value='one';$('ttsMode').dispatchEvent(new Event('change'));TTS.toggle();await W(2400);o.one=[TTS.isPlaying(),$('ttsMsg').textContent];
 // ── 전체 반복: 끝에서 처음으로
 o.fetches=fetches;return o;});
await b.close();console.log(JSON.stringify(r));
const bad=[];const T=(c,m)=>{if(!c)bad.push(m);};
T(r.start[1]&&r.start[2]==='file','처음 재생이 준비된 음원으로 시작하지 않음');T(r.auto[0]>=2&&r.auto[1],'저절로 다음 구절로 넘어가지 않음');T(r.auto[2].every(x=>x.kind==='file'),'넘어갈 때 준비된 음원을 쓰지 못함');
T(r.paused[0]&&r.paused[1]&&r.paused[2]==='▶ 이어 듣기'&&r.paused[4],'일시정지 실패(무음으로 자리를 지키지 못함)');T(r.ronePauseKeeps.every(Boolean)&&r.roneToggle.every(Boolean),'일시정지 중 다시 누르면 이어 듣기 실패');T(r.stillPaused.every(Boolean),'일시정지 중 위치가 움직임');T(r.resumed.every(Boolean),'재생으로 이어지지 않음');
T(r.nextImmediate[0]&&r.nextImmediate[2]==='file'&&r.nextPlaying[0],'다음 구절로 즉시 넘어가지 않음');T(r.continues[0]&&r.continues[1],'다음을 누른 뒤 이어서 넘어가지 않음');T(r.prev[0],'이전 구절 재생 실패');
T(r.btnPause[0]&&r.btnPause[2]&&r.btnResume[0],'큰 버튼 잠시 멈춤/이어 듣기 실패');T(r.stopped[0]&&!r.stopped[1],'정지 실패');
T(r.rone.slice(0,4).every(Boolean),'이 구절 반복 실패');T(r.roneNext.every(Boolean),'이 구절 반복 중 다음 구절로 넘어가 되풀이하지 못함');T(r.speed[0]&&r.speed[1]===1.5,'재생 중 빠르기 변경 뒤 이어지지 않음');T(!r.one[0]&&r.one[1]==='끝','한 구절만: 끝나고 멈추지 않음');
if(errs.length)bad.push(...errs);if(bad.length){console.error('재생기 시험 실패:\n'+bad.join('\n'));process.exit(1);}console.log('재생기 시험 통과');
