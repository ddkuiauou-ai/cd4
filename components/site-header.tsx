import Link from "next/link";
import Image from "next/image";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { CommandMenu } from "@/components/command-menu";

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

const Logo = () => (
  <Link href="/" className="flex items-center space-x-2">
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
  </Link>
);

export function SiteHeader({ searchData }: SiteHeaderProps) {
  return (
    <header
      data-site-header
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Logo />
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
