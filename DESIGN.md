---
name: "천하제일 단타대회"
description: "황금 전광판 — 선명한 브랜드와 읽기 쉬운 국내 주식 지표"
colors:
  brand: "#f8ad02"
  brand-hover: "#ef9f00"
  brand-ink: "#a26300"
  brand-ink-dark: "#f8cd37"
  brand-red: "#dc3030"
  background: "#ffffff"
  background-dark: "#181a1c"
  foreground: "#181a1c"
  foreground-dark: "#f5f7f9"
  sidebar: "#f7f7f7"
  sidebar-dark: "#22292e"
  popover: "#ffffff"
  popover-dark: "#22292e"
  muted-foreground: "#59636b"
  muted-foreground-dark: "#cbd1d6"
  accent: "#f1f1f1"
  accent-dark: "#2c3237"
  border: "#e6e6e6"
  border-dark: "#343a40"
  input: "#d6d6d6"
  input-dark: "#495057"
  rank-neutral: "#66717d"
  rank-neutral-dark: "#d4dbe1"
  market-up: "#dc3030"
  market-up-dark: "#f06a68"
  market-down: "#1d5fbf"
  market-down-dark: "#77a9fa"
  chart-volume: "#738c76"
  chart-volume-dark: "#97b99b"
  destructive: "#b42318"
  destructive-dark: "#ff8b82"
typography:
  display:
    fontFamily: "var(--font-brand), serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  display-mobile:
    fontFamily: "var(--font-brand), serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  display-compact:
    fontFamily: "var(--font-brand), serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline-mobile:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline-strong:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  headline-strong-mobile:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "15px"
  body-small:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  rank:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.025em"
  rank-mobile:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  value:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  action: "5px"
spacing:
  compact: "4px"
  control-gap: "8px"
  row-gap: "12px"
  mobile-gutter: "16px"
  section-gap: "20px"
  tablet-gutter: "24px"
  desktop-gutter: "32px"
components:
  brand-wordmark:
    typography: "{typography.display}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  ranking-download:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.action}"
    padding: "8px 14px"
    height: "40px"
  ranking-download-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.foreground}"
  theme-trigger:
    rounded: "{rounded.md}"
    padding: "8px"
    width: "40px"
    height: "40px"
  theme-trigger-desktop:
    rounded: "{rounded.md}"
    padding: "8px"
    width: "96px"
    height: "40px"
  search-field:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 0"
    height: "48px"
  metric-navigation:
    textColor: "{colors.muted-foreground}"
    padding: "0 16px"
    height: "48px"
  period-chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  period-chip-selected:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  detail-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    padding: "8px"
  ranking-position:
    textColor: "{colors.rank-neutral}"
    typography: "{typography.rank}"
    padding: "0"
  ranking-position-first:
    textColor: "{colors.brand-ink}"
    typography: "{typography.rank}"
    padding: "0"
  history-observation:
    textColor: "{colors.foreground}"
    typography: "{typography.body-small}"
---

# Design System: 천하제일 단타대회

## Overview

**Creative North Star: "황금 전광판"**

전체 이름과 원본 별 아이콘이 만드는 레트로의 재미를, 차분한 숫자와 넓은 중립 표면 위에 놓는다. 빨강 ‘천하제일’과 금색 ‘단타대회’는 실제 나눔명조 ExtraBold로 이어지고, 조회 화면은 한국어 산세리프와 표 형태의 행으로 읽힌다.

순위·종목명·값을 먼저 읽을 수 있는 밀도를 유지한다. 라이트는 화이트 본문과 옅은 중립 레일, 다크는 어두운 중립 본문과 한 단계 밝은 레일로 구성한다. 금색 선택과 다운로드, 중립 순위 이동, 빨강·파랑 가격 등락이 각각 의미를 가진다.

**Key Characteristics:**

- 전체 이름·원본 별 SVG·실제 나눔명조800의 브랜드 조합.
- 화이트 본문과 중립 보조 레일을 공유하는 조회 화면.
- 큰 현재 순위와 작은 중립 이동량을 한 묶음으로 읽는 숫자 위계.
- 선과 표면색 중심의 깊이, 짧은 상태 전환, 실제 데이터에 맞는 차트와 상태 화면.

