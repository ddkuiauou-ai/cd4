export const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "CD3 - 주식 시장 분석",
    "description": "한국 주식시장의 시가총액, PER, PBR, EPS, BPS, 배당수익률 등 주요 재무지표를 제공하는 투자정보 사이트",
    "url": "https://cd3.co.kr",
    "potentialAction": {
        "@type": "SearchAction",
        "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://cd3.co.kr/screener?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
    },
    "publisher": {
        "@type": "Organization",
        "name": "CD3",
        "url": "https://cd3.co.kr"
    },
    "sameAs": [
        "https://cd3.co.kr"
    ]
};

export const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "CD3",
    "description": "한국 주식시장 투자정보 분석 플랫폼",
    "url": "https://cd3.co.kr",
    "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "availableLanguage": "Korean"
    }
};

export const breadcrumbListData = (items: Array<{ name: string, url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url
    }))
});

export const stockListData = (stockList: Array<{ name: string, symbol: string, marketCap?: number }>) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "주식 시가총액 랭킹",
    "description": "한국 주식시장 시가총액 순위",
    "itemListElement": stockList.map((stock, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
            "@type": "Corporation",
            "name": stock.name,
            "identifier": stock.symbol,
            "url": `https://cd3.co.kr/security/${stock.symbol}`
        }
    }))
});
