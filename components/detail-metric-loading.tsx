import { DetailAnnualSkeleton, DetailChartSkeleton } from './detail-record-skeleton';
import { MarketcapCompositionSkeleton } from './detail-marketcap-composition';
import navigation from './detail-investor-navigation.module.css';
import summary from './detail-investor-summary.module.css';
import styles from './detail-metric-loading.module.css';

const labels = { per: 'PER', pbr: 'PBR', eps: 'EPS', bps: 'BPS', dps: '주당배당금', div: '배당수익률', marketcap: '종목 시가총액' };

function Bar({ width, className = '' }: { width: string; className?: string }) {
  return <span className={`${styles.bar} ${className}`} style={{ inlineSize: width }} />;
}

const compositionPlaceholder = (width: string, className = '') => <Bar width={width} className={`${styles.compositionBar} ${className}`} />;

function ValuationPlaceholder({ metric }: { metric: Exclude<keyof typeof labels, 'marketcap'> }) {
  const dividend = metric === 'dps' || metric === 'div';
  return <div className={summary.valuationSupport}>
    <h2 className={styles.supportTitle}><Bar width="8rem" /></h2>
    <div className={summary.valuationPeriods}>
      {['current', 'previous'].map(period => <div key={period} className={summary.valuationPeriod}>
        <h3><Bar width="2.5rem" /><Bar width="5rem" /></h3>
        <div className={summary.metricCalculation} data-calculation data-product={metric === 'dps' || undefined}>
          <div className={summary.calculationInputs}>
            <div><Bar width="2rem" /><Bar width="4.5rem" /></div>
            <div><Bar width="5rem" /><Bar width="3.75rem" /></div>
          </div>
          <Bar width={metric === 'div' ? '3rem' : '0.625rem'} />
          <div className={`${summary.calculationResult} ${styles.calculationResult}`}><Bar width="3.5rem" /><Bar width="4.5rem" /></div>
        </div>
        {period === 'current' && !dividend && <div className={styles.valuationQuoteChange}><Bar width="7rem" /></div>}
      </div>)}
    </div>
  </div>;
}

function DividendPlaceholder({ divider }: { divider: boolean }) {
  return <div className={summary.dividendComparison} data-divider={divider || undefined}>
    <div className={styles.split}><Bar width="8rem" className={styles.sectionTitle} /><Bar width="3rem" /></div>
    <div className={summary.securityCards} data-comparing>
      {Array.from({ length: 2 }, (_, card) => <div key={card} className={summary.securityCard}>
        <div className={`${summary.cardIdentityHeading} ${styles.cardIdentity}`}>
          <Bar width="5rem" /><Bar width="4rem" />
        </div>
        <div className={summary.values}>
          {Array.from({ length: 3 }, (_, row) => <div key={row} data-with-date={row === 2 || undefined}><Bar width="3.5rem" /><Bar width="3rem" /></div>)}
        </div>
      </div>)}
    </div>
    <div className={summary.dividendGap}>
      <h3><Bar width="10rem" /></h3>
      <div className={summary.valuationPeriods}>
        {['current', 'previous'].map(period => <div key={period} className={summary.valuationPeriod}>
          <h4><Bar width="2.5rem" /><Bar width="5rem" /></h4>
          <dl className={styles.differenceValues}>{['3.5rem', '3rem', '3.75rem'].map(width =>
            <div key={width}><dt><Bar width={width} /></dt><dd><Bar width="2.75rem" /></dd></div>)}</dl>
        </div>)}
      </div>
      <div className={summary.dividendGapChange}>
        {['6rem', '7rem', '8rem', '7.5rem'].map(width => <Bar key={width} width={width} />)}
      </div>
    </div>
  </div>;
}

