'use client';

import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { observeVisibleMotion } from '@/lib/observe-visible-motion';
import styles from './record-loading.module.css';

// The rhythm climbs the four base marks, the two shoulders, then the apex.
const marks = [
  { x: 23, y: 74, delay: 40 },
  { x: 41, y: 74, delay: 115 },
  { x: 59, y: 74, delay: 190 },
  { x: 77, y: 74, delay: 265 },
  { x: 41, y: 51, delay: 385 },
  { x: 59, y: 51, delay: 460 },
  { x: 50, y: 28, delay: 610 },
];

export function RecordLoading({ label, overChart = false }: { label: string; overChart?: boolean }) {
  return <span role="status" className={overChart ? `${styles.status} ${styles.overChart}` : styles.status}>
    <span ref={observeVisibleMotion} className={styles.scene} aria-hidden="true">
      <span className={styles.triangle}>
        {marks.map(({ x, y, delay }) => (
          <span key={delay} className={styles.mark} style={{
            left: `${x}%`, top: `${y}%`, '--arrival': `${delay}ms`,
          } as CSSProperties}>
            <Image className={styles.logo} src="/icon.svg" alt="" width={32} height={32} loading="eager" />
          </span>
        ))}
      </span>
      <span className={styles.reveal}>
        <span className={styles.dragon}>
          <span className={styles.tail} />
          <span className={styles.body} />
          <span className={styles.head} />
          <span className={styles.coil} />
        </span>
      </span>
      <svg className={styles.clouds} viewBox="0 0 160 128" focusable="false">
        <g className={styles.leftCloud}>
          <path d="M87 88c-6 6-15 11-25 11-6 0-9-2-15-2-7 0-12 4-19 2 9-1 12-7 21-7 5 0 8 3 14 2-6-1-7-5-13-5 9-3 13 4 22 3 6 0 11-2 15-4Z" />
          <path d="M48 104c-7 0-10 4-18 3 7 4 13-1 18-3Z" />
        </g>
        <g className={styles.rightCloud}>
          <path d="M75 86c9-2 13-7 20-11 7-4 12-3 17-5 6-2 9-6 15-6-5 2-6 7-11 10 7-3 14-3 20-1-8 0-12 5-21 5-11-1-18 5-26 7-5 2-10 2-14 1Z" />
          <path d="M119 66c3-4 8-6 15-5-5 1-10 4-15 5Z" />
        </g>
      </svg>
    </span>
    <span>{label}</span>
  </span>;
}

export function PendingChart({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.frame}>{children}<RecordLoading label={label} overChart /></div>;
}
