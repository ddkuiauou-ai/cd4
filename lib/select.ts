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
            const today = new Date().toISOString().split('T')[0];
            const result = await db.query.securityRank.findFirst({
                where: and(
                    eq(schema.securityRank.securityId, securityId),
                    eq(schema.securityRank.metricType, 'marketcap'),
                    eq(schema.securityRank.rankDate, today)
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
                    isNotNull(security.marketcap)
                ),
                orderBy: [desc(security.marketcap)], // 시가총액 상위부터
                // 청크 빌드 시에는 제한 없이 모든 데이터 가져오기
                // limit: 100, // 제한 제거
            });

            console.log(`[GET_ALL_SECURITY_CODES] Successfully fetched ${securities.length} securities from DB`);

            const allSecurityCodes = securities.map(sec => `${sec.exchange}.${sec.ticker}`);

            // 청크 필터링 적용
            const filteredCodes = filterByChunk(allSecurityCodes, (code) => code);

            console.log(`[GET_ALL_SECURITY_CODES] After chunk filtering: ${filteredCodes.length} securities`);

            return filteredCodes;
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

            // 청크 필터링 적용
            const filteredCodes = filterByChunk(allCompanyCodes, (code) => code);

            console.log(`[GET_ALL_COMPANY_CODES] After chunk filtering: ${filteredCodes.length} company codes`);

            return filteredCodes;
        }, 'getAllCompanyCodes');
    },
    ['getAllCompanyCodes'],
    { tags: ['getAllCompanyCodes'], revalidate: 86400 } // 24시간 캐시
);

//

/**
 * 청크 빌드를 위한 유틸리티 함수들
 */

/**
 * 환경변수에서 현재 빌드 청크 정보를 가져옵니다
 */
function getCurrentBuildChunk() {
    const chunkIndex = parseInt(process.env.BUILD_CHUNK_INDEX || '0');
    const chunkTotal = parseInt(process.env.BUILD_CHUNK_TOTAL || '1');
    const chunkSize = parseInt(process.env.BUILD_CHUNK_SIZE || '500');

    return { chunkIndex, chunkTotal, chunkSize };
}

/**
 * 청크 정보에 따라 배열을 필터링합니다
 */
function filterByChunk<T>(items: T[], getKey: (item: T) => string): T[] {
    const { chunkIndex, chunkTotal, chunkSize } = getCurrentBuildChunk();

    if (chunkTotal === 1) {
        // 청크 빌드가 아닌 경우 모든 항목 반환
        return items;
    }

    const startIndex = chunkIndex * chunkSize;
    const endIndex = startIndex + chunkSize;

    // 정렬을 위해 키 기준으로 정렬
    const sortedItems = [...items].sort((a, b) => getKey(a).localeCompare(getKey(b)));

    const chunk = sortedItems.slice(startIndex, endIndex);

    console.log(`[Chunk ${chunkIndex + 1}/${chunkTotal}] Processing ${chunk.length} items (${startIndex}-${endIndex})`);

    return chunk;
}
