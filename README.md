# CD3 - Korean Stock Information Service

> **후속 작업 시작 문서:** [문서 안내](docs/README.md)에서 2026-10-04 조사 기준의 [프로젝트 현황](docs/project-current-state.md), [DAG 연동 계약](docs/dag-integration.md), [라이브러리 업데이트 인수인계](docs/upgrade-handoff.md)를 읽으세요. 아래 기존 안내에는 과거 버전의 명칭·명령·배포 설명이 남아 있으며, 구현과 다른 항목은 조사 문서에 기록했습니다.

CD3 is a professional stock information service providing comprehensive financial data, rankings, and analysis tools for Korean stock market investors. Built with Next.js 15 and optimized for mobile-first experiences with institutional-grade credibility.

## 🎯 Project Overview

- **Target Market**: Korean stock market (KOSPI/KOSDAQ)
- **Design Philosophy**: Professional, quantitative, mobile-optimized
- **Primary Goal**: Information delivery with SEO optimization for search discovery

## 🛠 Technology Stack

- **Framework**: Next.js 15 (App Router, SSR-first)
- **UI Components**: shadcn/ui (New York style, slate base)
- **Styling**: Tailwind CSS 4 (mobile-first approach)
- **Database**: Drizzle ORM with PostgreSQL
- **Deployment**: Vercel with Edge Network optimization

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (required package manager)

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd cd4

# Install dependencies (pnpm only)
pnpm install

# Set up environment variables
cp .env.example .env.local
# Configure your database URL and other required variables

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages
├── components/             # Reusable UI components
├── lib/                   # Database operations (strict organization)
│   ├── select.ts          # All SELECT queries
│   ├── insert.ts          # All INSERT queries
│   ├── update.ts          # All UPDATE queries
│   └── delete.ts          # All DELETE queries
├── docs/                  # Project documentation
│   ├── development-guidelines.md  # Comprehensive development guide
│   ├── spec.md            # Technical specifications
│   ├── ui.md              # UI/Component guidelines
│   └── service.md         # Service features documentation
└── db/                    # Database schema and configuration
```

## 🎨 Design System

### Color Standards (Korean Stock Market)

- **Price Up/Profit**: `#D60000` (Red)
- **Price Down/Loss**: `#0066CC` (Blue)
- **Neutral**: `#6B7280` (Gray)
- **UI Base**: Black, white, gray tones only

### Mobile-First Approach

- **Ultra-small (≤400px)**: List layouts, minimal padding
- **Small (401-768px)**: Optimized cards with strategic spacing
- **Large (1025px+)**: Multi-column grids, full table views

## 📖 Development Guidelines

### Essential Rules

1. **Use shadcn/ui first** for all UI components
2. **Avoid nested cards** on small screens (≤400px)
3. **Follow Korean market color standards**
4. **Maintain mobile-first responsive design**
5. **Use Context7 for technical guidance when uncertain**

### Database Operations

All database code must be organized in `/lib` directory:

```typescript
// lib/select.ts - All SELECT operations
export async function getMarketCapRankings(page: number) {
  // Implementation
}

// Use snake_case in database, camelCase in TypeScript
```

### Component Development

```bash
# Always check shadcn first for new components
pnpm dlx shadcn@latest add [component-name]
```

## 🔍 Key Features

- **Market Cap Rankings**: Company and security rankings
- **Financial Metrics**: PER, PBR, EPS, BPS, Dividend analysis
- **Mobile Optimization**: Responsive design for all screen sizes
- **SEO Optimization**: Server-side rendering with dynamic metadata
- **Real-time Data**: Live market data with performance indicators

## 📚 Documentation

- **[Development Guidelines](docs/development-guidelines.md)**: Comprehensive development standards
- **[Technical Specifications](docs/spec.md)**: Detailed technology stack and configuration
- **[UI Guidelines](docs/ui.md)**: Component patterns and responsive design
- **[Service Documentation](docs/service.md)**: API and service features

## 🚀 Build and Deployment

### Development Commands

```bash
# Start development server
pnpm dev

# Run linting
pnpm lint

# Revalidate cache
pnpm cache:revalidate
```

### Production Builds

#### SSG (Static Site Generation) - Recommended

```bash
# Standard build
pnpm build:ssg

# Parallel builds for large datasets (2025년 6월 추가)
pnpm build:staggered     # 지연된 병렬 빌드 (권장)
pnpm build:chunks        # 순차 청크 빌드 (안전함)
pnpm build:parallel-real # 진짜 병렬 빌드 (최고 성능)

# Manual parallel build (최고 성능)
# 4개 터미널에서 동시 실행:
BUILD_CHUNK_INDEX=0 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
BUILD_CHUNK_INDEX=1 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
BUILD_CHUNK_INDEX=2 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
BUILD_CHUNK_INDEX=3 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
```

#### Performance Improvements

- **Single Build**: ~15-20 minutes (full dataset)
- **Parallel Build**: ~4-6 minutes (4 chunks, ~4x improvement)
- **Test Results**: 609 pages successfully generated (100 securities baseline)

#### Build Configuration

```bash
# Environment variables for chunked builds
BUILD_CHUNK_INDEX=0      # Current chunk index (starts from 0)
BUILD_CHUNK_TOTAL=4      # Total number of chunks
BUILD_CHUNK_SIZE=500     # Securities per chunk
```

pnpm build
pnpm sitemap

````

The SSG build process:

1. Generates all static pages (1500+ pages including all stock/company pages)
2. Creates a dynamic sitemap.xml from generated HTML files
3. Outputs to `/out` directory ready for CDN deployment

**Requirements**: Database connection must be available during build. If DB is unavailable, build will fail (no fallback data).

#### Standard Build

```bash
# Build for production (server-side)
pnpm build

# Deploy to Vercel
pnpm deploy
````

### SEO Features

- **Dynamic Sitemap**: Auto-generated from actual build output (1500+ URLs)
- **Robots.txt**: Optimized for search engine crawling
- **Structured Data**: JSON-LD for rich snippets
- **Meta Tags**: Complete OpenGraph and Twitter Card support
- **Mobile-First**: Responsive design with proper viewport settings

### Performance Targets

- **LCP**: < 2.5 seconds
- **FID**: < 100ms
- **CLS**: < 0.1
- **Bundle Size**: < 100KB initial JavaScript

## 🤝 Contributing

1. Follow the development guidelines in `docs/development-guidelines.md`
2. Use pnpm for package management
3. Ensure mobile-first responsive design
4. Maintain Korean stock market color standards
5. Update relevant documentation for any changes

## 📄 License

[Your License Here]

---

For detailed development instructions, please refer to the [Development Guidelines](docs/development-guidelines.md).
