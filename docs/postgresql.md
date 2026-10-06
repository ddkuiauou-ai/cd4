# cd4 PostgreSQL 설치와 마이그레이션

기준일: 2026-10-06, Asia/Seoul. cd4의 지원 데이터베이스는 PostgreSQL이다. 앱은 `drizzle-orm/postgres-js` adapter와 `postgres` driver를 사용한다. cd4의 Turso/SQLite 스키마와 libSQL 의존성은 제거했다. 외부 DAG의 별도 Turso 자산과 과거 테스트의 SQLite fixture는 [DAG 연동 기록](dag-integration.md)과 날짜가 있는 검증 보고서의 범위에 속한다.

## 유지하는 파일과 책임

| 파일 | 역할 |
| --- | --- |
| [db/schema-postgres.ts](../db/schema-postgres.ts) | PostgreSQL 테이블·enum·인덱스·관계의 선언 |
| [db/connection.ts](../db/connection.ts) | 앱과 Drizzle CLI가 공유하는 PostgreSQL 연결 설정 해석 |
| [db/index.ts](../db/index.ts) | `postgres`와 `drizzle-orm/postgres-js`를 사용하는 앱 연결 |
| [drizzle.config.ts](../drizzle.config.ts) | DB 연결 없이 사용하는 PostgreSQL schema·migration 출력 설정 |
| [drizzle.connection.config.ts](../drizzle.connection.config.ts) | `.env`와 환경 변수에서 연결 정보를 읽는 migration·Studio 설정 |
| [drizzle/0000_postgresql_init.sql](../drizzle/0000_postgresql_init.sql) | 빈 PostgreSQL DB에 적용하는 초기 migration |
| [drizzle/meta](../drizzle/meta) | PostgreSQL snapshot과 migration journal |

초기 migration은 `metric_type` enum과 13개 테이블을 만든다. 테이블은 `company`, `pension`, `display_name`, `search_name`, `security`, `price`, `marketcap`, `bppedd`, `stockcodename`, `tmp_bppedds`, `tmp_marketcaps`, `tmp_prices`, `security_rank`다. `security_rank`의 identity와 unique index, timestamp·date 타입, bigint·double precision 타입, 외래 키와 부분 인덱스도 현재 선언을 따른다.

이 migration은 시장 데이터를 적재하지 않는다. 앱이 소비하는 기업·종목·가격·지표·순위 snapshot은 수집·집계 파이프라인이 별도로 준비해야 한다. 파이프라인의 실제 SQL과 운영 DB 계약을 함께 비교한다.

## 연결 환경 변수

권장 설치 흐름은 저장소 루트에서 `.env.example`을 `.env`로 복사한 뒤 PostgreSQL 연결을 설정하는 것이다. 비밀값은 Git에 커밋하지 않는다.

연결은 다음 순서로 해석한다.

1. `DATABASE_URL`이 있으면 이를 사용한다. `postgres://` 또는 `postgresql://` URL만 허용하며, URL에 지정한 `sslmode`는 앱과 Drizzle CLI에 반영된다.
2. URL이 없으면 `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`를 모두 설정한다. `POSTGRES_PORT`를 생략하면 `5432`를 사용한다.

예시 연결 형식:

```dotenv
DATABASE_URL="postgresql://cd4_user:password@localhost:5432/cd4"
```

URL의 사용자명·비밀번호에 예약 문자가 있으면 URL에 맞게 인코딩한다. 개별 `POSTGRES_*` 변수를 사용할 때는 원래 사용자명과 비밀번호를 입력한다. PostgreSQL 자격 증명에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

Drizzle 연결 설정은 `dotenv`로 `.env`를 읽으며 이미 주입된 환경 변수를 우선한다. `.env.local` 등 Next.js 전용 환경 파일을 Drizzle CLI가 자동으로 읽는다고 가정하지 않는다. 앱은 Next.js의 `.env*` 로딩 순서를 따른다. 서로 다른 파일이나 CI 환경 변수로 실행할 때 앱과 migration이 같은 DB를 가리키는지 먼저 확인한다.

## 저장소 명령

| 명령 | 연결·변경 범위 |
| --- | --- |
| `pnpm db:generate` | DB 연결 없이 schema와 기존 snapshot으로 후속 SQL·meta 생성 |
| `pnpm db:check` | DB 연결 없이 migration history의 일관성 검사 |
| `pnpm db:migrate` | 연결 설정의 PostgreSQL DB에 미적용 migration 실행; DDL과 migration 기록 변경 |
| `pnpm db:studio` | 연결 설정의 PostgreSQL DB를 Studio에서 조회·편집 가능하게 열기 |
| `pnpm test:db` | 별도 임시 PostgreSQL DB에서 초기 설치와 schema 동작 검증 |

`db:generate`와 `db:check`는 `drizzle.config.ts`, `db:migrate`와 `db:studio`는 `drizzle.connection.config.ts`를 사용한다. `db:check` 통과는 실제 DB의 테이블·컬럼·enum·인덱스가 선언과 같다는 증거가 아니다. `test:db`도 임시 DB 검증이며 업무 DB 상태를 인증하지 않는다.

기본 운용은 검토한 SQL을 순서대로 적용하는 migration이다. 자동 schema push나 자동 baseline을 수행하는 package script는 제공하지 않는다.

## 격리 PostgreSQL 검증

`pnpm test:db`에는 같은 디렉터리에 있는 네이티브 PostgreSQL `initdb`와 `pg_ctl`이 필요하다. 테스트는 `PATH`, `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`에서 두 실행 파일을 찾는다. Homebrew의 버전별 또는 keg-only 설치를 사용하면 해당 PostgreSQL의 `bin` 디렉터리를 `PATH`에 넣는다. 도구가 없거나 root 계정으로 실행하면 테스트를 skip하며, 이 결과는 설치 검증 통과가 아니다.

