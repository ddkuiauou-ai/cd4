# cd4 PostgreSQL 18 설치와 업무 데이터 계약

기준일: 2026-10-07, Asia/Seoul. 이번 변경은 **신규 빈 PostgreSQL 18 업무 DB**에 설치한다. 기존 데이터 이전·정리·baseline은 이번 범위에 포함하지 않는다. 앱은 Drizzle ORM의 `postgres-js` adapter와 `postgres` driver를 사용한다.

입력 형식과 값·결측·정정·공개 규칙은 [CD → tem 업무 데이터 저장 계약 v2](cd-business-schema-contract-2026-10-07.md)이 기준이다. 검증한 항목과 미검증 범위는 [검증·실제 DCD 적용 기록](cd-business-schema-verification-2026-10-07.md)에 있다. [최소 변경 계획](cd-business-schema-web-plan-2026-10-07.md)은 이 구현의 결정 배경이다.

## 파일과 설치 순서

| 파일 | 역할 |
|---|---|
| [db/schema-postgres.ts](../db/schema-postgres.ts) | 현재 PostgreSQL 테이블·타입·enum·키·CHECK·관계 선언 |
| [db/connection.ts](../db/connection.ts) | 앱과 Drizzle CLI의 연결 설정 해석 |
| [db/index.ts](../db/index.ts) | 앱의 PostgreSQL 연결 |
| [drizzle.config.ts](../drizzle.config.ts) | DB 연결 없이 SQL·snapshot을 생성/검사하는 설정 |
| [drizzle.connection.config.ts](../drizzle.connection.config.ts) | `.env`와 환경변수를 사용하는 migration·Studio 설정 |
| [0000_postgresql_init.sql](../drizzle/0000_postgresql_init.sql) | 최초 13개 테이블 설치 |
| [0001_business_result_contract.sql](../drizzle/0001_business_result_contract.sql) | 업무 계약 보완과 `result_publication` 신규 테이블 설치 |
| [0002_simplify_publication.sql](../drizzle/0002_simplify_publication.sql) | 사용자 정의 함수 4개·trigger 8개 제거, 단순 CHECK 3개 추가 |
| [drizzle/meta](../drizzle/meta) | 세 migration의 snapshot과 journal |

빈 DB에는 **0000 → 0001 → 0002** 순서로 적용한다. 최종 테이블은 14개다: `company`, `pension`, `display_name`, `search_name`, `security`, `price`, `marketcap`, `bppedd`, `stockcodename`, `tmp_bppedds`, `tmp_marketcaps`, `tmp_prices`, `security_rank`, `result_publication`.

0002는 0001에 설치했던 사용자 정의 공개 검증 함수·trigger를 모두 제거한다. 최종 DB는 PK/UNIQUE/FK와 행 자체 날짜·숫자·값/상태 CHECK를 유지하고, 결과 종류 및 순위 key를 확인하는 단순 CHECK 세 개를 추가한다. 세 publication FK의 initially deferred 설정과 migration 기록은 유지하므로 **설치 SQL을 schema push로 대체하지 않는다.** 공개 묶음의 건수·revision·계산 ID·기준일 일치, revision 증가와 재시도 규칙은 tem writer가 검증하며 DB trigger가 대신 강제하지 않는다.

설치 SQL은 시장 데이터를 채우지 않는다. tem이 원천과 검증된 공식 결과를 같은 DB에 기록한다. 헤더가 없으면 CD는 미공개를 표시하며, 공개 헤더와 포함 건수 0은 완료된 0건으로 표시한다.

## 역할과 데이터 의미

- **CD**: 업무 schema·설치 SQL·제약·DTO·웹 조회/표시. 선택 기간 평균·최소·최대·변화율 같은 화면 분석도 CD가 수행한다.
- **tem**: 원천 수집·정제·당시 종목 연결·제공 대상/누락 판단·재적재/정정. 공식 최신값·마지막 제공값·회사 합계·순위와 제외의 계산·검증·공개도 tem이 수행한다.
- **tem 운영 저장소**: Workflow·실패·시도 이력·원천 근거. CD에는 해당 불변 근거를 가리키는 `source_ref` 등을 저장한다.

원천 업무키는 `price/marketcap/bppedd`의 `(date, exchange, ticker)`다. `security_id`는 nullable 연결 속성이며 업무키에 넣지 않는다. 미연결 과거 자료도 중복 없이 보존한다.

KRX 일별 업무 날짜는 **Asia/Seoul 자정의 timestamptz**다. 예: `2000-01-04T00:00:00+09:00`. DTO는 한국의 `YYYY-MM-DD`를 사용한다. 실제 공개·수정 시각은 UTC ISO로 전달한다. 역사적 토요일 거래를 막지 않으며, 분봉·period·크립토 계약은 이후 별도 검토한다.

