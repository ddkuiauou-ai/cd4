"use client";

/* eslint-disable @typescript-eslint/no-empty-object-type */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const examples = [
  {
    name: "시가총액",
    width: "w-[4rem]",
    href: "/marketcaps",
    code: "https://github.com/",
  },
  {
    name: "주가수익비율",
    width: "w-[6rem]",
    href: "/per",
    code: "https://github.com/",
  },
  ,
  {
    name: "배당금수익율",
    width: "w-[6rem]",
    href: "/div",
    code: "https://github.com/",
  },
  {
    name: "주당배당금",
    width: "w-[5rem]",
    href: "/dps",
    code: "https://github.com/",
  },
  {
    name: "주당순자산가치",
    width: "w-[7rem]",
    href: "/bps",
    code: "https://github.com/",
  },
  {
    name: "주가순자산비율",
    width: "w-[7rem]",
    href: "/pbr",
    code: "https://github.com/",
  },
  {
    name: "주당순이익",
    width: "w-[5rem]",
    href: "/eps",
    code: "https://github.com/",
  },
];

interface ExamplesNavProps extends React.HTMLAttributes<HTMLDivElement> {
  // 확장 타입이지만 추가 필드는 없음
  // extends HTMLAttributes
}
export function ExamplesNav({ className, ...props }: ExamplesNavProps) {
  const pathname = usePathname();

  return (
    <div className="relative">
      <ScrollArea className="max-w-[600px] lg:max-w-none">
        <div
          className={cn("mb-4 flex items-center space-x-2", className)}
          {...props}
        >
          {examples.map((example, index) => (
            <Link
              href={example?.href || ""}
              key={example?.href}
              className={cn(
                "flex h-7 items-center justify-center rounded-full px-4 text-center text-base transition-colors hover:text-primary bg-muted",
                pathname?.startsWith(example?.href || "") ||
                  (index === 0 && pathname === "/") ||
                  (pathname?.startsWith("/marketcap") &&
                    example?.href === "/marketcaps")
                  ? "font-medium text-secondary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(example?.width)}>{example?.name}</div>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}

interface ExampleCodeLinkProps {
  pathname: string | null;
}

export function ExampleCodeLink({ pathname }: ExampleCodeLinkProps) {
  const example = examples.find((example) =>
    pathname?.startsWith(example?.href || "")
  );

  if (!example?.code) {
    return null;
  }

  return (
    <Link
      href={example?.code}
      target="_blank"
      rel="nofollow"
      className="absolute right-0 top-0 hidden items-center rounded-[0.5rem] text-sm font-medium md:flex"
    >
      View code
      <ArrowRightIcon className="ml-1 h-4 w-4" />
    </Link>
  );
}
