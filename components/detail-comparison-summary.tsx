import { formatBusinessValue, formatCompactBusinessValue } from '@/lib/business-analysis';
import { prepareDetailComparison } from '@/lib/detail-comparison';
import type { DetailCompanyView, DetailSecurityRow } from './detail-types';

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
    {priceComparisons.length > 0 && <div className="detail-price-gap"><h3>보통주·우선주 가격 차이</h3>
      {priceComparisons.map(row => <div key={row.securityId} className="detail-price-gap-item">
        <p className="detail-composition-basis">{row.direction ? `${row.date} · ${row.commonName} ${formatBusinessValue(row.commonPrice)}원 기준`
          : `${row.commonName} ${row.commonDate || '기준일 미등록'} · ${row.name} ${row.date || '기준일 미등록'}`}</p>
        <p className="detail-price-gap-row"><span>{row.name}</span><strong>{row.direction === 'same' ? '같은 가격 · 0원 (0%)'
          : row.direction ? `${formatBusinessValue(row.difference)}원 (${formatBusinessValue(row.percent)}%) ${row.direction === 'lower' ? '낮음' : '높음'}` : '—'}</strong></p>
        {row.reason && <p className="detail-comparison-note">{row.reason}</p>}
      </div>)}
      <p className="detail-comparison-note">차이율 = |우선주 − 보통주| ÷ 보통주 × 100 · 같은 거래일 종가 기준</p>
    </div>}
  </div>;
}
