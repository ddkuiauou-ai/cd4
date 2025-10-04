import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getSitemapChunks } from "@/lib/sitemap/utils";

const buildSitemapIndex = (urls: Array<{ loc: string; lastmod: string }>) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, lastmod }) =>
      `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>`;

export const revalidate = 0;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const now = new Date();
  const lastmod = now.toISOString();
  const chunks = await getSitemapChunks();

  const entries: Array<{ loc: string; lastmod: string }> = [];

  chunks.core.forEach((_, index) => {
    entries.push({
      loc: `${origin}/sitemaps/core-${index}/sitemap.xml`,
      lastmod,
    });
  });

  chunks.securities.forEach((_, index) => {
    entries.push({
      loc: `${origin}/sitemaps/securities-${index}/sitemap.xml`,
      lastmod,
    });
  });

  chunks.companies.forEach((_, index) => {
    entries.push({
      loc: `${origin}/sitemaps/companies-${index}/sitemap.xml`,
      lastmod,
    });
  });

  const xml = buildSitemapIndex(entries);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
