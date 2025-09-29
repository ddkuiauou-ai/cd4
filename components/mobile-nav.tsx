"use client";

import * as React from "react";
import Link, { LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation"; // useRouter 추가
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle, // Import SheetTitle
  SheetDescription, // Import SheetDescription (optional, but good for context)
} from "@/components/ui/sheet";
import Image from "next/image";
import { ScrollArea } from "./ui/scroll-area";
import { ModeToggle } from "./mode-toggle";

// 네비게이션 아이템 정의 (MainNav과 동일하게)
const navItems = [
  { name: "대시보드", href: "/dashboard" },
  { name: "시가총액", href: "/", altHref: "/marketcaps" },
];

// Define props for MobileNav to accept searchData
interface MobileNavProps {
  searchData: {
    securityId: string;
    companyId: string | null;
    korName: string;
    type: string | null;
    exchange: string;
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MobileNav({ searchData }: MobileNavProps) { // Destructure searchData from props
  const [open, setOpen] = React.useState(false); // Manage sheet open state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}> {/* Control Sheet open state */}
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="min-h-[48px] min-w-[48px] p-2 text-base hover:bg-muted/60 hover:text-primary focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 md:hidden rounded-xl transition-all duration-300 touch-manipulation"
        >
          <svg
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
          >
            <path
              d="M3 5H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></path>
            <path
              d="M3 12H16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></path>
            <path
              d="M3 19H21"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></path>
          </svg>
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle> {/* Add sr-only SheetTitle for accessibility */}
        <SheetDescription className="sr-only">Main navigation links for mobile devices.</SheetDescription> {/* Optional: Add sr-only SheetDescription */}
        <MobileLink
          href="/"
          className="flex items-center space-x-2 pl-6 py-4 group" // 아이콘과 텍스트 간격 및 패딩 조정
          onOpenChange={setOpen} // Pass setOpen to close sheet on link click
        >
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg transition-all duration-300 group-hover:bg-primary/5">
            <span
              className="font-serif font-bold text-xl text-red-500 transition-colors duration-300 group-hover:text-red-600"
              style={{ textShadow: "-0.6px 0 #000, 0 0.6px #000, 0.6px 0 #000, 0 -0.6px #000" }} // textShadow 오프셋을 -0.6px/0.6px로 변경
            >
              천하제일
            </span>
            <div className="relative">
              <Image
                src="/icon.svg" // public/icon.svg 사용
                alt="로고"
                width={28} // 아이콘 크기 조정
                height={28} // 아이콘 크기 조정
                className="h-7 w-7 transition-transform duration-300 group-hover:rotate-12" // Tailwind CSS 크기 클래스
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
            </div>
            <span
              className="font-serif font-bold text-xl text-yellow-400 transition-colors duration-300 group-hover:text-yellow-500"
              style={{ textShadow: "-1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000" }}
            >
              단타대회
            </span>
          </div>
        </MobileLink>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
          <div className="flex flex-col space-y-3">
            {navItems.map(
              (item) =>
                item.href && (
                  <MobileLink
                    key={item.href}
                    href={item.href}
                    onOpenChange={setOpen} // Pass setOpen to close sheet on link click
                  >
                    {item.name}
                  </MobileLink>
                )
            )}
          </div>
        </ScrollArea>
        <div className="absolute bottom-4 right-4">
          <ModeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void; // Ensure this line is present and uncommented
  children: React.ReactNode;
  className?: string;
}

function MobileLink({
  href,
  onOpenChange, // Receive onOpenChange prop
  className,
  children,
  ...props
}: MobileLinkProps) {
  const router = useRouter();
  const pathname = usePathname(); // 현재 경로를 가져옴

  // 네비게이션 아이템 정의에서 altHref를 찾아 현재 경로와 비교
  const navItem = navItems.find(item => item.href === href.toString() || item.altHref === href.toString());
  const isActive = pathname === href.toString() ||
    (navItem?.altHref && pathname.startsWith(navItem.altHref)) ||
    (href.toString() === "/" && pathname.startsWith("/marketcaps"));

  return (
    <Link
      href={href}
      onClick={() => {
        router.push(href.toString());
        onOpenChange?.(false); // Close sheet on click
      }}
      className={cn(
        className,
        isActive ? "text-foreground font-semibold" : "text-foreground/60" // 활성 상태 스타일링
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
