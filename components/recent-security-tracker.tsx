"use client";

import { useEffect, memo } from "react";
import { addRecentlyViewedSecurity, MetricType } from "@/lib/recent-securities";

interface RecentSecurityTrackerProps {
    secCode: string;
    name: string;
    korName?: string;
    ticker: string;
    exchange: string;
    metricType: MetricType;
    metricValue?: number | null;
}

/**
 * 최근 본 종목을 추적하는 클라이언트 컴포넌트
 * 페이지가 로드될 때마다 최근 본 종목에 추가합니다.
 */
export function RecentSecurityTracker({
    secCode,
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
                name,
                korName,
                ticker,
                exchange,
            }, metricType, metricValue);

        }
    }, [secCode, name, korName, ticker, exchange, metricType, metricValue]);

    // 아무것도 렌더링하지 않음
    return null;
}

export default memo(RecentSecurityTracker);
