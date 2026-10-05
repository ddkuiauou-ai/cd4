# CD3 - Korean Stock Information Service

> **업그레이드와 운영 기준:** [Next.js 16 변경·검증 결과](docs/next16-upgrade-verification-2026-10-05.md), [문서 안내](docs/README.md), [DAG 연동 계약](docs/dag-integration.md)을 함께 읽으세요. 설치 버전과 실행 명령은 `package.json`, 고정 의존성은 `pnpm-lock.yaml`이 기준입니다.

CD3 provides financial data, rankings, and analysis tools for the Korean stock market. It uses the Next.js App Router and supports static export for CDN hosting alongside a Node.js server build.

## 🎯 Project Overview

- **Target Market**: Korean stock market (KOSPI/KOSDAQ)
- **Design Philosophy**: Professional, quantitative, mobile-optimized
- **Primary Goal**: Information delivery with SEO optimization for search discovery

## 🛠 Technology Stack

- **Framework**: Next.js (App Router, static export and Node.js server modes)
- **UI Components**: shadcn/ui (New York style, slate base)
- **Styling**: Tailwind CSS 4 (mobile-first approach)
- **Database**: Drizzle ORM with PostgreSQL
- **Deployment**: Static export to R2 or Netlify; Vercel is an optional hosting choice

## 🚀 Getting Started

### Prerequisites

- Node.js 22 (use the exact version in `.nvmrc`)
- pnpm 10 (required package manager; follow `packageManager` in `package.json`)
- Read access to a completed PostgreSQL data snapshot for development and production builds

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd cd4

# Install dependencies (pnpm only)
pnpm install --frozen-lockfile

# Set up environment variables
cp .env.example .env.local
# Configure your database URL and other required variables

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
- **SEO Optimization**: Generated HTML, metadata, sitemap, and structured data
- **Market Data**: Published data from the collection and aggregation pipeline

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

# Run the independent typecheck and existing isolated regression tests
pnpm typecheck
pnpm test
```

### Production Builds

#### Node.js server build

```bash
pnpm build
pnpm start
```

Without `NEXT_OUTPUT_MODE=export`, the Next configuration creates standalone output. `pnpm start` runs the conventional local production check and Next prints a standalone warning. For the generated standalone server, package `public` and `.next/static` with it before starting the entry point:

```bash
cp -R public .next/standalone/public
cp -R .next/static .next/standalone/.next/static
PORT=3000 HOSTNAME=127.0.0.1 pnpm exec node .next/standalone/server.js
```

#### Static export — default deployment plan

The R2 and Netlify workflows build with `NEXT_OUTPUT_MODE=export`, remove the request-dependent sitemap Route Handlers in the deployment checkout, then run `NEXT_OUTPUT_MODE=export pnpm sitemap` to generate sitemap files from `out`.

For a local export check, use a separate checkout or copy and reproduce those workflow steps there. Preserve the original `app/sitemap.xml` and `app/sitemaps` sources. Serve the completed `out` directory with a static web server to verify direct URL navigation and assets.

An export publishes a fixed data snapshot. New data appears after a successful rebuild and deployment; runtime ISR and Cache Components are unavailable in this mode. The CI cache stores only `.next/cache/turbopack` compiler artifacts. Keep financial query results separate from that cache.

The workflows remain manually triggered. Uploading `out` or running a Vercel deployment is a separate operation from local build verification. See [Vercel setup](VERCEL_SETUP.md) for the optional Vercel path.

Measure current generated URLs, total files, output size, peak memory, and build/upload times against the same data snapshot. Historical page counts and build durations are not current performance guarantees.

### SEO Features

- **Sitemap**: Generated from actual static HTML output, or served by Route Handlers in server mode
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
