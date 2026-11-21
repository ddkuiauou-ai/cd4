import { formatBusinessValue, roundBusinessValue, type BusinessValue } from './business-analysis';

export function usesInvestorPrecision(metric: string | undefined) {
  return metric === 'per' || metric === 'pbr' || metric === 'eps' || metric === 'bps' || metric === 'dps' || metric === 'div';
}

export function formatInvestorNumber(value: BusinessValue | undefined, unit: string, signed = false): string {
  const places = unit === '원' ? 0 : 2;
  const rounded = roundBusinessValue(value ?? null, places);
  if (rounded == null) return '—';
  if (rounded !== '0') {
    const formatted = formatBusinessValue(rounded);
    return formatted.startsWith('-') ? `−${formatted.slice(1)}` : signed ? `+${formatted}` : formatted;
  }

  const exact = formatBusinessValue(value);
  const tiny = exact.match(/^-?0\.(0*)[1-9]/);
  if (!tiny) return '0';

  const sign = exact.startsWith('-') ? '−' : signed ? '+' : '';
  const significant = roundBusinessValue(value ?? null, tiny[1].length + 1)!.replace(/^-/, '');
  const scientific = significant.match(/^0\.(0{6,})([1-9])$/);
  return sign + (scientific ? `${scientific[2]}e−${scientific[1].length + 1}` : significant);
}

export function formatInvestorAmount(value: BusinessValue | undefined, unit: string, signed = false): string {
  const number = formatInvestorNumber(value, unit, signed);
  return number === '—' ? number : number + unit;
}
