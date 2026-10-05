import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <>
            <main className="flex-1" aria-busy="true">
                <p role="status" className="sr-only">대시보드 데이터를 불러오는 중입니다.</p>
                <div className="container px-4 sm:px-8 relative">
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <Skeleton className="h-8 w-32 mb-2" />
                                <Skeleton className="h-4 w-64" />
                                <Skeleton className="h-3 w-24 mt-1" />
                            </div>
                            <Skeleton className="h-6 w-20" />
                        </div>
                    </div>

                    <div className="mb-8">
                        <Skeleton className="h-6 w-24 mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Skeleton className="h-5 w-16" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-24 mb-2" />
                                        <Skeleton className="h-4 w-20" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <div className="mb-8">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-10 w-full mb-4" />
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
