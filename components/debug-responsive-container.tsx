'use client';

import { useEffect } from 'react';

// ResponsiveContainer 오류 위치 추적을 위한 임시 디버깅 컴포넌트
export function DebugResponsiveContainer() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Recharts ResponsiveContainer의 원본 console.warn을 가로채기
        const originalWarn = console.warn;

        console.warn = (...args) => {
            const message = args.join(' ');

            if (message.includes('width(0) and height(0)') || message.includes('ResponsiveContainer')) {
                console.error('🚨 ResponsiveContainer Error Detected!');
                console.error('Message:', message);
                console.error('Stack trace:');
                console.trace();

                // DOM 요소에서 ResponsiveContainer 찾기
                const containers = document.querySelectorAll('[class*="recharts-responsive-container"]');
                console.error('Found ResponsiveContainer elements:', containers.length);
                containers.forEach((container, index) => {
                    const rect = container.getBoundingClientRect();
                    console.error(`Container ${index + 1}:`, {
                        element: container,
                        dimensions: `${rect.width}x${rect.height}`,
                        visible: rect.width > 0 && rect.height > 0,
                        parent: container.parentElement,
                        parentDimensions: container.parentElement ?
                            `${container.parentElement.getBoundingClientRect().width}x${container.parentElement.getBoundingClientRect().height}` : 'none'
                    });
                });
            }

            // 원본 warn 호출
            originalWarn.apply(console, args);
        };

        return () => {
            console.warn = originalWarn;
        };
    }, []);

    return null;
}
