---
version: 1
slug: "app-market-page-tsx"
primary_target: "app/(market)/page.tsx"
related_targets: ["app/company/[secCode]/marketcap/page.tsx","app/security/[secCode]/marketcap/page.tsx","app/dashboard/page.tsx"]
---

# 황금 전광판 구현

Scope: 기존 국내 주식 조회 서비스의 ranking/detail/dashboard. Visitor mode: Operate. 구현 근거는 사용자 확정 white-shell 시안과 docs/ui-implementation-plan-2026-10-05.md. 실제 서버 데이터·URL·지표 공식과 전체 랭킹 탐색을 보존한다.

## Direction contract

THESIS: 큰 현재 순위와 중립 이동량을 하나의 읽기 단위로 보여주고, 넓은 화면에서는 조회 목록과 최근·기준 정보를 나란히 제공한다.

OWN-WORLD: 실제 나눔명조800의 빨강 ‘천하제일’/금색 ‘단타대회’ 사이 원본 별 SVG. 화이트 본문과 옅은 중립 레일, 다크 중립 표면. 금색은 브랜드·선택·다운로드, 빨강/파랑은 주가, 중립은 순위 이동이다.

STORY: 지표 메뉴 → 전체 순위 → 기업 합산 또는 실제 종목 상세 → 다른 지표/보통주·우선주 비교 → 전체 CSV. 최근 기록으로 마지막 지표에 돌아온다. 검색은 실제 상세로 이동한다.

FIRST VIEWPORT: 데스크톱은 로고/메인·랭킹/검색/고정 크기 테마 버튼, 그 아래 7개 지표. 본문 제목·기준일·전체 CSV와 큰 순위 표, 우측 300px 최근·기준 패널. 모바일은 전체 로고·검색·지표 뒤 중앙축의 순위 묶음과 값 아래 추이. 상세는 요약 아래 로컬 지표 메뉴와 실제 차트다.

FORM: 사용자 선택 A ‘황금 전광판’, 최신 white-shell 비교와 라이트·다크 캡처. 기존 선택을 구현하는 작업으로 새 seed 추첨은 적용하지 않는다. 시안의 예시 날짜·행 수·PNG 좌표는 데이터 계약이 아니다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
