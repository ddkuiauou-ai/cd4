# CD → tem 업무 데이터 저장 계약 v2

작성일: 2026-10-07, Asia/Seoul. 구현 기준: `db/schema-postgres.ts`와 `drizzle/0000` → `0001` → `0002_simplify_publication.sql`. **신규 DB용이며 기존 업무 데이터 이전 계약이 아니다.** v2는 값·컬럼·업무키를 유지하고 과한 공개 검증 함수/trigger를 제거한다.

## 적용 상태와 파일

- schema: `db/schema-postgres.ts`.
- 빈 DB 설치 순서: `drizzle/0000_postgresql_init.sql` → `drizzle/0001_business_result_contract.sql` → `drizzle/0002_simplify_publication.sql`.
- Drizzle meta: `drizzle/meta/0000_snapshot.json`, `0001_snapshot.json`, `0002_snapshot.json`, `_journal.json`.
- 신규 테이블은 `result_publication` **한 개**다. 기존 `security/company/security_rank`에 현재 공식 결과를 저장한다. 실행 기록, 과거 계산 묶음, 후보 결과 테이블은 만들지 않는다.
- 0001에 있던 사용자 정의 검증 함수 4개/trigger 8개는 0002에서 모두 제거한다. 세 publication FK의 deferred 설정은 유지하며 행 안의 종류/순위 key를 확인하는 CHECK 세 개를 추가한다. 이미 적용한 0000/0001을 수정하지 않는다. 설치는 전체 SQL 체인을 사용하며 schema push로 설치 이력을 대체하지 않는다.
- **수정 계획·구현·격리 검증·실제 DCD 반영 완료.** 대상은 `192.168.50.27:25433/dcd`, `silla`, PostgreSQL **18.6**이다. 0000/0001 설치 이후 **0002**를 후속 적용했고 재실행도 no-op으로 통과했다. 최종 catalog 확인 시각은 **2026-10-07 05:16:56 KST**다. PCD에는 접속하거나 적용하지 않았다.
- 실제 DCD의 **14개 테이블·286개 컬럼·71개 보조 index·12개 FK·168개 CHECK·6개 enum**, **CD 검증 함수 0개/사용자 trigger 0개**와 세 migration의 SQL hash를 확인했다. 모든 제약이 validated, 모든 index가 ready/valid이고 업무 테이블은 모두 0건이었다. 세 publication FK는 initially deferred를 유지한다. 컬럼/데이터를 이전하거나 시장 자료를 적재하지 않았다.
- 로컬 `.env`와 앱/설치 대상은 위 DCD로 일치했다. 이 구현 작업은 `.env`의 비밀값이나 DB 대상을 직접 변경하지 않았고 비밀번호를 출력/문서화하지 않았다. 앞선 [연결 진단](db-connection-diagnostic-2026-10-07.md)의 timeout은 연결 복구 전 기록이다. 별도 5432 서버를 대체 설치 대상으로 사용하지 않았다.
- 실제 DCD를 사용한 production 빌드와 개발/standalone 서버의 HTTP 검증 **26건**이 통과했다. `result_publication` 미설치로 발생한 홈 500은 해소됐다. 현재 빈 DB에는 공개 헤더가 없으므로 웹은 미공개로 표시한다. tem의 실제 원천/공식 결과 적재 통합은 다음 검증 단계다.
- 적용·HTTP 실측은 [v2 검증 기록](cd-business-schema-verification-2026-10-07.md#v2-단순화-후-최종-검증)과 [검증 결과 JSON](cd-dcd-verification-2026-10-07.json)에 보관한다.
- 웹/DTO: `lib/data/{publication,dto,security,company,security-ranking-detail,ranking-export}.ts`, `lib/csv/ranking.ts`, `lib/business-analysis.ts`, `lib/business-metadata.ts`, `components/business-*.tsx`, 관련 상세·순위·CSV routes. 검색과 sitemap은 안정적인 master ID로 연결한다. 검증 파일은 `scripts/test-postgres-migrations.cjs`, `tests/*.test.cjs`다.

## 소유권

CD는 schema·설치 SQL·저장 제약·DTO·웹 조회를 담당한다. tem은 원천 수집과 정제, 당시 종목 연결, 자료별 제공 대상/누락 판정, 재적재/정정, 최신값·마지막 제공값·회사 합산·순위의 계산/검증/공개를 담당한다. 원천 근거와 Workflow·시도·실패 이력도 tem 소유다.

CD가 화면에서 선택 기간의 평균·최소·최대·변화율·차트 집계를 계산할 수 있다. 이 화면 분석은 공식 최신값/회사 합계/공식 순위를 대신하지 않으며 DB 통계 컬럼을 추가하지 않는다.

**DB가 강제하는 것:** 원천 업무키·PK/UNIQUE/FK, 업무일/숫자/필수 근거, 필드 값과 상태, 마지막 제공값 triplet, 회사 완전성/순위 포함·제외 같은 한 행의 모순 방지. publication_key는 security/company에서 해당 결과 종류여야 하고, security_rank에서는 그 행의 scope/metric 조합과 같아야 한다.

**tem이 검증하는 것:** 원천 제공 대상·계산 정확성·입력 경쟁, 결과 묶음의 실제 건수/포함수·헤더/행 revision/계산 ID·기준일 일치, revision 증가·기준일 후퇴 방지·재시도 정책. 이 항목들은 DB trigger가 자동 강제하지 않는다. tem이 같은 key를 직렬화하고 한 트랜잭션의 최종 결과를 한 번 검증한 뒤 COMMIT한다.

## 날짜·숫자 공통 입력

- KRX 일별 업무 날짜는 유한 `timestamptz`, **Asia/Seoul 자정**이다. 예: 업무일 `2000-01-04` → `2000-01-04T00:00:00+09:00` = `2000-01-03T15:00:00Z`.
- 수집/체결 시각을 이 일별 date에 넣지 않는다. 서버/session timezone과 관계없이 offset을 명시한다. 토요일 거래를 막는 제약은 없다.
- `year/month`는 한국 업무일에서 추출한다. 비자정·무한대 날짜와 year/month 불일치는 거부한다.
- `created_at/updated_at/published_at`은 실제 시점의 `timestamptz`다. writer가 실제 변경 시 updated_at을 갱신한다. 미관련 pension/display_name/search_name의 기존 컬럼은 이번 변경 대상에서 제외했다.
- 원천 거래량·거래대금·시총·주식수, security 최신/마지막 시총·주식수, revision, rank id는 SQL `bigint`, Drizzle `bigint`다. API/JSON 입력·출력에서는 정확한 십진 문자열을 사용한다. JS `Number()`로 정수 원값을 읽거나 저장하지 않는다.
- 회사 합계와 순위 value는 SQL `numeric`, Drizzle 문자열이다. 회사 합계/marketcap 순위 값은 비음수 정수이며 큰 합계를 bigint 범위로 제한하지 않는다.
- 원천 OHLC와 여섯 지표, security 가격/여섯 지표는 유한 double precision이다. NaN/Infinity를 거부한다. 가격·수량·시총은 비음수, 여섯 지표의 실제 0/음수는 보존한다.
- 업무일 DTO는 한국의 `YYYY-MM-DD`, 공개시각은 UTC ISO다. UTC ISO 문자열 앞 10글자를 업무일로 사용하지 않는다.

## 원천 테이블

| 테이블 | 업무키 | 추가/변경 |
|---|---|---|
| price | UNIQUE(date, exchange, ticker) | exchange NOT NULL, nullable security_id, source_ref NOT NULL, 일별 timestamptz |
| marketcap | UNIQUE(date, exchange, ticker) | nullable security_id, source_ref NOT NULL, 일별 timestamptz |
| bppedd | UNIQUE(date, exchange, ticker) | nullable security_id, source_ref NOT NULL, 여섯 값 nullable + 여섯 필수 state |
| stockcodename | PK(date, ticker, exchange) | nullable security_id FK, source_ref NOT NULL, 일별 timestamptz |
| tmp_prices/tmp_marketcaps/tmp_bppedds | 기존 PK(date, ticker, exchange) | 같은 날짜/정확한 숫자/source_ref 규칙, tmp_bppedds의 여섯 값/state 규칙 |

SQL writer는 snake_case 컬럼명을 사용한다. Drizzle에서는 `security_id`→`securityId`, `source_ref`→`sourceRef`처럼 camelCase 속성명으로 입력한다. 원천 행의 필수 입력은 다음과 같다. `id`와 audit 시각은 INSERT 때 DB 기본값을 사용할 수 있다.

| 테이블 | 필수 데이터 입력 | 선택 입력 |
|---|---|---|
| price | date, exchange, ticker, source_ref, year/month; open/high/low/close 유한 double; volume 비음수 bigint | security_id/name/kor_name; transaction 비음수 bigint; fvolume/rate 유한 double |
| marketcap | date, exchange, ticker, source_ref, year/month; marketcap/volume/shares 비음수 bigint | security_id/name/kor_name; transaction 비음수 bigint |
| bppedd | date, exchange, ticker, source_ref, year/month; 여섯 *_state | security_id/name/kor_name; 여섯 숫자는 각 상태에 따라 NULL 또는 유한 double |
| stockcodename | date, exchange, ticker, source_ref | security_id, name |
| tmp_prices | date, exchange, ticker, source_ref; OHLC와 volume | transaction, rate |
| tmp_marketcaps | date, exchange, ticker, source_ref; close, marketcap/volume/shares | transaction |
| tmp_bppedds | date, exchange, ticker, source_ref; 여섯 *_state | 여섯 숫자는 상태에 따라 입력 |

tmp는 원천 단위·실행 이력을 저장하는 새 테이블이 아니다. 사용 여부는 tem이 결정하며 직접 본 테이블에 반영해도 된다. 연결할 master는 먼저 존재해야 한다. `security.security_id`는 안정적인 text PK이고 당시 `(exchange,ticker)`가 같다는 이유로 서로 다른 종목 생애를 같은 ID로 합치지 않는다.

시장·ticker·source_ref는 빈 문자열/공백을 허용하지 않는다. ticker는 문자열로 선행 0을 보존한다. security_id는 업무키에 포함하지 않는다. 미연결 원천도 중복 없이 저장하며, 연결은 해당 날짜 명부/상폐/코드 재사용의 확인된 근거로 tem이 결정한다. 현재 ticker 검색 결과에 과거 원천을 임의 연결하지 않는다.

`source_ref`는 tem이 보관하는 **불변 원천·판정 근거**의 opaque text 참조다. URL/UUID 등 표현은 tem이 정하되 동일 참조의 의미를 바꾸지 않는다. 원문 토큰, 당시 제공 대상, 필드별 미지원/누락 판단 이유, 실행 참조를 이 근거에서 찾을 수 있어야 한다. CD와 tem 운영 테이블 사이 물리 FK는 없다.

### 원천 지표 상태

`bps/per/pbr/eps/div/dps` 각각에 `*_state source_field_state NOT NULL`이 있다. 상태에 기본값은 없으며 writer가 매번 명시한다.

| state | 숫자 | 뜻 |
|---|---|---|
| provided | non-NULL | 원천 실제 숫자. 0·음수 포함 |
| source_missing | NULL | 원문 `-`·빈 값 |
| unsupported | NULL | 당시 시장/종목/시기의 미지원이 근거로 확인됨 |

값 non-NULL iff provided를 DB CHECK로 강제한다. PyKRX가 `-`/빈 값을 0으로 변환하기 **전에** 원문을 확인해야 한다. 지표 행 자체가 없는 날짜는 임의 bppedd 0/NULL행을 만들지 않는다. 수집 실패나 설명되지 않는 누락도 정상 unsupported로 저장하지 않는다.

예시:

```json
{
  "date": "2000-01-04T00:00:00+09:00", "exchange": "KOSPI", "ticker": "005930",
  "security_id": null, "year": 2000, "month": 1,
  "bps": null, "bps_state": "source_missing", "pbr": null, "pbr_state": "source_missing",
  "per": 0, "per_state": "provided", "eps": -10, "eps_state": "provided",
  "div": 0, "div_state": "provided", "dps": 0, "dps_state": "provided",
  "source_ref": "tem:source/immutable-object-id"
}
```

### 원천 UPSERT·부분 응답·정정

반영 단위는 자료 종류 × 시장 × 업무일이다. tem이 입력/제공 대상/정상 제외/누락을 검증한 뒤 동일 단위 writer를 직렬화하고 반영한다.

```sql
INSERT INTO bppedd (...) VALUES (...)
ON CONFLICT (date, exchange, ticker) DO UPDATE SET
  security_id = EXCLUDED.security_id,
  bps = EXCLUDED.bps, bps_state = EXCLUDED.bps_state,
  -- 나머지 다섯 값·상태·명칭도 같은 방식
  source_ref = EXCLUDED.source_ref,
  updated_at = now();
```

id와 created_at은 갱신하지 않는다. 확인된 provided→source_missing 정정은 NULL로 덮어쓴다. `COALESCE(new,old)`로 예전 숫자를 무조건 보존하지 않는다. 일부 필드의 정상 미제공은 다른 제공값을 보존하는 완성된 원천 행이다.

실패/설명되지 않은 부분 응답은 이전 정상 snapshot을 교체하지 않는다. 응답에서 종목이 빠졌다는 이유로 해당 날짜 전체를 삭제하지 않는다. 철회는 대상·사유·근거가 확인된 경우에만 명시적으로 수행한다. 오래된 실행/입력 경쟁의 fencing은 tem이 담당한다.

정상 전종목 가격 응답에서 전체 가격·거래값이 0이면 가격 적재를 생략하고 tem에 기록한다. 개별 종목의 0 OHLC/거래량과 유효 종가는 보존한다. 가격/명부/지표의 건수 일치를 요구하지 않으며 모든 시장/지표에 같은 시작일이나 주말 제외 규칙을 적용하지 않는다.

## security 현재 공식 결과

기존 nine metrics `price/shares/marketcap/bps/per/pbr/eps/div/dps`와 각 `*_date`를 최신 관측값·관측일로 유지한다. 각 metric에 아래 다섯 컬럼이 추가된다.

| 컬럼 | 타입/뜻 |
|---|---|
| *_state | result_field_state NOT NULL, 기본 no_observation |
| *_source_ref | 최신 값/결측 판정의 근거 text |
| *_last_provided | 해당 metric과 같은 숫자 타입, 마지막 실제 제공값 |
| *_last_provided_date | 일별 timestamptz |
| *_last_provided_source_ref | 마지막 실제 제공값의 근거 text |

상태는 `provided/source_missing/unsupported/row_missing/unexplained_missing/no_observation`다. source_missing은 필드 미제공, row_missing은 제공 대상과 근거로 확인된 해당 원천 행 미제공, unexplained_missing은 확인 대상인데 누락 원인을 설명하지 못한 상태다. 이 상태를 정상 수집 성공이나 source_missing으로 바꿔 읽지 않는다. 수집 실패는 별도 정상 상태를 만들지 않고 이전 공개값을 유지한다.

- provided: 최신 값·일자·근거가 필수. 마지막 제공 triplet도 필수이며 최신 triplet과 같아야 한다.
- 확인된 결측/미지원/행 누락: 최신 값 NULL, 확인 대상 업무일과 판정 근거 필수. 마지막 제공 triplet은 모두 NULL이거나 모두 존재하며 그 날짜는 최신 확인 날짜보다 앞선다.
- no_observation: 최신/마지막 값·일자·근거가 모두 NULL이다. 마지막 제공값이 있으면 no_observation으로 표현하지 않는다.
- 마지막 제공값에는 실제 0·음수 지표가 포함된다. 정정/철회된 값은 마지막 제공값에서도 재선정/제거한다.
- 최신 확인 날짜는 공개 기준일을 넘을 수 없다. 마지막 날짜는 위 관계로 그 날짜를 넘지 않는다.

공통 `publication_key text`, `result_revision bigint`, `calculation_id uuid`는 모두 NULL(미공개) 또는 모두 존재해야 한다. 미공개 security는 nine metrics 모두 no_observation이다. 처음에는 종목별 공식 최신값을 하나의 기준 범위로 저장한다. 같은 종목을 정책별로 중복 저장하는 결과 테이블은 이번에 없다.

## company 현재 공식 결과

기존 `marketcap/marketcap_date/marketcap_rank/marketcap_prior_rank`를 tem의 합계·기준일·현재/이전 순위로 사용한다. marketcap은 **numeric 문자열**이다.

추가 컬럼: `marketcap_completeness`, `ranking_state`, `exclusion_reason`, `result_source_ref`, `publication_key`, `result_revision`, `calculation_id`.

- 최초 미공개: 위 공식 값·날짜·순위·상태·근거·공통 식별자는 모두 NULL.
- 공개: 기준일과 근거가 필수. completeness=complete iff marketcap non-NULL.
- missing_input: 필요한 원천 자료 부족. insufficient_evidence: 연결/제공 대상 등 계산 근거 부족. 두 경우 합계는 NULL이며 근거를 남긴다. 불완전 부분 합계를 정상 회사 시총으로 저장하지 않는다.
- ranking_state=included: 완전한 합계와 양의 현재 순위 필수, exclusion_reason NULL.
- ranking_state=excluded: 현재 순위 NULL, 비어 있지 않은 제외 이유 필수. 완전한 합계가 있어도 tem 정책상 제외될 수 있다.
- 이전 순위는 NULL 또는 양의 정수다. 비교 가능한 이전 결과에서 tem이 결정한다.

company에도 하나의 기준 범위를 사용한다. 과거 회사 합계·구성비·부분 합계 저장 구조는 추가하지 않는다.

## security_rank 현재 공식 순위

키는 `UNIQUE(scope_key, metric_type, security_id)`다. 날짜별 이력을 쌓지 않고 범위·지표의 현재 결과를 교체한다. 동순위를 허용한다.

필수 공통: `scope_key text`, `metric_type metric_type`, `rank_date 일별 timestamptz`, `ranking_state`, `evidence_ref`, `publication_key`, `result_revision`, `calculation_id`.

- `value numeric NULL`은 정확한 문자열, `value_observed_at`은 해당 원천 업무일이다. 둘은 모두 NULL이거나 모두 존재한다. 관측일 ≤ rank_date.
- included: 값·관측일·양의 current_rank 필수, exclusion_reason NULL.
- excluded: current_rank NULL과 제외 이유 필수. 원천 숫자는 있어도 되고 없어도 된다.
- prior_rank는 NULL 또는 양의 정수. 같은 날짜 정정의 비교 정책과 날짜 전진의 비교 정책을 rule_ref에서 고정한다. 비교 가능성이 없으면 NULL이다.
- scope/metric/rank_date와 공통 결과 식별자가 공개 헤더와 정확히 일치해야 한다.
- 현재 상폐 여부나 음수/0을 이유로 CD가 tem의 공식 순위를 다시 제외하지 않는다.

## result_publication 현재 공개 헤더

이 테이블은 tem이 완료한 현재 결과의 작은 완료 기록이다. 숫자·결측·마지막 제공값 표시는 기존 업무 테이블로 수행한다. 정상 0건/미공개 구분과 현재 계산 ID·버전·근거 전달에 사용하며 Temporal 실행 상태·시도 이력·계산 후보는 담지 않는다. 원천 완전성이나 계산의 정확성을 이 테이블이 입증하지 않는다.

| 컬럼 | 타입/제약 |
|---|---|
| publication_key | text PK. 종류/범위[/순위 지표]의 표준 조합 |
| result_kind | security_latest / company_marketcap / security_rank |
| scope_key | 비어 있지 않은 text. 범위 정의/버전은 input_ref/rule_ref 근거에서 고정 |
| metric_type | 순위인 경우에만 필수, 다른 두 종류는 NULL |
| as_of | 유한 한국 자정 timestamptz |
| revision | 양의 bigint, 같은 key에서 증가 |
| calculation_id | tem이 만든 UUID. 여러 결과를 한 계산 묶음으로 공개할 때 공유 가능 |
| row_count | 0 이상 integer. security는 종목 수, company는 회사 수, rank는 포함/제외 전체 행수 |
| included_count | security_latest는 NULL, 회사/종목 순위는 0..row_count integer |
| input_ref/rule_ref | 비어 있지 않은 불변 입력/계산 규칙 근거 text |
| published_at | 유한 실제 공개시각 timestamptz |

key 예: `security_latest/krx-all`, `company_marketcap/krx-all`, `security_rank/krx-all/per`. key는 컬럼 조합과 같아야 한다. 헤더 없음은 미공개, row_count=0의 헤더는 정상 공개된 0건이다. 현재 진행/실패/후보 상태는 이 헤더에 넣지 않는다. CD는 마지막 공개 기준일을 표시한다.

**현재 웹에서 사용하는 기본 scope_key는 `krx-all`이다.** 종목 최신값은 `security_latest/krx-all`, 회사 합계는 `company_marketcap/krx-all`에 공개한다. 종목 순위는 `security_rank/<scope>/<metric>`이며 URL의 `scope`로 별도 범위를 조회할 수 있다. 웹 scope 문자열은 `[A-Za-z0-9._-]{1,80}`이고 기본은 `krx-all`이다. 다른 이름의 최신/회사 scope를 임의로 추가하면 현재 웹의 기본 조회 대상이 되지 않는다. 범위의 실제 대상과 정상 제외 이유는 input_ref/rule_ref에서 고정한다.

## 공식 결과 공개 트랜잭션

1. tem에서 입력 snapshot/범위/규칙/원천 참조를 고정해 계산하고 대상 coverage와 값/상태를 검증한다.
2. 동일 publication_key writer를 직렬화한다. 존재하는 헤더를 `FOR UPDATE`로 잠근다. 현재 헤더가 재시도 요청의 revision/calculation_id·불변 input_ref/rule_ref·as_of와 같으면 성공한 동일 계산의 재시도로 보고 기본 no-op 반환한다. 그 외에는 expected 이전 revision을 검사하고 불일치하면 덮어쓰지 않는다. 최초 공개는 행이 없으므로 key별 advisory lock 등 별도 직렬화가 필요하다. 원천 확인부터 COMMIT 사이의 입력 변경도 검출/직렬화한다.
3. 기존 revision보다 큰 revision과 현재 기준일보다 이른 날짜가 아닌 as_of를 선정한다. 같은 날짜 정정도 revision을 올린다. 과거 원천 정정이 최신 결과에 영향이 있으면 현재 공개 기준일에서 재계산한다.
4. 대상 master의 공식 결과, 해당 scope/metric 순위, 헤더의 값/건수를 **동일 트랜잭션**에 반영한다. 여러 종류를 한 묶음으로 공개할 때도 같은 트랜잭션에 넣는다. 행 안의 값/상태 CHECK를 만족하도록 관련 필드는 함께 갱신한다. 결과 revision과 값의 갱신 순서, 순위 DELETE/INSERT 방식은 한 트랜잭션의 최종 상태가 계약을 만족하면 된다. 헤더 FK는 deferred이므로 새 헤더와 결과행을 어느 순서로 써도 된다.
5. 결과에서 빠진 기존 대상의 공식 결과를 명시적으로 해제하거나 순위행을 삭제한다. master 식별정보는 남긴다. 삭제/해제는 함께 새 revision 헤더를 공개해야 한다. 전체 순위 교체는 계산/검증한 그 scope/metric에만 한정한다.
6. COMMIT 직전에 tem이 아래 최종 검증을 **key별 한 번** 수행한다. 실패하면 rollback한다. 값/상태/날짜/마지막 제공값/근거/헤더 일부만 공개하지 않는다.

같은 계산의 성공 재시도는 현재 헤더의 key/revision/calculation_id와 tem의 불변 입력/규칙을 확인해 no-op 처리하는 것이 기본이다. 완전히 같은 결과의 UPSERT나 순위 DELETE/INSERT 재반영도 한 트랜잭션에서 최종 검증하면 가능하다. 같은 revision의 의미를 바꾸는 정정은 금지하고 새 revision을 사용한다. **이 정책은 tem writer가 지키며 DB가 동일 revision의 변경·삭제나 revision/as_of 후퇴를 별도로 거부하지 않는다.**

tem의 최종 묶음 검증은 다음을 확인한다. 행마다 전체 COUNT를 반복하지 않는다.

- 해당 key의 실제 행수 = row_count. 회사/순위의 included 행수 = included_count.
- 해당 key에 남은 모든 결과행의 result_revision/calculation_id가 헤더와 일치. 이전 revision 행을 조용히 남겨 두지 않는다.
- 순위 scope/metric/rank_date와 헤더 scope/metric/as_of가 일치. 회사 marketcap_date = as_of. security의 아홉 최신 관측일은 모두 as_of 이하.
- expected 이전 revision과 입력 참조가 계산 때 확인한 내용과 같고, 새 revision은 증가하며 as_of는 후퇴하지 않음. 최초 공개도 key별 잠금 등으로 경쟁을 직렬화한다.

위 검증은 실제 KRX 제공 대상 판정/계산 검증 이후에 수행하는 저장 검증이다. 선언 건수와 저장 건수가 같아도 KRX 원천이 완전하거나 산식이 올바르다는 뜻은 아니다. 현재 헤더는 과거 실행 이력이나 오래된 재시도 전체를 판별하지 못하므로 tem이 운영 기록·입력 fencing을 관리한다.

종목 순위의 최종 검증 SQL 예시다. `$1=publication_key`, `$2=revision`(십진 bigint), `$3=calculation_id`(UUID), `$4=as_of`(offset 포함 timestamptz)를 바인딩한다. 반환 건수를 tem이 계산한 row_count/included_count와 비교하고 wrong_metadata가 false인지 확인한 뒤 COMMIT한다. 이 예시는 DB 함수 설치나 CD 계산 코드 추가를 요구하지 않는다.

```sql
SELECT count(*) AS actual_rows,
       count(*) FILTER (WHERE ranking_state = 'included') AS actual_included,
       COALESCE(bool_or(
         result_revision IS DISTINCT FROM $2::bigint
         OR calculation_id IS DISTINCT FROM $3::uuid
         OR rank_date IS DISTINCT FROM $4::timestamptz
       ), false) AS wrong_metadata
FROM security_rank
WHERE publication_key = $1;
```

scope/metric/key의 행 자체 조합은 DB CHECK가 확인한다. 회사와 security도 해당 key 범위를 한 번 검사하되 위 목록의 날짜 조건을 사용한다. 여러 key를 함께 공개할 때 잠금 순서를 일정하게 유지한다. `published_at`은 실제 공개 시각이며 성공 재시도의 no-op에서는 바꾸지 않는다.

예시 헤더:

```json
{
  "publication_key": "security_rank/krx-all/per", "result_kind": "security_rank",
  "scope_key": "krx-all", "metric_type": "per", "as_of": "2026-10-06T00:00:00+09:00",
  "revision": "2", "calculation_id": "89eab6bb-d1ca-43c9-967c-2010d1dab799",
  "row_count": 2, "included_count": 1,
  "input_ref": "tem:inputs/immutable-manifest-id", "rule_ref": "tem:rules/ranking-v1",
  "published_at": "2026-10-06T09:10:00Z"
}
```

예시 순위 2행은 같은 식별자로 공개한다. 포함행 value="0", current_rank=1도 tem 정책에 따라 저장 가능하다. 제외행 value=NULL/value_observed_at=NULL/current_rank=NULL, exclusion_reason="원천 행 미제공"처럼 설명과 evidence_ref를 남긴다. 실제 대상 목록은 tem의 scope/근거를 따른다.

## CD 조회 계약

헤더·결과·count는 단일 SQL 또는 요청 내 REPEATABLE READ 트랜잭션으로 읽는다. 결과행의 publication_key/result_revision/calculation_id가 현재 헤더와 일치하는 경우만 공개한다. 페이지 이동에 이전 revision이 오면 갱신 안내를 하며 다른 revision 데이터를 조용히 합치지 않는다.

종목 순위 목록·상세·CSV는 key/revision/calculation_id/scope/metric뿐 아니라 rank_date = 헤더 as_of도 조회 조건으로 확인한다. CSV는 읽힌 included 행수와 헤더 included_count가 다르면 오류를 반환한다. 이는 tem의 최종 검증을 대체하지 않는다.

최신 NULL을 마지막 제공값으로 덮어 표시하지 않는다. 제공 상태·업무일과 마지막 제공값·업무일을 별도로 보인다. 회사 불완전 결과는 정상 0/합계로 표시하지 않는다. DB 장애와 미공개/정상 0건을 구분한다.

원천 이력은 현재 정정본이고 공식 결과는 마지막 공개본이다. 원천 반영과 공식 재계산이 별도 트랜잭션이면 두 자료의 입력 시점이 다를 수 있다. 공개 기준일·근거·revision을 표시하며 같은 입력 snapshot에서 계산했다고 임의 설명하지 않는다. 이를 막기 위한 원천 전체 버전 복제는 추가하지 않는다.

bigint/numeric/revision은 API와 JSON에서 문자열을 유지한다. raw double은 finite number 또는 NULL이다. 기간 평균/최소/최대는 제공 관측을 쓰고 NULL을 표본에서 제외하되 실제 0/음수는 포함한다. 변화율은 분모 0 이하나 자료 부족이면 계산 불가로 표시한다. 차트 표시용 단위 축소만 number로 변환할 수 있다.

### 실제 웹 소비와 tem이 맞출 부분

- 종목 상세는 최신 값·상태·관측일과 마지막 제공값·제공일을 별도 열로 표시한다. 미공개 master의 공식 숫자는 숨기고 확보된 원천 이력은 별도로 조회한다. `security_id=NULL`인 원천은 저장되지만 종목 상세 이력에는 연결 확인 전까지 포함하지 않는다.
- 회사 상세·회사 순위는 company의 공식 합계만 사용한다. 구성 종목을 다시 더하거나 현재 상폐 여부로 순위를 다시 제외하지 않는다. 부족한 합산은 `—`와 부족 상태/제외 이유로 표시한다.
- 종목 순위는 tem의 current/prior rank와 포함 판정을 사용한다. 종목 최신 결과와 순위 결과는 서로 다른 공개 종류이므로 각 기준일/범위/버전을 표시한다.
- 선택 기간 원천 이력과 평균/최소/최대/절대 변화/변화율은 요청 때 계산한다. 기간은 양끝을 포함하고, NULL 지표는 차트 선을 끊는다. 날짜당 단일 관측은 점으로 표시한다. 통계 컬럼·회사 과거 합계/구성비 테이블은 없다.
- 상세 URL과 sitemap/search는 안정적인 security/company ID를 사용한다. 이름이나 시장+ticker alias는 단일 master로 확인될 때만 연결한다. 코드 재사용으로 모호하면 404 화면이다. 종목 유형이 아직 NULL/미분류여도 검색의 기타 종목에서 이동할 수 있다.
- CSV는 한 RR snapshot에서 정확한 값·기준일·범위·revision·calculation_id를 읽는다. 공개 0건은 헤더만 있는 200 응답, 미공개는 404, 이전 revision은 409다. 화면도 이전 revision을 섞지 않고 다시 조회하도록 안내한다.
- 공식 값 화면과 CSV는 요청 시 서버 조회다. 검색 명부 JSON만 5분 재검증을 사용하며 운영 DB 장애는 성공한 빈 결과로 바꾸지 않는다. 정적 export의 자동 배포는 이번 검증 범위가 아니다.

## 검증 기록과 제한

- `0002_simplify_publication` 생성·snapshot/journal 반영과 `pnpm db:check` 통과. 0000/0001 SQL과 snapshot은 변경하지 않았다.
- 격리 PostgreSQL **18.6** + Node **22.23.3**: **1 pass / 0 fail / 0 skip**. 빈 DB의 0000 → 0001 → 0002 설치·재실행, 세 migration hash와 최신 0002 catalog **14 tables / 286 columns / 71 indexes / 12 FKs / 168 CHECKs**, CD 검증 함수/사용자 trigger 0을 대조했다.
- DB 보장: 업무키/미연결 중복/시장 구분/UPSERT id·created_at 보존, 한국 자정·세션 3개 시간대·토요일, 실제 0·음수·결측과 값/상태 모순, 근거/FK/종류·scope·metric CHECK, 날짜별 코드 재사용, 최신/마지막 제공값 및 회사 완전성, 실제 ORM bigint/numeric→DTO→JSON 정확값이 통과했다.
- **테스트 전용 writer**로 key 잠금/expected revision 경쟁/최종 범위별 검증·rollback을 확인했다. 잘못된 건수·포함수·계산 ID·날짜·후퇴·동일 revision의 다른 결과는 이 fixture writer가 거부한다. DB 단독 거부로 기록하지 않는다. 최초 공개 경쟁, 분리된 UPDATE 순서, 동일 결과 DELETE/INSERT 재시도, 원자 교체 중 REPEATABLE READ도 확인했다. 실제 tem 구현을 검증한 결과는 아니다.
- 실제 production `currentRankResultFilter/currentRankFilter`를 격리 PG의 ORM 조회에 사용해 같은 revision이어도 기준일이 다른 순위행을 읽지 않는 것을 확인했다.
- 전체 `pnpm test`: **130 pass / 0 fail / 0 skip** 재실행. TypeScript·migration chain·이번 변경 파일 ESLint 통과. 기존 최근 종목 sidebar 경고 등 UI의 기존 제한은 별도 검증 기록을 따른다. 이번 재검토에서는 UI를 수정하지 않았다.
- 실제 DCD에서 0002 적용·재실행 no-op·catalog·세 migration hash 검증 통과. 모든 제약 validated/모든 index valid·ready, 세 publication FK는 initially deferred다. 업무 테이블 14개는 모두 0건이며 PCD 접속/적용은 없다. CHECK 전체 식의 독립적 의미 정규화 비교는 하지 않았고 이름/validated/hash와 신규 세 식을 확인했다.
- 실제 DCD로 최종 **Next.js 16.3.8 Turbopack standalone 빌드 통과**. 개발 서버(3001)와 production standalone(3107)의 **HTTP 26건** 재검증 통과: 각각 순위 HTML 10개 200/미공개, CSV 두 개 404/미공개, 검색 JSON 200/빈 배열. 시장 데이터가 있는 화면 통합 검증과 구분한다.
- 기존 합성 fixture의 HTML 28개/CSV 4개와 데스크톱/375px 모바일 검증은 최초 구현 때 수행한 기록이다. 이번 v2에서는 UI를 바꾸지 않았고 실제 브라우저 전체 조합/성능 측정을 반복하지 않았다. 제거한 O(N²) COUNT trigger의 예전 성능 수치는 v2 성능 수치로 사용하지 않는다.
- 실제 tem 원천 적재, PyKRX 이전 원문 구분, 당시 종목 연결, 입력 fencing/공식 계산, 실제 데이터 웹·CSV 대조는 **미검증**이다. tem 구현/적재 후 통합 확인한다. DB 제약과 테스트 fixture가 이를 대신하지 않는다.
- 과거 공식 revision 보관, 운영 배포/정적 export, 회사 과거 합계/구성비, 크립토/분봉/period는 범위 밖이다. Next 동적 notFound의 스트리밍 HTTP 상태와 CSV 404/409의 차이는 기존 검증 기록을 따른다.
- 검증용 standalone 서버는 종료하고 개발 서버 3001은 유지한다. 초기 검색 JSON은 빈 DCD 명부이며 5분 재검증 대상이다. 상대 채팅에 직접 메시지를 보내지 않고 사용자가 이 문서를 전달한다.

## tem에 전달할 요약

CD의 수정 계획·스키마/조회 구현·실제 DCD 반영을 완료했습니다. 최종 저장 계약은 이 **v2** 문서입니다. `192.168.50.27:25433/dcd`(silla, PostgreSQL 18.6)에 0000 → 0001 → 0002가 적용돼 있으며 시장 자료는 아직 없습니다.

신규 테이블은 작은 현재 완료 기록 `result_publication` 한 개입니다. 실제 결과는 기존 `security/company/security_rank`에 기록합니다. 원천 업무키 `(date, exchange, ticker)`, nullable security_id 연결, 한국 자정 timestamptz, 실제 0/음수와 NULL+필드 상태, source_ref, 정확한 bigint/numeric 문자열 계약은 유지했습니다.

과한 CD 공개 검증 함수 4개/trigger 8개는 제거했습니다. DB는 업무키·FK·행 자체 값/상태/날짜 CHECK를 담당합니다. tem은 원천 판단과 공식 계산을 마친 뒤 같은 공개 key를 직렬화하고 expected revision/입력 유효성을 확인해 결과와 헤더를 한 트랜잭션에 기록해 주세요. COMMIT 전 key별 최종 건수·포함수·revision/계산 ID·기준일을 한 번 검증하고 실패하면 rollback합니다. 정정은 새 revision, 성공한 동일 계산 재시도는 현재 헤더를 확인해 기본 no-op으로 처리합니다.

기본 key는 `security_latest/krx-all`, `company_marketcap/krx-all`, `security_rank/krx-all/<metric>`입니다. 정상 순위 0건에도 완료 헤더와 included_count=0을 기록합니다(row_count는 포함/제외 전체 실제 행수). 최초 미공개에는 헤더가 없으며, 이후 계산 중/실패는 이전 완료 헤더를 유지합니다. CD는 완료된 결과를 읽어 상태/기준일을 표시하고 선택 기간의 간단한 분석을 계산합니다. 필수 컬럼·타입·입력 JSON·정정/예외 규칙은 위 표와 예시를 따라 주세요.

CD 검증은 통과했으며 이제 이 계약으로 tem 수집·저장·계산 writer를 구현할 수 있습니다. 실제 tem 자료가 적재되면 값·상태·날짜·revision과 CD 화면/CSV를 함께 대조합니다. 실제 tem writer와 KRX 원천 판단의 검증 완료를 뜻하지는 않습니다.
