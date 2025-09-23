/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ CM-1: CARD MARKETCAP COMPONENT - 종목 정보 카드 컴포넌트                                        ██
██                                                                                                 ██
██ 목적: 개별 종목의 주요 지표(시가총액, PER, PBR 등)를 카드 형태로 표시                             ██
██ 특징: 메트릭 기반 동적 표시, 내비게이션 지원, CD3 디자인 시스템                                    ██
██ 사용처: P5-3-3 Securities Grid, 리스트 페이지, 상세 페이지                                        ██
██                                                                                                 ██
██ 구조:                                                                                             ██
██ ├── CM-1-0: Core Logic & Props Processing                                                     ██
██ ├── CM-1-1: Metric Display Engine                                                             ██
██ ├── CM-1-2: Navigation Logic                                                                  ██
██ └── CM-1-3: Card Rendering                                                                    ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

import { formatNumber } from "@/lib/utils";
import { Security } from "@/typings";
import Rate from "@/components/rate";
import Link from "next/link";
import { cn } from "@/lib/utils";

/*
═══════════════════════════════════════════════════════════════════════════════════════════════════
  CM-1-0: CORE LOGIC & PROPS PROCESSING
  역할: 컴포넌트의 기본 설정 및 props 검증
═══════════════════════════════════════════════════════════════════════════════════════════════════
*/

function cardMarketcap({
  security,
  name,
  href,
  market = "KOSPI",
  isSelected = false,
  isCompanyPage = false,
  currentMetric = "marketcap", // Current metric context
  "data-label": dataLabel,
}: {
  security: Security;
  name?: string;
  href?: string;
  market?: string;
  isSelected?: boolean;
  isCompanyPage?: boolean;
  currentMetric?: string;
  "data-label"?: string;
}) {

  // CM-1-0A: 선택 상태 계산
  const selected = isSelected || security.name === name;

  /*
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
    CM-1-1: METRIC DISPLAY ENGINE
    역할: 현재 메트릭에 따른 표시 데이터 생성
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
  */

  // CM-1-1A: 메트릭별 표시 데이터 생성 함수
  const getMetricDisplay = () => {
    const sec = security as any; // Type assertion for additional properties

    switch (currentMetric) {
      // CM-1-1A-1: PER (주가수익비율)
      case "per":
        return {
          label: "PER",
          value: sec.per ? `${sec.per.toFixed(2)}배` : "—",
          subtitle: "주가수익비율"
        };
      // CM-1-1A-2: PBR (주가순자산비율)
      case "pbr":
        return {
          label: "PBR",
          value: sec.pbr ? `${sec.pbr.toFixed(2)}배` : "—",
          subtitle: "주가순자산비율"
        };
      // CM-1-1A-3: DIV (배당수익률)
      case "div":
        return {
          label: "배당수익률",
          value: sec.div ? `${sec.div.toFixed(2)}%` : "—",
          subtitle: "Dividend Yield"
        };
      // CM-1-1A-4: DPS (주당배당금)
      case "dps":
        return {
          label: "DPS",
          value: sec.dps ? `${sec.dps.toLocaleString()}원` : "—",
          subtitle: "주당배당금"
        };
      // CM-1-1A-5: BPS (주당순자산가치)
      case "bps":
        return {
          label: "BPS",
          value: sec.bps ? `${sec.bps.toLocaleString()}원` : "—",
          subtitle: "주당순자산가치"
        };
      // CM-1-1A-6: EPS (주당순이익)
      case "eps":
        return {
          label: "EPS",
          value: sec.eps ? `${sec.eps.toLocaleString()}원` : "—",
          subtitle: "주당순이익"
        };
      // CM-1-1A-7: MARKETCAP (기본값, 시가총액)
      default: // marketcap
        return {
          label: "시가총액",
          value: formatNumber(security.marketcap),
          subtitle: `${formatNumber(security.shares)}주`
        };
    }
  };

  // CM-1-1B: 메트릭 표시 데이터 계산
  const metricDisplay = getMetricDisplay();

  /*
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
    CM-1-2: NAVIGATION LOGIC
    역할: 메트릭과 컨텍스트에 따른 내비게이션 경로 생성
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
  */

  // CM-1-2A: 내비게이션 경로 생성 함수
  const getNavigationHref = () => {
    // CM-1-2A-1: 커스텀 href가 있는 경우
    if (href) {
      return `${href}${security.ticker || security.name}`;
    }

    // CM-1-2A-2: 보안 ID 생성
    const securityId = `${market}.${security.ticker || security.name}`;

    // CM-1-2A-3: 메트릭별 경로 분기
    if (currentMetric === "marketcap") {
      if (isCompanyPage) {
        return `/security/${securityId}/marketcap`;
      }
      return `/company/${securityId}/marketcap`;        // 회사 컨텍스트
    } else {
      return `/security/${securityId}/${currentMetric}`; // 종목 컨텍스트
    }
  };

  /*
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
    CM-1-3: CARD RENDERING
    역할: 카드의 시각적 표현 및 사용자 인터랙션 처리
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
  */

  // CM-1-3A: 카드 스타일 생성 함수 (선택 상태 기반, 레이아웃 안정성 확보)
  const getCardStyles = () => {
    if (selected) {
      // CM-1-3A-1: 선택된 상태 스타일 (탭 스타일 - 흰색 배경 + 테두리 + 그림자)
      return "bg-background text-foreground border border-border shadow-sm";
    }

    // CM-1-3A-2: 기본 상태 스타일 (회색 배경 + 투명 테두리 + 투명 그림자로 공간 유지)
    return "bg-muted/30 hover:bg-muted/50 transition-all duration-200 border border-transparent shadow-sm shadow-transparent";
  };

  /*
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
    CM-1-4: MAIN RENDER
    역할: 전체 카드 컴포넌트의 최종 렌더링
  ═══════════════════════════════════════════════════════════════════════════════════════════════════
  */

  return (
    <div
      key={security.securityId}
      data-sec-id={security.securityId}
      data-label={dataLabel || "CM-1-CARD"}
      className={cn(
        "relative rounded-xl hover:shadow-md transition-shadow duration-200",
        getCardStyles()
      )}
    >
      <Link href={getNavigationHref()} className="block p-3 h-full">{/* 패딩 2->3 적당히 복원 */}
        {/* 헤더 영역 */}
        <div className="flex items-start justify-between mb-3">
          {/* 좌측: 종목 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                {metricDisplay.label}
              </span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {security.type}
              </span>
              {/* 선택됨 배지 */}
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-200 ${isSelected
                  ? "bg-black dark:bg-white text-white dark:text-black opacity-100"
                  : "bg-transparent text-transparent opacity-0"
                  }`}
              >
                선택됨
              </span>
            </div>
            {/* 종목명 */}
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate leading-relaxed">
              {security.korName}
            </div>
          </div>

          {/* 우측: 가격 정보 */}
          {security.prices && security.prices[0] && (
            <div className="text-right flex-shrink-0 ml-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {security.prices[0].close.toLocaleString()}원
              </div>
              <div className="mt-0.5">
                <Rate rate={security.prices[0].rate ?? 0} />
              </div>
            </div>
          )}
        </div>

        {/* 메인 메트릭 영역 */}
        <div className="space-y-1.5">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {metricDisplay.value}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {metricDisplay.subtitle}
          </div>
        </div>
      </Link>
    </div>
  );
}

/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ EXPORT SECTION - 컴포넌트 내보내기                                                                ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

export default cardMarketcap;
