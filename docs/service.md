# CD3 Web Services Documentation

## Overview

CD3 is a comprehensive stock information service providing real-time financial data, rankings, and analysis tools for Korean stock market investors. The service is built with Next.js 15 App Router and emphasizes mobile-first design with professional-grade financial data presentation and SEO optimization for search discovery.

## Core Services

### 1. Market Data Services

#### Market Cap Rankings

- **Corporate Rankings** (`/marketcaps/`): Companies ranked by total market capitalization
- **Security Rankings** (`/marketcap/`): Individual securities ranked by market cap
- Real-time market cap calculations with trend indicators
- Support for pagination with 100 items per page

#### Financial Metrics Rankings

- **BPS (Book Value Per Share)** (`/bps/`): Book value analysis
- **DIV (Dividend Yield)** (`/div/`): Dividend yield rankings
- **DPS (Dividend Per Share)** (`/dps/`): Dividend per share analysis
- **EPS (Earnings Per Share)** (`/eps/`): Earnings performance rankings
- **PBR (Price-to-Book Ratio)** (`/pbr/`): Valuation analysis
- **PER (Price-Earnings Ratio)** (`/per/`): Price-earnings analysis

### 2. Data Visualization Services

#### Interactive Charts

- **30-Day Price Charts**: Sparkline charts showing recent price movements
- **Trend Indicators**: Visual change indicators with color-coded performance
- **Performance Metrics**: Integrated performance data with historical context

#### Responsive Tables

- Mobile-optimized financial data tables
- Adaptive layouts for different screen sizes
- Progressive disclosure for complex financial metrics

### 3. Navigation & Discovery

#### Command Menu

- Global search functionality (`Cmd+K` / `Ctrl+K`)
- Quick navigation to specific metrics and companies
- Intelligent search suggestions

#### Unified 3D Navigation System ✅ **COMPLETED**

- **Intelligent Financial Navigation**: Context-aware routing system that understands user intent

  - **Company Context**: Market Cap analysis stays in company view for comprehensive comparison
  - **Security Context**: Individual metric analysis (PER, PBR, DIV, etc.) in focused security view
  - **Natural Flow**: Users seamlessly move between "company overview" and "detailed analysis" mindsets

- **CompanyFinancialTabs**: Unified navigation hub with smart routing ✅

  - **Context Indicators**: Clear visual feedback showing current navigation context (🏢 Company / 📈 Security)
  - **Intent-Based Design**: Each tab shows the analysis approach (회사 전체 비교 vs 개별 지표 분석)
  - **Hover Tooltips**: Contextual help explaining what each navigation choice provides
  - **Responsive Layout**: 2/4/7 column responsive grid optimized for all screen sizes

- **Simplified Card Navigation**: Clean, purpose-driven interaction design ✅

  - **Intelligent Routing**: Cards automatically navigate to the right context based on current metric
  - **Reduced Complexity**: Removed confusing UI elements (🏢 buttons) in favor of natural flow
  - **Clear Selection States**: Simple ✓ indicators without overwhelming context badges
  - **Metric-Specific Display**: Dynamic content based on current metric (PER, PBR, DIV, DPS, BPS, EPS values)

- **Service-Level Architecture**: ✅
  - **Market Cap → Company Pages**: Comparative analysis across all securities
  - **Financial Metrics → Security Pages**: Deep-dive individual security analysis
  - **Cross-Context Flow**: Users can easily move between company overview and detailed analysis
  - **Type Safety**: Complete Security type definitions with all financial metrics (per, pbr, eps, dps, bps, div)

## API Architecture

### Data Access Layer

#### Database Operations (`/lib/`)

All database operations follow strict organizational patterns:

```typescript
// File: /lib/select.ts - All SELECT operations
export async function getMarketCapRankings(
  page: number = 1,
  limit: number = 100
) {
  // Implementation using Drizzle ORM
}

// File: /lib/insert.ts - All INSERT operations
export async function insertMarketData(data: MarketDataInsert) {
  // Implementation using Drizzle ORM
}

// File: /lib/update.ts - All UPDATE operations
export async function updateSecurityData(
  id: string,
  data: Partial<SecurityUpdate>
) {
  // Implementation using Drizzle ORM
}

// File: /lib/delete.ts - All DELETE operations
export async function deleteOutdatedData(cutoffDate: Date) {
  // Implementation using Drizzle ORM
}
```

#### Data Fetching Utilities (`/lib/getData.ts`)

Centralized data fetching with caching and error handling:

```typescript
// Market-specific data fetching
export async function getMarketCapData(page: number): Promise<MarketCapData[]>;
export async function getFinancialMetrics(
  symbol: string
): Promise<FinancialMetrics>;
export async function getCompanyDetails(
  corpCode: string
): Promise<CompanyDetails>;
```

### Server-Side Rendering (SSR)

#### React Server Components

- **Performance**: All ranking pages use RSC for optimal loading
- **SEO**: Complete server-side HTML generation for search engines
- **Data Freshness**: Real-time data fetching at request time

#### Dynamic Routes

- `/[metric]/[page]/` - Paginated ranking pages
- `/corp/marketcap/[corpCode]/` - Company detail pages
- `/sec/[metric]/[secCode]/` - Security detail pages

### Client-Side Features

#### Interactive Components

- **Mode Toggle**: Dark/light theme switching
- **Pagination**: Client-side navigation with URL updates
- **Charts**: Interactive 30-day price movement displays

#### State Management

