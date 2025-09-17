'use client';

import { useEffect } from 'react';

export function ResponsiveContainerDebugger() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // ResponsiveContainer 오류를 추적하기 위한 console.warn 가로채기
        const originalWarn = console.warn;
        const originalError = console.error;

        let isLogging = false; // 무한 루프 방지

        console.warn = (...args) => {
            if (isLogging) {
                originalWarn.apply(console, args);
                return;
            }

            const message = args.join(' ');

            if (message.includes('width(0) and height(0)') || message.includes('ResponsiveContainer')) {
                isLogging = true;

                originalError('🚨 RESPONSIVE CONTAINER ERROR DETECTED!');
                originalError('Error message:', message);

                // 스택 트레이스로 어떤 컴포넌트에서 호출되었는지 확인
                const stack = new Error().stack;
                originalError('Call stack:', stack);

                // 현재 DOM에 있는 모든 ResponsiveContainer 검사
                setTimeout(() => {
                    const containers = document.querySelectorAll('[class*="recharts-responsive-container"]');
                    originalError(`Found ${containers.length} ResponsiveContainer(s) in DOM:`);

                    containers.forEach((container, index) => {
                        const rect = container.getBoundingClientRect();
                        const parent = container.parentElement;
                        const parentRect = parent?.getBoundingClientRect();

                        const isZeroSize = rect.width === 0 || rect.height === 0;

                        originalError(`Container ${index + 1} ${isZeroSize ? '❌ ZERO SIZE!' : '✅ Normal'}:`, {
                            element: container,
                            size: `${rect.width}x${rect.height}`,
                            parentSize: parentRect ? `${parentRect.width}x${parentRect.height}` : 'none',
                            parentClasses: parent?.className,
                            containerClasses: container.className,
                            isVisible: rect.width > 0 && rect.height > 0
                        });
                    });

                    isLogging = false;
                }, 50);
            }

            // 원본 warn 호출
            originalWarn.apply(console, args);
        };

        // 컴포넌트 언마운트시 원복
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    return null;
}
