"use client";

import * as React from "react";
import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface MarqueeProps extends HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  contentClassName?: string;
  contentStyle?: CSSProperties;
}

const DEFAULT_DURATION_STYLE: CSSProperties = {
  animationDuration: "var(--duration, 45s)",
};

export function Marquee({
  className,
  contentClassName,
  contentStyle,
  reverse = false,
  pauseOnHover = false,
  children,
  ...props
}: MarqueeProps) {
  const sharedTrackClassName = cn(
    "marquee-track flex shrink-0 items-stretch",
    reverse ? "animate-marquee-reverse" : "animate-marquee",
    pauseOnHover && "group-hover:[animation-play-state:paused]",
    contentClassName,
  );

  const combinedStyle = React.useMemo(
    () => ({
      ...DEFAULT_DURATION_STYLE,
      ...contentStyle,
    }),
    [contentStyle],
  );

  return (
    <div
      className={cn("group relative flex w-full overflow-hidden", className)}
      {...props}
    >
      <div className={sharedTrackClassName} style={combinedStyle}>
        {children}
      </div>
      <div aria-hidden className={sharedTrackClassName} style={combinedStyle}>
        {children}
      </div>
    </div>
  );
}