- **Theme State**: Persistent dark/light mode preferences
- **Navigation State**: Mobile menu toggle states
- **Search State**: Command menu search functionality

## Performance Optimizations

### Caching Strategy

#### Database Caching

```typescript
import { unstable_cache } from "next/cache";

export const getCachedMarketData = unstable_cache(
  async (page: number) => getMarketCapRankings(page),
  ["market-cap-rankings"],
  {
    revalidate: 300, // 5 minutes
    tags: ["market-data"],
  }
);
```

#### Static Generation

- **Sitemaps**: Automated sitemap generation for all ranking pages
- **Static Paths**: Pre-generated paths for popular companies and metrics
- **Incremental Static Regeneration**: On-demand revalidation for data updates

### Image Optimization

- **Next.js Image Component**: Automatic WebP/AVIF conversion
- **Responsive Images**: Multiple breakpoints for different screen sizes
- **Lazy Loading**: Progressive loading for optimal performance

## Monitoring & Analytics

### Performance Monitoring

- **Vercel Speed Insights**: Core Web Vitals tracking
- **Real User Monitoring**: Performance metrics from actual users
- **Error Tracking**: Automated error reporting and alerting

### Business Analytics

- **Page Views**: Tracking popular financial metrics and companies
- **User Engagement**: Time spent on different ranking pages
- **Search Analytics**: Most searched companies and metrics

## Security Features

### Data Protection

- **Input Validation**: All user inputs validated with Zod schemas
- **SQL Injection Prevention**: Type-safe queries with Drizzle ORM
- **Rate Limiting**: API protection against abuse

### Authentication (Future)

- **Email Magic Links**: Passwordless authentication system
- **Session Management**: Secure session handling with NextAuth.js
- **User Preferences**: Personalized dashboard and watchlists

## Mobile-First Design

### Responsive Breakpoints

```css
/* Ultra-small devices (iPhone Mini/SE) */
@media (max-width: 374px) {
}

/* Small devices (iPhone 12/13/14/15) */
@media (min-width: 375px) {
}

/* Medium devices (tablets) */
@media (min-width: 768px) {
}

/* Large devices (desktops) */
@media (min-width: 1024px) {
}
```

### Touch Optimization

- **Minimum Touch Targets**: 44px minimum for all interactive elements
- **Gesture Support**: Swipe gestures for table navigation
- **Thumb-Friendly Navigation**: Bottom-positioned primary actions

### Progressive Disclosure

- **Collapsed Tables**: Essential data shown first, details on demand
- **Expandable Sections**: Complex financial metrics organized hierarchically
- **Smart Defaults**: Most relevant information displayed by default

## Error Handling

### Client-Side Error Boundaries

```typescript
// Global error boundary for route-level errors
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Server-Side Error Handling

- **Database Connection Errors**: Graceful fallbacks for database issues
- **API Rate Limits**: Respectful handling of external API limitations
- **Data Validation Errors**: Clear user feedback for invalid requests

## Deployment & Infrastructure

### Vercel Platform

- **Edge Runtime**: Optimal performance with global edge deployment
- **Serverless Functions**: Auto-scaling API endpoints
- **CDN Integration**: Global content delivery for static assets

### Database Infrastructure

- **Vercel Postgres**: Managed PostgreSQL with connection pooling
- **Turso Support**: Alternative SQLite-based deployment option
- **Migration Management**: Automated schema migrations with Drizzle Kit

### Environment Configuration

```bash
# Production environment variables
DATABASE_URL=postgresql://...
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
GOOGLE_ADSENSE_ID=...
```

## API Endpoints

### Public APIs

- `GET /api/rankings/[metric]` - Financial metric rankings
- `GET /api/company/[corpCode]` - Company details
- `GET /api/security/[secCode]` - Security details
- `GET /api/search?q=[query]` - Global search functionality

### Internal APIs

- `GET /api/sitemap` - Dynamic sitemap generation
- `GET /api/health` - Service health check
- `POST /api/revalidate` - Cache revalidation triggers

## Future Enhancements

### Planned Features

1. **User Authentication**: Personal watchlists and portfolios
2. **Advanced Analytics**: Technical analysis indicators
3. **Real-time Updates**: WebSocket-based live data feeds
4. **Mobile App**: React Native companion application
5. **API Access**: Public API for third-party integrations

### Performance Improvements

1. **Edge Caching**: Expanded caching strategies
2. **Database Optimizations**: Query performance enhancements
3. **Bundle Optimization**: Further code splitting and optimization
4. **PWA Features**: Offline support and app-like experience

### Development Guidelines

### Service Integration

1. **Check shadcn/ui first** for any new UI component needs
2. **Use Context7** for technical clarification when uncertain
3. **Follow mobile-first approach** for all new features
4. **Maintain strict separation** between data access layers

### Testing Strategy

1. **Mobile Testing**: Validate on actual devices, especially iPhone Mini
2. **Performance Testing**: Regular Core Web Vitals monitoring
3. **SEO Testing**: Verify search engine optimization effectiveness
4. **Cross-browser Testing**: Ensure compatibility across major browsers

### Code Quality

1. **TypeScript Strict Mode**: All code must pass strict type checking
2. **ESLint Compliance**: Follow configured linting rules
3. **Performance Budgets**: Monitor bundle size and loading performance
4. **Documentation**: Update this service documentation for all major changes

---

_This documentation is maintained as part of the CD3 project and should be updated whenever new services or features are added._
