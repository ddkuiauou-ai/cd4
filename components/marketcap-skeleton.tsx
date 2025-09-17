import { Skeleton } from "@/components/ui/skeleton";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";

export function MarketcapPageSkeleton() {
    return (
        <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] space-y-8 relative">
            <div className="mx-auto w-full min-w-0 space-y-12 relative">
                {/* 브레드크럼 스켈레톤 */}
                <div className="space-y-0 relative">
                    <div className="flex items-center space-x-1 text-sm">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </div>

                {/* 제목 스켈레톤 */}
                <div className="space-y-6 relative">
                    <div className="space-y-2 relative">
                        <Skeleton className="h-8 md:h-12 lg:h-16 w-3/4" />
                        <Skeleton className="h-5 md:h-6 w-1/2" />
                    </div>
                    <Skeleton className="h-20 w-full rounded-lg" />
                </div>

                {/* 섹션들 스켈레톤 */}
                <div className="space-y-16 relative">
                    {/* 기업 개요 섹션 스켈레톤 */}
                    <div className="relative border-t-2 border-blue-100 pt-8 pb-8 bg-blue-50/30 rounded-xl -mx-4 px-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <Skeleton className="h-24 w-full rounded-lg" />
                    </div>

                    {/* 차트 분석 섹션 스켈레톤 */}
                    <div className="space-y-8 relative border-t-2 border-green-100 pt-8 pb-8 bg-green-50/20 rounded-xl -mx-4 px-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                <BarChart3 className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="grid gap-8 lg:grid-cols-2 relative">
                            <Skeleton className="h-64 w-full rounded-xl" />
                            <Skeleton className="h-64 w-full rounded-xl" />
                        </div>
                    </div>

                    {/* 종목 비교 섹션 스켈레톤 */}
                    <div className="space-y-8 relative border-t-2 border-purple-100 pt-8 pb-8 bg-purple-50/20 rounded-xl -mx-4 px-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                                <ArrowLeftRight className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                    </div>

                    {/* 핵심 지표 섹션 스켈레톤 */}
                    <div className="space-y-8 relative border-t-2 border-orange-100 pt-8 pb-8 bg-orange-50/20 rounded-xl -mx-4 px-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100">
                                <TrendingUp className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="flex overflow-x-auto gap-4 pb-4 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible md:pb-0">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex-shrink-0 w-[180px] md:w-auto">
                                    <Skeleton className="h-32 w-full rounded-xl" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 연도별 데이터 섹션 스켈레톤 */}
                    <div className="border-t-2 border-red-100 pt-8 pb-8 bg-red-50/20 rounded-xl -mx-4 px-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                                <FileText className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="space-y-8">
                            <Skeleton className="h-64 w-full rounded-xl" />
                            <Skeleton className="h-96 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 사이드바 스켈레톤 */}
            <div className="hidden xl:block relative">
                <div className="sticky top-20 space-y-6">
                    <div className="rounded-xl border bg-background p-4">
                        <Skeleton className="h-4 w-20 mb-3" />
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-6 w-full" />
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border bg-background p-4">
                        <Skeleton className="h-4 w-16 mb-3" />
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex justify-between">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
