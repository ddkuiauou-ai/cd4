---
name: "천하제일 단타대회"
description: "B 대회 기록실 — 진지한 궁서 제목과 탐색하는 국내 주식 기록"
colors:
  brand: "#e0a91b"
  brand-ink: "#906200"
  brand-ink-dark: "#f8cd37"
  brand-red: "#c61628"
  primary: "#f0cc62"
  primary-dark: "#f0cc62"
  primary-foreground: "#181a1c"
  primary-foreground-dark: "#181a1c"
  background: "#ffffff"
  background-dark: "#181a1c"
  foreground: "#111b2c"
  foreground-dark: "#f5f7f9"
  sidebar: "#ffffff"
  sidebar-dark: "#22292e"
  popover: "#ffffff"
  popover-dark: "#22292e"
  muted-foreground: "#506079"
  muted-foreground-dark: "#cbd1d6"
  muted: "#f7f7f7"
  muted-dark: "#22292e"
  accent: "#f1f1f1"
  accent-dark: "#2c3237"
  border: "#ccd3df"
  border-dark: "#343a40"
  input: "#aebcd0"
  input-dark: "#495057"
  rank-neutral: "#66717d"
  rank-neutral-dark: "#d4dbe1"
  market-up: "#dc3030"
  market-up-dark: "#f06a68"
  market-down: "#1d5fbf"
  market-down-dark: "#77a9fa"
  destructive: "#b42318"
  destructive-dark: "#ff8b82"
  record-rule: "#c61628"
  record-rule-dark: "#ef7b7d"
  selected: "#fff2bc"
  selected-dark: "#41351e"
  selected-border: "#c59220"
  selected-border-dark: "#d0a640"
  rank-first: "#a87500"
  rank-first-dark: "#efc65a"
  rank-second: "#c61628"
  rank-second-dark: "#f48c8c"
  rank-third: "#174dc6"
  rank-third-dark: "#8fb8ff"
  chart-volume: "#738c76"
  chart-volume-dark: "#97b99b"
typography:
  display:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  display-mobile:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  display-compact:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline-mobile:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline-strong:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline-strong-mobile:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
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
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  rank-mobile:
    fontFamily: "var(--font-display), Gungsuh, 궁서, AppleMyungjo, Batang, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  value:
    fontFamily: "Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  action: "3px"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.action}"
    padding: "8px 14px"
    height: "40px"
  ranking-download-hover:
    backgroundColor: "color-mix(in srgb, var(--primary), var(--foreground) 7%)"
    textColor: "{colors.primary-foreground}"
  theme-trigger:
    rounded: "{rounded.md}"
    padding: "8px"
    width: "40px"
    height: "40px"
  theme-trigger-desktop:
    rounded: "{rounded.md}"
    padding: "8px"
    width: "40px"
    height: "40px"
  search-field:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 0"
    height: "48px"
  metric-navigation:
    textColor: "{colors.foreground}"
    padding: "8px 4px"
    height: "44px"
  period-chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  period-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
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
    textColor: "{colors.rank-first}"
    typography: "{typography.rank}"
    padding: "0"
  history-observation:
    textColor: "{colors.foreground}"
    typography: "{typography.body-small}"
  entity-selector:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "12px 24px 12px 12px"
  entity-selector-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
  detail-navigation:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    padding: "8px 4px"
    height: "44px"
---

# Design System: 천하제일 단타대회

## Overview

**Creative North Star: "B 대회 기록실"**

숫자를 보러 왔다가 다른 종목도 구경하는 서비스다. 흰 읽기 표면, 짙은 남색 데이터, 진지한 궁서 제목, 빨강·금색 전체 이름과 원본 별, 색 있는 상위 세 순위, 얇은 빨강 괘선이 기록실의 성격을 만든다. 제목의 표정과 종목을 오가는 재미를 살리면서 필요한 숫자와 자료 기준에 바로 도달하게 한다.

이 문서는 사용자가 요청한 기존 시각 세계의 교체를 반영한다. 2026-10-14 공통 이미지 계약을 2026-10-21 실제 프런트엔드에 옮긴 규칙이며, 이전 ‘황금 전광판’의 굵은 나눔명조 로고·산세리프 제목·수평 스크롤 상세 탭을 새 기준으로 삼지 않는다. 시안에 남아 있는 코드 오타·중복 지표 메뉴·합성 숫자는 구현 사양이 아니다.

