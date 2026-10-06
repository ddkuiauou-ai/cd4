/** Canvas charts need resolved colors; SVG charts can use the CSS tokens directly. */
export function readChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback;

  return {
    background: read("--background", "#ffffff"),
    foreground: read("--foreground", "#181a1c"),
    muted: read("--muted-foreground", "#59636b"),
    border: read("--border", "#e6e6e6"),
    up: read("--market-up", "#dc3030"),
    down: read("--market-down", "#1d5fbf"),
    line: read("--chart-2", "#1d5fbf"),
    volume: read("--chart-5", "#738c76"),
    average: read("--brand-ink", "#a26300"),
  };
}

export function chartColorWithAlpha(color: string, alpha: number) {
  const hex = color.match(/^#([\da-f]{6})$/i);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})` : color;
}

export const heatmapTheme = {
  text: { fill: "var(--muted-foreground)" },
  axis: {
    ticks: { text: { fill: "var(--muted-foreground)" } },
    legend: { text: { fill: "var(--muted-foreground)" } },
  },
  legends: { text: { fill: "var(--muted-foreground)" } },
  tooltip: {
    container: {
      background: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      boxShadow: "0 4px 12px rgb(0 0 0 / 0.14)",
    },
  },
};

/** Choose cell text independently of the page theme, using the cell's data color. */
export function heatmapLabelColor({ color }: { color: string }) {
  const hex = color.match(/^#([\da-f]{6})$/i);
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  const channels = hex
    ? [0, 2, 4].map((start) => Number.parseInt(hex[1].slice(start, start + 2), 16))
    : rgb ? rgb.slice(1, 4).map(Number) : [255, 255, 255];
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
