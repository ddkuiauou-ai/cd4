# CD 업무 스키마·웹 변경 계획 — 최소 변경안

작성일: 2026-10-07, Asia/Seoul. 상태: **과한 공개 검증 제거·재검증·실제 DCD 0002 반영 완료. 실제 tem 적재·계산 통합은 미검증**.

이 문서는 앞선 신규 테이블 네 개 안을 대체한 승인 계획이다. 기존 업무 테이블 보완과 **신규 공개 메타데이터 테이블 한 개**를 구현했다. 신규 빈 DCD에 설치하고 실제 연결 빌드·빈 상태 웹 응답을 확인했다. 최종 코드·입력 규칙·검증·DB 적용 여부는 [CD → tem 저장 계약 v2](cd-business-schema-contract-2026-10-07.md)을 기준으로 읽는다. 실제 tem 원천 적재·공식 계산 결과의 통합은 아직 미검증이다.

## 1. 목적과 책임

신규 빈 PostgreSQL 18 DB에 KRX 자료를 적재하고, 원천 이력과 tem이 계산한 공식 결과를 CD가 정확히 표시한다.

| 담당 | 책임 |
|---|---|
| CD | 업무 schema·빈 DB 설치 SQL·키/타입/상태 제약·입력 계약·DTO·웹 조회/표시 |
| tem | 원천 수집·정제·당시 종목 연결·제공 대상/누락 판정·재적재/정정 |
| tem | 공식 최신값·마지막 제공값·회사 합산·순위/제외의 계산·검증·DB 반영 |
| tem | Workflow·스케줄·시도/실패 이력·원천 근거 보관·운영 화면 |
| CD | 선택 기간 평균·최소·최대·변화율·차트 집계 등 화면 분석. 통계용 DB 필드는 추가하지 않음 |

기존 데이터 이전, 기존 화면·차트·구성비 보존, 회사 과거 합산 기능, 수정주가·전체 재무제표·크립토·분봉·period 도입은 이번 요구가 아니다. 기본 적용 대상은 `192.168.50.27:25433`의 신규 `dcd`, 계정 `silla`다. `pcd`는 적용하지 않는다.

## 2. 앞선 계획에서 줄이는 부분

### 이번 재검토에서 추가로 줄이는 부분

`result_publication`은 정상 0건/미공개 구분과 현재 계산 ID·버전·기준일을 전달하는 작은 완료 기록으로 유지한다. 값·결측·마지막 제공값 표시 자체에 필요한 테이블이나 Temporal 실행 관리 테이블로 설명하지 않는다.

행마다 같은 결과 범위를 COUNT하는 deferred trigger, 동일 revision의 JSON 비교, DB 함수로 수행하는 revision/기준일 후퇴·삭제 제한을 제거한다. **기존 사용자 정의 함수 4개와 trigger 8개를 모두 제거**하며 새로운 검증 함수·관리 테이블을 대체로 만들지 않는다. DB는 PK/UNIQUE/FK와 행 안의 날짜·숫자·값/상태 CHECK를 유지한다. 헤더 연결은 종류 및 순위 범위/지표를 확인하는 단순 CHECK 세 개로 보완한다.

tem은 동일 공개 key를 직렬화하고 expected revision과 입력 유효성을 확인한 뒤, 결과·헤더를 한 트랜잭션으로 쓴다. COMMIT 전에 범위별 실제 건수·포함수·revision/계산 ID·업무일을 **한 번 검증**한다. 이 묶음 검증·재시도·정정 규칙은 tem writer 책임이며 DB trigger가 대신 강제하지 않는다. CD의 요청 내 REPEATABLE READ 조회와 이전 revision 안내는 유지한다.

이미 실제 DCD에 설치한 0001과 hash는 보존한다. 후속 **0002_simplify_publication**에서 단순 CHECK 추가와 trigger/function 제거를 반영한다. 빈 DB도 0000 → 0001 → 0002를 설치한다. 컬럼·데이터 이전이나 테이블 교체는 하지 않는다.

| 앞선 신규 테이블 | 재검토 결론 |
|---|---|
| `security_metric_result` | 추가하지 않음. 기존 security의 최신값·날짜 컬럼을 보완 |
| `company_marketcap_result` | 추가하지 않음. 기존 company의 합산값·날짜·순위 컬럼을 보완 |
| `calculation_batch` | 독립 테이블로 만들지 않음. 현재 공개 결과의 최소 메타데이터만 저장 |
| `result_publication` | 작은 현재 공개 메타데이터 테이블 한 개로 축소 |

