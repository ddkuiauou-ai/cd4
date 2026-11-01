/** Screen geometry only. Exact price normalization happens before this boundary. */
export interface Point { x: number; y: number }
export type Segment = readonly Point[];
export interface Rect { x: number; y: number; width: number; height: number }
interface Size { width: number; height: number }

export interface RankingQuoteLayoutInput {
  segments: readonly Segment[];
  hasEndpoint: boolean;
  width: number;
  height: number;
  price: Size;
  rate: Size;
  overlay: boolean;
}

export interface RankingQuoteLayout {
  segments: Point[][];
  endpoint: Point | null;
  priceLeft: number;
  rateLeft: number;
  height: number;
  placement: "separate" | "overlay" | "safe";
}

const endpointRadius = 7;
const labelGap = 4;
const safeGap = endpointRadius + labelGap;
const minimumPlotHeight = 30;

// Liang–Barsky clipping includes contact with the rectangle boundary.
function segmentHitsRect(a: Point, b: Point, rect: Rect) {
  let start = 0, end = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  for (let index = 0; index < 4; index++) {
    if (Math.abs(p[index]) < 1e-9) {
      if (q[index] < 0) return false;
      continue;
    }
    const amount = q[index] / p[index];
    if (p[index] < 0) start = Math.max(start, amount);
    else end = Math.min(end, amount);
    if (start > end) return false;
  }
  return true;
}

function circleHitsRect(point: Point, radius: number, rect: Rect) {
  const nearX = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
  return Math.hypot(point.x - nearX, point.y - nearY) <= radius;
}

function collides(segments: readonly Segment[], endpoint: Point | null, rect: Rect) {
  const padded = { x: rect.x - labelGap, y: rect.y - labelGap,
    width: rect.width + labelGap * 2, height: rect.height + labelGap * 2 };
  for (const segment of segments) {
    if (segment.length === 1 && circleHitsRect(segment[0], 2 + labelGap, rect)) return true;
    for (let index = 1; index < segment.length; index++) {
      if (segmentHitsRect(segment[index - 1], segment[index], padded)) return true;
    }
  }
  return endpoint !== null && circleHitsRect(endpoint, safeGap, rect);
}

/** Keep gaps as separate segments and never change the supplied normalized points. */
export function layoutRankingQuote(input: RankingQuoteLayoutInput): RankingQuoteLayout {
  const { price, rate, overlay } = input;
  const width = Math.max(endpointRadius * 2, input.width);
  const height = overlay
    ? Math.max(input.height, 88, price.height + rate.height + safeGap * 2 + minimumPlotHeight)
    : Math.max(endpointRadius * 2, input.height);
  const map = (top: number, bottom: number): Point[][] => input.segments.filter(segment => segment.length)
    .map(segment => segment.map(point => ({
      x: endpointRadius + point.x * (width - endpointRadius * 2),
      y: top + point.y * (bottom - top),
    })));
  const lastPoint = (segments: Point[][]) => input.hasEndpoint ? segments.at(-1)?.at(-1) ?? null : null;
  let segments = map(endpointRadius, height - endpointRadius);
  let endpoint = lastPoint(segments);
  const priceRight = Math.max(0, width - price.width), rateRight = Math.max(0, width - rate.width);
  if (!overlay) return { segments, endpoint, priceLeft: priceRight, rateLeft: rateRight, height, placement: "separate" };

  const candidates = (size: Size, y: number): Rect[] => [
    { x: width - size.width, y, ...size }, { x: 0, y, ...size },
  ];
  const available = (rect: Rect) => rect.x >= 0 && rect.x + rect.width <= width
    && !collides(segments, endpoint, rect);
  const pricePosition = candidates(price, 0).find(available);
  const ratePosition = candidates(rate, height - rate.height).find(available);
  if (pricePosition && ratePosition) return { segments, endpoint, priceLeft: pricePosition.x,
    rateLeft: ratePosition.x, height, placement: "overlay" };

  segments = map(price.height + safeGap, height - rate.height - safeGap);
  endpoint = lastPoint(segments);
  return { segments, endpoint, priceLeft: priceRight, rateLeft: rateRight, height, placement: "safe" };
}
