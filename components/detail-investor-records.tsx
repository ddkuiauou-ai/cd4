import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatInvestorAmount, formatInvestorNumber, usesInvestorPrecision } from '@/lib/investor-number';
import { businessPercentageOf, businessRatio, compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, roundBusinessValue, subtractBusinessValues, type BusinessValue } from '@/lib/business-analysis';
import { businessDate } from '@/lib/data/dto';
import { DETAIL_METRICS, earlierDate, sourceValue, type DetailAnnualRow, type DetailMetric } from '@/lib/detail-presentation';
import { companyPath, securityPath } from '@/lib/entity-paths';
import { DetailSwitchLink, type DetailNavItem, type DetailSwitchCandidate } from './detail-investor-navigation';
import { DetailSecurityCard } from './detail-security-card';
import { DetailRecordInfo } from './detail-record-info';
import type { DetailCompanyData, DetailCompanyView, DetailSecurityRow } from './detail-types';
import { CsvDownloadButton } from './CsvDownloadButton';
import type { AnnualDividendComparison } from './detail-annual-table';
import styles from './detail-investor-summary.module.css';

type Scope = { start?: string; end?: string; periodId?: string };
type ValueField = DetailMetric | 'price';
type ScopedSecurity = DetailSecurityRow & { historicalPeriod?: boolean };

export const detailMetricLabel = (metric: ValueField) => metric === 'price' ? '종가'
  : metric === 'div' || metric === 'dps' ? DETAIL_METRICS[metric].name : DETAIL_METRICS[metric].label;

export const securityName = (row: DetailSecurityRow) => row.korName || row.name || row.ticker || '종목';
export const detailValue = (value: BusinessValue | undefined, unit = '', compact = false) => value == null ? '—'
  : (compact ? formatCompactBusinessValue(value) : formatBusinessValue(value)) + unit;

function detailDay(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return businessDate(value);
  return typeof value === 'string' && isBusinessDay(value) ? value : null;
}

export function detailHref(path: string, { start, end, periodId }: Scope) {
  const query = new URLSearchParams();
  if (start) query.set('start', start);
  if (end) query.set('end', end);
  if (periodId) query.set('period', periodId);
  return query.size ? path + '?' + query : path;
}

function fieldValue(source: Record<string, unknown> | undefined, field: string): BusinessValue {
  const state = source?.[field + 'State'];
  const value = sourceValue(source?.[field]);
  return state != null && state !== 'provided' || compareBusinessValues(value, 0) == null ? null : value;
}

export function securityValue(security: DetailSecurityRow | null, metric: ValueField) {
  const state = security?.[`${metric}State`];
  const current = sourceValue(security?.[metric]);
  const value = security?.state === 'unpublished' || state != null && state !== 'provided'
    || compareBusinessValues(current, 0) == null ? null : current;
  return { value, date: value == null ? null : detailDay(security?.[`${metric}Date`]) };
}

export function metricAvailable(security: DetailSecurityRow, metric: DetailMetric) {
  if (security.availableMetrics) return security.availableMetrics.includes(metric);
  return securityValue(security, metric).value != null || compareBusinessValues(sourceValue(security[`${metric}LastProvided`]), 0) != null;
}

export function detailNavGroups({ company, security, companyPage, basic, metric, scope }: {
  company: DetailCompanyView | null; security: ScopedSecurity | null; companyPage: boolean; basic: boolean; metric: DetailMetric; scope: Scope;
}): DetailNavItem[][] {
  const { periodId, ...range } = scope;
  let target: DetailNavItem['target'];
  if (companyPage && security) {
    const stockName = securityName(security);
    const companyName = company?.companyKorName || company?.companyName;
    const hasSameNameMember = company?.securities.some(member =>
      member.securityId !== security.securityId && securityName(member) === stockName) ?? false;
    target = {
      label: security.ticker ? stockName + ' · ' + security.ticker : stockName,
      showInMenu: security.type !== '보통주' || stockName !== companyName || hasSameNameMember,
    };
  }
  const item = (key: DetailMetric): DetailNavItem => ({
    label: detailMetricLabel(key),
    href: security && (key === 'marketcap' || metricAvailable(security, key))
      ? detailHref(securityPath(security, key), { ...range, periodId: companyPage ? undefined : periodId }) : undefined,
    selected: !companyPage && !basic && metric === key,
    target,
  });
  const companyLinks = [
    { label: '기업 개요', href: company ? detailHref(companyPath(company), range) : undefined, selected: companyPage && basic },
    company && (companyPage || !security) ? {
      label: '시가총액', href: detailHref(companyPath(company, 'marketcap'), range), selected: companyPage && !basic,
    } : item('marketcap'),
  ];
  const financial = (['per', 'pbr', 'eps', 'bps'] as const).map(item);
  const dividend = (['dps', 'div'] as const).map(item);
  return [companyLinks, [], financial, dividend];
}

