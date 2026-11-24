# 대회장·랭킹·상세 작업 정리 — 2026-11-24

이 문서는 작업 종료 시점의 저장소와 시안 보관 위치를 기록한다. 적용 기준은 연결된 현행 문서가 소유한다.

| 화면 | 읽을 기준 | 구현 진입점 |
| --- | --- | --- |
| 대회장 | [장면별 자료·기록실](../../.impeccable/surfaces/app-dashboard-page-tsx.md) | [페이지](../../app/dashboard/page.tsx), [장면 전환](../../components/dashboard-arena-player.tsx) |
| 랭킹 여덟 화면 | [지표 메뉴·표](../../DESIGN.md#ranking-metric-first), [하단](../../DESIGN.md#ranking-footer-and-ending) | [순위 페이지](../../components/ranking-page-view.tsx), [공통 표](../../components/server-table.tsx) |
| 헤더·검색·푸터 | [헤더](../../DESIGN.md#global-header), [검색·최근 본](../../DESIGN.md#search-recent-and-theme), [푸터](../../DESIGN.md#global-footer) | [공통 앱 구성](../../components/app-shell.tsx) |
| 기업·종목 상세 | [좌우 탐색](../../DESIGN.md#detail-navigation), [화면별 순서](../../.impeccable/surfaces/components-detail-surface-tsx.md#화면별-기본-펼침) | [상세 화면](../../components/detail-surface.tsx), [지표 이동·목차](../../components/detail-investor-navigation.tsx) |

## 대체된 시안과 옛 적용 기록

- 랭킹 여덟 화면의 종가·등락률은 추이선 밖에서 읽고 순위와 지표값은 표에서 바로 읽는다. 예전 오버레이와 랭킹 전용 푸터의 당시 결과는 [반응형 검증](../ranking-responsive-verification-2026-11-02.md)과 [하단 검증](../ranking-footer-verification-2026-11-02.md)에 있다.
- 대회장은 네 장면을 재생하며, 장면별 자료와 가치·배당 종합의 산정 범위를 [대회장 brief](../../.impeccable/surfaces/app-dashboard-page-tsx.md)에서 관리한다. 여러 전광판 후보와 애니메이션 실험은 당시 검토 자료다.
- 작업 중 만든 시안 HTML 16개와 시안 전용 스크립트 1개는 로컬 `.impeccable/archive/2026-11-24-session-ui-previews.zip`으로 옮겼다. Git에서 관리하는 제품 소스와 검증 테스트는 위 진입점에 있다. 필요하면 ZIP을 저장소 루트에 풀어 원래의 `.impeccable/preview/` 경로로 복원할 수 있다.

정적 출력과 공개 배포 상태는 각각 해당 실행의 결과를 확인한다. 기존 `out/`에서 본 화면은 [정적 빌드 안내](../static-export.md)의 생성 당시 입력과 소스를 기준으로 한다.
