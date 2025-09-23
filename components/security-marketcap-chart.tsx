"use client";

import ChartA11yDescription from "./chart-a11y-description";
import ChartCompanyMarketcap from "./chart-company-marketcap";
import ChartMarketcap from "./chart-marketcap";

type DataPoint = {
  date: string;
  [key: string]: string | number | null | undefined;
};

interface SecurityMarketcapChartProps {
  data: DataPoint[];
  type: "summary" | "detailed";
  selectedType?: string;
}

export default function SecurityMarketcapChart({
  data,
  type,
  selectedType = "시가총액 구성",
}: SecurityMarketcapChartProps) {
  const safeData = Array.isArray(data) ? data : [];

  return (
    <div className="transition-all duration-300 ease-in-out w-full flex-1">
      <ChartA11yDescription
        data={safeData}
        selectedType={selectedType}
        type={type}
      />
      {type === "summary" ? (
        <ChartCompanyMarketcap
          data={safeData}
          format="formatNumber"
          formatTooltip="formatNumberTooltip"
          selectedType={selectedType}
        />
      ) : (
        <ChartMarketcap
          data={safeData}
          format="formatNumber"
          formatTooltip="formatNumberTooltip"
          selectedType={selectedType}
        />
      )}
    </div>
  );
}