/** Enrich the published-date membership with the matching comparison fields. */
export function detailEntityMembers(company: DetailCompanyData, companySecs: DetailSecurityRow[], security: DetailSecurityRow | null) {
  if (!company) return security ? [security] : [];

  const comparison = new Map(companySecs.map(row => [row.securityId, row]));
  return company.securities.map(member => ({ ...member, ...comparison.get(member.securityId),
    marketcap: member.marketcap, marketcapDate: member.marketcapDate }))
    .sort((a, b) => Number(b.type === '보통주') - Number(a.type === '보통주'));
}

export function detailSwitchCandidates({ members, current, companyPage, basic, metric, scope }: {
  members: DetailSecurityRow[]; current: DetailSecurityRow | null; companyPage: boolean; basic: boolean; metric: DetailMetric; scope: Scope;
}): DetailSwitchCandidate[] {
  return [...new Map(members.map(member => [member.securityId, member])).values()].map(member => {
    const selected = !companyPage && member.securityId === current?.securityId;
    const available = companyPage || basic || metric === 'marketcap' || metricAvailable(member, metric);
    const info = basic ? { unit: '원' } : DETAIL_METRICS[metric];
    const observation = basic ? memberPrice(member) : securityValue(member, metric);
    const rank = !basic && !companyPage && metric === 'dps' && !selected ? member.dpsRanking : undefined;
    const href = available ? detailHref(securityPath(member, basic ? 'marketcap' : metric), {
      ...scope, periodId: selected ? scope.periodId : undefined,
    }) + (basic ? '#price-history' : '') : undefined;
    return {
      securityId: member.securityId, name: securityName(member), ticker: member.ticker, type: member.type, selected,
      href, value: !basic && usesInvestorPrecision(metric) ? formatInvestorAmount(observation.value, info.unit)
        : detailValue(observation.value, info.unit, !basic && metric === 'marketcap'),
      ...(rank && Number.isSafeInteger(rank.rank) && rank.rank > 0 ? { dpsRanking: rank } : {}),
    };
  });
}

export function StockSelection({ candidates, label }: {
  candidates: DetailSwitchCandidate[]; label: string;
}) {
  const available = candidates.filter(candidate => candidate.href);
  if (available.length < 2) return null;
  return <nav className={styles.switchLinks} aria-label={label}>
    <span>{label}</span>
    {available.map(candidate => <DetailSwitchLink key={candidate.securityId} candidate={candidate}>
      {candidate.name}<small>{candidate.ticker}</small><strong>{candidate.value}</strong>
    </DetailSwitchLink>)}
  </nav>;
}

type Cell = { value: string | number | null; display?: ReactNode; date?: string | null; note?: ReactNode };
type TableRow = { key: string; cells: Cell[]; selected?: boolean; difference?: boolean };
const numCell = (value: BusinessValue, unit: string, date?: string | null, compact = false): Cell => ({ value, date,
  display: value == null ? '—' : <span title={detailValue(value, unit)}>{detailValue(value, unit, compact)}</span> });

const investorNumCell = (value: BusinessValue, unit: string, date?: string | null): Cell => ({
  value,
  date,
  display: value == null ? '—' : <span title={detailValue(value, unit)}>{formatInvestorAmount(value, unit)}</span>,
});

export function InvestorTable({ columns, rows, label, emphasized, basis }: {
  columns: string[]; rows: TableRow[]; label: string; emphasized?: number; basis?: string | null;
}) {
  return <div className="detail-table-scroll"><table className="investor-table">
    <caption className="sr-only">{label}</caption>
    <thead><tr>{columns.map((column, index) => <th key={column} scope="col" data-emphasis={index === emphasized || undefined}>
      {column}
    </th>)}</tr></thead>
    <tbody>{rows.map(({ key, cells, selected, difference }) => <tr key={key} data-selected={selected || undefined} data-difference={difference || undefined}>
      {cells.map(({ value, display, date, note }, index) => {
        const CellElement = index === 0 ? 'th' : 'td';
        return <CellElement key={columns[index]} scope={index === 0 ? 'row' : undefined} data-emphasis={index === emphasized || undefined}>
          {display ?? value ?? '—'}{date && date !== basis && <small>{date}</small>}{note}
        </CellElement>;
      })}
    </tr>)}</tbody>
  </table></div>;
}

function comparisonCsv(columns: string[], rows: TableRow[]) {
  return rows.map(({ cells }) => Object.fromEntries(columns.map((column, index) => [column, cells[index].value])));
}