앞선 계획이 추가했던 모든 계산 버전의 불변 보존, draft/validated 상태 관리, 후보 포인터, 과거 버전의 페이지·다운로드 고정은 제외한다. 실행/검증 과정은 tem에서 관리하고 CD 업무 DB에는 확정된 현재 결과를 반영한다.

`security/company`의 파생값 컬럼 제거 제안도 철회한다. 이 컬럼이 tem이 쓴 현재 공식값의 저장소이며, 별도 결과 테이블에 중복 저장하지 않는다. 줄이는 이유는 요구에 없는 버전 관리 구조를 피하고 현재 컬럼을 직접 활용하기 위해서다.

## 3. 최종 테이블 구성 제안

| 테이블 | 최소 변경 |
|---|---|
| `price/marketcap/bppedd` | timestamptz·시장 필수·업무키 UNIQUE·nullable security_id·source_ref |
| `stockcodename` | 날짜별 명부 키 유지, nullable security_id와 source_ref 추가 |
| `security` | 기존 최신값/날짜 유지, 지표 상태·마지막 제공값/날짜/근거·결과 식별자 보완 |
| `company` | 기존 시총/날짜/순위 유지, 완전성·제외/근거·결과 식별자 보완 |
| `security_rank` | 현재 공식 순위 저장, 대상 범위·결과 식별자·포함/제외/근거 보완 |
| `result_publication` **신규 1개** | 종류/범위/지표별 현재 공개 결과의 기준일·revision·계산 ID·건수·공개시각 |
| `tmp_*` | 유지. 실제 사용하는 경우 원천 타입/결측/근거 계약에 맞춤 |

`pension`, 회사 설명·검색명·표시명 등 관계없는 업무는 변경하지 않는다. 현재 master/index를 무조건 삭제하거나 조회 성능 구조를 전면 교체하지 않는다.

## 4. 원천 데이터 계약 — 기존 합의 유지

### 4.1 날짜·업무키·숫자

- 일별 date는 `timestamptz`; 한국 업무일 자정의 대표 시점이다. 실제 체결/수집 시각으로 설명하지 않는다.
- 입력 업무일은 `YYYY-MM-DD`, timestamp 입력에는 offset을 명시한다. 예: `2000-01-04T00:00:00+09:00`.
- 유한 날짜·Asia/Seoul 자정 CHECK로 같은 업무일의 시간 차이를 막는다. 역사적 토요일 거래를 허용한다. period/분봉 도입은 나중에 별도 계약으로 검토한다.
- `price/marketcap/bppedd`는 `UNIQUE(date, exchange, ticker)`. 시장은 NOT NULL/빈 문자열 금지, ticker는 앞자리 0을 보존하는 문자열이다. security_id를 업무키에 넣지 않는다.
- 명부/tmp의 기존 복합 키도 같은 일별 timestamp 계약을 따른다. year/month는 한국 업무일과 일치시킨다.
- 원천 거래량·거래대금·주식수·시총은 bigint를 유지하고 Drizzle bigint 모드로 읽는다. DTO는 십진 문자열이다.
- 원천 OHLC·여섯 지표의 double precision은 유지하고 유한성·필드별 제약을 적용한다. 지표의 0/음수를 일괄 거부하지 않는다.
- created_at/updated_at/공개시각은 실제 시점의 timestamptz이며 업무일 자정 CHECK 대상이 아니다. writer가 updated_at 갱신 책임을 가진다.

### 4.2 결측·원천 참조·당시 연결

`price/marketcap/bppedd/stockcodename`에는 비어 있지 않은 `source_ref text NOT NULL`을 둔다. tem이 보관하는 불변 원천/판정 근거의 참조다. tem 운영 테이블과 물리 FK를 만들지 않는다.

bppedd 여섯 값은 nullable로 하고 각 필드에 `*_state`를 둔다.

| 의미 | 값 | 상태 |
|---|---|---|
| 실제 숫자 0·양수·음수 | 원천 숫자 | provided |
| 원문 `-`·빈 값 | NULL | source_missing |
| 근거로 확인된 미지원 | NULL | unsupported |

