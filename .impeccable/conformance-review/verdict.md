disposition: ship

## verdict

Scope: verdict pass on F1–F4 from [full-review.md](/Users/craigchoi/silla/cd4/.impeccable/conformance-review/full-review.md), not a new full review. I opened all 29 replacement PNGs and the fresh four-material-fixes-verdict capture context, inspected the relevant source and targeted SSR tests, and used readable crops for the changed detail regions. The regions needed to score these fixes are valid. No browser, build, detector, test execution, or product edit was performed by this reviewer.

| Finding | Verdict | Exit evidence |
| --- | --- | --- |
| F1 — selected security in sparse history | **resolved** | InteractiveChartSection now passes selectedSecurityId into the sparse observation. The component selects by exact ID, puts that observation first, emphasizes its name/value, and labels the total and other securities as comparisons. Both themes at desktop and mobile show 삼성전자우/005935 first with 161조 and the shared observation date; company captures retain the aggregate state. detail-history-presentation.test.cjs renders the actual sparse branch and asserts same-name preferred-stock ID selection, real zero, registered-value absence, absent ID, and no fabricated chart. |
| F2 — local snapshot/price/history/period basis | **resolved** | The core-metrics section now states its snapshot/rank date, independent price date, actual history range or last record, and “기간 평균·비교는 오늘 기준으로 계산합니다.” Desktop and mobile crops show 2025-09-22 snapshot, 2026-10-02 price/history endpoint, and the separate period basis in both themes. Historical extrema are labeled “이력 최저/최고 시총.” The rail communicates the same distinctions. The SSR cases verify source-paired dates, selected-security history rather than a sibling endpoint, and retained execution-day cutoffs. |
| F3 — real zero in selected-security statistics | **resolved** | getSecurityMarketcapHistory reads that exact security's real records, retains finite zero, and excludes null/non-finite/invalid-dated records. Section and rail use those observations for means and extrema rather than aggregation-injected zeros. The actual-component SSR assertions cover [0,100] → average50/min0/max100, all-zero → 0 including when periodAnalysis is null, mixed missing/zero records, no actual security record → missing, period comparisons, and stale-record cutoffs. Positive production captures are not used as proof of these zero cases. |
| F4 — remove Tab Sync callout | **resolved** | The standalone implementation explanation and badge are removed from source. Replacement full-page captures and readable desktop/mobile crops show comparison leading directly into core-metrics dates and content, without the former block. Metric navigation remains in the source and captured detail header. |

The reported final 141/141 tests and type-check pass are consistent with the inspected targeted evidence; this reviewer did not rerun them.

## remaining

No partial or unresolved item remains in F1–F4. **ship applies only to this four-fix verdict.** It does not assert whole-surface approval, user acceptance, lint success, completion of the separate build/documentation handoff, or verification of uncaptured interactions.

