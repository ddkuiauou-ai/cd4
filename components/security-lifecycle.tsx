import Link from 'next/link';
import {lifecycleTimeline,type SecurityListingPeriod,type SecurityLifecycleEvent} from '@/lib/security-lifecycle';
import type {DetailSearch} from './detail-surface';

export function SecurityLifecycle({periods,events,selected,route,search}: {
  periods:readonly SecurityListingPeriod[];events:readonly SecurityLifecycleEvent[];
  selected:SecurityListingPeriod|null;route:string;search:DetailSearch;
}) {
  if (!periods.length && !events.length) return null;
  const ordered=[...periods].sort((a,b)=>a.listingDate.localeCompare(b.listingDate));
  const timeline=lifecycleTimeline(periods,events);
  const href=(periodId:string)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(search)) if(key!=='period'&&value!=null) params.set(key,Array.isArray(value)?value[0]:value);
    params.set('period',periodId);return `${route}?${params}`;
  };
  return <section aria-label="상장 기간과 이름 변경 이력" className="my-5 rounded-md border border-border p-4">
    <h2 className="text-base font-semibold">상장 기간 · 이름 변경</h2>
    <p className="mt-1 text-xs text-muted-foreground">지표와 차트는 선택한 상장 기간 안의 자료만 표시합니다.</p>
    <nav aria-label="상장 기간 선택" className="mt-3 flex flex-wrap gap-2">
      {ordered.map((period,index)=><Link key={period.periodId} prefetch={false} href={href(period.periodId)}
        aria-current={period.periodId===selected?.periodId?'page':undefined}
        className={`min-h-10 rounded border px-3 py-2 text-sm ${period.periodId===selected?.periodId?'border-primary bg-muted font-semibold':'border-border'}`}>
        {index+1}차 상장{period.displayName ? ` (${period.displayName})` : ''}{period.displayExchange ? ` · ${period.displayExchange}` : ''} · {period.listingDate} ~ {period.delistingDate || '현재'}
      </Link>)}
    </nav>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">전체 연혁 보기</summary>
      <ol className="mt-3 space-y-3 border-l border-border pl-4">{timeline.map(item=><li key={item.id}>
        <div className="flex flex-wrap gap-x-3"><time dateTime={item.date || undefined} className="text-xs text-muted-foreground">{item.dateLabel}</time><strong className="text-sm">{item.label}</strong></div>
        <p className="mt-1 text-sm">{item.detail}</p>
        {item.sourceRef && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">근거</summary><p className="mt-1 break-all">{item.sourceRef}</p></details>}
      </li>)}</ol>
      <p className="mt-3 text-xs text-muted-foreground">명단으로 판단한 상장·상장폐지 날짜는 관측 경계입니다. 이름 변경일의 정확도는 연혁에 표시합니다.</p>
    </details>
  </section>;
}
