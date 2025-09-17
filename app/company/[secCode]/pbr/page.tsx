import { getAllCompanyCodes } from "@/lib/select";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { getSecurityByCode } from "@/lib/data/security";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";

/**
 * Props for Company PBR Page
 */
/**
 * Generate static params for all company pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const companyCodes = await getAllCompanyCodes();
    
    return companyCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error("[GENERATE_STATIC_PARAMS] Error generating company params:", error);
    return [];
  }
}


interface CompanyPBRPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the company PBR page
 */
export async function generateMetadata({ params }: CompanyPBRPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "기업을 찾을 수 없습니다 - CD3",
      description: "요청하신 기업을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 기업 PBR - CD3`,
    description: `${security.korName || security.name} 기업의 주가순자산비율(PBR) 분석과 투자 가치를 확인하세요.`,
  };
}

/**
 * Company PBR Page
 * Displays company-focused PBR analysis for a specific security
 */
export default async function CompanyPBRPage({ params }: CompanyPBRPageProps) {
  const { secCode } = await params;

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  const displayName = security.korName || security.name;

  return (
    <div className="container relative">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          홈
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <Link href="/company" className="hover:text-foreground">
          기업
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <Link href={`/company/${secCode}`} className="hover:text-foreground">
          {displayName}
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <span className="font-medium text-foreground">PBR</span>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl">
          <Balancer>
            {displayName} 기업 PBR 분석
          </Balancer>
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          주가순자산비율을 통한 기업 가치 평가
        </p>
      </div>

      {/* Mid Navigation */}
      <MidNavWrapper sectype={security.type || "보통주"} />

      {/* Content Placeholder */}
      <div className="space-y-8">
        <div className="p-8 border border-dashed rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-2">PBR 분석 개발 중</h2>
          <p className="text-muted-foreground">
            {displayName} 기업의 PBR 분석 페이지가 곧 제공될 예정입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
