import styles from './detail-chart.module.css';

export function StaticTrendLine({ points, label }: { points: readonly { plot: number | null }[]; label: string }) {
  const marks = points.map(({ plot }, index) => {
    if (plot == null) return null;
    const x = points.length === 1 ? 300 : 8 + index / (points.length - 1) * 584;
    const y = 188 - plot * 176;
    return { x, y, move: points[index - 1]?.plot == null };
  });
  const path = marks.map(mark => mark ? `${mark.move ? 'M' : 'L'}${mark.x.toFixed(2)} ${mark.y.toFixed(2)}` : '').join(' ');
  return <svg viewBox="0 0 600 200" role="img" aria-label={label + ' 추이'} className={styles.staticTrend} data-static-trend>
    <path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {marks.map((mark, i) => mark?.move && !marks[i + 1] && <circle key={i} cx={mark.x} cy={mark.y} r="2" />)}
  </svg>;
}
