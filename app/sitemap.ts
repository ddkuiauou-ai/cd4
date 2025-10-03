import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getSitemapChunks } from "@/lib/sitemap/utils";

const isExportBuild = (process.env.NEXT_OUTPUT_MODE || "").toLowerCase() === "export";

export const dynamic = isExportBuild ? "force-static" : "force-dynamic";
export const revalidate = isExportBuild ? 86400 : 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  let chunks;
  try {
    chunks = await getSitemapChunks();
  } catch (error) {
    console.error("[sitemap] Failed to load sitemap chunks:", error);
    return [];
  }

  const entries: MetadataRoute.Sitemap = [];

  if (chunks.core.length > 0) {
    entries.push({
      url: `${siteConfig.url}/sitemaps/core/sitemap.xml`,
      lastModified: now,
    });
  }

  chunks.securities.forEach((_, index) => {
    entries.push({
      url: `${siteConfig.url}/sitemaps/securities-${index}/sitemap.xml`,
      lastModified: now,
    });
  });

  chunks.companies.forEach((_, index) => {
    entries.push({
      url: `${siteConfig.url}/sitemaps/companies-${index}/sitemap.xml`,
      lastModified: now,
    });
  });

  return entries;
}
