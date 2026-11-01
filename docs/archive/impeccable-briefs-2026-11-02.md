# 초기 Impeccable brief 보존 — 2026-11-02

현행 surface를 갱신하기 전의 두 brief다. 본문은 2026-10-05 황금 전광판·메인 복구 단계의 계약과 상태를 담고 있으며 현재 구현 지침이 아니다.
랭킹 surface 본문과 `.impeccable/implementation-brief.md`는 동일했으므로 한 벌만 보존한다.
나눔명조·300px 레일·중립 이동량·요약 우선·거래량 없음·일곱 지표 메뉴 금지 등은 후속 사용자 결정과 실제 구현으로 대체됐다.
현재 기준은 [PRODUCT](../../PRODUCT.md), [DESIGN](../../DESIGN.md), [랭킹 surface](../../.impeccable/surfaces/app-market-page-tsx.md), [대시보드 surface](../../.impeccable/surfaces/app-dashboard-page-tsx.md)다.
아래 인라인 경로는 원문의 저장소 루트 기준이며 과거 시안·검증 범위를 현재 완료 상태로 재사용하지 않는다.

## 랭킹 surface와 중복 implementation brief

기존 surface metadata:

```yaml
version: 1
slug: "app-market-page-tsx"
primary_target: "app/(market)/page.tsx"
related_targets: ["app/company/[secCode]/marketcap/page.tsx","app/security/[secCode]/marketcap/page.tsx","app/dashboard/page.tsx"]
```

# 황금 전광판 구현

Scope: 기존 국내 주식 조회 서비스의 ranking/detail/dashboard. Visitor mode: Operate. 구현 근거는 사용자 확정 white-shell 시안과 docs/ui-implementation-plan-2026-10-05.md. 실제 서버 데이터·URL·지표 공식과 전체 랭킹 탐색을 보존한다.

## Direction contract

THESIS: 큰 현재 순위와 중립 이동량을 하나의 읽기 단위로 보여주고, 넓은 화면에서는 조회 목록과 최근·기준 정보를 나란히 제공한다.

OWN-WORLD: 실제 나눔명조800의 빨강 ‘천하제일’/금색 ‘단타대회’ 사이 원본 별 SVG. 화이트 본문과 옅은 중립 레일, 다크 중립 표면. 금색은 브랜드·선택·다운로드, 빨강/파랑은 주가, 중립은 순위 이동이다.

STORY: 지표 메뉴 → 전체 순위 → 기업 합산 또는 실제 종목 상세 → 다른 지표/보통주·우선주 비교 → 전체 CSV. 최근 기록으로 마지막 지표에 돌아온다. 검색은 실제 상세로 이동한다.

FIRST VIEWPORT: 데스크톱은 로고/메인·랭킹/검색/고정 크기 테마 버튼, 그 아래 7개 지표. 본문 제목·기준일·전체 CSV와 큰 순위 표, 우측 300px 최근·기준 패널. 모바일은 전체 로고·검색·지표 뒤 중앙축의 순위 묶음과 값 아래 추이. 상세는 요약 아래 로컬 지표 메뉴와 실제 차트다.

FORM: 사용자 선택 A ‘황금 전광판’, 최신 white-shell 비교와 라이트·다크 캡처. 기존 선택을 구현하는 작업으로 새 seed 추첨은 적용하지 않는다. 시안의 예시 날짜·행 수·PNG 좌표는 데이터 계약이 아니다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 대시보드 surface

기존 surface metadata:

```yaml
version: 1
slug: "app-dashboard-page-tsx"
primary_target: "app/dashboard/page.tsx"
related_targets: ["components/MarketTrends.tsx", "app/dashboard/loading.tsx"]
```

# 메인: 한눈에 보는 기업 규모와 주가 흐름

Visitor mode: Operate. 사용자 지적에 따른 계획 대조에서 메인 전용 구조 기준이 누락됐고, 긴 TOP 10 목록이 기존 요약·주가 흐름을 밀어냈음을 확인했다. 승인 계획 5절의 4단계가 요구한 기존 메인 역할 보존을 이번 수정의 기준으로 삼는다.

THESIS: 메인에서 조회 범위와 주요 기업을 파악하고 실제 전체 랭킹 또는 종목 상세로 이동한다. 전체 목록을 탐색하는 랭킹 화면과 정보 순서가 다르다.

OWN-WORLD: 승인된 황금 전광판의 로컬 나눔명조·별 SVG, 화이트 본문·옅은 회색 300px 레일, 같은 다크 토큰을 사용한다. 요약은 그림자·장식 아이콘 없는 열린 숫자·텍스트 구획이다.

STORY: 검색 또는 요약 → 상위 기업 내 상승·하락·거래량 탭 → 시총 TOP 5 → 전체 시총 순위 또는 기업/종목 상세. 메인에 7개 지표 독립 메뉴를 추가하지 않는다. 전체 지표 선택은 랭킹에서 한다.

FIRST VIEWPORT: 제목·시총/가격의 별도 기준일 → 실제 조회 기업 수·시총 1위·조회 상위 기업 내 상승/하락 1위. 1024px부터 주가 흐름과 TOP 5 미리보기를 본문 안 2열로 배치한다. 1280px부터 같은 위치의 최근·조회 기준 레일을 사용한다. 모바일은 요약 2×2 → 주가 흐름 → TOP 5로 쌓고 총수를 본문에 유지한다.

DATA: getCompanyMarketcapsPage(1) 한 번의 기존 조회를 유지한다. totalCount는 실제 전체 모집단, 등락은 반환된 상위 기업들의 대표 보통주만 비교한다. 전체 시장 등락 1위라 주장하지 않는다. 없는 가격은 0원으로 만들지 않는다. 조회에 거래량이 없으므로 거래량 탭은 사실을 설명하는 빈 상태다. 가짜 뉴스·없는 목적지는 추가하지 않는다.

FINISH: 계획 대조, 실제 모바일·태블릿·데스크톱 두 테마 캡처, 기능 회귀 확인과 독립 검토 후 판정한다. 테스트 통과만으로 디자인 완료라 표시하지 않는다.
