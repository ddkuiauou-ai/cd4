import { Suspense } from "react";
import { MidNav } from "@/components/mid-nav";

interface MidNavWrapperProps {
    sectype: string | null;
}

/**
 * SSG-safe wrapper for MidNav component
 * Wraps MidNav in Suspense to prevent SSG errors with useSearchParams
 */
export function MidNavWrapper({ sectype }: MidNavWrapperProps) {
    return (
        <Suspense fallback={<div className="h-12 animate-pulse bg-muted rounded" />}>
            <MidNav sectype={sectype} />
        </Suspense>
    );
}
