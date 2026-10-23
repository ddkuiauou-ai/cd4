# shadcn/ui & UI Development Context

Framework compatibility checked on 2026-10-23: Next.js 16.4.2 with React/React DOM 19.3.1 and React types 19.3.0. The existing component, theme and responsive layout contracts remain in place; validation evidence is recorded in [upgrade verification](next-upgrade-2026-10-23.md).

This document serves as the **single source of truth** for all UI-related development in the 천하제일 단타대회 project, including shadcn/ui configuration, responsive design patterns, component guidelines, and service branding.

**Last Updated:** June 15, 2025

## 🌟 Service Identity & Brand Guidelines

### Service Naming Standards

- **Official Service Name**: 천하제일 단타대회
- **Short Form/Internal**: 천단
- **Domain**: https://www.chundan.xyz

#### Usage Guidelines

```tsx
// ✅ Formal contexts: Page titles, service introduction
<h1>천하제일 단타대회 - 한국 주식 정보 서비스</h1>
<meta property="og:site_name" content="천하제일 단타대회" />

// ✅ UI contexts: Navigation, buttons, cards (limited space)
<nav aria-label="천단 메인 네비게이션">
<Button>천단 홈</Button>
<span className="text-xs">© 2025 천단</span>

// ✅ Playful/Dynamic usage allowed
<h2>천하제일 수익률 랭킹</h2>
<Badge>단타대회 참가</Badge>
```

### 🎯 Logo System & Brand Mark

#### Core Brand Elements

- **Primary Symbol**: Star mark (⭐) within circle - playful yet professional
- **Logo File**: `public/icon.svg` (vector format for scalability)
- **Typography**: 궁서체-inspired for serious financial tone
- **Brand Combination**: Symbol + Text "천하제일 단타대회"

#### Logo Usage Patterns

##### 1. Mobile Minimal Version

```tsx
// Symbol-only for mobile headers (≤768px)
<div className="flex items-center md:hidden">
  <Image
    src="/icon.svg"
    alt="천단"
    width={24}
    height={24}
    className="w-6 h-6"
  />
</div>
```

##### 2. Vertical Stack Layout

```tsx
// For square/compact spaces
<div className="flex flex-col items-center space-y-1">
  <span className="text-xs font-medium">천하제일</span>
  <Image src="/icon.svg" alt="천단 로고" width={32} height={32} />
  <span className="text-xs font-medium">단타대회</span>
</div>
```

##### 3. Horizontal Combination

```tsx
// For desktop headers and wide layouts
<div className="hidden md:flex items-center space-x-2">
  <Image src="/icon.svg" alt="천단" width={28} height={28} />
  <div className="flex flex-col">
    <span className="text-sm font-bold leading-tight">천하제일</span>
    <span className="text-sm font-bold leading-tight">단타대회</span>
  </div>
</div>
```

##### 4. Curved/Wrapping Layout

```tsx
// For creative layouts and marketing sections
<div className="relative">
  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs">
    천하제일
  </div>
  <Image
    src="/icon.svg"
    alt="천단"
    width={40}
    height={40}
    className="mx-auto my-2"
  />
  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs">
    단타대회
  </div>
</div>
```

#### Brand Usage Rules

```tsx
// ✅ GOOD: Consistent brand application
const Header = () => (
  <header className="border-b">
    <div className="container flex items-center justify-between py-4">
      {/* Mobile: Symbol only */}
      <Link href="/" className="md:hidden">
        <Image src="/icon.svg" alt="천단" width={24} height={24} />
      </Link>

      {/* Desktop: Full brand */}
      <Link href="/" className="hidden md:flex items-center space-x-2">
        <Image src="/icon.svg" alt="천단" width={28} height={28} />
        <span className="font-bold">천하제일 단타대회</span>
      </Link>
    </div>
  </header>
);

// ❌ AVOID: Text duplication or inconsistent sizing
const BadHeader = () => (
  <header>
    {/* Don't repeat text in both logo and separate text */}
    <div className="flex items-center">
      <div>천하제일 단타대회</div> {/* Text already in logo */}
      <Image src="/logo-with-text.svg" alt="..." /> {/* Duplicate text */}
    </div>
  </header>
);
```

#### Responsive Logo Component

```tsx
// Reusable logo component with responsive behavior
interface LogoProps {
  variant?: "minimal" | "horizontal" | "vertical" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Logo = ({
  variant = "horizontal",
  size = "md",
  className,
}: LogoProps) => {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  if (variant === "minimal") {
    return (
      <Image
        src="/icon.svg"
        alt="천단"
        width={24}
        height={24}
        className={cn(sizeClasses[size], className)}
      />
    );
  }

  if (variant === "vertical") {
    return (
      <div className={cn("flex flex-col items-center space-y-1", className)}>
        <span className="text-xs font-medium">천하제일</span>
        <Image src="/icon.svg" alt="천단" className={sizeClasses[size]} />
        <span className="text-xs font-medium">단타대회</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Image src="/icon.svg" alt="천단" className={sizeClasses[size]} />
      <span className="font-bold">천하제일 단타대회</span>
    </div>
  );
};
```

## Configuration

- **Style:** New York (required)
- **Base Color:** slate (required)
- **Icon Library:** lucide
- **Theme:** Dark mode default
- **CSS Variables:** Enabled

## 🎨 Professional Color System

### 🎯 Design Principles

**Office & Quant Style**: Black, white, and gray-centric professional color scheme optimized for data readability and information delivery.

**Color Usage Guidelines**:

- **Information Colors**: Used only for meaningful data (up/down, alerts)
- **Brand Colors**: Limited to logo elements and minimal UI accents
- **Chart Colors**: Independently defined within chart components

### 📈 Financial Data Colors (Korean Market Standards)

```css
/* Korean Stock Market Convention */
.price-up {
  color: oklch(45.2% 0.313 25.86);
} /* Red: Up/Profit #D60000 */
.price-down {
  color: oklch(42.1% 0.194 258.34);
} /* Blue: Down/Loss #0066CC */
.neutral {
  color: oklch(54.9% 0.04 258.18);
} /* Gray: Unchanged #6B7280 */
```

