// app/sitemap.xml/route.ts

// static으로 빌드 시 생성되도록 설정
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const baseUrl = "https://www.chundan.xyz"; // 실제 사이트 도메인으로 변경하세요.

  // sitemap에 포함할 개별 sitemap URL 목록
  const sitemapUrls: string[] = [
    `${baseUrl}/corp/marketcap/sitemap.xml`,
    //
    `${baseUrl}/sec/bps/sitemap.xml`,
    `${baseUrl}/sec/div/sitemap.xml`,
    `${baseUrl}/sec/dps/sitemap.xml`,
    `${baseUrl}/sec/eps/sitemap.xml`,
    `${baseUrl}/sec/marketcap/sitemap.xml`,
    `${baseUrl}/sec/pbr/sitemap.xml`,
    `${baseUrl}/sec/per/sitemap.xml`,
    //
    `${baseUrl}/bps/sitemap.xml`,
    `${baseUrl}/div/sitemap.xml`,
    `${baseUrl}/dps/sitemap.xml`,
    `${baseUrl}/eps/sitemap.xml`,
    `${baseUrl}/marketcap/sitemap.xml`,
    `${baseUrl}/marketcaps/sitemap.xml`,
    `${baseUrl}/pbr/sitemap.xml`,
    `${baseUrl}/per/sitemap.xml`,
  ];

  // sitemap index XML 문자열 생성
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapUrls.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join("")}
</sitemapindex>`;

  return new Response(sitemapIndex, {
    headers: { "Content-Type": "text/xml" },
  });
}
