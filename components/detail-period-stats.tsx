import { formatInvestorAmount } from '@/lib/investor-number';
import { businessChangePercent, compareBusinessValues, formatMarketcapAmount, subtractBusinessValues, type BusinessValue } from '@/lib/business-analysis';
import type { DETAIL_METRICS, DetailMetric } from '@/lib/detail-presentation';
import { detailValue, InvestorTable } from './detail-investor-records';
import type { DetailAnalysis } from './detail-surface';
import styles from './detail-investor-summary.module.css';

type PeriodStatsProps = {
  analysis: DetailAnalysis;
  metric: DetailMetric;
  info: typeof DETAIL_METRICS[DetailMetric];
  companyPage: boolean;
  basis?: string | null;
  currentValue?: BusinessValue;
  currentDate?: string | null;
};

export function PeriodStats({ analysis, metric, info, companyPage, basis, currentValue = null, currentDate }: PeriodStatsProps) {
  const isMultiple = metric === 'per' || metric === 'pbr';
  if (companyPage || metric === 'marketcap') {
    return <MarketcapPeriodStats analysis={analysis} companyPage={companyPage} basis={basis} currentValue={currentValue} currentDate={currentDate} />;
  }

  const { means, summary, analysisEnd } = analysis;
  const { start, end } = summary;
  const isDps = metric === 'dps';
  const currentDpsChange = isDps ? businessChangePercent(means[0]?.mean ?? null, currentValue) : null;
  const currentDpsChangeSign = compareBusinessValues(currentDpsChange, 0);
  const observationBasis = metric === 'pbr' || metric === 'eps' || metric === 'bps' ? basis ?? end : end;
  const sampleRange = start && end && (end === basis
    ? start !== end && `${start}부터 · `
    : `분석 범위 ${start === end ? start : `${start} ~ ${end}`} · `);
  const rows = means.map((row, index) => {
    const period = row.label.replace(/ 평균$/, '');
    const difference = isMultiple ? subtractBusinessValues(currentValue, row.mean) : null;
    const sign = compareBusinessValues(difference, 0);
    const longerPeriod = metric === 'pbr' || isDps ? means[index + 1] : undefined;
    const meanChange = longerPeriod ? businessChangePercent(longerPeriod.mean, row.mean) : null;
    return { key: row.label, cells: [
      { value: period, display: <>{period}
        {row.count === 0 && <small>제공 관측 없음</small>}
        {isMultiple && row.count === 1 && <small>관측 1개</small>}
        {row.end && row.end !== observationBasis && <small>마지막 관측 <time dateTime={row.end}>{row.end}</time></small>}
      </> },
      { value: row.mean, display: <>{formatInvestorAmount(row.mean, info.unit)}
        {longerPeriod && meanChange != null && <small>{longerPeriod.label} 대비 {formatInvestorAmount(meanChange, '%', true)}</small>}
      </> },
      isMultiple ? { value: difference, display: <span className={sign === 1 ? 'market-up' : sign === -1 ? 'market-down' : undefined}>
        {formatInvestorAmount(difference, info.unit, true)}
      </span> } : { value: row.count.toLocaleString('ko-KR') + '개' },
    ] };
  });
  return <>
    {analysisEnd && analysisEnd !== basis && analysisEnd !== summary.end && <p className="investor-muted">분석 기준 <time dateTime={analysisEnd}>{analysisEnd}</time></p>}
    {currentDpsChange != null && <p className="investor-muted">
      현재 주당배당금 <strong className="font-semibold text-foreground">{formatInvestorAmount(currentValue, '원')}</strong>
      {' · 12개월 평균 대비 '}
      <strong className={currentDpsChangeSign === 1 ? 'market-up' : currentDpsChangeSign === -1 ? 'market-down' : undefined}>
        {formatInvestorAmount(currentDpsChange, '%', true)}
      </strong>
    </p>}
    <InvestorTable label={`기간별 평균 ${isMultiple ? info.label : info.name}`}
      columns={isMultiple ? ['기간', `평균 ${info.label}`, '현재 − 평균'] : ['기간', '평균값', '관측 수']} rows={rows} />
    {summary.count ? <>
      <p className="investor-muted">{sampleRange}실제 관측 {summary.count.toLocaleString('ko-KR')}개</p>
      <p className="investor-muted">최저 {formatInvestorAmount(summary.min, info.unit)} · 최고 {formatInvestorAmount(summary.max, info.unit)}</p>
    </> : <p className="investor-muted">이 범위에 제공된 관측이 없습니다.</p>}
  </>;
}

