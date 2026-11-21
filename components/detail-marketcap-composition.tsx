import type { ReactNode } from 'react';
import { formatBusinessValue, formatMarketcapAmount, type BusinessValue } from '@/lib/business-analysis';
import type { DetailSwitchCandidate } from './detail-investor-navigation';
import { DetailSecurityCard, SecuritySelectionCheck, type SecurityCardTarget } from './detail-security-card';
import styles from './detail-investor-summary.module.css';

export type MarketcapCompositionModel = {
  members: Array<{ candidate: DetailSwitchCandidate; amount: BusinessValue; date: string | null; percentage: string | null }>;
  aggregate: {
    candidate: DetailSwitchCandidate; amount: BusinessValue; rank: number | null;
    date: string | null; rankDate: string | null; status: string | null; exclusion: string | null;
  } | null;
  basis?: string | null;
  complete: boolean;
  reason: string | null;
};

const swatch = (type?: string | null) => type === '보통주' ? 'common' : type?.includes('우선주') ? 'preferred' : 'other';

export function MarketcapAmount({ value }: { value: BusinessValue }) {
  return value == null ? '—' : <span title={`${formatBusinessValue(value)}원`}>
    {formatMarketcapAmount(value).replace(/\s?원$/, '')}<span className={styles.marketcapUnit}>원</span>
  </span>;
}

function AmountDate({ date, basis }: { date?: string | null; basis?: string | null }) {
  return date && date !== basis ? <small><time dateTime={date}>{date}</time></small> : null;
}

function CompositionFrame({ children, memberCount, aggregate, compact, loading }: {
  children: ReactNode; memberCount: number; aggregate: ReactNode; compact?: boolean; loading?: boolean;
}) {
  return <div className={styles.marketcapComposition} data-compact={compact || undefined}
    role={loading ? undefined : 'group'} aria-label={loading ? undefined : '시가총액 구성과 조회 대상'}>
    {memberCount > 0 && <div className={styles.securityCards} data-comparing={memberCount > 1 || undefined}>{children}</div>}
    {aggregate && memberCount > 0 && <div className={styles.compositionJoin} data-columns={memberCount > 1 ? 2 : 1} aria-hidden="true">
      <i />{memberCount > 1 && memberCount % 2 === 0 && <i />}
    </div>}
    {aggregate}
  </div>;
}

function AggregateContents({ amount, rank, track, selected, compact }: {
  amount?: ReactNode; rank?: ReactNode; track?: ReactNode; selected?: boolean; compact?: boolean;
}) {
  return <>
    <span className={styles.portionTrack} aria-hidden="true">{track}</span>
    <span className={styles.aggregateFields}>
      <span className={styles.aggregateValue}><strong>{compact ? '기업 합산' : '기업 합산 시가총액'}</strong>{amount}</span>
      {rank}
      <SecuritySelectionCheck selected={selected} />
    </span>
  </>;
}

function CompositionMetrics({ amount, percentage, compact, type }: { amount?: ReactNode; percentage: ReactNode; compact?: boolean; type?: string | null }) {
  return <dl className={`${styles.values} ${styles.marketcapValues}`}>
    {!compact && <div><dt>시가총액</dt><dd data-emphasis>{amount}</dd></div>}
    <div><dt className={compact ? 'sr-only' : styles.portionLabel}>
      {!compact && <i className={styles.portionSwatch} data-series={swatch(type)} aria-hidden="true" />}
      <span>합산 </span>비중</dt><dd>{compact && <i className={styles.portionSwatch} data-series={swatch(type)} aria-hidden="true" />}{percentage}</dd></div>
  </dl>;
}

export function MarketcapComposition({ model, compact = false, renderTarget }: {
  model: MarketcapCompositionModel; compact?: boolean; renderTarget: SecurityCardTarget;
}) {
  const { members, aggregate, basis, complete, reason } = model;
  const track = complete ? members.map(({ candidate, amount, percentage }) => percentage != null &&
    <span key={candidate.securityId} data-series={swatch(candidate.type)} style={{ flexGrow: Number(amount), flexBasis: 0 }} />) : undefined;
  const aggregateTarget = aggregate && renderTarget(aggregate.candidate, <AggregateContents compact={compact} track={track} selected={aggregate.candidate.selected}
    amount={!compact && <><span className={styles.aggregateAmount}><MarketcapAmount value={aggregate.amount} /></span><AmountDate date={aggregate.date} basis={basis} /></>}
    rank={!compact && <span className={styles.aggregateRank}><span>기업 시총 순위</span>
      <strong>{aggregate.rank == null ? '—' : `${aggregate.rank.toLocaleString('ko-KR')}위`}</strong><AmountDate date={aggregate.rankDate} basis={basis} />
    </span>} />, styles.aggregateCard);
  return <>
    <CompositionFrame memberCount={members.length} aggregate={aggregateTarget} compact={compact}>
      {members.map(({ candidate, amount, date, percentage }) => {
        const duplicateType = members.some(row => row.candidate !== candidate && row.candidate.type === candidate.type);
        const compactType = candidate.type && !duplicateType ? candidate.type : candidate.name;
        return <DetailSecurityCard key={candidate.securityId} candidate={candidate} selectable renderTarget={renderTarget}
          name={compact ? <><span aria-hidden="true">{compactType}</span><span className="sr-only">{candidate.name}</span></> : candidate.name}
          description={compact && !duplicateType ? null : [candidate.type, candidate.ticker].filter(Boolean).join(' · ')}>
          <CompositionMetrics compact={compact} type={candidate.type}
            amount={<><MarketcapAmount value={amount} /><AmountDate date={date} basis={basis} /></>}
            percentage={percentage == null ? '—' : `${Number(percentage).toFixed(2)}%`} />
        </DetailSecurityCard>;
      })}
    </CompositionFrame>
    {!compact && aggregate && <>
      {aggregate.status && <p role="status" className={`investor-muted ${styles.compositionNote}`}>{aggregate.status}</p>}
      {aggregate.exclusion && aggregate.exclusion !== aggregate.status && <p className="investor-muted">{aggregate.exclusion}</p>}
      {reason && !aggregate.status && <p className={`investor-muted ${styles.compositionNote}`}>{reason}</p>}
    </>}
  </>;
}

export function MarketcapCompositionSkeleton({ placeholder, companyPage, compact = false }: {
  placeholder: (width: string, className?: string) => ReactNode; companyPage: boolean; compact?: boolean;
}) {
  return <div aria-hidden="true">
    <CompositionFrame memberCount={2} loading compact={compact} aggregate={<div className={styles.aggregateCard}>
      <AggregateContents compact={compact} amount={!compact && <span className={styles.aggregateAmount}>{placeholder('6.7em')}</span>}
        rank={!compact && <span className={styles.aggregateRank}><span>기업 시총 순위</span><strong>{placeholder('2em')}</strong></span>} />
    </div>}>
      {[0, 1].map(index => <DetailSecurityCard key={index} selectable={false} name={placeholder(compact ? '3.1em' : '4.25em')}
        description={!compact && placeholder('5.5em')}>
        <CompositionMetrics type={null} compact={compact} amount={placeholder('6.75em')} percentage={placeholder('3.3em')} />
      </DetailSecurityCard>)}
    </CompositionFrame>
    {!compact && !companyPage && <div className={styles.marketcapFacts}><span>종목 시총 순위 {placeholder('1.8em')}</span><span>종가 {placeholder('5em')}</span></div>}
  </div>;
}
