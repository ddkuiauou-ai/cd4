import { formatNumber } from "@/lib/utils";
import { formatBusinessValue } from "@/lib/business-analysis";

export default function RankHeader({ rank, marketcap, price, exchange, isCompanyLevel = false,
    rankLabel, marketcapLabel, marketcapUnit = '원', marketcapDate, marketcapDateLabel = '지표 기준', priceDate, priceLabel }: {
    rank?: number | null; marketcap?: number | string; price?: number | string | null; exchange?: string;
    isCompanyLevel?: boolean; name?: string; rankLabel?: string; marketcapLabel?: string; marketcapUnit?: string;
    marketcapDate?: Date | string | null; marketcapDateLabel?: string; priceDate?: Date | string | null;
    priceLabel?: string;
}) {
    const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const metricValue = typeof marketcap === 'string' ? `${formatNumber(marketcap)}${marketcapUnit}` : valid(marketcap) ? (['배', '%'].includes(marketcapUnit)
        ? `${marketcap.toFixed(2)}${marketcapUnit}` : `${formatNumber(marketcap)}${marketcapUnit}`) : '—';
    const dateLabel = (date: Date | string | null | undefined) => date && !Number.isNaN(new Date(date).getTime())
        ? new Date(date).toISOString().slice(0, 10) : '—';
    const rows = [
        [rankLabel || (isCompanyLevel ? '기업 시가총액 순위' : '종목 시가총액 순위'), valid(rank) && rank > 0 ? `${rank}위` : '—'],
        [marketcapLabel || (isCompanyLevel ? '기업 총 시가총액' : '시가총액'), metricValue, marketcapDate !== undefined ? `${marketcapDateLabel} ${dateLabel(marketcapDate)}` : undefined],
        [priceLabel || (isCompanyLevel ? '대표 종목 주가' : '현재 주가'), price != null ? `${formatBusinessValue(price)}원` : '—', priceDate !== undefined ? `거래 기준 ${dateLabel(priceDate)}` : undefined],
        ['거래소', exchange || '—'],
    ];
    return <dl className="detail-summary-grid grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        {rows.map(([label, value, date]) => <div key={label} className="min-w-0">
            <dt className="mb-1.5 text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
            {date && <dd className="mt-1 text-xs text-muted-foreground tabular-nums">{date}</dd>}
        </div>)}
    </dl>;
}
