"use client";
import { MoonIcon, SunIcon, LaptopIcon, CheckIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="theme-trigger" aria-label="테마 전환">
        <span className="theme-icon-slot" aria-hidden="true"><SunIcon className="theme-icon-sun"/><MoonIcon className="theme-icon-moon"/></span>
        <span className="theme-label" aria-hidden="true"><span className="theme-label-light">라이트</span><span className="theme-label-dark">다크</span></span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-44">
      {([
        ["light", "라이트 모드", SunIcon], ["dark", "다크 모드", MoonIcon], ["system", "기기 설정 따르기", LaptopIcon],
      ] as const).map(([value,label,Icon])=><DropdownMenuItem key={value} onClick={()=>setTheme(value)}>
        <Icon className="mr-2 h-4 w-4" aria-hidden="true"/>{label}
        {theme===value ? <CheckIcon className="ml-auto h-4 w-4" aria-label="선택됨"/> : null}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
