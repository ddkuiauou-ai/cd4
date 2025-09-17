import { db } from "@/db";
import { unstable_cache } from "next/cache";
import * as schema from "@/db/schema-postgres";
import { desc, sql, and } from "drizzle-orm";

// Trending stocks: top gainers, losers, volume leaders over recent 7 days
export const getTrendingStocks = unstable_cache(
  async () => {
    try {
      const allSecurities = await db.query.security.findMany({
        with: {
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 2,
          },
          company: {
            columns: {
              companyId: true,
              name: true,
              korName: true,
              marketcap: true,
            },
          },
        },
        where: sql`EXISTS (
          SELECT 1 FROM ${schema.price}
          WHERE ${schema.price.securityId} = ${schema.security.securityId}
          AND ${schema.price.date} >= NOW() - INTERVAL '7 day'
        )`,
      });

      const processed = allSecurities
        .filter((sec) => sec.prices.length >= 1)
        .map((sec) => {
          const latestPrice = sec.prices[0];
          const prevPrice = sec.prices.length > 1 ? sec.prices[1] : null;
          const change = prevPrice ? latestPrice.close - prevPrice.close : 0;
          const changePercent = prevPrice && prevPrice.close > 0 ? (change / prevPrice.close) * 100 : 0;
          return {
            securityId: sec.securityId,
            name: sec.name,
            korName: sec.company?.korName || sec.name,
            price: latestPrice.close,
            change,
            changePercent,
            volume: (latestPrice as any).volume || 0,
            marketcap: sec.company?.marketcap,
            type: sec.type,
            exchange: sec.exchange,
          };
        });

      const gainers = [...processed]
        .filter((s) => s.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 10);

      const losers = [...processed]
        .filter((s) => s.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 10);

      const volume = [...processed].sort((a, b) => (b.volume as number) - (a.volume as number)).slice(0, 10);

      return { gainers, losers, volume };
    } catch (error) {
      console.error("[getTrendingStocks] ERROR:", error);
      return { gainers: [], losers: [], volume: [] };
    }
  },
  ["getTrendingStocks"],
  { tags: ["getTrendingStocks"], revalidate: 300 }
);

// Recommended stocks based on basic filters
export const getRecommendedStocks = unstable_cache(
  async (limit = 8) => {
    try {
      const securities = await db.query.security.findMany({
        where: and(
          sql`${schema.security.type} = '보통주'`,
          sql`EXISTS (
            SELECT 1 FROM ${schema.company}
            WHERE ${schema.company.companyId} = ${schema.security.companyId}
            AND ${schema.company.marketcap} >= 10000000000
          )`,
          sql`EXISTS (
            SELECT 1 FROM ${schema.price}
            WHERE ${schema.price.securityId} = ${schema.security.securityId}
            AND ${schema.price.date} >= NOW() - INTERVAL '30 day'
          )`
        ),
        limit,
        with: {
          prices: {
            orderBy: [desc(schema.price.date)],
            limit: 30,
          },
          company: {
            columns: {
              companyId: true,
              name: true,
              korName: true,
              marketcap: true,
            },
          },
        },
      });

      const recommendations = securities.map((sec) => {
        const latestPrice = sec.prices[0];
        return {
          security: {
            securityId: sec.securityId,
            name: sec.name,
            korName: sec.company?.korName || sec.name,
            exchange: sec.exchange,
            type: sec.type,
          },
          price: {
            close: latestPrice.close,
            rate: latestPrice.rate,
          },
          marketcap: sec.company?.marketcap,
        };
      });

      return recommendations;
    } catch (error) {
      console.error("[getRecommendedStocks] ERROR:", error);
      return [];
    }
  },
  ["getRecommendedStocks"],
  { tags: ["getRecommendedStocks"], revalidate: 3600 }
);