상태는 필수이며 `provided iff 값 non-NULL`을 NULL에 안전한 CHECK로 검사한다. 원문 구분은 PyKRX가 미제공을 0으로 바꾸기 전에 tem이 수행한다. 없는 원천 지표 행을 인위적인 0/NULL 행으로 만들지 않는다.

명부의 security_id는 nullable FK로 추가한다. 이력은 tem이 당시 명부/근거로 확인한 연결을 따른다. 미연결도 업무키/source_ref로 보존하며 현재 활성 ticker에 임의 연결하지 않는다. 코드 재사용은 날짜별로 다른 security_id에 연결한다.

### 4.3 재적재·정정

반영 단위는 자료 종류 × 시장 × 날짜다. tem이 제공 대상/정상 제외/누락 근거를 확인한 자료만 트랜잭션으로 반영한다.

- 같은 날짜/겹치는 기간 재적용은 중복을 만들지 않고 id/created_at을 보존한다.
- 부분 응답·실패는 기존 정상 업무 snapshot을 교체하지 않는다. 원문에서 정상적으로 미제공인 일부 필드는 실패와 구분하고 다른 제공값을 보존한다.
- 확인된 숫자→미제공 정정은 NULL로 바꿀 수 있다. COALESCE로 예전 값을 무조건 유지하지 않는다.
- 철회/삭제는 대상·사유·근거가 확인된 경우만 허용한다. 응답에서 빠졌다는 이유로 날짜 전체를 삭제하지 않는다.
- 동일 단위 동시 쓰기와 오래된 실행의 반영 방지는 tem이 직렬화/fencing으로 처리한다.
- 정상 전종목 가격 응답의 전체 가격/거래값 0은 가격 적재를 생략하고 tem에 기록한다. 개별 종목의 0 OHLC/거래량과 유효 종가는 보존한다.

자료별 제공 대상이 다르므로 가격·지표·명부의 동일 건수를 요구하지 않는다. 모든 시장·지표에 같은 시작일이나 주말 제외 규칙을 적용하지 않는다.

## 5. 공식 결과의 컬럼 보완

### 5.1 security

기존 `price/shares/marketcap/bps/per/pbr/eps/div/dps`와 각 `*_date`를 최신 관측값·관측일로 사용한다. 지표별 다음 정보를 추가한다.

- `*_state`: provided, source_missing, unsupported, row_missing, unexplained_missing, no_observation.
- `*_source_ref`: 해당 관측값/판정의 근거.
- `*_last_provided`, `*_last_provided_date`, `*_last_provided_source_ref`: tem이 선정한 마지막 실제 제공값·날짜·근거.
- 공통 `publication_key`, `result_revision`, `calculation_id`: 현재 공식 결과의 식별자. 최초 미공개이면 모두 NULL.

최신과 마지막 제공 값은 각각 기존 지표의 숫자 타입을 따른다. shares/marketcap은 정확한 bigint이며 다른 지표는 유한 double precision이다. 마지막 제공값에는 실제 0/음수 지표도 포함한다. 컬럼 보완은 이 요구의 저장 비용이며, 컬럼 수를 감추기 위해 generic JSON 저장소로 바꾸지는 않는다.

provided이면 최신/마지막 제공값·날짜·근거가 같아야 한다. 최신이 확인된 결측이면 마지막 제공값은 더 과거 값이거나 모두 NULL이다. no_observation이면 최신/마지막 값·날짜·참조가 모두 NULL이다. 철회된 숫자를 마지막 제공값으로 남기지 않는다.

첫 구현에서 종목별 공식 최신값은 **하나의 기준 범위**로 저장한다. KOSPI/KOSDAQ 조회는 그 결과에서 종목을 조회하는 것이며 다른 계산 정책의 최신값을 중복 보관하지 않는다. 별도 범위별 순위는 security_rank에서 표현한다. 같은 종목의 서로 다른 정책별 최신값을 동시에 저장해야 하는 요구가 생기면 그때 분리 결과 테이블을 검토한다.

### 5.2 company

기존 marketcap/marketcap_date/marketcap_rank/marketcap_prior_rank를 tem 공식 결과로 유지한다.

- `marketcap_completeness`: complete, missing_input, insufficient_evidence.
- `ranking_state`: included/excluded. 포함이면 양의 marketcap_rank, 제외이면 marketcap_rank NULL과 비어 있지 않은 `exclusion_reason`을 저장.
- `result_source_ref`: 합산/완전성/순위의 근거.
- `publication_key`, `result_revision`, `calculation_id`: 공개 결과 식별자.