여섯 지표는 nullable 값과 필수 상태로 원천 실제 0·음수, 미제공과 미지원을 구분한다. 원천 행 부재를 가짜 0/NULL 행으로 만들지 않는다. 최신 결측과 마지막 실제 제공값은 별도로 저장·표시한다.

거래량·시총·주식수·revision 등 `bigint`는 Drizzle `bigint`로 읽는다. 회사 합계와 순위 값의 `numeric`은 문자열로 읽는다. API/JSON/CSV에는 **정확한 십진 문자열**을 사용하며 큰 정수를 JS `Number`로 변환하지 않는다. 원천 OHLC·여섯 지표의 double precision은 유한 number 또는 NULL이다.

공식 공개는 tem이 같은 publication key의 writer를 직렬화하고 expected revision과 입력 유효성을 확인한 뒤 대상 `security/company/security_rank` 결과와 `result_publication`을 한 트랜잭션에서 교체한다. COMMIT 전에 실제 건수·포함수·전 결과행 식별자·업무일을 key별 한 번 검증하고 실패하면 rollback한다. CD는 현재 헤더와 식별자가 맞는 결과를 단일 SQL 또는 REPEATABLE READ로 조회한다. 이전 revision 요청에는 갱신을 안내한다. 과거 공식 revision 전체 보관 구조는 없다. 원천 이력의 현재 정정본과 마지막 공식 공개본의 입력 시점은 다를 수 있다.

## 연결 환경변수

저장소 루트에서 `.env.example`을 `.env`로 복사해 연결을 설정한다. 자격 증명은 Git에 커밋하지 않는다.

1. 비어 있지 않은 `DATABASE_URL`이 있으면 우선한다. `postgres://` 또는 `postgresql://` URL만 허용하며 `sslmode`도 반영한다.
2. URL이 없으면 `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`를 설정한다. `POSTGRES_PORT` 기본값은 `5432`다.

```dotenv
DATABASE_URL="postgresql://cd4_user:password@localhost:5432/cd4"
```

URL의 사용자명·비밀번호에 예약 문자가 있으면 인코딩한다. 개별 `POSTGRES_*` 변수에는 원래 값을 사용한다. PostgreSQL 자격 증명에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

Drizzle CLI는 `dotenv`로 `.env`를 읽고 이미 주입된 환경변수를 우선한다. `.env.local`을 자동으로 읽는다고 가정하지 않는다. 앱은 Next.js의 `.env*` 로딩 순서를 따른다. 앱과 설치 명령의 **host·port·DB·계정**이 같은 대상을 가리키는지 확인한다. DCD를 지정해도 기존 `DATABASE_URL`이 다른 DB를 가리키면 URL이 우선하므로 먼저 제거하거나 고친다.

## 저장소 명령

| 명령 | 범위 |
|---|---|
| `pnpm db:generate` | DB 연결 없이 schema와 snapshot으로 후속 SQL/meta 생성 |
| `pnpm db:check` | DB 연결 없이 migration chain 검사 |
| `pnpm db:migrate` | 지정한 DB에 미적용 설치 SQL과 migration 기록 반영 |
| `pnpm db:studio` | 지정한 DB를 Studio에서 조회·편집 가능하게 열기 |
| `pnpm test:db` | 독립 임시 PostgreSQL 18 클러스터에서 설치와 업무 계약 검증 |

`db:check` 통과는 실제 업무 DB 설치의 증거가 아니다. `test:db` 통과도 업무 DB 적용이나 실제 tem 데이터의 계산 정확성을 입증하지 않는다.

## 격리 PostgreSQL 18 검증

지원 Node는 `.nvmrc`의 **22.23.3**과 `package.json`의 Node 22 범위다. 테스트는 같은 디렉터리에 있는 PostgreSQL **18** `initdb`·`pg_ctl`만 선택한다. `CD_TEST_PG_BIN`, Homebrew `postgresql@18/bin`, `PATH` 등을 찾으며 실행한 서버의 실제 major version도 검사한다.

```sh
CD_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin pnpm test:db
```

PostgreSQL 18이 없거나 지원하지 않는 Node/OS·root 계정이면 실패한다. **설치되지 않은 환경을 숨은 skip으로 성공 처리하지 않는다.** 다른 PostgreSQL 버전으로 대신 검증하지 않는다.

테스트는 고유 Unix socket만 사용하는 새 임시 클러스터를 만들고 TCP 수신을 끈다. 앱 `.env`를 읽지 않고 PostgreSQL 연결 환경변수도 제거한다. 기본 실행은 끝나면 서버와 임시 디렉터리를 정리한다. 명시적인 `CD_TEST_KEEP_CLUSTER=1`은 성공한 합성 fixture를 화면 검증용으로 잠시 보존하며, 사용 후 출력된 data 경로에 `pg_ctl stop`을 실행하고 임시 폴더를 삭제한다.

