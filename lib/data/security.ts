import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, inArray, isNull, isNotNull, ne, lt, gt, sql } from "drizzle-orm";
import { computeMixedPagination } from "./pagination";

// Count ranked securities for a given metric
export const countSecurityRanks = unstable_cache(
  async (metricType: schema.MetricType) => {
    try {
      const latestRankDateResult = await db
        .select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
        .from(schema.securityRank)
        .where(eq(schema.securityRank.metricType, metricType));

      const latestRankDate = latestRankDateResult[0]?.maxDate;

      if (!latestRankDate) return 0;

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.securityRank)
        .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
        .where(and(
          eq(schema.securityRank.metricType, metricType),
          eq(schema.securityRank.rankDate, latestRankDate),
          isNull(schema.security.delistingDate),
          isNotNull(schema.securityRank.currentRank)
        ));

      return Number(totalResult[0].count);
    } catch (e) {
      console.error(`[countSecurityRanks] ERROR for ${metricType}:`, e);
      return 0;
    }
  },
  ["countSecurityRanks"],
  { tags: ["countSecurityRanks"] }
);

// Generic function to get ranked securities by a given metric
export const getSecurityRanksPage = unstable_cache(
  async (metricType: schema.MetricType, page: number, sortOrder: 'asc' | 'desc' = 'asc') => {
    const { limit, skip } = computeMixedPagination(page);
    try {
      // Find the most recent date in security_rank for the given metric
      const latestRankDateResult = await db
        .select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
        .from(schema.securityRank)
        .where(eq(schema.securityRank.metricType, metricType));

      const latestRankDate = latestRankDateResult[0]?.maxDate;

      if (!latestRankDate) {
        return { items: [], latestDate: null };
      }

      const orderFunction = sortOrder === 'asc' ? asc : desc;

      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          value: schema.securityRank.value, // Use the value from security_rank
          currentRank: schema.securityRank.currentRank,
          priorRank: schema.securityRank.priorRank,
          company: {
            korName: schema.company.korName,
            logo: schema.company.logo,
          },
        })
        .from(schema.security)
        .innerJoin(
          schema.securityRank,
          and(
            eq(schema.securityRank.securityId, schema.security.securityId),
            eq(schema.securityRank.metricType, metricType),
            eq(schema.securityRank.rankDate, latestRankDate)
          )
        )
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.securityRank.currentRank)
          )
        )
        .orderBy(metricType === 'div' || metricType === 'dps' || metricType === 'bps' || metricType === 'eps' ? desc(schema.securityRank.value) : orderFunction(schema.securityRank.currentRank))
        .limit(limit)
        .offset(skip);

      const securityIds = rows.map((r) => r.securityId).filter(Boolean);
      let pricesBySec: Record<string, Array<{ securityId: string; exchange: string | null; open: number | null; high: number | null; low: number | null; close: number | null; rate: number | null; date: Date; updatedAt: Date | null }>> = {};
      if (securityIds.length > 0) {
        const rawPrices = await db.query.price.findMany({
          where: inArray(schema.price.securityId, securityIds),
          columns: {
            securityId: true,
            exchange: true,
            open: true,
            high: true,
            low: true,
            close: true,
            rate: true,
            date: true,
            updatedAt: true,
          },
          orderBy: [desc(schema.price.date)],
          limit: securityIds.length * 60,
        });
        for (const p of rawPrices) {
          // Skip records with null securityId
          if (!p.securityId) continue;
          const key = p.securityId;
          if (!pricesBySec[key]) pricesBySec[key] = [];
          if (pricesBySec[key].length < 60) {
            // Create properly typed object
            pricesBySec[key].push({
              securityId: p.securityId,
              exchange: p.exchange,
              open: p.open,
              high: p.high,
              low: p.low,
              close: p.close,
              rate: p.rate,
              date: p.date,
              updatedAt: p.updatedAt,
            });
          }
        }
        for (const key of Object.keys(pricesBySec)) {
          const group = pricesBySec[key];
          const sliced = group.slice(0, 30);
          sliced.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          pricesBySec[key] = sliced;
        }
      }

      const itemsWithPrices = rows.map((item) => ({
        ...item,
        prices: pricesBySec[item.securityId] || [],
      }));

      return { items: itemsWithPrices, latestDate: latestRankDate };
    } catch (e) {
      console.error(`[getSecurityRanksPage] ERROR for ${metricType}:`, e);
      return { items: [], latestDate: null };
    }
  },
  ["getSecurityRanksPage"],
  { tags: ["getSecurityRanksPage"] }
);


