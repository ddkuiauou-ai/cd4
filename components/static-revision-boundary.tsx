"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export function StaticRevisionBoundary({ revision, children }: { revision: string | null; children: ReactNode }) {
  const query = useSearchParams();
  const expected = query.getAll("revision").length === 1 ? query.get("revision") : null;
  if (expected !== null && expected !== revision) return <div className="empty-state" role="status"><h1 className="section-heading">자료가 갱신되었습니다</h1><p className="data-note mt-2">최신 자료에서 대시보드를 다시 확인해 주세요.</p><a href="/dashboard" className="inline-block mt-5 underline underline-offset-4">최신 자료 보기</a></div>;
  return children;
}
