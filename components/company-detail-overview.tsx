import { compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, type BusinessValue } from '@/lib/business-analysis';
import { prepareDetailComparison } from '@/lib/detail-comparison';
import type { DetailCompanyView, DetailSecurityRow } from './detail-types';

type CompanyOverviewProps = { company: DetailCompanyView | null; members: DetailSecurityRow[] };
type CompanyRanking = { currentRank: number | null; rankDate?: string | null; exclusionReason?: string | null } | null;
type CompanyComposition = ReturnType<typeof prepareDetailComparison>['composition'];
const compositionSeries = (type: string | null) => type === '보통주' ? 'common' : type?.includes('우선주') ? 'preferred' : 'other';
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
function websiteOf(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    const url = new URL(/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw) ? `https://${raw}` : raw);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url : null;
  } catch { return null; }
}

export function CompanyProfile({ company, members, title = '기업 정보' }: CompanyOverviewProps & { title?: string }) {
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
    <header className="detail-company-section-heading"><h2>{title}</h2>{exchanges.length > 0 && <small>{exchanges.join(' · ')}</small>}</header>
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

function CompanyCompositionTrack({ composition }: { composition: CompanyComposition }) {
  if (!composition.complete) return null;
  return <div className="detail-company-composition-track" role="img"
    aria-label={composition.rows.map(row => `${row.name} ${formatBusinessValue(row.percentage)}%`).join(', ')}>
    {composition.rows.map(row => <span key={row.securityId} className="detail-company-composition-segment" data-series={compositionSeries(row.type)}
      style={{ flexGrow: Number(row.percentage), flexBasis: 0 }} />)}
  </div>;
}

export function CompanyMarketcapOverview({ company, members, ranking, basis }: CompanyOverviewProps & {
  ranking: CompanyRanking; basis?: string | null;
}) {
  const officialIds = new Set(company?.securities.map(member => member.securityId));
  const composition = prepareDetailComparison(company,
    companyMembers(company, members).filter(member => officialIds.has(member.securityId))).composition;
  const current = company?.state === 'published' ? nonnegative(company.totalMarketcap) : null;
  const rank = company?.state === 'published' && ranking?.currentRank != null && Number.isInteger(ranking.currentRank) && ranking.currentRank > 0 ? ranking.currentRank : null;
  const currentDate = dayOf(company?.totalMarketcapDate);
  const rankDate = dayOf(ranking?.rankDate);
  const dates = currentDate && rankDate === currentDate
    ? currentDate === basis ? [] : [`시가총액 · 순위 기준 ${currentDate}`]
    : [currentDate !== basis ? `시가총액 기준 ${currentDate || '—'}` : null, rankDate !== basis ? `순위 기준 ${rankDate || '—'}` : null].filter(Boolean);
  const compact = amount(current, true).match(/^([\d,.-]+)(.*)$/);
  const stateLabels: Record<string, string> = { provided: '제공됨', source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음', missing_input: '합산 자료가 부족합니다.' };
  const exclusion = ranking?.exclusionReason;
  const exclusionLabel = exclusion ? stateLabels[exclusion] || (/^[a-z][a-z0-9_]*$/.test(exclusion) ? '순위 산정 기준을 충족하지 않습니다.' : exclusion) : null;
  const currentStatus = current != null ? null : company?.state === 'unpublished' ? '아직 공개된 기업 합산값이 없습니다.'
    : company?.marketcapCompleteness === 'missing_input' ? '합산 자료가 부족합니다.' : '합산 근거를 확인 중입니다.';
  return <section id="current-overview" className="detail-company-cap">
    <header className="detail-company-section-heading"><h2>기업 합산 시가총액</h2></header>
    <div className="detail-company-cap-values">
      <div className="detail-company-cap-value" title={amount(current)}>{compact
        ? <>{compact[1]}<span>{compact[2]}</span></> : '—'}</div>
      <div className="detail-company-cap-rank"><strong>{rank == null ? '—' : `${rank}위`}</strong><small>기업 시가총액 순위</small></div>
    </div>
    {dates.length > 0 && <p className="detail-company-note detail-company-cap-basis">{dates.join(' · ')}</p>}
    {currentStatus && <p role="status" className="detail-company-note">{currentStatus}</p>}
    {exclusionLabel && exclusionLabel !== currentStatus && <p className="detail-company-note">{exclusionLabel}</p>}
    <div className="detail-company-composition">
      <div className="detail-company-composition-head"><h3>합산 구성 비중</h3><span className="detail-company-note">{composition.rows.length}개 종목</span></div>
      <CompanyCompositionTrack composition={composition} />
      <dl className="detail-company-composition-legend">{composition.rows.map(row => <div key={row.securityId}>
        <dt><i aria-hidden="true" data-series={compositionSeries(row.type)} />{composition.rows.filter(item => item.type === row.type).length === 1 ? row.type || row.name : row.name}</dt>
        <dd>{row.percentage == null ? '—' : `${formatBusinessValue(row.percentage)}%`}</dd>
      </div>)}</dl>
      {composition.reason && <p className="detail-company-note">{composition.reason}</p>}
    </div>
  </section>;
}
