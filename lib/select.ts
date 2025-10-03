/**
 * CD3 Project - Database Select Operations
 * 
 * This file contains all database select operations for the CD3 project
 * according to the coding standards. All operations use Drizzle ORM.
 */

import { db } from '@/db';
import { company, security, price } from '@/db/schema-postgres';
import * as schema from '@/db/schema-postgres';
// SSG helper imports removed; using direct queries below
import { and, asc, desc, eq, exists, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Robust retry helper for SSG build with longer delays
 */
async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const maxRetries = 5; // 더 많은 시도
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            console.error(`[${operationName}] Attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt === maxRetries) {
                throw new Error(`Database connection failed after ${maxRetries} attempts. Operation: ${operationName}`);
            }

            // 지수적 백오프: 2초, 4초, 8초, 16초
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[${operationName}] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error(`Unexpected error in ${operationName}`);
}

// Helper function for date formatting
const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    let month = "" + (d.getMonth() + 1);
    let day = "" + d.getDate();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
};

/**
 * Get all companies with pagination
 * 
 * @param skip Number of records to skip for pagination
 * @param limit Maximum number of records to return
 * @returns Array of companies
 */
export const getCompanies = unstable_cache(
    async (skip = 0, limit = 100) => {
        try {
            const companies = await db.query.company.findMany({
                limit,
                offset: skip,
                orderBy: [asc(company.name)],
            });
            return companies;
        } catch (error) {
            console.error('[GET_COMPANIES] Error:', error);
            return [];
        }
    },
    ['getCompanies'],
    { tags: ['getCompanies'] }
);

/**
 * Get market capitalization data with pagination
 * 
 * @param skip Number of records to skip for pagination
 * @returns Array of companies with market cap data
 */
// [Removed] Duplicated company marketcap listing; use lib/data/company.ts

/**
 * Get security by ID
 * 
 * @param securityId ID of the security to retrieve
 * @returns Security data or null if not found
 */
export const getSecurityById = unstable_cache(
    async (securityId: string) => {
        try {
            const securityData = await db.query.security.findFirst({
                where: eq(security.securityId, securityId),
                with: {
                    company: true,
                },
            });
            return securityData;
        } catch (error) {
            console.error('[GET_SECURITY_BY_ID] Error:', error);
            return null;
        }
    },
    ['getSecurityById'],
    { tags: ['getSecurityById'] }
);

// Metrics ranking functions moved to lib/data/security.ts

/**
 * Get market index data (KOSPI, KOSDAQ, etc)
 * 
 * @returns Array of market indices with current values and changes
 */
// Market indices moved to lib/data/indices.ts

/**
 * Get trending stocks (top gainers, losers, and volume)
 * 
 * @returns Object containing gainers, losers, and volume leaders
 */
// Trending/Recommended moved to lib/data/discovery.ts

/**
 * Get recommended stocks based on specified criteria
 * 
 * @returns Array of recommended stocks
 */
//

//

/**
 * Get security market cap ranking by security ID
 * @param securityId The security ID to get ranking for
 * @returns Object with current rank, prior rank, and change or null if not found
 */
export const getSecurityMarketCapRanking = unstable_cache(
    async (securityId: string) => {
        try {
            const latestRankDateResult = await db
                .select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
                .from(schema.securityRank)
                .where(eq(schema.securityRank.metricType, 'marketcap'))
                .limit(1);

            const latestRankDate = latestRankDateResult[0]?.maxDate;

            if (!latestRankDate) {
                return null;
            }

            const result = await db.query.securityRank.findFirst({
                where: and(
                    eq(schema.securityRank.securityId, securityId),
                    eq(schema.securityRank.metricType, 'marketcap'),
                    eq(schema.securityRank.rankDate, latestRankDate)
                ),
                columns: {
                    currentRank: true,
                    priorRank: true,
                    value: true
                }
            });

            if (!result || !result.currentRank) {
                return null;
            }

            const rankChange = result.priorRank ? result.currentRank - result.priorRank : 0;

            return {
                currentRank: result.currentRank,
                priorRank: result.priorRank,
                rankChange,
                value: result.value
            };
        } catch (error) {
            console.error('[GET_SECURITY_MARKET_CAP_RANKING] Error:', error);
            return null;
        }
    },
    ['getSecurityMarketCapRanking'],
    { tags: ['getSecurityMarketCapRanking'] }
);

/**
 * Get all security codes with type information for SSG (Static Site Generation)
 * Returns security objects with exchange, ticker, and type for filtering
 *
 * @returns Array of security objects
 */
export const getAllSecuritiesWithType = unstable_cache(
    async (): Promise<{ exchange: string; ticker: string; type: string | null }[]> => {
        return await withRetry(async () => {
            console.log('[GET_ALL_SECURITIES_WITH_TYPE] Attempting to fetch securities from DB');

            const securities = await db.query.security.findMany({
                columns: {
                    exchange: true,
                    ticker: true,
                    type: true,
                },
                where: and(
                    isNotNull(security.exchange),
                    isNotNull(security.ticker),
                    ne(security.exchange, ''),
                    ne(security.ticker, ''),
                    isNotNull(security.marketcap),
                    isNull(security.delistingDate)
                ),
                orderBy: [desc(security.marketcap)], // 시가총액 상위부터
            });

            console.log(`[GET_ALL_SECURITIES_WITH_TYPE] Successfully fetched ${securities.length} securities from DB`);

            return securities;
        }, 'getAllSecuritiesWithType');
    },
    ['getAllSecuritiesWithType'],
    { tags: ['getAllSecuritiesWithType'], revalidate: 86400 } // 24시간 캐시
);

/**
 * Get all security codes for SSG (Static Site Generation)
 * Returns all security codes in the format "EXCHANGE.TICKER" for generateStaticParams
 *
 * @returns Array of security codes
 */
export const getAllSecurityCodes = unstable_cache(
    async (): Promise<string[]> => {
        return await withRetry(async () => {
            console.log('[GET_ALL_SECURITY_CODES] Attempting to fetch securities from DB');

            const securities = await db.query.security.findMany({
                columns: {
                    exchange: true,
                    ticker: true,
                },
                where: and(
                    isNotNull(security.exchange),
                    isNotNull(security.ticker),
                    ne(security.exchange, ''),
                    ne(security.ticker, ''),
                    isNotNull(security.marketcap),
                    isNull(security.delistingDate)
                ),
                orderBy: [desc(security.marketcap)], // 시가총액 상위부터
                // 청크 빌드 시에는 제한 없이 모든 데이터 가져오기
                // limit: 100, // 제한 제거
            });

            console.log(`[GET_ALL_SECURITY_CODES] Successfully fetched ${securities.length} securities from DB`);

            const allSecurityCodes = securities.map(sec => `${sec.exchange}.${sec.ticker}`);

            console.log(`[GET_ALL_SECURITY_CODES] Returning ${allSecurityCodes.length} securities`);

            return allSecurityCodes;
        }, 'getAllSecurityCodes');
    },
    ['getAllSecurityCodes'],
    { tags: ['getAllSecurityCodes'], revalidate: 86400 } // 24시간 캐시
);

/**
 * Get all company codes for SSG (Static Site Generation)
 * Returns all company codes based on securities with companyId
 * 
 * @returns Array of security codes that have companies
 */
export const getAllCompanyCodes = unstable_cache(
    async (): Promise<string[]> => {
        return await withRetry(async () => {
            console.log('[GET_ALL_COMPANY_CODES] Attempting to fetch company codes from DB');

            const securities = await db.query.security.findMany({
                columns: {
                    exchange: true,
                    ticker: true,
                },
                where: and(
                    isNotNull(security.exchange),
                    isNotNull(security.ticker),
                    ne(security.exchange, ''),
                    ne(security.ticker, ''),
                    isNotNull(security.companyId), // 회사가 있는 경우만
                    isNotNull(security.marketcap) // 시가총액이 있는 경우만
                ),
                orderBy: [desc(security.marketcap)], // 시가총액 상위부터
                // 청크 빌드 시에는 제한 없이 모든 데이터 가져오기
                // limit: 100, // 제한 제거
            });

            console.log(`[GET_ALL_COMPANY_CODES] Successfully fetched ${securities.length} company codes from DB`);

            const allCompanyCodes = securities.map(sec => `${sec.exchange}.${sec.ticker}`);

            console.log(`[GET_ALL_COMPANY_CODES] Returning ${allCompanyCodes.length} company codes`);

            return allCompanyCodes;
        }, 'getAllCompanyCodes');
    },
    ['getAllCompanyCodes'],
    { tags: ['getAllCompanyCodes'], revalidate: 86400 } // 24시간 캐시
);


// ---- Targeted helpers for selective static generation ----

const DEFAULT_STATIC_LIMIT = 500;

type RankedSecurityMeta = {
    code: string;
    type: string | null;
    companyId: string | null;
};

const isFullStaticExport = () => process.env.NEXT_OUTPUT_MODE?.toLowerCase() === 'export';

async function fetchRankedSecurityMeta(
    metric: schema.MetricType,
    limit: number,
) {
    const latestRankDateResult = await db
        .select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
        .from(schema.securityRank)
        .where(eq(schema.securityRank.metricType, metric))
        .limit(1);

    const latestRankDate = latestRankDateResult[0]?.maxDate;

    if (!latestRankDate) {
        return [] as RankedSecurityMeta[];
    }

    const rows = await db
        .select({
            exchange: schema.security.exchange,
            ticker: schema.security.ticker,
            type: schema.security.type,
            companyId: schema.security.companyId,
            currentRank: schema.securityRank.currentRank,
        })
        .from(schema.securityRank)
        .innerJoin(
            schema.security,
            eq(schema.securityRank.securityId, schema.security.securityId),
        )
        .where(
            and(
                eq(schema.securityRank.metricType, metric),
                eq(schema.securityRank.rankDate, latestRankDate),
                isNotNull(schema.securityRank.currentRank),
                isNotNull(schema.security.exchange),
                isNotNull(schema.security.ticker),
                ne(schema.security.exchange, ''),
                ne(schema.security.ticker, ''),
                isNull(schema.security.delistingDate),
            ),
        )
        .orderBy(asc(schema.securityRank.currentRank))
        .limit(Math.max(limit * 2, limit));

    const seen = new Set<string>();
    const result: RankedSecurityMeta[] = [];

    for (const row of rows) {
        const exchange = row.exchange ?? '';
        const ticker = row.ticker ?? '';

        if (!exchange || !ticker) continue;

        const code = `${exchange}.${ticker}`;
        if (seen.has(code)) continue;

        seen.add(code);
        result.push({ code, type: row.type ?? null, companyId: row.companyId ?? null });

        if (result.length >= limit) break;
    }

    return result;
}

export const getTopSecurityCodesByMetric = unstable_cache(
    async (metric: schema.MetricType, limit: number = DEFAULT_STATIC_LIMIT) => {
        return await withRetry(async () => {
            if (isFullStaticExport()) {
                return await getAllSecurityCodes();
            }
            const meta = await fetchRankedSecurityMeta(metric, limit);
            return meta.map((item) => item.code);
        }, `getTopSecurityCodesByMetric-${metric}-${limit}`);
    },
    ['getTopSecurityCodesByMetric'],
    { tags: ['getTopSecurityCodesByMetric'], revalidate: 86400 },
);

export const getTopCompanyCodesByMetric = unstable_cache(
    async (metric: schema.MetricType, limit: number = DEFAULT_STATIC_LIMIT) => {
        return await withRetry(async () => {
            if (isFullStaticExport()) {
                return await getAllCompanyCodes();
            }
            const meta = await fetchRankedSecurityMeta(metric, limit * 2);
            const seenCompanies = new Set<string>();
            const codes: string[] = [];

            for (const item of meta) {
                if (!item.companyId) continue;
                if (seenCompanies.has(item.companyId)) continue;

                seenCompanies.add(item.companyId);
                codes.push(item.code);

                if (codes.length >= limit) break;
            }

            return codes;
        }, `getTopCompanyCodesByMetric-${metric}-${limit}`);
    },
    ['getTopCompanyCodesByMetric'],
    { tags: ['getTopCompanyCodesByMetric'], revalidate: 86400 },
);

export const getTopSecuritiesWithTypeByMetric = unstable_cache(
    async (metric: schema.MetricType, limit: number = DEFAULT_STATIC_LIMIT) => {
        return await withRetry(async () => {
            if (isFullStaticExport()) {
                const securities = await getAllSecuritiesWithType();
                return securities
                    .filter((sec) => sec.exchange && sec.ticker)
                    .map((sec) => ({
                        code: `${sec.exchange}.${sec.ticker}`,
                        type: sec.type ?? null,
                        companyId: null,
                    }));
            }
            return await fetchRankedSecurityMeta(metric, limit);
        }, `getTopSecuritiesWithTypeByMetric-${metric}-${limit}`);
    },
    ['getTopSecuritiesWithTypeByMetric'],
    { tags: ['getTopSecuritiesWithTypeByMetric'], revalidate: 86400 },
);

//
