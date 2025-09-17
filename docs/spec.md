# CD3 Project Technical Specification

## Technology Stack

### Core Framework

- **Next.js**: v15.3.2
  - With Turbopack for development
  - React Server Components (RSC) enabled
  - App Router with parallel routes and intercepting routes

### Frontend

- **React**: v19.0.0
- **React DOM**: v19.0.0
- **TypeScript**: v5.x
- **Tailwind CSS**: v4.x
  - With CSS variables enabled
  - Base color: slate (required)
  - Container queries support
  - Mobile-first approach (required)
- **shadcn/ui**: Based on Radix UI components
  - Style: New York (required)
  - Base: slate (required)
  - Icon Library: Lucide (v0.511.0)
- **next-themes**: v0.4.6 (Theme management, dark mode default)
- **React Wrap Balancer**: v1.1.1 (Typography balance)

### Radix UI Components

- @radix-ui/react-dialog: v1.1.14
- @radix-ui/react-dropdown-menu: v2.1.15
- @radix-ui/react-icons: v1.3.2
- @radix-ui/react-scroll-area: v1.2.9
- @radix-ui/react-separator: v1.1.7
- @radix-ui/react-slot: v1.2.3
- @radix-ui/react-tabs: v1.1.12
- @radix-ui/react-tooltip: v1.2.7

### Database

- **Drizzle ORM**: v0.43.1
- **PostgreSQL**: @libsql/client v0.15.7
- **drizzle-kit**: v0.31.1 (Migration tools)
- **Additional DB drivers**: pg v8.16.0, postgres v3.4.6
- **Context7**: MCP server for technical guidance and clarification

### Performance & Optimization

- **@next/third-parties**: v15.3.2 (Third-party optimization)
- **react-wrap-balancer**: v1.1.1 (Typography optimization)

### Data Visualization

- **Recharts**: v2.15.3 (Chart library)
- **D3**: v7.9.0 (Data visualization primitives)

### Utilities

- **clsx**: v2.1.1 (Conditional class names)
- **tailwind-merge**: v3.3.0 (Merging Tailwind classes)
- **class-variance-authority**: v0.7.1 (Component variants)
- **cmdk**: v1.1.1 (Command menu functionality)
- **jotai**: v2.12.4 (State management)
- **shadcn**: v2.5.0 (Component CLI)
- **dotenv**: v16.5.0 (Environment variables)
- **jsdom**: v26.1.0 (DOM utilities)

### Development Tools

- **ESLint**: v9.x
- **@eslint/eslintrc**: v3.x
- **@types/node**: v20.x
- **@types/pg**: v8.15.2
- **@types/react**: v19.1.5
- **@types/react-dom**: v19.1.5
- **drizzle-kit**: v0.31.1
- **@tailwindcss/postcss**: v4.x
- **tailwindcss**: v4.x
- **tw-animate-css**: v1.3.0
- **typescript**: v5.x

### Color Palette

#### Korean Stock Market Standards

- **Price Up/Profit**: `#D60000` (Red)
- **Price Down/Loss**: `#0066CC` (Blue)
- **Neutral/Unchanged**: `#6B7280` (Gray)

#### UI Base Colors

- **Background (Light)**: `#FFFFFF`
- **Background (Dark)**: `#111827`
- **Foreground (Light)**: `#1F2937`
- **Foreground (Dark)**: `#F9FAFB`
- **Card (Light)**: `#F9FAFB`
- **Card (Dark)**: `#1F2937`
- **Border (Light)**: `#E5E7EB`
- **Border (Dark)**: `#374151`
- **Foreground**
  - HEX: `#0F172A`
  - OKLCH: 26.20% 0.065 257.25
- **Card**
  - HEX: `#FFFFFF`
  - OKLCH: 100% 0 0
- **Muted/Border**
  - HEX: `#E5E7EB`
  - OKLCH: 91.77% 0.007 257.71

#### Dark Mode (Default)

- **Background**
  - HEX: `#0F172A`
  - OKLCH: 26.20% 0.065 257.25
- **Foreground**
  - HEX: `#F8FAFC`
  - OKLCH: 97.84% 0.014 259.79
