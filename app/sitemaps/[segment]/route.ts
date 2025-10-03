import { NextResponse } from "next/server";
import { getSitemapChunks, withBaseUrl } from "@/lib/sitemap/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { segment?: string } }
) {
  const segment = context.params?.segment;
  if (!segment) {
    return NextResponse.json({ error: "Segment required" }, { status: 400 });
  }

  const chunks = await getSitemapChunks();
  const [type, rawIndex] = segment.split("-");
  const index = rawIndex ? Number(rawIndex) : 0;

  if (Number.isNaN(index) || index < 0) {
    return NextResponse.json({ error: "Invalid index" }, { status: 404 });
  }

  const lastModified = new Date();
  let entries;

  switch (type) {
    case "core":
      entries = chunks.core[index] ?? chunks.core[0];
      break;
    case "securities":
      entries = chunks.securities[index];
      break;
    case "companies":
      entries = chunks.companies[index];
      break;
    default:
      entries = null;
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }

  const urls = withBaseUrl(entries, lastModified);
  const xml = urls
    .map((item) => {
      const loc = item.url;
      const lastmod = item.lastModified.toISOString();
      return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
    })
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
