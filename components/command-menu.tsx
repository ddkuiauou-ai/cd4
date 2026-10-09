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
import { Search } from "lucide-react";
import { useSearchData } from "@/components/search-data";
import { companyPath, securityPath, securityRouteCodes, companyRouteCodes } from "@/lib/entity-paths";

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
import {
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"; // Import DialogTitle and DialogDescription

const classifiedSecurityTypes = new Set(["보통주", "우선주", "전환우선주", "리츠", "펀드", "스팩"]);

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data, status, retry } = useSearchData(open);
  const { setTheme } = useTheme();
  const securityCodes = securityRouteCodes(data);
  const companyCodes = companyRouteCodes(data);
  const securityHref = (item: (typeof data)[number]) => securityPath({ ...item,
    routeCode: item.routeCode !== undefined ? item.routeCode : securityCodes.get(item.securityId) ?? null }, 'marketcap');
  const companyHref = (item: (typeof data)[number]) => companyPath({ companyId: item.companyId!,
    routeCode: item.companyRouteCode !== undefined ? item.companyRouteCode : companyCodes.get(item.companyId!) ?? null });
  // CMDK uses value as selection identity and search text. Include both the
  // stable destination identity and the terms people use to find a security.
  const securityValue = (item: (typeof data)[number]) => `security:${item.securityId} ${item.korName} ${item.type || '기타'} ${item.exchange} ${item.ticker}`;
  const companyValue = (item: (typeof data)[number]) => `company:${item.companyId} 기업 ${item.korName} ${item.exchange} ${item.ticker}`;
  const seenCompanies = new Set<string>();
  const companyItems = data.filter(item => {
    if (item.type !== '보통주' || !item.companyId || seenCompanies.has(item.companyId)) return false;
    seenCompanies.add(item.companyId);
    return true;
  });

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

    const openSearch = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("app:open-search", openSearch);
    return () => { document.removeEventListener("keydown", down); window.removeEventListener("app:open-search", openSearch); };
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
          "relative h-10 w-full justify-start rounded-md bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 "
        )}
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center space-x-2 w-full">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>기업 · 종목 검색</span>
        </div>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">검색창</DialogTitle> {/* Add sr-only DialogTitle */}
        <DialogDescription className="sr-only">기업, 종목을 검색하거나 테마를 변경할 수 있습니다.</DialogDescription> {/* Optional: Add sr-only DialogDescription */}
        <CommandInput placeholder="검색할 기업 또는 종목을 입력하세요" />
        <CommandList>
          {status === "idle" || status === "loading" ? (
            <div role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">
              검색 데이터를 불러오는 중입니다.
            </div>
          ) : status === "error" ? (
            <div role="alert" className="space-y-3 px-4 py-6 text-center text-sm">
              <p className="text-muted-foreground">검색 데이터를 불러오지 못했습니다.</p>
              <Button variant="outline" size="sm" onClick={retry}>다시 시도</Button>
            </div>
          ) : (
            <CommandEmpty>검색 결과 없음.</CommandEmpty>
          )}
          <CommandGroup heading="기업">
            {companyItems.map(
              (navItem) => (
                  <CommandItem
                    key={`corp${navItem.securityId}`}
                    value={companyValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(companyHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
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
                    value={securityValue(navItem)}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(securityHref(navItem))
                      );
                    }}
                  >
                    <MaskOffIcon className="mr-2 h-4 w-4" />
                    {navItem.korName} - 스팩
                  </CommandItem>
                )
            )}
          </CommandGroup>

          <CommandGroup heading="기타 종목">
            {data.filter(item => !classifiedSecurityTypes.has(item.type ?? "")).map(navItem => (
              <CommandItem
                key={`other${navItem.securityId}`}
                value={securityValue(navItem)}
                onSelect={() => runCommand(() => router.push(securityHref(navItem)))}
              >
                <CircleIcon className="mr-2 h-4 w-4" />
                {navItem.korName} · {navItem.exchange} {navItem.ticker}
              </CommandItem>
            ))}
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
