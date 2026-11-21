import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatInvestorAmount, usesInvestorPrecision } from '@/lib/investor-number';
import { compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, subtractBusinessValues, type BusinessValue } from '@/lib/business-analysis';
import { businessDate } from '@/lib/data/dto';
import { DETAIL_METRICS, earlierDate, sourceValue, type DetailAnnualRow, type DetailMetric } from '@/lib/detail-presentation';
import { companyPath, securityPath } from '@/lib/entity-paths';
import { DetailSwitchLink, type DetailNavItem, type DetailSwitchCandidate } from './detail-investor-navigation';
import { DetailSecurityCard } from './detail-security-card';
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
  const companyLinks = company ? [
    { label: '기업 개요', href: detailHref(companyPath(company), range), selected: companyPage && basic },
  ] : [];
  if (company && (companyPage || !security)) {
    companyLinks.push({
      label: '시가총액', href: detailHref(companyPath(company, 'marketcap'), range), selected: companyPage && !basic,
    });
  }
  if (!security) return [companyLinks];
  const target = companyPage ? securityName(security) + (security.ticker ? ' · ' + security.ticker : '') : undefined;
  const item = (key?: DetailMetric) => ({
    label: key ? detailMetricLabel(key) : '주가·거래',
    href: detailHref(securityPath(security, key), { ...range, periodId: companyPage ? undefined : periodId }),
    selected: !companyPage && (key ? !basic && metric === key : basic),
    target,
  });
  if (!companyPage && metricAvailable(security, 'marketcap')) companyLinks.push(item('marketcap'));
  const financial = (['per', 'pbr', 'eps', 'bps'] as const).filter(key => metricAvailable(security, key)).map(item);
  const dividend = (['dps', 'div'] as const).filter(key => metricAvailable(security, key)).map(item);
  return [companyLinks, [item()], financial, dividend];
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
    const href = available ? detailHref(securityPath(member, basic ? undefined : metric), {
      ...scope, periodId: selected ? scope.periodId : undefined,
    }) : undefined;
    return {
      securityId: member.securityId, name: securityName(member), ticker: member.ticker, type: member.type, selected,
      href, value: !basic && usesInvestorPrecision(metric) ? formatInvestorAmount(observation.value, info.unit)
        : detailValue(observation.value, info.unit, !basic && metric === 'marketcap'),
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

export function InvestorTable({ columns, rows, label, emphasized, basis, columnDates }: {
  columns: string[]; rows: TableRow[]; label: string; emphasized?: number; basis?: string | null; columnDates?: Record<number, string>;
}) {
  return <div className="detail-table-scroll"><table className="investor-table">
    <caption className="sr-only">{label}</caption>
    <thead><tr>{columns.map((column, index) => <th key={column} scope="col" data-emphasis={index === emphasized || undefined}>
      {column}{columnDates?.[index] && <small><time dateTime={columnDates[index]}>{columnDates[index]}</time></small>}
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
      display: value == null ? '—' : <Link prefetch={false} href={detailHref(securityPath(member, metric), range)}
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

export function DividendTable({ members, securityId, metric, csvStem, scope, basis, candidates }: {
  members: DetailSecurityRow[]; securityId?: string; metric?: 'dps' | 'div'; csvStem?: string; scope: Scope; basis?: string | null;
  candidates?: DetailSwitchCandidate[];
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
    const target = detailHref(securityPath(member), { ...scope, periodId: key === securityId ? scope.periodId : undefined });
    return { key, selected: key === securityId, cells: [
      { value: name, display: <>{name}{member.ticker && <small>{member.ticker}</small>}</> },
      makeCell(dps.value, '원', dps.date), makeCell(div.value, '%', div.date),
      { ...makeCell(price.value, '원', price.date), display: price.value == null ? '—'
        : <Link prefetch={false} href={target} title={detailValue(price.value, '원')} aria-label={name + ' 종가 ' + formatAmount(price.value, '원')}>{formatAmount(price.value, '원')}</Link> },
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
  const fields = ['주당배당금', '배당수익률', '종가'];
  const emphasis = metric === 'dps' ? 0 : 1;
  const comparisonRows = rows.filter(row => !row.difference);
  const comparing = comparisonRows.length > 1;
  const heading = dividendComparisonHeading(members);
  const showDates = fields.map((_, index) => comparisonRows.some(row => row.cells[index + 1].date && row.cells[index + 1].date !== basis));
  return <section id="dividend-summary" tabIndex={-1} className={styles.dividendComparison} aria-labelledby="dividend-comparison-heading">
    <header className="investor-record-heading">
      <h2 id="dividend-comparison-heading">{heading}</h2>
      {csvStem && <CsvDownloadButton key={csvStem + metric} data={comparisonCsv(columns, rows)}
        filename={csvStem + (comparing ? '-dividend-comparison-' : '-dividend-information-') + metric + '.csv'}
        label={comparing ? '배당 비교표 CSV' : '종목 배당 정보 CSV'} />}
    </header>
    <div className={styles.securityCards} data-comparing={comparing || undefined} aria-label={allowed ? '조회할 종목' : heading} role="group">
      {comparisonRows.map(row => {
        const candidate = candidateById.get(row.key);
        return <DetailSecurityCard key={row.key} candidate={candidate} name={row.cells[0].value} selectable={allowed}
          description={[candidate?.type, candidate?.ticker].filter(Boolean).join(' · ')}
          renderTarget={(target, identity, className) => <DetailSwitchLink candidate={target} className={className}>{identity}</DetailSwitchLink>}>
          <dl className={styles.values}>
            {row.cells.slice(1).map(({ value, display, date }, index) => <div key={fields[index]} data-with-date={showDates[index] || undefined}>
              <dt>{fields[index]}</dt>
              <dd data-emphasis={index === emphasis || undefined}>{display ?? value ?? '—'}
                {date && date !== basis && <small><time dateTime={date}>{date}</time></small>}
              </dd>
            </div>)}
          </dl>
        </DetailSecurityCard>;
      })}
    </div>
    {rows.filter(row => row.difference).map(row => <div key={row.key} className={styles.difference}>
      <h3>{row.cells[0].value}</h3>
      <dl>
        {row.cells.slice(1).map(({ value, display, date }, index) => <div key={fields[index]}>
          <dt>{fields[index]}</dt><dd>{display ?? value ?? '—'}{date && date !== basis && <small><time dateTime={date}>{date}</time></small>}</dd>
        </div>)}
      </dl>
    </div>)}
  </section>;
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
    if (value == null || metric === 'per' && (book == null || price == null)) continue;
    observation = { date, metric: value, related: book, price };
  }
  return observation;
}

export function ValuationSummary({ metric, security, previous, scope, basis, quoteChange }: {
  metric: 'per' | 'pbr'; security: DetailSecurityRow; previous: ValuationObservation | null; scope: Scope; basis?: string | null;
  quoteChange?: ReactNode;
}) {
  const related = metric === 'per' ? 'eps' : 'bps';
  const second = securityValue(security, related);
  const price = securityValue(security, 'price');
  const relatedCell = (observation: typeof second, key?: DetailMetric): Cell => {
    const cell = investorNumCell(observation.value, '원', observation.date);
    return observation.value == null || key && !metricAvailable(security, key) ? cell : { ...cell, display: <Link prefetch={false}
      href={detailHref(securityPath(security, key), scope)}>{cell.display}</Link> };
  };
  const rows = [
    { key: related, cells: [
      { value: detailMetricLabel(related) }, relatedCell(second, related), investorNumCell(previous?.related ?? null, '원'),
    ] },
    { key: 'price', cells: [
      { value: '종가' }, { ...relatedCell(price), note: quoteChange }, investorNumCell(previous?.price ?? null, '원'),
    ] },
  ];
  return <div className={styles.support}>
    <h2>{detailMetricLabel(metric)} 구성 지표</h2>
    <InvestorTable label={detailMetricLabel(related) + '와 종가 비교'} columns={['지표', '현재', '1년 전']} rows={rows} basis={basis}
      columnDates={previous ? { 2: previous.date } : undefined} />
  </div>;
}

export function RelatedMetricSummary({ metric, security, scope, basis, quoteChange }: {
  metric: 'per' | 'pbr'; security: DetailSecurityRow; scope: Scope; basis?: string | null; quoteChange?: ReactNode;
}) {
  const observations = [...(metricAvailable(security, metric) ? [metric] : []), 'price'] as const;
  return <dl className={styles.relatedSummary}>
    {observations.map(key => {
      const { value, date } = securityValue(security, key);
      const text = formatInvestorAmount(value, key === 'price' ? '원' : '배');
      return <div key={key}>
        <dt>{key !== 'price' && value == null
          ? <Link prefetch={false} href={detailHref(securityPath(security, key), scope)}>{detailMetricLabel(key)}</Link>
          : detailMetricLabel(key)}</dt>
        <dd>
          {value == null ? text : <Link prefetch={false}
            href={detailHref(securityPath(security, key === 'price' ? undefined : key), scope)}>{text}</Link>}
          {date && date !== basis && <small><time dateTime={date}>{date}</time></small>}
          {key === 'price' && quoteChange}
        </dd>
      </div>;
    })}
  </dl>;
}

export function companyMetricLinks(members: DetailSecurityRow[], scope: Scope) {
  return (['per', 'pbr'] as const).flatMap(metric => {
    const member = members.find(row => metricAvailable(row, metric));
    if (!member) return [];
    return [{ metric, member, value: securityValue(member, metric),
      href: detailHref(securityPath(member, metric), { start: scope.start, end: scope.end }) }];
  });
}
