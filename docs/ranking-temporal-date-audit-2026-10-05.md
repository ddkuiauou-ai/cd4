# 랭킹 기준일과 Temporal 실행 조사

2026-10-05, Asia/Seoul. 기존 실행 이력·업무 DB·앱 코드를 읽어 대조한 조사 기준선이다. 이 조사에서 업무 DB, 앱 소스, 캐시, Workflow 실행 상태를 변경하지 않았다. 이후 공유 작업 폴더에서 진행 중인 메인 복구 수정은 별도 작업의 변경이며 검증 완료로 간주하지 않는다.

## 결론

2026년 원시 시계열은 일부 적재됐지만, 화면이 사용하는 최신 종목값·기업 합산값·순위의 전체 갱신은 완료되지 않았다. 현재 남아 있는 live Temporal 실행 15개(부모·자식 포함)에서 `finalize_finance` 발행은 0회다. 기업 첫 페이지에는 별도로 빈 결과 캐시가 존재한다.

기업 합산과 순위 계산은 이미 구현돼 있다. KONEX 실패로 전체 후처리를 막은 것은 기존 보호 조건과 전시장 완료 조건에 따른 동작이다. 장기 공백을 일일 명부 변화 조건으로 한 번에 처리한 것이 장애의 배경인지 검증해야 하며, Temporal 실패와 빈 웹 캐시의 직접적인 인과관계는 확정하지 않는다.

## 동일 업무 DB의 실제 상태

앱 `.env`와 Temporal `.env.live`의 host·port·database가 동일하고, 업무 schema는 public이다. 읽기 전용 트랜잭션으로 확인했으며 날짜는 `::text`로 조회해 드라이버의 Date 직렬화 영향을 제거했다.

| 조회 대상 | KOSPI | KOSDAQ | KONEX |
| --- | --- | --- | --- |
| price 최신일 | 2026-10-02 | 2026-10-02 | 2025-09-22 |
| price의 2026-10-02 행 수 | 942 | 1,824 | 0 |
| marketcap 최신일 | 2026-10-02 | 2026-10-02 | 2025-09-22 |
| marketcap의 2026-10-02 행 수 | 942 | 1,824 | 0 |
| bppedd 최신일 | 2026-10-02 | 2026-10-02 | 해당 데이터 없음 |
| bppedd의 2026-10-02 행 수 | 884 | 1,718 | 0 |
| security.price_date / marketcap_date 최댓값 | 2025-09-22 | 2025-09-22 | 2025-09-22 |

- company: 기존 2,674개 기업의 marketcap_date와 순위가 2025-09-22 기준으로 남아 있다. 신규 68개는 해당 값이 없다.
- security_rank: marketcap·bps·per·pbr·eps·div·dps의 최신 rank_date가 모두 2025-09-22다. 2026-10-02 순위는 0행이다.
- cd_temporal_finalize_receipt, cd_temporal_finalize_head, cd_temporal_company_rank는 모두 0행이다.
- 삼성전자 raw price에는 2026-10-02 행이 있지만 security.price_date 및 company.marketcap_date는 2025-09-22다.
- Naver의 두 날짜 시험 데이터는 cd_temporal_provider_price에 별도로 저장된다. 이 시험은 KRX 전체 랭킹 갱신과 연결되지 않는다.

## 실행 기록과 코드 경로

직접 SDK로 읽은 실행 목록과 대상일·결과·Activity 발행 수는 `/Users/craigchoi/tem/reports/cd-ranking-temporal-readonly-audit-2026-10-05.json`에 있다.

- live 입력 대상일은 2026-10-02 또는 2026-07-31이며, 최근 보존 이력에 2025년 날짜를 요청한 실행은 없다.
- KOSPI 단독 시험은 finalize=false였다.
- Naver daily는 Temporal Completed 상태여도 업무 결과가 partial / PARTIAL_SOURCES이며 전체 후처리는 미요청이다.
- KRX 전체 daily는 KONEX 명부 검증에서 SuspiciousSecurityDisappearance가 발생했고, 최종화는 blocked / UPSTREAM_FAILED다.
- KOSPI·KOSDAQ의 적재·검증 Activity 완료 이벤트는 실제 이력에 있다. KONEX의 적재 완료는 없다.
- finance_workflows.py:417에서 해당 날짜의 거래소 실패가 있으면 finalize_finance 호출을 건너뛴다.
- finance_database.py:1228의 security 최신 필드 갱신, :1287의 company 합산값 갱신, :1338의 company 순위 갱신은 finalize 안에 있다.

## KONEX 명부의 보호 조건과 실제 기준일

