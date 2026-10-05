# 랭킹 최소 수정과 로컬 검증 결과

2026-10-05 Asia/Seoul. [수정 계획](ranking-fix-test-plan-2026-10-05.md)에 따라 기존 메인 수정과 테스트를 재사용하고 랭킹에 남은 범위를 수정했다. 실제 업무 DB는 SELECT만 수행했다. 실제 KONEX 거래일별 수집·명부 반영, 전체 후처리, 운영 배포는 실행하지 않았다.

## 결과

- 웹 선택 테스트 21개 통과: 기존 메인 캐시 8개, 대시보드 3개, 랭킹 신규 10개.
- Temporal 선택 회귀 303개 통과: planner·검증·웹 재처리 154개(153개와 별도 HTTP 1개), 종목마스터/SQLite 금융 112개, 격리 SDK 5개, 전용 임시 PostgreSQL 32개. 기존 메인 119개 보고서는 중복되므로 합산하지 않았다. 전체 프로젝트 테스트 수가 아니다.
- 실제 로컬 브라우저의 기업·종목 탭, 기업 다음 페이지, 모바일 표시, CSV를 확인했다. 확인한 탭에서 오류 overlay와 console error는 없었다.
- `git diff --check` 통과. 전체 타입 검사는 기존 다른 파일 오류 8개로 실패했으며 수정한 파일의 타입 오류는 없었다.

## 변경

| 범위 | 최종 변경 |
| --- | --- |
| 랭킹 조회·캐시 | 메인에서 추가한 `cachedData` 정책을 종목 목록·개수에도 적용했다. DB 조회 오류는 빈 배열/0으로 바꾸지 않고 전달한다. 개발 캐시 우회, 운영 300초 재검증과 새 namespace를 재사용한다. |
| 기업 기준일 | `getLatestDateFromMarketData`가 이미 조회하는 `company.marketcapDate`를 사용한다. 대표 종목의 더 최신 가격 날짜를 회사 순위 기준일로 사용하지 않는다. |
| 업데이트 시각 | 회사의 기존 `updatedAt`, 종목의 `security_rank.updatedAt`을 조회하고 KST로 표시한다. 종목 시총 첫/후속 페이지의 기준일+9시간 계산을 제거했다. 값이 없거나 잘못되면 N/A다. 이 시각은 해당 DB 행의 갱신 시각이며 전시장 최종화 완료 시각을 새로 추정하지 않는다. |
| 기존 실패 Run 재처리 | `web_service._finance_report`에서 과거 재처리 입력의 `finalize=True / finalize_dates=[]`를 저장된 partition 날짜로 복원했다. 요약 JSON의 임의 필드를 믿지 않고 저장된 Workflow 입력으로 원래 후처리 요구를 확인한다. |
| 회귀 사례 | 명부 commit 후 가격 실패·같은 날짜 재개, 반복 KONEX 재처리 실패 후 전체 후처리, 실제 PG의 순차 명부 반영, 랭킹 캐시·날짜 테스트를 추가했다. |

KONEX 10% 조건, 기존 다일 Workflow의 계속 처리 계약, 회사 합산·순위 계산 구현, 원시 가격의 조회 기준은 변경하지 않았다. 새 웹 상태 연동·webhook·Activity·DB 상태 시스템을 추가하지 않았다.

## 실제 DB와 화면 대조

11:37 KST 읽기 전용 재조회에서도 KOSPI·KOSDAQ raw price/marketcap 최신일은 2026-10-02, KONEX 원본과 종목 최신값·회사 시총·순위는 2025-09-22였다. 최종화 영수증/head는 0행이다. KONEX 활성은 116개, 유효 명부 기준일은 2025-09-22, 명부 영수증은 0개다.

메인과 기업 랭킹에 데이터가 표시되는 사실은 전체 최신 집계 완료와 구분된다. 현재 정상 회사 조회가 기존 캐시에 가려지지 않게 된 웹 복구를 확인했다.

| 화면 검증 | 확인 결과 |
| --- | --- |
| 기업 첫 페이지 | 20행, 전체 2,601개, 기준일 2025-09-22. 삼성전자 1위 회사 시총 548,715,276,575,800원(화면 549조원). |
| 종목 탭 | 20행, 기준일 2025-09-22. 삼성전자 보통주 1위 값 494,289,766,487,000원(화면 494조원). 기업→종목→기업 전환 성공. |
| 기업 다음 페이지 | `/marketcaps/2/`에서 100행, 첫 행 21위 알테오젠, 기준일 2025-09-22. 최초 컴파일/응답 과정에서 기다림이 있었고 완료된 화면으로 검증했다. |
| 모바일 | 390×844에서 기업/종목의 상위 목록과 기준일 확인. 기업 삼성전자 549조, 종목 삼성전자 494조. 검증 후 viewport 설정을 원래 크기로 복원했다. |
| CSV | 실제 브라우저 다운로드 `marketcap-top20-2025-09-22.csv`의 20개 기업명·순위·시총 전부가 직접 SELECT와 일치했다. 다운로드 이벤트 관측은 timeout이었으나 실제 파일 생성 시각과 내용을 확인해 통과 처리했다. |

