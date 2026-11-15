# 배포 절차 (자동)

main에 올리면 GitHub Actions가 ① 점검 ② 배포 ③ 실제 사이트 확인을 자동으로 합니다.

## 점검(check)에서 막히는 것
- 버전 세 곳(meta app-build · 로그인 화면 vNN · CHANGELOG 맨 위)이 다를 때
- 문법 오류
- 끊어 읽기 표(PHRASES)가 167구절 본문과 어긋날 때
- firestore.rules 에서 기록 삭제 금지·키 문서 관리자 전용이 빠졌을 때
- 사용법(#v-guide)에 핵심 기능 키워드가 없을 때
- 연기 테스트(scripts/smoke.mjs): 탭 전부·학습 채점·종이 시험지 여닫기·합치기 안전성

## 버전 올릴 때 반드시
1. meta app-build / `>vNN<` 두 곳 / CHANGELOG 한 줄
2. 기능이 바뀌면 사용법·해당 탭 안내 문구를 같은 커밋에서 수정
3. 사용자가 알아야 할 변화면 `WHATSNEW`에 한 줄(v 번호 포함), 기능 자체가 생기거나 위치가 바뀌면 `FEATURES`도 수정 — 로그인 뒤 「새로워진 것」 창과 사용법 「기능 한눈에 보기」에 자동 반영
3-1. 새 CSS 클래스·id는 파일 전체 중복 검색
4. 로컬: `node scripts/check.mjs`, 가능하면 smoke 테스트
