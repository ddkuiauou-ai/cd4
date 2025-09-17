# CD3 Project Coding Instructions

## 🎯 Core Principles

**PRIMARY RULE**: Always use `shadcn` first for UI components. When uncertain about technical implementation or data requirements, consult `Context7` for guidance.

## 🛠 Technology Stack

- **Framework**: Next.js 15 (App Router, SSR-first for SEO)
- **UI Components**: shadcn/ui (`New York` style, `slate` base)
- **Styling**: Tailwind CSS 4 (mobile-first)
- **Database**: Drizzle ORM (direct access via `/lib` files)
- **Documentation**: Context7 (MCP server for technical guidance)

## 🎨 Design Philosophy

**Stock Information Service** - Professional, quantitative, mobile-optimized

- **Target**: Korean stock market data with institutional-grade credibility
- **Approach**: Mobile-first reading optimization, dark mode default
- **Style**: Minimalist, professional, conservative animations
- **Focus**: Information delivery and mobile reading experience

## 🌈 Professional Color System

### Financial Data Colors (Korean Standard)

- **Price Up/Profit**: `#D60000` (Red) - Korean market convention
- **Price Down/Loss**: `#0066CC` (Blue) - Korean market convention
- **Neutral/Unchanged**: `#6B7280` (Gray)

### UI Base Colors (Office/Quant Style)

- **Primary Text**: `#111111` (Near-black for readability)
- **Secondary Text**: `#666666` (Medium gray for metadata)
- **Background**: `#FFFFFF` (Pure white)
- **Card Background**: `#FBFBFB` (Subtle off-white)
- **Borders**: `#E5E5E5` (Light gray)
- **Inactive**: `#CCCCCC` (Disabled elements)

### Brand Accent Colors (Limited Use)

- **Accent 1**: `#d83d1e` (Orange-red for button hover only)
- **Accent 2**: `#f5aa0d` (Warm yellow for badges only)
- **Brand Deep**: `#1c0d04` (Logo text only)

**Usage Rule**: Stick to black/white/gray for UI. Use accent colors sparingly for interactive elements only.

### Chart-Specific Colors

Chart components use independent color schemes optimized for data visualization while maintaining professional appearance.

### Dark Mode Support

- **Background**: `#1a1a1a`
- **Text**: `#f5f5f5`
- **Cards**: `#262626`
- **Borders**: `#404040`

## 🔄 Development Workflow

```
Requirements → shadcn check → Context7 if uncertain → Implement → Document
```

### Component Implementation

1. **Check shadcn first**: `pnpm dlx shadcn@latest add [component]`
2. **Use Context7 for**: Database operations, technical clarification, uncertainty
3. **Apply animations**: Performance-optimized (CSS transforms/opacity)
4. **Test**: Mobile + desktop, ESLint, type checking

## 📁 Database Architecture

**Strict Organization** (Context7 required for guidance):

```
lib/
├── insert.ts    # All insert operations
├── delete.ts    # All delete operations
├── update.ts    # All update operations
└── select.ts    # All select operations
```

**Rules**:

- No database code outside these 4 files
- Use `Context7` for DB questions when uncertain
- Naming: `snake_case` (DB) → `camelCase` (TypeScript)

## 📱 Mobile-First Strategy

- **Typography**: Optimized for mobile reading
- **Animations**: Strategic micro-interactions to prevent text monotony
- **Performance**: Server components first, client-side when necessary
- **UX**: Progressive disclosure, intuitive interfaces
- **Card Strategy**: Avoid nested card structures on small screens (iPhone SE/Mini)

## 📚 Documentation Requirements

**Always Update**:

- `docs/spec.md`: Technical specifications
- `docs/ui.md`: **Complete UI guidelines** (shadcn components + responsive design patterns)
- `docs/service.md`: Web service features and API documentation

**Current Monitoring**:

- Vercel Analytics, Speed Insights, Error Tracking

## ⚡ Quick Reference

- **Uncertainty?** → Use `Context7`
- **New Component?** → Check `shadcn` first
- **UI/Responsive Design?** → Follow `docs/ui.md`
- **Database Operation?** → Use `Context7` + `/lib` files only
- **Animation?** → CSS transforms/opacity preferred (see ui.md)
- **Testing?** → Mobile-first validation required
- **Package Manager?** → pnpm only (never npm)
