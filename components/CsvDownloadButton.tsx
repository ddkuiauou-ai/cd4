"use client";

import { useState, type MouseEvent } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasCompanyRankingCsvChanges, readRankingCsvMetadata, serializeCsvRows, type RankingCsvExpectedRow } from "@/lib/csv/ranking";
import {
  getRankingDownloadFilename,
  getRankingDownloadUrl,
  type RankingDownloadMetric,
  type RankingDownloadScope,
} from "@/lib/ranking-download";

function downloadCSV(csvString: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csvString.replace(/^\uFEFF/, "")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface CsvDownloadButtonProps {
  data?: readonly Record<string, unknown>[];
  filename?: string;
  className?: string;
  scope?: RankingDownloadScope;
  metric?: RankingDownloadMetric;
  // A page's reference date is not a guarantee that all company rows share it.
  expectedDate?: string | null;
  expectedCompanyRows?: RankingCsvExpectedRow[];
  expectedTotalCount?: number;
}

export function CsvDownloadButton({
  data, filename = "data.csv", className, scope, metric, expectedDate, expectedCompanyRows, expectedTotalCount,
}: CsvDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [hasNewBasis, setHasNewBasis] = useState(false);
  const isRanking = scope !== undefined && metric !== undefined;
  const href = isRanking ? getRankingDownloadUrl(scope, metric) : undefined;

  const handleRankingDownload = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isDownloading || !href || !scope || !metric) return;
    setIsDownloading(true);
    setHasError(false);
    setHasNewBasis(false);
    setMessage("전체 순위 CSV를 준비하고 있어요.");
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) throw new Error("CSV 요청에 실패했습니다.");
      const csv = await response.text();
      const metadata = readRankingCsvMetadata(csv);
      if (metadata.scope !== scope || metadata.metric !== metric) {
        throw new Error("요청한 지표와 파일의 범위가 일치하지 않습니다.");
      }
      downloadCSV(csv, metadata.filename);
      const changed = scope === "company"
        ? Boolean((expectedTotalCount != null && expectedTotalCount !== metadata.totalCount)
          || (expectedCompanyRows && hasCompanyRankingCsvChanges(csv, expectedCompanyRows)))
        : Boolean(expectedDate && expectedDate !== metadata.referenceDate);
      setHasNewBasis(changed);
      setMessage(changed
        ? scope === "company"
          ? "다운로드 시작 · 파일의 기업 순위·값 또는 기준일이 화면과 달라요. 기업별 기준일은 파일에서 확인하세요."
          : `다운로드 시작 · 파일 참고 기준일 ${metadata.referenceDate ?? "미확인"}. 화면의 기준일과 달라요.`
        : `다운로드 시작 · 전체 ${metadata.totalCount.toLocaleString("ko-KR")}행${scope === "company" ? " · 기업별 기준일은 파일에서 확인하세요." : ""}`);
    } catch {
      setHasError(true);
      setMessage("CSV를 내려받지 못했어요. 다시 눌러 시도해 주세요.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleHistoryDownload = () => {
    if (!data?.length) return;
    setHasError(false);
    try {
      downloadCSV(serializeCsvRows(data), filename);
      setMessage("다운로드 시작");
    } catch {
      setHasError(true);
      setMessage("CSV를 내려받지 못했어요. 다시 눌러 시도해 주세요.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      {isRanking && href ? (
        <Button asChild variant="outline" size="sm" className={cn("min-h-10", className)}>
          <a
            href={href}
            download={getRankingDownloadFilename(scope, metric, expectedDate)}
            aria-disabled={isDownloading}
            aria-busy={isDownloading}
            onClick={(event) => void handleRankingDownload(event)}
          >
            {isDownloading ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="mr-2 h-4 w-4" />}
            {isDownloading ? "준비 중…" : "전체 순위 CSV"}
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleHistoryDownload}
          disabled={!data?.length}
          variant="outline"
          size="sm"
          className={cn("min-h-10", className)}
        >
          <Download aria-hidden="true" className="mr-2 h-4 w-4" />
          CSV 다운로드
        </Button>
      )}
      {(message || isRanking) && (
        <p role="status" aria-live="polite" className={cn("max-w-72 text-xs leading-relaxed", hasError ? "text-destructive" : "text-muted-foreground")}>
          {message || "전체 순위 · 엑셀에서 열 수 있어요"}
          {hasNewBasis && (
            <button type="button" onClick={() => window.location.reload()} className="ml-2 rounded-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              화면 새로고침
            </button>
          )}
        </p>
      )}
    </div>
  );
}
