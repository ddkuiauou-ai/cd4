/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ MSE-1: MARKETCAP SUMMARY EXPANDABLE - 시가총액 구성 요약 확장 컴포넌트                         ██
██                                                                                                 ██
██ 목적: 회사의 시가총액 구성(보통주/우선주)을 요약하여 표시하는 확장 가능한 카드 컴포넌트           ██
██ 특징: 필터 기반 동적 표시, 확장/축소 기능, CD3 디자인 시스템                                     ██
██ 사용처: Summary Section의 핵심 컴포넌트                                                       ██
██                                                                                                 ██
██ 구조:                                                                                             ██
██ ├── MSE-1-0: Core Logic & State Management                                                    ██
██ ├── MSE-1-1: Data Processing Engine                                                           ██
██ ├── MSE-1-2: Summary Card Rendering                                                           ██
██ └── MSE-1-3: Detailed View (Expandable)                                                      ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
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
  MSE-1-0: CORE LOGIC & STATE MANAGEMENT
  역할: 컴포넌트의 기본 설정 및 상태 관리
═══════════════════════════════════════════════════════════════════════════════════════════════════
*/

type FilterType = "all" | "보통주" | "우선주" | "시가총액 구성";

interface MarketcapSummaryExpandableProps {
    data: CompanyMarketcapAggregated;
    filterType?: FilterType;
    isSelected?: boolean;
    "data-label"?: string;
}