**Key Characteristics:**

- 공식 배포 원본 조선궁서 400을 사용하는 전체 로고·제목·큰 순위 숫자.
- 흰 바탕과 짙은 남색 잉크, 금색 선택, 빨강 구획선, 상위 세 순위의 금색·빨강·파랑.
- 기업 합산과 실제 모든 구성 종목을 먼저 보여주고, 선택한 대상 아래에 고정 순서의 지표 메뉴를 놓는 계층.
- 모바일 두 줄 헤더, 항상 보이는 대상 선택과 지표 메뉴, 공통 위치의 데스크톱 보조 레일.
- 실제 자료의 날짜·제공 상태·상장 기간을 유지하는 차트·표·CSV·빈 상태.

값의 기준은 `app/globals.css`, `app/layout.tsx`, `components/detail.module.css`, `components/ranking-view.module.css`다. 화면 구조는 `.impeccable/mocks/2026-10-09-screen-comps/revisions/2026-10-14-layout-unified/layout-contract.md`와 실제 구성 요소를 함께 따른다. 이 문서와 sidecar는 검증 완료나 사용자 수락을 선언하지 않는다. sidecar의 구성 예시는 조회 결과가 아니다.

## Colors

색의 실제 값은 frontmatter가 소유한다. `-dark`는 CSS `.dark` 역할의 값이다. 밝은 금색 `primary`는 작업 버튼, `brand`는 브랜드 장식, `brand-ink`는 읽는 금색으로 구분한다. sidecar의 8단계 tonal ramp는 현재 값에서 계산한 합성 미리보기이며 추가 제품 토큰이 아니다.

### Primary

- **기록실 금색 — `brand`:** 브랜드와 금색 장식의 기준.
- **작업 금색 — `primary`:** 주요 CSV·페이지 이동·선택 컨트롤. 호버는 현재 바탕과 잉크의 색 혼합이며 별도 고정 금색을 만들지 않는다.
- **읽는 금색 — `brand-ink`:** 로고 후반과 금색 계열 텍스트. 밝은 작업 버튼의 바탕색과 구분한다.
- **현재 대상 — `selected` / `selected-border`:** 기업·구성 종목 중 현재 대상에만 적용하는 옅은 금색 바탕과 경계.

### Secondary

- **브랜드 빨강 — `brand-red`:** 로고 전반. 원본 별 SVG 자체의 기존 색과 윤곽은 자산 그대로 보존한다.
- **기록 괘선 — `record-rule`:** 섹션 시작, 활성 탐색의 밑줄과 기록 구획.
- **상위 세 순위 — `rank-first` / `rank-second` / `rank-third`:** 각각 금색·빨강·파랑. 순위 숫자의 식별색이며 수익률을 뜻하지 않는다.
- **가격 등락 — `market-up` / `market-down`:** 부호 있는 가격 등락과 가격 방향을 나타내는 빨강·파랑. 주가 절대값은 기본 잉크로 읽는다. 일반 지표 차트의 파랑 선은 시리즈 구분 역할이다.
- **거래량 — `chart-volume`:** 가격 이력의 보조 시리즈.
- **오류 — `destructive`:** 실패와 유효하지 않은 입력을 표현한다.

### Neutral

- **읽기 표면 — `background`:** 헤더·본문·상세 데이터의 흰 바탕. 다크는 어두운 중립 바탕이다.
- **데이터 잉크 — `foreground`:** 이름·값·제목의 짙은 남색. 다크에서는 밝은 중립 잉크다.
- **레일·임시 표면 — `sidebar` / `popover`:** 라이트는 흰 바탕과 경계선, 다크는 본문보다 밝은 중립 표면이다.
- **보조 잉크 — `muted-foreground`:** 종목코드·단위·기준일·설명·순위 이동량.
- **일반 경계 — `border` / `input`:** 표 행과 레일, 입력의 경계를 나눈다. `accent`는 보조 호버 표면이다.
- **순위 보조 잉크 — `rank-neutral`:** 중립 순위 정보에 쓴다. 일반 현재 순위 숫자는 본문 잉크로 읽으며 상위 세 숫자만 별도 색을 쓴다.

