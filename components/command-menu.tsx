"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LaptopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { Search } from "lucide-react";
import { useSearchData } from "@/components/search-data";
import { companyPath, securityPath, securityRouteCodes, companyRouteCodes } from "@/lib/entity-paths";
import { createSecuritySearchIndex, searchSecurityIndex } from "@/lib/security-search";
import { createSecurityTypoIndex, searchSecurityTypos } from "@/lib/security-typo-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Selection = { securityId: string; column: 0 | 1 };

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [isComposing, setIsComposing] = React.useState(false);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const grid = React.useRef<HTMLDivElement>(null);
  const composing = React.useRef(false);
  const id = React.useId();
  const gridId = `${id}-results`;
  const countId = `${id}-count`;
  const helpId = `${id}-help`;
  const cellId = (row: number, column: number) => `${id}-cell-${row}-${column}`;
  const { data, status, retry } = useSearchData(open);
  const { theme, setTheme } = useTheme();

  // Prepare fields and identity-safe destinations once per data snapshot.
  // Only the bounded result set becomes React rows; input has no debounce.
  const index = React.useMemo(() => createSecuritySearchIndex(data), [data]);
  const typoIndex = React.useMemo(() => createSecurityTypoIndex(data), [data]);
  const destinations = React.useMemo(() => {
    const securities = securityRouteCodes(data);
    const companies = companyRouteCodes(data);
    return new Map(data.map(item => [item.securityId, {
      security: securityPath({ ...item, routeCode: item.routeCode !== undefined
        ? item.routeCode : securities.get(item.securityId) ?? null }, "marketcap"),
      company: item.companyId ? companyPath({ companyId: item.companyId,
        routeCode: item.companyRouteCode !== undefined
          ? item.companyRouteCode : companies.get(item.companyId) ?? null }) : null,
    }]));
  }, [data]);
  const directResults = React.useMemo(() => searchSecurityIndex(index, query), [index, query]);
  const suggestions = React.useMemo(() => (
    directResults.total === 0 && status === "success" && !isComposing
      ? searchSecurityTypos(typoIndex, query) : []
  ), [directResults.total, status, isComposing, typoIndex, query]);
  const isSuggestion = suggestions.length > 0;
  const results = isSuggestion ? { items: suggestions, total: suggestions.length } : directResults;
  const selectedRow = selection ? results.items.findIndex(item => item.securityId === selection.securityId) : -1;
  const selectedColumn = selectedRow >= 0 && selection?.column === 1
    && destinations.get(results.items[selectedRow].securityId)?.company ? 1 : 0;

  const openSearch = React.useCallback((source?: HTMLElement) => {
    const active = document.activeElement;
    opener.current = source ?? (active instanceof HTMLElement && active !== document.body ? active : trigger.current);
    setQuery("");
    composing.current = false;
    setIsComposing(false);
    setSelection(null);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/") {
        if (event.isComposing || event.keyCode === 229
          || (event.target instanceof HTMLElement && event.target.isContentEditable)
          || event.target instanceof HTMLInputElement
          || event.target instanceof HTMLTextAreaElement
          || event.target instanceof HTMLSelectElement) return;
        event.preventDefault();
        if (open) setOpen(false);
        else openSearch();
      }
    };
    const externalSearch = () => openSearch();
    document.addEventListener("keydown", down);
    window.addEventListener("app:open-search", externalSearch);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("app:open-search", externalSearch);
    };
  }, [open, openSearch]);

  function selectCell(row: number, column: 0 | 1) {
    const item = results.items[row];
    const nextColumn = column === 1 && destinations.get(item.securityId)?.company ? 1 : 0;
    setSelection({ securityId: item.securityId, column: nextColumn });
    document.getElementById(cellId(row, nextColumn))?.scrollIntoView({ block: "nearest" });
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter confirms Korean IME composition; it must not navigate away.
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!results.items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectCell(Math.min(selectedRow + 1, results.items.length - 1), selectedColumn);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (selectedRow === 0) setSelection(null);
      else selectCell(selectedRow < 0 ? results.items.length - 1 : selectedRow - 1, selectedColumn);
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && selectedRow >= 0) {
      event.preventDefault();
      if (event.key === "ArrowLeft" && selectedColumn === 0) setSelection(null);
      else selectCell(selectedRow, event.key === "ArrowRight" ? 1 : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // A similar name is a suggestion, so require an explicit row selection.
      if (isSuggestion && selectedRow < 0) return;
      const item = results.items[Math.max(0, selectedRow)];
      const destination = destinations.get(item.securityId)!;
      setOpen(false);
      router.push(selectedColumn === 1 ? destination.company! : destination.security);
    } else if (event.key === "Home" || event.key === "End") {
      setSelection(null);
    }
  }

  return (
    <>
      <Button type="button" ref={trigger} variant="outline" className="header-search-trigger"
        aria-label="기업·종목 검색 열기" aria-haspopup="dialog" aria-expanded={open}
        onClick={event => openSearch(event.currentTarget)}>
        <Search aria-hidden="true" />
        <span className="header-search-short" aria-hidden="true">검색</span>
        <span className="header-search-long" aria-hidden="true">기업 · 종목 검색</span>
        <kbd className="header-search-key" aria-hidden="true"><span className="text-xs">⌘</span>K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="search-dialog flex translate-y-0 flex-col gap-0 overflow-hidden p-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-xl"
          onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}
          onEscapeKeyDown={event => { if (composing.current || event.isComposing || event.keyCode === 229) event.preventDefault(); }}
          onCloseAutoFocus={event => {
            composing.current = false;
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus({ preventScroll: true });
            }
          }}>
          <DialogTitle className="sr-only">기업·종목 검색</DialogTitle>
          <DialogDescription className="sr-only">종목명, 종목 코드, 초성으로 검색하고 종목 상세나 기업 정보로 이동합니다.</DialogDescription>
          <div className="search-input-row relative flex shrink-0 items-center gap-2 border-b px-3 pr-10">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input ref={input} type="text" role="combobox" aria-label="종목 검색"
              aria-autocomplete="list" aria-haspopup="grid" aria-expanded={open} aria-controls={gridId}
              aria-describedby={`${countId} ${helpId}`}
              aria-activedescendant={selectedRow >= 0 ? cellId(selectedRow, selectedColumn) : undefined}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              placeholder="종목명, 코드, 초성으로 검색" value={query}
              onChange={event => {
                setQuery(event.target.value);
                setSelection(null);
                if (grid.current) grid.current.scrollTop = 0;
              }}
              onCompositionStart={() => {
                composing.current = true;
                setIsComposing(true);
                setSelection(null);
              }}
              onCompositionEnd={event => {
                composing.current = false;
                setIsComposing(false);
                setQuery(event.currentTarget.value);
              }}
              onKeyDown={handleInputKeyDown}
              onBlur={() => setSelection(null)}
              className="search-input h-12 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground sm:text-sm" />
          </div>
          <div className="search-results-body flex min-h-0 flex-col">
            <div id={countId} role="status" className="shrink-0 px-3 py-2 text-xs text-muted-foreground">
              {status === "idle" || status === "loading" ? "검색 데이터를 불러오는 중입니다."
                : status === "error" ? "검색 데이터를 불러오지 못했습니다."
                : isComposing && directResults.total === 0 ? "입력 중…"
                : isSuggestion ? `일치하는 종목 없음 · 비슷한 이름 ${suggestions.length}개`
                : results.total > results.items.length
                  ? `${results.total.toLocaleString()}개 중 상위 ${results.items.length}개 표시 · 더 입력하면 결과를 좁힐 수 있습니다.`
                  : `${results.total.toLocaleString()}개 종목`}
            </div>
            {status === "error" ? (
              <div className="shrink-0 px-3 pb-2"><Button variant="outline" size="sm" onClick={retry}>다시 시도</Button></div>
            ) : null}
            {/* A grid supports two independent links per result. A listbox option
                cannot contain an independently operable company action. */}
            <div ref={grid} id={gridId} role="grid" aria-label="종목 검색 결과" aria-colcount={2}
              aria-busy={status === "idle" || status === "loading"}
              className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">
              {results.items.map((item, row) => {
                const destination = destinations.get(item.securityId)!;
                return (
                  <div key={item.securityId} role="row" data-security-id={item.securityId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-border last:border-b-0">
                    <div id={cellId(row, 0)} role="gridcell" aria-selected={selectedRow === row && selectedColumn === 0}
                      className="min-w-0 rounded-sm aria-selected:bg-accent aria-selected:text-accent-foreground">
                      <Link href={destination.security} prefetch={false} tabIndex={-1}
                        aria-label={`${item.korName} ${item.ticker} ${item.exchange} ${item.type || "기타"} 종목 상세`} onClick={() => setOpen(false)}
                        className="flex min-h-14 flex-col justify-center gap-0.5 rounded-sm px-2 py-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="break-words text-sm font-medium">{item.korName}</span>
                        <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">{item.ticker}</span><span>{item.exchange}</span><span>{item.type || "기타"}</span>
                        </span>
                      </Link>
                    </div>
                    <div id={cellId(row, 1)} role="gridcell" aria-selected={selectedRow === row && selectedColumn === 1}
                      className="flex items-center rounded-sm aria-selected:bg-accent aria-selected:text-accent-foreground">
                      {destination.company ? (
                        <Link href={destination.company} prefetch={false} tabIndex={-1}
                          aria-label={`${item.korName} 기업 정보`} onClick={() => setOpen(false)}
                          className="flex min-h-11 items-center rounded-sm px-3 text-xs text-muted-foreground underline underline-offset-4 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">기업 정보</Link>
                      ) : <span className="sr-only">연결된 기업 정보 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {status === "success" && !isComposing && results.total === 0 ? (
              <p className="shrink-0 px-4 pb-6 pt-3 text-center text-sm text-muted-foreground">검색 결과 없음.</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-3 py-1">
            <p id={helpId} className="text-xs text-muted-foreground">
              {isSuggestion ? "↑↓ 선택 후 Enter · ←→ 종목/기업" : "↑↓ 선택 · ←→ 종목/기업 · Enter 열기"}
            </p>
            <div className="flex items-center gap-1" role="group" aria-label="테마">
              {([{ value: "light", label: "라이트", Icon: SunIcon }, { value: "dark", label: "다크", Icon: MoonIcon },
                { value: "system", label: "시스템", Icon: LaptopIcon }] as const).map(({ value, label, Icon }) => (
                <Button key={value} variant="ghost" size="icon" className="h-11 w-11" aria-label={label} aria-pressed={theme === value}
                  onClick={() => { setTheme(value); setOpen(false); }}><Icon className="h-4 w-4" aria-hidden="true" /></Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
