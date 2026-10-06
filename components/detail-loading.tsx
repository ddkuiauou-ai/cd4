export function DetailLoading() {
    return <div className="app-container detail-grid" aria-busy="true" aria-label="상세 정보를 불러오는 중">
        <div className="detail-content min-w-0 space-y-6">
            <p className="text-sm text-muted-foreground" role="status">상세 정보를 불러오는 중…</p>
            <div className="h-12 w-64 max-w-full animate-pulse bg-muted" />
            <div className="grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse bg-muted" />)}</div>
            <div className="flex gap-4 overflow-hidden border-b border-border py-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-5 w-16 shrink-0 animate-pulse bg-muted" />)}</div>
            <div className="h-72 animate-pulse border border-border bg-muted/30" />
        </div>
        <aside className="context-rail hidden xl:block"><div className="h-6 w-32 animate-pulse bg-muted" /><div className="mt-6 h-72 animate-pulse bg-background" /></aside>
    </div>;
}
