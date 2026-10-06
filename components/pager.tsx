import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getRankingPager } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

interface PagerProps {
  basePath: string;
  currentPage: number;
  totalPages?: number;
  nextCount?: number;
}

export function Pager({ basePath, currentPage, totalPages, nextCount }: PagerProps) {
  const pager = getPager(currentPage, totalPages);
  if (!pager || (!pager.prev && !pager.next)) return null;
  const pageURL = (page: number) => page === 1 ? basePath : `${basePath}/${page}`;
  return (
    <nav className={styles.pager} aria-label="순위 목록 페이지">
      <span className="sr-only">{currentPage}페이지{totalPages != null && ` / 전체 ${totalPages}페이지`}</span>
      {pager.prev && <Link href={pageURL(pager.prev)} className={styles.pageLink} rel="prev"><ArrowLeft size={15} aria-hidden="true" />이전 페이지</Link>}
      {pager.next && <Link href={pageURL(pager.next)} className={styles.pageLink} rel="next">{nextCount != null && nextCount > 0 ? `다음 ${nextCount}개` : "다음 페이지"}<ArrowRight size={15} aria-hidden="true" /></Link>}
    </nav>
  );
}

export function getPager(page: number, totalPages?: number) {
  return getRankingPager(page, totalPages);
}
