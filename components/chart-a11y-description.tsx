/**
 * 차트 접근성 헬퍼 컴포넌트
 * 스크린 리더를 위한 차트 데이터 요약
 */

interface ChartA11yDescriptionProps {
    data: any[];
    selectedType: string;
    type: "summary" | "detailed";
}

export function ChartA11yDescription({ data, selectedType, type }: ChartA11yDescriptionProps) {
    if (!data?.length) return null;

    const latestData = data[data.length - 1];
    const earliestData = data[0];

    // 선택된 타입의 값 추출
    const getSelectedValue = (dataPoint: any) => {
        if (selectedType === "시가총액 구성") return dataPoint["총합계"] || 0;

        const key = Object.keys(dataPoint).find(k =>
            k !== "date" && k !== "value" &&
            (selectedType === "보통주" ? k.includes("보통주") :
                selectedType === "우선주" ? k.includes("우선주") : false)
        );

        return key ? dataPoint[key] : 0;
    };

    const latestValue = getSelectedValue(latestData);
    const earliestValue = getSelectedValue(earliestData);
    const changePercent = earliestValue ? ((latestValue - earliestValue) / earliestValue * 100) : 0;
    const trend = changePercent > 0 ? "상승" : changePercent < 0 ? "하락" : "변동 없음";

    const period = type === "summary" ? "최근 3개월간" : "전체 기간";

    return (
        <div className="sr-only" aria-live="polite">
            {`${selectedType} 차트 요약: ${period} ${trend} 추세를 보이고 있습니다. 
            시작값 ${earliestValue.toLocaleString()}원에서 최신값 ${latestValue.toLocaleString()}원으로 
            ${Math.abs(changePercent).toFixed(1)}% ${trend}했습니다. 
            총 ${data.length}개의 데이터 포인트가 있습니다.`}
        </div>
    );
}

export default ChartA11yDescription;
