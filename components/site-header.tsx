"use client";

import Link from "next/link";
import Image from "next/image";
import { Balancer } from "react-wrap-balancer";

import CompanyLogo from "@/components/CompanyLogo";
import { CommandMenu } from "@/components/command-menu";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { useMobileHeader } from "@/components/mobile-header-context";
import { cn } from "@/lib/utils";

// Define props for SiteHeader to accept searchData
interface SiteHeaderProps {
  searchData: {
    securityId: string;
    companyId: string | null;
    korName: string;
    type: string | null;
    exchange: string;
  }[];
}

const Logo = ({ showMobileVariant = true }: { showMobileVariant?: boolean }) => (
  <Link
    href="/"
    className={cn(
      "items-center space-x-2",
      showMobileVariant ? "flex" : "hidden sm:flex"
    )}
  >
    {/* Default (sm and up) */}
    <div className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all duration-300 group">
      <span
        className="font-serif font-bold text-xl text-rose-500 transition-all duration-300"
        style={{ textShadow: "-1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000" }}
      >
        천하제일
      </span>
      <div className="relative">
        <Image
          src="/icon.svg"
          alt="로고"
          width={28}
          height={28}
          className="h-7 w-7 transition-transform duration-300 group-hover:rotate-12"
        />
      </div>
      <span
        className="font-serif font-bold text-xl text-yellow-500 transition-all duration-300"
        style={{ textShadow: "-1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000" }}
      >
        단타대회
      </span>
    </div>

    {/* XS layout */}
    {showMobileVariant ? (
      <div className="flex sm:hidden items-center space-x-1.5 px-2 py-2 rounded-lg transition-all duration-300 group">
        <span
          className="font-serif font-bold text-lg text-rose-500 transition-all duration-300"
          style={{ textShadow: "-1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000" }}
        >
          천하
        </span>
        <div className="relative">
          <Image
            src="/icon.svg"
            alt="로고"
            width={24}
            height={24}
            className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12"
          />
        </div>
        <span
          className="font-serif font-bold text-lg text-rose-500 transition-all duration-300"
          style={{ textShadow: "-1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000" }}
        >
          제일
        </span>
      </div>
    ) : null}
  </Link>
);

type MobileCompanyIdentityProps = {
  displayName: string;
  companyName?: string | null;
  logoUrl?: string | null;
  titleSuffix?: string | null;
  titleBadge?: string | null;
  detail?: {
    label?: string | null;
    value?: string | null;
    badge?: string | null;
  } | null;
};

function MobileCompanyIdentity({
  displayName,
  companyName,
  logoUrl,
  titleSuffix,
  titleBadge,
  detail,
}: MobileCompanyIdentityProps) {
  const headingSuffix = titleSuffix ?? "시가총액";
  const headingText = headingSuffix ? `${displayName} ${headingSuffix}` : displayName;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 sm:hidden">
      <CompanyLogo
        companyName={companyName ?? displayName}
        logoUrl={logoUrl}
        size={40}
        className="h-10 w-10 flex-shrink-0 shadow-sm"
      />
      <div className="min-w-0">
        <h1 className="font-heading text-lg font-bold leading-tight tracking-tight">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Balancer>{headingText}</Balancer>
            {titleBadge ? (
              <span className="text-xs font-medium text-muted-foreground">
                {titleBadge}
              </span>
            ) : null}
          </span>
        </h1>
        {(detail?.value || detail?.label || detail?.badge) && (
          <div className="mt-0.5 space-y-0.5">
            {detail?.value && (
              <p className="text-sm font-medium text-foreground">
                {detail?.label ? `${detail.label} ` : null}
                {detail.value}
              </p>
            )}
            {detail?.badge && (
              <p className="text-xs text-muted-foreground">{detail.badge}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SiteHeader({ searchData }: SiteHeaderProps) {
  const { content } = useMobileHeader();
  const showMobileCompany = content?.type === "company";

  return (
    <header
      data-site-header
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Logo showMobileVariant={!showMobileCompany} />
          {showMobileCompany && content ? (
            <MobileCompanyIdentity
              displayName={content.displayName}
              companyName={content.companyName}
              logoUrl={content.logoUrl}
              titleSuffix={content.titleSuffix}
              titleBadge={content.titleBadge}
              detail={content.detail}
            />
          ) : null}
          <div className="hidden md:block">
            <MainNav />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
          <div className="flex-1 sm:flex-none sm:justify-end">
            <CommandMenu data={searchData} />
          </div>
          <div className="hidden sm:block">
            <ModeToggle />
          </div>
          <div className="md:hidden">
            <MobileNav searchData={searchData} />
          </div>
        </div>
      </div>
    </header>
  );
}