export const getPricesBySecurityIds = unstable_cache(
  async (securityIds: string[]) => {
    try {
      if (!securityIds || securityIds.length === 0) return {} as Record<string, any[]>;

      const prices = await db.query.price.findMany({
        where: inArray(schema.price.securityId, securityIds),
        columns: {
          securityId: true,
          exchange: true,
          open: true,
          high: true,
          low: true,
          close: true,
          rate: true,
          date: true,
          updatedAt: true,
        },
        orderBy: [desc(schema.price.date)],
        // Fetch a bit more than 30 to be safe, then slice
        limit: securityIds.length * 30,
      });

      const grouped: Record<string, any[]> = {};
      prices.forEach((p) => {
        if (!p.securityId) return;
        if (!grouped[p.securityId]) {
          grouped[p.securityId] = [];
        }
        // Only take the last 30 prices for each security
        if (grouped[p.securityId].length < 30) {
          grouped[p.securityId].push(p);
        }
      });

      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      return grouped;
    } catch (e) {
      console.error("[getPricesBySecurityIds] ERROR:", e);
      return {};
    }
  },
  ["getPricesBySecurityIds"],
  { tags: ["getPricesBySecurityIds"] }
);



// Marketcap history by securityId
export const getMarketCapHistoryBySecurityId = unstable_cache(
  async (securityId: string) => {
    try {
      if (!securityId) return [] as Array<{
        date: Date; marketcap: number; ticker: string | null; name: string | null; korName: string | null; exchange: string | null
      }>;
      const marketcaps = await db.query.marketcap.findMany({
        where: eq(schema.marketcap.securityId, securityId),
        columns: {
          date: true,
          marketcap: true,
          ticker: true,
          name: true,
          korName: true,
          exchange: true,
        },
        orderBy: [asc(schema.marketcap.date)],
      });
      return marketcaps;
    } catch (e) {
      console.error("[getMarketCapHistoryBySecurityId] ERROR:", e);
      return [];
    }
  },
  ["getMarketCapHistoryBySecurityId"],
  { tags: ["getMarketCapHistoryBySecurityId"] }
);

export const getMarketCapHistoryBySecurityIds = unstable_cache(
  async (securityIds: string[]) => {
    try {
      if (!securityIds || securityIds.length === 0) return {} as Record<string, any[]>;
      const marketcaps = await db.query.marketcap.findMany({
        where: inArray(schema.marketcap.securityId, securityIds),
        columns: {
          securityId: true,
          date: true,
          marketcap: true,
          ticker: true,
          name: true,
          korName: true,
          exchange: true,
        },
        orderBy: [schema.marketcap.securityId, asc(schema.marketcap.date)],
      });
      const grouped: Record<string, any[]> = {};
      marketcaps.forEach((m) => {
        if (!m.securityId) return;
        if (!grouped[m.securityId]) grouped[m.securityId] = [];
        grouped[m.securityId].push({
          date: m.date,
          marketcap: m.marketcap,
          ticker: m.ticker,
          name: m.name,
          korName: m.korName,
          exchange: m.exchange,
        });
      });
      return grouped;
    } catch (e) {
      console.error("[getMarketCapHistoryBySecurityIds] ERROR:", e);
      return {};
    }
  },
  ["getMarketCapHistoryBySecurityIds"],
  { tags: ["getMarketCapHistoryBySecurityIds"] }
);

