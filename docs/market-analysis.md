# CD3 Market Analysis Functions

This document outlines the technical analysis functions used in the CD3 Stock Information Service.

**Last Updated:** May 27, 2025

## Overview

The market-utils.ts module provides technical analysis tools for stock market data, following the CD3 design philosophy. These functions help traders and investors identify market trends, stock momentum, and potential buy/sell signals.

## Core Functions

### RSI (Relative Strength Index)

```typescript
function calculateRSI(prices: number[], period = 14): number;
```

The RSI is a momentum oscillator that measures the speed and change of price movements. It oscillates between 0 and 100.

- **Interpretation**:
  - RSI > 70: Potentially overbought
  - RSI < 30: Potentially oversold
  - RSI = 50: Neutral momentum

### Moving Averages

```typescript
function calculateMA(prices: number[], period = 20): number | null;
function calculateEMA(prices: number[], period: number): number | null;
```

Moving averages smooth out price data to identify trends:

- **Simple Moving Average (MA)**: Equal weight to all prices in the period
- **Exponential Moving Average (EMA)**: Greater weight to more recent prices

### MACD (Moving Average Convergence Divergence)

```typescript
function calculateMACD(
  prices: number[]
): { line: number; signal: number; histogram: number } | null;
```

MACD reveals changes in strength, direction, momentum, and duration of a trend:

- **MACD Line**: Difference between 12-day and 26-day EMAs
- **Signal Line**: 9-day EMA of the MACD Line
- **Histogram**: MACD Line minus Signal Line

### Technical Analysis Signals

```typescript
function getTechnicalSignals(prices: number[]): {
  rsi: { value: number; signal: "oversold" | "neutral" | "overbought" };
  macd: { signal: "buy" | "sell" | "neutral" } | null;
  ma: { signal: "bullish" | "bearish" | "neutral" } | null;
};
```

Provides consolidated analysis of different technical indicators.

### Volatility Analysis

```typescript
function calculateVolatility(prices: number[], period = 20): number | null;
```

Measures the rate at which the price of a security increases or decreases over a period.

## Implementation Notes

- All functions implement proper error handling and null checking
- Performance optimized for real-time analysis
- Mobile-first display of technical indicators
- Follows CD3 design philosophy for consistency

## Visual Implementation

The technical analysis results are visualized in various components:

- **StockChart**: Displays price movements with technical overlays
- **StockInfo**: Shows summarized technical signals
- **MarketTrends**: Uses technical signals for trend identification

## Usage Example

```typescript
import { calculateRSI, getTechnicalSignals } from "@/lib/market-utils";

// Get closing prices from database
const closingPrices = securityData.prices.map((p) => p.close);

// Calculate RSI
const rsi = calculateRSI(closingPrices);

// Get combined technical signals
const signals = getTechnicalSignals(closingPrices);

// Use signals for UI display
const recommendation =
  signals.rsi.signal === "oversold" && signals.macd?.signal === "buy"
    ? "Strong Buy Signal"
    : signals.rsi.signal === "overbought" && signals.macd?.signal === "sell"
    ? "Strong Sell Signal"
    : "Neutral";
```
