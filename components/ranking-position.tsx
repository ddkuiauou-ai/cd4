"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { rankMovement } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

export function RankingPosition({ rank, priorRank }: { rank: number | null; priorRank: number | null }) {
  const movement = rankMovement(rank, priorRank);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const description = movement == null ? "이전 순위 정보가 없습니다." : movement === 0 ? `이전 ${priorRank}위 → 현재 ${rank}위 · 순위 유지` : `이전 ${priorRank}위 → 현재 ${rank}위 · ${Math.abs(movement)}계단 ${movement > 0 ? "상승" : "하락"}`;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className={styles.positionWrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => {
      if (!ref.current?.contains(document.activeElement)) setOpen(false);
    }}>
      <button type="button" className={styles.position} data-rank={rank ?? undefined} data-digits={String(rank ?? "").length}
        aria-label={`${rank == null ? "순위 정보 없음" : `${rank}위`}. ${description}`}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
        <span className={styles.rank}>{rank?.toLocaleString("ko-KR") ?? "—"}</span>
        {movement != null && <span className={styles.movement} aria-hidden="true">{movement === 0 ? "유지" : <>{movement > 0 ? <ArrowUp /> : <ArrowDown />}<span>{Math.abs(movement).toLocaleString("ko-KR")}</span></>}</span>}
      </button>
      {open && <div id={id} role="tooltip" className={styles.rankNote}>{description}<span>이전 순위 대비 · 주가 등락과 별개</span></div>}
    </div>
  );
}