이 문서는 승인된 황금 전광판 세계를 유지하며 최종 수정 소스에서 추출한 구현 기록이다. 색·타입·폭의 기준은 `app/globals.css`, 로고 폰트와 테마 기본값은 `app/layout.tsx`, 행과 상세의 상태는 해당 구성 요소에서 확인했다. 방향의 근거는 `PRODUCT.md`, `docs/ui-implementation-plan-2026-10-05.md`, `.impeccable/surfaces/app-dashboard-page-tsx.md`다. 메인의 구체적인 정보 순서는 해당 surface brief에 둔다.

`.impeccable/design.json`의 열 가지 HTML/CSS/SVG 표본은 실제 구성 요소의 재료와 상태를 독립적으로 보여준다. 표본의 숫자·날짜는 구성 예시이며 조회 결과나 검증 증거가 아니다. 이 추출은 스크린샷 검사·접근성 검사·전체 구현 계획의 완료를 판정하지 않는다.

## Colors

금색과 빨강의 브랜드에 중립 조회 표면을 결합하며, 데이터 색은 각 의미에 맞게 분리한다. 모든 실제 값은 위 frontmatter가 소유한다. `-dark` 값은 해당 역할의 다크 변형이며, CSS의 `.dark` 선언이 화면에 적용한다.

sidecar의 tonal ramp는 패널에서 색의 성격을 살펴보는 합성 미리보기다. 제품에 적용할 추가 색 토큰이나 별도 테마 팔레트가 아니다.

### Primary

- **전광판 금색 — `brand`:** 로고 후반, 활성 지표의 밑줄, 주요 다운로드와 선택된 기간 버튼.
- **읽는 금색 — `brand-ink` / `brand-ink-dark`:** 금색 계열 텍스트, 1위 숫자, 활성 모바일 탐색, 포커스 링. 밝은 금색 배경과 텍스트용 금색을 구분한다.
- **다운로드 호버 금색 — `brand-hover`:** 전체 순위 CSV의 포인터 상태.

### Secondary

- **브랜드 빨강 — `brand-red`:** 로고 전반과 원본 별 내부. 브랜드 의미로 사용하며 테마 전환 때 로고의 색 구성을 바꾸지 않는다.
- **가격 상승 빨강 — `market-up` / `market-up-dark`:** 주가 등락과 가격 방향에 맞춘 선·캔들.
- **가격 하락 파랑 — `market-down` / `market-down-dark`:** 하락 등락과 가격 방향에 맞춘 선·캔들. 지표의 일반 선 색은 별도 차트 시리즈 역할로 파랑을 사용할 수 있다.
- **거래량 녹색 — `chart-volume` / `chart-volume-dark`:** 거래량 시리즈의 보조색.
- **오류 빨강 — `destructive` / `destructive-dark`:** 오류·유효하지 않은 입력 등 파괴적 상태의 별도 의미.

### Neutral

- **본문 — `background` / `background-dark`:** 헤더·주 영역·상세 카드가 공유하는 바탕.
- **본문 잉크 — `foreground` / `foreground-dark`:** 이름·현재 값·주요 제목.
- **옅은 레일 — `sidebar` / `sidebar-dark`:** 최근 본 종목, 조회 기준과 상세 보조 정보. 중립 muted 표면에도 같은 계열을 사용한다.
- **떠 있는 정보 — `popover` / `popover-dark`:** 검색 명령창·최근 패널·순위 설명. 다크에서는 본문보다 한 단계 밝은 레일 계열 표면을 쓴다.
- **보조 잉크 — `muted-foreground` / `muted-foreground-dark`:** 기준일·종목코드·단위·작은 설명·순위 이동량.
- **상호작용 표면 — `accent` / `accent-dark`:** 보조 버튼과 메뉴의 호버·선택 상태.
- **구분선 — `border` / `border-dark`:** 표 행·영역·레일 경계.
- **입력 경계 — `input` / `input-dark`:** 검색 진입 버튼과 입력 컨트롤.
- **순위 잉크 — `rank-neutral` / `rank-neutral-dark`:** 일반 현재 순위. 1위만 읽는 금색으로 강조한다.

**The Separate Signals Rule.** 순위 이동은 중립 화살표와 이동한 계단 수로 표시한다. 주가의 빨강·파랑 등락 색을 순위 이동에 적용하지 않는다.

## Typography

