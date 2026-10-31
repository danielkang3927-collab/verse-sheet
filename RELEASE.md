# 배포 점검표 (버전 올릴 때마다)

1. `<meta name="app-build">`와 로그인 화면 `>vNN<` 두 곳 버전 올리기
2. `CHANGELOG` 맨 위에 이번 버전 한 줄 추가 (사용법 탭 「이번 버전에서 바뀐 것」에 자동 표시)
3. 기능이 바뀌면 「사용법」(#v-guide)과 각 탭 안내 문구(note)에서 해당 문장을 같은 커밋에서 고치기
   - 검색: `grep -n '사용법\|<p class="note">' index.html`
4. 새 CSS 클래스·id는 파일 전체에서 중복 검색 후 추가
5. 자동 테스트: 문법(node --check), 여닫기 반복, 아이패드 크기 캡처
6. git push → Cloud Shell `firebase deploy --only hosting --project verse-sheet`
7. 실제 사이트에서 버전 숫자 확인
