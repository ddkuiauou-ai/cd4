import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

export const revalidate = 86400;

interface SitemapParams {
  params: {
    segment: string;
  };
}

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

export default async function sitemap({ params }: SitemapParams): Promise<MetadataRoute.Sitemap> {
  const { segment } = params;
  const [type, rawIndex] = segment.split("-");
  const index = rawIndex ? Number(rawIndex) : 0;

  if (Number.isNaN(index) || index < 0) {
    notFound();
  }

  const chunks = await getSitemapChunks();
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
