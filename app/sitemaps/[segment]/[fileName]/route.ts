import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

const buildSitemap = (entries: ReturnType<typeof withBaseUrl>) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    ({ url, lastModified }) =>
      `  <url>
    <loc>${url}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

async function buildSitemapStaticParams() {
  const chunks = await getSitemapChunks();
  const params: Array<{ segment: string; fileName: string }> = [];

  chunks.core.forEach((_, index) => {
    params.push({ segment: `core-${index}`, fileName: "sitemap.xml" });
  });

  chunks.securities.forEach((_, index) => {
    params.push({ segment: `securities-${index}`, fileName: "sitemap.xml" });
  });

  chunks.companies.forEach((_, index) => {
    params.push({ segment: `companies-${index}`, fileName: "sitemap.xml" });
  });

  return params;
}

export const generateStaticParams = process.env.NEXT_OUTPUT_MODE?.toLowerCase() === "export"
  ? buildSitemapStaticParams
  : undefined;

export async function GET(
  request: Request,
  context: { params: Promise<{ segment: string; fileName: string }> }
) {
  const { segment, fileName } = await context.params;
  if (fileName !== "sitemap.xml") {
    notFound();
  }
  const chunks = await getSitemapChunks();
  const [type, rawIndex] = segment.split("-");
  const index = rawIndex ? Number(rawIndex) : 0;

  if (Number.isNaN(index) || index < 0) {
    notFound();
  }

  let entries: string[] | undefined;
  switch (type) {
    case "core":
      entries = chunks.core[index];
      break;
    case "securities":
      entries = chunks.securities[index];
      break;
    case "companies":
      entries = chunks.companies[index];
      break;
    default:
      entries = undefined;
  }

  if (!entries || entries.length === 0) {
    notFound();
  }

  const origin = process.env.NEXT_OUTPUT_MODE?.toLowerCase() === "export"
    ? siteConfig.url
    : new URL(request.url).origin;
  const urls = withBaseUrl(entries, new Date(), origin);
  const xml = buildSitemap(urls);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
