import Link from 'next/link';
import type { ReactNode } from 'react';
import { compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, subtractBusinessValues, type BusinessValue } from '@/lib/business-analysis';
import { businessDate } from '@/lib/data/dto';
import { DETAIL_METRICS, earlierDate, sourceValue, type DetailMetric } from '@/lib/detail-presentation';
import { companyPath, securityPath } from '@/lib/entity-paths';
import type { DetailNavItem } from './detail-investor-navigation';
import type { DetailCompanyView, DetailSecurityRow } from './detail-types';
import { CsvDownloadButton } from './CsvDownloadButton';

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
  const companyLinks = company ? [
    { label: '기업 정보', href: detailHref(companyPath(company), range), selected: companyPage && basic },
    { label: '기업 합산 시총', href: detailHref(companyPath(company, 'marketcap'), range), selected: companyPage && !basic },
  ] : [];
  if (!security) return [companyLinks];
  const target = companyPage ? securityName(security) + (security.ticker ? ' · ' + security.ticker : '') : undefined;
  const item = (key?: DetailMetric) => ({
    label: key === 'marketcap' ? '종목 시가총액' : key ? detailMetricLabel(key) : '종목 기본 정보',
    href: detailHref(securityPath(security, key), { ...range, periodId: companyPage ? undefined : periodId }),
    selected: !companyPage && (key ? !basic && metric === key : basic),
    target,
  });
  const financial = (['per', 'pbr', 'eps', 'bps'] as const).filter(key => metricAvailable(security, key)).map(item);
  const dividend = (['dps', 'div'] as const).filter(key => metricAvailable(security, key)).map(item);
  return [companyLinks, [...(metricAvailable(security, 'marketcap') ? [item('marketcap')] : []), item()], financial, dividend];
}

export function StockSelection({ members, current, label, metric, scope }: {
  members: DetailSecurityRow[]; current: DetailSecurityRow; label: string; metric?: DetailMetric; scope: Scope;
}) {
  return <nav className="investor-stock-selection" aria-label={label}>
    <span>{label}</span>
    {members.map(member => {
      const selected = member.securityId === current.securityId;
      if (metric && !selected && !metricAvailable(member, metric)) return null;
      const { periodId, ...range } = scope;
      return <Link key={member.securityId} prefetch={false} aria-current={selected ? 'page' : undefined}
        href={detailHref(securityPath(member, metric), { ...range, periodId: selected ? periodId : undefined })}>
        {securityName(member)}<small>{member.ticker}</small>
      </Link>;
    })}
  </nav>;
}

type Cell = { value: string | number | null; display?: ReactNode; date?: string | null };
type TableRow = { key: string; cells: Cell[]; selected?: boolean; difference?: boolean };
const numCell = (value: BusinessValue, unit: string, date?: string | null, compact = false): Cell => ({ value, date,
  display: value == null ? '—' : <span title={detailValue(value, unit)}>{detailValue(value, unit, compact)}</span> });

