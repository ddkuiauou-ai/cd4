"use client";

import { ReactNode, useState, useEffect, memo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface NavigationCollapsibleProps {
    title: string;
    children: ReactNode;
    defaultCollapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    storageKey?: string; // 세션 스토리지 키
}

export function NavigationCollapsible({
    title,
    children,
    defaultCollapsed = false,
    onCollapsedChange,
    storageKey = "navigation-collapsed"
}: NavigationCollapsibleProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    // 세션 스토리지에서 접기 상태 불러오기
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem(storageKey);
            if (stored !== null) {
                const storedCollapsed = JSON.parse(stored);
                setIsCollapsed(storedCollapsed);
                onCollapsedChange?.(storedCollapsed);
            }
        }
    }, [storageKey, onCollapsedChange]);

    const handleToggle = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);

        // 세션 스토리지에 상태 저장
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(storageKey, JSON.stringify(newCollapsed));
        }

        onCollapsedChange?.(newCollapsed);
    };

    return (
        <div className={`${isCollapsed ? 'bg-background p-2 mb-0' : 'rounded-xl border bg-background p-4 mb-6'}`}>
            <button
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors w-full justify-between ${isCollapsed ? 'py-2' : 'py-2 mb-3'
                    }`}
                aria-expanded={!isCollapsed}
                aria-controls={`${title.replace(/\s+/g, '-').toLowerCase()}-content`}
                aria-label={`${title} ${isCollapsed ? '펼치기' : '접기'}`}
            >
                <span>{title}</span>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            {!isCollapsed && (
                <div id={`${title.replace(/\s+/g, '-').toLowerCase()}-content`}>
                    {children}
                </div>
            )}
        </div>
    );
}

export default memo(NavigationCollapsible);
