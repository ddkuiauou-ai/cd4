"use client";

import { useEffect, useRef, useState } from "react";
import { Balancer } from "react-wrap-balancer";

import CompanyLogo from "@/components/CompanyLogo";
import { useMobileHeader } from "@/components/mobile-header-context";
import { cn } from "@/lib/utils";

interface StickyCompanyHeaderProps {
  displayName: string;
  companyName?: string | null;
  logoUrl?: string | null;
  /**
   * Pixel offset from the top of the viewport that the header should respect
   * when it becomes sticky. This value acts as a fallback if the global site
   * header cannot be measured on the client.
   */
  stickyOffset?: number;
  titleSuffix?: string | null;
  titleBadge?: string | null;
  detail?: {
    label?: string | null;
    value?: string | null;
    badge?: string | null;
  } | null;
}

const DEFAULT_STICKY_OFFSET = 80; // matches Tailwind's top-20 (5rem)

export function StickyCompanyHeader({
  displayName,
  companyName,
  logoUrl,
  stickyOffset = DEFAULT_STICKY_OFFSET,
  titleSuffix = "시가총액",
  titleBadge = null,
  detail,
}: StickyCompanyHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [effectiveOffset, setEffectiveOffset] = useState(stickyOffset);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const { setContent: setMobileHeaderContent } = useMobileHeader();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleChange = () => {
      setIsSmallScreen(!mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const siteHeader = document.querySelector<HTMLElement>("[data-site-header]");

    if (!siteHeader) {
      setEffectiveOffset(prev => (prev === stickyOffset ? prev : stickyOffset));
      return;
    }

    const computeOffset = () => {
      const headerHeight = siteHeader.getBoundingClientRect().height;
      const gap = 16; // space between the global site header and the sticky bar
      const nextOffset = Math.round(headerHeight + gap);

      setEffectiveOffset(prev => (prev === nextOffset ? prev : nextOffset));
    };

    computeOffset();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(computeOffset);
    resizeObserver.observe(siteHeader);

    return () => {
      resizeObserver.disconnect();
    };
  }, [stickyOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (typeof window === "undefined" || !sentinel) {
      return;
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const shouldPin = !entry.isIntersecting;
          setIsPinned(prev => (prev === shouldPin ? prev : shouldPin));
        },
        {
          rootMargin: `-${effectiveOffset}px 0px 0px 0px`,
          threshold: [0, 1],
        }
      );

      observer.observe(sentinel);

      return () => {
        observer.disconnect();
      };
    }

    let sentinelTop = 0;

    const measure = () => {
      const rect = sentinel.getBoundingClientRect();
      sentinelTop = rect.top + window.scrollY;
    };

    const updatePinnedState = () => {
      const shouldPin = window.scrollY + effectiveOffset >= sentinelTop;
      setIsPinned(prev => (prev === shouldPin ? prev : shouldPin));
    };

    const handleResize = () => {
      measure();
      updatePinnedState();
    };

    measure();
    updatePinnedState();

    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", handleResize);
    };
  }, [effectiveOffset]);

  useEffect(() => {
    if (!isSmallScreen) {
      setMobileHeaderContent(null);
      return () => {
        setMobileHeaderContent(null);
      };
    }

    if (isPinned) {
      setMobileHeaderContent({
        type: "company",
        displayName,
        companyName,
        logoUrl,
        titleSuffix,
        titleBadge,
        detail,
      });
    } else {
      setMobileHeaderContent(null);
    }

    return () => {
      setMobileHeaderContent(null);
    };
  }, [
    isPinned,
    isSmallScreen,
    displayName,
    companyName,
    logoUrl,
    titleSuffix,
    titleBadge,
    detail,
    setMobileHeaderContent,
  ]);

  const logoSize = isPinned ? 40 : 56;
  const shouldHideForMobile = isPinned && isSmallScreen;

  const headingText = titleSuffix ? `${displayName} ${titleSuffix}` : displayName;

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full opacity-0" />
      <div
        className={cn(
          "sticky z-40 transition-all duration-200",
          isPinned
            ? "border-b border-border/60 bg-background/95 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75"
            : "py-6 sm:py-8"
        )}
        style={{
          top: `${effectiveOffset}px`,
          display: shouldHideForMobile ? "none" : undefined,
        }}
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
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Balancer>{headingText}</Balancer>
                {titleBadge ? (
                  <span
                    className={cn(
                      "font-medium text-muted-foreground",
                      isPinned ? "text-xs" : "text-sm"
                    )}
                  >
                    {titleBadge}
                  </span>
                ) : null}
              </span>
            </h1>
            {(detail?.value || detail?.label || detail?.badge) && (
              <div
                className={cn(
                  "mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1",
                  isPinned ? "text-sm" : "text-base"
                )}
              >
                <div className="flex items-baseline gap-2">
                  {detail?.label && (
                    <span className="text-sm text-muted-foreground">{detail.label}</span>
                  )}
                  {detail?.value && (
                    <span
                      className={cn(
                        "font-semibold text-foreground",
                        isPinned ? "text-lg" : "text-xl"
                      )}
                    >
                      {detail.value}
                    </span>
                  )}
                </div>
                {detail?.badge && (
                  <span className="text-xs text-muted-foreground">{detail.badge}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default StickyCompanyHeader;