- **Card**
  - HEX: `#1E293B`
  - OKLCH: 32.75% 0.041 257.69
- **Muted/Border**
  - HEX: `#1E293B`
  - OKLCH: 32.75% 0.041 257.69

## Project Structure

```
├── .github/                       # GitHub configuration
├── app/                           # Next.js app directory (App Router)
│   ├── favicon.ico                # Favicon icon
│   ├── globals.css                # Global CSS styles
│   ├── layout.tsx                 # Root layout component
│   ├── opengraph-image.png        # Open Graph image
│   ├── (app)/                     # App route group
│   │   ├── layout.tsx             # App layout
│   │   ├── (detail)/              # Detail pages route group
│   │   │   ├── layout.tsx         # Detail layout
│   │   │   ├── corp/              # Corporation detail pages
│   │   │   │   └── marketcap/     # Corporation market cap pages
│   │   │   └── sec/               # Security detail pages
│   │   │       ├── bps/           # Book value per share pages
│   │   │       ├── div/           # Dividend yield pages
│   │   │       ├── dps/           # Dividend per share pages
│   │   │       ├── eps/           # Earnings per share pages
│   │   │       ├── marketcap/     # Security market cap pages
│   │   │       ├── pbr/           # Price-to-book ratio pages
│   │   │       └── per/           # Price-earnings ratio pages
│   │   └── (main)/                # Main pages route group
│   │       ├── layout.tsx         # Main layout
│   │       ├── page.tsx           # Home page (market cap ranking)
│   │       ├── bps/               # BPS ranking pages
│   │       │   ├── page.tsx       # BPS main page
│   │       │   ├── sitemap.ts     # BPS sitemap
│   │       │   └── [page]/        # BPS pagination
│   │       ├── div/               # DIV ranking pages
│   │       │   ├── page.tsx       # DIV main page
│   │       │   ├── sitemap.ts     # DIV sitemap
│   │       │   └── [page]/        # DIV pagination
│   │       ├── dps/               # DPS ranking pages
│   │       │   ├── page.tsx       # DPS main page
│   │       │   ├── sitemap.ts     # DPS sitemap
│   │       │   └── [page]/        # DPS pagination
│   │       ├── eps/               # EPS ranking pages
│   │       │   ├── page.tsx       # EPS main page
│   │       │   ├── sitemap.ts     # EPS sitemap
│   │       │   └── [page]/        # EPS pagination
│   │       ├── marketcap/         # Market cap ranking pages
│   │       │   ├── page.tsx       # Market cap main page
│   │       │   ├── sitemap.ts     # Market cap sitemap
│   │       │   └── [page]/        # Market cap pagination
│   │       ├── marketcaps/        # Company market cap ranking
│   │       │   ├── page.tsx       # Company market cap main page
│   │       │   ├── sitemap.ts     # Company market cap sitemap
│   │       │   └── [page]/        # Company market cap pagination
│   │       ├── pbr/               # PBR ranking pages
│   │       │   ├── page.tsx       # PBR main page
│   │       │   ├── sitemap.ts     # PBR sitemap
│   │       │   └── [page]/        # PBR pagination
│   │       └── per/               # PER ranking pages
│   │           ├── page.tsx       # PER main page
│   │           ├── sitemap.ts     # PER sitemap
│   │           └── [page]/        # PER pagination
│   └── sitemaps/                  # Sitemap configuration
│       └── sitemap.xml/           # XML sitemap route
│           └── route.ts           # Sitemap route handler
├── components/                    # UI components
│   ├── announcement.tsx           # Announcement component
│   ├── BaseImage.tsx              # Optimized image component
│   ├── card-marketcap-detail.tsx  # Market cap detail card
│   ├── card-marketcap.tsx         # Market cap card
│   ├── chart-*.tsx                # Chart components (BPS, DIV, DPS, EPS, PBR, PER, marketcap)
│   ├── command-menu.tsx           # Command menu functionality
│   ├── corp-sec-tabs.tsx          # Corporation/Security tabs
│   ├── examples-nav.tsx           # Examples navigation
│   ├── exchange.tsx               # Exchange component
│   ├── GoogleAdsense.tsx          # Google AdSense integration
│   ├── header-rank.tsx            # Ranking header
│   ├── icons.tsx                  # Icon components
│   ├── list-*.tsx                 # List components for each metric
│   ├── main-nav.tsx               # Main navigation
│   ├── mid-nav.tsx                # Middle navigation
│   ├── mobile-nav.tsx             # Mobile navigation
│   ├── mode-toggle.tsx            # Dark/light mode toggle
│   ├── page-header.tsx            # Page header component
│   ├── pager-*.tsx                # Pagination components
│   ├── providers.tsx              # React providers
│   ├── rank-change.tsx            # Rank change indicator
│   ├── rate.tsx                   # Rate component
│   ├── site-footer.tsx            # Site footer
│   ├── site-header.tsx            # Site header
│   ├── spike-chart.tsx            # Spike chart visualization
│   ├── tailwind-indicator.tsx     # Development indicator
│   └── ui/                        # shadcn/ui components
│       ├── badge.tsx              # Badge component
│       ├── button.tsx             # Button component
│       ├── card.tsx               # Card component
│       ├── command.tsx            # Command component
│       ├── dialog.tsx             # Dialog component
│       ├── dropdown-menu.tsx      # Dropdown menu component
│       ├── pagination.tsx         # Pagination component
│       ├── scroll-area.tsx        # Scroll area component
│       ├── separator.tsx          # Separator component
│       ├── sheet.tsx              # Sheet component
│       ├── sonner.tsx             # Toast notifications (Sonner)
│       ├── table.tsx              # Table component
│       ├── tabs.tsx               # Tabs component
│       ├── toast.tsx              # Toast component
│       ├── toaster.tsx            # Toast container
│       ├── tooltip.tsx            # Tooltip component
│       └── use-toast.ts           # Toast hook
├── config/                        # Configuration files
│   ├── docs.ts                    # Documentation configuration
│   └── site.ts                    # Site configuration
├── db/                            # Database schema and utilities
│   ├── index.ts                   # Database connection
│   ├── schema-postgres.ts         # PostgreSQL schema
│   └── schema-turso.ts            # Turso/SQLite schema
├── docs/                          # Documentation
│   ├── ui.md                      # UI guidelines, shadcn/ui components and responsive design patterns
│   ├── spec.md                    # This technical specification
│   ├── market-analysis.md         # Technical analysis functions
│   └── service.md                 # Web service features and API documentation
├── drizzle/                       # Database migrations
├── lib/                           # Utility functions (Current Structure)
│   ├── getData.ts                 # Data fetching utilities
│   └── utils.ts                   # General utilities
├── public/                        # Static assets
│   ├── ads.txt                    # Google AdSense verification
│   ├── *.png                      # Favicon and icon files
│   ├── *.svg                      # SVG assets
│   ├── robots.txt                 # Search engine robots file
│   ├── site.webmanifest           # Web app manifest
│   └── images/                    # Image assets
├── components.json                # shadcn/ui configuration
├── drizzle.config.ts              # Drizzle ORM configuration
├── eslint.config.mjs              # ESLint configuration
├── next-env.d.ts                  # Next.js TypeScript declarations
├── next.config.ts                 # Next.js configuration
├── package.json                   # Project dependencies
├── pnpm-lock.yaml                 # PNPM lock file
├── postcss.config.mjs             # PostCSS configuration
├── README.md                      # Project README
├── registry.json                  # Component registry
├── tsconfig.json                  # TypeScript configuration
├── typings.ts                     # Custom type definitions
└── vercel.json                    # Vercel deployment configuration
```

