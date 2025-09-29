"use client";

import { useEffect, useRef, useState } from "react";
import { Balancer } from "react-wrap-balancer";

import CompanyLogo from "@/components/CompanyLogo";
import { useMobileHeader } from "@/components/mobile-header-context";
import { COMPANY_HEADER_PIN_EVENT } from "@/components/share-events";
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
  actions?: React.ReactNode;
  onPinChange?: (pinned: boolean) => void;
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
  actions,
  onPinChange,
}: StickyCompanyHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [effectiveOffset, setEffectiveOffset] = useState(stickyOffset);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const { setContent: setMobileHeaderContent } = useMobileHeader();
  const previousPinnedRef = useRef(isPinned);

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

    // Ensure window is properly typed after the check
    const win = window as Window;

    if ("IntersectionObserver" in win) {
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
      sentinelTop = rect.top + win.scrollY;
    };

    const updatePinnedState = () => {
      const shouldPin = win.scrollY + effectiveOffset >= sentinelTop;
      setIsPinned(prev => (prev === shouldPin ? prev : shouldPin));
    };

    const handleResize = () => {
      measure();
      updatePinnedState();
    };

    measure();
    updatePinnedState();

    win.addEventListener("scroll", updatePinnedState, { passive: true });
    win.addEventListener("resize", handleResize);

    return () => {
      win.removeEventListener("scroll", updatePinnedState);
      win.removeEventListener("resize", handleResize);
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
        titleBadge: null, // Hide badge on mobile
        detail: null, // Hide detail on mobile
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

  useEffect(() => {
    if (previousPinnedRef.current !== isPinned) {
      onPinChange?.(isPinned);
      previousPinnedRef.current = isPinned;
    }
  }, [isPinned, onPinChange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const event = new CustomEvent(COMPANY_HEADER_PIN_EVENT, {
      detail: {
        pinned: isPinned,
        offset: effectiveOffset,
      },
    });

    window.dispatchEvent(event);
  }, [isPinned, effectiveOffset]);

  const logoSize = isPinned ? 40 : 56;
  const shouldHideForMobile = isPinned && isSmallScreen;

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
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            isPinned ? "sm:gap-4" : undefined
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
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-y-1">
                  <Balancer>
                    <span className="block whitespace-nowrap">{displayName}</span>
                  </Balancer>
                  {titleSuffix ? (
                    <span
                      className={cn(
                        "text-sm font-medium text-muted-foreground",
                        "sm:text-[1em] sm:font-bold sm:text-foreground",
                        "flex-shrink-0 whitespace-nowrap"
                      )}
                    >
                      {titleSuffix}
                    </span>
                  ) : null}
                  {isPinned && !isSmallScreen && detail?.value && (
                    <span
                      className={cn(
                        "font-semibold text-foreground",
                        "text-sm"
                      )}
                    >
                      {detail.value}
                    </span>
                  )}
                  {isPinned && !isSmallScreen && detail?.badge && (
                    <span
                      className={cn(
                        "font-medium text-muted-foreground",
                        "text-xs"
                      )}
                    >
                      {detail.badge}
                    </span>
                  )}
                </span>
              </h1>
            </div>
          </div>
          {actions && !isSmallScreen ? (
            <div
              className={cn(
                "flex w-full justify-end gap-2 sm:w-auto",
                isPinned ? undefined : "sm:pt-2"
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default StickyCompanyHeader;
