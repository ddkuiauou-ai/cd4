"use client";

import { useEffect, useRef, useState } from "react";
import { Balancer } from "react-wrap-balancer";

import CompanyLogo from "@/components/CompanyLogo";
import { cn } from "@/lib/utils";

interface StickyCompanyHeaderProps {
  displayName: string;
  companyName?: string | null;
  logoUrl?: string | null;
  /**
   * Pixel offset from the top of the viewport that the header should respect
   * when it becomes sticky. Keep this in sync with the `top-*` utility used in
   * the component styles.
   */
  stickyOffset?: number;
}

const DEFAULT_STICKY_OFFSET = 80; // matches Tailwind's top-20 (5rem)

export function StickyCompanyHeader({
  displayName,
  companyName,
  logoUrl,
  stickyOffset = DEFAULT_STICKY_OFFSET,
}: StickyCompanyHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const headerOffsetRef = useRef<number>(0);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const measureOffset = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) {
        headerOffsetRef.current = 0;
        return;
      }

      headerOffsetRef.current = sentinel.getBoundingClientRect().top + window.scrollY;
    };

    const updatePinnedState = () => {
      if (!headerOffsetRef.current && headerOffsetRef.current !== 0) {
        return;
      }

      const shouldPin = window.scrollY + stickyOffset >= headerOffsetRef.current;
      setIsPinned(prev => (prev === shouldPin ? prev : shouldPin));
    };

    const handleResize = () => {
      measureOffset();
      updatePinnedState();
    };

    measureOffset();
    updatePinnedState();

    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", handleResize);
    };
  }, [stickyOffset]);

  const logoSize = isPinned ? 40 : 56;

  return (
    <div className="relative">
      <div ref={sentinelRef} aria-hidden className="h-0" />
      <div
        className={cn(
          "sticky top-20 z-30 transition-all duration-200",
          isPinned
            ? "border-b border-border/60 bg-background/95 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75"
            : "py-6 sm:py-8"
        )}
      >
        <div
          className={cn(
            "flex items-center transition-all duration-200",
            isPinned ? "gap-3" : "gap-4"
          )}
        >
          <CompanyLogo
            companyName={companyName ?? displayName}
            logoUrl={logoUrl}
            size={logoSize}
            className={cn(
              "flex-shrink-0 transition-all duration-200",
              isPinned ? "shadow-sm" : undefined
            )}
          />
          <div className="min-w-0">
            <h1
              className={cn(
                "font-heading font-bold tracking-tight transition-all duration-200",
                isPinned ? "text-xl sm:text-2xl" : "text-3xl md:text-4xl lg:text-5xl"
              )}
            >
              <Balancer>{displayName} 시가총액</Balancer>
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StickyCompanyHeader;
