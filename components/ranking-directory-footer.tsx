import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowUpRight, History } from "lucide-react";
import { RecentPanelTrigger } from "@/components/recent-panel-trigger";
import styles from "./ranking-directory-footer.module.css";

const groups = [
  {
    title: "시가총액",
    label: "시가총액 순위",
    links: [
      { href: "/marketcaps", title: "기업 합산", description: "보통주·우선주 합산" },
      { href: "/marketcap", title: "종목별", description: "개별 상장 종목" },
    ],
  },
  {
    title: "주가 지표",
    label: "주가 지표 순위",
    links: [
      { href: "/per", title: "PER", description: "주가수익비율" },
      { href: "/pbr", title: "PBR", description: "주가순자산비율" },
      { href: "/eps", title: "EPS", description: "주당순이익" },
      { href: "/bps", title: "BPS", description: "주당순자산" },
    ],
  },
  {
    title: "배당",
    label: "배당 순위",
    links: [
      { href: "/div", title: "배당수익률", description: "주가 대비 배당" },
      { href: "/dps", title: "주당배당금", description: "한 주당 배당금" },
    ],
  },
];

export function RankingDirectoryFooter() {
  return (
    <footer className={styles.footer} aria-label="전체 콘텐츠 목차">
      <div className="app-container">
        <div className={styles.directory}>
          <div className={styles.identity}>
            <div className={styles.brand}>
              <span className={styles.brandFirst}>천하제일</span>
              <Image src="/icon.svg" alt="" width={29} height={29} />
              <span>단타대회</span>
            </div>
            <p className={styles.description}>기업·종목별 숫자와<br /> 전체 순위를 확인하세요.</p>
            <Link prefetch={false} href="/" className={styles.allRankings}>
              전체 순위 살펴보기<ArrowRight aria-hidden="true" />
            </Link>
          </div>
          {groups.map(group => (
            <nav key={group.title} className={styles.group} aria-label={group.label}>
              <h2>{group.title}</h2>
              <ul className={`${styles.links} ${group.links.length === 4 ? styles.metrics : ""}`}>
                {group.links.map(link => (
                  <li key={link.href}>
                    <Link prefetch={false} href={link.href} className={styles.directoryLink}>
                      <strong>{link.title}</strong>
                      <span>{link.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <nav className={styles.bottom} aria-label="보조 탐색">
          <Link prefetch={false} href="/dashboard">메인<ArrowUpRight aria-hidden="true" /></Link>
          <div className={styles.actions}>
            <RecentPanelTrigger className={styles.recentButton}>최근 본 종목<History aria-hidden="true" /></RecentPanelTrigger>
            <a href="#ranking-title">맨 위로<ArrowUp aria-hidden="true" /></a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
