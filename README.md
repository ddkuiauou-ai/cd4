# CD - Korean Stock Information Service

> **현재 업무 데이터 기준:** [CD → tem 저장 계약 v2](docs/cd-business-schema-contract-2026-10-07.md), [PostgreSQL 18 설치 안내](docs/postgresql.md), [검증 기록](docs/cd-business-schema-verification-2026-10-07.md), [문서 안내](docs/README.md)를 먼저 읽으세요. 설치 버전과 명령은 `package.json`, 의존성은 `pnpm-lock.yaml`이 기준입니다. 이전 DAG/Next.js 조사 문서는 해당 날짜의 기록입니다.

CD provides raw Korean stock history and the currently published official metrics, company market caps, and rankings. It uses the Next.js App Router and a Node.js standalone server for the current request-time database views.

tem collects and corrects source data, resolves dated security identities, and calculates, validates, and publishes official results. CD owns the business schema, exact DTOs, queries and display. Period averages, minimum/maximum values and changes are calculated by CD for the selected screen window.

## 🎯 Project Overview

- **Target Market**: Korean stock market (KOSPI/KOSDAQ/KONEX, subject to source coverage)
- **Design Philosophy**: Professional, quantitative, mobile-optimized
- **Primary Goal**: Information delivery with SEO optimization for search discovery

## 🛠 Technology Stack

- **Framework**: Next.js App Router, Node.js standalone server
- **UI Components**: shadcn/ui (New York style, slate base)
- **Styling**: Tailwind CSS 4 (mobile-first approach)
- **Database**: PostgreSQL 18, Drizzle ORM `postgres-js` adapter and the `postgres` driver
- **Deployment**: Node.js server for current views; historical static export workflows require a separate review

## 🚀 Getting Started

### Prerequisites

- Node.js 22 (use the exact version in `.nvmrc`)
- pnpm 10 (required package manager; follow `packageManager` in `package.json`)
- PostgreSQL 18 with the committed schema; tem prepares source rows and published official results

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd cd4

# Install dependencies (pnpm only)
pnpm install --frozen-lockfile

# Set up environment variables
cp .env.example .env
# Configure your PostgreSQL connection and other required variables

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

To initialize a **new empty PostgreSQL 18 database**, follow the [installation guide](docs/postgresql.md). Install `0000_postgresql_init.sql` → `0001_business_result_contract.sql` → `0002_simplify_publication.sql` for the final **14 tables**. The one new table, `result_publication`, describes the currently published official result; the existing security/company/rank tables hold its values. 0002 removes four custom functions and eight triggers and adds three row CHECKs, without changing columns or input formats. tem validates each result bundle before publishing its rows and header in one transaction. Creating tables does not populate market data. Existing data migration and baseline are outside this change.

KRX daily timestamps represent Asia/Seoul midnight, while business-date DTOs use Korean `YYYY-MM-DD`. Actual zero and negative indicator values are preserved; missing fields are NULL with explicit states. `bigint`, `numeric`, and revision values remain exact decimal strings in JSON/CSV. Latest missing values and last provided values are shown separately. See the [input and publication contract](docs/cd-business-schema-contract-2026-10-07.md).

The schema is **installed in DCD** at `192.168.50.27:25433/dcd`, using `silla` on PostgreSQL 18.6. The target was confirmed empty before the initial installation; 0002 then applied successfully and a repeat run made no changes (both exit 0). At 2026-10-07 05:16:56 KST, the final catalog and all three migration hashes matched: 14 tables, 286 columns, 71 secondary indexes, 12 FKs, 168 CHECKs and six enums. No CD custom guard functions or public custom triggers remain; three publication FKs remain initially deferred. All 14 business tables are empty. PCD was neither accessed nor changed.

The isolated PG18 test passed (1 pass, 0 fail, 0 skip), including a test writer's key locking, expected revision checks, final validation and rollback. All 130 unit/regression tests, typecheck and `db:check` passed. A production build using actual DCD passed, followed by 13 HTTP checks each on development port 3001 and standalone port 3107 (26 passes): ten unpublished ranking pages returned 200, two unpublished CSV endpoints returned 404, and search returned 200 with `[]`. Development port 3001 is running after restart. Actual tem collection, writer and official calculation integration still await data; the test writer and empty-state checks do not establish that integration.

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages
├── components/             # Reusable UI components
├── lib/
│   ├── data/              # Published snapshots, raw history queries and exact DTOs
│   ├── business-analysis.ts  # Selected-window screen analysis
│   └── business-metadata.ts  # Identity-based page metadata
├── drizzle/               # 0000 → 0001 → 0002 installation SQL and snapshots
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