export function MarketcapSummaryExpandable({ data, filterType = "all", isSelected = false, "data-label": dataLabel }: MarketcapSummaryExpandableProps) {

    // MSE-1-0A: 확장 상태 관리
    const [isExpanded, setIsExpanded] = useState(false);

    /*
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
      MSE-1-1: DATA PROCESSING ENGINE
      역할: 필터 타입에 따른 데이터 계산 및 가공
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
    */

    // MSE-1-1A: 표시 데이터 계산 함수 (필터 기반)
    const getDisplayData = () => {
        // MSE-1-1A-1: 기본 데이터 추출
        const allSecurities = data.securities;
        const totalMarketcap = data.totalMarketcap; // 항상 전체 시가총액 (보통주 + 우선주)

        // MSE-1-1A-2: 종목별 데이터 분리
        const commonStock = allSecurities.find(sec => sec.type?.includes("보통주"));
        const preferredStock = allSecurities.find(sec => sec.type?.includes("우선주"));

        // MSE-1-1A-3: 비중 계산 (전체 대비 %)
        const commonStockRatio = commonStock ? (commonStock.marketcap || 0) / totalMarketcap * 100 : 0;
        const preferredStockRatio = preferredStock ? (preferredStock.marketcap || 0) / totalMarketcap * 100 : 0;

        // MSE-1-1A-4: 최종 데이터 객체 반환
        return {
            securities: allSecurities,           // 항상 전체 종목 표시
            totalMarketcap: totalMarketcap,     // 항상 전체 시가총액
            totalCount: allSecurities.length,   // 항상 전체 종목 수 (2개)
            // MSE-1-1A-4a: 필터별 포커스 비중 계산
            focusedRatio: filterType === "보통주" ? commonStockRatio :
                filterType === "우선주" ? preferredStockRatio :
                    commonStockRatio, // 시가총액 구성이나 기타는 보통주 비중
            // MSE-1-1A-4b: 필터별 라벨 설정
            focusedLabel: filterType === "보통주" ? "보통주 비중" :
                filterType === "우선주" ? "우선주 비중" :
                    "보통주 비중", // 시가총액 구성이나 기타는 보통주 비중
            // MSE-1-1A-4c: 추가 비중 정보 (레이아웃 안정성용)
            commonStockRatio: commonStockRatio,
            preferredStockRatio: preferredStockRatio
        };
    };

    // MSE-1-1B: 계산된 표시 데이터
    const displayData = getDisplayData();

    // MSE-1-1C: 부가 정보 계산
    // 시가총액 기준일자
    const marketcapDate = displayData.securities.length > 0 && displayData.securities[0].marketcapDate
        ? new Date(displayData.securities[0].marketcapDate!).toISOString().split("T")[0]
        : "";

    // 업데이트 시간 (현재 시간 기준)
    const updatedAt = new Date();
    const updatedISOString = updatedAt.toISOString().replace(/:\d{2}\.\d{3}Z$/, "");

    // MSE-1-1D: 스타일 생성 함수 (탭 스타일 기반, 레이아웃 안정성 확보)
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
      MSE-1-2: MAIN RENDER
      역할: 축소/확장 상태에 따른 조건부 렌더링
    ═══════════════════════════════════════════════════════════════════════════════════════════════════
    */

    return (
        <div className={cn("space-y-0 relative rounded-xl", getContainerStyles())} data-label={dataLabel || "MSE-1-2-root"}>

            {/* MSE-1-2A: 축소 상태 렌더링 (요약 뷰) */}
            {!isExpanded && (
                <div className="p-3 relative" data-label="MSE-1-2A-container">{/* 패딩 2->3 */}

                    {/* MSE-1-2A-1: 헤더 영역 (제목 + 확장 버튼) */}
                    <div className="flex items-center justify-between mb-3 relative" data-label="MSE-1-2A-1">
                        {/* MSE-1-2A-1a: 제목 그룹 */}
                        <div className="flex items-center gap-2" data-label="MSE-1-2A-1a">
                            <h3 className="text-sm font-semibold relative" data-label="MSE-1-2A-1a-title">
                                시가총액 구성
                            </h3>
                            <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded" data-label="MSE-1-2A-1a-subtitle">
                                보통주 + 우선주
                            </span>
                            {/* MSE-1-2A-1a-selected: 선택됨 표시 (투명도로 공간 유지) */}
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-200 ${isSelected
                                    ? "bg-black dark:bg-white text-white dark:text-black opacity-100"
                                    : "bg-transparent text-transparent opacity-0"
                                    }`}
                                data-label="MSE-1-2A-1a-selected"
                            >
                                선택됨
                            </span>
                        </div>
                        {/* MSE-1-2A-1b: 확장 버튼 */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-xs text-muted-foreground hover:text-foreground relative"
                            data-label="MSE-1-2A-1b"
                        >
                            자세히 보기
                            <ChevronDownIcon className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    {/* MSE-1-2A-2: 요약 정보 그리드 (3열 레이아웃) */}
                    <div className="grid gap-3 md:grid-cols-3 relative" data-label="MSE-1-2A-2">

                        {/* MSE-1-2A-2a: 총 종목 수 박스 */}
                        <div className="text-center relative" data-label="MSE-1-2A-2a">
                            {/* MSE-1-2A-2a-value: 종목 수 값 - 회색 계열 */}
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight" data-label="MSE-1-2A-2a-value">
                                {displayData.totalCount}개
                            </div>
                            {/* MSE-1-2A-2a-label: 종목 수 라벨 */}
                            <div className="text-xs text-muted-foreground mt-1" data-label="MSE-1-2A-2a-label">
                                총 종목 수
                            </div>
                        </div>

                        {/* MSE-1-2A-2b: 전체 시가총액 박스 */}
                        <div className="text-center relative" data-label="MSE-1-2A-2b">
                            {/* MSE-1-2A-2b-value: 시가총액 값 - 회색 계열 */}
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight" data-label="MSE-1-2A-2b-value">
                                {formatNumber(displayData.totalMarketcap)}원
                            </div>
                            {/* MSE-1-2A-2b-label: 시가총액 라벨 */}
                            <div className="text-xs text-muted-foreground mt-1" data-label="MSE-1-2A-2b-label">
                                전체 시가총액
                            </div>
                        </div>

                        {/* MSE-1-2A-2c: 포커스 비중 박스 (필터별) */}
                        <div className="text-center relative" data-label="MSE-1-2A-2c">
                            {/* MSE-1-2A-2c-value: 비중 값 - 회색 계열 */}
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight" data-label="MSE-1-2A-2c-value">
                                {displayData.focusedRatio.toFixed(1)}%
                            </div>
                            {/* MSE-1-2A-2c-label: 비중 라벨 (고정 너비로 레이아웃 안정성 확보) */}
                            <div className="text-xs text-muted-foreground w-20 mx-auto mt-1" data-label="MSE-1-2A-2c-label">
                                {displayData.focusedLabel}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* MSE-1-2B: 확장 상태 렌더링 (상세 뷰) */}
            {isExpanded && (
                <div className="overflow-hidden relative" data-label="MSE-1-2B-container">

                    {/* MSE-1-2B-1: 헤더 (제목 + 기준일자 + 축소 버튼) */}
                    <div className="flex flex-row items-start px-3 pt-3 pb-2 relative" data-label="MSE-1-2B-1">
                        {/* MSE-1-2B-1a: 좌측 제목 그룹 */}
                        <div className="grid gap-0.5" data-label="MSE-1-2B-1a">
                            <div className="flex items-center gap-2" data-label="MSE-1-2B-1a-title-group">
                                <h3 className="text-sm font-semibold leading-none tracking-tight" data-label="MSE-1-2B-1a-title">
                                    시가총액 구성
                                </h3>
                                <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded" data-label="MSE-1-2B-1a-subtitle">
                                    보통주 + 우선주
                                </span>
                                {/* MSE-1-2B-1a-selected: 선택됨 표시 (전체 보기일 때) */}
                                {filterType === "all" && (
                                    <span
                                        className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-full font-medium"
                                        data-label="MSE-1-2B-1a-selected"
                                    >
                                        선택됨
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground" data-label="MSE-1-2B-1a-desc">{`기준일자: ${marketcapDate}`}</p>
                        </div>
                        {/* MSE-1-2B-1b: 우측 축소 버튼 */}
                        <div className="ml-auto flex items-center gap-1" data-label="MSE-1-2B-1b">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                                data-label="MSE-1-2B-1b-btn"
                            >
                                간단히 보기
                                <ChevronUpIcon className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* MSE-1-2B-2: 본문 (상세 목록) */}
                    <div className="p-3 text-sm relative" data-label="MSE-1-2B-2">
                        <div className="grid gap-3" data-label="MSE-1-2B-2-grid">

                            {/* MSE-1-2B-2a: 증권 섹션 제목 */}
                            <div className="font-semibold" data-label="MSE-1-2B-2a">증권</div>

                            {/* MSE-1-2B-2b: 종목별 상세 목록 */}
                            <ul className="grid gap-3 relative" data-label="MSE-1-2B-2b">
                                {displayData.securities
                                    // MSE-1-2B-2b-i: 유효한 시가총액만 필터링
                                    .filter((sec: any) => (sec.marketcap || 0) > 0)
                                    // MSE-1-2B-2b-ii: 시가총액 내림차순 정렬
                                    .sort((a: any, b: any) => (b.marketcap || 0) - (a.marketcap || 0))
                                    // MSE-1-2B-2b-iii: 각 종목 렌더링
                                    .map((sec: any, index: number) => (
                                        <li
                                            key={sec.securityId}
                                            className="flex items-center justify-between relative"
                                            data-label={`MSE-1-2B-2b-item-${index}`}
                                        >
                                            {/* MSE-1-2B-2b-iii-α: 종목 타입 */}
                                            <span className="text-muted-foreground" data-label={`MSE-1-2B-2b-item-${index}-type`}>
                                                {sec.type}
                                            </span>
                                            {/* MSE-1-2B-2b-iii-β: 시가총액 + 비중 */}
                                            <span data-label={`MSE-1-2B-2b-item-${index}-value`}>
                                                {(sec.marketcap || 0).toLocaleString()}원
                                                <span data-label={`MSE-1-2B-2b-item-${index}-percent`}>
                                                    {" "}
                                                    ({sec.percentage.toFixed(1)}%)
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                            </ul>

                            {/* MSE-1-2B-2c: 구분선 */}
                            <Separator className="my-2" data-label="MSE-1-2B-2c" />

                            {/* MSE-1-2B-2d: 합계 정보 */}
                            <ul className="grid gap-3 relative" data-label="MSE-1-2B-2d">
                                <li className="flex items-center justify-between font-semibold" data-label="MSE-1-2B-2d-total">
                                    <span className="text-muted-foreground" data-label="MSE-1-2B-2d-total-label">합계</span>
                                    <span data-label="MSE-1-2B-2d-total-value">
                                        {displayData.totalMarketcap.toLocaleString()}원<span data-label="MSE-1-2B-2d-total-percent"> (100%)</span>
                                    </span>
                                </li>
                            </ul>

                        </div>
                    </div>

                    {/* MSE-1-2B-3: 푸터 (업데이트 시간) */}
                    <div className="flex flex-row items-center border-t px-3 py-2 relative" data-label="MSE-1-2B-3">
                        <div className="text-xs text-muted-foreground" data-label="MSE-1-2B-3-time">
                            업데이트: <time dateTime={updatedISOString}>{updatedISOString}</time>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ EXPORT SECTION - 컴포넌트 내보내기                                                                ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/
