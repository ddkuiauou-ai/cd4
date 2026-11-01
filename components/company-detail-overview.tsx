import Link from 'next/link';
import { compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, type BusinessValue } from '@/lib/business-analysis';
import { prepareDetailComparison } from '@/lib/detail-comparison';
import { securityPath } from '@/lib/entity-paths';
import type { DetailCompanyView, DetailSecurityRow } from './detail-types';

type CompanyOverviewProps = { company: DetailCompanyView | null; members: DetailSecurityRow[] };
type CompanyRanking = { currentRank: number | null; rankDate?: string | null; exclusionReason?: string | null } | null;
const nameOf = (member: DetailSecurityRow) => member.korName || member.name || member.ticker || '이름 미등록';
const dayOf = (value: Date | string | null | undefined) => value instanceof Date
  ? Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null
  : typeof value === 'string' && isBusinessDay(value) ? value : null;
const nonnegative = (value: BusinessValue | undefined): BusinessValue =>
  value != null && (compareBusinessValues(value, 0) ?? -1) >= 0 ? value : null;
const amount = (value: BusinessValue, compact = false) => value == null ? '—'
  : `${compact ? formatCompactBusinessValue(value).replace(/^(-?\d+(?:\.\d+)?)/, value => formatBusinessValue(value)) : formatBusinessValue(value)}원`;

/** Preserve concrete identities and enrich the official snapshot with the separately supplied quotes. */
function companyMembers(company: DetailCompanyView | null, members: DetailSecurityRow[]): DetailSecurityRow[] {
  const official = company?.securities ?? [];
  return [...official.flatMap<DetailSecurityRow>(member => {
    const enriched = members.filter(row => row.securityId === member.securityId);
    return enriched.length ? enriched.map(row => ({ ...member, ...row })) : [member];
  }), ...members.filter(member => !official.some(row => row.securityId === member.securityId))];
}
function uniqueMembers(members: DetailSecurityRow[]) {
  return [...new Map(members.map(member => [member.securityId, member])).values()];
}
function latestQuote(member: DetailSecurityRow) {
  const records = member.prices ?? [];
  if (records.some(row => !dayOf(row.date))) return { date: null, close: null, rate: null };
  const date = records.reduce<string | null>((latest, row) => {
    const day = dayOf(row.date);
    return day && (!latest || day > latest) ? day : latest;
  }, null);
  const latest = records.filter(row => dayOf(row.date) === date);
  const close = nonnegative(latest[0]?.close);
  if (close == null || !latest.every(row => compareBusinessValues(row.close, close) === 0)) return { date, close: null, rate: null };
  const rate = latest[0]?.rate;
  return { date, close, rate: rate != null && Number.isFinite(rate) && latest.every(row => row.rate === rate) ? rate : null };
}
function websiteOf(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    const url = new URL(/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw) ? `https://${raw}` : raw);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url : null;
  } catch { return null; }
}

export function CompanyProfile({ company, members }: CompanyOverviewProps) {
  const corporation = company?.company;
  const name = company?.companyKorName || corporation?.korName || company?.companyName || corporation?.name || '—';
  const english = corporation?.name?.trim();
  const englishName = english && english.toLocaleLowerCase() !== name.trim().toLocaleLowerCase() ? english : '—';
  const homepage = websiteOf(corporation?.homepage);
  const rows = uniqueMembers(companyMembers(company, members));
  const types = new Map<string, number>();
  for (const row of rows) types.set(row.type || '구분 미등록', (types.get(row.type || '구분 미등록') ?? 0) + 1);
  const exchanges = [...new Set(rows.map(row => row.exchange).filter(Boolean))];
  return <section id="company-information" className="detail-company-profile">
    <header className="detail-company-section-heading"><h2>기업 정보</h2>{exchanges.length > 0 && <small>{exchanges.join(' · ')}</small>}</header>
    <table className="detail-company-profile-table"><caption className="sr-only">{name} 기업 정보</caption><tbody>
      <tr><th scope="row">기업명</th><td>{name}</td></tr>
      <tr><th scope="row">영문명</th><td>{englishName}</td></tr>
      <tr><th scope="row">업종</th><td>{corporation?.industry || '—'}</td></tr>
      <tr><th scope="row">설립일</th><td>{dayOf(corporation?.establishedDate) || '—'}</td></tr>
      <tr><th scope="row">홈페이지</th><td>{homepage ? <a href={homepage.href} target="_blank" rel="noopener noreferrer">{homepage.host}{homepage.pathname === '/' ? '' : homepage.pathname}</a> : '—'}</td></tr>
    </tbody></table>
    <p className="detail-company-note detail-company-profile-note">확인되지 않은 기업 정보는 —로 표시합니다.</p>
    <div className="detail-company-scope"><span>구성 종목 <strong>{rows.length}개</strong></span>{types.size > 0 && <span>{[...types].map(([type, count]) => `${type} ${count}`).join(' · ')}</span>}</div>
  </section>;
}

