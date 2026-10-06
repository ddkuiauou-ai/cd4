"use client";
import Link from 'next/link';
export default function DetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <div className="app-container py-12">
        <h1 className="text-2xl font-semibold">상세 정보를 불러오지 못했습니다</h1>
        <p className="mt-3 text-sm text-muted-foreground">잠시 후 다시 시도하거나 다른 종목을 확인해 주세요.</p>
        <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="min-h-11 border border-border px-4 text-sm font-medium hover:bg-muted">다시 시도</button>
            <Link href="/marketcaps" className="inline-flex min-h-11 items-center px-4 text-sm underline underline-offset-4">전체 순위 보기</Link>
        </div>
    </div>;
}
