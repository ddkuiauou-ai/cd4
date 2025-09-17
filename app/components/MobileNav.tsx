"use client";

import * as React from "react";
import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";

const examples = [
    {
        name: "시가총액",
        width: "w-[3.5rem]",
        href: "/marketcap",
        code: "https://github.com/",
    },
    {
        name: "주당순자산가치",
        width: "w-[5.5rem]",
        href: "/bps",
        code: "https://github.com/",
    },
    {
        name: "주가수익비율",
        width: "w-[5rem]",
        href: "/per",
        code: "https://github.com/",
    },
    {
        name: "주가순자산비율",
        width: "w-[5.5rem]",
        href: "/pbr",
        code: "https://github.com/",
    },
    {
        name: "주당순이익",
        width: "w-[4rem]",
        href: "/eps",
        code: "https://github.com/",
    },
    {
        name: "배당금수익율",
        width: "w-[5rem]",
        href: "/div",
        code: "https://github.com/",
    },
    {
        name: "주당배당금",
        width: "w-[4rem]",
        href: "/dps",
        code: "https://github.com/",
    },
];

export function MobileNav() {
    const [open, setOpen] = React.useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
                >
                    <Image
                        src="/icon.svg"
                        alt="menu"
                        width={24}
                        height={24}
                        className="mr-4"
                    />
                    <span className="sr-only">메뉴</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
                <MobileLink
                    href="/"
                    className="flex items-center"
                    onOpenChange={setOpen}
                >
                    <Image
                        src="/logo_short.svg"
                        alt="logo"
                        width={194.25}
                        height={104.28}
                    />
                    <span className="hidden font-bold">{siteConfig.name}</span>
                </MobileLink>
                <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
                    <div className="flex flex-col space-y-3">
                        {examples.map((item) => (
                            <MobileLink
                                key={item.href}
                                href={item.href}
                                onOpenChange={setOpen}
                            >
                                {item.name}
                            </MobileLink>
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

interface MobileLinkProps extends LinkProps {
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    className?: string;
}

function MobileLink({
    href,
    onOpenChange,
    className,
    children,
    ...props
}: MobileLinkProps) {
    const router = useRouter();
    return (
        <Link
            href={href}
            onClick={() => {
                router.push(href.toString());
                onOpenChange?.(false);
            }}
            className={cn(className)}
            {...props}
        >
            {children}
        </Link>
    );
}