**Display Font:** 로컬 나눔명조 ExtraBold (800), `--font-brand`와 serif fallback. `app/fonts/brand-nanum.woff2`는 헤더 브랜드 글자에 사용하는 실제 폰트이며 `app/fonts/OFL.txt`를 함께 보존한다.

**Body Font:** Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif.

**Character:** 명조 브랜드는 레트로의 개성을 담당한다. 데이터·설명·탐색은 한국어 산세리프, 보통 굵기의 메타데이터와 tabular numerals로 읽기 속도를 유지한다.

### Hierarchy

- **Display:** 전체 워드마크는 작은 화면의 `display-compact`, 390px 이상 `display-mobile`, 768px 이상 `display`를 사용한다. 글자는 합성 굵기를 사용하지 않으며 원본 별은 같은 줄의 중앙에 놓는다.
- **Headline:** 순위 제목은 `headline-mobile`에서 `headline`으로 바뀐다. 상세 회사·종목명은 같은 크기 관계로 표시하고, 스크롤에 고정되면 더 작은 이름으로 줄인다. 대시보드 주 제목은 `headline-strong-mobile` / `headline-strong`의 더 굵은 강조를 쓴다.
- **Title:** 공통 영역 제목은 `title`; 상세 내부 제목은 같은 크기의 semibold(600)도 사용한다.
- **Body:** 기본은 `body`. 표 이름과 핵심 작은 제목은 중간 굵기(600), 설명과 요약은 `body-small`을 사용한다.
- **Label:** 코드·날짜·단위는 `label` 계열. 모바일의 작은 코드와 이동량은 11px까지 줄이며 주 이름과 숫자 위계는 유지한다.
- **Rank / Value:** 현재 순위는 `rank`, 모바일은 `rank-mobile`; 자릿수가 늘면 순위 크기를 줄여 열을 보존한다. 데스크톱 주요 값은 `value`이며 모바일에서는 사용 가능한 폭에 따라 줄어든다.

**The One Rank Unit Rule.** 현재 순위와 이동량은 한 읽기 단위다. 데스크톱에서는 옆으로, 모바일에서는 같은 중심축 위아래로 배치하며 숫자와 화살표를 분리된 배지로 만들지 않는다.

## Layout

공통 컨테이너는 전체 폭 안에서 중앙에 놓이며 최대 폭(1600px)을 갖는다. 좌우 여백은 모바일(16px), 768px 이상(24px), 1280px 이상(32px)이다. 순위·회사 상세·종목 상세·대시보드는 1280px 이상에서 유연한 주 영역과 고정 보조 레일(300px)을 공유한다. 주 영역 오른쪽 여백과 레일 내부 여백으로 두 영역을 나누며, 레일은 헤더 아래에서 고정되어 화면 높이를 넘으면 자체 스크롤한다.

헤더는 실제 높이를 측정해 스크롤 오프셋에 반영한다. 모바일에서는 로고·최근·테마가 첫 줄, 전체 폭 검색이 둘째 줄이다. 768px 이상에는 메인/랭킹이 나타나고, 1024px 이상에서 검색이 헤더의 같은 줄에 들어간다. 1280px 이상에는 최근 기록이 레일에 있으므로 헤더의 최근 진입이 숨겨진다. 작은 화면에서는 메인·랭킹·검색이 하단 고정 탐색에 이어지고 safe-area 여백을 확보한다.

순위 지표 탐색은 일곱 항목의 수평 스크롤 메뉴다. 상세에는 해당 회사·종목 문맥을 유지하는 별도 지표 탐색이 요약 아래에 있다. 데스크톱 표는 순위·이름·추이·값·등락으로 읽고, 1000px 미만에서는 추이를 값 아래로 옮긴다. 768px 미만에서는 전체 행 폭의 모바일 표를 사용한다. 행 높이(76px)를 유지하고, 이름과 코드는 왼쪽, 값과 등락은 오른쪽으로 정렬한다.

주 화면은 큰 카드의 반복보다 열린 행과 구분선으로 구성한다. 상세 요약은 작은 화면의 두 열에서 640px 이상 네 열로 확장한다. 공통 요약·미리보기 구획도 열린 숫자와 텍스트를 사용하며, 대시보드 요약은 768px 이상 네 열로 바뀐다. 상세 섹션과 차트는 주 영역 안에서 이어지고, 보조 정보는 레일 또는 문맥별 접기 영역에 배치한다. 사용 가능한 폭이 달라져도 전체 이름, 실제 탐색 링크, 날짜와 단위를 유지한다.

