"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CompanyFinancialTabs } from './company-financial-tabs';

export function DetailErrorState({ reset }: { reset: () => void }) {
    const pathname = usePathname();
    const companyPage = pathname.startsWith('/company/');
    const code = pathname.split('/')[2];
    return <div className="app-container detail-grid">
        <div className="detail-content">
            <Link prefetch={false} href={companyPage ? '/marketcaps' : '/marketcap'} className="text-sm text-muted-foreground underline">{companyPage ? '기업 합산 시가총액 순위' : '종목 시가총액 순위'}</Link>
            <h1 className="page-heading mt-5">상세 정보를 불러오지 못했습니다</h1>
            <p className="data-note mt-3 mb-5">잠시 후 다시 시도하거나 다른 지표와 종목을 확인해 주세요.</p>
            {code && <CompanyFinancialTabs secCode={code} />}
            <div className="empty-state mt-6" role="alert">
                <p className="data-note">데이터 연결을 확인해 주세요. 다시 시도해도 현재 페이지의 주소는 유지됩니다.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={reset} className="min-h-11 rounded border border-input bg-primary px-4 text-sm font-medium">다시 시도</button>
                    <Link href={companyPage ? '/marketcaps' : '/marketcap'} className="inline-flex min-h-11 items-center px-4 text-sm underline">전체 순위 보기</Link>
                </div>
            </div>
        </div>
    </div>;
}
