import { db } from "@/db";
import { unstable_cache } from "next/cache";
import {
    eq,
    and, // eslint-disable-line @typescript-eslint/no-unused-vars
    desc,
    sql, // eslint-disable-line @typescript-eslint/no-unused-vars
    asc,
} from "drizzle-orm";
import * as schema from "@/db/schema-postgres";

/**
 * URL 파라미터 기반 증권 검색 함수
 * - 한글 URL 인코딩 문제 해결을 위한 특수 처리
 * - 먼저 정확한 이름으로 검색, 실패시 displayName을 통한 검색
 */
export const getSecurityFromUrl = unstable_cache(
    async (urlParam: string) => {
        console.log(`--- [getSecurityFromUrl] URL param: "${urlParam}" ---`);
        try {
            // 1. URL 디코딩 (혹시나 인코딩 문제가 있을 수 있어 안전하게 처리)
            const decodedParam = decodeURIComponent(urlParam);
            console.log(`[getSecurityFromUrl] Decoded param: "${decodedParam}"`);

            // 2. 정확한 이름으로 우선 검색
            console.log(`[getSecurityFromUrl] Step 1: Direct search by name`);
            const security = await db
                .select({
                    securityId: schema.security.securityId,
                    name: schema.security.name,
                    companyId: schema.security.companyId,
                    type: schema.security.type,
                    marketcap: schema.security.marketcap,
                    shares: schema.security.shares,
                    updatedAt: schema.security.updatedAt,
                    exchange: schema.security.exchange,
                })
                .from(schema.security)
                .where(eq(schema.security.name, decodedParam))
                .limit(1);

            // 검색 결과 로깅
            console.log(`[getSecurityFromUrl] Direct name search result:`, security.length > 0 ? "Found security" : "No security found");

            // 3. 검색 결과가 있으면 처리
            if (security && security.length > 0) {
                return await processSecurityData(security[0]);
            }

            // 4. 기업 표시명으로 검색
            console.log(`[getSecurityFromUrl] Step 2: Searching through displayName`);
            const display = await db.query.displayName.findFirst({
                where: eq(schema.displayName.value, decodedParam),
                columns: {
                    companyId: true,
                    companyName: true,
                },
            });

            // 5. 표시명 검색 결과 있으면 해당 기업 증권 검색
            if (display) {
                console.log(`[getSecurityFromUrl] Found display name match: "${display.companyName}"`);

                const secByCompany = await db
                    .select({
                        securityId: schema.security.securityId,
                        name: schema.security.name,
                        companyId: schema.security.companyId,
                        type: schema.security.type,
                        marketcap: schema.security.marketcap,
                        shares: schema.security.shares,
                        updatedAt: schema.security.updatedAt,
                        exchange: schema.security.exchange,
                    })
                    .from(schema.security)
                    .where(eq(schema.security.companyId, display.companyId))
                    .orderBy(asc(schema.security.type))
                    .limit(1);

                if (secByCompany && secByCompany.length > 0) {
                    console.log(`[getSecurityFromUrl] Found security via companyId: "${secByCompany[0].name}"`);
                    return await processSecurityData(secByCompany[0]);
                }
            }

            // 6. 모든 검색 실패 시
            console.log(`[getSecurityFromUrl] No security found for URL param: "${urlParam}"`);
            return null;

        } catch (error) {
            console.error(`[getSecurityFromUrl] ERROR processing URL param "${urlParam}":`, error);
            return null;
        }
    },
    ["getSecurityFromUrl"],
    { tags: ["getSecurityFromUrl"] }
);

// 증권 정보 처리를 위한 헬퍼 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processSecurityData(securityData: any) {
    try {
        // 1. 가격 정보 가져오기
        const prices = await db
            .select({
                close: schema.price.close,
                rate: schema.price.rate,
                date: schema.price.date,
            })
            .from(schema.price)
            .where(eq(schema.price.securityId, securityData.securityId))
            .orderBy(desc(schema.price.date))
            .limit(30);

        // 2. 회사 정보 가져오기
        const companyData = await db
            .select({
                companyId: schema.company.companyId,
                name: schema.company.name,
                korName: schema.company.korName,
                marketcap: schema.company.marketcap,
                marketcapRank: schema.company.marketcapRank,
            })
            .from(schema.company)
            .where(eq(schema.company.companyId, securityData.companyId))
            .limit(1);

        // 3. 최종 결과 조합
        const result = {
            ...securityData,
            marketcap: Number(securityData.marketcap || 0),
            shares: Number(securityData.shares || 0),
            prices: prices || [],
            company: companyData[0] ? {
                ...companyData[0],
                marketcap: Number(companyData[0].marketcap || 0),
                marketcapRank: Number(companyData[0].marketcapRank || 0),
            } : null,
            value: companyData[0]?.marketcap ? Number(companyData[0].marketcap) : 0,
        };

        return result;
    } catch (error) {
        console.error("[processSecurityData] ERROR processing security data:", error);
        return null;
    }
}