## Elevation & Depth

주 영역은 평평한 중립 표면과 얇은 경계선으로 구분한다. 레일의 다른 표면색은 보조 정보의 위치를 드러낸다. 그림자는 떠 있는 최근 패널·순위 설명·차트 툴팁처럼 앞에 놓인 정보에 사용하며, 일부 기존 카드와 선택된 기간 컨트롤의 작은 그림자도 유지한다. 주요 조회 섹션을 부유 카드로 바꾸는 규칙은 없다.

### Shadow Vocabulary

- **최근 패널:** `0 12px 28px #00000018` — 좁은 화면의 헤더에서 열리는 최근 기록.
- **순위 설명:** `0 4px 14px #0002` — 순위 이동의 기준을 설명하는 팝오버.
- **히트맵 툴팁:** `0 4px 12px rgb(0 0 0 / 0.14)` — 차트 데이터에 연결된 툴팁.
- **작은 카드·선택 컨트롤:** `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` — 공통 카드와 일부 선택 기간의 기존 작은 깊이.

**The Stable Theme Slot Rule.** 테마 진입은 768px 미만(40×40px), 그 이상(96×40px)의 고정 크기를 유지한다. sun/moon은 동일한 20×20px grid 슬롯에 겹치고 라벨도 같은 슬롯에서 바뀐다. 아이콘이나 테마 이름의 교체 때문에 검색과 인접 컨트롤이 이동해서는 안 된다.

테마 아이콘은 짧은 opacity 전환(150ms, ease-out)으로 같은 슬롯 안에서 바뀐다. 일반 버튼·상세 지표 탭·기간 선택은 짧은 색 전환을 사용한다. 테마 적용 자체는 전환 애니메이션을 끄며, reduced-motion에서는 애니메이션과 전환을 즉시 종료한다.

## Shapes

본문의 표·구분선·상세 데이터 영역은 직선형이다. 컨트롤은 작은 모서리 반경을 사용하고, 다운로드·페이지 이동에는 `action`, 일반 버튼·탐색에는 `md`, 열린 최근 패널과 툴팁에는 `lg`를 사용한다. `sm`은 작은 상태 컨트롤과 목록에 사용한다. 큰 알약형 브랜드 컨테이너나 반복되는 둥근 데이터 카드는 구현된 형태가 아니다.

원본 별 SVG의 둥근 외곽·검은 윤곽·빨간 별은 브랜드 자산의 일부다. 본문의 형태 규칙을 이유로 이 아이콘을 새로 그리거나 윤곽을 제거하지 않는다.

## Components

### Buttons

작고 단단한 작업 컨트롤이다. 공통 버튼은 primary·outline·ghost 변형을 가지며 기본 높이(40px), 중간 굵기(500), `md` 반경을 사용한다. 전체 순위 CSV는 금색 바탕·어두운 글자·`action` 반경·굵기(600)으로 강조하고 모바일에서는 패딩을 줄인다. 보조 작업과 페이지 이동은 경계선 또는 텍스트를 사용한다. 포커스는 테마에 맞는 링이나 외곽선, 비활성은 불투명도와 클릭 차단으로 보인다.

랭킹 CSV의 기본 안내는 ‘전체 순위 · 엑셀에서 열 수 있어요’다. 요청 중에는 ‘준비 중…’과 진행 상태를, 오류에는 오류색의 재시도 안내를 보여준다. 파일 응답 뒤에는 ‘다운로드 시작’과 전체 행 수를 알리며, 화면과 파일의 기준이 달라지면 안내와 ‘화면 새로고침’을 함께 둔다. 사용자 디스크의 저장 완료를 주장하는 문구로 바꾸지 않는다. 상세 CSV는 전체 유효 이력을 내려받는 outline 버튼이며 원본 결측과 실제 0을 구분한다. 지표 이력이 없는 정상 빈 상세에서는 다운로드를 제공하지 않는다.


### Chips

기간 선택과 최근 목록의 정렬처럼 실제 상태 변경에 사용한다. 기간 선택은 작은 사각 버튼이며 선택된 항목만 금색 바탕·어두운 글자·작은 그림자를 쓴다. 최근 정렬은 레일 위에서 선택된 항목을 본문색 바탕과 굵은 글자로 드러낸다. 회사 구분·종목 종류는 상세 제목 아래의 조용한 텍스트이며 새 배지 형태를 요구하지 않는다.

