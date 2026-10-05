import Link from "next/link";

interface SecurityMetricEmptyProps {
  secCode: string;
  displayName: string;
  metricLabel: string;
}

export function SecurityMetricEmpty({ secCode, displayName, metricLabel }: SecurityMetricEmptyProps) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <h1 className="text-2xl font-bold">{displayName} {metricLabel}</h1>
      <p className="text-muted-foreground">이 종목의 {metricLabel} 이력이 아직 등록되지 않았습니다.</p>
      <Link
        href={`/security/${secCode}/marketcap`}
        className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        시가총액 보기
      </Link>
    </main>
  );
}
