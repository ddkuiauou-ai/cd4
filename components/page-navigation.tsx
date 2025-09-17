"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PageNavigationSection {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface PageNavigationProps {
  sections: PageNavigationSection[];
  /**
   * Additional offset to account for fixed headers when determining the active section.
   */
  offset?: number;
}

export function PageNavigation({ sections, offset = 160 }: PageNavigationProps) {
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null);
  const activeRef = useRef<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSection(null);
      activeRef.current = null;
      return;
    }

    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + offset;
      let currentActive: string | null = sections[0]?.id ?? null;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (!element) continue;
        const elementTop = element.getBoundingClientRect().top + window.scrollY;

        if (scrollPosition >= elementTop - 4) {
          currentActive = section.id;
        }
      }

      if (currentActive !== activeRef.current) {
        activeRef.current = currentActive;
        setActiveSection(currentActive);
      }
    };

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActiveSection();
        ticking = false;
      });
    };

    updateActiveSection();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [sections, offset]);

  useEffect(() => {
    const firstSection = sections[0]?.id ?? null;
    setActiveSection(firstSection);
    activeRef.current = firstSection;
  }, [sections]);

  return (
    <nav className="space-y-2">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors py-1",
              isActive ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {section.icon}
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