## Core Features & Architecture

### Stock Information Service

- **Market Cap Rankings**: 시가총액 기반 기업 및 종목 순위
- **Financial Metrics Rankings**: BPS, DIV, DPS, EPS, PBR, PER 지표별 순위
- **Investment Analysis**: 주식 투자를 위한 종합적인 재무 지표 분석
- **Real-time Data**: 실시간 주가 및 재무 데이터 제공

### User Experience Features

- **Mobile-First Design**: 모바일 투자 정보 검색에 최적화
- **Dark Mode Default**: 장시간 사용을 위한 전문적인 외관
- **Interactive Charts**: 30일 가격 변동 차트 (SpikeChart)
- **Responsive Tables**: 다양한 화면 크기에 최적화된 데이터 테이블

### Technical Architecture

- **Server-Side Rendering**: React Server Components 광범위 사용
- **Client-Side Interactivity**: 폼과 상호작용을 위한 전략적 클라이언트 컴포넌트 사용
- **Database Design**: PostgreSQL with Drizzle ORM for type-safe queries
- **Authentication**: NextAuth.js with email magic links
- **State Management**: Server state with occasional client state for UI

## Development Environment

- **Package Manager**: pnpm (use pnpm for all package management, testing, and development tasks)
- **Node.js Compatibility**: v20.x LTS (recommended: v20.17.0+)
- **Deployment Platform**: Vercel
- **Database**: PostgreSQL (Vercel Postgres)
- **Environment**: TypeScript strict mode enabled
- **Code Quality**: ESLint + Prettier with automated formatting

