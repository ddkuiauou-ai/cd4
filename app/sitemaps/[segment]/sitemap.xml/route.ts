import { NextResponse } from "next/server";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

export const dynamic = "force-dynamic";

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

export async function generateStaticParams() {
  if ((process.env.NEXT_OUTPUT_MODE || "").toLowerCase() !== "export") {
    return [];
  }

  const chunks = await getSitemapChunks();
  const params: Array<{ segment: string }> = [];

  chunks.core.forEach((_, index) => {
    params.push({ segment: `core-${index}` });
  });

  chunks.securities.forEach((_, index) => {
    params.push({ segment: `securities-${index}` });
  });

  chunks.companies.forEach((_, index) => {
    params.push({ segment: `companies-${index}` });
  });

  return params;
}

export async function GET(
  request: Request,
  context: { params: { segment: string } }
) {
  const segment = context.params.segment;
  const chunks = await getSitemapChunks();
  const [type, rawIndex] = segment.split("-");
  const index = rawIndex ? Number(rawIndex) : 0;

  if (Number.isNaN(index) || index < 0) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 404 });
  }

  let entries;
  switch (type) {
    case "core":
      entries = chunks.core[index] ?? null;
      break;
    case "securities":
      entries = chunks.securities[index] ?? null;
      break;
    case "companies":
      entries = chunks.companies[index] ?? null;
      break;
    default:
      entries = null;
  }

  if (!entries) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const urls = withBaseUrl(entries, new Date());
  const xml = buildSitemap(urls);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
