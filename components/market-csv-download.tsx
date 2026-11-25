import { Download } from "lucide-react";
import styles from "./market-csv-download.module.css";
import type { MarketCsvMetadata } from "@/lib/csv/market";

export function MarketCsvDownload({ source }: { source: MarketCsvMetadata }) {
  return <a href={source.url} download className={styles.download}
    aria-label={`시장 전체 CSV, ${source.date}, ${source.rowCount.toLocaleString("ko-KR")}개 종목`}>
    <Download size={16} aria-hidden="true" />
    <span>시장 전체 CSV</span>
    <small><time dateTime={source.date}>{source.date.replaceAll("-", ".")}</time> · {source.rowCount.toLocaleString("ko-KR")}개</small>
  </a>;
}