### Cards / Containers

차트와 상세 데이터 컨테이너는 본문색·단일 경계선의 직선형 영역이며 일반적으로 그림자가 없다. 내부 패딩은 모바일에서 작게, 넓은 화면에서 늘린다. 기존 공통 카드가 사용되는 곳은 `lg` 반경과 작은 그림자를 유지한다. 최근 종목은 별개의 큰 카드 대신 경계선 있는 목록과 구분된 행을 사용한다.

### Inputs / Fields

헤더 검색 진입은 높이(40px)의 outline 버튼으로 전체 사용 가능 폭을 차지한다. 검색어 입력은 실제 명령창 안의 검색 아이콘·하단 경계선·placeholder를 가진 필드다. 포커스와 선택된 결과는 테마의 링·accent 표면으로 표시한다. 로딩·검색 실패·빈 결과는 그 위치에서 읽을 수 있는 상태 문구와 필요한 재시도 버튼을 제공한다. 검색 결과는 실제 회사 또는 종목 상세로 연결한다.

### Navigation

메인/랭킹은 작업 영역을 구분하며 활성 항목은 본문 잉크 바탕과 역색 글자를 가진 작은 사각 컨트롤이다. 순위의 일곱 지표는 금색 하단선(3px), 활성 글자와 굵기로 선택을 나타낸다. 상세 지표는 해당 회사·종목 문맥의 URL을 유지하는 얇은 하단선(2px)으로 구분한다. 수평 스크롤 메뉴는 항목을 줄바꿈해 여러 줄의 버튼 벽으로 만들지 않는다. 작은 화면의 하단 탐색은 현재 위치를 읽는 금색으로 표시한다.

### Brand Wordmark

전체 ‘천하제일’ + 원본 별 + ‘단타대회’를 한 줄의 실제 링크로 제공한다. 명조 글자는 실제 굵기(800)와 얇은 어두운 외곽선(0.25px)을 사용하며, 별의 외곽·타원·빨간 path는 `public/icon.svg`를 그대로 보존한다. 글자 크기(20/22/26px)에 맞춰 별 크기(23/25/28px)와 간격(4/6px)이 바뀐다. sidecar 표본은 같은 SVG를 inline으로 담아 이미지 경로에 의존하지 않는다.

테마 메뉴는 라이트·다크·기기 설정의 세 선택을 표시한다. 처음 방문은 system이며 수동 선택은 `next-themes`의 저장 상태로 이어진다. 헤더의 sun/moon과 라벨은 현재 표시되는 테마를, 메뉴의 체크는 선택한 설정을 나타낸다.

### Ranking Position

큰 현재 순위와 작은 중립 이동량이 한 컨트롤이다. 1위는 읽는 금색, 나머지는 순위 잉크를 쓴다. 이동량은 방향 SVG와 이동한 계단 수이며, 포인터·포커스·클릭으로 이전 순위와 현재 순위의 설명을 확인하고 Escape로 닫는다. 변화가 없으면 ‘유지’, 비교 정보가 없으면 이동량을 생략하고 현재 순위도 없으면 ‘—’를 표시한다. 데이터가 없는 이동량을 가격 등락으로 대신하지 않는다. 주식 이름은 상세 링크, 값 아래 작은 추이는 실제 이력으로 표시한다.

### Company History Observation

추이를 만들 수 없는 단일 날짜 회사 이력은 실제 값의 작은 텍스트·숫자 구획으로 표시한다. 이력 날짜와 기록 수, 등록된 시가총액 합계, 해당 날짜에 실제 값이 있는 종목별 금액을 표 형태로 읽는다. 없는 값은 ‘미등록’으로 표시하고 합계에서 제외한다. 선택한 종목이 있으면 그 행을 먼저 배치하고 굵기와 ‘선택 종목’ 라벨로 구분하며, 합산과 다른 종목에는 비교 라벨을 붙인다. 선택 종목의 해당 날짜 값이 없으면 이를 설명한다. 여러 날짜가 있을 때만 실제 이력 범위와 마지막 이력일을 기준으로 추이를 그린다.

회사 요약의 스냅샷 기준일, 주가의 거래일, 이력의 날짜·범위는 서로 다른 데이터 문맥으로 명시한다. 가격 차트를 회사 시가총액의 현재 스냅샷이나 이력으로 보이게 라벨링하지 않는다. 수치가 부족한 상태는 데이터의 한계를 설명하며 장식용 추이나 기간을 만들어 채우지 않는다.