**The Separate Signals Rule.** 현재 순위의 식별색, 중립 화살표·이동 계단 수, 부호 있는 가격 등락은 서로 다른 의미다. 순위가 오르거나 내렸다는 이유로 이동량을 가격의 빨강·파랑으로 칠하지 않는다.

## Typography

**Display Font:** 공식 ZIP 원본 `app/fonts/ChosunGs.ttf`의 조선궁서체 400. `next/font/local`이 `--font-records`를 제공하고 `--font-display`가 Gungsuh·궁서·AppleMyungjo·Batang·serif fallback을 잇는다. 로고·페이지/섹션 제목·큰 현재 순위는 `font-synthesis: none`을 사용한다. 굵은 블록형 글자로 궁서의 표정을 대체하지 않는다.

원본 파일은 약 9.3MB이며 내용 변경·서브셋·포맷 변환 없이 보관한다. `display: swap`, `preload: false`로 설정했다. 공식 이용 조건과 배포 URL은 `app/fonts/ChosunGs-LICENSE.md`에 보존한다. 나눔명조용 `app/fonts/OFL.txt`와 별개의 라이선스다. 기존 `brand-nanum.woff2`는 로고 아홉 글자 subset이므로 제목용 전체 한글 글꼴이 아니다.

**Body Font:** Apple SD Gothic Neo, Malgun Gothic, system-ui, sans-serif. 설명·탐색·표의 값은 산세리프와 tabular numerals로 읽는다.

### Hierarchy

- **Display:** 로고는 390px 미만 24px, 그 이상 26px, 768px 이상 32px. 원본 별은 26/28/32px로 같은 줄에 놓인다. 글자 두께는 400, 자간은 -0.035em이다.
- **Headline:** 공통 페이지 제목은 모바일 28px, 768px 이상 38px의 궁서 400. 순위·상세의 제목 크기는 각 화면 모듈의 폭에 맞는 clamp를 따른다. 기존 `headline-strong` 토큰도 400이며 새 굵은 대체 글꼴을 뜻하지 않는다.
- **Title:** 공통 섹션 제목은 22px 궁서 400. 레일과 내부 소제목은 18–20px 범위의 해당 구성 요소 규칙을 따른다.
- **Body / Label:** 본문 15px, 작은 본문 14px, 코드·단위·기준일 12px 계열. 좁은 표의 보조 정보는 11px까지 사용한다.
- **Rank / Value:** 순위 숫자는 궁서 400이며 데스크톱 38px를 기준으로 자릿수가 늘면 줄인다. 일반 주요 값은 산세리프 20px/700, 상세의 주 값은 해당 요약 배치에 맞춰 크기를 조절한다.

### Intentional Screen Steps

frontmatter는 공통 위계를 정의하며 각 데이터 화면의 모든 보조 크기를 새 전역 토큰으로 만들지 않는다. `components/dashboard.module.css`, `components/ranking-view.module.css`, `components/detail.module.css`의 10–11px는 코드·관측일·CSV 부연·현재 표시처럼 종속된 정보, 13–16px는 탐색·표의 이름과 값, 18–22px는 내부 제목과 값의 중간 위계에 사용한다. 작은 보조 글자로 주요 이름·현재값·필수 행동을 대신하지 않는다.

페이지 제목은 순위의 `clamp(28px,3.2vw,44px)`와 메인의 `clamp(30px,3.6vw,48px)`처럼 화면 폭과 정보량에 맞춘 연속 크기를 쓴다. 로고의 24/26/32px, 공통 제목의 28/38px, 순위의 자릿수별 크기와 상세 주 값의 clamp는 서로 목적이 다르다. 순위 숫자와 큰 값의 폭이 바뀌어도 열 정렬·행 높이·숫자 식별을 유지한다. 화면별 단계는 해당 모듈이 소유하며 단일 굵은 제목 스타일로 합치지 않는다.

**The One Rank Unit Rule.** 현재 순위와 이동량은 하나의 읽기 단위다. 데스크톱에서는 옆으로, 모바일에서는 같은 중심축 위아래로 놓는다. 숫자와 이동 화살표를 떨어진 배지로 만들지 않는다.

## Layout

