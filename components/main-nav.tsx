"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils"; // cn 유틸리티 임포트

// 네비게이션 아이템 정의
const navItems = [
  { name: "메인", href: "/dashboard" },
  {
    name: "랭킹",
    href: "/",
    activePaths: [
      "/marketcaps",
      "/marketcap",
      "/pbr",
      "/per",
      "/eps",
      "/bps",
      "/div",
      "/dps",
    ],
  }, // 루트는 시가총액 첫 페이지
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {navItems.map((item) => {
        const isActive =
          (item.href === "/"
            ? pathname === item.href
            : pathname.startsWith(item.href)) ||
          (item.activePaths &&
            item.activePaths.some((path) => pathname.startsWith(path)));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "transition-colors h-10 px-4 py-2 inline-flex items-center justify-center rounded-md text-base font-medium",
              isActive
                ? "text-foreground bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
