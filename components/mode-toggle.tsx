"use client";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" className="theme-trigger" aria-label="테마 전환" title="테마 전환">
        <span className="header-icon-slot" aria-hidden="true"><Sun className="theme-icon-sun"/><Moon className="theme-icon-moon"/></span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-44">
      {([
        ["light", "라이트 모드", Sun], ["dark", "다크 모드", Moon], ["system", "기기 설정 따르기", Monitor],
      ] as const).map(([value,label,Icon])=><DropdownMenuItem key={value} onClick={()=>setTheme(value)}>
        <Icon className="mr-2 h-4 w-4" aria-hidden="true"/>{label}
        {theme===value ? <Check className="ml-auto h-4 w-4" aria-label="선택됨"/> : null}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
