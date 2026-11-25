import { compareBusinessValues } from '../business-analysis';
import { securityPath } from '../entity-paths';
import type { ArenaHistory } from '../dashboard-arena';
import type { RankingMetric } from '../ranking-view';

type Member = { securityId: string; name: string; korName: string | null; type: string | null };
type Common = { date: string; securityId: string | null; exchange: string; ticker: string; name: string | null; korName: string | null };
type Capital = Common & { marketcap: string | null };
const metrics = ['per', 'pbr', 'eps', 'bps', 'dps', 'div'] as const;
type Financial = Common & Record<typeof metrics[number], string | null>;
type Candidate = { id: string; name: string; ticker: string; type: string | null; value: string | null; observedMarketcap: string | null };

function arenaDates(anchor: string) {
  const [year, month, day] = anchor.split('-').map(Number);
  const limit = new Date(Date.UTC(year - 1, month - 1, Math.min(day, new Date(Date.UTC(year - 1, month, 0)).getUTCDate())));
  const start = new Date(limit);
  start.setUTCDate(start.getUTCDate() - 14);
  return [start.toISOString().slice(0, 10), limit.toISOString().slice(0, 10)];
}

/** Assemble the same anniversary leaders from the histories already being frozen. */
export function createFrozenArenaAccumulator(anchor: string, codes: ReadonlyMap<string, string | null>) {
  const [start, end] = arenaDates(anchor);
  const eligible = (row: Common) => row.date >= start && row.date <= end && ['KOSPI', 'KOSDAQ'].includes(row.exchange);
  const key = (row: Common) => JSON.stringify([row.exchange, row.ticker]);
  const name = (row: Common, member: Member) => row.korName || member.korName || row.name || member.name || row.ticker;
  const capital = new Map<string, { row: Capital; member: Member }>();
  const financial: { row: Financial; member: Member }[] = [];
  let capitalDay = '', financialDay = '';
  return {
    observe(member: Member, financialRows: readonly Financial[], marketcapRows: readonly Capital[]) {
      for (const row of marketcapRows) if (eligible(row)) {
        capital.set(row.date + key(row), { row, member });
        if (row.date > capitalDay) capitalDay = row.date;
      }
      for (const row of financialRows) if (eligible(row) && row.date >= financialDay) {
        if (row.date > financialDay) financial.length = 0;
        financialDay = row.date;
        financial.push({ row, member });
      }
    },
    result() {
      const leaders: ArenaHistory = {};
      function save(metric: RankingMetric, date: string, candidates: Candidate[]) {
        const direction = metric === 'per' || metric === 'pbr' ? 1 : -1;
        const sorted = candidates.filter(({ value }) => {
          const sign = compareBusinessValues(value, 0);
          return sign != null && (direction === -1 || sign > 0);
        }).sort((a, b) => direction * compareBusinessValues(a.value, b.value)! || a.id.localeCompare(b.id));
        if (!sorted.length) return;
        const tied = new Map(sorted.filter(row => compareBusinessValues(row.value, sorted[0].value) === 0).map(row => [row.id, row]));
        leaders[metric] = { date, entries: [...tied.values()].map(row => ({ ...row, rank: 1,
          href: securityPath({ securityId: row.id, routeCode: codes.get(row.id) ?? null }, metric) })) };
      }
      for (const metric of metrics) save(metric, financialDay, financial.map(({ row, member }) => ({
        id: member.securityId, name: name(row, member), ticker: row.ticker, type: member.type, value: row[metric],
        observedMarketcap: capital.get(row.date + key(row))?.row.marketcap ?? null,
      })));
      save('marketcap', capitalDay, [...capital.values()].filter(({ row }) => row.date === capitalDay).map(({ row, member }) => ({
        id: member.securityId, name: name(row, member), ticker: row.ticker, type: member.type,
        value: row.marketcap, observedMarketcap: row.marketcap,
      })));
      return { anchor, leaders };
    },
  };
}