```tsx
// ✅ CORRECT: Korean market standards
<span className="text-[oklch(45.2%_0.313_25.86)] font-mono">+2.34%</span> {/* Price up */}
<span className="text-[oklch(42.1%_0.194_258.34)] font-mono">-1.87%</span> {/* Price down */}
<span className="text-[oklch(54.9%_0.040_258.18)] font-mono">0.00%</span>  {/* Unchanged */}

// ❌ AVOID: Wrong colors for financial data
<span className="text-green-600">+2.34%</span> {/* Wrong for Korean market */}
<span className="text-red-600">-1.87%</span>   {/* Wrong for Korean market */}
```

### 🖤 UI Base Color Palette

| Purpose               | Color                       | Description          | Usage                             |
| --------------------- | --------------------------- | -------------------- | --------------------------------- |
| **Primary Text**      | `oklch(20.4% 0.005 258.34)` | Near-black deep gray | Main content, headers             |
| **Background**        | `oklch(100% 0 0)`           | Pure white           | Page backgrounds                  |
| **Secondary Text**    | `oklch(49.0% 0.005 258.34)` | Medium gray          | Descriptions, metadata            |
| **Borders/Dividers**  | `oklch(91.8% 0.003 258.34)` | Light gray           | Card borders, separators          |
| **Inactive Elements** | `oklch(83.2% 0.003 258.34)` | Disabled gray        | Inactive buttons, placeholders    |
| **Card Background**   | `oklch(98.4% 0.002 258.34)` | Off-white            | Card backgrounds, subtle contrast |

```tsx
// ✅ GOOD: Professional UI color usage
<div className="bg-white text-[oklch(20.4%_0.005_258.34)]">
  <h1 className="font-bold text-[oklch(20.4%_0.005_258.34)]">천하제일 단타대회</h1>
  <p className="text-[oklch(49.0%_0.005_258.34)]">한국 주식 시장 전문 정보</p>
  <div className="border border-[oklch(91.8%_0.003_258.34)] bg-[oklch(98.4%_0.002_258.34)] p-4">
    <span className="text-[oklch(83.2%_0.003_258.34)]">비활성 상태</span>
  </div>
</div>

// ❌ AVOID: Excessive color usage
<div className="bg-gradient-to-r from-purple-500 to-pink-500">
  <h1 className="text-yellow-400">Overly colorful design</h1>
</div>
```

### ⭐ Brand Accent Colors (Logo-Based)

**Limited Usage**: These colors are extracted from the star logo and should be used sparingly for accents only.

| Purpose        | OKLCH                      | HEX       | Description | Usage Context                      |
| -------------- | -------------------------- | --------- | ----------- | ---------------------------------- |
| **Accent 1**   | `oklch(47.8% 0.209 31.68)` | `#d83d1e` | Orange-Red  | Button hover, link emphasis        |
| **Accent 2**   | `oklch(76.5% 0.162 82.48)` | `#f5aa0d` | Warm Yellow | Badges, graphic points             |
| **Deep Brown** | `oklch(14.2% 0.037 35.83)` | `#1c0d04` | Logo Text   | Logo area, special titles only     |
| **Sub Brown**  | `oklch(53.4% 0.049 75.96)` | `#907946` | Muted Brown | **Use sparingly**, logo zones only |

```tsx
// ✅ GOOD: Minimal brand color usage
<Button
  className="bg-[oklch(20.4%_0.005_258.34)] text-white hover:bg-[oklch(47.8%_0.209_31.68)] transition-colors"
>
  천단 랭킹 보기
</Button>

<Badge className="bg-[oklch(76.5%_0.162_82.48)] text-[oklch(14.2%_0.037_35.83)]">
  NEW
</Badge>

// ✅ GOOD: Logo-specific brand colors
<div className="logo-area">
  <span className="text-[oklch(14.2%_0.037_35.83)] font-bold">천하제일</span>
  <Image src="/icon.svg" alt="천단" />
  <span className="text-[oklch(53.4%_0.049_75.96)]">단타대회</span>
</div>

// ❌ AVOID: Overuse of brand colors
<Card className="bg-[oklch(76.5%_0.162_82.48)] border-[oklch(47.8%_0.209_31.68)]"> {/* Too much color */}
  <CardContent className="text-[oklch(53.4%_0.049_75.96]">
    Content area should remain neutral
  </CardContent>
</Card>
```

### 🌙 Dark Mode Color System

```css
/* Dark Mode Equivalents */
.dark .bg-white {
  background-color: #1a1a1a;
}
.dark .text-[#111111] {
  color: #f5f5f5;
}
.dark .text-[#666666] {
  color: #a3a3a3;
}
.dark .border-[#E5E5E5] {
  border-color: #404040;
}
.dark .bg-[#FBFBFB] {
  background-color: #262626;
}
```

```tsx
// ✅ GOOD: Dark mode aware components
<Card
  className="
  bg-white dark:bg-[#1a1a1a] 
  border-[#E5E5E5] dark:border-[#404040]
  text-[#111111] dark:text-[#f5f5f5]
"
>
  <CardHeader>
    <CardTitle className="text-[#111111] dark:text-[#f5f5f5]">
      시가총액 랭킹
    </CardTitle>
    <p className="text-[#666666] dark:text-[#a3a3a3]">실시간 업데이트</p>
  </CardHeader>
</Card>
```

### 📊 Chart Color Guidelines

Chart components use independent color schemes optimized for data visualization:

```tsx
// Chart colors are defined within chart components
const chartColors = {
  primary: '#2563eb',    // Blue for primary data
  secondary: '#64748b',  // Gray for secondary data
  positive: '#D60000',   // Korean market up (red)
  negative: '#0066CC',   // Korean market down (blue)
  neutral: '#6B7280'     // Unchanged
}

// ✅ GOOD: Chart-specific color usage
<ResponsiveContainer>
  <LineChart data={data}>
    <Line
      dataKey="price"
      stroke={data.change > 0 ? '#D60000' : '#0066CC'}
    />
  </LineChart>
</ResponsiveContainer>
```

### 🛠 Tailwind Configuration