회사 합계는 `numeric`으로 정확한 비음수 정수를 저장하고 DTO에는 십진 문자열로 전달한다. complete iff 총액 non-NULL; 필요한 자료나 연결 근거가 부족하면 총액은 NULL이다. 포함 순위와 이전 순위는 tem 정책을 따르며 CD가 재산출하지 않는다. 회사별 결과도 한 기준 범위를 사용한다.

### 5.3 security_rank

현재 공개 순위만 보관하는 최소안이다. 키는 `UNIQUE(scope_key, metric_type, security_id)`; rank_date는 timestamptz 업무일로 유지한다.

`value numeric NULL`, `value_observed_at`, current_rank/prior_rank, included/excluded 상태, exclusion_reason, evidence_ref, publication_key/result_revision/calculation_id를 저장한다. included는 값·관측일·양의 현재 순위가 필요하고 excluded는 현재 순위 NULL과 제외 근거가 필요하다. 동순위는 허용한다.

순위행의 scope_key/metric_type/rank_date는 해당 공개 헤더의 scope_key/metric_type/as_of와 일치해야 한다. 값의 관측일은 그 기준일 이후일 수 없다. 이전 순위는 tem이 비교 가능한 이전 공개 결과에서 선정해 기록한다. 같은 날짜 정정과 날짜 전진 시 비교 정책은 tem의 rule_ref에 명시하며, 비교 기준이 없거나 범위/규칙이 달라지면 prior_rank는 NULL이다. 과거 순위 revision 전체를 CD에 보존하는 구조는 만들지 않는다.

### 5.4 신규 result_publication — 현재 공개 메타데이터만

| 필수 정보 | 의미 |
|---|---|
| publication_key PK | 결과 종류·대상 범위·순위 지표의 표준 조합 |
| result_kind, scope_key, metric_type | 종목 최신값/회사 합계/종목 순위 구분. metric은 순위에만 존재 |
| as_of | 계산 목표/기준 업무일 timestamptz |
| revision, calculation_id | 양의 bigint revision과 tem 계산 묶음 UUID |
| row_count, included_count | 대상 결과 행수; 순위 포함 수는 회사/종목 순위에만 사용 |
| input_ref, rule_ref | tem이 보관하는 계산 입력과 규칙의 불변 근거 |
| published_at | 실제 공개시각. 저장된 헤더는 공개 완료 결과만 의미 |

publication_key 예시는 `security_latest/krx-all`, `company_marketcap/krx-all`, `security_rank/krx-all/per`다. 종류/범위/지표 조합의 중복과 모순을 막는다. scope의 정의/버전과 입력별 제공 대상은 참조 근거에서 고정한다.

revision은 같은 publication_key 안에서 증가하며 현재 공개 기준일은 후퇴하지 않는다. 같은 기준일 정정은 revision 증가로 반영한다. 과거 원천 정정은 현재 기준일의 공식 결과에 미치는 영향을 재계산해 반영한다. 같은 calculation_id/revision의 성공한 공개를 재시도하면 같은 결과로 멱등 처리한다. security 최신값의 row_count는 지표 셀 수가 아닌 대상 종목 수, 회사 결과는 대상 회사 수, 종목 순위는 포함/제외 대상 행수다.

헤더가 없으면 미공개다. 순위 0건도 헤더와 건수 0을 저장하므로 정상 완료와 미계산을 구분할 수 있다. 이것이 신규 테이블 한 개를 남기는 이유다. 기존 master나 순위 테이블에 가짜 종목/회사를 넣어 헤더 역할을 만들지 않는다.

draft/validated/failed/candidate 상태와 과거 묶음 포인터는 저장하지 않는다. 헤더가 있다고 현재 시점의 모든 수집이 성공했다는 의미는 아니다. CD는 마지막 공개 기준일을 표시하고 실제 진행/실패 상태는 tem에서 관리한다.

## 6. 반영·조회 일관성 — tem writer 책임

