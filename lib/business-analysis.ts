export type BusinessValue = number | string | null;
export type BusinessObservation = { date: string; value: BusinessValue; state?: string };

type Decimal = { coefficient: bigint; scale: number };

// Exact decimal arithmetic keeps market capitalizations above JS's safe integer range intact.
function decimal(value: BusinessValue): Decimal | null {
  if (value === null || (typeof value === 'number' && !Number.isFinite(value))) return null;
  const match = String(value).match(/^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return null;
  let coefficient = BigInt(`${match[1] === '-' ? '-' : ''}${match[2]}${match[3] ?? ''}`);
  let scale = (match[3]?.length ?? 0) - exponent;
  if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
  return { coefficient, scale };
}

function decimalString(coefficient: bigint, scale: number): string {
  const sign = coefficient < 0n ? '-' : '';
  const digits = (coefficient < 0n ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (!scale) return sign + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return `${sign}${digits.slice(0, -scale)}${fraction ? `.${fraction}` : ''}`;
}

function divide(numerator: bigint, denominator: bigint, places: number): string {
  const sign = numerator < 0n ? -1n : 1n;
  const scaled = (numerator < 0n ? -numerator : numerator) * 10n ** BigInt(places);
  const rounded = (scaled + denominator / 2n) / denominator;
  return decimalString(sign * rounded, places);
}

export function formatBusinessValue(value: BusinessValue | undefined): string {
  if (value === undefined) return '—';
  const parsed = decimal(value);
  if (!parsed) return '—';
  const [whole, fraction] = decimalString(parsed.coefficient, parsed.scale).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}

export function compareBusinessValues(left: BusinessValue, right: BusinessValue): number | null {
  const a = decimal(left), b = decimal(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const difference = a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale);
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
}

export function addBusinessValues(values: readonly BusinessValue[]): string | null {
  const parsed = values.flatMap(value => { const result = decimal(value); return result ? [result] : []; });
  if (!parsed.length) return null;
  const scale = Math.max(...parsed.map(value => value.scale));
  return decimalString(parsed.reduce((sum, value) => sum + value.coefficient * 10n ** BigInt(scale - value.scale), 0n), scale);
}

export function businessChangePercent(previous: BusinessValue, current: BusinessValue): string | null {
  const a = decimal(previous), b = decimal(current);
  if (!a || !b || a.coefficient <= 0n) return null;
  const scale = Math.max(a.scale, b.scale);
  const first = a.coefficient * 10n ** BigInt(scale - a.scale);
  const last = b.coefficient * 10n ** BigInt(scale - b.scale);
  return divide((last - first) * 100n, first, 2);
}

export function subtractBusinessValues(current: BusinessValue, previous: BusinessValue): string | null {
  const a = decimal(current), b = decimal(previous);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  return decimalString(a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale), scale);
}

/** Round only the display amount; the original value stays available to CSV/tooltips. */
export function formatCompactBusinessValue(value: BusinessValue | undefined, digits?: number): string {
  const parsed = value === undefined ? null : decimal(value);
  if (!parsed) return '—';
  const magnitude = parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient;
  const power = 10n ** BigInt(parsed.scale);
  const units = [
    { divisor: 1_000_000_000_000n, label: '조' },
    { divisor: 100_000_000n, label: '억' },
    { divisor: 1_000_000n, label: '백만' },
    { divisor: 10_000n, label: '만' },
    { divisor: 1_000n, label: '천' },
  ];
  const unit = units.find(unit => magnitude >= unit.divisor * power);
  if (!unit) return formatBusinessValue(value);
  const places = digits ?? (magnitude >= unit.divisor * power * 10n ? 0 : 1);
  return `${divide(parsed.coefficient, unit.divisor * power, Math.max(0, Math.min(places, 8)))}${unit.label}`;
}

/** Normalize exact source decimals before converting a chart coordinate to Number. */
export function projectBusinessChartRows<Row extends BusinessObservation>(rows: readonly Row[], domain: readonly BusinessObservation[] = rows) {
  const values = provided([...domain]);
  if (!values.length) return { rows: rows.map(row => ({ ...row, plot: null as number | null })), min: null, max: null };
  const scale = Math.max(...values.map(row => row.parsed.scale));
  const coefficients = values.map(row => row.parsed.coefficient * 10n ** BigInt(scale - row.parsed.scale));
  const min = coefficients.reduce((a, b) => a < b ? a : b);
  const max = coefficients.reduce((a, b) => a > b ? a : b);
  return { min: decimalString(min, scale), max: decimalString(max, scale), rows: rows.map(row => {
    const value = !row.state || row.state === 'provided' ? decimal(row.value) : null;
    if (!value) return { ...row, plot: null as number | null };
    const commonScale = Math.max(scale, value.scale);
    const multiplier = 10n ** BigInt(commonScale - scale);
    const offset = value.coefficient * 10n ** BigInt(commonScale - value.scale) - min * multiplier;
    const range = (max - min) * multiplier;
    return { ...row, plot: range === 0n ? 0.5 : Number(offset * 1_000_000_000_000n / range) / 1_000_000_000_000 };
  }) };
}

export function businessChartAxisValue(minimum: BusinessValue, maximum: BusinessValue, coordinate: number): string | null {
  const min = decimal(minimum), max = decimal(maximum);
  if (!min || !max || !Number.isFinite(coordinate)) return null;
  const scale = Math.max(min.scale, max.scale);
  const a = min.coefficient * 10n ** BigInt(scale - min.scale);
  const b = max.coefficient * 10n ** BigInt(scale - max.scale);
  const ratio = BigInt(Math.round(Math.max(0, Math.min(1, coordinate)) * 1_000_000));
  return decimalString(a * 1_000_000n + (b - a) * ratio, scale + 6);
}

export function isBusinessDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function selectBusinessWindow(rows: BusinessObservation[], start?: string, end?: string) {
  return rows.filter(row => isBusinessDay(row.date) && (!start || row.date >= start) && (!end || row.date <= end))
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

function provided(rows: BusinessObservation[]) {
  return rows.flatMap(row => {
    if (row.state && row.state !== 'provided') return [];
    const value = decimal(row.value);
    return value ? [{ ...row, parsed: value }] : [];
  });
}

export function summarizeBusinessWindow(rows: BusinessObservation[]) {
  const values = provided(selectBusinessWindow(rows));
  if (!values.length) return { count: 0, start: null, end: null, mean: null, min: null, max: null, difference: null, changePercent: null };
  const scale = Math.max(...values.map(row => row.parsed.scale));
  const coefficients = values.map(row => row.parsed.coefficient * 10n ** BigInt(scale - row.parsed.scale));
  const sum = coefficients.reduce((total, value) => total + value, 0n);
  const min = coefficients.reduce((lowest, value) => value < lowest ? value : lowest);
  const max = coefficients.reduce((highest, value) => value > highest ? value : highest);
  const first = coefficients[0];
  const last = coefficients.at(-1)!;
  return {
    count: values.length,
    start: values[0].date,
    end: values.at(-1)!.date,
    mean: divide(sum, BigInt(values.length) * 10n ** BigInt(scale), 4),
    min: decimalString(min, scale),
    max: decimalString(max, scale),
    difference: values.length > 1 ? decimalString(last - first, scale) : null,
    changePercent: values.length > 1 && first > 0n ? divide((last - first) * 100n, first, 2) : null,
  };
}

export function businessChartSegments(rows: BusinessObservation[], width = 720, height = 180): string[] {
  const ordered = selectBusinessWindow(rows);
  const values = provided(ordered);
  if (!values.length) return [];
  const scale = Math.max(...values.map(row => row.parsed.scale));
  const normalized = values.map(row => row.parsed.coefficient * 10n ** BigInt(scale - row.parsed.scale));
  const min = normalized.reduce((a, b) => a < b ? a : b);
  const max = normalized.reduce((a, b) => a > b ? a : b);
  const from = Date.parse(`${ordered[0].date}T00:00:00Z`);
  const to = Date.parse(`${ordered.at(-1)!.date}T00:00:00Z`);
  const segments: string[] = [];
  let segment: string[] = [];
  for (const row of ordered) {
    const value = (!row.state || row.state === 'provided') ? decimal(row.value) : null;
    if (!value) {
      if (segment.length) segments.push(segment.join(' '));
      segment = [];
      continue;
    }
    const coefficient = value.coefficient * 10n ** BigInt(scale - value.scale);
    const x = to === from ? width / 2 : (Date.parse(`${row.date}T00:00:00Z`) - from) / (to - from) * width;
    // Convert only a normalized display ratio, never the source integer, to number.
    const ratio = max === min ? 0.5 : Number((coefficient - min) * 1_000_000n / (max - min)) / 1_000_000;
    segment.push(`${x.toFixed(2)},${(height - ratio * height).toFixed(2)}`);
  }
  if (segment.length) segments.push(segment.join(' '));
  return segments;
}
