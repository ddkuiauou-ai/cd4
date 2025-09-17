# CD3 Development Guidelines

**Korean Stock Information Service - Professional Development Standards**

**Last Updated:** June 11, 2025

## 🎯 Project Philosophy

CD3는 한국 주식시장 정보를 제공하는 전문적이고 신뢰할 수 있는 서비스입니다. 퀀트 기반의 사무적이고 정확한 정보 전달을 목표로 하며, 모바일 우선 읽기 최적화와 SEO 최적화를 통한 검색 발견성을 중시합니다.

## 🛠 핵심 기술 스택

- **Framework**: Next.js 15 (App Router, SSR 우선)
- **UI**: shadcn/ui (New York 스타일, slate 베이스)
- **Styling**: Tailwind CSS 4 (모바일 우선)
- **Database**: Drizzle ORM (직접 접근)
- **Guidance**: Context7 (MCP 서버, 기술 지원용)

## 🎨 디자인 원칙

### 전문성과 신뢰성

- **색상 최소화**: 오피스/퀀트 스타일의 흑백 그레이 기반 색상 체계
- **타이포그래피 중심**: 색상보다는 폰트 굵기와 크기로 강조
- **정보 우선**: 장식적 요소 최소화, 데이터 가독성 최우선

### 한국 주식시장 표준 색상

```css
/* 금융 데이터 전용 색상 (한국 시장 컨벤션) */
.price-up {
  color: #d60000;
} /* 빨강: 상승/수익 */
.price-down {
  color: #0066cc;
} /* 파랑: 하락/손실 */
.neutral {
  color: #6b7280;
} /* 회색: 보합/중립 */
```

### UI 기본 색상 팔레트

```css
/* 전문 서비스 UI 색상 */
.text-primary {
  color: #111111;
} /* 메인 텍스트 */
.text-secondary {
  color: #666666;
} /* 보조 텍스트 */
.bg-white {
  background: #ffffff;
} /* 기본 배경 */
.bg-subtle {
  background: #fbfbfb;
} /* 카드 배경 */
.border-light {
  border-color: #e5e5e5;
} /* 경계선 */
.inactive {
  color: #cccccc;
} /* 비활성 요소 */
```

### 브랜드 강조 색상 (제한적 사용)

```css
/* 로고 기반 강조 색상 - 버튼, 배지 등에만 사용 */
.brand-accent-1 {
  color: #d83d1e;
} /* 주황-레드: 버튼 hover */
.brand-accent-2 {
  color: #f5aa0d;
} /* 웜 옐로우: 배지, 포인트 */
.brand-deep {
  color: #1c0d04;
} /* 딥 브라운: 로고 영역만 */
```

## 📱 모바일 우선 전략

### 화면 크기별 대응

```tsx
// 반응형 레이아웃 패턴
<div className="
  space-y-2                           /* xs: 간격 최소화 */
  sm:space-y-4                        /* sm: 적당한 간격 */
  lg:grid lg:grid-cols-3 lg:gap-6     /* lg: 그리드 레이아웃 */
">
```

### 카드 사용 지침

- **320px 이하**: 카드 스타일 제거, 리스트 형태 사용
- **400px 이하**: 카드 중첩 금지, 단일 레벨만 허용
- **768px 이상**: 풀 카드 디자인 적용 가능

## 🗃 데이터베이스 구조

### 엄격한 파일 구조

```
lib/
├── select.ts    # 모든 SELECT 연산
├── insert.ts    # 모든 INSERT 연산
├── update.ts    # 모든 UPDATE 연산
└── delete.ts    # 모든 DELETE 연산
```

### 네이밍 규칙

- **데이터베이스**: `snake_case`
- **TypeScript**: `camelCase`
- **컴포넌트**: `PascalCase`

```typescript
// 데이터베이스 스키마
export const securities = pgTable("securities", {
  sec_code: text("sec_code").primaryKey(),
  market_cap: bigint("market_cap", { mode: "number" }),
});

// TypeScript 타입
type Security = {
  secCode: string;
  marketCap: number;
};
```

## ⚡ 성능 최적화

### SEO 최적화

