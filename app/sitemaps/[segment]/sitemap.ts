import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

const isExportBuild = (process.env.NEXT_OUTPUT_MODE || "").toLowerCase() === "export";

export const dynamic = isExportBuild ? "force-static" : "force-dynamic";
export const revalidate = isExportBuild ? 86400 : 0;

export async function generateStaticParams() {
  if ((process.env.NEXT_OUTPUT_MODE || "").toLowerCase() !== "export") {
    return [];
  }

  const chunks = await getSitemapChunks();
  const params: Array<{ segment: string }> = [];

  if (chunks.core.length > 0) {
    params.push({ segment: "core-0" });
  }

  chunks.securities.forEach((_, index) => {
    params.push({ segment: `securities-${index}` });
  });

  chunks.companies.forEach((_, index) => {
    params.push({ segment: `companies-${index}` });
  });

  return params;
}

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
