import { formatNumber } from "@/lib/utils";
import { formatBusinessValue } from "@/lib/business-analysis";

type SummaryRow = { label: string; value: string; date?: string; role: 'metric' | 'rank' | 'price' | 'change'; direction?: string };

export default function RankHeader({ rank, marketcap, price, isCompanyLevel = false, basic = false, priceRate,
    rankLabel, marketcapLabel, marketcapUnit = '원', marketcapDate, marketcapDateLabel = '지표 기준', priceDate, priceLabel }: {
    rank?: number | null; marketcap?: number | string; price?: number | string | null; exchange?: string;
    isCompanyLevel?: boolean; basic?: boolean; priceRate?: number | null; name?: string; rankLabel?: string; marketcapLabel?: string; marketcapUnit?: string;
    marketcapDate?: Date | string | null; marketcapDateLabel?: string; priceDate?: Date | string | null;
    priceLabel?: string;
}) {
    const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const metricValue = typeof marketcap === 'string' ? `${formatNumber(marketcap)}${marketcapUnit}` : valid(marketcap) ? (['배', '%'].includes(marketcapUnit)
        ? `${marketcap.toFixed(2)}${marketcapUnit}` : `${formatNumber(marketcap)}${marketcapUnit}`) : '—';
    const dateLabel = (date: Date | string | null | undefined) => date && !Number.isNaN(new Date(date).getTime())
        ? new Date(date).toISOString().slice(0, 10) : '—';
    const metricRow: SummaryRow = { role: 'metric', label: marketcapLabel || (isCompanyLevel ? '기업 합산 시가총액' : '시가총액'), value: metricValue,
        date: marketcapDate !== undefined ? `${marketcapDateLabel} ${dateLabel(marketcapDate)}` : undefined };
    const priceRow: SummaryRow = { role: 'price', label: priceLabel || (isCompanyLevel ? '대표 보통주 주가' : '현재 주가'),
        value: price != null ? `${formatBusinessValue(price)}원` : '—', date: priceDate !== undefined ? `거래 기준 ${dateLabel(priceDate)}` : undefined };
    const rate = price != null && valid(priceRate) ? priceRate : null;
    const rows: SummaryRow[] = [
        basic && !isCompanyLevel ? priceRow : metricRow,
        { role: 'rank', label: rankLabel || (isCompanyLevel ? '기업 시가총액 순위' : '종목 시가총액 순위'), value: valid(rank) && rank > 0 ? `${rank.toLocaleString('ko-KR')}위` : '—' },
        basic && !isCompanyLevel ? metricRow : priceRow,
        { role: 'change', label: isCompanyLevel ? '대표 보통주 전일 대비' : '전일 대비', value: rate == null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`, direction: rate == null || rate === 0 ? 'flat' : rate > 0 ? 'up' : 'down' },
    ];

    return <dl className="detail-summary-grid">
        {rows.map(({ label, value, date, role, direction }, index) => <div key={label} className="detail-summary-item" data-role={role} data-primary={index === 0 || undefined} data-direction={direction}>
            <dt>{label}</dt>
            <dd className="detail-summary-value">{value}</dd>
            {date && <dd className="detail-summary-date">{date}</dd>}
        </div>)}
    </dl>;
}