- **SSR 우선**: 모든 랭킹 페이지는 서버 사이드 렌더링
- **메타데이터**: 동적 meta 태그 생성
- **사이트맵**: 자동 XML 사이트맵 생성
- **구조화된 데이터**: JSON-LD 마크업

```typescript
// 메타데이터 예시
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `시가총액 순위 ${params.page}페이지 - CD3`,
    description: "한국 주식시장 시가총액 순위 정보",
    keywords: ["시가총액", "주식순위", "KOSPI", "KOSDAQ"],
  };
}
```

### 캐싱 전략

- **정적 생성**: ISR로 랭킹 페이지 사전 생성
- **데이터베이스 캐싱**: 5분 TTL로 쿼리 결과 캐싱
- **CDN**: Vercel Edge Network 활용

## 🧩 컴포넌트 가이드라인

### shadcn/ui 우선 사용

```bash
# 새 컴포넌트 필요시 shadcn 먼저 확인
pnpm dlx shadcn@latest add [component-name]
```

### 커스텀 컴포넌트 패턴

```tsx
// 재사용 가능한 데이터 표시 컴포넌트
interface SecurityCardProps {
  security: Security;
  rank?: number;
  showChart?: boolean;
}

export const SecurityCard = ({
  security,
  rank,
  showChart,
}: SecurityCardProps) => (
  <Card className="p-3 sm:p-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium">{security.name}</h3>
        <p className="text-sm text-muted-foreground">{security.code}</p>
      </div>
      <div className="text-right">
        <div className="font-mono">
          {formatKoreanNumber(security.marketCap)}
        </div>
        {rank && <div className="text-sm text-muted-foreground">#{rank}</div>}
      </div>
    </div>
    {showChart && <MiniChart data={security.priceHistory} />}
  </Card>
);
```

## 🧠 Context7의 실제 역할

Context7은 내부 개발 보조용 MCP 서버로, 다음과 같은 상황에서 **코드 생성 및 기술 반영**을 위한 보조 지식 검색 도구로 사용한다:

- **Next.js 15**의 신규 기능 (예: 서버 액션, App Router 등) 관련 적용법이 불명확할 때
- **Drizzle ORM**에서의 최신 문법, 실사용 예시가 필요할 때
- **Tailwind CSS v4**, **shadcn/ui** 컴포넌트의 변경점/조합법이 헷갈릴 때
- **라이브러리 최신 패턴**이 웹에 산재해 있고, 이를 압축해서 요약적으로 보고 싶을 때

### ✅ Context7 질의 예시

```typescript
// "Next.js 15에서 server action의 mutation 상태를 어떻게 관리하나요?"
// "Drizzle에서 JOIN한 테이블을 타입 안전하게 처리하려면 어떻게 해야 하나요?"
// "shadcn/ui의 card 컴포넌트를 어떻게 커스터마이징해서 mobile에 맞출 수 있을까요?"
```

### 📌 중요: Context7이 **아닌** 것들

- ❌ 데이터베이스 스키마 설계 도구
- ❌ 복잡한 쿼리 최적화 엔진
- ❌ 한국 주식시장 규칙/정책 해설 도구
- ❌ 성능 최적화 전략 분석 도구

**이러한 작업들은 공식 문서, 웹 검색, 실무 경험을 통해 접근해야 함**

Context7은 **"기술을 빠르게 반영할 수 있도록 최신 패턴을 추출해주는 도구"** 임을 명심하자.

## 📋 코드 품질 기준

### ESLint 규칙 준수

```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "prefer-const": "error",
    "no-unused-vars": "error"
  }
}
```

### 타입 안전성

```typescript
// 엄격한 타입 정의
interface MarketCapData {
  secCode: string;
  corpName: string;
  marketCap: number;
  rank: number;
  change?: number;
}

// 타입 가드 사용
const isValidSecurity = (data: unknown): data is MarketCapData => {
  return (
    typeof data === "object" &&
    data !== null &&
    "secCode" in data &&
    "marketCap" in data
  );
};
```

## 🚀 배포 및 모니터링

### Vercel 최적화

- **Analytics**: 사용자 행동 분석
- **Speed Insights**: 성능 모니터링
- **Error Tracking**: 실시간 오류 추적

