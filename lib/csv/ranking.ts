import {
  getRankingDownloadFilename,
  getRankingDownloadUrl,
  type RankingDownloadMetric,
  type RankingDownloadScope,
} from "../ranking-download";

export type CsvValue = string | number | boolean | null | undefined;

export interface RankingExportRow {
  currentRank: number | null;
  priorRank: number | null;
  companyId: string | null;
  securityId: string | null;
  name: string;
  ticker: string;
  exchange: string;
  type: string | null;
  value: number | null;
  metricDate: string | null;
}

export interface RankingExportSnapshot {
  scope: RankingDownloadScope;
  metric: RankingDownloadMetric;
  rankDate: string | null;
  referenceDate: string | null;
  generatedAt: string;
  totalCount: number;
  rows: RankingExportRow[];
}

const metricUnits: Record<RankingDownloadMetric, string> = {
  marketcap: "원", per: "배", pbr: "배", eps: "원", bps: "원", div: "%", dps: "원",
};

export const RANKING_CSV_COLUMNS = [
  "범위", "지표", "단위", "표시 참고 기준일", "순위 기준일", "파일 산출 시각", "전체 행 수",
  "현재 순위", "이전 순위", "순위 변화", "기업 ID", "종목 ID", "이름", "종목코드",
  "거래소", "종목 구분", "지표 값", "지표 기준일",
] as const;

export function csvDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Shared with detail-history downloads; callers can supply a stable column order.
export function serializeCsvRows(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[] = rows.length ? Object.keys(rows[0]) : [],
): string {
  if (!rows.length || !columns.length) return "";
  return [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ].join("\n");
}

export function serializeRankingCsv(snapshot: RankingExportSnapshot): string {
  getRankingDownloadUrl(snapshot.scope, snapshot.metric);
  if (!snapshot.rows.length || snapshot.totalCount !== snapshot.rows.length) {
    throw new Error("내려받을 순위 데이터가 없거나 행 개수가 일치하지 않습니다.");
  }
  const rows = snapshot.rows.map((row) => ({
    "범위": snapshot.scope,
    "지표": snapshot.metric,
    "단위": metricUnits[snapshot.metric],
    // Company tables contain current values with potentially different row dates.
    "표시 참고 기준일": snapshot.referenceDate,
    "순위 기준일": snapshot.rankDate,
    "파일 산출 시각": snapshot.generatedAt,
    "전체 행 수": snapshot.totalCount,
    "현재 순위": row.currentRank,
    "이전 순위": row.priorRank,
    "순위 변화": row.priorRank !== null && row.currentRank !== null
      ? row.priorRank - row.currentRank
      : null,
    "기업 ID": row.companyId,
    "종목 ID": row.securityId,
    "이름": row.name,
    // Preserve the existing Excel-oriented ticker convention, including leading zeros.
    "종목코드": row.ticker ? `'${row.ticker}` : null,
    "거래소": row.exchange,
    "종목 구분": row.type,
    "지표 값": row.value,
    "지표 기준일": row.metricDate,
  }));
  return "\uFEFF" + serializeCsvRows(rows, RANKING_CSV_COLUMNS);
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const text = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === ",") {
      record.push(field);
      field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV 인용 부호가 닫히지 않았습니다.");
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export interface RankingCsvMetadata {
  scope: RankingDownloadScope;
  metric: RankingDownloadMetric;
  referenceDate: string | null;
  rankDate: string | null;
  generatedAt: string;
  totalCount: number;
  filename: string;
}

export interface RankingCsvExpectedRow {
  id: string;
  rank: number | null;
  priorRank: number | null;
  value: number | null;
  metricDate: string | null;
}

// Compare the visible company's actual rows, rather than treating its first
// row's date as a shared snapshot date. This also works on later ranking pages.
export function hasCompanyRankingCsvChanges(csv: string, expectedRows: readonly RankingCsvExpectedRow[]): boolean {
  const [headers, ...rows] = parseCsvRecords(csv);
  if (!headers || headers.join("\u0000") !== RANKING_CSV_COLUMNS.join("\u0000")) {
    throw new Error("전체 순위 CSV 형식이 올바르지 않습니다.");
  }
  const exported = new Map(rows.map(row => [row[10], row]));
  const number = (value: string) => value === "" ? null : Number(value);
  return expectedRows.some(expected => {
    const row = exported.get(expected.id);
    return !row || number(row[7]) !== expected.rank || number(row[8]) !== expected.priorRank
      || number(row[16]) !== expected.value || (row[17] || null) !== expected.metricDate;
  });
}

// Static hosts need not preserve custom response headers. Read the same basis
// from the CSV itself and reject HTML/error responses or incomplete files.
export function readRankingCsvMetadata(csv: string): RankingCsvMetadata {
  const [headers, ...rows] = parseCsvRecords(csv);
  if (!headers || headers.join("\u0000") !== RANKING_CSV_COLUMNS.join("\u0000") || !rows.length) {
    throw new Error("전체 순위 CSV 형식이 올바르지 않습니다.");
  }
  const first = rows[0];
  const scope = first[0] as RankingDownloadScope;
  const metric = first[1] as RankingDownloadMetric;
  getRankingDownloadUrl(scope, metric);
  const totalCount = Number(first[6]);
  if (!Number.isInteger(totalCount) || totalCount !== rows.length || !first[5]
    || rows.some((row) => row.length !== headers.length
      || row.slice(0, 7).join("\u0000") !== first.slice(0, 7).join("\u0000"))) {
    throw new Error("전체 순위 CSV의 행 개수나 기준 정보가 일치하지 않습니다.");
  }
  const referenceDate = first[3] || null;
  return {
    scope, metric, referenceDate,
    rankDate: first[4] || null,
    generatedAt: first[5],
    totalCount,
    filename: getRankingDownloadFilename(scope, metric, referenceDate),
  };
}
