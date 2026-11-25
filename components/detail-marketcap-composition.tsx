import { lazy, type ReactNode } from 'react';
import { SiteDocumentLink as Link } from '@/components/site-document-link';
import { formatBusinessValue, formatCompactBusinessValue, formatMarketcapAmount, type BusinessValue } from '@/lib/business-analysis';
import type { prepareDetailComparison } from '@/lib/detail-comparison';
import { ChartWhenVisible } from './detail-chart-visibility';
import { DetailPriceGap } from './detail-comparison-summary';
import { MarketcapRangeLink } from './marketcap-chart-range';
import type { DetailSwitchCandidate } from './detail-investor-navigation';
import { DetailSecurityCard, SecuritySelectionCheck, type SecurityCardTarget } from './detail-security-card';
import styles from './detail-investor-summary.module.css';

const ChartPieMarketcap = lazy(() => import('./chart-pie-marketcap'));

export type MarketcapCompositionModel = {
  members: Array<{ candidate: DetailSwitchCandidate; amount: BusinessValue; date: string | null; percentage: string | null;
    rank: number | null; rankDate: string | null; quote: { value: BusinessValue; date: string | null } }>;
  aggregate: {
    candidate: DetailSwitchCandidate; amount: BusinessValue; rank: number | null;
    date: string | null; rankDate: string | null; status: string | null; exclusion: string | null;
    memberCount: number;
  } | null;
  basis?: string | null;
  complete: boolean;
  reason: string | null;
};

const swatch = (type?: string | null) => type === '보통주' ? 'common' : type?.includes('우선주') ? 'preferred' : 'other';
const extraCompositionColors = ['var(--chart-5)', 'var(--chart-4)', 'var(--chart-2)', 'var(--chart-1)'];

type CompositionWithAggregate = MarketcapCompositionModel & { aggregate: NonNullable<MarketcapCompositionModel['aggregate']> };

export function hasMarketcapHierarchy(model: MarketcapCompositionModel): model is CompositionWithAggregate {
  return model.aggregate != null && model.aggregate.memberCount > 1 && model.members.length === model.aggregate.memberCount;
}

function compositionColor(members: MarketcapCompositionModel['members'], index: number) {
  const series = swatch(members[index].candidate.type);
  return members.slice(0, index).some(member => swatch(member.candidate.type) === series)
    ? extraCompositionColors[(index - 1) % extraCompositionColors.length] : `var(--composition-${series})`;
}

export function MarketcapAmount({ value }: { value: BusinessValue }) {
  return value == null ? '—' : <span title={`${formatBusinessValue(value)}원`}>
    {formatMarketcapAmount(value).replace(/\s?원$/, '')}<span className={styles.marketcapUnit}>원</span>
  </span>;
}

function AmountDate({ date, basis }: { date?: string | null; basis?: string | null }) {
  return date && date !== basis ? <small><time dateTime={date}>{date}</time></small> : null;
}

