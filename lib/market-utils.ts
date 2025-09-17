/**
 * Stock Market Utility Functions for CD3 Project
 */

/**
 * Calculate relative strength index (RSI)
 * @param prices Array of closing prices
 * @param period Period for RSI calculation (default: 14)
 * @returns RSI value between 0 and 100
 */
export function calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) {
        return 50; // Not enough data
    }

    // Calculate price changes
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate average gains and losses
    let sumGain = 0;
    let sumLoss = 0;

    for (let i = 0; i < period; i++) {
        if (changes[i] >= 0) {
            sumGain += changes[i];
        } else {
            sumLoss += Math.abs(changes[i]);
        }
    }

    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;

    // Calculate smoothed RSI
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        const gain = change >= 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    // Calculate RSI
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * Calculate moving average
 * @param prices Array of closing prices
 * @param period Period for moving average (default: 20)
 * @returns Moving average value
 */
export function calculateMA(prices: number[], period = 20): number | null {
    if (prices.length < period) {
        return null;
    }

    const sum = prices.slice(prices.length - period).reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * Calculate moving average convergence divergence (MACD)
 * @param prices Array of closing prices
 * @returns Object with MACD line, signal line, and histogram values
 */
export function calculateMACD(prices: number[]): { line: number; signal: number; histogram: number } | null {
    if (prices.length < 26) {
        return null;
    }

    // Calculate EMA-12 and EMA-26
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);

    if (!ema12 || !ema26) return null;

    const line = ema12 - ema26;

    // Calculate signal line (EMA-9 of MACD line)
    const macdValues = [];
    for (let i = 0; i < 9; i++) {
        const pastPrices = prices.slice(0, prices.length - 9 + i + 1);
        const pastEma12 = calculateEMA(pastPrices, 12);
        const pastEma26 = calculateEMA(pastPrices, 26);
        if (pastEma12 && pastEma26) {
            macdValues.push(pastEma12 - pastEma26);
        }
    }

    if (macdValues.length < 9) return null;

    // Simple average for signal line
    const signal = macdValues.reduce((a, b) => a + b, 0) / macdValues.length;
    const histogram = line - signal;

    return { line, signal, histogram };
}

/**
 * Calculate exponential moving average
 * @param prices Array of closing prices
 * @param period Period for EMA calculation
 * @returns EMA value
 */
export function calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
        return null;
    }

    const k = 2 / (period + 1);

    // Start with simple MA
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate EMA for the rest of the prices
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
}

/**
 * Get technical analysis signals based on indicators
 * @param prices Array of closing prices
 * @returns Object with technical analysis signals
 */
export function getTechnicalSignals(prices: number[]): {
    rsi: { value: number; signal: 'oversold' | 'neutral' | 'overbought' };
    macd: { signal: 'buy' | 'sell' | 'neutral' } | null;
    ma: { signal: 'bullish' | 'bearish' | 'neutral' } | null;
} {
    // RSI Analysis
    const rsiValue = calculateRSI(prices);
    let rsiSignal: 'oversold' | 'neutral' | 'overbought' = 'neutral';

    if (rsiValue <= 30) rsiSignal = 'oversold';
    else if (rsiValue >= 70) rsiSignal = 'overbought';

    // MACD Analysis
    const macd = calculateMACD(prices);
    let macdSignal = null;

    if (macd) {
        if (macd.histogram > 0 && macd.histogram > macd.histogram) {
            macdSignal = { signal: 'buy' as const };
        } else if (macd.histogram < 0 && macd.histogram < macd.histogram) {
            macdSignal = { signal: 'sell' as const };
        } else {
            macdSignal = { signal: 'neutral' as const };
        }
    }

    // Moving Average Analysis
    const shortMA = calculateMA(prices, 20);
    const longMA = calculateMA(prices, 50);

    let maSignal = null;

    if (shortMA && longMA) {
        if (shortMA > longMA) {
            maSignal = { signal: 'bullish' as const };
        } else if (shortMA < longMA) {
            maSignal = { signal: 'bearish' as const };
        } else {
            maSignal = { signal: 'neutral' as const };
        }
    }

    return {
        rsi: { value: rsiValue, signal: rsiSignal },
        macd: macdSignal,
        ma: maSignal
    };
}

/**
 * Calculate stock volatility
 * @param prices Array of closing prices
 * @param period Period for volatility calculation (default: 20)
 * @returns Volatility value
 */
export function calculateVolatility(prices: number[], period = 20): number | null {
    if (prices.length < period) {
        return null;
    }

    const pricesToUse = prices.slice(prices.length - period);
    const mean = pricesToUse.reduce((a, b) => a + b, 0) / period;

    const sumSquaredDiffs = pricesToUse.reduce((sum, price) => {
        const diff = price - mean;
        return sum + (diff * diff);
    }, 0);

    const variance = sumSquaredDiffs / period;
    return Math.sqrt(variance);
}