- 기존 활성 116개와 목표일 명부 107개는 공통 102개·신규 5개·기존 이탈 14개다. 검사 대상은 순감소 9개가 아니라 이탈 14개다.
- 조건 `max(5, ceil(active × 0.1))`은 116개에서 12개이며, 14개 차단은 조건대로의 동작이다. 12는 고정 상수가 아니다.
- 11:29 KST에 명부 기준일 입력을 읽기 전용으로 재확인했다. KONEX security head는 없고, stockcodename 최신일은 2025-09-22, 종목 listing 최신일은 2025-09-08, delisting 최신일은 2025-09-17이었다. 활성 116개, Temporal 명부 영수증 0개다. 코드가 사용하는 이 값들의 최댓값은 2025-09-22다.
- 기준일과 목표일 2026-10-02 사이에 375일 공백이 있다. 누적 정상 변화가 조건에 걸렸을 가능성은 있지만 14개 모두 정상이라는 확인은 없다.
- 명부 기준일은 거래소별이다. 더 최신 KOSPI·KOSDAQ 명부가 KONEX 기준일을 전진시키지는 않는다. KONEX 유효 기준일보다 이른 날짜는 historical로 처리돼 master를 갱신하지 않는다.
- 실제 거래일별 `refresh_security=True / finalize=False` 순차 반영을 우선 검증한다. 단순 history는 목적에 맞지 않고, 현재 다일 실행은 중간 실패 후에도 다음 날짜로 진행하므로 하루 성공을 확인한 뒤 다음 날짜를 발행해야 한다.

## 화면과 캐시

- 종목 목록은 lib/data/security.ts:47에서 security_rank의 최신 rank_date를 조회한다. 새 raw marketcap 적재만으로 목록의 시총·순위는 바뀌지 않는다.
- 기업 목록은 lib/data/company.ts:101에서 company의 marketcap·marketcap_rank를 조회한다.
- 기업 첫 페이지의 현재 cache key는 `9b437ab1c4855a46d1b5a50ed4ca6b612dc43df1ed2531ab6e46900b3ed4c42d`이며, items=[]가 2026-10-04 13:22:50 KST에 저장됐다. 현재 compiled callback 및 인자 [1]과 key가 일치한다.
- 최근 생성된 종목 목록 캐시에는 latestDate=2025-09-22인데 가격 이력은 2026-10-02까지 있는 사례도 있다. 순위와 가격의 기준일이 같은 화면에서 달라질 수 있다.
- 기업 기준일 helper(lib/utils.ts:240)는 company.marketcapDate가 아닌 대표 종목의 마지막 price.date를 사용한다. 랭킹 기준일은 집계 snapshot 날짜로 표시하고, 가격 기준일은 별도 표시하는 편이 정확하다.
- 사용자는 2025-09-21을 웹 랭킹 화면에서 봤다고 확인했다. 현재 개발 서버의 /marketcap, /per, /bps를 HTTP로 읽어 비교하면 모두 기준일 2025-09-22이고 2025-09-21 표시는 없다. 확인한 관련 날짜 캐시와 기존 HTML도 2025-09-22다. 이후 사용자가 하루 차이를 깊이 조사할 필요가 없다고 명시해 별도 조사는 종료했다. 기본 postgres 드라이버의 JS Date 직렬화가 원시 2025-09-22 00:00:00을 2025-09-21T15:00:00Z로 출력할 수 있으므로, ISO 출력값을 원시 업무 기준일로 혼동하면 안 된다. fresh Drizzle의 현재 경로는 2025-09-22T00:00:00Z로 읽는다.

## 테스트 범위와 남은 검증

격리 Temporal + SQLite fixture 및 임시 PostgreSQL schema의 집계 성공·원자적 rollback·재실행·동시성 테스트 기록은 있다. 이번 조사에서는 독립 계산 audit의 순수 unit 21개를 재실행했고 모두 통과했다. 실제 KRX + 업무 DB + CD4 화면까지 이어지는 성공 인수는 완료되지 않았다. 기존 실제 인수 문서도 실패와 미실행 범위를 명시한다.

남은 검증은 로컬 웹·격리 DB 회귀 → 실제 기준일 이후 거래일 명부의 하루씩 순차 반영 → 목표일 KONEX 적재와 성공한 다른 시장 저장값/영수증 재검증 → 같은 날짜 세 시장 coverage 확인 → finalize 성공 → 최신 security/company 필드 및 두 종류 순위의 독립 계산 검증 → 정상 캐시 재검증과 화면 대조다. 특정 구간이 실패하면 원본과 종목 변화를 조사한다. 반복 재처리에서도 전체 후처리 요구를 유지하는 회귀와 기존 실패 Run 호환을 확인한다. 웹 빈 화면은 기존 완료 데이터로 먼저 복구할 수 있으며, 실제 최신 갱신 성공·운영 반영과 구분한다. 상세 조건은 [수정 계획](ranking-fix-test-plan-2026-10-05.md)에 있다.
