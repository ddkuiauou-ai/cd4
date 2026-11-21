import styles from './detail-record-skeleton.module.css';
import chartStyles from './detail-chart.module.css';

type ChartVariant = 'per' | 'pbr' | 'eps' | 'bps' | 'dps' | 'div' | 'comparison' | 'price' | 'distribution' | 'monthly' | 'marketcap' | 'plot';
type MarketcapScope = 'company' | 'security' | 'comparison';

export function DetailChartSkeleton({ variant = 'plot', label, height, customRange = false, plotOnly = false, withStatistics = true, marketcapScope = 'security' }: {
  variant?: ChartVariant; label?: string; height?: number; customRange?: boolean; plotOnly?: boolean; withStatistics?: boolean;
  marketcapScope?: MarketcapScope;
}) {
  const aggregated = variant === 'per' || variant === 'pbr' || variant === 'eps' || variant === 'div';
  const yearEnd = variant === 'bps';
  const trend = aggregated || yearEnd || variant === 'dps';
  const compactRange = customRange && variant !== 'pbr' && variant !== 'eps';
  const marketcap = variant === 'marketcap' ? marketcapScope : undefined;
  const plotClass = marketcap === 'comparison' ? chartStyles.registeredComparisonPlot
    : marketcap ? chartStyles.capitalizationPlot : chartStyles.plot;
  return <>
    {label && <p className="sr-only" role="status">{label} 준비 중…</p>}
    <div aria-hidden="true" className={styles.record} data-chart={variant} data-marketcap-scope={marketcap}>
      {trend && <div className={styles.controls} data-custom-range={compactRange || undefined}>
        <span className={!aggregated && !customRange ? styles.long : undefined} />
        {aggregated && <span />}
      </div>}
      {marketcap && !plotOnly && marketcap !== 'comparison' && (!customRange || marketcap === 'security') &&
        <div className={styles.controls} data-custom-range={customRange || undefined}>
          <span className={customRange ? styles.long : undefined} />
          {!customRange && <div className={styles.periodPlaceholders}>{[0, 1, 2, 3].map(period => <span key={period} />)}</div>}
        </div>}
      {yearEnd && <div className={`${chartStyles.yearEndLatest} ${styles.yearEndResult}`}><span /><span /><span /></div>}
      {variant === 'dps' && <div className={styles.growthLegend}><span /><span /></div>}
      {variant === 'comparison' && <div className={styles.comparison}>
        <div className={`${chartStyles.caption} ${styles.comparisonCaption}`}><span /></div>
        <ul className={chartStyles.comparisonLegend}>
          {[0, 1].map(series => <li key={series}><span /><span /><span /></li>)}
        </ul>
        <dl className={chartStyles.comparisonDifferences}>
          <div><dt><span /></dt><dd><span /></dd></div>
        </dl>
      </div>}
      {marketcap && marketcap !== 'security' && !plotOnly && <div className={styles.chartUnit}><span /></div>}
      <div className={`${styles.plot} ${plotClass}`} data-variant={variant} style={height ? { height } : undefined}>
        {marketcap === 'security' && !plotOnly && <div className={`${styles.chartUnit} ${styles.plotUnit}`}><span /></div>}
        <div className={variant === 'monthly' ? styles.monthGrid : styles.grid} />
      </div>
      {marketcap === 'company' && !plotOnly && <div className={`${chartStyles.marketcapReadout} ${styles.marketcapReadout}`}><span /><span /></div>}
      {!plotOnly && variant !== 'plot' && <div className={styles.caption} />}
      {trend && withStatistics && <div className={styles.statistics}><span /><span /><span /></div>}
      {marketcap === 'security' && !plotOnly && withStatistics && <div className={`${chartStyles.statistics} ${chartStyles.marketcapStatistics}`}>
        {[0, 1, 2].map(row => <div className={styles.marketcapStatistic} key={row}><span /><span /></div>)}
      </div>}
    </div>
  </>;
}

export function DetailAnnualSkeleton({ comparison = false, label, marketcap }: {
  comparison?: boolean; label?: string; marketcap?: Exclude<MarketcapScope, 'comparison'>;
}) {
  if (marketcap) return <>
    {label && <p className="sr-only" role="status">{label} 준비 중…</p>}
    <div aria-hidden="true" className={styles.annual} data-marketcap-scope={marketcap}>
      <div className={styles.annualHeader}><span /><span /><span /></div>
      {Array.from({ length: 5 }, (_, row) => <div className={styles.annualRow} key={row}>
        <div><span /><span /></div>
        <div className={styles.annualValues}><span /><span />{marketcap === 'company' && <span />}</div>
        <span />
      </div>)}
    </div>
  </>;
  return <>
    {label && <p className="sr-only" role="status">{label} 준비 중…</p>}
    <div aria-hidden="true" className={styles.annual} data-comparison={comparison || undefined}>
      <div className={styles.annualHeader}><span /><span /><span />{comparison && <span />}</div>
      {Array.from({ length: 5 }, (_, row) => <div className={styles.annualRow} key={row}>
        <div><span /><span /></div><span /><span />{comparison && <span />}
      </div>)}
    </div>
  </>;
}
