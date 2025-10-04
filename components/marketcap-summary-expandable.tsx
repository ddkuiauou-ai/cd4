/*
 * Marketcap Summary Expandable Component - 시가총액 구성 요약 확장 컴포넌트
 * 회사의 시가총액 구성(보통주/우선주)을 요약하여 표시하는 확장 가능한 카드 컴포넌트
 */

"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatNumber, cn } from "@/lib/utils";
import type { CompanyMarketcapAggregated } from "@/lib/data/company";

/*
═══════════════════════════════════════════════════════════════════════════════════════════════════
  : CORE LOGIC & STATE MANAGEMENT
  역할: 컴포넌트의 기본 설정 및 상태 관리
═══════════════════════════════════════════════════════════════════════════════════════════════════
*/

type FilterType = "all" | "보통주" | "우선주" | "시가총액 구성";

interface MarketcapSummaryExpandableProps {
    data: CompanyMarketcapAggregated;
    filterType?: FilterType;
    isSelected?: boolean;
}

export function MarketcapSummaryExpandable({ data, filterType = "all", isSelected = false }: MarketcapSummaryExpandableProps) {

    // A: 확장 상태 관리
    const [isExpanded, setIsExpanded] = useState(false);

    /*
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
      : DATA PROCESSING ENGINE
      역할: 필터 타입에 따른 데이터 계산 및 가공
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
    */

    // A: 표시 데이터 계산 함수 (필터 기반)
    const getDisplayData = () => {
        // A-1: 기본 데이터 추출
        const allSecurities = data.securities || [];

        const parseNumeric = (value: unknown) => {
            if (value === null || value === undefined) {
                return 0;
            }

            if (typeof value === "number" && Number.isFinite(value)) {
                return value;
            }

            if (typeof value === "bigint") {
                const numeric = Number(value);
                return Number.isFinite(numeric) ? numeric : 0;
            }

            if (typeof value === "string") {
                const numeric = Number.parseFloat(value.replace(/,/g, ""));
                return Number.isFinite(numeric) ? numeric : 0;
            }

            return 0;
        };

        const aggregatedTotal = parseNumeric(data.totalMarketcap);

        // 개별 종목 합계를 기반으로 한 보정값 계산 (데이터 누락 대비)
        const computedTotal = (data.securities || []).reduce(
            (sum: number, sec: any) => sum + parseNumeric(sec?.marketcap),
            0
        );

        // 항상 전체 시가총액 (보통주 + 우선주 + 기타)
        const totalMarketcap = aggregatedTotal > 0 ? aggregatedTotal : computedTotal;

        // A-2: 종목별 데이터 분리 (다중 우선주 지원)
        const grouped = allSecurities.reduce(
            (acc: { common: any[]; preferred: any[]; others: any[] }, sec: any) => {
                const type = sec?.type ?? "";

                if (type.includes("보통주")) {
                    acc.common.push(sec);
                } else if (type.includes("우선주")) {
                    acc.preferred.push(sec);
                } else {
                    acc.others.push(sec);
                }

                return acc;
            },
            { common: [], preferred: [], others: [] }
        );

        const resolveTypeLabel = (sec: any) => {
            const type = (sec?.type ?? "").trim();

            if (!type) {
                return sec?.korName || sec?.name || "기타";
            }

            if (type.includes("보통주")) {
                return "보통주";
            }

            if (type.includes("우선주")) {
                return type;
            }

            return type;
        };

        const typeLabels = allSecurities.map(resolveTypeLabel).filter(Boolean);

        const sumMarketcap = (securities: any[]) =>
            securities.reduce((sum, sec) => sum + parseNumeric(sec?.marketcap), 0);

        // A-3: 비중 계산 (전체 대비 %)
        const commonMarketcap = sumMarketcap(grouped.common);
        const preferredMarketcap = sumMarketcap(grouped.preferred);
        const totalMarketcapSafe = totalMarketcap > 0 ? totalMarketcap : 0;

        const getRatio = (value: number) => (totalMarketcapSafe > 0 ? (value / totalMarketcapSafe) * 100 : 0);

        const commonStockRatio = getRatio(commonMarketcap);
        const preferredStockRatio = getRatio(preferredMarketcap);

        const resolveFilterRatio = () => {
            if (filterType === "보통주") {
                return commonStockRatio;
            }

            if (filterType === "우선주") {
                return preferredStockRatio;
            }

            if (filterType === "all" || filterType === "시가총액 구성") {
                if (grouped.common.length > 0) {
                    return commonStockRatio;
                }

                if (grouped.preferred.length > 0) {
                    return preferredStockRatio;
                }

                if (grouped.others.length > 0) {
                    return getRatio(sumMarketcap(grouped.others));
                }

                return 0;
            }

            const matchingExact = allSecurities.filter(sec => sec.type === filterType);
            if (matchingExact.length > 0) {
                return getRatio(sumMarketcap(matchingExact));
            }

            const matchingIncludes = allSecurities.filter(sec => sec.type?.includes(filterType));
            if (matchingIncludes.length > 0) {
                return getRatio(sumMarketcap(matchingIncludes));
            }

            if (grouped.common.length > 0) {
                return commonStockRatio;
            }

            if (grouped.preferred.length > 0) {
                return preferredStockRatio;
            }

            return 0;
        };

        const resolveFilterLabel = () => {
            if (filterType === "보통주" || filterType === "우선주") {
                return `${filterType} 비중`;
            }

            if (filterType === "all" || filterType === "시가총액 구성") {
                if (grouped.common.length > 0) {
                    return "보통주 비중";
                }

                if (grouped.preferred.length > 0) {
                    return "우선주 비중";
                }

                const otherType = grouped.others[0]?.type || typeLabels[0];
                return otherType ? `${otherType} 비중` : "비중";
            }

            return `${filterType} 비중`;
        };

        const typeSummaryLabel = typeLabels.length > 0
            ? typeLabels.join(" + ")
            : "종목 정보 없음";

        // A-4: 최종 데이터 객체 반환
        return {
            securities: allSecurities,           // 항상 전체 종목 표시
            totalMarketcap: totalMarketcapSafe,  // 항상 전체 시가총액
            totalCount: allSecurities.length,    // 전체 종목 수
            // A-4a: 필터별 포커스 비중 계산
            focusedRatio: resolveFilterRatio(),
            // A-4b: 필터별 라벨 설정
            focusedLabel: resolveFilterLabel(),
            // A-4c: 추가 비중 정보 (레이아웃 안정성용)
            commonStockRatio: commonStockRatio,
            preferredStockRatio: preferredStockRatio,
            typeSummaryLabel
        };
    };

    // B: 계산된 표시 데이터
    const displayData = getDisplayData();

    // C: 부가 정보 계산
    // 시가총액 기준일자
    const marketcapDate = displayData.securities.length > 0 && displayData.securities[0].marketcapDate
        ? new Date(displayData.securities[0].marketcapDate!).toISOString().split("T")[0]
        : "";

    // 업데이트 시간 (현재 시간 기준)
    const updatedAt = new Date();
    const updatedISOString = updatedAt.toISOString().replace(/:\d{2}\.\d{3}Z$/, "");

    // D: 스타일 생성 함수 (탭 스타일 기반, 레이아웃 안정성 확보)
    const getContainerStyles = () => {
        if (isSelected) {
            // 선택된 상태: 흰색 배경 + 실제 테두리 + 그림자
            return "bg-background text-foreground border border-border shadow-sm";
        }
        // 기본 상태: 회색 배경 + 투명 테두리 + 투명 그림자 (공간 유지) + 호버 효과
        return "bg-muted/30 hover:bg-muted/50 hover:shadow-md transition-all duration-200 border border-transparent shadow-sm shadow-transparent";
    };

    /*
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
      : MAIN RENDER
      역할: 축소/확장 상태에 따른 조건부 렌더링
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
    */

    return (
        <div className={cn("space-y-0 relative rounded-xl", getContainerStyles())}>

            {/* A: 축소 상태 렌더링 (요약 뷰) */}
            {!isExpanded && (
                <div className="p-3 relative">{/* 패딩 2->3 */}

                    {/* A-1: 헤더 영역 (제목 + 확장 버튼) */}
                    <div
                        className="relative mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"

                    >
                        {/* A-1a: 제목 그룹 */}
                        <div
                            className="flex flex-wrap items-center gap-x-2 gap-y-1"

                        >
                            <h3 className="text-sm font-semibold relative">
                                시가총액 구성
                            </h3>
                            <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                {displayData.typeSummaryLabel}
                            </span>
                            {/* A-1a-selected: 선택됨 표시 (투명도로 공간 유지) */}
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-200 ${isSelected
                                    ? "bg-black dark:bg-white text-white dark:text-black opacity-100"
                                    : "bg-transparent text-transparent opacity-0"
                                    }`}

                            >
                                선택됨
                            </span>
                        </div>
                        {/* A-1b: 확장 버튼 */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="relative self-end text-xs text-muted-foreground hover:text-foreground sm:self-auto"

                        >
                            자세히 보기
                            <ChevronDownIcon className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    {/* A-2: 요약 정보 그리드 (3열 레이아웃) */}
                    <div className="relative grid grid-cols-2 gap-3 text-left sm:grid-cols-3 sm:text-center">

                        {/* A-2a: 총 종목 수 박스 */}
                        <div className="relative hidden text-center sm:block">
                            {/* A-2a-value: 종목 수 값 - 회색 계열 */}
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight">
                                {displayData.totalCount}개
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                총 종목 수
                            </div>
                        </div>

                        {/* A-2b: 전체 시가총액 박스 */}
                        <div
                            className="relative flex flex-col items-start justify-start text-left sm:items-center sm:text-center"

                        >
                            {/* A-2b-value: 시가총액 값 - 회색 계열 */}
                            <div className="text-lg font-bold leading-tight text-gray-800 dark:text-gray-200">
                                {formatNumber(displayData.totalMarketcap)}원
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                전체 시가총액
                            </div>
                        </div>

                        {/* A-2c: 포커스 비중 박스 (필터별) */}
                        <div
                            className="relative flex flex-col items-start justify-start text-left sm:items-center sm:text-center"

                        >
                            {/* A-2c-value: 비중 값 - 회색 계열 */}
                            <div className="text-lg font-bold leading-tight text-gray-800 dark:text-gray-200">
                                {displayData.focusedRatio.toFixed(1)}%
                            </div>
                            <div
                                className="mt-1 text-xs text-muted-foreground"

                            >
                                {displayData.focusedLabel}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* B: 확장 상태 렌더링 (상세 뷰) */}
            {isExpanded && (
                <div className="overflow-hidden relative">

                    {/* B-1: 헤더 (제목 + 기준일자 + 축소 버튼) */}
                    <div
                        className="relative flex flex-col gap-2 px-3 pt-3 pb-2 sm:flex-row sm:items-start sm:justify-between"

                    >
                        {/* B-1a: 좌측 제목 그룹 */}
                        <div className="grid gap-0.5">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold leading-none tracking-tight">
                                    시가총액 구성
                                </h3>
                                <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                    {displayData.typeSummaryLabel}
                                </span>
                                {/* B-1a-selected: 선택됨 표시 (전체 보기일 때) */}
                                {filterType === "all" && (
                                    <span
                                        className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-full font-medium"

                                    >
                                        선택됨
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">{`기준일자: ${marketcapDate}`}</p>
                        </div>
                        {/* B-1b: 우측 축소 버튼 */}
                        <div className="flex items-center gap-1 self-end sm:ml-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="relative self-end text-xs text-muted-foreground hover:text-foreground sm:self-auto"

                            >
                                간단히 보기
                                <ChevronUpIcon className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* B-2: 본문 (상세 목록) */}
                    <div className="p-3 text-sm relative">
                        <div className="grid gap-3">

                            {/* B-2a: 증권 섹션 제목 */}
                            <div className="font-semibold">증권</div>

                            {/* B-2b: 종목별 상세 목록 */}
                            <ul className="grid gap-3 relative">
                                {displayData.securities
                                    // B-2b-i: 유효한 시가총액만 필터링
                                    .filter((sec: any) => (sec.marketcap || 0) > 0)
                                    // B-2b-ii: 시가총액 내림차순 정렬
                                    .sort((a: any, b: any) => (b.marketcap || 0) - (a.marketcap || 0))
                                    // B-2b-iii: 각 종목 렌더링
                                    .map((sec: any, index: number) => (
                                        <li
                                            key={sec.securityId}
                                            className="flex items-center justify-between relative"

                                        >
                                            {/* B-2b-iii-α: 종목 타입 */}
                                            <span className="text-muted-foreground">
                                                {sec.type}
                                            </span>
                                            {/* B-2b-iii-β: 시가총액 + 비중 */}
                                            <span>
                                                {(sec.marketcap || 0).toLocaleString()}원
                                                <span>
                                                    {" "}
                                                    ({sec.percentage.toFixed(1)}%)
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                            </ul>

                            {/* B-2c: 구분선 */}
                            <Separator className="my-2" />

                            {/* B-2d: 합계 정보 */}
                            <ul className="grid gap-3 relative">
                                <li className="flex items-center justify-between font-semibold">
                                    <span className="text-muted-foreground">합계</span>
                                    <span>
                                        {displayData.totalMarketcap.toLocaleString()}원<span> (100%)</span>
                                    </span>
                                </li>
                            </ul>

                        </div>
                    </div>

                    {/* B-3: 푸터 (업데이트 시간) */}
                    <div className="flex flex-row items-center border-t px-3 py-2 relative">
                        <div className="text-xs text-muted-foreground">
                            업데이트: <time dateTime={updatedISOString}>{updatedISOString}</time>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

/* Export */
