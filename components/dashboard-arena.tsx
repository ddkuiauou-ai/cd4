import { SiteDocumentLink as Link } from "@/components/site-document-link";
import { businessRatio, formatBusinessValue } from "@/lib/business-analysis";
import { arenaClosing, type ArenaEntry, type ArenaQuote } from "@/lib/dashboard-arena";
import type { getDashboardArena } from "@/lib/data/dashboard-arena";
import { formatRankingRate, formatRankingValue, RANKING_METRICS, type RankingRow } from "@/lib/ranking-view";
import { DashboardArenaPlayer } from "./dashboard-arena-player";
import styles from "./dashboard-arena.module.css";

type ArenaData = Awaited<ReturnType<typeof getDashboardArena>>;

function Quote({ quote, date }: { quote?: ArenaQuote; date?: string | null }) {
  if (!quote || (date && quote.priceDate !== date)) return <span className={styles.muted}>종가 정보 없음</span>;
  return <span className={styles.quote}>
    {quote.close == null ? "종가 정보 없음" : `${formatBusinessValue(quote.close)}원`}
    {quote.rate != null && <span className={rateTone(quote.rate)}>{formatRankingRate(quote.rate)}</span>}
  </span>;
}

function rateTone(rate: number | null) {
  return rate == null || rate === 0 ? undefined : rate > 0 ? styles.up : styles.down;
}

function Name({ entry }: { entry: Pick<ArenaEntry, "href" | "name"> }) {
  return entry.href ? <Link href={entry.href} prefetch={false}>{entry.name}</Link> : <span>{entry.name}</span>;
}

