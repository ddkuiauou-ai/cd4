import { formatInvestorAmount } from '@/lib/investor-number';
import { compareBusinessValues, subtractBusinessValues, type BusinessValue } from '@/lib/business-analysis';
import type { DETAIL_METRICS, DetailMetric } from '@/lib/detail-presentation';
import { detailValue, InvestorTable } from './detail-investor-records';
import type { DetailAnalysis } from './detail-surface';

type PeriodStatsProps = {
  analysis: DetailAnalysis;
  metric: DetailMetric;
  info: typeof DETAIL_METRICS[DetailMetric];
  companyPage: boolean;
  basis?: string | null;
  currentMultiple?: BusinessValue;
};

export function PeriodStats({ analysis, metric, info, companyPage, basis, currentMultiple }: PeriodStatsProps) {
  const isMultiple = metric === 'per' || metric === 'pbr';
  if (companyPage || metric === 'marketcap') {
    return <OtherPeriodStats analysis={analysis} info={info} companyPage={companyPage} basis={basis} />;
  }

  const { means, summary, analysisEnd } = analysis;
  const { start, end } = summary;
  const observationBasis = metric === 'pbr' || metric === 'eps' || metric === 'bps' ? basis ?? end : end;
  const sampleRange = start && end && (end === basis
    ? start !== end && `${start}부터 · `
    : `분석 범위 ${start === end ? start : `${start} ~ ${end}`} · `);
  const rows = means.map(row => {
    const period = row.label.replace(/ 평균$/, '');
    const difference = isMultiple ? subtractBusinessValues(currentMultiple ?? null, row.mean) : null;
    const sign = compareBusinessValues(difference, 0);
    return { key: row.label, cells: [
      { value: period, display: <>{period}
        {row.count === 0 && <small>제공 관측 없음</small>}
        {isMultiple && row.count === 1 && <small>관측 1개</small>}
        {row.end && row.end !== observationBasis && <small>마지막 관측 <time dateTime={row.end}>{row.end}</time></small>}
      </> },
      { value: row.mean, display: formatInvestorAmount(row.mean, info.unit) },
      isMultiple ? { value: difference, display: <span className={sign === 1 ? 'market-up' : sign === -1 ? 'market-down' : undefined}>
        {formatInvestorAmount(difference, info.unit, true)}
      </span> } : { value: row.count.toLocaleString('ko-KR') + '개' },
    ] };
  });
  return <>
    {analysisEnd && analysisEnd !== basis && analysisEnd !== summary.end && <p className="investor-muted">분석 기준 <time dateTime={analysisEnd}>{analysisEnd}</time></p>}
    <InvestorTable label={`기간별 평균 ${isMultiple ? info.label : info.name}`}
      columns={isMultiple ? ['기간', `평균 ${info.label}`, '현재 − 평균'] : ['기간', '평균값', '관측 수']} rows={rows} />
    {summary.count ? <>
      <p className="investor-muted">{sampleRange}실제 관측 {summary.count.toLocaleString('ko-KR')}개</p>
      <p className="investor-muted">최저 {formatInvestorAmount(summary.min, info.unit)} · 최고 {formatInvestorAmount(summary.max, info.unit)}</p>
    </> : <p className="investor-muted">이 범위에 제공된 관측이 없습니다.</p>}
  </>;
}

function OtherPeriodStats({ analysis, info, companyPage, basis }: Omit<PeriodStatsProps, 'metric' | 'currentMultiple'>) {
  const { means, summary, analysisEnd } = analysis;
  const meanScope = (row: typeof means[number]) => row.count
    ? row.start + ' ~ ' + row.end + ' · ' + row.count.toLocaleString('ko-KR') + '개' : '제공 관측 없음';
  return <>
    {analysisEnd && analysisEnd !== basis && analysisEnd !== summary.end && <p className="investor-muted">분석 기준 {analysisEnd}</p>}
    <dl className="investor-period-stats">
      {means.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{detailValue(row.mean, info.unit, companyPage)}</dd>
        <dd className="investor-muted">{meanScope(row)}</dd></div>)}
    </dl>
    <p className="investor-muted">{summary.count ? '분석 범위 ' + summary.start + ' ~ ' + summary.end + ' · 실제 관측 ' + summary.count.toLocaleString('ko-KR') + '개' : '이 범위에 제공된 관측이 없습니다.'}
      {companyPage && ' · 등록 종목 합계의 평균입니다. 관측 종목 구성이 다른 날짜도 포함될 수 있습니다.'}</p>
    {summary.count > 0 && <p className="investor-muted">최저 {detailValue(summary.min, info.unit)} · 최고 {detailValue(summary.max, info.unit)}</p>}
  </>;
}
