"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRightIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const type1 = [
  {
    name: "시가총액",
    href: "/sec/marketcap",
    code: "https://github.com/",
  },
];

const type2 = [
  {
    name: "시가총액",
    href: "/sec/marketcap",
    code: "https://github.com/",
  },
];

interface MidNavProps extends React.HTMLAttributes<HTMLDivElement> {
  sectype?: string | null;
  className?: string;
}

export function MidNav({ sectype, className, ...props }: MidNavProps) {
  let examples = type1;
  if (sectype !== "보통주") {
    examples = type2;
  }

  const pathName = usePathname();
  const termToUse = decodeURIComponent(pathName);

  const searchParams = useSearchParams();
  let type = searchParams.get("type");

  const corp = termToUse.split("/")[1];
  const term = termToUse.split("/")[2];
  const item = termToUse.split("/")[3];

  if (corp === "corp" || type === "corp") {
    // console.log("corp");
    if (examples[0]) {
      examples[0].href = "/corp/marketcap";
    }
    type = "corp";
  } else if (type !== "corp") {
    // console.log("type");
    if (examples[0]) {
      examples[0].href = "/sec/marketcap";
    }
  }

  // console.log("corp: ", corp);
  // console.log("term: ", term);
  // console.log("item: ", item);

  return (
    <div className="relative w-full bg-muted/30 backdrop-blur-sm rounded-xl p-3 sm:p-4 mb-6 border border-border/50">
      <ScrollArea className="w-full">
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3",
            "overflow-x-auto hide-scrollbar",
            className
          )}
          {...props}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          {examples.map((example, index) => (
            <Link
              href={`${example?.href}/${item}${type ? "?type=" + type : ""}`}
              key={example?.href}
              className={cn(
                "flex h-11 sm:h-12 items-center justify-center rounded-lg",
                "px-4 sm:px-5 py-3",
                "text-sm sm:text-base font-medium transition-all duration-200",
                "border border-transparent whitespace-nowrap flex-shrink-0",
                "min-w-[5rem] sm:min-w-[6rem]",
                "hover:text-primary hover:scale-[1.01] hover:shadow-sm",
                "active:scale-[0.99] touch-manipulation",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
                term?.startsWith(example?.href || "") ||
                  `/${corp}/${term}` === example?.href
                  ? "bg-primary text-primary-foreground shadow-lg font-semibold ring-2 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground backdrop-blur-sm"
              )}
            >
              {example?.name}
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5 mt-2 opacity-30" />
      </ScrollArea>
    </div>
  );
}

interface MidCodeLinkProps {
  pathname: string | null;
}

export function MidCodeLink({ pathname }: MidCodeLinkProps) {
  const example = type1.find((example) =>
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