export function InvestorTable({ columns, rows, label, emphasized, basis }: {
  columns: string[]; rows: TableRow[]; label: string; emphasized?: number; basis?: string | null;
}) {
  return <div className="detail-table-scroll"><table className="investor-table">
    <caption className="sr-only">{label}</caption>
    <thead><tr>{columns.map((column, index) => <th key={column} scope="col" data-emphasis={index === emphasized || undefined}>{column}</th>)}</tr></thead>
    <tbody>{rows.map(({ key, cells, selected, difference }) => <tr key={key} data-selected={selected || undefined} data-difference={difference || undefined}>
      {cells.map(({ value, display, date }, index) => {
        const CellElement = index === 0 ? 'th' : 'td';
        return <CellElement key={columns[index]} scope={index === 0 ? 'row' : undefined} data-emphasis={index === emphasized || undefined}>
          {display ?? value ?? '—'}{date && date !== basis && <small>{date}</small>}
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

export function ConstituentsTable({ members, current, scope, csvStem, company, showCsv, basis }: {
  members: DetailSecurityRow[]; current?: string; scope: Scope; csvStem: string; company?: DetailCompanyView | null; showCsv?: boolean; basis?: string | null;
}) {
  const label = '구성 종목 비교';
  const columns = ['종목', '종목코드', '시가총액(원)', '종가(원)'];
  const range = { start: scope.start, end: scope.end };
  const rows = members.map(member => {
    const name = securityName(member);
    const periodId = member.securityId === current ? scope.periodId : undefined;
    const included = company?.securities.find(row => row.securityId === member.securityId);
    const cap = included ? {
      value: company?.state === 'published' ? included.marketcap : null,
      date: company?.state === 'published' ? detailDay(included.marketcapDate) : null,
    } : securityValue(member, 'marketcap');
    const price = memberPrice(member);
    const amount = (value: BusinessValue, date: string | null, metric?: DetailMetric) => ({
      ...numCell(value, '원', date, metric === 'marketcap'),
      display: value == null ? '—' : <Link prefetch={false} href={detailHref(securityPath(member, metric), { ...range, periodId })}
        title={detailValue(value, '원')} aria-label={name + ' ' + (metric ? '시가총액' : '종가') + ' ' + detailValue(value, '원')}>
        {detailValue(value, '원', metric === 'marketcap')}
      </Link>,
    });
    return { key: member.securityId, selected: member.securityId === current, cells: [
      { value: name, display: <>{name}{member.type && <small>{member.type}</small>}</> },
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

export function DividendTable({ members, securityId, metric, csvStem, scope, basis }: {
  members: DetailSecurityRow[]; securityId?: string; metric?: 'dps' | 'div'; csvStem?: string; scope: Scope; basis?: string | null;
}) {
  const columns = ['종목', '주당배당금(원)', '배당수익률(%)', '종가(원)'];
  const rows: TableRow[] = members.map(member => {
    const key = member.securityId;
    const name = securityName(member);
    const dps = securityValue(member, 'dps');
    const div = securityValue(member, 'div');
    const price = memberPrice(member);
    const target = detailHref(securityPath(member), { ...scope, periodId: key === securityId ? scope.periodId : undefined });
    return { key, selected: key === securityId, cells: [
      { value: name, display: <>{name}{member.ticker && <small>{member.ticker}</small>}</> },
      numCell(dps.value, '원', dps.date), numCell(div.value, '%', div.date),
      { ...numCell(price.value, '원', price.date), display: price.value == null ? '—'
        : <Link prefetch={false} href={target} aria-label={name + ' 종가 ' + detailValue(price.value, '원')}>{detailValue(price.value, '원')}</Link> },
    ] };
  });
  const common = members.filter(member => member.type === '보통주');
  if (common.length === 1) {
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
        return { value, display: value == null ? '—' : (compareBusinessValues(value, 0) === 1 ? '+' : '') + detailValue(value, unit) };
      });
      rows.push({ key: 'difference-' + member.securityId, difference: true, cells: [{ value: label }, ...differences] });
    }
  }

  return <>
    {metric && csvStem && rows.length > 0 && <div className="investor-record-actions">
      <CsvDownloadButton key={csvStem + metric} data={comparisonCsv(columns, rows)} filename={csvStem + '-dividend-comparison-' + metric + '.csv'} label="배당 비교표 CSV" />
    </div>}
    {rows.length > 0 ? <InvestorTable label="구성 종목 배당 비교" columns={columns} rows={rows} basis={basis} emphasized={metric === 'dps' ? 1 : metric === 'div' ? 2 : undefined} />
      : <p className="investor-muted">확인된 배당 비교 종목이 없습니다.</p>}
    {rows.some(row => row.difference) && <p className="investor-muted">차이는 같은 날에 관측한 값으로 계산합니다. 배당수익률의 차이 단위는 %p입니다.</p>}
  </>;
}

export type ValuationObservation = { date: string; metric: BusinessValue; related: BusinessValue; price: BusinessValue };

export function valuationReference({ metric, currentDate, sourceHistory, prices }: {
  metric: 'per' | 'pbr'; currentDate: string | null; sourceHistory: Record<string, unknown>[]; prices: Record<string, unknown>[];
}): ValuationObservation | null {
  if (!currentDate) return null;
  const target = earlierDate(currentDate, 12);
  const related = metric === 'per' ? 'eps' : 'bps';
  const priceByDay = new Map(prices.flatMap(row => typeof row.date === 'string' ? [[row.date, row] as const] : []));
  let observation: ValuationObservation | null = null;
  for (const row of sourceHistory) {
    const date = detailDay(row.date);
    if (!date || date > target || observation && date <= observation.date) continue;
    const value = fieldValue(row, metric);
    const book = fieldValue(row, related);
    const price = fieldValue(priceByDay.get(date), 'close');
    if (value != null && book != null && price != null) observation = { date, metric: value, related: book, price };
  }
  return observation;
}

export function ValuationSummary({ metric, security, previous, scope, basis }: {
  metric: 'per' | 'pbr'; security: DetailSecurityRow; previous: ValuationObservation | null; scope: Scope; basis?: string | null;
}) {
  const related = metric === 'per' ? 'eps' : 'bps';
  const main = securityValue(security, metric);
  const second = securityValue(security, related);
  const price = securityValue(security, 'price');
  const relatedCell = (observation: typeof second, key?: DetailMetric): Cell => {
    const cell = numCell(observation.value, '원', observation.date);
    return observation.value == null ? cell : { ...cell, display: <Link prefetch={false}
      href={detailHref(securityPath(security, key), scope)}>{detailValue(observation.value, '원')}</Link> };
  };
  const rows = [
    { key: 'current', cells: [
      { value: '현재' },
      { ...numCell(main.value, '배', main.date), display: <strong className="investor-primary-value">{detailValue(main.value, '배')}</strong> },
      relatedCell(second, related), relatedCell(price),
    ] },
    { key: 'prior', cells: [
      { value: '1년 전 기준', date: previous?.date },
      numCell(previous?.metric ?? null, '배'), numCell(previous?.related ?? null, '원'), numCell(previous?.price ?? null, '원'),
    ] },
  ];
  return <>
    <InvestorTable label={metric.toUpperCase() + ' 현재와 1년 전 비교'} columns={['비교 시점', detailMetricLabel(metric), detailMetricLabel(related), '종가']} rows={rows} emphasized={1} basis={basis} />
    {!previous && <p className="investor-muted">1년 전 기준으로 같은 날의 세 값이 확인되지 않았습니다.</p>}
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