export function DetailMetricLoading({ metric, companyPage = false }: { metric: keyof typeof labels; companyPage?: boolean }) {
  const dividend = metric === 'dps' || metric === 'div';
  const marketcap = metric === 'marketcap';
  const scope = companyPage ? 'company' : 'security';
  const label = marketcap && companyPage ? '기업 합산 시가총액' : labels[metric];
  const titleWidth = marketcap || dividend ? '17rem' : '12rem';
  const chartTitleWidth = marketcap ? '13rem' : dividend ? '16rem' : '6rem';
  const keyMetrics = <section className={navigation.facts}>
    <Bar width={marketcap ? '7rem' : '5rem'} className={styles.railTitle} />
    {marketcap && <div className={navigation.railCapTargets}>
      <ul>{['4rem', '3rem', '3rem'].map((width, index) => <li key={index} className={navigation.railCapOption}>
        <Bar width={width} />
      </li>)}</ul>
    </div>}
    {[0, 1, 2, 3].map(row => <div className={styles.fact} key={row}><Bar width="5rem" /><Bar width="3rem" /></div>)}
  </section>;

  return <>
    <p role="status" className="sr-only">{label} 상세 정보를 불러오는 중…</p>
    <div className={`app-container detail-grid investor-detail ${styles.loading}`} aria-hidden="true">
      <div className={navigation.metrics}>
        <div className={navigation.metricOwner}><Bar width="5rem" /></div>
        {[2, 1, 4, 2].map((count, group) => <div className={navigation.metricGroup} key={group}>
          {group >= 2 && <div className={navigation.metricGroupName}><Bar width="3rem" /></div>}
          {Array.from({ length: count }, (_, index) => <div className={styles.metricLine} key={index}>
            <Bar width={index % 2 ? '60%' : '80%'} />
          </div>)}
        </div>)}
        <section className={`${navigation.railOutline} ${navigation.leftOutline}`}>
          <Bar width="5rem" className={styles.railTitle} />
          {['5rem', '6rem', '4.5rem'].map(width => <div key={width} className={styles.outlineLine}><Bar width={width} /></div>)}
        </section>
      </div>
      <div className={`detail-content investor-content ${summary.focusedContent} ${summary.mobileMetricHeader} ${marketcap ? summary.marketcapContent : summary.financialContent}`}>
        <div className={`detail-breadcrumb investor-breadcrumb ${styles.breadcrumb}`}><Bar width="10rem" /></div>
        <div className={styles.header} data-detail-header-row>
          <div className={styles.title} data-detail-title-group>
            <Bar width={titleWidth} />
            <div className={styles.metricTitle}><Bar width={marketcap || dividend ? '4.5rem' : '2.25rem'} /></div>
          </div>
          <div className={styles.actions} data-detail-header-actions><Bar width="1rem" /><Bar width="1rem" /><Bar width="2.75rem" /></div>
        </div>
        <div className={`detail-identity-meta ${styles.identityMeta}`}><Bar width="8rem" /><Bar width="7rem" /></div>
        <div className="investor-overview">
          <div id="current-overview">
            {!marketcap && <div className={summary.summaryHero}>
              <div className={`${summary.headlineRow} ${styles.headline}`} data-ranked data-compact-summary>
                <Bar width="4rem" /><Bar width="3rem" />
                <Bar width="70%" className={styles.amount} /><Bar width="50%" className={styles.rank} />
              </div>
              <div className={`${summary.comparisonStrip} ${styles.comparisonStrip}`}>
                <Bar width="9rem" /><Bar width="7rem" />
              </div>
            </div>}
            {marketcap ? <MarketcapCompositionSkeleton placeholder={compositionPlaceholder} /> : <>
              <ValuationPlaceholder metric={metric} />
              {dividend && <DividendPlaceholder divider={metric === 'dps'} />}
            </>}
          </div>
        </div>
        <div className={`${marketcap ? '' : 'investor-outline-inline '}${navigation.inlineOutline} ${styles.inlineOutline}`}><Bar width="6rem" /></div>
        <div className="investor-record">
          <div className={`investor-record-heading ${styles.chartHeading}`}>
            <h2><Bar width={chartTitleWidth} /></h2>
            {metric === 'div' && <Bar width="3rem" />}
          </div>
          <DetailChartSkeleton variant={metric === 'div' ? 'comparison' : metric} marketcapScope={scope} />
        </div>
        {marketcap && <div className="investor-record">
          <div className={`investor-record-heading ${styles.chartHeading}`}><h2><Bar width="6rem" /></h2><Bar width="3rem" /></div>
          <DetailAnnualSkeleton marketcap={scope} />
        </div>}
      </div>
      <aside className={navigation.rail}>
        {!marketcap && <div className={navigation.switcher}>
          <Bar width="5rem" className={styles.railTitle} />
          <div className={navigation.switchList}>
            {[0, 1].map(row => <div key={row} className={navigation.switchLink}><Bar width="4rem" /><Bar width="3rem" /></div>)}
          </div>
        </div>}
        {marketcap && keyMetrics}
        <div className={navigation.railRecords}>
          {!marketcap && keyMetrics}
          {[0, 1].map(group => <section key={group} className={navigation.railOutline}>
            <Bar width="5rem" className={styles.railTitle} />
            {['6rem', '7rem', '5rem'].map(width => <div key={width} className={styles.outlineLine}><Bar width={width} /></div>)}
          </section>)}
        </div>
      </aside>
    </div>
  </>;
}
