---
version: 1
slug: "app-dashboard-page-tsx"
primary_target: "app/dashboard/page.tsx"
related_targets: ["components/MarketTrends.tsx", "components/dashboard.module.css", "app/dashboard/loading.tsx", "app/dashboard/layout.tsx"]
---

# 메인: 대회 기록실

Scope: `/dashboard`. Visitor mode: Operate. [PRODUCT](../../PRODUCT.md)와 [DESIGN](../../DESIGN.md)의 B 대회 기록실을 따르며 전체 순위를 탐색하는 랭킹과 구별한다. 현재 구조는 실제 [페이지](../../app/dashboard/page.tsx)와 [모듈](../../components/dashboard.module.css)이 소유한다.

THESIS: 기업 규모와 대표 보통주의 흐름을 빠르게 파악한 뒤 전체 지표 순위·기업/종목 상세·CSV로 이동한다. 표본의 비교를 시장 전체 상승·하락·거래량 순위로 주장하지 않는다.

OWN-WORLD: 조선궁서 400·원본 별·빨강과 금색 브랜드, 흰 읽기 표면·짙은 잉크와 공통 다크 토큰을 사용한다. 실제 공통 한 줄 헤더와 세 단계 브랜드를 유지한다. 랭킹 전용 반응형 표·하단 목차·최근 미리보기를 대시보드에 확장하지 않는다.

STORY: 제목과 시가총액 공개 기준일·가격 관측일 → 기업 합산 시총 TOP 5와 전체 CSV → 일곱 지표별 순위 바로가기 → 상승·하락·거래량 탭 → 한눈에 보기다. 모바일은 이 DOM 순서로 쌓는다. 1024px 이상은 TOP 5와 주가 흐름을 두 열에 놓고 지표 바로가기를 그 아래 전체 폭에 둔다. 한눈에 보기의 네 수치는 768px 미만 두 열, 그 이상 네 열이다.

CONTEXT: 1280px 이상에서 248px 우측 레일에 기존 최근 기록과 조회 기준을 제공한다. 기업 합산/대표 보통주 범위와 공개 날짜/가격 관측일을 분리하며 자료 공개 정보에 revision과 대상을 둔다. 대시보드는 AppShell의 기본 SiteFooter와 기존 최근 패널을 유지한다.

DATA: `getCompanyRankingPage(1, expectedRevision)`의 공개 스냅샷으로 행을 만든다. TOP 5는 반환된 기업 합산 순위의 앞 다섯 기업이며 전체 수는 `totalCount`다. 상승·하락·거래량은 반환된 기업들의 대표 보통주 중 해당 값과 실제 링크가 있는 대상을 비교한다. 거래량은 실제 제공값을 정렬하며 없으면 탭의 빈 상태를 표시한다. 없는 가격을 0으로 만들지 않는다. 미공개·공개 0건·revision 변경을 구분하고 기업 전체 순위 링크와 CSV의 날짜·revision 계약을 유지한다.

FINISH: 변경 시 실제 표본 범위·모바일/데스크탑 두 테마·지표 링크·탭·상세·CSV·빈 상태를 확인한다. 과거 복구 시점의 검사 결과를 현재 검증으로 재사용하지 않는다. 대체된 요약 우선·거래량 없음·지표 메뉴 금지 brief는 [보존본](../../docs/archive/impeccable-briefs-2026-11-02.md)에 있다.
