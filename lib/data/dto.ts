/** Exact, JSON-safe values at the database → web boundary. */
type FinancialDTOKey = "price" | "shares" | "marketcap" | "bps" | "per" | "pbr" | "eps" | "div" | "dps"
  | "open" | "high" | "low" | "close" | "volume" | "fvolume" | "transaction" | "value"
  | `${"price" | "shares" | "marketcap" | "bps" | "per" | "pbr" | "eps" | "div" | "dps"}LastProvided`;
type FinancialDTO<Value> = Value extends number ? string : DataDTO<Value>;
export type DataDTO<Value> = Value extends bigint | Date ? string
  : Value extends readonly (infer Item)[] ? DataDTO<Item>[]
  : Value extends object ? { [Key in keyof Value]: Key extends FinancialDTOKey ? FinancialDTO<Value[Key]> : DataDTO<Value[Key]> } : Value;

const financialKeys = new Set<string>(["price", "shares", "marketcap", "bps", "per", "pbr", "eps", "div", "dps",
  "open", "high", "low", "close", "volume", "fvolume", "transaction", "value",
  ...["price", "shares", "marketcap", "bps", "per", "pbr", "eps", "div", "dps"].map(metric => `${metric}LastProvided`)]);

const businessDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

export function businessDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);
    if (!Number.isFinite(date.getTime()) || businessDay.format(date) !== value) throw new Error("업무 날짜가 올바르지 않습니다.");
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("업무 날짜가 올바르지 않습니다.");
  return businessDay.format(date);
}

function isBusinessDateKey(key: string): boolean {
  return key === "date" || key === "asOf" || key === "valueObservedAt" || key.endsWith("Date");
}

export function toDataDTO<Value>(value: Value): DataDTO<Value> {
  const convert = (item: unknown, key = ""): unknown => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return isBusinessDateKey(key) ? businessDate(item) : item.toISOString();
    if (typeof item === "number" && !Number.isFinite(item)) throw new Error(`유한 숫자가 아닌 값: ${key}`);
    if (typeof item === "number" && financialKeys.has(key)) return String(item);
    if (Array.isArray(item)) return item.map((entry) => convert(entry));
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([name, entry]) => [name, convert(entry, name)]));
    }
    return item;
  };
  return convert(value) as DataDTO<Value>;
}

export function exactDecimal(value: number | bigint | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isSafeInteger(value))) {
    throw new Error("정확한 정수는 bigint 또는 십진 문자열로 전달해야 합니다.");
  }
  return String(value);
}
