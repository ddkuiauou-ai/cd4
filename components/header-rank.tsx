import { formatNumber } from "@/lib/utils";

export default function RankHeader({ rank, marketcap, price, exchange, isCompanyLevel = false,
    rankLabel, marketcapLabel, marketcapUnit = '원' }: {
    rank?: number | null; marketcap?: number; price?: number; exchange?: string;
    isCompanyLevel?: boolean; name?: string; rankLabel?: string; marketcapLabel?: string; marketcapUnit?: string;
}) {
    const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const metricValue = valid(marketcap) ? (['배', '%'].includes(marketcapUnit)
        ? `${marketcap.toFixed(2)}${marketcapUnit}` : `${formatNumber(marketcap)}${marketcapUnit}`) : '—';
    const rows = [
        [rankLabel || (isCompanyLevel ? '기업 시가총액 순위' : '종목 시가총액 순위'), valid(rank) && rank > 0 ? `${rank}위` : '—'],
        [marketcapLabel || (isCompanyLevel ? '기업 총 시가총액' : '시가총액'), metricValue],
        [isCompanyLevel ? '대표 종목 주가' : '현재 주가', valid(price) ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['거래소', exchange || '—'],
    ];
    return <dl className="detail-summary-grid grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        {rows.map(([label, value]) => <div key={label} className="min-w-0">
            <dt className="mb-1.5 text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
        </div>)}
    </dl>;
}