Add these custom colors to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        // Financial Data Colors
        "market-up": "#D60000",
        "market-down": "#0066CC",
        "market-neutral": "#6B7280",

        // Professional UI Colors
        "text-primary": "#111111",
        "text-secondary": "#666666",
        "border-light": "#E5E5E5",
        inactive: "#CCCCCC",
        "bg-subtle": "#FBFBFB",

        // Brand Accent Colors (use sparingly)
        "brand-accent-1": "#d83d1e",
        "brand-accent-2": "#f5aa0d",
        "brand-deep": "#1c0d04",
        "brand-sub": "#907946",
      },
    },
  },
};
```

```tsx
// ✅ GOOD: Using custom Tailwind colors
<div className="bg-white text-text-primary">
  <h1 className="text-brand-deep font-bold">천하제일 단타대회</h1>
  <p className="text-text-secondary">전문 주식 정보 서비스</p>

  <div className="border border-border-light bg-bg-subtle p-4">
    <span className="text-market-up font-mono">+5.67%</span>
    <span className="text-market-down font-mono">-2.34%</span>
  </div>

  <Button className="bg-text-primary hover:bg-brand-accent-1">더 보기</Button>
</div>
```

## Installed Components

- alert.tsx
- avatar.tsx
- badge.tsx
- button.tsx
- card.tsx
- carousel.tsx
- checkbox.tsx
- dialog.tsx
- dropdown-menu.tsx
- input.tsx
- label.tsx
- progress.tsx
- slider.tsx
- sonner.tsx
- table.tsx
- tabs.tsx
- textarea.tsx
- tooltip.tsx

## Responsive Design Patterns

### 1. Fundamental Layout Principles

Every UI element is considered a "box" (`<div>`, `<section>`, etc.). These boxes form nested structures in JSX to build complex layouts.

- **Parent-Child Nesting**: Parents control layout behaviors (e.g., Flexbox, Grid) applied to child elements.

```tsx
<div className="flex flex-col gap-4">
  <div className="p-4 bg-gray-100">Box 1</div>
  <div className="p-4 bg-gray-200">Box 2</div>
</div>
```

### 2. Flexbox vs Grid Strategy

**Use Flexbox for:**

- Flexible, wrapping layouts
- Adaptive content alignment
- Dynamic spacing

```tsx
<div className="flex flex-wrap gap-4">
  <div className="flex-grow basis-0 bg-blue-200 p-2">Flexible</div>
  <div className="basis-auto bg-green-200 p-2">Fixed</div>
</div>
```

**Use CSS Grid for:**

- Fixed, structured layouts
- Clearly defined columns and rows

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <Card />
  <Card />
</div>
```

### 3. Positioning & Alignment

**Positioning Elements:**

```tsx
// Relative parent for absolute children
<div className="relative">
  <button className="absolute top-2 right-2">Close</button>
</div>

// Sticky navigation
<header className="sticky top-0 bg-white shadow">Navigation</header>
```

**Content Alignment:**

```tsx
// Horizontal & vertical alignment
<div className="flex justify-between items-center p-4">
  <Logo />
  <NavMenu />
</div>

// Centering with max width
<div className="max-w-screen-lg mx-auto p-4">Content</div>
```

### 4. Common Flexbox Patterns

**Equal-width flex children:**

```tsx
<div className="flex">
  <div className="basis-0 flex-grow p-2">Equal width 1</div>
  <div className="basis-0 flex-grow p-2">Equal width 2</div>
</div>
```

**Avoid `basis-auto` with `flex-grow` unless uneven growth is desired.**

## Mobile-First Development

### Priority Guidelines

1. **Start with mobile** (320px+)
2. **Progressive enhancement** for tablets (768px+) and desktop (1024px+)
3. **Dark mode first** (CD3 default)
4. **Performance-optimized animations** (transforms/opacity only)

### Responsive Breakpoints

```tsx
{
  /* Mobile: stacked, Tablet: 2-cols, Desktop: 3-cols */
}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card />
</div>;
```

### 📱 Small Screen Strategy (iPhone Mini & Compact Devices)

**Problem**: Card-in-card structures create excessive margin/padding accumulation on small screens (≤400px), reducing actual content area significantly.

**Solution Framework**:

#### 1. Card Depth Limitation

```tsx
// ✅ Good: Single-level card structure
<Card className="p-4">
  <div className="space-y-4">
    <h2>Content Title</h2>
    <p>Direct content without nested cards</p>
  </div>
</Card>

// ❌ Avoid: Nested card structures on small screens
<Card className="p-4">
  <Card className="p-4"> {/* Double padding/margin impact */}
    <p>Constrained content area</p>
  </Card>
</Card>
```

#### 2. Adaptive Layout Patterns

**Breakpoint-based Card Alternatives**:

```tsx
{
  /* Auto-adapts: Cards on larger screens, list on small */
}
<div className="grid grid-cols-1 gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Small screens: minimal gap, list-like */}
  {/* Larger screens: card-based layout */}
</div>;

{
  /* Conditional card styling */
}
<div
  className="
  bg-card rounded-none border-none p-2
  sm:bg-card sm:rounded-lg sm:border sm:p-4
"
>
  Content adapts to screen size
</div>;
```

#### 3. Compact Component Variants

**Card Component Variants**:

```tsx
// Compact variant for small screens
<Card variant="compact" className="p-2 m-1 border-none shadow-none">
  <CardContent className="p-0">
    {/* Minimal padding, maximum content area */}
  </CardContent>
</Card>

// Standard variant for larger screens
<Card variant="default" className="p-4 m-4">
  <CardContent>
    {/* Normal spacing */}
  </CardContent>
</Card>
```

#### 4. Critical Breakpoints for CD3

```tsx
// Ultra-small devices (iPhone Mini, SE)
const breakpoints = {
  xs: '320px',    // iPhone SE
  sm: '375px',    // iPhone Mini
  md: '390px',    // Standard iPhone
  lg: '428px',    // iPhone Pro Max
}

// Implementation example
<div className="
  p-1 gap-1 rounded-none border-none     /* xs: minimal styling */
  sm:p-2 sm:gap-2 sm:rounded-md         /* sm: slight enhancement */
  md:p-4 md:gap-4 md:rounded-lg md:border /* md+: full card styling */
">
```

#### 5. Alternative Layout Strategies

**List-based Fallback**:

```tsx
{
  /* Card layout transforms to list on very small screens */
}
<div
  className="
  divide-y divide-border              /* xs-sm: list dividers */
  sm:divide-none sm:grid sm:grid-cols-2 sm:gap-4  /* sm+: card grid */
"
>
  <div className="py-2 sm:p-4 sm:bg-card sm:rounded-lg">Content item</div>
</div>;
```

