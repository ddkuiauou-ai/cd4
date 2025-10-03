export const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "천하제일 단타대회 - 한국 주식 시장 투자 정보",
    "alternateName": "천단",
    "description": "한국 주식시장의 시가총액, PER, PBR, EPS, BPS, 배당수익률 등 주요 재무지표를 제공하는 전문 투자정보 서비스. 삼성전자, SK하이닉스 등 국내 기업 실시간 데이터 분석.",
    "url": "https://www.chundan.xyz",
    "inLanguage": "ko-KR",
    "potentialAction": {
        "@type": "SearchAction",
        "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://www.chundan.xyz/screener?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
    },
    "publisher": {
        "@type": "Organization",
        "name": "천하제일 단타대회",
        "url": "https://www.chundan.xyz",
        "logo": {
            "@type": "ImageObject",
            "url": "https://www.chundan.xyz/icon.svg"
        }
    },
    "sameAs": [
        "https://www.chundan.xyz"
    ],
    "about": {
        "@type": "Thing",
        "name": "한국 주식 시장",
        "description": "대한민국 증권거래소(KRX)에 상장된 기업들의 투자 정보"
    },
    "audience": {
        "@type": "Audience",
        "audienceType": "개인 투자자",
        "geographicArea": {
            "@type": "Country",
            "name": "대한민국"
        }
    }
};

export const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "천하제일 단타대회",
    "alternateName": "천단",
    "description": "한국 주식시장 전문 투자정보 분석 플랫폼. 실시간 시가총액, 재무지표, 기업 분석 서비스 제공",
    "url": "https://www.chundan.xyz",
    "logo": {
        "@type": "ImageObject",
        "url": "https://www.chundan.xyz/logo_long.svg",
        "width": 200,
        "height": 50
    },
    "sameAs": [
        "https://www.chundan.xyz"
    ],
    "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "availableLanguage": "ko",
        "areaServed": "KR"
    },
    "foundingDate": "2024",
    "knowsAbout": [
        "주식 투자",
        "시가총액 분석",
        "PER 분석",
        "PBR 분석",
        "주식 배당",
        "기업 재무제표",
        "한국 증권시장"
    ]
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

// Financial Service 스키마 - 주식 정보 서비스 전문성 강조
export const financialServiceData = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "천하제일 단타대회",
    "alternateName": "천단",
    "description": "한국 주식 시장 전문 투자 정보 서비스. 실시간 시가총액, PER, PBR, BPS, EPS, 배당수익률 등 주요 재무지표 제공",
    "url": "https://www.chundan.xyz",
    "logo": {
        "@type": "ImageObject",
        "url": "https://www.chundan.xyz/icon.svg",
        "width": 64,
        "height": 64
    },
    "sameAs": [
        "https://www.chundan.xyz"
    ],
    "serviceType": "Investment Information Service",
    "areaServed": {
        "@type": "Country",
        "name": "대한민국"
    },
    "availableChannel": {
        "@type": "ServiceChannel",
        "availableLanguage": {
            "@type": "Language",
            "name": "Korean",
            "alternateName": "ko"
        },
        "serviceUrl": "https://www.chundan.xyz"
    },
    "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "주식 투자 정보 서비스",
        "itemListElement": [
            {
                "@type": "Offer",
                "itemOffered": {
                    "@type": "Service",
                    "name": "시가총액 분석",
                    "description": "실시간 기업 시가총액 순위 및 분석"
                }
            },
            {
                "@type": "Offer",
                "itemOffered": {
                    "@type": "Service",
                    "name": "재무지표 분석",
                    "description": "PER, PBR, BPS, EPS 등 주요 투자 지표"
                }
            },
            {
                "@type": "Offer",
                "itemOffered": {
                    "@type": "Service",
                    "name": "기업 정보 조회",
                    "description": "상장 기업 상세 정보 및 투자 분석"
                }
            }
        ]
    }
};

