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

            // UI 업데이트를 위한 storage 이벤트 트리거
            // 다음 틱에서 실행하여 동기적 업데이트 방지
            Promise.resolve().then(() => {
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'recently-viewed-securities',
                    newValue: localStorage.getItem('recently-viewed-securities'),
                }));
            });
        }
    }, [secCode]); // secCode만 변경될 때 실행

    // 아무것도 렌더링하지 않음
    return null;
}

export default memo(RecentSecurityTracker);