직접 조회의 20개 회사·종목 값: [읽기 전용 조회 결과](ranking-direct-query-2026-10-05.json). 원시 가격은 일부 2026-10-02까지 있으므로 화면 가격 이력 날짜와 회사 시총/순위 기준일이 다를 수 있다. 가격 as-of 제한은 합의한 이번 범위에 추가하지 않았다.

## 핵심 테스트 결과

| 시나리오 | 결과 |
| --- | --- |
| 합성 116→107 직접 반영: 이탈 14개 | 동적 기준 12개를 넘어서 차단, 해당 명부 transaction 쓰기 0건. |
| 합성 중간 7개·다음 7개 이탈을 시간순 반영 | 성공. 종목 UUID·이력·동일 영수증 재시도 보존. 변화 0건인 거래일과 거래소별 watermark도 검증. |
| 명부 commit 후 가격 INSERT 실패 | 가격 rollback, 전진한 master head 유지. 실패 당일 재개에서 ID·영수증 보존. |
| 단일 날짜 실패와 재개 | 실제 fixture Activities로 다음 날짜 발행 0회 → 같은 날짜 재처리 → 다음 날짜 성공. 중간 finalize 0회. |
| 전체 실패 → KONEX 재실패 → 마지막 성공 | 공식 frozen-input reader 경로에서 최종화 요구 유지, 마지막 전체 후처리 정확히 1회, KOSPI·KOSDAQ 재수집 0회. History replay 통과. |
| 후처리 권한 보존/음성 사례 | 기존 Run 호환, 명시적 finalize=False·부분 선택·history 계약, 임의 요약 필드로 후처리 요구를 위조하지 못하는 사례 통과. |
| 웹 조회 실패·복구와 정상 0건 | 실제 조회 함수를 DB 경계 대역과 Next 15 실제 캐시 엔진으로 검증. 실패가 성공 빈 값으로 저장되지 않고 재시도 복구. |
| 정상/빈/오래된 캐시 갱신 | 개발 DB 재조회, 정상 빈 값 만료 후 갱신, 이전 namespace 분리, 재검증 실패 시 기존 정상 결과 유지와 후속 복구 통과. |
| 기준일·시각 | 더 최신 원시 가격이 회사 집계 기준일을 바꾸지 않음. 실제 updatedAt 표시, 누락·잘못된 값 N/A 통과. |

임시 PG는 `/private/tmp/cd-ranking-pg-rxsw3s4i/socket`, port 55439, DB `cd_ranking_synthetic_test`만 사용했다. TCP 연결은 비활성화했다. 테스트 schema 잔존 0개, public table 0개 확인 후 서버 종료. 기존 업무 DB/다른 PG 서버를 변경하지 않았다.

## 재현 명령과 증거

웹:

```sh
node --test tests/main-data-cache.test.cjs tests/dashboard-state.test.cjs tests/ranking-data.test.cjs
git diff --check
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
```

타입 오류는 `.next/types/validator.ts`의 sitemap params 계약 1개, bps/div/dps/eps/pbr/per metadata의 nullable 날짜 6개, `app/layout.tsx` 중복 속성 1개다. 해당 기존 영역은 이번 수정에서 변경하지 않았다.

Temporal 재현 명령은 다음 보고서에 기록했다.

- [재처리 153개 기록](/Users/craigchoi/tem/reports/cd-finance-reprocess-local-tests-2026-10-05.json)
- [별도 로컬 HTTP 1개](/Users/craigchoi/tem/reports/cd-ranking-finance-http-tests-2026-10-05.xml)
- [종목마스터·SQLite 112개](/Users/craigchoi/tem/reports/cd-ranking-security-catchup-local-tests-2026-10-05.xml)
- [격리 Temporal SDK 5개](/Users/craigchoi/tem/reports/cd-ranking-temporal-catchup-sdk-tests-2026-10-05.xml)
- [임시 PostgreSQL 32개](/Users/craigchoi/tem/reports/cd-ranking-catchup-postgres-tests-2026-10-05.xml)
- [PG 격리·정리 증거](/Users/craigchoi/tem/reports/cd-ranking-catchup-postgres-validation-2026-10-05.json)

## 아직 실행하지 않은 단계

실제 중간 거래일 KONEX 원본을 시간순으로 적용하고 14개 변화의 정확성을 검증하는 단계는 남아 있다. 합성 순차 성공은 실제 원본 정확성이나 14개 모두 정상 변화라는 증거가 아니다. 실제 운영 복구에서는 실패 당일 미완료 여부를 먼저 확인하고 하루 성공을 검증한 뒤 다음 날짜를 발행해야 한다.

목표일 전체 후처리와 독립 audit, 운영 캐시/정적 export 배포 확인은 실제 데이터 복구 이후 단계다. 현재 완료된 것은 랭킹 최소 수정, 로컬/격리 회귀와 기존 DB 기준 화면 복구 검증이다.
