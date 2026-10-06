import { formatNumber } from '@/lib/utils';
import type { DetailCompanyData } from './detail-types';

type CompanyData = NonNullable<DetailCompanyData>;
type HistoryObservation = CompanyData['aggregatedHistory'][number];

const dateKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10);

export function DetailCompanyHistoryObservation({ data, observation, count, selectedSecurityId }: {
    data: CompanyData; observation: HistoryObservation; count: number; selectedSecurityId?: string;
}) {
    const date = dateKey(observation.date);
    const rows: Array<{ id: string; label: string; value: number | null; selected: boolean }> = [
        { id: 'aggregate', label: '등록된 시가총액 합계', value: observation.totalMarketcap, selected: !selectedSecurityId },
        ...data.securities.map(security => {
            const record = security.marketcapHistory.find(item => dateKey(item.date) === date);
            const name = security.korName || security.name || security.ticker || '종목';
            return {
                id: security.securityId,
                label: `${name}${security.type ? ` · ${security.type}` : ''}${security.ticker ? ` · ${security.ticker}` : ''}`,
                value: record?.marketcap != null ? observation.securitiesBreakdown[security.securityId] ?? record.marketcap : null,
                selected: security.securityId === selectedSecurityId,
            };
        }),
    ];
    if (selectedSecurityId) rows.sort((a, b) => Number(b.selected) - Number(a.selected));
    const selectedObservation = selectedSecurityId ? rows.find(row => row.id === selectedSecurityId) : undefined;
    const selectedMissing = Boolean(selectedSecurityId && (selectedObservation?.value == null || !Number.isFinite(selectedObservation.value)));
    return <div className="space-y-3" data-history-state="sparse">
        <p className="text-sm font-medium tabular-nums">이력 기준 {date} · 기록 {count}개</p>
        <p className="text-sm text-muted-foreground">추이를 그릴 이력이 부족합니다. 등록된 날짜의 값을 표시합니다.</p>
        {selectedMissing && <p className="text-sm text-muted-foreground">선택한 종목의 이력이 이 날짜에 등록되어 있지 않습니다. 기업 합산과 다른 종목의 비교값을 함께 표시합니다.</p>}
        <dl className="divide-y divide-border text-sm">
            {rows.map(row => <div key={row.id} data-history-security={row.id} data-selected={row.selected} className="flex items-start justify-between gap-4 py-3">
                <dt className={`min-w-0 ${row.selected ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{row.label}{selectedSecurityId && <span className="mt-1 block text-xs font-normal text-muted-foreground">{row.selected ? '선택 종목' : row.id === 'aggregate' ? '기업 합산 비교' : '비교 종목'}</span>}</dt>
                <dd className="min-w-0 text-right tabular-nums">
                    <span className={`block ${row.selected ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'}`}>{row.value != null && Number.isFinite(row.value) ? formatNumber(row.value, '원') : '미등록'}</span>
                    {row.value != null && Number.isFinite(row.value) && <span className="mt-1 block break-all text-xs text-muted-foreground">{row.value.toLocaleString('ko-KR')}원</span>}
                </dd>
            </div>)}
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">합계는 해당 날짜에 등록된 종목 값 기준입니다. 미등록 종목의 값은 포함되지 않습니다.</p>
    </div>;
}