테스트는 독립 임시 클러스터를 만들고 고유 Unix socket으로만 연결한다. TCP 수신은 비활성화한다. 앱의 `.env`를 읽지 않고 PostgreSQL 연결 환경 변수를 상속하지 않으며, 원격 DB를 대상으로 바꾸는 환경 변수 override는 제공하지 않는다. 검증이 끝나면 클러스터를 종료하고 임시 파일을 정리한다.

**2026-10-06 확인:** 격리 PostgreSQL 14에서 초기 migration 적용과 재실행을 검증했다. snapshot과 실제 catalog의 13개 테이블, 191개 컬럼, 65개 보조 인덱스, 8개 외래 키가 일치했다. enum 값, default, serial·identity 생성, bigint 정밀도, 외래 키와 순위 unique 제약도 통과했다. 이 검증은 실제 업무 DB에 연결하거나 해당 DB의 DDL·데이터를 변경하지 않았다.

## 신규 빈 PostgreSQL DB 설치

이 절차는 cd4 업무 테이블과 기존 migration 기록이 없는 전용 DB에 적용한다.

1. PostgreSQL DB와 필요한 권한을 가진 migration 계정을 준비한다. 런타임·빌드 조회 계정과 migration 계정을 환경별로 구분할 수 있다.
2. `pnpm install --frozen-lockfile`로 고정 의존성을 설치하고 `.env` 또는 실행 환경에 대상 연결을 설정한다.
3. 연결 대상과 DB가 비어 있음을 확인하고 `drizzle/0000_postgresql_init.sql`을 검토한다.
4. 저장소에서 `pnpm db:check`를 실행한다.
5. `pnpm db:migrate`를 실행해 초기 schema와 migration 기록을 만든다.
6. 13개 테이블·`metric_type` enum·외래 키·인덱스와 migration 기록을 확인한다.
7. 파이프라인이 같은 DB에 완결된 데이터 snapshot을 적재한 뒤 `pnpm dev` 또는 빌드로 화면을 확인한다.

이미 생성된 초기 SQL을 설치 시 다시 생성할 필요는 없다. `db:generate`는 schema를 바꿨을 때 후속 migration을 만드는 명령이다. 빈 테이블만 생성한 직후에는 순위나 상세 화면에 표시할 시장 데이터가 없다.

## 기존 PostgreSQL DB의 비교와 baseline

기존 업무 DB에 초기 `CREATE TABLE` migration을 그대로 재실행하지 않는다. 이전 cd4 migration은 SQLite용이었으므로 기존 파일의 journal을 PostgreSQL DB에 적용됐다는 증거로 사용할 수 없다. Drizzle 패키지 업데이트나 저장소의 PostgreSQL 정리도 실제 DB의 schema 변경을 뜻하지 않는다.

기존 DB는 다음 절차로 편입한다.

1. DB의 백업과 안전한 복제본을 확보하고, 앱과 수집·집계 파이프라인이 사용하는 실제 연결 대상 및 기존 migration 기록을 확인한다.
2. 읽기 전용 introspection 또는 schema-only dump로 실제 DDL을 별도 경로에 보관한다. 도구 출력을 현재 `db/schema-postgres.ts`나 `drizzle/`에 바로 덮어쓰지 않는다.
3. 실제 DDL을 schema 선언·초기 SQL·파이프라인 SQL과 비교한다. ID 타입, 날짜와 시간대, bigint 값 범위, nullable·default, enum 값, serial/identity와 sequence, 외래 키, unique·부분 인덱스를 확인한다. `security_rank`와 `metric_type`이 있는지도 확인한다.
4. 차이가 있으면 기존 데이터에 맞는 변경 SQL과 필요한 데이터 정리·보완 작업을 작성하고 복제본에서 검증한다. 테이블이 존재한다는 이유만으로 초기 schema와 동등하다고 판단하지 않는다.
5. 실제 schema가 검토한 기준과 같다는 증거를 남긴 뒤, 해당 DB의 기존 이력을 반영하는 migration baseline과 후속 적용 계획을 별도로 검토·확정한다.
6. 확정한 계획에 따라 필요한 변경과 migration 이력 편입을 수행하고, 이후 미적용 migration만 적용한다. 실제 DB·파이프라인·앱 조회를 다시 비교한다.

이 저장소에는 기존 DB를 자동으로 baseline하는 명령이 없다. `CREATE TABLE` 실패를 피하려고 migration journal이나 DB의 Drizzle 이력을 임의로 채우거나 초기 SQL을 적용 완료로 처리하지 않는다. 기존 DB 편입은 DB별 schema 비교와 검토 결과가 먼저 필요하다.

## 후속 schema 변경

`db/schema-postgres.ts`를 수정한 뒤 `pnpm db:generate`로 후속 migration을 만든다. SQL과 snapshot·journal을 함께 검토하고 `pnpm db:check`를 실행한다. 날짜·식별자·enum·제약 변경은 [DAG 데이터 계약](dag-integration.md)의 생산자 SQL에 미치는 영향도 확인한다. 적용 예정 DB의 복제본에서 migration과 필요한 데이터 보완을 검증한 뒤 대상 DB의 미적용 migration을 실행한다.

이미 적용한 migration을 수정하거나 초기 migration으로 합치지 않는다. 새 변경은 후속 migration으로 남겨 설치 이력과 DB 상태를 추적할 수 있게 한다.
