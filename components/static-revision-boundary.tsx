"use client";

import type { ReactNode } from "react";
import { SiteDocumentLink } from "@/components/site-document-link";
import { useSearchParams } from "next/navigation";

export function StaticRevisionBoundary({ revision, children }: { revision: string | null; children: ReactNode }) {
  const query = useSearchParams();
  const expected = query.getAll("revision").length === 1 ? query.get("revision") : null;
  if (expected !== null && expected !== revision) return <div className="empty-state" role="status"><h1 className="section-heading">자료가 갱신되었습니다</h1><p className="data-note mt-2">최신 자료로 대회장을 다시 열어 주세요.</p><SiteDocumentLink href="/dashboard" className="inline-block mt-5 underline underline-offset-4">최신 자료 보기</SiteDocumentLink></div>;
  return children;
}