1. tem이 입력 snapshot과 규칙을 고정해 결과를 계산·검증한다. 이 과정과 실패 기록은 tem 책임이다.
2. 공개 직전 같은 publication_key의 writer를 직렬화하고 expected 기존 revision 및 입력 유효성을 확인한다. 원천 확인부터 COMMIT 사이의 변경 경쟁도 검출/직렬화한다.
3. 대상 security/company 컬럼, 해당 범위의 순위행, 공개 헤더를 **한 트랜잭션**에서 교체한다. 여러 결과를 한 묶음으로 공개할 경우 같은 트랜잭션에 포함한다.
4. 오류/부분 결과이면 rollback하고 이전 정상 공개값과 헤더를 유지한다. 확인된 결측/철회는 값·상태·마지막 제공값까지 함께 정정한다.
5. 순위의 전체 교체는 계산/검증이 끝난 결과에 대해서만 해당 범위·지표를 대상으로 수행한다. raw 응답 누락을 이유로 원천 이력을 지우는 규칙과 혼동하지 않는다.

대상 결과의 기대 coverage를 tem이 검증하고 실제 행수/포함수와 헤더를 맞춘다. 이전 대상에서 제외된 결과는 명시적으로 지우거나 공개 대상에서 해제한다. master 식별정보는 삭제하지 않는다. 결과행은 publication_key/revision/calculation_id가 헤더와 일치하는 경우에만 현재 공개 결과로 읽는다.

tem이 COMMIT 직전 범위별로 한 번 확인할 항목은 실제 행수/포함수와 선언 건수의 일치, 전 결과행의 key/revision/calculation_id 일치, 순위의 범위/지표/업무일 및 최신 관측일의 기준일 상한이다. 틀리면 rollback한다. DB는 이 결과 묶음의 정합성이나 revision 단조 증가를 자동 강제하지 않는다. 같은 계산의 성공 재시도는 현재 헤더를 확인해 no-op 처리하고, 같은 입력에 다른 결과를 쓰는 정정은 새 revision을 사용한다. 순위 교체의 DELETE/INSERT와 결과 컬럼 UPDATE 순서는 한 트랜잭션의 최종 상태가 계약을 만족하면 된다.

CD는 헤더·결과·count를 단일 SQL 또는 요청 내 REPEATABLE READ 읽기 트랜잭션으로 조회한다. 일반 READ COMMITTED에서 여러 SELECT를 수행하는 것만으로 동일 공개 결과가 보장된다고 가정하지 않는다.

현재 snapshot은 새 결과로 덮어쓴다. 과거 revision을 DB에서 다시 조회하거나 페이지 이동/나중 다운로드까지 과거 버전을 유지하는 기능은 제공하지 않는다. 요청에 이전 revision이 오면 최신 결과로 갱신/재시도를 안내하고 서로 다른 결과를 조용히 섞지 않는다.

최초 구현은 공식 결과와 원천의 장기 데이터 캐시를 추가하지 않는다. 요청 단위 조회 재사용과 범위 제한을 사용한다. 추후 캐시가 필요하면 현재 헤더 확인과 완성 DTO의 revision을 함께 다룬다. 과거 revision으로 mutable 현재 행을 읽어 과거 캐시를 생성하지 않는다.

## 7. 웹·DTO 범위

| 화면 | 1차 표시 |
|---|---|
| 종목 상세 | 식별정보, 공식 최신값/날짜/상태, 마지막 제공값/날짜, 원천 이력과 간단한 기간 분석 |
| 회사 상세 | 공식 시총/날짜/완전성/순위 |
| 순위 목록 | 공개 결과의 지표·범위·날짜·값·순위·페이지 |
| 공통 상태 | 미공개, 정상 0건, 미제공/미지원/근거 부족, 조회 장애 |

최신 NULL을 마지막 제공값으로 자동 대체하지 않는다. 마지막 제공값은 별도로 표시한다. 현재 상폐 여부나 값의 부호를 이유로 tem의 공식 순위를 재제외하지 않는다. DB 장애를 정상 []/0/NULL 결과로 숨기지 않는다.

종목 상세는 security_id를 기준으로 연결한다. market+ticker 진입점을 남기는 경우 유일성/코드 재사용을 확인하며 임의 findFirst를 사용하지 않는다. 기존 URL/카드/차트/구성비를 복제할 의무는 없다.

업무 날짜 DTO는 Asia/Seoul의 YYYY-MM-DD, 실제 공개시각은 UTC ISO다. bigint/numeric/revision은 정확한 십진 문자열로 JSON-safe 변환한다. raw double 값은 finite number 또는 NULL이다. 차트 number 변환은 표시용 단위 축소에 한정한다.

