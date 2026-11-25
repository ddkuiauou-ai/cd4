import { siteConfig } from "@/config/site";

const publisherId = `${siteConfig.url}/#organization`;

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteConfig.name,
      alternateName: "천단",
      description: siteConfig.description,
      url: `${siteConfig.url}/`,
      inLanguage: "ko-KR",
      publisher: { "@id": publisherId },
    },
    {
      "@type": "Organization",
      "@id": publisherId,
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      logo: `${siteConfig.url}/icon.svg`,
    },
  ],
};