function memberPrice(member: DetailSecurityRow) {
  if (member.state === 'unpublished') return { value: null, date: null };
  if (member.priceState != null) return securityValue(member, 'price');
  const rows = member.prices ?? [];
  if (rows.some(row => !detailDay(row.date))) return { value: null, date: null };
  const date = rows.reduce<string | null>((latest, row) => {
    const day = detailDay(row.date);
    return day && (!latest || day > latest) ? day : latest;
  }, null);
  const latest = rows.filter(row => detailDay(row.date) === date);
  const close = latest[0]?.close ?? null;
  return { date, value: latest.every(row => compareBusinessValues(row.close, close) === 0) ? close : null };
}

export function DetailRecordHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="investor-record-heading"><h2>{title}</h2>{children}</header>;
}

export function ConstituentsTable({ members, scope, csvStem, company, showCsv, basis, candidates }: {
  members: DetailSecurityRow[]; scope: Scope; csvStem: string; company?: DetailCompanyView | null; showCsv?: boolean; basis?: string | null;
  candidates?: DetailSwitchCandidate[];
}) {
  const label = '구성 종목 비교';
  const columns = ['종목', '종목코드', '시가총액(원)', '종가(원)'];
  const range = { start: scope.start, end: scope.end };
  const rows = members.map(member => {
    const name = securityName(member);
    const included = company?.securities.find(row => row.securityId === member.securityId);
    const cap = included ? {
      value: company?.state === 'published' ? included.marketcap : null,
      date: company?.state === 'published' ? detailDay(included.marketcapDate) : null,
    } : securityValue(member, 'marketcap');
    const price = memberPrice(member);
    const destination = candidates?.find(item => item.securityId === member.securityId);
    const amount = (value: BusinessValue, date: string | null, metric?: DetailMetric) => ({
      ...numCell(value, '원', date, metric === 'marketcap'),
      display: value == null ? '—' : <Link prefetch={false} href={detailHref(securityPath(member, metric ?? 'marketcap'), range) + (metric ? '' : '#price-history')}
        title={detailValue(value, '원')} aria-label={name + ' ' + (metric ? '시가총액' : '종가') + ' ' + detailValue(value, '원')}>
        {detailValue(value, '원', metric === 'marketcap')}
      </Link>,
    });
    return { key: member.securityId, cells: [
      { value: name, display: <>{destination?.href
        ? <Link prefetch={false} href={destination.href} aria-label={name + ' ' + (showCsv ? '주가·거래 보기' : '종목 시총 보기')}>{name}</Link>
        : name}{member.type && <small>{member.type}</small>}</> },
      { value: member.ticker ? "'" + member.ticker : null, display: member.ticker || '—' },
      amount(cap.value, cap.date, 'marketcap'), amount(price.value, price.date),
    ] };
  });
  return <>
    {showCsv && (rows.length > 0 || company) && <div className="investor-record-actions">
      {company && <Link prefetch={false} href={detailHref(companyPath(company, 'marketcap'), range)}>합산 시총 보기</Link>}
      {rows.length > 0 && <CsvDownloadButton key={csvStem} data={comparisonCsv(columns, rows)} filename={csvStem + '-constituents.csv'} label="구성 종목 비교 CSV" />}
    </div>}
    {rows.length ? <InvestorTable label={label} columns={columns} rows={rows} basis={basis} /> : <p className="investor-muted">확인된 구성 종목이 없습니다.</p>}
  </>;
}

export function annualDividendComparison({ members, securityId, metric, rows, scope }: {
  members: DetailSecurityRow[]; securityId?: string; metric: 'dps' | 'div'; rows: readonly DetailAnnualRow[]; scope: Scope;
}): AnnualDividendComparison | undefined {
  const roster = [...new Map(members.map(member => [member.securityId, member])).values()];
  const common = roster.filter(member => member.type === '보통주');
  const preferred = roster.filter(member => member.type?.includes('우선주'));
  if (common.length !== 1 || !preferred.length) return;
  const [baseline] = common;
  const comparisonMembers = [baseline, ...preferred];
  if (!comparisonMembers.some(member => member.securityId === securityId)) return;

  const observations = new Map(comparisonMembers.map(member => {
    const years = new Map<string, { date: string; value: BusinessValue }>();
    for (const row of member.dividendHistory ?? []) {
      const value = row[metric];
      if (!isBusinessDay(row.date) || compareBusinessValues(value, 0) == null
        || scope.start && row.date < scope.start || scope.end && row.date > scope.end) continue;
      const year = row.date.slice(0, 4);
      const previous = years.get(year);
      if (!previous || previous.date < row.date) years.set(year, { date: row.date, value });
    }
    return [member.securityId, years] as const;
  }));
  const pairs = preferred.map(member => ({ securityId: member.securityId,
    label: comparisonMembers.some(other => other.securityId !== member.securityId && securityName(other) === securityName(member))
      ? `${securityName(member)} (${member.ticker || member.routeCode || member.securityId})` : securityName(member),
  }));
  const byDate = Object.fromEntries(rows.map(row => {
    const year = row.date.slice(0, 4);
    const base = observations.get(baseline.securityId)?.get(year);
    const selected = securityId ? observations.get(securityId)?.get(year) : undefined;
    const selectedMatches = selected?.date === row.date && (!row.state || row.state === 'provided')
      && compareBusinessValues(selected.value, row.value) === 0;
    const values = pairs.map(({ securityId: preferredId }) => {
      const observation = observations.get(preferredId)?.get(year);
      const comparable = selectedMatches && base?.date === row.date && observation?.date === row.date;
      return [preferredId, comparable ? subtractBusinessValues(observation.value, base.value) : null];
    });
    return [row.date, Object.fromEntries(values)];
  }));
  return { pairs, commonName: securityName(baseline), byDate };
}