### 성능 목표

- **LCP**: < 2.5초
- **FID**: < 100ms
- **CLS**: < 0.1
- **번들 크기**: < 100KB (초기 JavaScript)

## 📚 문서 유지보수

### 문서 업데이트 규칙

1. **기능 추가/변경시 문서 동시 업데이트**
2. **예시 코드는 실제 동작하는 코드로 작성**
3. **변경 이력 `Last Updated` 날짜 갱신**
4. **문서 간 일관성 유지**

### 문서 역할 분담

- **`copilot-instructions.md`**: 개발 지침 요약
- **`spec.md`**: 기술 사양서
- **`ui.md`**: UI/컴포넌트 가이드
- **`service.md`**: 서비스 기능 문서
- **`development-guidelines.md`**: 종합 개발 가이드

---

## 🔄 최근 개선사항 및 향후 계획

### ✅ 완료된 UX/UI 개선 (2025-06-15)

#### **Company Marketcap Page 리팩터링**

**1. 타이포그래피 계층화**

- H1: `text-3xl md:text-4xl lg:text-5xl` (페이지 제목 강화)
- H2: `text-2xl md:text-3xl` (주요 섹션 제목 크기 증가)
- 설명 텍스트: `text-base` (일관된 설명 텍스트 크기)
- sr-only에서 실제 표시로 변경하여 UX 개선

**2. 시각적 섹션 구분**

- 각 섹션별 배경색 구분 (미묘한 투명도 활용)
- 섹션 헤더에 아이콘과 설명 추가
- border-top과 rounded-xl으로 시각적 분리

```css
/* 섹션별 색상 체계 */
.section-company {
  background: bg-blue-50/30;
}
.section-chart {
  background: bg-green-50/20;
}
.section-compare {
  background: bg-purple-50/20;
}
.section-metrics {
  background: bg-orange-50/20;
}
.section-data {
  background: bg-red-50/20;
}
```

**3. 사이드바 네비게이션**

- sticky 포지셔닝으로 스크롤 시 고정
- 섹션별 앵커 링크와 아이콘 매칭
- 빠른 정보 카드 (총 시가총액, 종목 수, 기준일)

**4. 모바일 최적화**

- 핵심 지표 카드: 가로 스크롤 (flex + 고정 너비)
- 차트 패딩: `p-2 sm:p-4` (모바일 여백 최적화)
- 반응형 그리드: 모바일에서 세로 배치

**5. Next.js 15 Suspense + 스켈레톤 UI**

- 페이지 전체 로딩 상태 구현
- 섹션별 특성에 맞는 스켈레톤 디자인
- 자동 로딩 처리 (`loading.tsx`)

### 🔄 진행 중인 작업

**색상 시스템 고도화**

- 현재 섹션 배경색의 전문성 개선 필요
- 브랜드 일관성과 고급스러움 균형점 찾기

### 📋 향후 개선 계획

#### **우선순위 1: UX 세부 개선 (즉시 적용 가능 ~5분)**

- [ ] **스크롤 스파이**: 현재 보고 있는 섹션 하이라이트
- [ ] **백투탑 버튼**: 긴 페이지에서 상단으로 빠른 이동

#### **우선순위 2: 접근성 및 사용성 (단기 ~30분)**

- [ ] **접근성 개선**: ARIA 레이블, 포커스 스타일, 키보드 네비게이션
- [ ] **툴팁 시스템**: 복잡한 지표에 대한 설명 팝오버
- [ ] **브레드크럼 개선**: 현재 위치 더 명확하게 표시

#### **우선순위 3: 성능 및 SEO (중기 ~1-2시간)**

- [ ] **SEO 강화**: JSON-LD 구조화된 데이터, Open Graph 최적화
- [ ] **성능 최적화**: 차트 컴포넌트 lazy loading, 메모이제이션
- [ ] **이미지 최적화**: Next.js Image 컴포넌트 전면 적용

#### **우선순위 4: 고급 기능 (장기)**

- [ ] **인터랙티브 차트**: 호버, 클릭 이벤트, 비교 모드
- [ ] **필터링 시스템**: 기간별, 종목별 동적 필터
- [ ] **모바일 제스처**: 섹션 간 스와이프 이동
- [ ] **에러 처리**: 우아한 빈 상태 UI, 재시도 기능