**2026-10-07 실측:** PostgreSQL 18.6 / Node 22.23.3에서 **1 pass / 0 fail / 0 skip**으로 설치·재실행과 14개 테이블·286개 컬럼·71개 보조 index·12개 FK·168개 CHECK를 검증했다. CD 검증 함수·사용자 trigger는 0개다. 업무키·NULL 종목 연결·한국 날짜·0/음수/결측·정정·공개 0건·정확한 ORM→DTO 숫자·원자 교체와 읽기 경쟁도 통과했다. key 잠금·expected revision·최종 검증·rollback은 **테스트 전용 writer**로 확인했으며 실제 tem writer 검증이 아니다. 자세한 범위와 제한은 [검증 기록](cd-business-schema-verification-2026-10-07.md)을 따른다.

## 신규 빈 업무 DB 설치

1. PostgreSQL **18**의 전용 빈 DB와 설치 권한을 가진 계정을 준비한다.
2. `pnpm install --frozen-lockfile`을 실행하고 대상 연결을 설정한다.
3. 실제 서버 버전·연결 대상·빈 업무 schema와 migration 기록을 확인한다.
4. 검토한 `0000_postgresql_init.sql`·`0001_business_result_contract.sql`·`0002_simplify_publication.sql`을 확인하고 `pnpm db:check`, `pnpm test:db`를 실행한다.
5. `pnpm db:migrate`로 **0000 → 0001 → 0002**를 적용한다.
6. 최종 14개 테이블·enum·PK/UNIQUE/FK/CHECK, 세 initially deferred publication FK, 사용자 정의 공개 guard 제거와 세 migration 기록을 확인한다.
7. [최종 저장 계약 v2](cd-business-schema-contract-2026-10-07.md)에 맞춰 tem이 원천과 공식 결과를 기록한 뒤 CD의 값·상태·날짜·revision을 대조한다.

설치 때 SQL을 다시 생성할 필요는 없다. 자동 baseline이나 기존 데이터 이전을 수행하지 않는다. 대상에 이미 업무 테이블이나 데이터가 있으면 이 빈 설치 절차를 적용하지 않는다. 이미 0001까지 설치한 DCD에는 `pnpm db:migrate`로 미적용 0002만 반영했으며 DB를 다시 만들지 않았다.

**현재 적용 상태: 실제 DCD에 0002까지 반영 완료.** 대상은 `192.168.50.27:25433/dcd`, 계정은 `silla`, 서버는 PostgreSQL 18.6이다. 사전 확인에서 업무 테이블·migration 기록이 없는 빈 DB와 설치 권한을 확인하고 0000 → 0001을 설치한 뒤, CLI로 0002를 후속 적용했다(exit 0). 재실행도 exit 0이며 추가 적용 없이 종료했다. 0000/0001 SQL과 hash는 변경하지 않았다.

**2026-10-07 05:16:56 KST**에 실제 catalog에서 14개 테이블·286개 컬럼·71개 보조 index·12개 FK·168개 CHECK·6개 enum, CD guard 함수 0개·public 사용자 trigger 0개를 확인했다. 모든 제약 validated, 모든 index valid/ready, 세 publication FK initially deferred와 세 migration hash 일치를 확인했으며 업무 테이블 14개는 모두 0건이다. PCD에는 접속·적용하지 않았다.

실제 DCD 연결 Next.js production 빌드를 통과했고 개발 3001과 standalone 3107에서 각각 순위 HTML 10개(200, 미공개), CSV 2개(404, 미공개), 검색 JSON(200, `[]`)을 확인했다(총 26개 통과). 개발 3001은 재시작 후 정상 구동 중이다. 격리 PG18 검증과 130개 단위/회귀 테스트·typecheck·db:check도 통과했다. **실제 tem writer·원천 적재·공식 계산·CD 데이터 대조는 아직 미검증**이며 빈 DB의 HTTP 응답 확인과 구분한다.

## 후속 변경

schema를 바꾸면 후속 SQL과 snapshot·journal을 함께 남기고 `db:check` 및 PG18 계약 검증을 수행한다. 수집 writer와 웹이 따르는 입력 의미를 [CD → tem 계약](cd-business-schema-contract-2026-10-07.md)에 함께 반영한다. 이미 적용한 SQL을 수정하거나 적용 이력을 임의로 채우지 않는다.

[이전 DAG 연동 문서](dag-integration.md)는 기존 생산자·구조의 조사 기록이다. 이번 tem writer의 저장 계약은 위 최신 문서가 기준이다.