export function CompanyMarketcapOverview({ company, members, ranking }: CompanyOverviewProps & { ranking: CompanyRanking }) {
  const officialIds = new Set(company?.securities.map(member => member.securityId));
  const rows = companyMembers(company, members).filter(member => officialIds.has(member.securityId));
  const { composition } = prepareDetailComparison(company, rows);
  const current = company?.state === 'published' ? nonnegative(company.totalMarketcap) : null;
  const rank = company?.state === 'published' && ranking?.currentRank != null && Number.isInteger(ranking.currentRank) && ranking.currentRank > 0 ? ranking.currentRank : null;
  const currentDate = dayOf(company?.totalMarketcapDate);
  const rankDate = dayOf(ranking?.rankDate);
  const compact = amount(current, true).match(/^([\d,.-]+)(.*)$/);
  const stateLabels: Record<string, string> = { provided: '제공됨', source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음', missing_input: '합산 자료가 부족합니다.' };
  const exclusion = ranking?.exclusionReason;
  const exclusionLabel = exclusion ? stateLabels[exclusion] || (/^[a-z][a-z0-9_]*$/.test(exclusion) ? '순위 산정 기준을 충족하지 않습니다.' : exclusion) : null;
  const currentStatus = current != null ? null : company?.state === 'unpublished' ? '아직 공개된 기업 합산값이 없습니다.'
    : company?.marketcapCompleteness === 'missing_input' ? '합산 자료가 부족합니다.' : '합산 근거를 확인 중입니다.';
  return <section id="current-overview" className="detail-company-cap">
    <header className="detail-company-section-heading"><h2>기업 합산 시가총액</h2></header>
    <div className="detail-company-cap-values">
      <div className="detail-company-cap-value" title={amount(current)}>{compact ? <>{compact[1]}<span>{compact[2]}</span></> : '—'}</div>
      <div className="detail-company-cap-rank"><strong>{rank == null ? '—' : `${rank}위`}</strong><small>기업 시가총액 순위</small></div>
    </div>
    <p className="detail-company-note detail-company-cap-basis">{currentDate && rankDate === currentDate
      ? `시가총액 · 순위 기준 ${currentDate}` : `시가총액 기준 ${currentDate || '—'} · 순위 기준 ${rankDate || '—'}`}</p>
    {currentStatus && <p role="status" className="detail-company-note">{currentStatus}</p>}
    {exclusionLabel && exclusionLabel !== currentStatus && <p className="detail-company-note">{exclusionLabel}</p>}
    <div className="detail-company-composition">
      <div className="detail-company-composition-head"><h3>합산 구성 비중</h3><span className="detail-company-note">{composition.rows.length}개 종목</span></div>
      {composition.complete && <div className="detail-company-composition-track" role="img" aria-label={composition.rows.map(row => `${row.name} ${formatBusinessValue(row.percentage)}%`).join(', ')}>
        {composition.rows.map(row => <span key={row.securityId} className="detail-company-composition-segment" data-series={row.type === '보통주' ? 'common' : row.type?.includes('우선주') ? 'preferred' : 'other'} style={{ flexGrow: Number(row.percentage), flexBasis: 0 }} />)}
      </div>}
      <dl className="detail-company-composition-legend">{composition.rows.map(row => <div key={row.securityId}>
        <dt><i aria-hidden="true" data-series={row.type === '보통주' ? 'common' : row.type?.includes('우선주') ? 'preferred' : 'other'} />{composition.rows.filter(item => item.type === row.type).length === 1 ? row.type || row.name : row.name}</dt>
        <dd>{row.percentage == null ? '—' : `${formatBusinessValue(row.percentage)}%`}</dd>
      </div>)}</dl>
      {composition.reason && <p className="detail-company-note">{composition.reason}</p>}
    </div>
  </section>;
}

export function CompanyConstituents({ company, members, basic, start, end }: CompanyOverviewProps & { basic: boolean; start?: string; end?: string }) {
  const currentMembers = companyMembers(company, members);
  const rows = uniqueMembers(currentMembers);
  const { composition, priceComparisons } = prepareDetailComparison(company, currentMembers);
  const quotes = new Map(rows.map(member => [member.securityId, latestQuote(member)]));
  const dates = new Set([...quotes.values()].map(quote => quote.close != null ? quote.date : null));
  const sharedDate = dates.size === 1 ? [...dates][0] : null;
  const current = company?.state === 'published' ? nonnegative(company.totalMarketcap) : null;
  return <section id="securities-summary" className="detail-company-constituents">
    <header className="detail-company-section-heading"><h2>같은 기업의 종목 비교</h2></header>
    {rows.length ? <table className="detail-company-table"><caption className="sr-only">같은 기업의 구성 종목별 시가총액과 주가</caption>
      <thead><tr><th scope="col">종목</th><th scope="col">시가총액</th><th scope="col">주가 · 전일 대비</th></tr></thead>
      <tbody>{rows.map(member => {
        const quote = quotes.get(member.securityId)!;
        const official = company?.securities.find(row => row.securityId === member.securityId);
        const value = nonnegative(official ? official.marketcap : member.marketcap);
        const valueDate = dayOf(official ? official.marketcapDate : member.marketcapDate);
        const query = new URLSearchParams();
        if (start) query.set('start', start);
        if (end) query.set('end', end);
        const path = securityPath(member, basic ? undefined : 'marketcap');
        return <tr key={member.securityId}>
          <th scope="row"><Link prefetch={false} href={query.size ? `${path}?${query}` : path}>{nameOf(member)}</Link><small>{member.type || '종목'} · {member.ticker || '코드 미등록'}</small></th>
          <td title={`${amount(value)} · 시가총액 기준 ${valueDate || '—'}`}>{amount(value, true)}{valueDate !== composition.date && <small>{valueDate || '기준일 미등록'}</small>}</td>
          <td title={`주가 기준 ${quote.date || '—'}`}>{amount(quote.close)}<small className={quote.rate == null || quote.rate === 0 ? '' : quote.rate > 0 ? 'market-up' : 'market-down'}>{quote.rate == null ? '—' : `${quote.rate > 0 ? '+' : ''}${quote.rate.toFixed(2)}%`}</small>{!sharedDate && <small>{quote.date || '기준일 미등록'}</small>}</td>
        </tr>;
      })}<tr className="detail-company-total"><th scope="row">기업 전체(합산)</th><td title={amount(current)}><strong>{amount(current, true)}</strong></td><td>{rows.length}개 종목</td></tr></tbody>
    </table> : <p className="detail-company-note">등록된 구성 종목이 없습니다.</p>}
    {priceComparisons.map(row => <div className="detail-company-price-gap" key={row.securityId}>
      <span>{priceComparisons.length === 1 ? '보통주·우선주 가격 차이' : `${row.name} 가격 차이`}</span>
      <strong>{row.direction ? <>{amount(row.difference)} <small>({formatBusinessValue(row.percent)}%)</small></> : '—'}</strong>
    </div>)}
    <p className="detail-company-note detail-company-comparison-basis">시가총액 기준 {composition.date || '—'}{sharedDate ? ` · 주가 ${sharedDate} 종가 기준` : ' · 주가 기준일은 각 종목에 표시'}</p>
    <details className="detail-company-disclosure"><summary>합산과 가격 차이의 기준</summary>
      {priceComparisons.map(row => <p key={row.securityId}>{row.direction ? <>{row.direction === 'same' ? `${row.name}와 ${row.commonName}의 가격이 같습니다.` : `${row.name} 가격이 ${row.commonName}보다 ${amount(row.difference)} ${row.direction === 'lower' ? '낮습니다.' : '높습니다.'}`} {row.date} 종가 기준입니다.</> : <>{row.name}: {row.reason}</>}</p>)}
      {priceComparisons.length > 0 && <p>차이율 = |우선주 − 보통주| ÷ 보통주 × 100 · 같은 거래일의 유효한 종가로 계산합니다.</p>}
      <p>시가총액은 기업 합산 기준일의 구성 종목 공개값입니다. 주가와 전일 대비는 각 종목의 마지막 거래 기록입니다. 반올림한 종목 표시값의 합은 기업 합산 표시값과 다를 수 있습니다.</p>
      {composition.reason && <p>{composition.reason}</p>}
    </details>
  </section>;
}