**Progressive Disclosure**:

```tsx
{
  /* Accordion/collapsible for complex content on small screens */
}
<Collapsible className="sm:hidden">
  <CollapsibleTrigger>View Details</CollapsibleTrigger>
  <CollapsibleContent>
    {/* Complex content hidden behind interaction */}
  </CollapsibleContent>
</Collapsible>;

{
  /* Full layout for larger screens */
}
<div className="hidden sm:block">
  <Card>{/* Full detailed view */}</Card>
</div>;
```

### 📐 Small Screen Design Rules

1. **Maximum 1-level card nesting** on screens ≤400px
2. **Minimize padding/margins**: Use `p-1` or `p-2` instead of `p-4`
3. **Remove visual depth**: Eliminate shadows, borders, rounded corners on ultra-small screens
4. **Full-width utilization**: Use `mx-0` and edge-to-edge layouts
5. **Vertical-first layouts**: Stack everything vertically, minimize horizontal spacing

### 🧪 Testing Guidelines

**Required Test Devices**:

- iPhone Mini (375×667px)
- iPhone SE (320×568px)
- Samsung Galaxy S22 (360×800px)
- Pixel 7a (412×915px)

**Test Checklist**:

- [ ] Content fully visible without horizontal scroll
- [ ] Interactive elements easily tappable (44px+ touch targets)
- [ ] No text truncation in essential areas
- [ ] Navigation remains accessible

## Custom Components

- Dashboard.tsx (Main dashboard with market overviews)
- MarketSummary.tsx (Market indices overview)
- MarketTrends.tsx (Trending stocks display)
- NetworkStatus.tsx (Real-time data connection status)
- SearchBar.tsx (Enhanced stock search component)
- StockCard.tsx (Stock information card)
- StockChart.tsx (Stock price visualization)
- StockInfo.tsx (Detailed stock information)
- SecurityCompareTable.tsx (Securities comparison)
- ScreenerFilter.tsx (Stock screening filters)

## Animation Guidelines

- **Performance-Optimized**: CSS transforms/opacity preferred
- **Mobile-First**: Strategic micro-interactions
- **Avoid**: Layout-triggering properties (width, height, margin, padding)
- **Use**: transform, opacity, filter

**Animation Examples:**

```tsx
// ✅ Good: Transform-based
<div className="transition-transform hover:scale-105">

// ✅ Good: Opacity-based
<div className="transition-opacity hover:opacity-80">

// ❌ Avoid: Layout-triggering
<div className="transition-all hover:w-full">
```

## Component Planning

Always document responsive behavior:

```tsx
{/* Desktop: 3-columns, Tablet: 2-columns, Mobile: stacked */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

## Implementing Small Screen Adaptations

### shadcn Component Extensions

**Create adaptive Card variants** in your component library:

```tsx
// components/ui/adaptive-card.tsx
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdaptiveCardProps extends React.ComponentProps<typeof Card> {
  variant?: "default" | "compact" | "list";
  forceCompact?: boolean;
}

