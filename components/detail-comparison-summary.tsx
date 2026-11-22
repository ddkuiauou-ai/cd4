import { formatBusinessValue, formatCompactBusinessValue, subtractBusinessValues } from '@/lib/business-analysis';
import { prepareDetailComparison } from '@/lib/detail-comparison';
import type { DetailCompanyView, DetailSecurityRow } from './detail-types';
import styles from './detail-investor-summary.module.css';

type PriceComparison = ReturnType<typeof prepareDetailComparison>['priceComparisons'][number];
type PriceGapValues = Pick<PriceComparison, 'direction' | 'difference' | 'percent' | 'commonPrice' | 'price'>;

export function DetailComparisonSummary({ company, members, selectedSecurityId }: {
  company: DetailCompanyView | null; members: DetailSecurityRow[]; selectedSecurityId?: string;
}) {
  if (!company || !members.length) return null;
  const { composition, priceComparisons } = prepareDetailComparison(company, members);
  return <div className="detail-comparison-summary">
    <div className="detail-composition-heading"><h3>합산 구성 비중</h3>
      <p className="detail-composition-basis">{composition.date || '기준일 미등록'} · 기업 합산 {company.state === 'published' && composition.total != null ? `${formatCompactBusinessValue(composition.total)}원` : '—'} 기준</p>
    </div>
    <dl className="detail-composition-list">{composition.rows.map(row => <div className="detail-composition-row" key={row.securityId} data-selected={selectedSecurityId === row.securityId || undefined}>
      <dt>{row.name}</dt><dd>{row.percentage == null ? '—' : `${formatBusinessValue(row.percentage)}%`}</dd>
    </div>)}</dl>
    {composition.reason && <p className="detail-comparison-note">{composition.reason}</p>}
    <DetailPriceGap priceComparisons={priceComparisons} />
  </div>;
}

function priceGapText(row: PriceGapValues) {
  if (row.direction === 'same') return '같은 가격 · 0원 (0%)';
  if (!row.direction) return '—';
  return `${formatBusinessValue(row.difference)}원 (${formatBusinessValue(row.percent)}%) ${row.direction === 'lower' ? '낮음' : '높음'}`;
}

function PriceGapPeriod({ label, date, gap, reason }: {
  label: string; date: string | null; gap: PriceGapValues | null; reason: string;
}) {
  return <div className={styles.priceGapPeriod}>
    <h4>{label}{date && <time dateTime={date}>{date}</time>}</h4>
    {gap ? <>
      <dl>
        <div><dt>보통주 종가</dt><dd>{formatBusinessValue(gap.commonPrice)}원</dd></div>
        <div><dt>우선주 종가</dt><dd>{formatBusinessValue(gap.price)}원</dd></div>
      </dl>
      <strong>{priceGapText(gap)}</strong>
    </> : <p className="detail-comparison-note">{reason}</p>}
  </div>;
}

function PriceGapYearComparison({ row, showPair }: { row: PriceComparison; showPair: boolean }) {
  const previous = row.previous;
  const change = previous ? subtractBusinessValues(row.difference, previous.difference) : null;
  const narrowed = change?.startsWith('-');
  return <div className="detail-price-gap-item">
    {showPair && <p className="detail-composition-basis">{row.name} · {row.commonName} 대비</p>}
    <div className={styles.priceGapPeriods}>
      <PriceGapPeriod label="현재" date={row.direction ? row.date : null} gap={row.direction ? row : null}
        reason={row.reason ?? ''} />
      <PriceGapPeriod label="1년 전" date={previous?.date ?? null} gap={previous}
        reason="같은 거래일의 종가가 확인되지 않습니다." />
    </div>
    {change != null && <p className={styles.priceGapChange}>
      종가 격차 {formatBusinessValue(previous?.difference ?? null)}원 → {formatBusinessValue(row.difference)}원,{' '}
      <strong>{change === '0' ? '변화 없음' : `${formatBusinessValue(narrowed ? change.slice(1) : change)}원 ${narrowed ? '좁아짐' : '벌어짐'}`}</strong>
    </p>}
  </div>;
}

export function DetailPriceGap({ priceComparisons, compareYear = false }: {
  priceComparisons: PriceComparison[]; compareYear?: boolean;
}) {
  if (!priceComparisons.length) return null;
  return <div className="detail-price-gap"><h3>보통주·우선주 가격 차이</h3>
    {priceComparisons.map(row => compareYear ? <PriceGapYearComparison key={row.securityId} row={row}
      showPair={priceComparisons.length > 1} /> : <div key={row.securityId} className="detail-price-gap-item">
      <p className="detail-composition-basis">{row.direction ? `${row.date} · ${row.commonName} ${formatBusinessValue(row.commonPrice)}원 기준`
        : `${row.commonName} ${row.commonDate || '기준일 미등록'} · ${row.name} ${row.date || '기준일 미등록'}`}</p>
      <p className="detail-price-gap-row">
        <span>{row.name}{row.price != null && ` ${formatBusinessValue(row.price)}원`}</span>
        <strong>{priceGapText(row)}</strong>
      </p>
      {row.reason && <p className="detail-comparison-note">{row.reason}</p>}
    </div>)}
    <p className="detail-comparison-note">차이율 = |우선주 − 보통주| ÷ 보통주 × 100 · 같은 거래일 종가 기준</p>
  </div>;
}
