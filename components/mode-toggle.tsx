"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-auto px-3 rounded-xl transition-all duration-300 hover:bg-primary/10 hover:scale-105 relative group border border-transparent hover:border-primary/20"
        >
          <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-yellow-500 group-hover:text-yellow-600" />
          <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-blue-400 group-hover:text-blue-500" />
          <span className="ml-2 text-sm font-medium dark:hidden">라이트</span>
          <span className="ml-2 text-sm font-medium hidden dark:block">다크</span>
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-blue-400/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
          <span className="sr-only">테마 전환</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-border/60 shadow-lg backdrop-blur-sm bg-background/95">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="rounded-lg cursor-pointer hover:bg-primary/10 transition-colors duration-200"
        >
          <SunIcon className="mr-2 h-4 w-4 text-yellow-500" />
          라이트 모드
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="rounded-lg cursor-pointer hover:bg-primary/10 transition-colors duration-200"
        >
          <MoonIcon className="mr-2 h-4 w-4 text-blue-400" />
          다크 모드
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="rounded-lg cursor-pointer hover:bg-primary/10 transition-colors duration-200"
        >
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-r from-yellow-500 to-blue-400"></div>
          시스템 설정
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}