공통 컨테이너의 최대 폭은 1504px이며 좌우 여백은 모바일 16px, 768px 이상 24px, 1280px 이상 32px다. 1280px 이상 순위·상세·메인은 유연한 본문과 248px 우측 레일을 공유한다. 레일은 최근 본·조회 기준·본문 순서와 맞는 목차를 이어준다. 최근 본에는 순위 번호를 붙이지 않고 별도 중복 지표 메뉴를 만들지 않는다.

### Global Header

모바일 첫 줄은 전체 로고와 메뉴, 둘째 줄은 검색·최근 본·테마다. 메인·랭킹·검색은 하단 탐색 한 곳에서 제공하고 safe-area를 확보한다. 768px 이상에는 헤더의 메인·랭킹이 나타나며 하단 탐색은 숨긴다. 1100px 이상에는 전체 로고 / 메인·랭킹 / 검색 / 최근 본 / 테마가 한 줄에 놓인다. 데스크톱 레일이 있어도 헤더의 최근 본 진입은 유지한다.

### Page Order

1. 메인은 기업 합산 TOP 5, 대표 종목의 실제 주가 흐름, 전체 지표 순위 진입과 CSV를 중심으로 탐색을 시작한다. 흐름 표본의 실제 범위를 설명하며 시장 전체 상승률 순위라고 주장하지 않는다.
2. 순위는 기업 합산/종목 범위와 시장·공개 기준일 → 일곱 지표 → 같은 지표의 전체 순위표·CSV → 페이지 이동 순서다. 기업 합산과 대표 보통주 값을 같은 것으로 다루지 않는다.
3. 상세는 경로·기준일과 이름/종류/코드/거래소 → 기업·구성 종목 선택 → 페이지/지표 메뉴 → 현재값·순위 → 기간·차트·기록 → 연도별 자료·전체 이력 CSV·자료 기준·인접 순위다. PER 분포, 시총 구성 비교, BPS 연말, DPS 금액 등 각 본문의 차이를 유지한다.

### Companion Records

현재 구현은 1024px 이상에서 06 기업 합산 시총과 08 종목 시총의 현재 요약·같은 기업 종목 비교를 두 열에 나란히 놓고, 주요 시총 이력을 바로 아래에서 전체 폭으로 이어간다. 07 종목 기본 정보는 첫 행에 현재 주가·거래 정보와 종목 비교, 둘째 행에 실제 주가 이력과 기업 정보, 그 아래에 종목 기본 정보를 배치한다. 한 열 화면의 DOM 읽기 순서는 현재값 → 종목 비교 → 주가 이력 → 기업·기본 정보이며 상장 기간·이름 변경 접근은 핵심 기록 아래에 둔다. 비교할 실제 구성 종목이 없는 대상은 빈 비교 칸을 만들지 않는다.

기본 정보의 주가 이력도 실제 제공 가격 기록을 사용한다. 최적화된 정적 화면은 공유 가격 자산을 불러오며 최신 호가 한 건을 전체 가격 이력으로 꾸미지 않는다. 이 배치는 구현된 구성의 기록이며 최종 사용자 수락이나 모든 화면의 시각 검증 완료를 뜻하지 않는다.

### Entity Before Metric

기업 전체와 모든 실제 구성 종목을 상세 위쪽에 표시한다. 모바일은 기업 전체를 한 줄 전체 폭으로 놓고 구성 종목은 아래 두 열에 배치한다. 구성 종목이 더 많으면 실제 항목을 줄바꿈하며 dropdown·대표 종목만 표시·임의 종목 추가로 바꾸지 않는다. PC는 기업 전체와 구성 종목을 같은 단계의 버튼으로 놓는다. 현재 대상 하나만 옅은 금색과 ‘현재’ 표시를 가진다.

기업 전체는 기업 합산 시총으로, 구성 종목은 선택한 지표의 해당 종목으로 이동한다. 기업 기본 정보에서는 기업 정보 맥락을 유지한다. 보통주 PER에서 우선주를 누르면 우선주 PER로 이동하며, 미제공이라도 다른 지표로 임의 대체하지 않는다. `securityId`가 선택과 비교의 식별자다. 이름이 같거나 종목코드가 재사용돼도 경로가 혼동되지 않아야 한다.