현재 주가 변화는 같은 가격 레코드의 저장된 일간 등락률과 ‘전일 대비’를 함께 표시한다. 가격 또는 등락률이 없으면 ‘—’, 실제 0은 0으로 읽으며 희소한 두 기록을 일간 비교로 대신하지 않는다. 시총 snapshot 변화는 표시한 날짜·값이 이력에서 확인될 때만 이전 기록과 비교하고 그 날짜를 명시한다. 재무 지표의 평균 비교도 실제 비교 대상 평균을 값 가까이에 붙인다.

### Recent and Related Securities

최근 기록은 마지막으로 본 지표의 실제 종목 링크와 값·코드를 유지한다. 정렬과 개별·전체 삭제를 사용할 수 있으며, 저장된 항목이 없을 때는 조용한 안내를 표시한다. 보통주·우선주 비교는 해당 실제 종목의 행 링크, 현재 지표 값과 주가를 함께 읽게 한다. 선택된 종목은 약한 중립 표면으로 구분한다.

### Annual Data and Empty States

연간 데이터는 640px 이상 표로, 작은 화면에서는 연도별 행으로 제공한다. 모바일 행은 연도·값·전년 대비를 먼저 읽고 누르면 기준일과 상세 값을 펼친다. 최근 5년과 전체 펼침, 최신 표시, 원본 값 보조 문구는 같은 데이터 문맥을 유지한다. 수치가 없거나 유효한 비교값이 없는 상태는 ‘—’로 표시하며 없는 변화율을 만들어내지 않는다.

일반 빈 상태는 구분선 안의 짧은 제목·보조 설명·가능한 실제 링크로 구성한다. 차트 데이터 없음, 검색 로딩·오류·빈 결과, 최근 기록 없음, 지표 없음은 서로 다른 문구를 사용한다. 대시보드의 거래량 탭은 조회 데이터에 거래량이 없다는 사실을 설명한다. 상태를 채우기 위해 가짜 행·수치·추이를 추가하지 않는다.

존재하는 종목의 지표 이력 없음은 404가 아니다. 현재 값·개별 기준일·일곱 지표·기본 정보·회사 및 종목 탐색과 단일 헤더 복사·공유를 유지한다. 모바일 상세 헤더는 지표명을 제목 아래 줄에 놓아 고정 액션과 겹치지 않게 하고, 데스크톱은 제목 옆에 표시한다. 작은 화면의 시총 차트는 부모 폭 안에서 줄어들며 고정 최소 폭으로 문서를 넘기지 않는다.

## Do's and Don'ts

### Do:

- **Do** 전체 이름과 원본 별 SVG를 실제 나눔명조800의 빨강/금색 글자 사이에 유지한다.
- **Do** 라이트 본문을 화이트로 유지하고 최근·기준 정보를 옅은 중립 레일에 배치한다.
- **Do** 현재 순위와 중립 이동량을 한 묶음으로 정렬하고 가격 등락의 의미를 분리한다.
- **Do** 고정 테마 버튼·아이콘·라벨 슬롯을 유지하고 기기 기본 테마와 저장된 사용자 선택을 이어간다.
- **Do** 숫자에는 tabular numerals, 기준일·단위에는 읽을 수 있는 보조 글자를 사용한다.
- **Do** 실제 데이터와 날짜에 맞춰 차트·등록 값·빈 상태를 전환한다.
- **Do** 검색·최근 기록·일곱 지표·CSV를 작동하는 코드와 링크로 제공한다.

### Don't:

- **Don't** 빨강·파랑 가격 등락 색으로 순위 이동을 표시한다.
- **Don't** 모바일에서 순위와 이동량의 중심축을 어긋나게 하거나 서로 떨어진 배지로 만든다.
- **Don't** 테마 이름이나 아이콘 교체로 헤더 검색의 위치와 폭을 바꾼다.
- **Don't** 단일 날짜를 추이처럼 그리거나 미등록 종목을 0·추정값으로 채운다.
- **Don't** 스냅샷·가격·이력의 서로 다른 기준일을 같은 날짜로 암시한다.
- **Don't** 캡처 이미지나 래스터 오버레이를 실제 UI·텍스트·탐색 대신 사용한다.
