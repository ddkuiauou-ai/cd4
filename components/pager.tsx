import { SiteDocumentLink as RankingDocumentLink, usesStaticDocuments } from "./site-document-link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { scopedRankingPagePath } from "@/lib/ranking-page-address";
import { getRankingPager } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

interface PagerProps {
  basePath: string;
  currentPage: number;
  totalPages?: number;
  totalCount?: number;
  nextCount?: number;
  scopeKey?: string;
  query?: string;
}

export function Pager({ basePath, currentPage, totalPages, totalCount, nextCount, query, scopeKey = "krx-all" }: PagerProps) {
  const pager = getPager(currentPage, totalPages);
  if (!pager || (!pager.prev && !pager.next)) return null;
  const pageURL = (page: number) => {
    const path = scopedRankingPagePath(basePath, usesStaticDocuments ? scopeKey : "krx-all", page);
    return path + (query ? `?${query}` : "");
  };
  const ranges = totalCount != null && totalPages != null ? Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const start = index === 0 ? 1 : 21 + (index - 1) * 100;
    const end = Math.min(totalCount, index === 0 ? 20 : start + 99);
    return { page, start, end };
  }) : [];
  return (
    <nav className={styles.pager} aria-label="순위 목록 페이지">
      {pager.prev && <RankingDocumentLink href={pageURL(pager.prev)} className={styles.pageLink} rel="prev"><ArrowLeft size={15} aria-hidden="true" />이전 페이지</RankingDocumentLink>}
      <span className={styles.pageIndicator} aria-current="page">
        <span aria-hidden="true">{totalPages == null ? `${currentPage} 페이지` : `${currentPage} / ${totalPages} 페이지`}</span>
        <span className="sr-only">{currentPage}페이지{totalPages != null && `, 전체 ${totalPages}페이지`}</span>
      </span>
      {ranges.length > 1 && <details className={styles.pageRanges}>
        <summary>목록 범위</summary>
        <ul aria-label="목록 내 표시 순서">{ranges.map(({ page, start, end }) => <li key={page}>
          <RankingDocumentLink href={pageURL(page)} aria-current={page === currentPage ? "page" : undefined}>
            {start.toLocaleString("ko-KR")}{end > start && `–${end.toLocaleString("ko-KR")}`}
          </RankingDocumentLink>
        </li>)}</ul>
      </details>}
      {pager.next && <RankingDocumentLink href={pageURL(pager.next)} className={styles.pageLink} rel="next">{nextCount != null && nextCount > 0 ? `다음 ${nextCount}개` : "다음 페이지"}<ArrowRight size={15} aria-hidden="true" /></RankingDocumentLink>}
    </nav>
  );
}

export function getPager(page: number, totalPages?: number) {
  return getRankingPager(page, totalPages);
}
