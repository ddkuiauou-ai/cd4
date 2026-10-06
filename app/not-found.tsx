import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <section className="app-container py-16">
        <div className="empty-state">
          <p className="data-note mb-3">404 · 페이지 없음</p>
          <h1 className="page-heading">찾으시는 페이지가 없습니다</h1>
          <p className="data-note mt-3">주소를 확인하거나 전체 랭킹에서 다시 찾아보세요.</p>
          <Link href="/" className="inline-flex min-h-11 items-center mt-5 underline underline-offset-4">전체 랭킹으로 이동</Link>
        </div>
      </section>
    </AppShell>
  );
}