export function dividendComparisonHeading(members: DetailSecurityRow[]) {
  if (members.length < 2) return '종목 배당 정보';
  return members.filter(member => member.type === '보통주').length === 1 && members.some(member => member.type?.includes('우선주'))
    ? '보통주·우선주 배당 비교' : '구성 종목 배당 비교';
}

const dividendFields = [
  { key: 'dps', label: '주당배당금', unit: '원' },
  { key: 'div', label: '배당수익률', unit: '%p' },
  { key: 'price', label: '종가', unit: '원' },
] as const;
const dividendGapChangeLabel = '1년간 격차 변화';
const dividendGapMagnitude = (value: string) => value.replace(/^-/, '');

function dividendGaps(members: DetailSecurityRow[], rows: TableRow[], securityId: string | undefined,
  currentDate: string | null, referenceDay: string | null) {
  const selected = members.find(member => member.securityId === securityId);
  const common = members.filter(member => member.type === '보통주');
  if (!selected || common.length !== 1) return [];
  const [commonStock] = common;
  const peers = selected.securityId === commonStock.securityId ? members.filter(member => member.type?.includes('우선주'))
    : selected.type?.includes('우선주') ? [commonStock] : [];
  const name = (member: DetailSecurityRow) => members.some(other => other.securityId !== member.securityId && securityName(other) === securityName(member))
    ? `${securityName(member)} (${member.ticker || member.securityId})` : securityName(member);
  const selectedRow = rows.find(row => row.key === selected.securityId);
  return peers.map(peer => {
    const peerRow = rows.find(row => row.key === peer.securityId);
    const selectedReference = selected.dividendReference;
    const peerReference = peer.dividendReference;
    const periods = [
      { label: '현재', date: currentDate, differences: dividendFields.map((_, index) => {
        const own = selectedRow?.cells[index + 1];
        const other = peerRow?.cells[index + 1];
        return currentDate && own?.date === currentDate && other?.date === currentDate
          ? subtractBusinessValues(own.value, other.value) : null;
      }) },
      { label: '1년 전', date: referenceDay, differences: dividendFields.map(({ key }) =>
        referenceDay && selectedReference?.date === referenceDay && peerReference?.date === referenceDay
          ? subtractBusinessValues(selectedReference[key], peerReference[key]) : null) },
    ];
    const [current, previous] = periods;
    const change = current.differences.map((value, index) => {
      const prior = previous.differences[index];
      return value == null || prior == null ? null
        : subtractBusinessValues(dividendGapMagnitude(value), dividendGapMagnitude(prior));
    });
    return { key: peer.securityId, selectedName: name(selected), peerName: name(peer), periods,
      change: change.some(value => value != null) ? change : null };
  });
}

function DividendGapAmount({ value, unit }: { value: string | null; unit: string }) {
  const sign = compareBusinessValues(value, 0);
  if (value == null || sign == null) return '—';
  return <>{formatInvestorAmount(dividendGapMagnitude(value), unit)} <span>{sign === 0 ? '같음' : sign === 1 ? '높음' : '낮음'}</span></>;
}

function DividendGapChange({ values, previous, current }: {
  values: (string | null)[]; previous: (string | null)[]; current: (string | null)[];
}) {
  return <p className={styles.dividendGapChange}>
    <span>{dividendGapChangeLabel}</span>
    {dividendFields.map(({ key, label, unit }, index) => {
      const value = values[index];
      const sign = compareBusinessValues(value, 0);
      if (value == null || sign == null) return null;
      const before = previous[index];
      const after = current[index];
      const range = key !== 'dps' && before != null && after != null
        ? ` 격차 ${formatInvestorAmount(dividendGapMagnitude(before), unit)} → ${formatInvestorAmount(dividendGapMagnitude(after), unit)},` : '';
      return <span key={key}>{label}{range} <strong>{sign === 0 ? '변화 없음'
        : `${formatInvestorAmount(dividendGapMagnitude(value), unit)} ${sign > 0 ? '벌어짐' : '좁아짐'}`}</strong></span>;
    })}
  </p>;
}