### 🎯 개발 체크리스트 업데이트

**UI/UX 품질 기준**

- [ ] 타이포그래피 계층구조 준수 (H1>H2>H3>H4)
- [ ] 섹션별 시각적 구분 (배경색 + 아이콘 + 구분선)
- [ ] 모바일 우선 반응형 디자인
- [ ] 스켈레톤 UI 로딩 상태 구현
- [ ] 사이드바 네비게이션 (데스크톱)

**성능 및 접근성**

- [ ] Core Web Vitals 목표치 달성
- [ ] ARIA 레이블 및 키보드 네비게이션
- [ ] 색상 대비 접근성 기준 준수
- [ ] lazy loading 및 코드 스플리팅

---

**개발시 필수 체크리스트**

- [ ] shadcn 컴포넌트 우선 확인
- [ ] 모바일 화면에서 카드 중첩 없음
- [ ] 한국 주식시장 색상 표준 준수 (#D60000 상승, #0066CC 하락)
- [ ] UI 기본 색상 팔레트 사용 (흑백 그레이 중심)
- [ ] 브랜드 강조 색상 제한적 사용 (버튼, 배지만)
- [ ] SEO 메타데이터 설정
- [ ] 타입 안전성 확보
- [ ] 성능 최적화 (Core Web Vitals)
- [ ] 관련 문서 업데이트

## 🔄 컴포넌트 재사용 및 통합 패턴

### 통일된 필터 컴포넌트 개발 원칙

중복 코드 제거와 일관된 UX를 위해 유사한 기능을 하나의 컴포넌트로 통합합니다.

#### 1. 컴포넌트 통합 기준

**통합 대상 식별**

- 같은 데이터 구조를 사용하는 필터링 로직
- 유사한 UI 패턴 (카드, 버튼, 리스트)
- 동일한 사용자 인터랙션 (클릭, 선택, 필터링)

**통합 방법**

```tsx
// ❌ 기존: 중복된 개별 컴포넌트
<MarketcapMainFilter securities={securities} />
<MarketcapSidebarFilter securities={securities} />

// ✅ 개선: 통일된 컴포넌트 with layout props
<InteractiveSecuritiesSection
  securities={securities}
  layout="grid" // or "sidebar"
  maxItems={layout === "sidebar" ? 6 : 12}
  compactMode={layout === "sidebar"}
/>
```

#### 2. Layout Props 패턴

**유연한 레이아웃 지원**

```tsx
interface UnifiedComponentProps {
  // 공통 데이터
  securities: Security[];
  selectedSecCode?: string;

  // 레이아웃 제어
  layout?: "grid" | "sidebar" | "list";
  maxItems?: number;
  compactMode?: boolean;
  showSummaryCard?: boolean;
}
```

**조건부 렌더링 로직**

```tsx
export function UnifiedComponent({ layout, compactMode, ...props }: Props) {
  // 공통 로직
  const filteredData = useFilterLogic(props);

  // 레이아웃별 렌더링
  if (layout === "sidebar") {
    return <SidebarLayout {...props} compact={compactMode} />;
  }

  if (layout === "grid") {
    return <GridLayout {...props} showSummary={showSummaryCard} />;
  }

  return <DefaultLayout {...props} />;
}
```

#### 3. 성공 사례: InteractiveSecuritiesSection

**기존 문제점**

- `MarketcapMainFilter`: 메인 콘텐츠용 카드 그리드
- `MarketcapSidebarFilter`: 사이드바용 버튼 리스트
- 중복된 필터링 로직과 상태 관리
- 일관성 없는 UX (다른 디자인, 다른 동작)

**통합 후 개선사항**

```tsx
// 메인 콘텐츠: 카드 그리드 레이아웃
<InteractiveSecuritiesSection
  securities={securities}
  selectedSecCode={secCode}
  title="기업 종목 시가총액"
  layout="grid"
  showSummaryCard={true}
/>

// 사이드바: 컴팩트 버튼 레이아웃
<InteractiveSecuritiesSection
  securities={securities}
  selectedSecCode={secCode}
  title="종목 필터"
  layout="sidebar"
  maxItems={6}
  compactMode={true}
/>
```

**달성된 결과**

- 코드 중복 제거 (2개 컴포넌트 → 1개 통합)
- 일관된 필터링 동작
- 유지보수성 향상 (로직 변경시 한 곳만 수정)
- 타입 안전성 보장

#### 4. 추가 통합 후보

**현재 식별된 중복 패턴**

- `InteractiveSecuritiesPERSection` - PER 페이지 전용
- `SimpleInteractiveSecurities2x2` - 2x2 그리드 전용
- 각 메트릭별 개별 리스트 컴포넌트들

**통합 로드맵**

1. **Phase 1**: 완료 - MarketCap 페이지 통합
2. **Phase 2**: PER/BPS/EPS 페이지에 동일 패턴 적용
3. **Phase 3**: 모든 메트릭 페이지 통일된 인터페이스 제공

#### 5. 컴포넌트 통합 체크리스트

**설계 단계**

- [ ] 중복 기능을 가진 컴포넌트 식별
- [ ] 공통 데이터 구조 및 로직 추출
- [ ] Layout props 인터페이스 설계
- [ ] 기존 사용처 모두 파악

**구현 단계**

- [ ] 통일된 컴포넌트 개발
- [ ] 각 layout 모드별 렌더링 로직 구현
- [ ] 기존 컴포넌트 대체
- [ ] 사용하지 않는 컴포넌트 제거

**검증 단계**

- [ ] 모든 사용처에서 정상 동작 확인
- [ ] 빌드 성공 확인
- [ ] UI/UX 일관성 검증
- [ ] 성능 영향 검토

## 📦 빌드 시스템 최적화 (2025년 6월 추가)

#### SSG 병렬 빌드

대규모 데이터셋 처리를 위한 병렬 빌드 시스템:

```bash
# 개발/테스트용 빌드
pnpm build:ssg

# 병렬 빌드 옵션들
pnpm build:chunks        # 순차 청크 빌드 (안전함)
pnpm build:staggered     # 지연된 병렬 빌드 (권장)
pnpm build:parallel-real # 진짜 병렬 빌드 (최고 성능)
```

#### 청크 기반 빌드 전략

```typescript
// 환경 변수로 청크 제어
BUILD_CHUNK_INDEX=0      # 현재 청크 인덱스 (0부터 시작)
BUILD_CHUNK_TOTAL=4      # 전체 청크 수
BUILD_CHUNK_SIZE=500     # 청크당 종목 수

// 실제 사용 예시
BUILD_CHUNK_INDEX=0 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
```

#### 수동 병렬 빌드 (최고 성능)

4개 터미널에서 동시 실행:

```bash
# 터미널 1
BUILD_CHUNK_INDEX=0 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-0

# 터미널 2
BUILD_CHUNK_INDEX=1 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-1

# 터미널 3
BUILD_CHUNK_INDEX=2 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-2

# 터미널 4
BUILD_CHUNK_INDEX=3 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-3

# 최종 합치기
mkdir -p out && cp -r out-chunk-*/* out/ && node scripts/generate-sitemap.js
```

#### 성능 메트릭

- **단일 빌드**: 15-20분 (전체 데이터셋)
- **병렬 빌드**: 4-6분 (4개 청크, 약 4배 향상)
- **테스트 성과**: 609페이지 성공적 생성 (100종목 기준)

#### 데이터베이스 최적화

```typescript
// db/index.ts - 병렬 빌드 지원 설정
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 5 : 10, // 연결 풀 증가
  idle_timeout: 60, // 타임아웃 연장
  connect_timeout: 60, // 연결 타임아웃 연장
  prepare: false, // prepared statements 비활성화
});
```

#### 빌드 에러 해결

**일반적인 문제들:**

1. **DB 연결 타임아웃**

   - 해결: 연결 풀 크기 증가, 타임아웃 시간 연장

2. **메모리 부족**

   - 해결: 청크 크기 감소, 동시 실행 수 제한

3. **Next.js 파일 충돌**
   - 해결: 완전 분리된 빌드 디렉토리 사용
