"use client";

import { useEffect, memo } from "react";
import { addRecentlyViewedSecurity, MetricType } from "@/lib/recent-securities";

interface RecentSecurityTrackerProps {
    secCode: string;
    securityId?: string;
    routeCode?: string | null;
    lastPath?: string;
    name: string;
    korName?: string;
    ticker: string;
    exchange: string;
    metricType: MetricType;
    metricValue?: number | string | null;
}

/**
 * 최근 본 종목을 추적하는 클라이언트 컴포넌트
 * 페이지가 로드될 때마다 최근 본 종목에 추가합니다.
 */
export function RecentSecurityTracker({
    secCode,
    securityId,
    routeCode,
    lastPath,
    name,
    korName,
    ticker,
    exchange,
    metricType,
    metricValue,
}: RecentSecurityTrackerProps) {
    useEffect(() => {
        // 종목 정보가 완전한 경우에만 추가
        if (secCode && name && ticker && exchange) {
            addRecentlyViewedSecurity({
                secCode,
                securityId,
                routeCode,
                lastPath,
                name,
                korName,
                ticker,
                exchange,
            }, metricType, metricValue);

        }
    }, [secCode, securityId, routeCode, lastPath, name, korName, ticker, exchange, metricType, metricValue]);

    // 아무것도 렌더링하지 않음
    return null;
}

export default memo(RecentSecurityTracker);