// Neighbor navigation for security marketcap
export const getSecurityMarketCapPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Find the most recent date in security_rank for marketcap
      const latestRankDateResult = await db
        .select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
        .from(schema.securityRank)
        .where(eq(schema.securityRank.metricType, 'marketcap'));

      const latestRankDate = latestRankDateResult[0]?.maxDate;

      if (!latestRankDate) {
        return [];
      }

      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          marketcapRank: schema.securityRank.currentRank,
        })
        .from(schema.security)
        .innerJoin(
          schema.securityRank,
          and(
            eq(schema.securityRank.securityId, schema.security.securityId),
            eq(schema.securityRank.metricType, 'marketcap'),
            eq(schema.securityRank.rankDate, latestRankDate),
            inArray(schema.securityRank.currentRank, [rank - 1, rank, rank + 1])
          )
        )
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.securityRank.currentRank)
          )
        )
        .orderBy(asc(schema.securityRank.currentRank));

      return rows.filter((item) => item.marketcapRank !== null);
    } catch (e) {
      console.error(`[getSecurityMarketCapPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityMarketCapPageData"],
  { tags: ["getSecurityMarketCapPageData"] }
);

// ---------- Security lookup and metrics (migrated from getSecCode/getSecurities) ----------

function parseSecCode(secCode: string): { market: string; code: string } | null {
  const parts = secCode.split('.');
  if (parts.length !== 2) return null;
  return { market: parts[0], code: parts[1] };
}

export const getSecurityByCode = unstable_cache(
  async (secCode: string) => {
    try {
      const parsed = parseSecCode(secCode);
      if (parsed) {
        const security = await db.query.security.findFirst({
          where: eq(schema.security.ticker, parsed.code),
          with: {
            company: true,
            prices: {
              orderBy: [desc(schema.price.date)],
              limit: 180,
            },
            marketcaps: { orderBy: [schema.marketcap.date], limit: 100 },
          },
        });
        if (security) return security;

        const companyByCode = await db.query.company.findFirst({
          where: eq(schema.company.name, parsed.code),
          with: {
            securities: {
              where: eq(schema.security.type, '보통주'),
              limit: 1,
              with: {
                prices: {
                  orderBy: [desc(schema.price.date)],
                  limit: 180,
                },
              },
            },
          },
        });
        if (companyByCode && companyByCode.securities.length > 0) {
          return { ...companyByCode.securities[0], company: companyByCode } as any;
        }
      } else {
        const decodedParam = decodeURIComponent(secCode);
        const securityByName = await db.query.security.findFirst({
          where: eq(schema.security.name, decodedParam),
          with: {
            company: true,
            prices: {
              orderBy: [desc(schema.price.date)],
              limit: 180,
            },
            marketcaps: { orderBy: [schema.marketcap.date], limit: 100 },
          },
        });
        if (securityByName) return securityByName;

        const securityByTicker = await db.query.security.findFirst({
          where: eq(schema.security.ticker, decodedParam),
          with: {
            company: true,
            prices: {
              orderBy: [desc(schema.price.date)],
              limit: 180,
            },
            marketcaps: { orderBy: [schema.marketcap.date], limit: 100 },
          },
        });
        if (securityByTicker) return securityByTicker;

        const companyByName = await db.query.company.findFirst({
          where: eq(schema.company.korName, decodedParam),
          with: {
            securities: {
              where: eq(schema.security.type, '보통주'),
              limit: 1,
              with: {
                prices: {
                  orderBy: [desc(schema.price.date)],
                  limit: 180,
                },
              },
            },
          },
        });
        if (companyByName && companyByName.securities.length > 0) {
          return { ...companyByName.securities[0], company: companyByName } as any;
        }

        const display = await db.query.displayName.findFirst({ where: eq(schema.displayName.value, decodedParam) });
        if (display) {
          const companyByDisplay = await db.query.company.findFirst({
            where: eq(schema.company.companyId, display.companyId),
            with: {
              securities: {
                where: eq(schema.security.type, '보통주'),
                limit: 1,
                with: {
                  prices: {
                    orderBy: [desc(schema.price.date)],
                    limit: 180,
                  },
                },
              },
            },
          });
          if (companyByDisplay && companyByDisplay.securities.length > 0) {
            return { ...companyByDisplay.securities[0], company: companyByDisplay } as any;
          }
        }
      }
      return null;
    } catch (e) {
      console.error(`[getSecurityByCode] Error for "${secCode}"`, e);
      return null;
    }
  },
  ['getSecurityByCode'],
  { tags: ['getSecurityByCode'] }
);

export const getCompanySecurities = unstable_cache(
  async (companyId: string) => {
    try {
      if (!companyId) return [];
      const securities = await db.query.security.findMany({
        where: and(eq(schema.security.companyId, companyId), isNull(schema.security.delistingDate)),
        columns: {
          securityId: true,
          name: true,
          korName: true,
          type: true,
          exchange: true,
          companyId: true,
          ticker: true,
          marketcap: true,
          marketcapDate: true,
          shares: true,
          sharesDate: true,
          updatedAt: true,
          createdAt: true,
        },
        with: {
          company: {
            columns: { companyId: true, name: true, korName: true, marketcapRank: true, industry: true },
          },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 1,
            columns: {
              id: true,
              securityId: true,
              date: true,
              ticker: true,
              name: true,
              korName: true,
              exchange: true,
              open: true,
              high: true,
              low: true,
              close: true,
              volume: true,
              fvolume: true,
              transaction: true,
              rate: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          marketcaps: {
            orderBy: [desc(schema.marketcap.date)],
            limit: 5,
            columns: {
              id: true,
              securityId: true,
              date: true,
              ticker: true,
              name: true,
              korName: true,
              exchange: true,
              marketcap: true,
              volume: true,
              transaction: true,
              shares: true,
              createdAt: true,
            },
          },
        },
        orderBy: [asc(schema.security.type)],
      });
      return securities.filter(s => s.companyId !== null && s.marketcap !== null).map(s => ({ ...s, companyId: s.companyId!, marketcap: s.marketcap! }));
    } catch (e) {
      console.error('[getCompanySecurities] ERROR:', e);
      return [];
    }
  },
  ['getCompanySecurities'],
  { tags: ['getCompanySecurities'] }
);

export const getSecurityMetricsHistory = unstable_cache(
  async (securityId: string) => {
    try {
      if (!securityId) return [] as Array<{ date: Date; bps: number | null; per: number | null; pbr: number | null; eps: number | null; div: number | null; dps: number | null }>;
      const data = await db.query.bppedd.findMany({
        where: eq(schema.bppedd.securityId, securityId),
        columns: { date: true, bps: true, per: true, pbr: true, eps: true, div: true, dps: true },
        orderBy: [asc(schema.bppedd.date)],
      });

      return data;
    } catch (e) {
      console.error('[getSecurityMetricsHistory] ERROR:', e);
      return [];
    }
  },
  ['getSecurityMetricsHistory'],
  { tags: ['getSecurityMetricsHistory'] }
);

// ===== Metrics rankings (PER, PBR, DIV, DPS, BPS, EPS) =====



export const getSecurityDivPage = unstable_cache(
  async (skip: number = 0) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(isNotNull(schema.security.div), ne(schema.security.div, 0), isNull(schema.security.delistingDate)),
        orderBy: [desc(schema.security.div)],
        limit: 100,
        offset: skip,
        columns: {
          securityId: true,
          name: true,
          div: true,
          divDate: true,
          korName: true,
          exchange: true,
          type: true,
          ticker: true,
          companyId: true,
        },
        with: {
          company: { columns: { companyId: true, name: true, korName: true, logo: true } },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
            columns: { open: true, close: true, rate: true, date: true, updatedAt: true },
          },
        },
      });
      return securities.map((sec) => ({
        ...sec,
        div: Number(sec.div),
        prices: (sec.prices || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
    } catch (e) {
      console.error("[getSecurityDivPage] ERROR:", e);
      return [];
    }
  },
  ["getSecurityDivPage"],
  { tags: ["getSecurityDivPage"] }
);

export const getSecurityDpsPage = unstable_cache(
  async (skip: number = 0) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(isNotNull(schema.security.dps), ne(schema.security.dps, 0), isNull(schema.security.delistingDate)),
        orderBy: [desc(schema.security.dps)],
        limit: 100,
        offset: skip,
        columns: {
          securityId: true,
          name: true,
          dps: true,
          dpsDate: true,
          korName: true,
          exchange: true,
          ticker: true,
          type: true,
          companyId: true,
        },
        with: {
          company: { columns: { companyId: true, name: true, korName: true, logo: true } },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
            columns: { open: true, close: true, rate: true, date: true, updatedAt: true },
          },
        },
      });
      return securities.map((sec) => ({
        ...sec,
        dps: Number(sec.dps),
        prices: (sec.prices || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
    } catch (e) {
      console.error("[getSecurityDpsPage] ERROR:", e);
      return [];
    }
  },
  ["getSecurityDpsPage"],
  { tags: ["getSecurityDpsPage"] }
);

export const getSecurityBpsPage = unstable_cache(
  async (skip: number = 0) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(isNotNull(schema.security.bps), ne(schema.security.bps, 0), isNull(schema.security.delistingDate)),
        orderBy: [desc(schema.security.bps)],
        limit: 100,
        offset: skip,
        columns: {
          securityId: true,
          name: true,
          bps: true,
          bpsDate: true,
          korName: true,
          exchange: true,
          ticker: true,
          type: true,
          companyId: true,
        },
        with: {
          company: { columns: { companyId: true, name: true, korName: true, logo: true } },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
            columns: { open: true, close: true, rate: true, date: true, updatedAt: true },
          },
        },
      });
      return securities.map((sec) => ({
        ...sec,
        bps: Number(sec.bps),
        prices: (sec.prices || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
    } catch (e) {
      console.error("[getSecurityBpsPage] ERROR:", e);
      return [];
    }
  },
  ["getSecurityBpsPage"],
  { tags: ["getSecurityBpsPage"] }
);

export const getSecurityPbrPage = unstable_cache(
  async (skip: number = 0) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(isNotNull(schema.security.pbr), ne(schema.security.pbr, 0), isNull(schema.security.delistingDate)),
        orderBy: [asc(schema.security.pbr)],
        limit: 100,
        offset: skip,
        columns: {
          securityId: true,
          name: true,
          pbr: true,
          pbrDate: true,
          korName: true,
          exchange: true,
          ticker: true,
          type: true,
          companyId: true,
        },
        with: {
          company: { columns: { companyId: true, name: true, korName: true, logo: true } },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
            columns: { open: true, close: true, rate: true, date: true, updatedAt: true },
          },
        },
      });
      return securities.map((sec) => ({
        ...sec,
        pbr: Number(sec.pbr),
        prices: (sec.prices || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
    } catch (e) {
      console.error("[getSecurityPbrPage] ERROR:", e);
      return [];
    }
  },
  ["getSecurityPbrPage"],
  { tags: ["getSecurityPbrPage"] }
);

export const getSecurityEpsPage = unstable_cache(
  async (skip: number = 0) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(isNotNull(schema.security.eps), ne(schema.security.eps, 0), isNull(schema.security.delistingDate)),
        orderBy: [desc(schema.security.eps)],
        limit: 100,
        offset: skip,
        columns: {
          securityId: true,
          name: true,
          eps: true,
          epsDate: true,
          korName: true,
          exchange: true,
          ticker: true,
          type: true,
          companyId: true,
        },
        with: {
          company: { columns: { companyId: true, name: true, korName: true, logo: true } },
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
            columns: { open: true, close: true, rate: true, date: true, updatedAt: true },
          },
        },
      });
      return securities.map((sec) => ({
        ...sec,
        eps: Number(sec.eps),
        prices: (sec.prices || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
    } catch (e) {
      console.error("[getSecurityEpsPage] ERROR:", e);
      return [];
    }
  },
  ["getSecurityEpsPage"],
  { tags: ["getSecurityEpsPage"] }
);



export const countSecurityPbr = unstable_cache(async () => {
  try {
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(isNotNull(schema.security.pbr), ne(schema.security.pbr, 0), isNull(schema.security.delistingDate)));
    return Number(result[0]?.count) || 0;
  } catch { return 0; }
}, ["countSecurityPbr"], { tags: ["countSecurityPbr"], revalidate: 3600 });

export const countSecurityDividendYield = unstable_cache(async () => {
  try {
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(isNotNull(schema.security.div), ne(schema.security.div, 0), isNull(schema.security.delistingDate)));
    return Number(result[0]?.count) || 0;
  } catch { return 0; }
}, ["countSecurityDividendYield"], { tags: ["countSecurityDividendYield"], revalidate: 3600 });

export const countSecurityDps = unstable_cache(async () => {
  try {
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(isNotNull(schema.security.dps), ne(schema.security.dps, 0), isNull(schema.security.delistingDate)));
    return Number(result[0]?.count) || 0;
  } catch { return 0; }
}, ["countSecurityDps"], { tags: ["countSecurityDps"], revalidate: 3600 });

export const countSecurityBps = unstable_cache(async () => {
  try {
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(isNotNull(schema.security.bps), ne(schema.security.bps, 0), isNull(schema.security.delistingDate)));
    return Number(result[0]?.count) || 0;
  } catch { return 0; }
}, ["countSecurityBps"], { tags: ["countSecurityBps"], revalidate: 3600 });

export const countSecurityEps = unstable_cache(async () => {
  try {
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(isNotNull(schema.security.eps), ne(schema.security.eps, 0), isNull(schema.security.delistingDate)));
    return Number(result[0]?.count) || 0;
  } catch { return 0; }
}, ["countSecurityEps"], { tags: ["countSecurityEps"], revalidate: 3600 });

export const countSecurityMarketcap = unstable_cache(async () => {
  try {
    return await countSecurityRanks('marketcap');
  } catch { return 0; }
}, ["countSecurityMarketcap"], { tags: ["countSecurityMarketcap"], revalidate: 3600 });

// Rank helpers
export const getPerRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(eq(schema.security.securityId, securityId), isNotNull(schema.security.per), ne(schema.security.per, 0), isNull(schema.security.delistingDate)),
      columns: { per: true },
    });
    if (!target?.per) return null;
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(lt(schema.security.per, target.per), isNotNull(schema.security.per), ne(schema.security.per, 0), isNull(schema.security.delistingDate)));
    return (Number(result[0]?.count) || 0) + 1;
  } catch { return null; }
}, ["getPerRank"], { tags: ["getPerRank"] });

// Neighbor navigation for security PER
export const getSecurityPerPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with PER data, ordered by PER ascending (lower PER = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          per: schema.security.per,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.per),
            ne(schema.security.per, 0),
            gt(schema.security.per, 0) // PER must be positive
          )
        )
        .orderBy(asc(schema.security.per));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        perRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.perRank >= rank - 1 && item.perRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityPerPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityPerPageData"],
  { tags: ["getSecurityPerPageData"] }
);

// Neighbor navigation for security PBR
export const getSecurityPbrPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with PBR data, ordered by PBR ascending (lower PBR = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          pbr: schema.security.pbr,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.pbr),
            ne(schema.security.pbr, 0),
            gt(schema.security.pbr, 0) // PBR must be positive
          )
        )
        .orderBy(asc(schema.security.pbr));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        pbrRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.pbrRank >= rank - 1 && item.pbrRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityPbrPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityPbrPageData"],
  { tags: ["getSecurityPbrPageData"] }
);

// Neighbor navigation for security DIV
export const getSecurityDivPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with DIV data, ordered by DIV descending (higher DIV = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          div: schema.security.div,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.div),
            ne(schema.security.div, 0),
            gt(schema.security.div, 0) // DIV must be positive
          )
        )
        .orderBy(desc(schema.security.div));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        divRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.divRank >= rank - 1 && item.divRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityDivPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityDivPageData"],
  { tags: ["getSecurityDivPageData"] }
);

// Neighbor navigation for security EPS
export const getSecurityEpsPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with EPS data, ordered by EPS descending (higher EPS = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          eps: schema.security.eps,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.eps),
            ne(schema.security.eps, 0)
          )
        )
        .orderBy(desc(schema.security.eps));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        epsRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.epsRank >= rank - 1 && item.epsRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityEpsPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityEpsPageData"],
  { tags: ["getSecurityEpsPageData"] }
);

// Neighbor navigation for security DPS
export const getSecurityDpsPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with DPS data, ordered by DPS descending (higher DPS = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          dps: schema.security.dps,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.dps),
            ne(schema.security.dps, 0),
            gt(schema.security.dps, 0) // DPS must be positive
          )
        )
        .orderBy(desc(schema.security.dps));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        dpsRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.dpsRank >= rank - 1 && item.dpsRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityDpsPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityDpsPageData"],
  { tags: ["getSecurityDpsPageData"] }
);

// Neighbor navigation for security BPS
export const getSecurityBpsPageData = unstable_cache(
  async (rank: number) => {
    try {
      // Get securities with BPS data, ordered by BPS descending (higher BPS = higher rank)
      const rows = await db
        .select({
          securityId: schema.security.securityId,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
          ticker: schema.security.ticker,
          type: schema.security.type,
          companyId: schema.security.companyId,
          bps: schema.security.bps,
        })
        .from(schema.security)
        .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
        .where(
          and(
            isNull(schema.security.delistingDate),
            isNotNull(schema.security.bps),
            ne(schema.security.bps, 0),
            gt(schema.security.bps, 0) // BPS must be positive
          )
        )
        .orderBy(desc(schema.security.bps));

      // Add rank to each item
      const rankedItems = rows.map((item, index) => ({
        ...item,
        bpsRank: index + 1,
      }));

      // Find items around the target rank
      const targetItems = rankedItems.filter(item =>
        item.bpsRank >= rank - 1 && item.bpsRank <= rank + 1
      );

      return targetItems;
    } catch (e) {
      console.error(`[getSecurityBpsPageData] ERROR for rank ${rank}:`, e);
      return [];
    }
  },
  ["getSecurityBpsPageData"],
  { tags: ["getSecurityBpsPageData"] }
);

export const getPbrRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(eq(schema.security.securityId, securityId), isNotNull(schema.security.pbr), ne(schema.security.pbr, 0), isNull(schema.security.delistingDate)),
      columns: { pbr: true },
    });
    if (!target?.pbr) return null;
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(sql`${schema.security.pbr} < ${target.pbr}`, isNotNull(schema.security.pbr), ne(schema.security.pbr, 0), isNull(schema.security.delistingDate)));
    return (Number(result[0]?.count) || 0) + 1;
  } catch { return null; }
}, ["getPbrRank"], { tags: ["getPbrRank"] });

export const getDivRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(eq(schema.security.securityId, securityId), isNotNull(schema.security.div), ne(schema.security.div, 0), isNull(schema.security.delistingDate)),
      columns: { div: true },
    });
    if (!target?.div) return null;
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(sql`${schema.security.div} > ${target.div}`, isNotNull(schema.security.div), ne(schema.security.div, 0), isNull(schema.security.delistingDate)));
    return (Number(result[0]?.count) || 0) + 1;
  } catch { return null; }
}, ["getDivRank"], { tags: ["getDivRank"] });

export const getEpsRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(eq(schema.security.securityId, securityId), isNotNull(schema.security.eps), ne(schema.security.eps, 0), isNull(schema.security.delistingDate)),
      columns: { eps: true },
    });
    if (!target?.eps) return null;
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(sql`${schema.security.eps} > ${target.eps}`, isNotNull(schema.security.eps), ne(schema.security.eps, 0), isNull(schema.security.delistingDate)));
    return (Number(result[0]?.count) || 0) + 1;
  } catch { return null; }
}, ["getEpsRank"], { tags: ["getEpsRank"] });

export const getDpsRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(eq(schema.security.securityId, securityId), isNotNull(schema.security.dps), ne(schema.security.dps, 0), isNull(schema.security.delistingDate)),
      columns: { dps: true },
    });
    if (!target?.dps) return null;
    const result = await db.select({ count: sql`COUNT(*)` }).from(schema.security)
      .where(and(sql`${schema.security.dps} > ${target.dps}`, isNotNull(schema.security.dps), ne(schema.security.dps, 0), isNull(schema.security.delistingDate)));
    return (Number(result[0]?.count) || 0) + 1;
  } catch { return null; }
}, ["getDpsRank"], { tags: ["getDpsRank"] });

export const getBpsRank = unstable_cache(async (securityId: string) => {
  try {
    const target = await db.query.security.findFirst({
      where: and(
        eq(schema.security.securityId, securityId),
        isNotNull(schema.security.bps),
        ne(schema.security.bps, 0),
        isNull(schema.security.delistingDate)
      ),
      columns: { bps: true },
    });
    if (!target?.bps) return null;
    // Higher BPS is better → rank by count of securities with higher BPS
    const result = await db
      .select({ count: sql`COUNT(*)` })
      .from(schema.security)
      .where(
        and(
          sql`${schema.security.bps} > ${target.bps}`,
          isNotNull(schema.security.bps),
          ne(schema.security.bps, 0),
          isNull(schema.security.delistingDate)
        )
      );
    return (Number(result[0]?.count) || 0) + 1;
  } catch {
    return null;
  }
}, ["getBpsRank"], { tags: ["getBpsRank"] });