## Development Workflow

**PRIMARY RULE**: Always use `shadcn` and `Context7` tools. When uncertain about implementation, immediately consult `Context7`.

```
Requirements → shadcn check → Context7 if uncertain → Implement → Document
```

### Component Implementation Process

1. **Check shadcn first**: `pnpm dlx shadcn@latest add [component]`
2. **Use Context7 for**: Database operations, technical clarification, uncertainty
3. **Apply animations**: Performance-optimized (CSS transforms/opacity)
4. **Test**: Mobile + desktop, ESLint, type checking

### Database Architecture

**Strict Organization** (Context7 required):

```
lib/
├── insert.ts    # All insert operations
├── delete.ts    # All delete operations
├── update.ts    # All update operations
├── select.ts    # All select operations
├── getData.ts   # Data fetching utilities
├── market-utils.ts # Market-specific utilities
└── utils.ts     # General utilities
```

**Rules**:

- **Strict Organization**: No database code outside `/lib` files
- **Context7 Required**: All database operations must use Context7
- **Naming Convention**: `snake_case` (DB) → `camelCase` (TypeScript)
- **Caching**: Use `unstable_cache` with appropriate tags for performance
- **Error Handling**: All database operations must include error handling

## Scripts

All scripts should be run using pnpm:

### Development

- `pnpm dev`: Start development server with Turbopack
- `pnpm build`: Build the production application
- `pnpm start`: Start the production server

### Code Quality

- `pnpm lint`: Run ESLint checks
- `pnpm lint:fix`: Fix ESLint issues automatically

### Database

- `pnpm drizzle-kit generate`: Generate database migrations
- `pnpm drizzle-kit migrate`: Run database migrations
- `pnpm drizzle-kit push`: Push schema changes to database
- `pnpm drizzle-kit studio`: Open Drizzle Studio

### Component Management

- `pnpm dlx shadcn@latest add [component]`: Add new shadcn/ui component
- `pnpm dlx shadcn@latest update`: Update existing components

## Configuration Files

### Core Configuration

- **TypeScript**: Strict mode with path aliases configured
- **ESLint**: Extended with TypeScript, React, and accessibility rules
- **Prettier**: Tailwind CSS plugin integration with consistent formatting
- **Tailwind**: Version 4 with CSS variables, dark mode default, and container queries
- **PostCSS**: Autoprefixer and Tailwind processing
- **Vercel**: Optimized deployment settings with environment variables

### Database Configuration

- **Drizzle**: PostgreSQL with @libsql/client adapter
- **PostgreSQL and Turso**: Supporting both database providers

## Design Philosophy

**Professional Stock Information Service** - Trustworthy, mobile-optimized

- **Target**: Investment information with credibility
- **Approach**: Mobile-first, dark mode default
- **Style**: Minimalist, modern, strategic animations
- **Focus**: Optimal reading/writing experiences for financial data

### Mobile-First Strategy

- **Typography**: Optimized for mobile reading of investment information
- **Animations**: Strategic micro-interactions to prevent text monotony
- **Performance**: Server components first, client-side when necessary
- **UX**: Progressive disclosure, intuitive interfaces for complex financial data

## Performance Optimizations

### Build & Runtime Optimizations

