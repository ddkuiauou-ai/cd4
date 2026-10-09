import { formatBusinessValue, type BusinessValue } from '@/lib/business-analysis';
import Rate from './rate';

type DetailPriceRecord = { close: BusinessValue; rate?: BusinessValue; date?: Date | string | null };

export function DetailCurrentPrice({ price }: { price?: DetailPriceRecord }) {
    const close = price?.close;
    const hasPrice = close != null && formatBusinessValue(close) !== '—';
    const rate = hasPrice && price?.rate != null && Number.isFinite(Number(price.rate)) ? Number(price.rate) : null;
    const date = hasPrice && price?.date != null ? new Date(price.date) : null;
    const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;

    return <>
        <div className="flex items-baseline font-semibold text-foreground mb-1 leading-none">
            <span className="text-lg sm:text-xl">{hasPrice ? formatBusinessValue(close) : '—'}</span>
            {hasPrice && <span className="text-xs ml-1">원</span>}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-xs leading-tight mb-1">
            <span className="text-muted-foreground">전일 대비</span>
            {rate != null ? <Rate rate={rate} size="sm" showIcon={false} />
                : <span className="text-muted-foreground">—</span>}
        </div>
        <div className="text-xs text-muted-foreground leading-tight px-1">현재 주가</div>
        {hasPrice && <div className="text-xs text-muted-foreground leading-tight px-1">
            {dateLabel ? `주가 기준 ${dateLabel}` : '주가 기준일 미등록'}
        </div>}
    </>;
}
