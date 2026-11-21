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

function ValuationPlaceholder() {
  return <div className={summary.valuationSupport}>
    <h2 className={styles.supportTitle}><Bar width="7rem" /></h2>
    <table className={`investor-table ${styles.valuationTable}`}><tbody>
      {Array.from({ length: 3 }, (_, row) => <tr key={row}>
        {['3rem', '4rem', '4rem'].map((width, column) =>
          <td key={column}>
            <Bar width={width} />
            {((row < 2 && column === 2) || (row === 2 && column === 1)) && <Bar width="3.25rem" className={styles.cellDetail} />}
          </td>)}
      </tr>)}
    </tbody></table>
  </div>;
}

function DividendPlaceholder() {
  return <div className={summary.dividendComparison}>
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
    <div className={summary.difference}>
      <Bar width="6rem" />
      <dl className={styles.differenceValues}>{['3.5rem', '3rem', '3.75rem'].map(width =>
        <div key={width}><dt><Bar width={width} /></dt><dd><Bar width="2.75rem" /></dd></div>)}</dl>
    </div>
  </div>;
}

function RelatedPlaceholder() {
  return <div className={summary.valuationSupport}>
    <dl className={`${summary.relatedSummary} ${styles.related}`}>
      <div><dt><Bar width="2.5rem" /></dt><dd><Bar width="3rem" /></dd></div>
      <div>
        <dt><Bar width="2rem" /></dt>
        <dd>
          <div className={styles.relatedAmount}><Bar width="4.5rem" /></div>
          <div className={styles.closeChange}><Bar width="3.25rem" /></div>
        </dd>
      </div>
    </dl>
  </div>;
}

export function DetailMetricLoading({ metric, companyPage = false }: { metric: keyof typeof labels; companyPage?: boolean }) {
  const valuation = metric === 'per' || metric === 'pbr';
  const dividend = metric === 'dps' || metric === 'div';
  const marketcap = metric === 'marketcap';
  const scope = companyPage ? 'company' : 'security';
  const label = marketcap && companyPage ? '기업 합산 시가총액' : labels[metric];
  const titleWidth = marketcap || dividend ? '17rem' : '12rem';
  const chartTitleWidth = marketcap ? '13rem' : dividend ? '16rem' : '6rem';

  return <>
    <p role="status" className="sr-only">{label} 상세 정보를 불러오는 중…</p>
    <div className={`app-container detail-grid investor-detail ${styles.loading}`} aria-hidden="true">
      <div className={navigation.metrics}>
        <div className={navigation.metricDesktop}>
          <div className={navigation.metricOwner}><Bar width="5rem" /></div>
          {[2, 1, 4, 2].map((count, group) => <div className={navigation.metricGroup} key={group}>
            {group >= 2 && <div className={navigation.metricGroupName}><Bar width="3rem" /></div>}
            {Array.from({ length: count }, (_, index) => <div className={styles.metricLine} key={index}>
              <Bar width={index % 2 ? '60%' : '80%'} />
            </div>)}
          </div>)}
        </div>
        <div className={`${navigation.metricMobile} ${styles.mobileNav}`}>
          <Bar width="7rem" /><Bar width="3.25rem" />
        </div>
      </div>
      <div className={`detail-content investor-content ${summary.focusedContent} ${marketcap ? summary.marketcapContent : summary.financialContent}`}>
        <div className={`detail-breadcrumb investor-breadcrumb ${styles.breadcrumb}`}><Bar width="10rem" /></div>
        <div className={styles.header}>
          <div className={styles.title}><Bar width={titleWidth} /></div>
          <div className={styles.actions}><Bar width="1.125rem" /><Bar width="1.125rem" /><Bar width="2.75rem" /></div>
        </div>
        <div className={`detail-identity-meta ${styles.identityMeta}`}><Bar width="8rem" /><Bar width="7rem" /></div>
        <div className="investor-overview">
          <div id="current-overview">
            {marketcap ? <MarketcapCompositionSkeleton companyPage={companyPage} placeholder={compositionPlaceholder} /> : <>
              <div className={summary.summaryHero}>
                <div className={`${summary.headlineRow} ${styles.headline}`} data-ranked>
                  <Bar width="4rem" /><Bar width="3rem" />
                  <Bar width="70%" className={styles.amount} /><Bar width="50%" className={styles.rank} />
                </div>
                <div className={`${summary.comparisonStrip} ${styles.comparisonStrip}`}>
                  {valuation || dividend
                    ? <><Bar width="9rem" /><Bar width="7rem" /></>
                    : <div className={summary.reference}><Bar width="7rem" /><Bar width="2rem" /><Bar width="4rem" /></div>}
                </div>
              </div>
              {valuation ? <ValuationPlaceholder /> : dividend ? <DividendPlaceholder /> : <RelatedPlaceholder />}
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
        <div className={navigation.switcher}>
          <Bar width="5rem" className={styles.railTitle} />
          {marketcap ? <div className={navigation.railCapSwitch}>
            <MarketcapCompositionSkeleton companyPage={companyPage} compact placeholder={compositionPlaceholder} />
          </div> : <div className={navigation.switchList}>
            {[0, 1].map(row => <div key={row} className={navigation.switchLink}><Bar width="4rem" /><Bar width="3rem" /></div>)}
          </div>}
        </div>
        <div className={navigation.railRecords}>
          <section className={navigation.facts}>
            <Bar width="5rem" className={styles.railTitle} />
            {[0, 1, 2, 3].map(row => <div className={styles.fact} key={row}><Bar width="5rem" /><Bar width="3rem" /></div>)}
          </section>
          {[0, 1].map(group => <section key={group} className={navigation.railOutline}>
            <Bar width="5rem" className={styles.railTitle} />
            {['6rem', '7rem', '5rem'].map(width => <div key={width} className={styles.outlineLine}><Bar width={width} /></div>)}
          </section>)}
        </div>
      </aside>
    </div>
  </>;
}
