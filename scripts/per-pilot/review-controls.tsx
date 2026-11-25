'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { RecordLoading } from '@/components/record-loading';
import styles from './review-controls.module.css';

export function PerPilotReviewControls() {
  const query = useSearchParams();
  const [paused, setPaused] = useState(false);
  if (query.get('review') !== '1' && query.get('font') !== 'gowun') return null;

  return <aside className={styles.review} aria-labelledby="loading-preview-title" id="loading-preview">
    <div className={styles.tools}>
      <h2 id="loading-preview-title">로딩 미리보기</h2>
      <button type="button" onClick={() => setPaused(!paused)} aria-controls="loading-preview-stage">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
          <path d={paused ? 'M2 1.5v9l8-4.5Z' : 'M2 1.5h2.5v9H2zm5.5 0H10v9H7.5z'} />
        </svg>
        {paused ? '계속 재생' : '일시정지'}
      </button>
    </div>
    <div id="loading-preview-stage" className={styles.stage} data-paused={paused || undefined}>
      <RecordLoading label="기록을 불러오는 중…" />
    </div>
  </aside>;
}