종목 메뉴는 **기본 정보 / 시가총액 / PER / PBR / EPS / BPS / 배당수익률 / 주당배당금** 순서를 고정한다. 모바일 두 행×네 열, PC 한 줄로 모두 노출하며 활성 탭도 움직이지 않는다. 기업 메뉴는 **기업 정보 / 기업 합산 시총** 두 항목이다. 기업 PER 같은 허위 합산 지표를 만들지 않는다.

기간의 시작·종료일은 유효한 링크에서 이어가며 상장 기간 `period`는 같은 종목의 지표 전환에만 유지한다. 다른 구성 종목에 속하지 않는 period ID를 넘기지 않는다.

## Elevation & Depth

본문은 열린 행과 표, 얇은 괘선으로 나눈다. 대상 선택 버튼은 작은 경계와 현재 표면을 가지며 대형 KPI 카드로 부풀리지 않는다. 그림자는 최근 패널·순위 설명·차트 툴팁 등 본문 앞에 열린 정보에 쓴다. 기존 공통 카드의 작은 깊이는 해당 구성 요소에 한정한다.

- **최근 패널:** `0 12px 28px #00000018`.
- **순위 설명:** `0 4px 14px #0002`.
- **히트맵 툴팁:** `0 4px 12px rgb(0 0 0 / 0.14)`.
- **기존 작은 카드:** `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`.

**The Stable Theme Slot Rule.** 테마 버튼은 모든 폭에서 40×40px, sun/moon은 같은 20×20px grid 슬롯을 사용한다. 테마 변경으로 검색·최근 본·인접 컨트롤이 이동하지 않아야 한다. 첫 방문은 기기 설정, 수동 선택은 저장된 설정을 따른다.

아이콘 opacity는 150ms, 브랜드 별의 작은 회전은 180ms, 대상 버튼과 표의 색 전환은 해당 구성 요소의 짧은 전환을 따른다. reduced-motion에서는 전환을 즉시 종료한다. hover 효과는 실제 링크와 상태의 읽기를 보조한다.

## Shapes

본문 표와 기록 구획은 직선형이다. 탐색·공유·검색·선택 버튼은 작은 반경을 사용하고 큰 알약·반복 부유 카드를 기본 표현으로 삼지 않는다. 원본 별의 둥근 외곽·검은 윤곽·빨간 별은 `public/icon.svg`의 자산 그대로 유지한다.

## Components

### Buttons and CSV

작업 버튼은 읽을 수 있는 텍스트와 최소 40px 높이, 포커스·비활성 상태를 제공한다. 순위 CSV는 작업 금색으로 강조하고 현재 공개 revision·scope의 전체 순위를 제공한다. 로딩은 준비 상태, 실패는 재시도, 성공 응답은 ‘다운로드 시작’과 행 수를 알린다. 디스크 저장 완료를 주장하지 않는다. 공개된 0행 순위는 헤더만 있는 CSV를 제공할 수 있고 미공개와 구분한다.

상세 CSV는 선택 날짜 범위와 관계없이 전체 제공 이력을 유지하며 상장 기간을 선택했다면 그 기간의 전체 제공 이력이다. UTF-8 BOM·앞자리 0·정확한 큰 정수·실제 0·음수·원본 결측을 보존한다. 유효 이력이 없는 정상 빈 상세에 가짜 다운로드를 만들지 않는다.

### Search, Recent and Menu

검색·최근 본·메뉴는 공통 헤더에서 여는 임시 표면이다. 닫으면 기존 페이지의 대상·지표·기간과 위치 맥락을 유지한다. 검색 입력은 실제 명령창에 있으며 검색 진입 버튼과 구분한다. 이름·코드·시장으로 찾고 동일 코드의 다른 식별자를 구분한다. 로딩·실패·검색 결과 없음은 서로 다른 상태와 필요한 재시도로 표현한다.

최근 본은 마지막으로 방문한 기본/기업/종목/지표 경로와 값·코드를 유지한다. 삭제와 정렬, 없는 기록의 안내를 보존한다. 기본 정보 방문을 임의의 PER 방문으로 바꾸지 않는다. 현재 대상 버튼과 최근 기록을 순위 카드로 포장하지 않는다.

### Navigation and Brand Wordmark

전체 이름과 원본 별을 하나의 실제 링크로 제공한다. 텍스트는 조선궁서 400이며 인위적인 외곽선·합성 볼드를 추가하지 않는다. 활성 메인/랭킹·상세 지표에는 기록 괘선을 쓰고 하단 현재 위치는 브랜드 빨강으로 드러낸다. 실제 링크·키보드 탐색·작동하는 공유·다운로드를 이미지로 대체하지 않는다.

