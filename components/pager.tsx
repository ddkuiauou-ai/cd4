"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface PagerProps {
  basePath: string;
  currentPage: number;
  totalPages?: number; // 마지막 페이지 여부를 판단해 '다음' 버튼 제어
}

export function Pager({ basePath, currentPage, totalPages }: PagerProps) {
  const pager = getPager(currentPage);

  const createPageURL = (pageNumber: number) => {
    if (pageNumber === 1) {
      // 첫 페이지는 해당 랭킹의 루트 경로 (예: '/marketcaps')
      return basePath;
    }
    // 2페이지 이상은 basePath 뒤에 페이지 번호 추가 (예: '/marketcaps/2', '/per/2')
    return `${basePath}/${pageNumber}`;
  };

  if (!pager) {
    return null;
  }

  return (
    <div className="flex flex-row items-center justify-between gap-4">
      {pager?.prev ? (
        <Link
          href={createPageURL(pager.prev)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "min-h-[48px] px-6 py-3 text-sm font-medium rounded-xl border-2 hover:border-primary/40 hover:bg-primary/8 hover:scale-[1.02] transition-all duration-300 touch-manipulation"
          )}
        >
          <ChevronLeftIcon className="mr-2 h-5 w-5" />
          이전 페이지
        </Link>
      ) : (
        <div />
      )}
      {pager?.next && (!totalPages || currentPage < totalPages) && (
        <Link
          href={createPageURL(pager.next)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "min-h-[48px] px-6 py-3 text-sm font-medium rounded-xl border-2 hover:border-primary/40 hover:bg-primary/8 hover:scale-[1.02] transition-all duration-300 touch-manipulation",
            pager?.prev ? "ml-auto" : ""
          )}
        >
          다음 페이지
          <ChevronRightIcon className="ml-2 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export function getPager(page: number) {
  const prev = page > 1 ? page - 1 : null;
  const next = page + 1; // 실제로는 마지막 페이지인지 확인 필요
  return {
    prev,
    next,
  };
}
