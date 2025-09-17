import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

/**
 * 메트릭별 SEO 메타데이터 생성 유틸리티
 */
export function generateMetricMetadata(
    metric: string,
    type: "ranking" | "company" | "security" = "ranking",
    companyName?: string,
    secCode?: string
): Metadata {
    const metricData = {
        marketcap: {
            title: "시가총액",
            description: "실시간 시가총액 순위 및 분석",
            keywords: ["시가총액", "market cap", "기업가치", "상장기업"]
        },
        per: {
            title: "주가수익비율 PER",
            description: "주가수익비율(PER) 순위 및 가치투자 분석",
            keywords: ["PER", "주가수익비율", "가치투자", "저PER"]
        },
        div: {
            title: "배당수익률",
            description: "배당수익률 순위 및 배당주 투자 분석",
            keywords: ["배당", "배당수익률", "dividend yield", "배당주"]
        },
        dps: {
            title: "주당배당금 DPS",
            description: "주당배당금(DPS) 순위 및 배당성장 분석",
            keywords: ["DPS", "주당배당금", "배당성장", "dividend"]
        },
        bps: {
            title: "주당순자산가치 BPS",
            description: "주당순자산가치(BPS) 순위 및 자산가치 분석",
            keywords: ["BPS", "주당순자산가치", "book value", "자산가치"]
        },
        pbr: {
            title: "주가순자산비율 PBR",
            description: "주가순자산비율(PBR) 순위 및 저평가 종목 분석",
            keywords: ["PBR", "주가순자산비율", "저평가", "가치투자"]
        },
        eps: {
            title: "주당순이익 EPS",
            description: "주당순이익(EPS) 순위 및 수익성 분석",
            keywords: ["EPS", "주당순이익", "earnings", "수익성"]
        }
    };

    const data = metricData[metric as keyof typeof metricData];
    if (!data) {
        return {
            title: "주식 분석",
            description: "종합 주식 정보 및 분석 서비스"
        };
    }

    let title = data.title;
    let description = data.description;

    if (type === "company" && companyName) {
        title = `${companyName} ${data.title} 분석`;
        description = `${companyName}의 ${data.description}`;
    } else if (type === "security" && companyName) {
        title = `${companyName} ${data.title} 정보`;
        description = `${companyName} 종목의 ${data.description}`;
    } else if (type === "ranking") {
        title = `${data.title} 랭킹`;
        description = `${data.description} - 실시간 순위`;
    }

    return {
        title,
        description,
        keywords: [
            ...data.keywords,
            "주식",
            "투자",
            "한국주식",
            "KOSPI",
            "KOSDAQ",
            "주식분석",
            "종목분석"
        ],
        openGraph: {
            title,
            description,
            type: "website",
            locale: "ko_KR",
            url: siteConfig.url,
            siteName: siteConfig.name,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
        alternates: {
            canonical: type === "company" && secCode
                ? `/company/${secCode}/${metric}`
                : type === "security" && secCode
                    ? `/security/${secCode}/${metric}`
                    : `/${metric}`
        }
    };
}

/**
 * 회사별 동적 메타데이터 생성
 */
export function generateCompanyMetadata(
    companyName: string,
    secCode: string,
    metric?: string
): Metadata {
    if (metric) {
        return generateMetricMetadata(metric, "company", companyName, secCode);
    }

    return {
        title: `${companyName} 기업정보`,
        description: `${companyName}의 종합 기업정보, 재무분석, 투자지표 및 시장 데이터`,
        keywords: [
            companyName,
            "기업정보",
            "재무분석",
            "투자지표",
            "주식정보",
            secCode.split('.')[1], // 종목코드
            "한국주식"
        ],
        openGraph: {
            title: `${companyName} 기업정보`,
            description: `${companyName}의 종합 기업정보 및 투자 분석`,
            type: "website",
            locale: "ko_KR",
            url: `${siteConfig.url}/company/${secCode}`,
            siteName: siteConfig.name,
        },
        alternates: {
            canonical: `/company/${secCode}`
        }
    };
}

/**
 * 종목별 동적 메타데이터 생성
 */
export function generateSecurityMetadata(
    companyName: string,
    secCode: string,
    metric?: string
): Metadata {
    if (metric) {
        return generateMetricMetadata(metric, "security", companyName, secCode);
    }

    return {
        title: `${companyName} 종목정보`,
        description: `${companyName} 주식의 실시간 시세, 차트, 재무정보 및 투자분석`,
        keywords: [
            companyName,
            "종목정보",
            "주가",
            "차트",
            "실시간시세",
            secCode.split('.')[1], // 종목코드
            "주식투자"
        ],
        openGraph: {
            title: `${companyName} 종목정보`,
            description: `${companyName} 주식의 실시간 정보 및 투자 분석`,
            type: "website",
            locale: "ko_KR",
            url: `${siteConfig.url}/security/${secCode}`,
            siteName: siteConfig.name,
        },
        alternates: {
            canonical: `/security/${secCode}`
        }
    };
}