- **Image Optimization**: Sharp for production image processing with WebP/AVIF support
- **Code Splitting**: Automatic route-based splitting with dynamic imports
- **Server Components**: Extensive use of RSC for better performance

### Monitoring & Analytics

- **Vercel Analytics**: Real user monitoring and page view tracking
- **Speed Insights**: Core Web Vitals and performance metrics
- **Error Tracking**: Vercel built-in error monitoring

### SEO & Performance Optimization

#### SEO Strategy

- **SSR-First Architecture**: React Server Components for complete HTML generation
- **Metadata Management**: Dynamic meta tags for each ranking page and company detail
- **Sitemap Generation**: Automated XML sitemaps for all ranking pages
- **Structured Data**: JSON-LD markup for financial data
- **Mobile-First Indexing**: Optimized for mobile reading experience

#### Performance Targets

- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Bundle Size**: < 100KB initial JavaScript
- **Image Optimization**: WebP/AVIF with responsive breakpoints
- **Database Queries**: < 200ms average response time

#### Caching Strategy

- **Static Generation**: Pre-built ranking pages with ISR
- **Database Caching**: Query result caching with 5-minute TTL
- **CDN Distribution**: Vercel Edge Network for global delivery

### Security Features

- **Input Validation**: Comprehensive input validation
- **Database Security**: Type-safe database queries with Drizzle ORM

## Documentation Requirements

**Always Update**:

- `docs/spec.md`: Technical specifications
- `docs/ui.md`: Component installations, animation patterns
- `docs/market-analysis.md`: Technical analysis functions
- `docs/service.md`: Web service features and API documentation

**Current Monitoring**:

- Vercel Analytics, Speed Insights, Error Tracking
- Real-time market data connection status (via NetworkStatus component)

## Quick Reference

- **Uncertainty?** → Use `Context7`
- **New Component?** → Check `shadcn` first (`pnpm dlx shadcn@latest add [component]`)
- **Database Operation?** → Use `Context7` + `/lib` files only
- **Animation?** → CSS transforms/opacity preferred
- **Testing?** → Mobile-first validation required
- **Theme?** → Dark mode default, mobile-first approach
- **Style?** → New York style, slate base for shadcn/ui

**Note**: Always use pnpm instead of npm for package installation, script execution, and dependency management throughout the project. This specification is updated as of May 2025 and reflects the actual project structure and dependencies. All development must follow the PRIMARY RULE of using shadcn and Context7 tools.

### Build System & Performance (2025년 6월 업데이트)

#### 빌드 최적화

- **Static Site Generation (SSG)**: `output: 'export'`
- **병렬 빌드 시스템**: 대규모 데이터셋 처리 최적화
- **청크 기반 빌드**: 메모리 효율성과 속도 향상
- **데이터베이스 연결 풀링**: 동시 접근 최적화

#### 빌드 스크립트

```json
{
  "scripts": {
    "build:ssg": "next build && node scripts/generate-sitemap.js",
    "build:chunks": "./scripts/build-chunks.sh",
    "build:staggered": "./scripts/build-staggered.sh",
    "build:parallel-real": "./scripts/build-parallel-real.sh"
  }
}
```

#### 성능 메트릭

- **단일 빌드**: ~15-20분 (전체 데이터셋)
- **병렬 빌드**: ~4-6분 (4개 청크, 이론상 4배 향상)
- **테스트 결과**: 609페이지/100종목 기준 성공적 생성
- **메모리 최적화**: 청크별 격리된 빌드 환경

#### 병렬 빌드 아키텍처

```typescript
// lib/ssg-chunks.ts - 청크 분할 로직
export function getChunkFilter(
  chunkIndex: number,
  totalChunks: number,
  chunkSize: number
) {
  const startIndex = chunkIndex * chunkSize;
  const endIndex = startIndex + chunkSize;
  return { startIndex, endIndex };
}

// 환경 변수 기반 청크 필터링
const chunkFilter = getSSGChunkFilter();
const securityCodes = await getAllSecurityCodes(chunkFilter);
```

#### 데이터베이스 최적화

```typescript
// db/index.ts - 병렬 빌드용 연결 설정
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 5 : 10,
  idle_timeout: 60,
  connect_timeout: 60,
  prepare: false,
  ssl: false,
});
```
