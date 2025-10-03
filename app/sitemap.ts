import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getSitemapChunks } from "@/lib/sitemap/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const chunks = await getSitemapChunks();
  const entries: MetadataRoute.Sitemap = [];

  if (chunks.core.length > 0) {
    entries.push({
      url: `${siteConfig.url}/sitemaps/core-0`,
      lastModified: now,
    });
  }

  chunks.securities.forEach((_, index) => {
    entries.push({
      url: `${siteConfig.url}/sitemaps/securities-${index}`,
      lastModified: now,
    });
  });

  chunks.companies.forEach((_, index) => {
    entries.push({
      url: `${siteConfig.url}/sitemaps/companies-${index}`,
      lastModified: now,
    });
  });

  return entries;
}
