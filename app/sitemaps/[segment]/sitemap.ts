import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SitemapContext {
  segment?: string;
  params?: {
    segment?: string;
  };
}

export default async function sitemap(context: SitemapContext): Promise<MetadataRoute.Sitemap> {
  const segment = context.segment ?? context.params?.segment;
  if (!segment) {
    notFound();
  }

  let chunks;
  try {
    chunks = await getSitemapChunks();
  } catch (error) {
    console.error(`[sitemaps/${segment}] Failed to load chunks:`, error);
    return [];
  }

  const [type, rawIndex] = segment.split("-");
  const index = rawIndex ? Number(rawIndex) : 0;

  if (Number.isNaN(index) || index < 0) {
    notFound();
  }
  const lastModified = new Date();

  switch (type) {
    case "core": {
      if (index !== 0 || chunks.core.length === 0) notFound();
      return withBaseUrl(chunks.core[0], lastModified);
    }
    case "securities": {
      if (!chunks.securities[index]) notFound();
      return withBaseUrl(chunks.securities[index], lastModified);
    }
    case "companies": {
      if (!chunks.companies[index]) notFound();
      return withBaseUrl(chunks.companies[index], lastModified);
    }
    default:
      notFound();
  }
}
