# 랭킹·푸터 작업 흔적 정리 검증 — 2026-11-02

## 정리 범위

사용자가 승인한 순서에 따라 현행 문서와 과거 이력을 분리하고, 참조가 끊긴 코드와 이번 중간 시안을 제거했다. 화면·데이터 계약·의존성은 유지했으며 배포·DB 변경·Git 커밋은 수행하지 않았다.

- PRODUCT의 날짜별 결정은 [제품 결정 이력](archive/product-decisions-2026-11-02.md), 대체된 중복 brief는 [초기 brief](archive/impeccable-briefs-2026-11-02.md), 반복된 시안 측정은 [시안 검토 기록](archive/ranking-mock-review-2026-11-01.md)에 보존했다. 현재 PRODUCT·DESIGN·surface·sidecar와 문서 색인을 맞췄다.
- 미사용 `ranking-mobile-list.tsx`와 `marketcap/per/pbr/eps/bps/div/dps-compact-list.tsx` 8개를 삭제했다. 구형 `RankingPrice`·`RankingSparkline`, ServerTable의 무효 속성 6개·data fallback, 미사용 CSS 57줄과 focus 선택자 분기를 제거했다. 살아 있는 CSS 선언과 순서는 원본과 동일하다.
- 구형 차트 직접 테스트 3개를 현재 RankingQuote로 이전했다. 큰 정수의 1원 차이·날짜·결측 구간·단일 0·등락 방향·가격 접근성·최신 끝점과 SVG 좌표의 일치를 유지·보강했다. 공유 값·순위·기존 푸터·전체 최근 기록·끝점·오버레이 계산은 보존했다.
- 이번 시안 폴더에서 중간 HTML 4개(`ranking-reflow`, `ranking-fluid`, `ranking-overlay-before-desktop`, `ranking-footer`), 점검 JS 3개(`ranking-reflow-check`, `ranking-fluid-check`, `ranking-overlay.check`), 별도 WOFF 3개(`cd-display`, `cd-footer-display`, `cd-directory-display`)만 삭제했다. 합계 10개·316,842 bytes다.

최종 승인 HTML 2개, 기존 제품 검증 보고서 2개, 기존 캡처·측정 자료 13개 등 17개 파일은 정리 전후 SHA-256이 같다. 최종 HTML은 폰트를 내장하고 삭제 파일을 참조하지 않는다. 과거 `.impeccable` 자료는 일괄 삭제하지 않았다.

| 최종 시안 | SHA-256 |
| --- | --- |
| `ranking-overlay.html` | `6f07f791e3dc9d308974b46744079735a90602ca5874b30648875a65ccd29901` |
| `ranking-directory-footer.html` | `6eb6a7f3a57b8f209eab5d015bf396484bc16870ff7e839b729e6e5ae153559d` |

## 자동 검사

Node 22.23.3·Bun 1.4.2에서 실행했다.

| 검사 | 결과 |
| --- | --- |
| `bun run test` | 398/398 통과, 실패·skip 없음 |
| 관련 회귀 | 51/51 통과. 기존 사례 삭제 없이 현행 렌더러로 이전 |
| `bun run typecheck` | 통과 |
| 변경 TSX·테스트 ESLint | 통과 |
| `bun run lint` | 기존과 같은 28 errors / 27 warnings로 실패. 변경 파일의 오류 없음 |
| `bun run build` | 통과. 기존 정적 빌드 조회 모듈의 동적 파일 추적 경고 3건 유지 |
| 문서·참조 검사 | 변경 Markdown 11개의 로컬 링크 126개 존재, 삭제 코드 참조 0건, `git diff --check` 통과 |
| Impeccable `doctor --json` | findings 0건. 현재 surface·DESIGN·sidecar의 오래된 정보 정리 |

## 실제 브라우저 비교

정리 전·후 standalone 빌드를 임시 `127.0.0.1:3107`에서 실행했다. 라이트·다크 각각 폭 300/390/432/433/550/650/767/768/897/898/1099/1100/1279/1280/1440/1920px(높이 900px), 1440px 폭의 높이 599/600/649/650px를 측정했다. 40개 조건 모두 순위 20행·가격·차트·등락률·페이지 이동·레일·자료 안내의 위치·크기·색·글자 크기 등 수집한 값이 정리 전과 정확히 같았고 가로 넘침은 없었다. 대시보드·기업 상세의 제목·공유 순위/값 측정도 같았다.

목차 푸터는 390/767px에서 높이 0·display none, 768/1099px에서 브랜드와 세 그룹, 1100/1280/1440px에서 네 열을 확인했다. 모바일 자료 공개 정보 펼침의 마지막 내용은 하단 메뉴 위에 남았다. 두 테마의 차트와 데스크탑 하단을 실제 화면으로 검토했다.

푸터의 순위 링크 8개, 기업/종목 전환, DPS 다음 100행의 revision/scope, 정확한 값 펼침, 전체 2,665행 CSV 다운로드 시작 안내를 확인했다. 최근 기록 1→0 삭제가 레일과 패널에 동기화됐으며 레일·푸터 진입, 같은 클릭에서 열림 유지, Escape 후 호출 버튼 복귀, 빈 패널의 바깥 클릭, 맨 위로의 제목 초점, 모바일 검색을 확인했다. 대시보드·상세는 기존 푸터를 유지했다. 최종 콘솔 error/warn은 없었다.

정리 전후 측정 JSON·보존 해시·화면은 Git ignore 대상 `.impeccable/review/2026-11-02-ranking-cleanup/`의 로컬 근거다. 임시 서버·탭을 종료하고 화면 크기와 테마를 복원했다. 전체 정적 export·실기기·스크린리더 발화·운영 배포는 이번에 검증하지 않았다.