export function DividendTable({ members, securityId, metric, csvStem, scope, basis, candidates, referenceDay = null }: {
  members: DetailSecurityRow[]; securityId?: string; metric?: 'dps' | 'div'; csvStem?: string; scope: Scope; basis?: string | null;
  candidates?: DetailSwitchCandidate[]; referenceDay?: string | null;
}) {
  const columns = ['종목', '주당배당금(원)', '배당수익률(%)', '종가(원)'];
  const formatAmount = metric ? formatInvestorAmount : detailValue;
  const makeCell = metric ? investorNumCell : numCell;
  const rows: TableRow[] = members.map(member => {
    const key = member.securityId;
    const name = securityName(member);
    const dps = securityValue(member, 'dps');
    const div = securityValue(member, 'div');
    const price = memberPrice(member);
    const target = detailHref(securityPath(member, 'marketcap'), { ...scope, periodId: key === securityId ? scope.periodId : undefined }) + '#price-history';
    return { key, selected: key === securityId, cells: [
      { value: name, display: <>{name}{member.ticker && <small>{member.ticker}</small>}</> },
      makeCell(dps.value, '원', dps.date), makeCell(div.value, '%', div.date),
      { ...makeCell(price.value, '원', price.date), display: price.value == null ? '—'
        : <Link prefetch={false} href={target} title={detailValue(price.value, '원')} aria-label={name + ' 종가 ' + formatAmount(price.value, '원')}>{formatAmount(price.value, '원')}</Link> },
    ] };
  });
  const common = members.filter(member => member.type === '보통주');
  if (common.length === 1 && (!metric || !candidates)) {
    const commonRow = rows.find(row => row.key === common[0].securityId);
    for (const member of members.filter(member => member.type?.includes('우선주'))) {
      const preferredRow = rows.find(row => row.key === member.securityId);
      if (!commonRow || !preferredRow) continue;
      const label = securityName(member) + ' − ' + securityName(common[0]);
      const units = ['원', '%p', '원'];
      const differences = units.map((unit, index) => {
        const own = preferredRow.cells[index + 1];
        const base = commonRow.cells[index + 1];
        const value = own.date && own.date === base.date ? subtractBusinessValues(own.value, base.value) : null;
        return { value, date: value == null ? null : own.date,
          display: metric ? formatInvestorAmount(value, unit, true)
            : value == null ? '—' : (compareBusinessValues(value, 0) === 1 ? '+' : '') + detailValue(value, unit).replace(/^-/, '−') };
      });
      rows.push({ key: 'difference-' + member.securityId, difference: true, cells: [{ value: label }, ...differences] });
    }
  }

  if (!rows.length) return <p className="investor-muted">확인된 배당 비교 종목이 없습니다.</p>;
  if (!metric || !candidates) return <>
    <InvestorTable label="구성 종목 배당 비교" columns={columns} rows={rows} basis={basis} />
    {rows.some(row => row.difference) && <p className="investor-muted">차이는 같은 날에 관측한 값으로 계산합니다. 배당수익률의 차이 단위는 %p입니다.</p>}
  </>;
  const allowed = candidates.filter(candidate => candidate.href).length >= 2;
  const candidateById = new Map(candidates.map(candidate => [candidate.securityId, candidate]));
  const emphasis = metric === 'dps' ? 0 : 1;
  const comparing = rows.length > 1;
  const heading = dividendComparisonHeading(members);
  const showDates = dividendFields.map((_, index) => rows.some(row => row.cells[index + 1].date && row.cells[index + 1].date !== basis));
  const currentDate = rows.find(row => row.selected)?.cells[emphasis + 1].date ?? basis ?? null;
  const gaps = dividendGaps(members, rows, securityId, currentDate, referenceDay);
  const gapColumns = dividendFields.map(({ label, unit }) => `${label} 차이(${unit})`);
  const gapValues = (values: BusinessValue[]) => Object.fromEntries(gapColumns.map((column, index) => [column, values[index]]));
  const csvRows = gaps.length > 0 ? [
    ...comparisonCsv(columns, rows).map(row => ({ ...row, 시점: '현재 종목값', 관측일: null, ...gapValues([null, null, null]) })),
    ...gaps.flatMap(({ selectedName, peerName, periods, change }) => {
      const comparison = selectedName + ' − ' + peerName;
      const slices = change ? [...periods, { label: dividendGapChangeLabel, date: null, differences: change }] : periods;
      return slices.map(({ label, date, differences }) => ({
        [columns[0]]: comparison, [columns[1]]: null, [columns[2]]: null, [columns[3]]: null,
        시점: label, 관측일: date, ...gapValues(differences),
      }));
    }),
  ] : comparisonCsv(columns, rows);
  return <section id="dividend-summary" tabIndex={-1} className={styles.dividendComparison}
    data-divider={metric === 'dps' && comparing || undefined} aria-labelledby="dividend-comparison-heading">
    <header className="investor-record-heading">
      <h2 id="dividend-comparison-heading">{heading}</h2>
      {csvStem && <CsvDownloadButton key={csvStem + metric} data={csvRows}
        filename={csvStem + (comparing ? '-dividend-comparison-' : '-dividend-information-') + metric + '.csv'}
        label={comparing ? '배당 비교표 CSV' : '종목 배당 정보 CSV'} />}
    </header>
    <div className={styles.securityCards} data-comparing={comparing || undefined} aria-label={allowed ? '조회할 종목' : heading} role="group">
      {rows.map(row => {
        const candidate = candidateById.get(row.key);
        const rank = candidate?.dpsRanking;
        const rankLabel = rank ? <span className={styles.dividendCardRank}>
          <span className="sr-only">주당배당금 순위 </span>{rank.rank.toLocaleString('ko-KR')}위
          {rank.date && rank.date !== basis && <time dateTime={rank.date}>{rank.date}</time>}
        </span> : undefined;
        return <DetailSecurityCard key={row.key} candidate={candidate} name={row.cells[0].value} selectable={allowed}
          description={[candidate?.type, candidate?.ticker].filter(Boolean).join(' · ')} headerEnd={rankLabel}
          renderTarget={(target, identity, className) => <DetailSwitchLink candidate={{
            ...target, href: target.href ? target.href + '#dividend-summary' : undefined,
          }} className={className}>{identity}</DetailSwitchLink>}>
          <dl className={styles.values}>
            {row.cells.slice(1).map(({ value, display, date }, index) => <div key={dividendFields[index].key} data-with-date={showDates[index] || undefined}>
              <dt>{dividendFields[index].label}</dt>
              <dd data-emphasis={index === emphasis || undefined}>{display ?? value ?? '—'}
                {date && date !== basis && <small><time dateTime={date}>{date}</time></small>}
              </dd>
            </div>)}
          </dl>
        </DetailSecurityCard>;
      })}
    </div>
    {gaps.map(({ key, selectedName, peerName, periods, change }) => <div key={key} className={styles.dividendGap}>
      <h3>{selectedName} <small>{peerName} 대비</small></h3>
      <div className={styles.valuationPeriods}>
        {periods.map(({ label, date, differences }) => <div key={label} className={styles.valuationPeriod}>
          <h4>{label}{date && <time dateTime={date}>{date}</time>}</h4>
          <dl>
            {dividendFields.map(({ key, label, unit }, index) => <div key={key}>
              <dt>{label}</dt><dd><DividendGapAmount value={differences[index]} unit={unit} /></dd>
            </div>)}
          </dl>
          {differences.every(value => value == null) && <small>같은 날 비교할 자료가 없습니다.</small>}
        </div>)}
      </div>
      {change && <DividendGapChange values={change} previous={periods[1].differences} current={periods[0].differences} />}
    </div>)}
  </section>;
}

