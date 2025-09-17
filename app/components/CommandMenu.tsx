"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Cross2Icon,
    CrossCircledIcon,
    CircleIcon,
    PlusIcon,
    SquareIcon,
    MaskOnIcon,
    MaskOffIcon,
    LaptopIcon,
    MoonIcon,
    SunIcon,
} from "@radix-ui/react-icons";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";

interface CommandMenuProps {
    data: {
        securityId: string;
        companyId: string | null;
        korName: string;
        type: string | null;
        exchange: string;
    }[];
}

export function CommandMenu({ data, ...props }: CommandMenuProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const { setTheme } = useTheme();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
                if (
                    (e.target instanceof HTMLElement && e.target.isContentEditable) ||
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    e.target instanceof HTMLSelectElement
                ) {
                    return;
                }

                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <Button
                variant="outline"
                className={cn(
                    "relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
                )}
                onClick={() => setOpen(true)}
                {...props}
            >
                <span className="hidden lg:inline-flex">검색</span>
                <span className="inline-flex lg:hidden">검색</span>
                <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="검색할 기업 또는 종목을 입력하세요" />
                <CommandList>
                    <CommandEmpty>검색 결과 없음.</CommandEmpty>
                    <CommandGroup heading="기업">
                        {data.map(
                            (navItem) =>
                                navItem.type === "보통주" &&
                                navItem.companyId !== null && (
                                    <CommandItem
                                        key={`corp${navItem.securityId}`}
                                        value={navItem.korName}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/corp/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <CrossCircledIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 기업
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="보통주">
                        {data.map(
                            (navItem) =>
                                navItem.type === "보통주" && (
                                    <CommandItem
                                        key={`corp${navItem.securityId}`}
                                        value={`보통주${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <CircleIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 보통주
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="우선주">
                        {data.map(
                            (navItem) =>
                                navItem.type === "우선주" && (
                                    <CommandItem
                                        key={`prefered${navItem.securityId}`}
                                        value={`우선주${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <Cross2Icon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 우선주
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="전환우선주">
                        {data.map(
                            (navItem) =>
                                navItem.type === "전환우선주" && (
                                    <CommandItem
                                        key={`CB${navItem.securityId}`}
                                        value={`전환우선주${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <PlusIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 전환우선주
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="리츠">
                        {data.map(
                            (navItem) =>
                                navItem.type === "리츠" && (
                                    <CommandItem
                                        key={`RITs${navItem.securityId}`}
                                        value={`리츠${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <SquareIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 리츠
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="펀드">
                        {data.map(
                            (navItem) =>
                                navItem.type === "펀드" && (
                                    <CommandItem
                                        key={`fund${navItem.securityId}`}
                                        value={`펀드${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <MaskOnIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 펀드
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>
                    <CommandGroup heading="스팩">
                        {data.map(
                            (navItem) =>
                                navItem.type === "스팩" && (
                                    <CommandItem
                                        key={`spec${navItem.securityId}`}
                                        value={`스팩${navItem.korName}`}
                                        onSelect={() => {
                                            runCommand(() =>
                                                router.push(`/sec/marketcap/${navItem.korName}`)
                                            );
                                        }}
                                    >
                                        <MaskOffIcon className="mr-2 h-4 w-4" />
                                        {navItem.korName} - 스팩
                                    </CommandItem>
                                )
                        )}
                    </CommandGroup>

                    <CommandSeparator />
                    <CommandGroup heading="Theme">
                        <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
                            <SunIcon className="mr-2 h-4 w-4" />
                            라이트
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
                            <MoonIcon className="mr-2 h-4 w-4" />
                            다크
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
                            <LaptopIcon className="mr-2 h-4 w-4" />
                            시스템
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
