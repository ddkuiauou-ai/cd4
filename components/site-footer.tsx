import Image from "next/image";
import Link from "next/link";
import { DetailFooterLink } from "@/components/detail-footer-link";
import { metricItems, RANKING_METRIC_NAV_ID } from "@/lib/metric-navigation";
import styles from "./site-footer.module.css";

export type SiteFooterContext = "main" | "ranking" | "detail";

const groups = [
  {
    id: "marketcap",
    title: "시가총액",
    links: [
      { href: "/marketcaps", label: "기업 합산" },
      { href: "/marketcap", label: "종목별" },
    ],
  },
  {
    id: "metrics",
    title: "주가 지표",
    links: metricItems.filter(({ key }) => key !== "marketcap" && key !== "div" && key !== "dps"),
  },
  {
    id: "dividends",
    title: "배당",
    links: metricItems.filter(({ key }) => key === "div" || key === "dps"),
  },
];

export function SiteFooter({ context = "main" }: { context?: SiteFooterContext }) {
  return (
    <footer className={styles.footer} aria-label="사이트 푸터">
      <div className="app-container">
        <div className={styles.heading}>
          <span className={styles.brand} role="img" aria-label="천하제일 단타대회">
            <span className={styles.brandFirst}>천하제일</span>
            <Image src="/icon.svg" alt="" width={26} height={26} />
            <span>단타대회</span>
          </span>
          {context === "ranking" ? (
            <a className={styles.action} href={`#${RANKING_METRIC_NAV_ID}`}>지표 메뉴로 돌아가기</a>
          ) : context === "detail" ? (
            <DetailFooterLink className={styles.action} />
          ) : (
            <Link prefetch={false} href="/" className={styles.action}>전체 랭킹 보기</Link>
          )}
        </div>
        <nav className={styles.directory} aria-label="전체 순위 목차">
          {groups.map(({ id, title, links }) => (
            <section key={id} aria-labelledby={`footer-${id}`}>
              <h2 id={`footer-${id}`}>{title}</h2>
              <ul className={id === "metrics" ? styles.metrics : undefined}>
                {links.map(({ href, label }) => (
                  <li key={href}><Link prefetch={false} href={href}>{label}</Link></li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </footer>
  );
}