export type ValuationObservation = { date: string; metric: BusinessValue; related: BusinessValue; price: BusinessValue };
const valuationInput = { per: 'eps', pbr: 'bps', eps: 'per', bps: 'pbr', dps: 'div', div: 'dps' } as const;
type ValuationOverviewMetric = keyof typeof valuationInput;

const valuationHelp = {
  per: { label: '주가수익비율(PER) 뜻', text: '주가수익비율(PER)은 종가를 주당순이익(EPS)으로 나눈 배수입니다.' },
  eps: { label: '주당순이익(EPS) 뜻', text: '주당순이익(EPS)은 기업의 순이익을 주식 한 주 기준으로 나타낸 값입니다. 종가를 PER로 나눠 구할 수 있으며, PER을 반올림하면 계산값이 공개값과 조금 다를 수 있습니다.' },
  pbr: { label: '주가순자산비율(PBR) 뜻', text: '주가순자산비율(PBR)은 종가를 주당순자산(BPS)으로 나눈 배수입니다.' },
  bps: { label: '주당순자산(BPS) 뜻', text: '주당순자산(BPS)은 기업의 순자산을 주식 한 주 기준으로 나타낸 값입니다. 종가를 PBR로 나눠 구할 수 있으며, PBR을 반올림하면 계산값이 공개값과 조금 다를 수 있습니다.' },
  dps: { label: '주당배당금 뜻', text: '주당배당금은 주식 한 주에 지급된 배당금입니다. 종가에 배당수익률을 곱해 구할 수 있으며, 수익률을 반올림하면 계산값이 공개값과 조금 다를 수 있습니다.' },
  div: { label: '배당수익률 뜻', text: '배당수익률은 종가 대비 주당배당금의 비율입니다. 주당배당금을 종가로 나누고 100을 곱해 백분율로 표시합니다.' },
};