The maintained schema is `db/schema-postgres.ts`, the runtime connection is `db/index.ts`, and the installation SQL is in `drizzle/`. Apply the committed migration chain: 0002 removes the custom publication guards while preserving PK/UNIQUE/FK and row CHECKs. A schema push does not replace the migration ledger or the three initially deferred publication FK declarations. tem checks input validity, revision and result coverage, serializes writers for the same publication key, and publishes rows and header in one transaction. cd4 does not provide a Turso, libSQL, or SQLite deployment path. tem follows the [current CD business contract](docs/cd-business-schema-contract-2026-10-07.md).

Current read queries and DTO conversion are in `lib/data`. Official values are written by tem, then read with matching publication identifiers and a consistent request snapshot:

```typescript
// Read the published result; CD does not recalculate official company totals/ranks.
// lib/data/company.ts, lib/data/security.ts, lib/data/publication.ts

// Use snake_case in database, camelCase in TypeScript
```

### Component Development

```bash
# Always check shadcn first for new components
pnpm dlx shadcn@latest add [component-name]
```

## 🔍 Key Features

- **Market Cap Rankings**: Company and security rankings
- **Financial Metrics**: Latest and last provided PER, PBR, EPS, BPS, DIV and DPS, with dates and missing states
- **Source History**: Selected-period source observations and screen analysis
- **Mobile Optimization**: Responsive design for all screen sizes
- **SEO Optimization**: Generated HTML, metadata, sitemap, and structured data
- **Market Data**: tem source data and currently published official calculation results

## 📚 Documentation

- **[Development Guidelines](docs/development-guidelines.md)**: Comprehensive development standards
- **[Technical Specifications](docs/spec.md)**: Detailed technology stack and configuration
- **[UI Guidelines](docs/ui.md)**: Component patterns and responsive design
- **[Service Documentation](docs/service.md)**: API and service features
- **[CD → tem Contract](docs/cd-business-schema-contract-2026-10-07.md)**: Exact inputs, missing states, correction and atomic publication rules
- **[PostgreSQL Guide](docs/postgresql.md)**: PostgreSQL 18 connection and new empty DB installation
- **[Verification Record](docs/cd-business-schema-verification-2026-10-07.md)**: Actual isolated checks and remaining integration limits

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

### PostgreSQL Commands

```bash
# Generate and check versioned migrations without a database connection
pnpm db:generate
pnpm db:check

# Apply pending committed migrations; fresh installation is 0000 → 0001 → 0002
pnpm db:migrate

# Open the configured PostgreSQL database in Drizzle Studio
pnpm db:studio

# PostgreSQL 18 is required; missing/unsupported tools fail rather than silently skip
pnpm test:db
# For a version-specific native installation:
# CD_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin pnpm test:db
```

Drizzle's connection commands read `.env` and process environment variables. A nonempty `DATABASE_URL` takes precedence over individual PostgreSQL fields. Confirm host, port, database and account before applying the installation SQL. `test:db` ignores application connection settings and uses its own temporary local cluster. See the [PostgreSQL guide](docs/postgresql.md).

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

#### Historical static export workflows

The existing R2/Netlify workflows and export setting describe the earlier fixed-snapshot deployment. Current pages query the database at request time and use dynamic route behavior. The current implementation targets server mode; an export requires a separately agreed snapshot/export design. Automated rebuild, upload and deployment are outside this change.

For the previous mode's history, read [Next.js 16 upgrade verification](docs/next16-upgrade-verification-2026-10-05.md) and [Vercel setup](VERCEL_SETUP.md). Those records do not establish that the new dynamic views can be exported unchanged.

Financial result revisions are separate from compiler artifacts and source-history corrections. The initial implementation does not add long-lived data caching; page and CSV requests detect a replaced result revision.

Deployment is a separate operation from local tests and builds. The current change does not publish the site or change deployment workflows.

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