순위 현재값과 중립 이동량은 포인터·포커스·클릭으로 이전과 현재 순위의 설명을 제공하고 Escape로 닫는다. ‘유지’와 이전 정보 없음, 순위 자체 없음은 구별한다.

### Company History and Financial Records

단일 날짜 이력은 추이를 꾸미지 않고 실제 날짜·관측 수·등록 합계·해당 종목별 값을 표로 읽는다. 없는 값은 미등록으로 표시하며 0으로 합산하지 않는다. 선택은 `securityId`로 유지하고 같은 이름의 우선주도 구별한다. 과거 관측 구성 합계와 현재 공개 기업 합산값의 범위가 다를 수 있음을 설명한다.

현재값·스냅샷 기준일, 가격과 거래일, 순위 기준일, 이력 날짜·범위는 각각 실제 자료를 표시한다. 같은 가격 레코드의 저장된 일간 등락률을 사용하며 희소한 두 가격으로 전일 대비를 만들지 않는다. 현재 스냅샷과 동일 날짜·값이 이력에서 확인될 때만 이전 기록과 비교한다. 재무 평균 비교는 실제 비교 대상을 값 가까이에 붙인다. 0·음수 전년값에서 계산할 수 없는 변화율을 만들지 않는다.

BPS 연말과 다른 지표의 연도별 마지막 실제 관측을 구분한다. 최근 연도 미완료, 실제 관측 수, 제공 누락을 유지한다. 모바일 연간 행은 연도·값·비교를 먼저 읽고 기준일과 상세 값을 펼친다. 차트는 부모 폭 안에서 줄어들며 넓은 표만 자기 영역 안에서 스크롤한다.

### Lifecycle and States

상장·상장폐지·재상장 기간, 이름·시장 변경과 근거를 유지한다. 선택한 과거 상장 기간은 그 기간의 이름·시장·이력으로 읽고 현재 가격·현재 회사·현재 순위·인접 순위를 물려받지 않는다. 상폐 사이의 이름 변경을 새 상장으로 오인하지 않으며 날짜가 불확실하면 정확도도 드러낸다.

로딩·검색 없음·기간 자료 없음·일시 오류·지표 미제공·기준일 미공개는 본문에서 구별한다. 공통 헤더와 활성 탐색, 존재하는 대상과 메뉴를 유지하고 재시도·다른 지표·마지막 제공 시점·최신 공개 자료 등 실제 가능한 다음 행동을 제공한다. 미제공의 마지막 제공값은 현재값으로 승격하지 않는다. 존재하는 종목의 지표 이력 없음은 404가 아니다. 잘못된 대상·상장 기간과 정상 빈 이력도 구분한다.

## Do's and Don'ts

### Do:

- **Do** 전체 이름·원본 별·조선궁서 400의 표정을 유지한다.
- **Do** 기업 전체와 실제 모든 구성 종목을 지표 메뉴보다 먼저 보여준다.
- **Do** 현재 대상만 금색으로 선택하고 지표의 순서와 위치를 고정한다.
- **Do** 순위 식별색·중립 이동량·부호 있는 가격 등락을 구분한다.
- **Do** 실제 공개 기준·관측일·제공 상태·상장 기간을 차트·CSV까지 보존한다.
- **Do** 실제 코드·링크·키보드 탐색과 기기/저장 테마를 유지한다.

### Don't:

- **Don't** 기업 합산값과 대표 보통주 값을 같게 취급하거나 기업 PER을 만든다.
- **Don't** 대상과 고정 지표를 모바일 dropdown·가로 스크롤 뒤로 숨긴다.
- **Don't** 미제공·미관측을 0으로 채우거나 마지막 제공값을 현재값으로 쓴다.
- **Don't** 단일 날짜의 장식용 추이·실시간 주장·역사적 괴리율 기능을 꾸며낸다.
- **Don't** 다른 종목에 상장 기간 ID를 넘기거나 과거 기간에 현재값을 섞는다.
- **Don't** 시안의 합성 숫자·오타·중복 메뉴를 실제 서비스 데이터와 규칙으로 복제한다.
