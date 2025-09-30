import { useState, useEffect } from 'react';

/**
 * 접기 상태를 세션 스토리지와 연동하는 커스텀 훅
 */
export function useCollapsedState(storageKey: string, defaultValue = false) {
    const [isCollapsed, setIsCollapsed] = useState(defaultValue);

    // 세션 스토리지에서 접기 상태 불러오기
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem(storageKey);
            if (stored !== null) {
                try {
                    const storedCollapsed = JSON.parse(stored);
                    setIsCollapsed(storedCollapsed);
                } catch (error) {
                    console.warn(`Failed to parse stored value for ${storageKey}:`, error);
                }
            }
        }
    }, [storageKey]);

    const toggleCollapsed = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);

        // 세션 스토리지에 상태 저장
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(newCollapsed));
            } catch (error) {
                console.error('Failed to save to sessionStorage:', error);
            }
        }
    };

    return [isCollapsed, toggleCollapsed] as const;
}
