import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { companyPath, securityPath } from '@/lib/entity-paths';
import { formatCompactBusinessValue } from '@/lib/business-analysis';
import { DETAIL_METRICS, sourceValue, type DetailMetric } from '@/lib/detail-presentation';
import type { DetailCompanyData, DetailSecurityRow } from './detail-types';

interface DetailEntitySelectorProps {
  company: DetailCompanyData;
  companySecs: DetailSecurityRow[];
  security: DetailSecurityRow | null;
  companyPage: boolean;
  basic: boolean;
  metric: DetailMetric;
  start?: string;
  end?: string;
  periodId?: string;
}

/** Keep the complete, concrete membership visible; names and tickers are not identities. */
export function detailEntityMembers(company: DetailCompanyData, companySecs: DetailSecurityRow[], security: DetailSecurityRow | null) {
  const members = new Map<string, DetailSecurityRow>();
  for (const row of company?.securities ?? []) members.set(row.securityId, row);
  for (const row of companySecs) members.set(row.securityId, { ...members.get(row.securityId), ...row });
  if (security && !members.has(security.securityId)) members.set(security.securityId, security);
  return [...members.values()].sort((a, b) => Number(b.type === '보통주') - Number(a.type === '보통주'));
}

function rangeHref(path: string, start?: string, end?: string, periodId?: string) {
  const query = new URLSearchParams();
  if (start) query.set('start', start);
  if (end) query.set('end', end);
  if (periodId) query.set('period', periodId);
  return query.size ? `${path}?${query}` : path;
}

const marketcapText = (value: unknown) => {
  const supplied = sourceValue(value);
  return supplied == null ? '—' : `${formatCompactBusinessValue(supplied)}원`;
};

export function DetailEntitySelector({ company, companySecs, security, companyPage, basic, metric, start, end, periodId }: DetailEntitySelectorProps) {
  const members = detailEntityMembers(company, companySecs, security);
  if (!company && !members.length) return null;
  const targetMetric = basic ? undefined : metric;
  const action = basic ? '기본 정보 보기' : `${DETAIL_METRICS[metric].label} 보기`;
  return <section id="entity-selection" className="detail-entity-section" aria-labelledby="detail-entity-heading">
    <h2 id="detail-entity-heading">{company ? '기업 전체와 구성 종목' : '종목 선택'}</h2>
    <nav className="detail-entity-grid" aria-label="기업 전체와 구성 종목 선택">
      {company && <Link prefetch={false} href={rangeHref(companyPath(company, companyPage && basic ? undefined : 'marketcap'), start, end)}
        className="detail-entity-link detail-entity-aggregate" aria-current={companyPage ? 'page' : undefined}>
        <span className="detail-entity-name">기업 전체(합산){companyPage && <span className="detail-entity-current">현재</span>}</span>
        <span className="detail-entity-meta">{members.length ? `${members.length}개 구성 종목` : '구성 종목 정보 없음'}</span>
        <span className="detail-entity-value">{marketcapText(company.state === 'published' ? company.totalMarketcap : null)}<span className="detail-entity-action">{companyPage && basic ? '기업 정보 보기' : '기업 시총 보기'}</span></span>
        <ChevronRight className="detail-entity-chevron" aria-hidden="true" />
      </Link>}
      {members.map(member => {
        const selected = !companyPage && member.securityId === security?.securityId;
        // A listing episode belongs to one security, so never carry it to a sibling.
        const href = rangeHref(securityPath(member, targetMetric), start, end, selected ? periodId : undefined);
        return <Link key={member.securityId} prefetch={false} href={href} className="detail-entity-link"
          aria-current={selected ? 'page' : undefined} data-security-id={member.securityId}>
          <span className="detail-entity-name">{member.korName || member.name || '이름 미등록'}{selected && <span className="detail-entity-current">현재</span>}</span>
          <span className="detail-entity-meta">{member.type || '종목'} · {member.ticker || '코드 미등록'}</span>
          <span className="detail-entity-value">{marketcapText(member.marketcap)}<span className="detail-entity-action">{action}</span></span>
          <ChevronRight className="detail-entity-chevron" aria-hidden="true" />
        </Link>;
      })}
    </nav>
  </section>;
}