export const stockListData = (stockList: Array<{ name: string, symbol: string, marketCap?: number }>) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "주식 시가총액 랭킹 - 천하제일 단타대회",
    "description": "한국 주식시장 시가총액 순위 및 투자 정보",
    "url": "https://www.chundan.xyz/marketcaps",
    "numberOfItems": stockList.length,
    "itemListElement": stockList.map((stock, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
            "@type": "Corporation",
            "name": stock.name,
            "identifier": stock.symbol,
            "url": `https://www.chundan.xyz/security/${stock.symbol}`,
            "description": `${stock.name} 시가총액 ${stock.marketCap?.toLocaleString() || 'N/A'}원`,
            "image": `https://www.chundan.xyz/images/round/${stock.name}.png`,
            "sameAs": `https://www.chundan.xyz/company/${stock.symbol}`
        }
    }))
});

// 기업별 Corporation 스키마
export const corporationData = (security: {
    korName?: string;
    name: string;
    ticker: string;
    exchange: string;
    prices?: Array<{
        close?: number;
        rate?: number;
        volume?: number;
        date: string;
    }>;
    company?: {
        marketcap?: number;
    };
}) => {
    const companyName = security.korName || security.name;
    const latestPrice = security.prices?.[0];

    return {
        "@context": "https://schema.org",
        "@type": "Corporation",
        "name": companyName,
        "alternateName": security.name !== security.korName ? security.name : undefined,
        "tickerSymbol": security.ticker,
        "description": `${companyName}(${security.ticker})의 투자 정보 및 재무 분석`,
        "url": `https://www.chundan.xyz/company/${security.ticker}`,
        "logo": {
            "@type": "ImageObject",
            "url": `https://www.chundan.xyz/images/round/${companyName}.png`,
            "width": 64,
            "height": 64
        },
        "sameAs": [
            `https://www.chundan.xyz/security/${security.ticker}`
        ],
        "foundingLocation": {
            "@type": "Country",
            "name": "대한민국"
        },
        "marketCap": security.company?.marketcap ? {
            "@type": "MonetaryAmount",
            "value": security.company.marketcap,
            "currency": "KRW"
        } : undefined,
        "stockPrice": latestPrice?.close ? {
            "@type": "MonetaryAmount",
            "value": latestPrice.close,
            "currency": "KRW",
            "validFrom": latestPrice.date
        } : undefined,
        "priceChange": latestPrice?.rate ? {
            "@type": "MonetaryAmount",
            "value": Math.abs(latestPrice.rate),
            "currency": "KRW",
            "description": `전일 대비 ${latestPrice.rate > 0 ? '상승' : '하락'} ${Math.abs(latestPrice.rate).toFixed(2)}%`
        } : undefined
    };
};

// FAQ 스키마 - 자주 묻는 질문
export const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "시가총액이란 무엇인가요?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "시가총액은 기업의 발행 주식 수에 현재 주가를 곱한 값으로, 기업의 시장 가치를 나타내는 지표입니다."
            }
        },
        {
            "@type": "Question",
            "name": "PER(주가수익비율)이란 무엇인가요?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "PER은 주가를 주당순이익(EPS)으로 나눈 값으로, 투자금 회수 기간을 나타내는 지표입니다. 낮을수록 저평가된 것으로 볼 수 있습니다."
            }
        },
        {
            "@type": "Question",
            "name": "PBR(주가순자산비율)이란 무엇인가요?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "PBR은 주가를 주당순자산가치(BPS)로 나눈 값으로, 1미만이면 청산가치보다 낮은 가격에 거래되는 것을 의미합니다."
            }
        },
        {
            "@type": "Question",
            "name": "천하제일 단타대회는 어떤 서비스인가요?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "천하제일 단타대회는 한국 주식 시장의 실시간 투자 정보를 제공하는 전문 플랫폼입니다. 시가총액, PER, PBR 등 주요 재무지표를 통해 투자 결정을 지원합니다."
            }
        }
    ]
};
