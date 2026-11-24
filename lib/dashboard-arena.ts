import { compareBusinessValues } from "./business-analysis";
import { compareVolumes, type RankingAmount, type RankingMetric, type RankingRow } from "./ranking-view";

export const arenaMetrics = ["marketcap", "per", "pbr", "eps", "bps", "dps", "div"] as const;
export const arenaDivisions = [
  { label: "이익", metric: "per", source: "eps" },
  { label: "자산", metric: "pbr", source: "bps" },
  { label: "배당", metric: "div", source: "dps" },
] as const;

export type ArenaQuote = Pick<RankingRow, "close" | "rate" | "priceDate" | "volume">;
export type ArenaEntry = { id: string; name: string; href: string | null; rank: number; value: RankingAmount; type: string | null; quote?: ArenaQuote };
export type ArenaRanking = { date: string | null; rows: ArenaEntry[] };
export type ArenaRankings = Record<RankingMetric, ArenaRanking>;
type HistoricalEntry = ArenaEntry & { observedMarketcap?: string | null; ticker?: string };
export type ArenaHistory = Partial<Record<RankingMetric, { date: string; entries: HistoricalEntry[] }>>;

export function historicalRepresentative(entries: readonly HistoricalEntry[]): ArenaEntry | null {
  return entries.toSorted((a, b) => compareVolumes(a.observedMarketcap ?? null, b.observedMarketcap ?? null)
    || (a.ticker ?? a.name).localeCompare(b.ticker ?? b.name, "ko-KR")
    || a.id.localeCompare(b.id))[0] ?? null;
}

export function arenaEntry(row: RankingRow): ArenaEntry | null {
  if (row.rank == null) return null;
  return { id: row.id, name: row.name, href: row.href, rank: row.rank, value: row.value, type: row.stockType,
    quote: { close: row.close, rate: row.rate, priceDate: row.priceDate, volume: row.volume } };
}

type Division = typeof arenaDivisions[number];
export type ArenaScore = { entry: ArenaEntry; divisions: { label: Division["label"]; metric: Division["metric"]; source: Division["source"];
  value: RankingAmount; raw: RankingAmount; rank: number }[]; total: number; place: number };

/** Display analysis on the intersection of six matching public snapshots. */
export function scoreArena(rankings: ArenaRankings, date: string) {
  const metrics = arenaDivisions.flatMap(({ metric, source }) => [metric, source]);
  if (metrics.some(metric => rankings[metric].date !== date)) return { count: 0, scores: [], ready: false };
  const byMetric = Object.fromEntries(metrics.map(metric => [metric, new Map(rankings[metric].rows
    .filter(row => row.type === "보통주").map(row => [row.id, row]))])) as Record<typeof metrics[number], Map<string, ArenaEntry>>;
  const eligible = [...byMetric.per.values()].filter(row => metrics.every(metric => {
    const candidate = byMetric[metric].get(row.id);
    const sign = candidate ? compareBusinessValues(candidate.value, 0) : null;
    return sign != null && (metric === "div" || metric === "dps" ? sign >= 0 : sign > 0);
  }));
  const divisionRanks = arenaDivisions.map(({ metric }) => {
    const value = (entry: ArenaEntry) => byMetric[metric].get(entry.id)!.value;
    const direction = metric === "div" ? -1 : 1;
    const ordered = eligible.toSorted((a, b) => direction * compareBusinessValues(value(a), value(b))!);
    let rank = 0;
    return new Map(ordered.map((entry, index) => {
      if (index === 0 || compareBusinessValues(value(entry), value(ordered[index - 1])) !== 0) rank = index + 1;
      return [entry.id, rank];
    }));
  });
  const sorted = eligible.map(entry => {
    const divisions = arenaDivisions.map((division, index) => ({ ...division, rank: divisionRanks[index].get(entry.id)!,
      value: byMetric[division.metric].get(entry.id)!.value, raw: byMetric[division.source].get(entry.id)!.value }));
    return { entry, divisions, total: divisions.reduce((sum, division) => sum + division.rank, 0) };
  }).sort((a, b) => a.total - b.total || a.entry.id.localeCompare(b.entry.id));
  let place = 0;
  const scores: ArenaScore[] = sorted.map((row, index) => {
    if (index === 0 || row.total !== sorted[index - 1].total) place = index + 1;
    return { ...row, place };
  }).filter(row => row.place <= 5);
  return { count: eligible.length, scores, ready: true };
}

export function arenaClosing(rows: RankingRow[], date: string) {
  const sample = rows.filter(row => row.securityHref && row.priceDate === date);
  const gainers = sample.filter(row => row.rate != null && row.rate > 0).sort((a, b) => b.rate! - a.rate!);
  const decliners = sample.filter(row => row.rate != null && row.rate < 0).sort((a, b) => a.rate! - b.rate!);
  const volume = sample.filter(row => row.volume != null).sort((a, b) => compareVolumes(a.volume, b.volume));
  const flat = sample.filter(row => row.rate === 0).length;
  return { sampleCount: rows.length, up: gainers.length, down: decliners.length,
    flat, unknown: rows.length - gainers.length - decliners.length - flat,
    groups: [{ label: "상승률", key: "up" as const, rows: gainers.slice(0, 3) },
      { label: "하락률", key: "down" as const, rows: decliners.slice(0, 3) },
      { label: "거래량", key: "volume" as const, rows: volume.slice(0, 3) }] };
}