CD의 평균/최소/최대는 제공 관측만 사용하고 표본 수/범위를 표시한다. NULL을 0으로 바꾸지 않으며 실제 0/음수는 보존한다. 변화율은 비교 날짜를 명시하고 기본 분모가 0 이하이거나 자료가 부족하면 계산 불가로 표시한다. OHLC 집계와 지표 평균은 구분하고 NULL 자동 보간은 하지 않는다. 이 통계들은 DB 컬럼으로 저장하지 않는다.

Next.js의 공개 결과 갱신·오류 표시·날짜 처리는 설치된 16.3.8 로컬 가이드에 맞춰 구현한다. 기본 standalone 모드를 검증하며 정적 export의 자동 재빌드/배포는 이번 범위가 아니다.

## 8. 구현 순서·파일·완료 기준

| 단계 | 변경 파일/작업 | 완료 기준 | 현재 상태 |
|---|---|---|---|
| 1. 저장 계약 | db/schema-postgres.ts, 후속 설치 SQL/meta, 입력 예시/제약 명세 | 원천·현재 결과·공개 헤더 계약 일치, db:check 통과 | 완료 |
| 2. 격리 PG18 검증 | scripts/test-postgres-migrations.cjs와 DB 계약 테스트 | 빈 설치, 실제 Drizzle 숫자 읽기, 키/상태/정정/rollback/공개 검증 | 완료 |
| 3. 조회·DTO·웹 | lib/data의 security/company/ranking/publication, DTO·날짜/숫자 helper, 관련 routes/components | 타입 검사·대상 lint·관련 테스트·대표 브라우저 검증 | 완료. 실제 DCD 연결 빌드·빈 상태 HTTP도 확인 |
| 4. 신규 DCD 설치·후속 적용 | PG18/접속 대상/빈 DB 확인 후 설치 SQL 적용 | 실제 catalog와 schema 일치, 적용 대상/결과 기록 | 완료. 0000 → 0001 → 0002 및 0002 재실행 no-op 확인 |
| 5. tem 통합 | tem 실제 원천 적재·공식 결과 반영 후 CD 대조 | 원천·공식값·화면의 상태/날짜/값/revision 일치 | 미검증. 실제 tem 데이터 반영 후 수행 |

캐시/CSV/검색/sitemap/helper는 이 변경에 실제로 의존하는 경로만 수정한다. 현재 최신값 컬럼을 유지하므로 제거 컬럼의 광범위한 조회 재작성은 하지 않는다. 오래된 CD 공식값 계산과 잘못된 NULL/0 변환은 필요한 경로에서 제거한다.

이미 적용한 0000/0001 SQL·snapshot·hash는 유지하고 0002 후속 SQL로 단순화를 반영했다. 빈 DB에는 0000 → 0001 → 0002를 순서대로 적용한다. 기존 데이터 이전/정리/baseline은 계획하지 않는다. 자격 증명은 연결 시 로컬 설정으로 제공받고 문서/DTO에는 넣지 않는다.

계획 당시 기본 환경은 Node 22.14.0, pnpm 10.34.6, 로컬 PG 도구 14.24였다. 구현은 별도 임시 Node 22.23.3과 PG18.6에서 검증했고 기본 설치를 변경하지 않았다. package.json의 지원 Node 범위와 PG18 요구를 따랐으며 skip을 통과로 기록하지 않았다.

최종 저장 계약 v2를 사용자가 tem에 전달한다. tem writer는 이 계약에 맞춰 구현하고 단계 5에서 실제 통합 결과를 추가한다. CD가 상대 채팅에 직접 메시지를 보내지는 않는다.

## 9. 필수 검증 사례

- 빈 PG18 설치의 타입/NULL/PK/UNIQUE/FK/CHECK와 설치 재실행.
- 같은 날짜/겹치는 기간 멱등, security_id NULL 중복 차단, 시장 구분, 비자정 거부, 과거 토요일 허용.
- offset/세션/브라우저 시간대가 달라도 한국 업무일 동일.
- 실제 0·음수 지표, 일부 필드 NULL, 값/상태 모순 거부, 원천 행 미제공과 필드 미제공 구분.
- 당시 연결/미연결/코드 재사용, confirmed 숫자→NULL·철회·마지막 제공값 재선정.
- 반영 중 실패 rollback 시 기존 원천/공식 결과 유지. 테스트 전용 writer의 key 잠금·expected revision으로 오래된 revision과 동시 writer 경쟁 검증.
- 공개 헤더 없음과 정상 순위 0건 구분, 행 자체 CHECK의 다른 범위/지표 key 오연결 거부. 결과와 헤더의 revision·계산 ID·기준일·건수 일치는 테스트 전용 writer의 최종 검증으로 확인.
- 요청 도중 공개 교체에도 조회·count 일관성, 다음 페이지의 revision 변경 시 갱신 안내.
- 회사 완전성/총액 정합성, 공식 순위 재판정 금지, 같은 날짜 정정의 이전 순위 비교 기준.
- 9007199254740993의 실제 Drizzle→DTO→JSON→표시/CSV 원값 유지.
- NULL→0 금지, 최신/마지막 제공값 분리, 조회 장애/미공개/자료 부족 구분.

