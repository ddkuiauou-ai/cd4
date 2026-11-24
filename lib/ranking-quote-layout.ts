/** Screen geometry only. Exact price normalization happens before this boundary. */
interface Point { x: number; y: number }
type Segment = readonly Point[];

const endpointRadius = 7;

export function layoutRankingQuote({
  segments, hasEndpoint, width, height,
}: {
  segments: readonly Segment[];
  hasEndpoint: boolean;
  width: number;
  height: number;
}) {
  const inset = endpointRadius * 2;
  const plotWidth = Math.max(width, inset);
  const plotHeight = Math.max(height, inset);
  const points = segments.filter(segment => segment.length)
    .map(segment => segment.map(({ x, y }) => ({
      x: endpointRadius + x * (plotWidth - inset),
      y: endpointRadius + y * (plotHeight - inset),
    })));

  return {
    width: plotWidth,
    height: plotHeight,
    segments: points,
    endpoint: hasEndpoint ? points.at(-1)?.at(-1) ?? null : null,
  };
}