function PeriodMarketcapAmount({ value, signed = false }: { value: BusinessValue; signed?: boolean }) {
  if (value == null) return '—';
  const amount = formatMarketcapAmount(value).replace(/^-/, '−').replace(' 원', '원');
  const text = amount.includes('.') ? formatInvestorAmount(value, '원', signed)
    : (signed && compareBusinessValues(value, 0) === 1 ? '+' : '') + amount;
  return <span className={styles.periodMarketcapAmount} title={detailValue(value, '원')}>{text}</span>;
}

function MarketcapPeriodStats({ analysis, companyPage, basis, currentValue = null, currentDate }: Omit<PeriodStatsProps, 'metric' | 'info'>) {
  const { means, summary, analysisEnd } = analysis;
  const compareCurrent = currentValue != null && means.some(row => row.mean != null);
  const rows = means.map((row, index) => {
    const period = row.label.replace(/ 평균$/, '');
    const longer = means[index + 1];
    const meanChange = longer ? businessChangePercent(longer.mean, row.mean) : null;
    const difference = subtractBusinessValues(currentValue, row.mean);
    const differenceSign = compareBusinessValues(difference, 0);
    const currentChange = businessChangePercent(row.mean, currentValue);
    return { key: row.label, cells: [
      { value: period, display: <>{period}{row.start && row.end ? <>
        <small><time dateTime={row.start}>{row.start}</time>{row.start !== row.end && (row.end === basis ? '부터'
          : <> ~ <time dateTime={row.end}>{row.end}</time></>)}</small>
        <small>{row.count.toLocaleString('ko-KR')}개 관측</small>
      </> : <small>제공 관측 없음</small>}</> },
      { value: row.mean, display: <><PeriodMarketcapAmount value={row.mean} />
        {longer && meanChange != null && <small>{longer.label} 대비 {formatInvestorAmount(meanChange, '%', true)}</small>}
      </> },
      ...(compareCurrent ? [{ value: difference, display: <>
        <span className={differenceSign === 1 ? 'market-up' : differenceSign === -1 ? 'market-down' : undefined}>
          <PeriodMarketcapAmount value={difference} signed />
        </span>
        {currentChange != null && <small>평균 대비 {formatInvestorAmount(currentChange, '%', true)}</small>}
      </> }] : []),
    ] };
  });
  return <div className={styles.marketcapPeriodStats}>
    {analysisEnd && analysisEnd !== basis && analysisEnd !== summary.end && <p className="investor-muted">분석 기준 <time dateTime={analysisEnd}>{analysisEnd}</time></p>}
    {compareCurrent && <p className="investor-muted">{companyPage ? '현재 기업 합산 시가총액' : '현재 시가총액'}{' '}
      <strong className="font-semibold text-foreground"><PeriodMarketcapAmount value={currentValue} /></strong>
      {currentDate && currentDate !== basis && <> · <time dateTime={currentDate}>{currentDate}</time></>}
    </p>}
    <InvestorTable label="기간별 평균 시가총액"
      columns={compareCurrent ? ['기간', '평균 시가총액', '현재 − 평균'] : ['기간', '평균 시가총액']} rows={rows} />
    {summary.count ? <>
      <p className="investor-muted">분석 범위 {summary.start} ~ {summary.end} · 실제 관측 {summary.count.toLocaleString('ko-KR')}개
        {companyPage && ' · 날짜별 등록 종목 합계의 평균이며 관측 종목 구성이 달라질 수 있습니다.'}</p>
      <p className="investor-muted">최저 <PeriodMarketcapAmount value={summary.min} /> · 최고 <PeriodMarketcapAmount value={summary.max} /></p>
    </> : <p className="investor-muted">이 범위에 제공된 관측이 없습니다.</p>}
  </div>;
}