export function valuationReference({ metric, currentDate, sourceHistory, prices }: {
  metric: ValuationOverviewMetric; currentDate: string | null; sourceHistory: Record<string, unknown>[]; prices: Record<string, unknown>[];
}): ValuationObservation | null {
  if (!currentDate) return null;
  const target = earlierDate(currentDate, 12);
  const related = valuationInput[metric];
  const priceByDay = new Map(prices.flatMap(row => typeof row.date === 'string' ? [[row.date, row] as const] : []));
  let observation: ValuationObservation | null = null;
  for (const row of sourceHistory) {
    const date = detailDay(row.date);
    if (!date || date > target || observation && date <= observation.date) continue;
    const value = fieldValue(row, metric);
    const input = fieldValue(row, related);
    const price = fieldValue(priceByDay.get(date), 'close');
    if (value == null || metric === 'per' && (input == null || price == null)) continue;
    observation = { date, metric: value, related: input, price };
  }
  return observation;
}

function matchesPublishedRatio(result: Cell, numerator: Cell, denominator: Cell, unit: '배' | '%') {
  if (!result.date || numerator.date !== result.date || denominator.date !== result.date) return false;
  const multiplier = unit === '%' ? 100 : 1;
  const ratio = businessRatio(numerator.value, denominator.value, 2, multiplier);
  // Check the published value against both the source values and the displayed won amounts.
  return ratio != null && formatInvestorAmount(ratio, unit) === formatInvestorAmount(result.value, unit)
    && ratio === businessRatio(roundBusinessValue(numerator.value, 0), roundBusinessValue(denominator.value, 0), 2, multiplier);
}

function displayedNumber(value: BusinessValue, unit: string) {
  return formatInvestorNumber(value, unit).replaceAll(',', '').replaceAll('−', '-');
}

function perShareCalculation(result: Cell, price: Cell, multiple: Cell) {
  if (!result.date || price.date !== result.date || multiple.date !== result.date
    || compareBusinessValues(price.value, 0) !== 1 || compareBusinessValues(result.value, 0) !== 1) return null;

  const amount = businessRatio(price.value, multiple.value, 0);
  if (amount == null) return null;
  const published = formatInvestorAmount(result.value, '원');
  const matches = formatInvestorAmount(amount, '원') === published;
  // A published two-decimal multiple can imply a range of per-share amounts.
  const matchesRoundedMultiple = compareBusinessValues(businessRatio(price.value, result.value, 2), multiple.value) === 0;
  if (!matches && !matchesRoundedMultiple) return null;

  const displayedAmount = businessRatio(displayedNumber(price.value, '원'), displayedNumber(multiple.value, '배'), 0);
  if (displayedAmount == null || displayedAmount === '0') return null;
  const estimate = formatInvestorAmount(displayedAmount, '원');
  return { estimate: estimate === published ? null : estimate };
}

function dividendPerShareCalculation(result: Cell, price: Cell, dividendYield: Cell) {
  const yieldSign = compareBusinessValues(dividendYield.value, 0);
  if (!result.date || price.date !== result.date || dividendYield.date !== result.date
    || compareBusinessValues(price.value, 0) !== 1 || yieldSign == null || yieldSign < 0) return null;
  const amount = businessPercentageOf(price.value, dividendYield.value);
  if (amount == null) return null;
  const published = formatInvestorAmount(result.value, '원');
  const matches = formatInvestorAmount(amount, '원') === published;
  // A published two-decimal yield can imply a range of won amounts.
  const matchesRoundedYield = yieldSign > 0 && compareBusinessValues(businessRatio(result.value, price.value, 2, 100), dividendYield.value) === 0;
  if (!matches && !matchesRoundedYield) return null;

  const displayedAmount = businessPercentageOf(displayedNumber(price.value, '원'), displayedNumber(dividendYield.value, '%'));
  if (displayedAmount == null) return null;
  const estimate = formatInvestorAmount(displayedAmount, '원');
  return { estimate: estimate === published ? null : estimate };
}

