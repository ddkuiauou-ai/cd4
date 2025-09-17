import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { and, asc, eq, exists, isNull, isNotNull, desc, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { computeMixedPagination, computeTotalPagesMixed } from "./pagination";
import { getMarketCapHistoryBySecurityIds, getPricesBySecurityIds } from "./security";

export interface CompanyMarketcapAggregated {
  companyId: string;
  companyName: string;
  companyKorName: string | null;
  totalMarketcap: number;
  totalMarketcapDate: Date | string;
  securities: Array<{
    securityId: string;
    name: string | null;
    korName: string | null;
    ticker: string | null;
    type: string | null;
    marketcap: number | null;
    marketcapDate: Date | string | null;
    percentage: number;
    marketcapHistory: Array<{
      date: Date | string;
      marketcap: number;
      ticker: string | null;
      name: string | null;
      korName: string | null;
      exchange: string | null;
    }>;
  }>;
  aggregatedHistory: Array<{
    date: Date | string;
    totalMarketcap: number;
    securitiesBreakdown: Record<string, number>;
  }>;
}

type CompanyItem = {
  companyId: string;
  name: string | null;
  korName: string | null;
  logo: string | null;
  marketcap: number | null;
  marketcapRank: number | null;
  marketcapDate: Date | null;
  marketcapPriorRank: number | null;
  securities: Array<{
    securityId: string;
    exchange: string | null;
    ticker: string | null;
    type: string | null;
    name: string | null;
    korName: string | null;
    prices: Array<{
      securityId: string;
      exchange: string | null;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      rate: number | null;
      date: Date;
      updatedAt: Date | null;
    }>;
  }>;
};

export const countCompanyMarketcaps = unstable_cache(async () => {
  try {
    const companies = await db.query.company.findMany({
      where: and(
        isNotNull(schema.company.marketcapRank),
        exists(
          db
            .select({ pk: schema.security.securityId })
            .from(schema.security)
            .where(
              and(
                eq(schema.security.companyId, schema.company.companyId),
                eq(schema.security.type, "보통주"),
                isNull(schema.security.delistingDate)
              )
            )
        )
      ),
      columns: { companyId: true },
    });
    return companies.length;
  } catch (e) {
    console.error("[countCompanyMarketcaps] ERROR:", e);
    return 0;
  }
}, ["countCompanyMarketcaps"], { tags: ["countCompanyMarketcaps"] });

export const getCompanyMarketcapsPage = unstable_cache(
  async (page: number) => {
    const { limit, skip, page: currentPage, pageSize } = computeMixedPagination(page);

    try {
      const items = (await db.query.company.findMany({
        where: and(
          isNotNull(schema.company.marketcapRank),
          exists(
            db
              .select({ pk: schema.security.securityId })
              .from(schema.security)
              .where(
                and(
                  eq(schema.security.companyId, schema.company.companyId),
                  eq(schema.security.type, "보통주"),
                  isNull(schema.security.delistingDate)
                )
              )
          )
        ),
        orderBy: [asc(schema.company.marketcapRank)],
        limit,
        offset: skip,
        columns: {
          companyId: true,
          name: true,
          korName: true,
          logo: true,
          marketcap: true,
          marketcapRank: true,
          marketcapDate: true,
          marketcapPriorRank: true,
        },
        with: {
          securities: {
            where: and(eq(schema.security.type, "보통주"), isNull(schema.security.delistingDate)),
            columns: {
              securityId: true,
              exchange: true,
              ticker: true,
              type: true,
              name: true,
              korName: true,
            },
            limit: 1,
          },
        },
      })) as CompanyItem[];

      const securityIds = items.map((c) => c.securities?.[0]?.securityId).filter((id) => id) as string[];
      const pricesBySecurityId = await getPricesBySecurityIds(securityIds);

      items.forEach((item) => {
        const security = item.securities?.[0];
        if (security && pricesBySecurityId[security.securityId]) {
          security.prices = pricesBySecurityId[security.securityId];
        }
      });

      const totalCount = await countCompanyMarketcaps();
      const totalPages = computeTotalPagesMixed(totalCount);

      return {
        items,
        page: currentPage,
        pageSize,
        skip,
        totalCount,
        totalPages,
      };
    } catch (e) {
      console.error("[getCompanyMarketcapsPage] ERROR:", e);
      return { items: [] as CompanyItem[], page: 1, pageSize: 20, skip: 0, totalCount: 0, totalPages: 1 };
    }
  },
  ["getCompanyMarketcapsPage"],
  { tags: ["getCompanyMarketcapsPage"] }
);

// Company aggregated marketcap (moved from lib/getMarketData.ts)
export const getCompanyAggregatedMarketcap = unstable_cache(
  async (companyId: string): Promise<CompanyMarketcapAggregated | null> => {
    try {
      if (!companyId) return null;

      const company = await db.query.company.findFirst({
        where: eq(schema.company.companyId, companyId),
        columns: {
          companyId: true,
          name: true,
          korName: true,
          marketcap: true,
          marketcapDate: true,
        },
        with: {
          securities: {
            where: isNull(schema.security.delistingDate),
            columns: {
              securityId: true,
              name: true,
              korName: true,
              ticker: true,
              type: true,
              marketcap: true,
              marketcapDate: true,
            },
          },
        },
      });

      if (!company || !company.securities.length) return null;

      const securityIds = company.securities.map((sec) => sec.securityId);
      const marketcapHistories = await getMarketCapHistoryBySecurityIds(securityIds);

      const currentTotalMarketcap = company.securities.reduce((total, sec) => {
        return total + (sec.marketcap || 0);
      }, 0);

      const securitiesData = company.securities.map((sec) => {
        const marketcapHistory = marketcapHistories[sec.securityId] || [];
        const percentage = currentTotalMarketcap > 0 ? ((sec.marketcap || 0) / currentTotalMarketcap) * 100 : 0;

        return {
          securityId: sec.securityId,
          name: sec.name,
          korName: sec.korName,
          ticker: sec.ticker,
          type: sec.type,
          marketcap: sec.marketcap,
          marketcapDate: sec.marketcapDate ? (sec.marketcapDate instanceof Date ? sec.marketcapDate : new Date(sec.marketcapDate)) : null,
          percentage,
          marketcapHistory,
        };
      });

      const aggregatedHistory: Array<{
        date: Date;
        totalMarketcap: number;
        securitiesBreakdown: Record<string, number>;
      }> = [];

      const allDates = new Set<string>();
      Object.values(marketcapHistories).forEach((history) => {
        history.forEach((item: any) => {
          if (item.date) {
            const dateStr = item.date instanceof Date ? item.date.toISOString().split("T")[0] : String(item.date);
            allDates.add(dateStr);
          }
        });
      });

      Array.from(allDates)
        .sort()
        .forEach((dateStr) => {
          const date = new Date(dateStr);
          let totalMarketcap = 0;
          const securitiesBreakdown: Record<string, number> = {};

          company.securities.forEach((sec) => {
            const history = (marketcapHistories as any)[sec.securityId] || [];
            const marketcapOnDate = history.find((item: any) => {
              const itemDateStr = item.date instanceof Date ? item.date.toISOString().split("T")[0] : String(item.date);
              return itemDateStr === dateStr;
            });

            const marketcapValue = marketcapOnDate?.marketcap || 0;
            totalMarketcap += marketcapValue;
            securitiesBreakdown[sec.securityId] = marketcapValue;
          });

          if (totalMarketcap > 0) {
            aggregatedHistory.push({
              date,
              totalMarketcap,
              securitiesBreakdown,
            });
          }
        });

      return {
        companyId: company.companyId,
        companyName: company.name,
        companyKorName: company.korName,
        totalMarketcap: currentTotalMarketcap,
        totalMarketcapDate: company.marketcapDate ? (company.marketcapDate instanceof Date ? company.marketcapDate : new Date(company.marketcapDate)) : new Date(),
        securities: securitiesData,
        aggregatedHistory,
      };
    } catch (error) {
      console.error("[getCompanyAggregatedMarketcap] ERROR:", error);
      return null;
    }
  },
  ["getCompanyAggregatedMarketcap"],
  { tags: ["getCompanyAggregatedMarketcap"] }
);

// Neighbor navigation helpers around a given rank
export const getMarketCapPageData = async (rank: number) => {
  try {
    const results = await db.query.company.findMany({
      where: inArray(schema.company.marketcapRank, [rank - 1, rank, rank + 1]),
      columns: { companyId: true, name: true, korName: true, marketcapRank: true },
    });
    return results.filter((item) => item.marketcapRank !== null);
  } catch (error) {
    console.error("[company.getMarketCapPageData] ERROR:", error);
    return [];
  }
};

export const getCompanyMarketCapPageData = async (rank: number) => {
  try {
    const results = await db.query.company.findMany({
      where: inArray(schema.company.marketcapRank, [rank - 1, rank, rank + 1]),
      columns: { companyId: true, name: true, korName: true, marketcapRank: true },
      with: {
        securities: {
          where: and(eq(schema.security.type, "보통주"), isNull(schema.security.delistingDate)),
          columns: { ticker: true, exchange: true },
          limit: 1,
        },
      },
    });

    return results
      .filter((item) => item.marketcapRank !== null && item.securities.length > 0)
      .map((item) => ({
        companyId: item.companyId,
        name: item.name,
        korName: item.korName,
        marketcapRank: item.marketcapRank,
        primaryTicker: item.securities[0].ticker,
        exchange: item.securities[0].exchange || "KOSPI",
      }));
  } catch (error) {
    console.error("[company.getCompanyMarketCapPageData] ERROR:", error);
    return [];
  }
};