CD fixture는 저장/조회 계약과 테스트 전용 writer의 잠금·최종 검증·rollback을 검증한다. 실제 tem writer·KRX 응답 완전성·원문 미제공 구분·Temporal 재개/동시 실행·근거 보존은 tem의 검증 항목으로 구분한다. 실제 적재/조회 통합 전에는 서비스 전체 검증 완료로 기록하지 않는다.

## 10. 검토할 선택과 최종 전달물

이번 수정안의 핵심 선택은 **기존 security/company/security_rank 활용 + 신규 result_publication 한 개 + 트랜잭션 단위 현재 결과 교체**다. 이를 통해 필요한 상태·근거·기준일·revision을 표현하되 모든 공식 결과 버전 보관까지 확대하지 않는다.

사용자 승인 후 schema·설치 SQL·조회/웹을 구현하고 검증했다. 후속 0002에서 컬럼·입력 형식을 유지하면서 사용자 정의 함수 4개·trigger 8개를 제거하고 단순 CHECK 3개를 추가했다. [최종 저장 계약 v2](cd-business-schema-contract-2026-10-07.md)에 변경 파일·설치 순서·실제 적용 여부·타입/키/상태·입력 예시·정정/공개 규칙·검증/미검증 범위를 정리했다.

실제 DCD `192.168.50.27:25433/dcd`에 `silla` 계정으로 0002까지 설치를 완료했다(PostgreSQL 18.6). 빈 DB 사전 확인 후 0000 → 0001을 설치했고, 후속 0002 CLI 적용과 재실행 no-op을 모두 exit 0으로 확인했다. **2026-10-07 05:16:56 KST**에 실제 catalog 14개 테이블·286개 컬럼·71개 보조 index·12개 FK·168개 CHECK·6개 enum, CD guard 함수 0개·public 사용자 trigger 0개를 확인했다. 모든 제약 validated·index valid/ready, 세 publication FK initially deferred와 세 migration hash 일치를 확인했다. 0000/0001은 변경하지 않았고 업무 테이블 14개는 모두 0건이며 PCD에는 접속·적용하지 않았다.

실제 DCD 연결 Next.js production 빌드와 개발 3001·standalone 3107의 HTTP 26개 검증을 통과했다. 런타임마다 미공개 순위 HTML 10개(200), 미공개 CSV 2개(404), 빈 검색 JSON(200, `[]`)을 확인했다. 개발 3001은 재시작 후 정상 구동 중이다. 130개 단위/회귀 테스트·typecheck·db:check와 격리 PG18 계약 검증(1 pass / 0 fail / 0 skip)을 통과했다. 테스트 전용 writer 검증과 실제 tem writer는 구분하며, 실제 tem 원천 수집·공식 계산 결과와 CD의 데이터 통합은 아직 미검증이다.

## 참고 근거

- 현재 db/schema-postgres.ts, lib/data/*, lib/*-utils.ts, scripts/test-postgres-migrations.cjs, Next.js 16.3.8 로컬 docs.
- [KRX 실측 보고서](/Users/craigchoi/tem/reports/krx-history-readonly-probe-2026-10-06.md): 자료별 건수/제공 범위의 차이. 모든 누락이 정상이라는 증거로 해석하지 않음.
- [PostgreSQL 18 날짜/시간](https://www.postgresql.org/docs/18/datatype-datetime.html), [숫자 타입](https://www.postgresql.org/docs/18/datatype-numeric.html), [제약](https://www.postgresql.org/docs/18/ddl-constraints.html).
- [PostgreSQL 18 트랜잭션 격리](https://www.postgresql.org/docs/18/transaction-iso.html): 트랜잭션 공개와 단일 요청 조회 일관성의 근거.
