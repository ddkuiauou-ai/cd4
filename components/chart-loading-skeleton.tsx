/**
 * 차트 로딩 스켈레톤 컴포넌트
 * 차트 데이터 로딩 중에 표시되는 애니메이션 스켈레톤
 */

export function ChartLoadingSkeleton() {
    return (
        <div className="mt-5 animate-pulse">
            <div className="w-full h-64 bg-gray-100 rounded-lg relative overflow-hidden">
                {/* 차트 배경 그리드 라인들 */}
                <div className="absolute inset-0 flex flex-col justify-between p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-px bg-gray-200 w-full" />
                    ))}
                </div>

                {/* 시뮬레이션된 차트 라인 */}
                <div className="absolute inset-4 flex items-end space-x-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-gray-300 rounded-t-sm flex-1"
                            style={{
                                height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`,
                                animationDelay: `${i * 0.1}s`
                            }}
                        />
                    ))}
                </div>

                {/* 중앙 로딩 인디케이터 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="text-center space-y-3">
                        <div className="w-8 h-8 mx-auto border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        <p className="text-sm text-gray-600 font-medium">차트 데이터 로딩 중...</p>
                    </div>
                </div>
            </div>

            {/* 범례 스켈레톤 */}
            <div className="mt-4 flex justify-center space-x-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                        <div className="w-4 h-0.5 bg-gray-300 rounded" />
                        <div className="w-16 h-4 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ChartLoadingSkeleton;
