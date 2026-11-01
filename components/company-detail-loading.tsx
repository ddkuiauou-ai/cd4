/** Initial company entry has two views; loaded tab changes keep their real header. */
export function CompanyDetailLoading() {
  return <div className="app-container detail-grid" aria-busy="true" aria-label="기업 정보를 불러오는 중">
    <div className="detail-content min-w-0 space-y-6">
      <p className="text-sm text-muted-foreground" role="status">기업 정보를 불러오는 중…</p>
      <div className="h-12 w-64 max-w-full animate-pulse bg-muted" />
      <div className="detail-entity-grid" aria-hidden="true">
        <div className="detail-entity-aggregate h-20 animate-pulse border border-border bg-muted" />
        {Array.from({ length: 2 }, (_, index) => <div key={index} className="h-20 animate-pulse border border-border bg-muted" />)}
      </div>
      <div className="detail-metric-nav detail-company-nav" aria-hidden="true">
        <span className="h-11 animate-pulse bg-muted" /><span className="h-11 animate-pulse bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2" aria-hidden="true">
        <div className="h-64 animate-pulse bg-muted/30" /><div className="h-64 animate-pulse bg-muted/30" />
      </div>
    </div>
    <aside className="context-rail hidden xl:block" aria-hidden="true"><div className="h-6 w-32 animate-pulse bg-muted" /><div className="mt-6 h-72 animate-pulse bg-background" /></aside>
  </div>;
}