export function DashboardArena({ data, companyRows, date }: { data: ArenaData; companyRows: RankingRow[]; date: string }) {
  const today = [{ metric: "marketcap" as const, date, rows: companyRows.slice(0, 3).flatMap(row => row.rank == null ? [] : [{
    ...row, rank: row.rank, type: row.stockType, quote: { close: row.close, rate: row.rate, priceDate: row.priceDate, volume: row.volume },
  }]) }, ...data.today];
  const closing = arenaClosing(companyRows, date);
  const leading = data.score.scores.filter(row => row.place === 1);
  const scoreTies = new Map<number, number>();
  for (const row of data.score.scores) scoreTies.set(row.place, (scoreTies.get(row.place) ?? 0) + 1);
  const past = data.past;
  const swing = Math.max(0, ...closing.groups.slice(0, 2).flatMap(group => group.rows.map(row => Math.abs(row.rate ?? 0))));
  const volumeMax = closing.groups[2].rows[0]?.volume ?? null;
  return <DashboardArenaPlayer captions={{
    overall: data.score.ready ? `보통주 ${data.score.count.toLocaleString("ko-KR")}개 비교` : undefined,
    closing: `상승 ${closing.up} · 하락 ${closing.down} · 보합 ${closing.flat}${closing.unknown ? ` · 등락 미제공 ${closing.unknown}` : ""}`,
  }} footnotes={{
    today: "기업 합산 시총의 종가와 등락률은 대표 보통주 기준입니다.",
    past: "1년 전에는 당시 관측값을 비교하고, 현재는 해당 지표의 공개 순위를 표시합니다.",
    overall: "낮은 PER·PBR, 높은 배당수익률 순으로 채점합니다. 세 부문 등수 합계가 작을수록 앞섭니다.",
    closing: `기업 합산 시총 상위 ${closing.sampleCount.toLocaleString("ko-KR")}개 기업의 대표 보통주를 기준일 종가로 비교합니다.`,
  }}>
    {{
      today: <div className={styles.todayGrid}>
        {today.map(({ metric, rows, date: metricDate }, index) => {
          const name = metric === "marketcap" ? index === 0 ? "기업 합산 시총" : "종목별 시총" : RANKING_METRICS[metric].label;
          const href = index === 0 ? "/marketcaps" : `/${metric}`;
          const [leader, ...others] = rows;
          return <section className={styles.event} key={`${index}-${metric}`}><div className={styles.rotor} data-arena-rotor>
            <div className={styles.rotorFront} aria-hidden="true">{name}</div>
            <div className={styles.rotorFace}>
              <h3><Link href={href} prefetch={false}>{name}</Link></h3>
              {leader ? <><div className={styles.eventLead}><span className={styles.firstRank}>{leader.rank}위</span><strong><Name entry={leader} /></strong></div>
                <p className={styles.eventValue} title={formatBusinessValue(leader.value)}>{formatRankingValue(metric, leader.value)}</p>
                <p><Quote quote={leader.quote} date={metricDate} /></p>
                {others.length > 0 && <ul className={styles.runners}>{others.map(entry => <li key={entry.id}><span>{entry.rank}위</span> <Name entry={entry} /></li>)}</ul>}
              </> : <p className={styles.muted}>{metricDate ? "공개 순위 대상 없음" : "순위 미공개"}</p>}
              {metricDate && metricDate !== date && <p className={styles.muted}><time dateTime={metricDate}>{metricDate}</time> 공개 기준</p>}
            </div>
          </div></section>;
        })}
      </div>,
      past: <div className={styles.pastGrid}>
          <article className={styles.pastRow} data-arena-past-row><h3>기업 합산 시총</h3><p className={styles.muted}>당시 기업 합산 순위 자료 없음</p></article>
          {past.map(({ metric, date: pastDate, currentDate, row, tiedCount }) => <article className={styles.pastRow} key={metric} data-arena-past-row>
            <h3>{metric === "marketcap" ? "종목별 시총" : RANKING_METRICS[metric].label}{pastDate && <small><time dateTime={pastDate}>{pastDate}</time>{tiedCount > 1 && <> · 공동 1위</>}</small>}</h3>
            {row ? <ul><li>
              <strong><Name entry={row} /></strong><span className={styles.muted}>{formatRankingValue(metric, row.value)}</span>
              <span className={styles.currentRank}>{row.current ? `${row.current.rank}위` : "현재 순위 없음"}</span>
              {row.current && <Quote quote={row.current.quote} date={currentDate} />}
            </li></ul> : <p className={styles.muted}>당시 지표 관측 자료 없음</p>}
          </article>)}
        </div>,
      overall: leading.length ? <div className={styles.overall}>
          <div className={styles.winner} data-arena-winner>
            <p className={styles.firstRank}>{leading.length > 1 ? "공동 1위" : "종합 1위"}</p>
            <ul>{leading.map(({ entry }) => <li key={entry.id}><strong><Name entry={entry} /></strong></li>)}</ul>
            <div><p className={styles.sum}>{leading[0].total}</p><p className={styles.muted}>세 부문 등수 합계</p></div>
          </div>
          <div className={styles.scoreList}><table role="table" aria-label="가치·배당 종합 상위 순위"><thead><tr><th scope="col">순위</th><th scope="col">종목</th>
            <th scope="col">이익<small>PER · EPS</small></th><th scope="col">자산<small>PBR · BPS</small></th>
            <th scope="col">배당<small>수익률 · 주당배당금</small></th><th scope="col">합계</th><th scope="col">전일 대비</th></tr></thead>
            <tbody role="rowgroup">{data.score.scores.map(({ entry, place, divisions, total }) => <tr role="row" key={entry.id} data-arena-place={place}>
              <td className={styles.scorePlace}>{scoreTies.get(place)! > 1 && <small>공동</small>}{place}위</td><th scope="row"><Name entry={entry} /></th>
              {divisions.map(division => <td key={division.metric}><span className={styles.mobileDivision} aria-hidden="true">{RANKING_METRICS[division.metric].label} · {RANKING_METRICS[division.source].label}</span><strong className={styles.scoreRank}>{division.rank}위</strong>
                <span className={styles.scoreValues}><strong>{formatRankingValue(division.metric, division.value)}</strong> {formatRankingValue(division.source, division.raw)}</span></td>)}
              <td className={styles.scoreTotal}><span className={styles.mobileDivision} aria-hidden="true">합계</span>{total}</td><td className={rateTone(entry.quote?.rate ?? null)}><span className={styles.mobileDivision} aria-hidden="true">전일 대비</span>{formatRankingRate(entry.quote?.priceDate === date ? entry.quote.rate : null)}</td>
            </tr>)}</tbody>
          </table></div>
        </div> : <p className={styles.empty}>{data.score.ready ? "비교 조건을 충족하는 보통주가 없습니다." : "여섯 지표가 같은 기준일에 공개되면 종합 순위를 표시합니다."}</p>,
      closing: <div className={styles.marketGrid}>{closing.groups.map(group => <section key={group.key} data-arena-market-group>
          <h3>{group.label}</h3>
          {group.rows.length ? <ol>{group.rows.map((row, index) => {
            const volume = group.key === "volume";
            const color = volume ? styles.volume : group.key === "up" ? styles.up : styles.down;
            const bar = volume ? businessRatio(row.volume, volumeMax, 3, 100) : swing ? String(Math.abs(row.rate ?? 0) / swing * 100) : null;
            return <li key={row.id}>
              <span className={styles.marketRank}>{index + 1}</span><strong><Name entry={{ name: row.name, href: row.securityHref }} /></strong>
              <strong className={color}>{volume ? `${formatBusinessValue(row.volume)}주` : formatRankingRate(row.rate)}</strong>
              <p>{volume ? <Quote quote={row} date={date} /> : row.close == null ? "종가 정보 없음" : `종가 ${formatBusinessValue(row.close)}원`}</p>
              <span className={`${styles.marketBar} ${color}`} aria-hidden="true"><i style={{ width: `${bar ?? 0}%` }} /></span>
            </li>;
          })}</ol> : <p className={styles.empty}>{group.label} 순위 대상 없음</p>}
        </section>)}</div>,
    }}
  </DashboardArenaPlayer>;
}