function MetricCalculation({ metric, result, first, second, approximate, estimate }: {
  metric: ValuationOverviewMetric; result: Cell; first: Cell; second: Cell; approximate: boolean;
  estimate?: string | null;
}) {
  const dividendYield = metric === 'div';
  const product = metric === 'dps' && approximate;
  const secondLabel = { per: '주당순이익 EPS', pbr: '주당순자산 BPS', div: '종가', dps: '배당수익률', eps: 'PER', bps: 'PBR' }[metric];
  const inputs = [{ label: dividendYield ? '주당배당금' : '종가', cell: first, multiply: false }];
  if (second.value != null || (metric !== 'eps' && metric !== 'bps')) {
    inputs.push({ label: secondLabel, cell: second, multiply: product });
  }
  return <div className={styles.metricCalculation} data-calculation={approximate || undefined} data-product={product || undefined}>
    <dl className={styles.calculationInputs}>
      {inputs.map(({ label, cell, multiply }) => <div key={label}>
        <dt>{label}</dt>
        <dd>{multiply && <span className={styles.multiplicationSign} aria-hidden="true">× </span>}
          {cell.display}{cell.date && cell.date !== result.date && <small><time dateTime={cell.date}>{cell.date}</time></small>}</dd>
      </div>)}
    </dl>
    {approximate && <span className={styles.calculationOperator}>
      <span aria-hidden="true">{dividendYield ? '× 100 ≈' : '≈'}</span>
      <span className="sr-only">{product ? '종가에 배당수익률을 곱하면 약'
        : dividendYield ? '주당배당금을 종가로 나누고 100을 곱하면 약' : `종가를 ${secondLabel}로 나누면 약`}</span>
    </span>}
    <dl className={styles.calculationResult}>
      <dt>{estimate ? '계산' : '공개'} {detailMetricLabel(metric)}</dt><dd>{estimate ?? result.display}</dd>
    </dl>
  </div>;
}

function ValuationPeriod({ label, metric, result, price, input }: {
  label: string; metric: ValuationOverviewMetric; result: Cell; price: Cell; input: Cell;
}) {
  const calculation = metric === 'eps' || metric === 'bps' ? perShareCalculation(result, price, input)
    : metric === 'dps' ? dividendPerShareCalculation(result, price, input) : null;
  const dividendYield = metric === 'div';
  const first = dividendYield ? input : price;
  const second = dividendYield ? price : input;
  const approximate = metric === 'eps' || metric === 'bps' || metric === 'dps'
    ? calculation != null : matchesPublishedRatio(result, first, second, dividendYield ? '%' : '배');
  return <section className={styles.valuationPeriod} aria-label={label + ' ' + detailMetricLabel(metric) + ' 구성'}>
    <h3>{label}{result.date && <> <time dateTime={result.date}>{result.date}</time></>}</h3>
    <MetricCalculation metric={metric} result={result} first={first} second={second} approximate={approximate} estimate={calculation?.estimate} />
    {calculation?.estimate && <p className={styles.calculationEstimate}>공개 {detailMetricLabel(metric)} {result.display}</p>}
    {price.note}
  </section>;
}

export function ValuationSummary({ metric, security, previous, scope, quoteChange }: {
  metric: ValuationOverviewMetric; security: ScopedSecurity; previous: ValuationObservation | null; scope: Scope;
  quoteChange?: ReactNode;
}) {
  const related = valuationInput[metric];
  const resultUnit = DETAIL_METRICS[metric].unit;
  const inputUnit = DETAIL_METRICS[related].unit;
  const second = (metric === 'eps' || metric === 'bps') && (security.historicalPeriod || !metricAvailable(security, related))
    ? { value: null, date: null } : securityValue(security, related);
  const price = securityValue(security, 'price');
  const relatedCell = (observation: typeof second, unit: string, key?: DetailMetric): Cell => {
    const cell = investorNumCell(observation.value, unit, observation.date);
    return observation.value == null || key && !metricAvailable(security, key) ? cell : { ...cell, display: <Link prefetch={false}
      href={detailHref(securityPath(security, key), scope)}>{cell.display}</Link> };
  };
  const current = securityValue(security, metric);
  const result = investorNumCell(current.value, resultUnit, current.date);
  const label = detailMetricLabel(metric);
  return <>
    <div className={styles.valuationHeading}>
      <h2>현재와 1년 전 {label}</h2>
      <div className={styles.valuationHelp}>
        <DetailRecordInfo {...valuationHelp[metric]} />
      </div>
    </div>
    <div className={styles.valuationPeriods}>
      <ValuationPeriod metric={metric} label="현재" result={result}
        price={{ ...relatedCell(price, '원'), note: quoteChange }} input={relatedCell(second, inputUnit, related)} />
      {previous ? <ValuationPeriod metric={metric} label="1년 전" result={investorNumCell(previous.metric, resultUnit, previous.date)}
        price={investorNumCell(previous.price, '원', previous.date)} input={investorNumCell(previous.related, inputUnit, previous.date)} />
        : <section className={styles.valuationPeriod} aria-label={'1년 전 ' + label + ' 구성'}>
          <h3>1년 전</h3><p className={styles.valuationPeriodMissing}>비교할 관측값이 없습니다.</p>
        </section>}
    </div>
  </>;
}

export function companyMetricLinks(members: DetailSecurityRow[], scope: Scope) {
  return (['per', 'pbr'] as const).flatMap(metric => {
    const member = members.find(row => metricAvailable(row, metric));
    if (!member) return [];
    return [{ metric, member, value: securityValue(member, metric),
      href: detailHref(securityPath(member, metric), { start: scope.start, end: scope.end }) }];
  });
}