function CompositionFrame({ children, memberCount, breakdown, aggregate, compact }: {
  children: ReactNode; memberCount: number; breakdown?: ReactNode; aggregate: ReactNode; compact?: boolean;
}) {
  return <div className={styles.marketcapComposition} data-compact={compact || undefined}
    role="group" aria-label="시가총액 구성과 조회 대상">
    {memberCount > 0 && <div className={styles.securityCards} data-comparing={memberCount > 1 || undefined}>{children}</div>}
    {breakdown ?? (aggregate && memberCount > 0 && <div className={styles.compositionJoin} data-columns={memberCount > 1 ? 2 : 1} aria-hidden="true">
      <i />{memberCount > 1 && memberCount % 2 === 0 && <i />}
    </div>)}
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

function CompositionHierarchy({ aggregate, track, children, breakdown }: {
  aggregate: ReactNode; track?: ReactNode; children: ReactNode; breakdown?: ReactNode;
}) {
  return <div className={styles.compositionHierarchy}>
    <div className={`${styles.summaryHero} ${styles.compositionAggregate}`}>
      <div className={styles.compositionAggregateContent}>{aggregate}</div>
      <div className={styles.portionTrack} aria-hidden="true">{track}</div>
    </div>
    <div className={styles.compositionBranches}>
      <div className={styles.compositionBranchHeading}>
        <div className={styles.compositionHeadingIdentity}>
          <strong>구성 종목</strong>
          <span className={styles.compositionCombinedHeading}>시가총액 · 합산 비중</span>
          <div className={styles.compositionAmountHeadings}><span>시가총액</span><span>합산 비중</span></div>
        </div>
        <div className={styles.compositionFactHeadings} aria-hidden="true"><span>종목 시총 순위</span><span>종가</span></div>
      </div>
      {children}
    </div>
    {breakdown}
  </div>;
}

function MarketcapConstituentFacts({ member, basis, rankHref, selectedDetail }: {
  member: MarketcapCompositionModel['members'][number]; basis?: string | null; rankHref?: string; selectedDetail?: ReactNode;
}) {
  const { candidate, rank, rankDate, quote } = member;
  const rankText = rank == null ? null : `${rank.toLocaleString('ko-KR')}위`;
  return <div className={styles.compositionSelection}>
    <span className={styles.reference}><span className={styles.compositionFactLabel}>종목 시총 순위</span>
      {rankText ? <Link className={styles.compositionRankLink} href={candidate.selected && rankHref ? rankHref : '/marketcap'}
        prefetch={false} aria-label={`종목 시가총액 순위 ${rankText}`}>{rankText}</Link> : '—'}
      {rankText && <AmountDate date={rankDate} basis={basis} />}
    </span>
    <span className={`${styles.reference} ${styles.marketcapQuote}`}><span className={styles.compositionFactLabel}>종가</span>
      {quote.value == null || !candidate.href ? '—' : <MarketcapRangeLink prefetch={false}
        href={candidate.selected ? '#price-history' : candidate.href + '#price-history'}>{formatBusinessValue(quote.value)}원</MarketcapRangeLink>}
      <AmountDate date={quote.date} basis={basis} />
    </span>
    {candidate.selected && selectedDetail}
  </div>;
}

function MarketcapHierarchy({ model, track, breakdown, selectedDetail, rankHref, renderTarget }: {
  model: CompositionWithAggregate;
  track: ReactNode; breakdown?: ReactNode; selectedDetail?: ReactNode; rankHref?: string; renderTarget: SecurityCardTarget;
}) {
  const { aggregate, members, basis, complete } = model;
  const knownPair = members.length === 2 && members.some(({ candidate }) => swatch(candidate.type) === 'common')
    && members.some(({ candidate }) => swatch(candidate.type) === 'preferred');
  const memberCount = members.length.toLocaleString('ko-KR');
  const compositionLabel = complete ? `${knownPair ? '보통주·우선주 ' : ''}${memberCount}개 종목의 합계`
    : `구성 종목 ${memberCount}개`;
  const rankText = aggregate.rank == null ? null : `${aggregate.rank.toLocaleString('ko-KR')}위`;
  return <div className={styles.marketcapComposition} role="group" aria-label="시가총액 구성과 조회 대상">
    <CompositionHierarchy track={track} breakdown={<><CompositionNotes model={model} />{breakdown}</>}
      aggregate={<>
      <div className={styles.headlineRow} data-compact-summary data-ranked={Boolean(rankText) || undefined}>
        {renderTarget(aggregate.candidate, <>
          <span className={`${styles.compositionChoice} ${styles.compositionLabel}`}><span>현재 기업 합산 시가총액</span>
            {aggregate.candidate.selected && <>
              <span className={styles.compositionCurrent}>조회 중</span>
              <SecuritySelectionCheck selected />
            </>}</span>
          <span className={aggregate.amount == null ? styles.headlineMissing : `investor-primary-value ${styles.headlineAmount}`}>
            {aggregate.amount == null ? '미제공' : <MarketcapAmount value={aggregate.amount} />}
          </span>
        </>, `${styles.compositionAggregateLink} ${styles.headlineColumn}`)}
        {rankText && <div className={`${styles.headlineColumn} ${styles.rankColumn}`}>
          <span className={styles.compositionLabel}>기업 합산 시가총액 순위</span>
          <Link className={styles.headlineRank} data-rank={aggregate.rank} href={aggregate.candidate.selected && rankHref ? rankHref : '/marketcaps'}
            prefetch={false} aria-label={`기업 합산 시가총액 순위 ${rankText}`}>
            <strong>{aggregate.rank?.toLocaleString('ko-KR')}</strong><span className={styles.rankUnit}>위</span>
          </Link>
        </div>}
      </div>
      <div className={styles.comparisonStrip}>
        <span className={styles.reference}>{compositionLabel}<AmountDate date={aggregate.date} basis={basis} /></span>
        {rankText && aggregate.rankDate && aggregate.rankDate !== basis && <span className={styles.reference}>
          순위 기준일 <time dateTime={aggregate.rankDate}>{aggregate.rankDate}</time>
        </span>}
      </div>
    </>}>
      {members.map((member, index) => {
        const { candidate, amount, date, percentage } = member;
        return <div key={candidate.securityId} className={styles.compositionBranch}>
        <i className={styles.portionSwatch} style={{ backgroundColor: compositionColor(members, index) }} aria-hidden="true" />
        <div className={styles.compositionMember} data-selected={candidate.selected || undefined}>
          {renderTarget(candidate, <>
            <span className={styles.compositionIdentity}>
              <span className={styles.compositionChoice}><strong>{candidate.type || candidate.name}</strong>
                {candidate.selected && <span className={styles.compositionCurrent}>조회 중</span>}</span>
              <small>
                {[candidate.type ? candidate.name : null, candidate.ticker].filter(Boolean).join(' · ')}
                {candidate.selected && <SecuritySelectionCheck selected />}
              </small>
            </span>
            <span className={styles.compositionAmounts}>
              <strong><MarketcapAmount value={amount} /></strong>
              <small>{percentage == null ? '—' : `${Number(percentage).toFixed(2)}%`}</small>
              <AmountDate date={date} basis={basis} />
            </span>
          </>, styles.compositionMemberLink)}
          <MarketcapConstituentFacts member={member} basis={basis} rankHref={rankHref} selectedDetail={selectedDetail} />
        </div>
        </div>;
      })}
    </CompositionHierarchy>
  </div>;
}

function CompositionNotes({ model }: { model: MarketcapCompositionModel }) {
  const { aggregate, reason } = model;
  return aggregate && <>
    {aggregate.status && <p role="status" className={`investor-muted ${styles.compositionNote}`}>{aggregate.status}</p>}
    {aggregate.exclusion && aggregate.exclusion !== aggregate.status && <p className="investor-muted">{aggregate.exclusion}</p>}
    {reason && !aggregate.status && <p className={`investor-muted ${styles.compositionNote}`}>{reason}</p>}
  </>;
}

export function MarketcapComposition({ model, compact = false, breakdown, selectedDetail, rankHref, renderTarget }: {
  model: MarketcapCompositionModel; compact?: boolean; breakdown?: ReactNode; selectedDetail?: ReactNode;
  rankHref?: string; renderTarget: SecurityCardTarget;
}) {
  const { members, aggregate, basis, complete } = model;
  const track = complete ? members.map(({ candidate, amount, percentage }, index) => percentage != null &&
    <span key={candidate.securityId} data-series={swatch(candidate.type)} style={{
      flexGrow: Number(amount), flexBasis: 0, backgroundColor: compositionColor(members, index),
    }} />) : undefined;
  if (!compact && hasMarketcapHierarchy(model)) {
    return <MarketcapHierarchy model={model} track={track} breakdown={breakdown}
      selectedDetail={selectedDetail} rankHref={rankHref} renderTarget={renderTarget} />;
  }
  const aggregateTarget = aggregate && renderTarget(aggregate.candidate, <AggregateContents compact={compact} track={track} selected={aggregate.candidate.selected}
    amount={!compact && <><span className={styles.aggregateAmount}><MarketcapAmount value={aggregate.amount} /></span><AmountDate date={aggregate.date} basis={basis} /></>}
    rank={!compact && <span className={styles.aggregateRank}><span>기업 시총 순위</span>
      <strong>{aggregate.rank == null ? '—' : `${aggregate.rank.toLocaleString('ko-KR')}위`}</strong><AmountDate date={aggregate.rankDate} basis={basis} />
    </span>} />, styles.aggregateCard);
  return <>
    <CompositionFrame memberCount={members.length} breakdown={breakdown} aggregate={aggregateTarget} compact={compact}>
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
    {!compact && <CompositionNotes model={model} />}
  </>;
}

export function MarketcapBreakdown({ comparison, members, selectedSecurityId }: {
  comparison: ReturnType<typeof prepareDetailComparison>;
  members: MarketcapCompositionModel['members'];
  selectedSecurityId?: string;
}) {
  const { composition, priceComparisons } = comparison;
  const totalLabel = formatCompactBusinessValue(composition.total).replace(/^\d+(?:\.\d+)?/, amount => formatBusinessValue(amount));
  const chartData = members.flatMap(({ candidate, amount, percentage }, index) => percentage == null || amount == null ? [] : [{
    securityId: candidate.securityId, ticker: candidate.ticker, name: candidate.name,
    type: candidate.type ?? undefined, value: Number(amount), rawValue: amount,
    percentage: Number(percentage), color: compositionColor(members, index),
  }]);
  return <div className={styles.marketcapBreakdown}>
    {chartData.length > 1 && <figure className={styles.compositionFigure}>
      <figcaption>시가총액 구성 비중{composition.date && <time dateTime={composition.date}>{composition.date}</time>}</figcaption>
      <ChartWhenVisible fallback={<div className="grid min-h-36 place-items-center text-sm text-muted-foreground">차트 준비 중…</div>}>
        <ChartPieMarketcap data={chartData} selectedSecurityId={selectedSecurityId} compact
          centerText={{ title: '합산 시총', value: `${totalLabel}원` }} />
      </ChartWhenVisible>
    </figure>}
    <DetailPriceGap priceComparisons={priceComparisons} compareYear />
  </div>;
}

export function MarketcapCompositionSkeleton({ placeholder }: {
  placeholder: (width: string, className?: string) => ReactNode;
}) {
  return <div className={styles.marketcapComposition} aria-hidden="true">
    <CompositionHierarchy aggregate={<>
      <div className={styles.headlineRow} data-compact-summary data-ranked>
        <div className={styles.headlineColumn}>{placeholder('8em')}
          <span className={`investor-primary-value ${styles.headlineAmount}`}>{placeholder('6.7em')}</span></div>
        <div className={`${styles.headlineColumn} ${styles.rankColumn}`}>{placeholder('4em')}
          <span className={styles.headlineRank}>{placeholder('2em')}</span></div>
      </div>
      <div className={styles.comparisonStrip}>{placeholder('7.5em')}</div>
    </>}>
      {[0, 1].map(index => <div className={styles.compositionBranch} key={index}>
        <i className={styles.portionSwatch} />
        <div className={styles.compositionMember}>
          <div className={styles.compositionMemberLink}><span className={styles.compositionIdentity}>{placeholder('3em')}{placeholder('7em')}</span>
            <span className={styles.compositionAmounts}>{placeholder('6em')}{placeholder('2.75em')}</span></div>
          <div className={styles.compositionSelection}>{placeholder('6em')}{placeholder('5em')}</div>
        </div>
      </div>)}
    </CompositionHierarchy>
  </div>;
}
