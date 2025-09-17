import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { getSecurityByCode } from "@/lib/data/security";
import { getAllCompanyCodes } from "@/lib/select";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";
import { generateCompanyMetadata } from "@/lib/metadata";

/**
 * Generate static params for all company DIV pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const companyCodes = await getAllCompanyCodes();

    return companyCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error(
      "[GENERATE_STATIC_PARAMS] Error generating company DIV params:",
      error
    );
    return [];
  }
}

interface CompanyDivPageProps {
  params: Promise<{ secCode: string }>;
}

export async function generateMetadata({ params }: CompanyDivPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);
  if (!security) {
    return {
      title: "기업을 찾을 수 없습니다 - CD3",
      description: "요청하신 기업을 찾을 수 없습니다.",
    };
  }
  return generateCompanyMetadata(
    security.korName || security.name,
    secCode,
    "div"
  );
}

export default async function CompanyDivPage({ params }: CompanyDivPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);
  if (!security) {
    notFound();
  }
  const displayName = security.korName || security.name;
  return (
    <div className="container relative">
      <div className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          홈
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <Link href="/company" className="hover:text-foreground">
          기업
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <Link
          href={`/company/${secCode}`}
          className="hover:text-foreground"
        >
          {displayName}
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <span className="font-medium text-foreground">배당수익률</span>
      </div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl">
          <Balancer>{displayName} 기업 배당수익률</Balancer>
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          배당수익률(DIV) 변동 추이 분석
        </p>
      </div>
      <MidNavWrapper sectype={security.type || "보통주"} />
      <div className="space-y-8">
        <div className="p-8 border border-dashed rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-2">배당수익률 분석 개발 중</h2>
          <p className="text-muted-foreground">
            {displayName} 기업의 DIV 분석 페이지가 곧 제공될 예정입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