export function AdaptiveCard({
  variant = "default",
  forceCompact = false,
  className,
  children,
  ...props
}: AdaptiveCardProps) {
  const compactClasses =
    "p-2 m-1 border-none shadow-none rounded-none bg-transparent";
  const defaultClasses = "p-4 m-4 border shadow-sm rounded-lg bg-card";

  return (
    <Card
      className={cn(
        // Base responsive behavior
        variant === "compact" || forceCompact
          ? compactClasses
          : "p-1 border-none shadow-none rounded-none bg-transparent sm:p-4 sm:border sm:shadow-sm sm:rounded-lg sm:bg-card",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
```

### Tailwind Config Updates

Add ultra-small breakpoints:

```js
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      xs: "320px", // iPhone SE
      sm: "375px", // iPhone Mini
      md: "768px", // Tablet
      lg: "1024px", // Desktop
      xl: "1280px", // Large desktop
    },
  },
};
```

### Utility Classes for Small Screens

```tsx
// Common patterns for small screen optimization
const smallScreenUtils = {
  // Remove card styling on small screens
  adaptiveCard:
    "border-none shadow-none rounded-none p-2 sm:border sm:shadow-sm sm:rounded-lg sm:p-4",

  // Progressive spacing
  adaptiveSpacing: "gap-1 sm:gap-2 md:gap-4",

  // Content area maximization
  maxContent: "px-1 sm:px-4 md:px-6",

  // List fallback
  listFallback: "divide-y sm:divide-none sm:grid sm:grid-cols-2 md:grid-cols-3",
};
```

## Development Commands

```bash
# Add new component (always use pnpm)
pnpm dlx shadcn@latest add [component-name]

# Update existing components
pnpm dlx shadcn@latest update
```

## Notes

- **PRIMARY RULE**: Always check shadcn first, then Context7 for uncertainty
- **Package Manager**: pnpm only (never npm)
- **Style Requirements**: New York style + slate base mandatory
- **Target**: Professional stock information service
- **Mobile-First**: All UI development starts mobile, progresses up
- **Small Screen Priority**: Test on iPhone Mini/SE for optimal mobile experience

## Navigation UI Improvements (June 2025)

### Enhanced Button States & Interactions

#### 1. CorpSecTabs (기업/종목 토글)

**Before vs After:**

```tsx
// Before: 압도적인 primary 색상
data-[state=active]:bg-primary

// After: 더 부드러운 활성 상태
data-[state=active]:bg-primary/80
data-[state=active]:shadow-md (shadow-lg → shadow-md)
data-[state=active]:scale-[1.01] (scale-[1.02] → scale-[1.01])
```

#### 2. MarketNav 메트릭 버튼

**Before vs After:**

```tsx
// Before: 그라데이션 + 강한 ring
"bg-gradient-to-r from-primary to-primary/90";
"ring-2 ring-primary/20";

// After: 단순하고 세련된 활성 상태
"bg-primary/85";
"ring-1 ring-primary/25";
"hover:bg-primary/8";
"hover:border-primary/25";
```

#### 3. Info 툴팁 아이콘

**Before vs After:**

```tsx
// Before: 강렬한 primary 색상
hover: text - primary;

// After: 부드러운 호버 효과
hover: text - primary / 80;
```

### Transition Improvements

- **Duration**: 더 빠른 상호작용을 위해 `duration-200` 사용
- **Scale Effects**: 미세한 크기 변화 (`scale-[1.01]`)로 성능 최적화
- **Opacity Based**: 색상 변화는 opacity 조절로 부드럽게 처리

### Visual Hierarchy Enhancement

1. **Active States**: 80-85% opacity로 강도 조절
2. **Hover States**: 8% opacity로 subtle feedback
3. **Border/Ring**: 25% opacity로 경계선 강조
4. **Shadow**: `md` 레벨로 적절한 깊이감 유지

## UI/UX Enhancement Guidelines (June 2025 Update)

### Visual Hierarchy Best Practices

#### Financial Data Emphasis

```tsx
// Primary financial values (시가총액, 주가)
<div className="font-bold text-2xl md:text-3xl text-primary tabular-nums">
  {formatNumber(marketcap)}
</div>

// Company names
<h2 className="font-bold text-xl md:text-2xl text-foreground hover:text-primary">
  {companyName}
</h2>

// Secondary information (종목코드, 거래소)
<span className="text-sm text-muted-foreground font-medium">
  {ticker}
</span>
```

#### Enhanced Spacing Patterns

```tsx
// Mobile card spacing
<div className="space-y-6"> {/* Increased from space-y-4 */}

// Table row spacing
<td className="px-6 py-6"> {/* Increased from py-4 */}

// Section spacing
<div className="mb-10"> {/* Enhanced from mb-8 */}
```

#### Chart Container Enhancements

```tsx
// Enhanced chart containers
<div className="rounded-xl overflow-hidden border-2 border-muted/30 bg-gradient-to-br from-background to-muted/20 p-3 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
  <SpikeChart {...props} />
</div>
```

### Interactive Element Standards

#### Button Consistency

```tsx
// Standard interactive button
<Button className="transition-all duration-200 hover:scale-[1.02] focus:scale-[1.02] hover:bg-primary/8">

// Tab triggers with consistent styling
<TabsTrigger className="data-[state=active]:bg-primary/80 data-[state=active]:text-primary-foreground transition-all duration-300">
```

#### Theme Toggle Pattern

```tsx
// Enhanced theme toggle with labels
<Button className="h-10 w-auto px-3 rounded-xl transition-all duration-300 hover:bg-primary/10 hover:scale-105">
  <SunIcon />
  <span className="ml-2 text-sm font-medium dark:hidden">라이트</span>
  <span className="ml-2 text-sm font-medium hidden dark:block">다크</span>
</Button>
```

### Mobile-First Enhancement Patterns

#### Card Layout Improvements

- **Spacing**: Use `space-y-6` for card lists instead of `space-y-4`
- **Padding**: Apply `p-6` for enhanced breathing room
- **Typography**: Implement responsive text sizing with `md:` breakpoints

#### Table Enhancement for Desktop

- **Row Height**: Use `py-6` for comfortable data scanning
- **Hover Effects**: Apply `hover:shadow-lg` for better interactive feedback
- **Typography**: Scale important data with `text-lg md:text-xl`

## Additional UX Improvements (June 2025 - User Feedback)

### Korean Stock Market Color Convention

Updated Rate component to follow Korean stock market conventions:

```tsx
// Korean stock market color system
const colorClass = isPositive
  ? "text-red-500 dark:text-red-400" // 상승: 빨간색 (Korean convention)
  : isNegative
  ? "text-blue-600 dark:text-blue-400" // 하락: 파란색 (Korean convention)
  : "text-muted-foreground"; // 보합: 회색
```

### Enhanced Table Visual Hierarchy

```tsx
// Rank-based styling for improved visual scanning
const isTopRank = company.marketcapRank <= 3;
const isTopTen = company.marketcapRank <= 10;

// Row styling with rank-based highlights
className={`
  ${isTopRank ? 'bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/20' : ''}
  ${isTopTen && !isTopRank ? 'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20' : ''}
  hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent
  hover:scale-[1.01] transition-all duration-300
`}

// Enhanced rank badges
<Badge
  variant={isTopRank ? "default" : isTopTen ? "secondary" : "outline"}
  className={`
    ${isTopRank ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md' : ''}
    ${isTopTen && !isTopRank ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : ''}
    group-hover:scale-110 transition-all duration-200
  `}
>
  {isTopRank && '👑 '}
  {rank}위
</Badge>
```

### Improved Navigation Button Feedback

```tsx
// Enhanced CorpSecTabs with border bottom indicator
className="
  data-[state=active]:bg-primary/85
  data-[state=active]:border-b-2
  data-[state=active]:border-primary
  hover:border-b-2 hover:border-primary/50
  transition-all duration-300
"
```

### Advanced Chart Interactivity

```tsx
// Enhanced chart container with tooltips
<div className="group relative cursor-pointer">
  <div className="rounded-xl border-2 border-muted/30 bg-gradient-to-br from-background to-muted/20 p-3 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-lg group-hover:scale-105">
    <SpikeChart {...props} />
  </div>

  {/* Advanced tooltip */}
  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-popover text-popover-foreground text-sm rounded-lg shadow-xl border-2 border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none backdrop-blur-sm bg-background/95">
    <div className="text-center space-y-1">
      <div className="font-bold text-primary">현재가: {price}원</div>
      <div className="text-xs text-muted-foreground">30일 가격 추이</div>
    </div>
  </div>
</div>
```

### Enhanced Typography Hierarchy

```tsx
// SecurityCard font improvements
// Company name emphasis
"font-bold text-xl md:text-2xl hover:text-primary transition-colors";

// Main value emphasis
"font-bold text-2xl md:text-3xl text-primary tabular-nums";

// Secondary information hierarchy
"text-sm text-muted-foreground/80 font-mono font-medium";
```

---

## Mobile-First UI/UX Patterns

### Touch Target Standards (WCAG AAA Compliance)

All interactive elements must meet minimum touch target requirements:

```tsx
// Minimum 48x48px touch targets
className="min-h-[48px] min-w-[48px] p-2 rounded-xl transition-all duration-300 touch-manipulation"

// Enhanced button example
<Button
  variant="outline"
  className="min-h-[48px] px-6 py-3 text-sm font-medium rounded-xl border-2 hover:border-primary/40 hover:bg-primary/8 hover:scale-[1.02] transition-all duration-300 touch-manipulation"
>
  Button Text
</Button>
```

### Mobile Header Pattern

```tsx
// Mobile-optimized header with vertical stack
<div className="block md:hidden">
  {/* Top row: Logo + Menu trigger with better spacing */}
  <div className="flex h-16 items-center justify-between px-1">
    <div className="flex items-center space-x-3">
      <MobileNav searchData={searchData} />
      <MainNav />
    </div>
    <div className="flex items-center">
      <ModeToggle />
    </div>
  </div>

  {/* Bottom row: Full-width search with enhanced touch area */}
  <div className="pb-4 px-1">
    <div className="w-full min-h-[48px] flex items-center">
      <CommandMenu data={searchData} />
    </div>
  </div>
</div>
```

### Enhanced Card Components

```tsx
// Mobile-optimized card with enhanced visual separation
<div className="bg-card border-2 border-border/70 rounded-2xl p-8 mb-8">
  {" "}
  {/* 개별 카드 패딩 확대 */}
  {/* 헤더 섹션 */}
  <div className="flex items-start justify-between mb-8">
    {" "}
    {/* 섹션 간격 확대 */}
    {/* 컨텐츠 */}
  </div>
  {/* 재무 정보 그리드 */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
    {" "}
    {/* 그리드 간격 확대 */}
    {/* 카드들 */}
  </div>
  {/* 차트 섹션 */}
  <div className="border-t-2 border-border/40 pt-8">
    {" "}
    {/* 구분선 강화 */}
    {/* 차트 컨텐츠 */}
  </div>
</div>
```

### Tab Component Mobile Pattern

```tsx
// Enhanced tab styling for mobile
<TabsTrigger
  className="text-base md:text-sm font-bold min-h-[48px] md:min-h-auto
             data-[state=active]:bg-primary/80 data-[state=active]:text-primary-foreground
             data-[state=active]:border data-[state=active]:border-border
             flex flex-col items-center justify-center p-2 sm:p-3
             rounded-xl"
>
  <span className="text-lg md:text-base">🏢</span>
  <span>기업</span>
</TabsTrigger>
```

### Unified Financial Navigation System

The `CompanyFinancialTabs` component provides intelligent 3D navigation between different financial analysis contexts:

```tsx
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";

// Usage in both company and security pages
<CompanyFinancialTabs secCode={secCode} />;
```

**Core Innovation: Context-Aware Routing**

- **Market Cap Analysis**: Always routes to company context (`/company/[secCode]/marketcap`) for comprehensive comparison
- **Financial Metrics**: Routes to security context (`/security/[secCode]/[metric]`) for detailed individual analysis
- **Natural User Flow**: Matches user mental models - "company overview" vs "detailed analysis"

**Visual Design Features:**

- **Context Indicators**: Clear visual feedback showing current navigation mode
  - 🏢 Company Context: "회사 관점: 전체 종목 비교 및 개요"
  - 📈 Security Context: "종목 관점: 개별 지표 상세 분석"
- **Intent Tooltips**: Hover states explain what each navigation choice provides
- **Icon System**: Meaningful icons that reinforce the analysis type
- **Responsive Grid**: 2 columns (mobile) → 4 columns (tablet) → 7 columns (desktop)

**Available Navigation Tabs:**

- 🏢 시가총액 (Market Cap) - Company context for comparison
- 📊 주가수익비율 (PER) - Security analysis context
- 💰 배당수익률 (DIV) - Security analysis context
- 💵 주당배당금 (DPS) - Security analysis context
- 📈 주당순자산가치 (BPS) - Security analysis context
- 📉 주가순자산비율 (PBR) - Security analysis context
- 💸 주당순이익 (EPS) - Security analysis context

**UX Principles:**

- **No Redundant UI**: Eliminated confusing toggle buttons and extra navigation elements
- **Service-First Design**: Navigation follows business logic rather than technical URL structure
- **Progressive Disclosure**: Context information appears when relevant, not overwhelming by default
- 주당순이익 (EPS)

**Styling Pattern:**

```tsx
<TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto p-1 gap-1 bg-muted/30">
  <TabsTrigger
    className="w-full text-xs sm:text-sm font-medium
               data-[state=active]:bg-background data-[state=active]:text-foreground
               data-[state=active]:border data-[state=active]:border-border
               flex flex-col items-center justify-center p-2 sm:p-3
               min-h-[3rem] sm:min-h-[3.5rem]
               hover:bg-muted/90 hover:text-foreground
               rounded-md"
  >
    <span className="font-semibold leading-tight">시가총액</span>
    <span className="text-xs text-muted-foreground font-normal opacity-70 leading-tight">
      Market Cap
    </span>
  </TabsTrigger>
</TabsList>
```

### Financial Info Grid Pattern

```tsx
// Mobile-responsive financial information layout
<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
  <div className="space-y-4 p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-primary/25 shadow-lg backdrop-blur-sm">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
          시가총액
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="min-h-[24px] min-w-[24px] flex items-center justify-center">
              <Info className="h-3 w-3 text-muted-foreground cursor-help hover:text-primary/80 transition-colors" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">시가총액 = 발행주식수 × 주가</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="w-3 h-3 bg-primary/50 rounded-full"></div>
    </div>
    <div className="text-right">
      <p className="font-bold text-3xl md:text-4xl text-primary tabular-nums leading-none">
        {formatNumber(marketcap)}
      </p>
      {/* 지능형 단위 표시 */}
      <p className="text-sm text-muted-foreground font-medium mt-1 tracking-wide">
        {marketcap >= 1_000_000_000_000 ? "한국 원 (KRW)" : "억 한국 원"}
      </p>
    </div>
  </div>

  {/* 현재가 카드 - Neutral 테마 */}
  <div className="space-y-4 p-6 bg-gradient-to-br from-card via-card to-muted/15 rounded-2xl border-2 border-border/50 shadow-lg backdrop-blur-sm">
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
        현재가
      </p>
      <div className="w-3 h-3 bg-muted-foreground/50 rounded-full"></div>
    </div>
    <div className="space-y-4 text-right">
      <p className="font-bold text-3xl md:text-4xl text-foreground tabular-nums leading-none">
        {close?.toLocaleString()}
        <span className="text-sm text-muted-foreground font-medium ml-2">
          원
        </span>
      </p>
      <div className="flex justify-end items-center min-h-[36px]">
        <div className="bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/40">
          <Rate rate={rate} size="md" />
        </div>
      </div>
    </div>
  </div>
</div>
```

### Connected Chart System (차트-수치 연결 시스템)

```tsx
// 차트와 수치가 연결된 고급 차트 컨테이너
<div className="rounded-3xl overflow-hidden border-2 border-muted/60 bg-gradient-to-br from-background via-background to-muted/20 p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:bg-gradient-to-br hover:from-background hover:to-primary/8 group/chart relative">
  {/* Chart container with enhanced touch-friendly area */}
  <div className="min-h-[90px] relative">
    <SpikeChart prices={prices} rate={rate} width={width} height={height} />

    {/* 현재가 연결 버블 - 차트와 수치를 시각적으로 연결 */}
    <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border-2 border-primary/30 opacity-90 group-hover/chart:opacity-100 transition-opacity duration-300">
      {close?.toLocaleString()}원
    </div>

    {/* Mobile-friendly chart overlay */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/8 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg"></div>
  </div>

  {/* 통계 정보 푸터 - 3열 그리드 */}
  <div className="mt-6 pt-4 border-t border-border/40">
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-xs text-muted-foreground/80 font-medium mb-1">
          추세
        </div>
        <Rate rate={rate} size="sm" />
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground/80 font-medium mb-1">
          현재가
        </div>
        <div className="text-sm font-bold text-foreground tabular-nums">
          {close?.toLocaleString()}원
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground/80 font-medium mb-1">
          기간
        </div>
        <div className="text-xs text-muted-foreground font-medium">30일간</div>
      </div>
    </div>
  </div>
</div>
```

### Bottom Navigation Pattern (하단 네비게이션 패턴)

```tsx
// 모바일 전용 하단 고정 네비게이션 (WCAG AAA 준수)
<nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t-2 border-border/60 shadow-2xl z-50 md:hidden">
  <div className="flex items-center justify-around px-2 py-3 max-w-md mx-auto">
    {navItems.map((item) => {
      const Icon = item.icon;
      const active = isActive(item);

      return (
        <Link
          key={item.name}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center min-h-[56px] min-w-[56px] px-2 py-1 rounded-2xl transition-all duration-300 touch-manipulation group",
            active
              ? "bg-primary/15 text-primary shadow-lg border border-primary/30 scale-105"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-105"
          )}
        >
          <div
            className={cn(
              "p-2 rounded-xl transition-all duration-300",
              active
                ? "bg-primary/20 shadow-md"
                : "group-hover:bg-background/80"
            )}
          >
            <Icon
              className={cn("h-5 w-5", active ? "text-primary scale-110" : "")}
            />
          </div>
          <span
            className={cn(
              "text-xs font-medium mt-1",
              active ? "text-primary font-bold" : ""
            )}
          >
            {item.name}
          </span>
          {active && (
            <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-pulse" />
          )}
        </Link>
      );
    })}
  </div>

  {/* Safe area for phones with home indicators */}
  <div className="h-safe-area-inset-bottom bg-background/50" />
</nav>
```

### Visual Hierarchy Enhancement Guidelines (시각적 계층 구조 가이드라인)

```tsx
// 완성된 카드 간격 시스템
<div className="block lg:hidden space-y-12">
  {" "}
  {/* 카드 리스트 간격 50% 증가 */}
  <div className="bg-card border-2 border-border/70 rounded-2xl p-8 mb-8">
    {" "}
    {/* 개별 카드 패딩 확대 */}
    {/* 헤더 섹션 */}
    <div className="flex items-start justify-between mb-8">
      {" "}
      {/* 섹션 간격 확대 */}
      {/* 컨텐츠 */}
    </div>
    {/* 재무 정보 그리드 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
      {" "}
      {/* 그리드 간격 확대 */}
      {/* 카드들 */}
    </div>
    {/* 차트 섹션 */}
    <div className="border-t-2 border-border/40 pt-8">
      {" "}
      {/* 구분선 강화 */}
      {/* 차트 컨텐츠 */}
    </div>
  </div>
</div>
```

## Card Design Guidelines

### 📱 Small Screen Card Strategy

**CRITICAL RULE**: Avoid nested card structures on screens ≤ 400px (iPhone SE/Mini)

#### Problem with Nested Cards

```tsx
// ❌ BAD: Excessive padding accumulation
<Card className="p-4 m-4">
  {" "}
  {/* 16px padding + 16px margin = 32px */}
  <Card className="p-4 m-2">
    {" "}
    {/* Additional 16px padding + 8px margin */}
    <p>Content area severely constrained</p>
  </Card>
</Card>
// Result: 64px+ of spacing reduces actual content area
```

#### Solution: Adaptive Card Patterns

```tsx
// ✅ GOOD: Responsive card depth
<div className="
  p-2 rounded-none border-none          /* xs: minimal card styling */
  sm:p-4 sm:rounded-lg sm:border        /* sm+: full card appearance */
">
  <div className="space-y-2 sm:space-y-4">
    <h3 className="font-medium">Company Name</h3>
    <div className="text-sm text-muted-foreground">
      Market Cap: ₩1.2T
    </div>
  </div>
</div>

// ✅ GOOD: Transform to table on large screens
<div className="
  block space-y-1                       /* xs-sm: stacked layout */
  lg:table-row lg:space-y-0             /* lg+: table row */
">
  <div className="lg:table-cell lg:p-4">Company</div>
  <div className="lg:table-cell lg:p-4">Market Cap</div>
</div>
```

### Card Component Variants

```tsx
// Compact variant for mobile with 천단 branding
const CardCompact = ({ children, className, showBrand = false, ...props }) => (
  <div className={cn(
    "p-2 rounded-none border-none shadow-none", // Minimal mobile styling
    "sm:p-4 sm:rounded-lg sm:border sm:shadow-sm", // Enhanced larger screens
    className
  )} {...props}>
    {showBrand && (
      <div className="flex items-center space-x-1 mb-2 sm:mb-3">
        <Image src="/icon.svg" alt="천단" width={12} height={12} />
        <span className="text-xs text-muted-foreground">천단</span>
      </div>
    )}
    {children}
  </div>
)

// 천하제일 단타대회 branded card for featured content
const BrandedCard = ({ children, title, rank, className, ...props }) => (
  <Card className={cn("relative overflow-hidden", className)} {...props}>
    {/* Brand watermark for premium content */}
    <div className="absolute top-2 right-2 opacity-20">
      <Image src="/icon.svg" alt="" width={16} height={16} />
    </div>

    <CardHeader className="pb-2">
      {rank && (
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <span>천하제일</span>
          <span className="font-mono">#{rank}</span>
        </div>
      )}
      {title && <CardTitle className="text-sm">{title}</CardTitle>}
    </CardHeader>

    <CardContent className="pt-0">
      {children}
    </CardContent>
  </Card>
)

// Usage examples with 천단 brand integration
<CardCompact showBrand>
  <div className="space-y-1 sm:space-y-2">
    <h4 className="text-sm font-medium">삼성전자</h4>
    <p className="text-xs text-muted-foreground">₩429.8조</p>
    <div className="flex items-center justify-between text-xs">
      <span className="text-red-600 font-mono">+2.34%</span>
      <span className="text-muted-foreground">천단 1위</span>
    </div>
  </div>
</CardCompact>

<BrandedCard title="오늘의 단타 챔피언" rank={1}>
  <div className="space-y-2">
    <div className="font-medium">카카오</div>
    <div className="text-red-600 font-mono text-lg">+15.67%</div>
    <p className="text-xs text-muted-foreground">
      천하제일 단타대회 일일 수익률 1위
    </p>
  </div>
</BrandedCard>
```

## Professional Financial UI Patterns

### Data Table Optimization

```tsx
// Mobile-first table design
<div
  className="
  block space-y-2                       /* xs: card-like stacking */
  md:table md:w-full md:space-y-0       /* md+: table layout */
"
>
  <div className="md:table-header-group">
    <div className="hidden md:table-row">
      <div className="md:table-cell font-medium p-2">종목명</div>
      <div className="md:table-cell font-medium p-2 text-right">시가총액</div>
      <div className="md:table-cell font-medium p-2 text-right">등락률</div>
    </div>
  </div>

  <div className="md:table-row-group">
    {securities.map((security) => (
      <div
        key={security.id}
        className="
        p-3 border rounded-lg             /* xs: card appearance */
        md:table-row md:p-0 md:border-0 md:rounded-none /* md+: table row */
      "
      >
        <div className="md:table-cell md:p-2">
          <div className="font-medium">{security.name}</div>
          <div className="text-sm text-muted-foreground md:hidden">
            {security.code}
          </div>
        </div>
        <div className="md:table-cell md:p-2 md:text-right">
          <span className="font-mono">{security.marketCap}</span>
        </div>
        <div className="md:table-cell md:p-2 md:text-right">
          <span
            className={cn(
              "font-mono",
              security.change > 0 ? "text-red-600" : "text-blue-600"
            )}
          >
            {security.changePercent}%
          </span>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Korean Financial Data Formatting for 천하제일 단타대회

```tsx
// Number formatting utilities for 천단 service
const formatKoreanNumber = (value: number) => {
  if (value >= 1e12) return `₩${(value / 1e12).toFixed(1)}조`
  if (value >= 1e8) return `₩${(value / 1e8).toFixed(1)}억`
  if (value >= 1e4) return `₩${(value / 1e4).toFixed(1)}만`
  return `₩${value.toLocaleString()}`
}

// 천하제일 단타대회 specific ranking formatter
const formatRankingWithTitle = (rank: number, isChampion?: boolean) => {
  if (rank === 1 && isChampion) return "천하제일 🏆"
  if (rank <= 3) return `단타 상위 ${rank}위`
  if (rank <= 10) return `상위 ${rank}위`
  return `${rank}위`
}

// Price change indicators with 천단 branding
const PriceChange = ({
  value,
  showRank = false,
  rank,
  className
}: {
  value: number;
  showRank?: boolean;
  rank?: number;
  className?: string;
}) => (
  <div className={cn("flex items-center space-x-1", className)}>
    <span className={cn(
      "font-mono text-sm",
      value > 0 && "text-red-600", // Korean red for up
      value < 0 && "text-blue-600", // Korean blue for down
      value === 0 && "text-muted-foreground",
    )}>
      {value > 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
    {showRank && rank && (
      <span className="text-xs text-muted-foreground">
        {formatRankingWithTitle(rank, value > 0 && rank === 1)}
      </span>
    )}
  </div>
)

// 천단 branded table header
const ChundanTableHeader = ({ children, showLogo = true }) => (
  <div className="md:table-header-group">
    <div className="hidden md:table-row bg-muted/50">
      {showLogo && (
        <div className="md:table-cell p-2">
          <div className="flex items-center space-x-1">
            <Image src="/icon.svg" alt="천단" width={14} height={14} />
            <span className="text-xs font-medium">천단 순위</span>
          </div>
        </div>
      )}
      {children}
    </div>
  </div>
)

// Usage example with 천하제일 단타대회 context
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold">천하제일 단타대회 실시간 랭킹</h2>
    <Badge variant="secondary" className="flex items-center space-x-1">
      <Image src="/icon.svg" alt="천단" width={12} height={12} />
      <span>LIVE</span>
    </Badge>
  </div>

  <div className="md:table md:w-full">
    <ChundanTableHeader>
      <div className="md:table-cell font-medium p-2">종목명</div>
      <div className="md:table-cell font-medium p-2 text-right">수익률</div>
      <div className="md:table-cell font-medium p-2 text-right">천단 순위</div>
    </ChundanTableHeader>

    <div className="md:table-row-group">
      {securities.map((security, index) => (
        <div key={security.id} className="
          p-3 border rounded-lg mb-2
          md:table-row md:p-0 md:border-0 md:rounded-none md:mb-0
          md:hover:bg-muted/50 transition-colors
        ">
          <div className="md:table-cell md:p-2">
            <div className="font-medium">{security.name}</div>
            <div className="text-sm text-muted-foreground md:hidden">
              {security.code}
            </div>
          </div>
          <div className="md:table-cell md:p-2 md:text-right">
            <PriceChange value={security.changePercent} />
          </div>
          <div className="md:table-cell md:p-2 md:text-right">
            <span className="text-sm font-medium">
              {formatRankingWithTitle(index + 1, security.changePercent > 0 && index === 0)}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```
