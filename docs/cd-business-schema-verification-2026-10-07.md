# CD 업무 스키마 검증·DCD 적용 기록

검증일: 2026-10-07, Asia/Seoul.

**현재 기준은 0002까지 적용한 v2다.** 아래 최초 구현·0001 적용 기록은 당시 검증 이력이며, DB 함수/trigger 보장은 최종 계약에서 제거됐다. 현재 결과는 마지막의 [v2 최종 검증](#v2-단순화-후-최종-검증)과 [실측 JSON](cd-dcd-verification-2026-10-07.json)을 따른다.

## 실제 실행 환경과 결과

- Node.js **22.23.3**. 공식 nodejs.org 배포와 SHA256 목록을 확인하고 `/private/tmp`에만 압축을 풀어 사용했다.
- PostgreSQL **18.6**, Homebrew 공식 `arm64_sequoia` bottle. 공식 패키지 메타데이터의 SHA256과 내려받은 파일을 대조했다. 실행·자료 경로는 임시 런타임 안에서만 조정했다.
- 기존 Node/Homebrew 설치, 기존 PostgreSQL 서버와 업무 DB 설정은 변경하지 않았다.
- 테스트는 고유 임시 디렉터리의 새 클러스터를 만든다. TCP를 끄고 해당 테스트의 Unix socket만 사용하며, 앱의 `.env`를 읽지 않고 PostgreSQL 연결 환경변수도 제거한다.
- `scripts/test-postgres-migrations.cjs`: **pass 1 / fail 0 / skip 0**. 아래 일곱 시나리오군을 하나의 실제 DB 통합 테스트에서 순서대로 검증했다.
- 대상 스크립트 ESLint와 `git diff --check`도 통과했다.

재실행 예시:

```sh
PATH=/private/tmp/node-v22.23.3-darwin-arm64/bin:$PATH \
CD_TEST_PG_BIN=/private/tmp/cd4-pg18-runtime/postgresql@18/18.6/bin \
pnpm test:db
```

일반 설치에서는 `CD_TEST_PG_BIN`에 PostgreSQL 18의 `initdb`·`pg_ctl` 디렉터리를 지정하거나 Homebrew PostgreSQL 18을 사용하면 된다. 이 테스트는 버전이 다른 서버를 대신 사용하거나 설치되지 않은 환경을 성공한 skip으로 처리하지 않는다. macOS sandbox의 공유 메모리 제한 때문에 이번 로컬 서버 실행은 sandbox 밖에서 수행했다.

## 검증한 계약

설치 자체는 `0000_postgresql_init`과 `0001_business_result_contract`를 빈 DB에 순서대로 두 번 실행했다. 두 번째 실행은 중복 적용하지 않았다. 실제 catalog에서 **14개 테이블, 286개 컬럼, 71개 보조 index, 12개 FK, 165개 CHECK**와 모든 PK를 최신 Drizzle snapshot과 대조했다. 공개 연결 FK 세 개의 deferred 설정도 확인했다.

1. **업무키·재적재**: `security_id=NULL`인 자료의 중복 거부, 시장별 동일 ticker 구분, 원천 price/marketcap/bppedd 키, UPSERT 시 id·created_at 보존, 정확한 bigint 읽기, 잘못된 FK·NULL/빈 시장·빈 근거·비유한 가격·음수 거래량 거부. 개별 종목의 시가·거래량 0과 실제 종가는 함께 보존됐다.
2. **업무 날짜**: 한국 자정 이외의 timestamp와 잘못된 year/month 거부, 한국 자정과 같은 UTC instant의 키 중복 확인, 과거 토요일 저장, UTC/New York/Seoul DB 세션 모두 같은 한국 업무일 반환. DTO가 UTC의 전날을 표시하지 않는 것도 확인했다.
3. **값·결측·정정**: 실제 PER/DIV 0과 EPS 음수 보존, `source_missing`과 `unsupported` 구분, NULL 상태·값/상태 모순·비유한 지표 거부. 숫자 0→확인된 원천 결측 정정은 NULL로 바뀌고 다른 필드는 보존됐다. 원천 행 미제공을 가짜 NULL 행으로 만들지 않았고 실패한 부분 반영은 rollback했다.
4. **당시 연결**: 같은 ticker를 날짜별 다른 security_id에 연결하고 미연결 명부도 보존했다. 미연결 명부의 복합키 중복도 거부했다.
5. **공식 공개·DTO**: 헤더와 종목 최신/마지막 제공값·회사 완전/불완전 합계·순위를 하나의 실제 Drizzle 트랜잭션으로 공개했다. 최신 결측과 과거 제공값은 별도로 저장됐다. 불완전 회사 합계는 NULL, 순위 제외와 근거를 가졌다. 헤더가 없는 미공개와 공개된 순위 0건은 달랐다. 실제 Drizzle `bigint` 값 **9007199254740993**, 회사 `numeric` 합계 **18014398509481986**, 순위 numeric 값이 DTO→JSON까지 원래 십진 문자열로 유지됐다.
6. **공개 제약·원자성**: 실제 건수 없는 헤더, 헤더 건수 갱신 없는 추가행, 다른 범위/지표/종류 연결, 헤더만 바뀐 revision, 같은 revision의 값/메타데이터 변경과 삭제를 거부했다. 정확히 같은 값의 재실행은 허용됐다. 공개 도중 실패는 이전 정상 헤더를 유지했다. 새 revision에서 최신값을 NULL로 정정하고 마지막 제공 음수를 재선정할 수 있었다. 오래된 revision·기준일 후퇴·불완전 last-provided 묶음·회사 완전성/합계 모순도 거부했다.
7. **읽기 경쟁**: REPEATABLE READ 읽기 트랜잭션 중 다른 writer가 헤더와 순위행을 교체했다. 진행 중인 요청은 이전 revision의 헤더·건수·행을 일관되게 읽었고 다음 요청은 새 revision을 읽었다.

웹 검증을 위해 명시적인 `CD_TEST_KEEP_CLUSTER=1`로 합성 fixture 클러스터 하나를 잠시 보존했다. 최종 브라우저 확인 후 localhost:3107 standalone을 종료하고 해당 PG18 클러스터를 정상 종료·삭제했다. 기존 사용자 개발 서버는 종료하지 않았다. 기본 DB 테스트는 끝나면 서버와 임시 디렉터리를 자동 정리한다.

## 이 기록이 입증하지 않는 항목

- 격리 테스트 자체는 업무 DB 설치나 실제 KRX 적재를 입증하지 않는다. 실제 DCD 설치는 아래 별도 절차로 확인했다. PCD는 접속/적용하지 않았다.
- tem의 원문 `-`/빈 값 구분, 제공 대상·정상 제외/미지원 판단, 원천 근거 보존, 코드 재사용의 실제 종목 연결 판단.
- Temporal의 재개·동시 실행 fencing, 계산 입력 고정과 source 변경 경쟁 처리. 테스트는 CD 저장/공개 계약과 읽기 경쟁을 검증한다.
- 실제 KRX 전체 기간 적재, 공식 파생값 계산의 산술·정책 정확성, 대량 공개의 처리 시간.
- 실제 업무 데이터·tem writer를 사용한 Next.js 화면과 CSV 대조. 아래 합성 fixture 화면 검증은 실제 원천 수집/공식 계산의 정확성을 입증하지 않는다.

## 공식 런타임 근거

- [Node.js 22.23.3 SHA256 목록](https://nodejs.org/dist/v22.23.3/SHASUMS256.txt)
- [Homebrew PostgreSQL 18 패키지 메타데이터](https://formulae.brew.sh/api/formula/postgresql@18.json)

## 후속 웹 단위 검증

제로 베이스 화면에 맞춰 `dashboard-state`, `page-metadata`, `pbr-detail-csv`, `ranking-view` 네 테스트를 갱신했다. 실제 route와 공유 TS/TSX 컴포넌트를 읽고 I/O 경계만 대체해 HTML을 렌더링했으며 **29/29 통과, skip 0**이다.

- 공식 값의 정확한 십진 문자열과 안정적인 회사·종목 ID, 현재 마스터 상태에 따른 임의 순위 재제외 방지를 확인했다.
- 공개 0건·미공개·revision 변경의 상태와 CSV/범위/페이지 연결, 첫 20행·다음 100행, 잘못된 페이지 404를 확인했다.
- 실제 PBR 상세에서 BPS NULL과 독립 제공 PBR, 최신과 마지막 제공값, 실제 0·음수·필드 결측, 선택 기간 분석과 잘못된 기간의 조회 억제를 확인했다.
- 식별정보만 읽는 메타데이터와 안정적인 ID canonical, 회사 alias·코드 재사용 모호성, 브랜드 OG/Twitter, 범위·페이지별 URL을 확인했다. canonical은 프로젝트의 `trailingSlash`를 따르고 revision은 넣지 않는다.

전체 TypeScript 검사와 변경한 helper·route·테스트의 대상 ESLint도 통과했다.

## 최종 웹·빌드 검증

- **전체 130 tests / pass 130 / fail 0 / skip 0**. `pnpm test`에서 raw/official DTO, 요청 내 snapshot, CSV, 화면 상태·기간 산술·검색·metadata를 검증했다. 제공 0·음수·독립 PBR/BPS 결측, bigint/numeric exact string, 미공개·정상 0건·revision 변경을 포함한다.
- `pnpm typecheck`와 `pnpm db:check` 통과. 최종 standalone 빌드도 TypeScript 단계를 통과했다.
- 최종 **Next.js 16.3.8 Turbopack production standalone** 빌드 통과. sandbox의 pnpm 하위 프로세스에서는 CSS worker 포트 생성이 제한되었으므로 지원 Node로 Next CLI를 직접 실행했다. 임시 PG fixture 연결은 process 환경변수로만 지정하고 `DATABASE_URL=''`로 `.env`의 URL 우선순위를 제거했다. 기존 업무 `.env`를 수정하지 않았다.
- `.next/standalone`에서 localhost:3107로 검증용 서버를 실행했다. production 자산은 standalone 안에 복사했으며 Git에는 빌드 결과를 추가하지 않았다.
- **실제 HTTP HTML 28개 사례 통과**: 홈/dashboard/회사 순위, 종목 일곱 지표 순위, 종목 일곱 지표 및 기본 상세, 완전/불완전 회사 상세, 잘못된 페이지·미존재 상세, 미공개/0건/버전 변경 상태를 확인했다.
- **실제 HTTP CSV 4개 사례 통과**: marketcap `9007199254740993` 원문 보존(200), 공개 0건의 헤더만 있는 CSV(200), 이전 revision(409), 미공개(404).
- Next의 스트리밍 상세 notFound는 404 화면과 noindex를 제공하면서 HTTP 200이 될 수 있음을 실제 확인했다. unit의 notFound 분기 검증을 모든 경로의 hard HTTP 404 증거로 확대하지 않는다.
- **실제 IAB 브라우저 확인**: 데스크톱과 375×812 모바일에서 최신 NULL/과거 제공값/각 날짜를 별도 표시하고 EPS -34와 주식수 `9,007,199,254,740,993`을 보존했다. 불완전 회사 합계는 NULL/부족/제외 상태였다. 0건 순위에는 완료 상태와 revision이 있는 CSV 링크가 있었다.
- 기간 GET form의 시작/종료일과 안정적인 security ID URL 이동을 확인했다. 유형 NULL인 합성 종목도 기타 종목 검색→stable ID 상세로 이동했다. 페이지 자체 overflow는 없고 지표 표만 가로 스크롤했다(scrollLeft 375px). 모바일 상태 문구의 과도한 줄바꿈을 min-width/nowrap로 한 차례 보완했다.
- 변경 파일 ESLint error 0, 기존 최근 종목 sidebar의 `set-state-in-effect` warning 1. Impeccable detector primary 0, 기존 검색 단축키 10px 글자 크기 advisory 1. 변경 후 `git diff --check` 통과.

브라우저 fixture는 실제 KRX 데이터가 아니다. 실제 제공 0·차트 NULL gap/단일 점·평균·변화율 산술은 unit/PG 검증으로 확인했고, 실제 브라우저에서 모든 상태/차트 조합을 실행했다고 주장하지 않는다. 정적 export/배포·실제 tem 원문/제공 대상/계산 산식 검증은 하지 않았다.

## 최초 0001 DCD 설치와 catalog 검증

실측 결과는 [DCD 검증 결과 JSON](cd-dcd-verification-2026-10-07.json)에 보관한다. 자격 증명이나 시장 원문은 포함하지 않는다.

사용자가 연결 복구를 확인한 뒤 실제 앱의 환경 로딩/연결 설정으로 읽기 전용 사전 확인을 수행했다. 대상은 **192.168.50.27:25433 / dcd / silla / PostgreSQL 18.6**이며 업무 테이블과 Drizzle 설치 이력은 모두 없었다. DB/public schema CREATE 권한도 확인했다. 기존 데이터 이전·baseline은 하지 않았다.

로컬 `.env`는 같은 DCD를 가리킨다. 이 구현 작업에서 `.env`를 수정하지 않았고 비밀번호는 출력/문서화하지 않았다. 앞선 [연결 진단](db-connection-diagnostic-2026-10-07.md)은 복구 전 기록이다. 별도 5432나 PCD에 접속/설치하지 않았다.

다음과 같이 지원 Node의 Drizzle CLI로 **0000 → 0001**을 적용했다. `DATABASE_URL=''`로 다른 URL 우선순위를 제거하고 대상 DB를 명시했다. 비밀번호는 기존 로컬 설정을 사용했다.

```sh
PATH=/private/tmp/node-v22.23.3-darwin-arm64/bin:$PATH \
DATABASE_URL='' POSTGRES_HOST=192.168.50.27 POSTGRES_PORT=25433 \
POSTGRES_DB=dcd POSTGRES_USER=silla \
/private/tmp/node-v22.23.3-darwin-arm64/bin/node \
node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.connection.config.ts
```

처음 적용 exit 0, 같은 명령 재실행 exit 0/no-op이다. 설치 로그의 긴 FK 식별자 63바이트 절단 NOTICE는 PostgreSQL의 정상 동작이며 최종 catalog 이름과 대조했다. 임의 설치 이력 추가는 하지 않았다.

**2026-10-07 04:38:54 KST**에 read-only REPEATABLE READ로 다음을 확인했다.

- `0001_snapshot.json`과 **14 tables / 286 columns / 71 indexes / 12 FKs / 165 CHECKs**, PK를 대조했다. 컬럼의 타입·NULL·기본값·identity, index의 식·순서·NULL 배치·predicate·unique, FK/PK와 세 publication FK의 initially deferred 설정을 확인했다.
- **6개 enum**의 이름/값, **4개 guard 함수 본문**, **8개 guard trigger**의 대상·함수·활성·이벤트·deferred 설정을 직접 대조했다. 이 중 네 개는 deferred constraint trigger다.
- 모든 제약 `convalidated=true`, 모든 index `indisvalid=true/indisready=true`다. CHECK는 이름·validated 상태와 설치 SQL hash를 확인했으며, 모든 CHECK 식을 독립적으로 의미 정규화한 비교는 수행하지 않았다. 거부/rollback 동작은 위 격리 PG18 시나리오에서 검증했다.
- 두 migration의 SHA256과 Drizzle journal 시각이 로컬 SQL/journal과 일치했다. 아래 journal 시각은 생성 메타데이터이며 실제 적용 시각을 뜻하지 않는다.
- 업무 테이블 14개는 모두 **0건**이다. 실제 DCD에 합성 fixture나 시장 자료를 넣지 않았다.

| migration | 실제 기록 SHA256 | journal created_at |
|---|---|---|
| 0000_postgresql_init | `9fa9e9eb88b6c20aa30f8a3333ffe51cdc15c909d304167e496f2f3eb868b38a` | `1791297751101` |
| 0001_business_result_contract | `74d433fa0a0514c1c0cd41c806750245218c30b2f13470f5fb4dad426dc430a7` | `1791312651783` |

## 실제 빈 DCD 웹 검증

- 동일 DCD를 명시한 **Next.js 16.3.8 production standalone 빌드 통과**(지원 Node 22.23.3). 컴파일·TypeScript·정적 생성까지 exit 0이며 검색 초기 JSON은 빈 배열이다. 앞선 합성 명부 빌드를 교체했다. `pnpm db:check`도 다시 통과했다.
- 개발 서버 localhost:3001과 임시 standalone localhost:3107 각각 **13건**, 총 **26건 HTTP 검증 통과**. `/`, `/dashboard/`, `/marketcaps/`, `/marketcap/`, `/per/`, `/pbr/`, `/bps/`, `/eps/`, `/div/`, `/dps/`는 200이며 미공개 문구를 표시했다. 아직 헤더가 없으므로 완료된 0건으로 표시하지 않는다.
- 회사 시총/PER CSV는 미공개 404, `/search-data.json/`은 200과 `[]`다. 브라우저에서 홈의 정상 미공개 화면, 검색 입력 후 “검색 결과 없음”을 확인했고 warn/error 로그는 없었다.
- `result_publication` 미설치로 발생한 홈 500은 설치 후 해소됐다. 기존 개발 프로세스에서 검색 500이 남아 프로젝트 경로/프로세스를 확인하고 해당 서버만 정상 종료 후 같은 `bun dev --port 3001`을 지원 Node PATH로 재시작했다. 재시작 후 검색도 위 검증을 통과했다. 이전 검색 오류의 내부 원인을 별도로 확정하지 않았다.
- 검증용 standalone은 종료했다. 개발 서버는 **3001**에서 정상 실행 중이다. port 3000의 다른 프로세스는 종료하지 않았다. 위 격리 검증 단계와 달리 이 단계에서는 확인된 해당 프로젝트 개발 서버를 재시작했다.

이 결과는 실제 빈 DCD 설치와 미공개 웹 동작을 입증한다. **tem의 실제 원천 적재, 원문 결측/제공 대상 판단, 당시 종목 연결, 공식 계산, Temporal 경쟁 처리와 실제 자료의 웹/CSV 대조는 미검증**이다. tem이 저장 계약에 맞춰 적재한 뒤 확인한다. 운영 배포·정적 export는 수행하지 않았다.

## v2 단순화 후 최종 검증

수정 계획은 작은 완료 기록 `result_publication`을 유지하고 사용자 정의 공개 검증 함수 4개/trigger 8개를 제거한다. 값·컬럼·업무키는 그대로다. DB는 값/상태/업무일·PK/UNIQUE/FK·행 자체 CHECK를 담당하고, tem writer는 결과 묶음 검증과 revision/재시도 정책을 담당한다.

### 코드·빈 DB·격리 검증

- 0000/0001 SQL 및 snapshot의 hash를 유지하고 **0002_simplify_publication.sql / 0002_snapshot.json / journal**을 추가했다. 0002는 종류/순위 key CHECK 세 개를 추가하고 이름이 고정된 trigger 8개와 함수 4개를 제거한다. CASCADE나 IF EXISTS로 drift를 숨기지 않는다.
- **Node 22.23.3 / PostgreSQL 18.6: DB 통합 테스트 1 pass / fail 0 / skip 0.** 빈 클러스터에 세 migration을 설치·재실행하고 3개 hash, 0002 catalog **14 tables / 286 columns / 71 indexes / 12 FKs / 168 CHECKs / 6 enums**, 사용자 trigger 0/CD guard 함수 0을 확인했다. 임시 클러스터는 종료·삭제했다.
- 원천 업무키·미연결 종목·동일 일자 UPSERT·한국 자정/세션 시간대/토요일, 0·음수·NULL·상태·근거·당시 코드 재사용, 회사 완전성, ORM/DTO의 exact bigint/numeric은 DB 보장으로 재검증했다. 새 kind/scope/metric CHECK와 FK도 잘못된 행을 거부했다.
- **테스트 전용 writer**가 key 잠금/expected revision 확인과 최종 범위별 검증을 수행했다. 건수·포함수·계산 ID·날짜 불일치, revision/기준일 후퇴, 같은 revision의 다른 결과는 fixture writer 오류로 rollback됐다. DB trigger의 자동 거부로 기록하지 않는다.
- 최초 공개 경쟁, 기존 revision 경쟁, 공개 중 실패 rollback, 분리된 UPDATE 순서, 완전히 같은 결과의 DELETE/INSERT 재시도, REPEATABLE READ 동시 교체가 통과했다. fixture의 동일 결과 비교는 테스트 확인용이며 tem에 특정 JSON 비교 구현을 요구하지 않는다. 실제 tem 입력 fencing과 writer는 여전히 미검증이다.
- production `currentRankResultFilter/currentRankFilter`를 실제 ORM에 로드해, 헤더와 같은 revision이어도 rank_date가 다른 행을 숨겼다. 상세의 excluded 상태는 included 필터와 분리해 보존한다. CSV의 기존 included 건수 검사를 유지했다.
- **전체 단위/회귀 130 pass / fail 0 / skip 0**, `pnpm typecheck`, `pnpm db:check`, 이번 schema/조회/DB script ESLint와 diff 검사가 통과했다. UI 수정이 없어 별도 디자인 변경이나 브라우저 전체 조합을 반복하지 않았다.
- 실제 DCD를 지정한 Next.js 16.3.8 production standalone 빌드가 컴파일·타입 검사·정적 생성까지 exit 0으로 완료됐다. 초기 검색 JSON은 빈 DCD 명부다.

### 실제 DCD 후속 적용

사전 read-only 확인에서 `192.168.50.27:25433/dcd`, `silla`, PG18.6, 기존 적용 hash 두 개와 14개 업무 테이블 모두 0건을 확인했다. 동일 CLI로 **0002**를 적용했고 exit 0, 재실행도 no-op/exit 0이다. 0000/0001을 수정하거나 baseline·데이터 이전을 하지 않았다.

**2026-10-07 05:16:56 KST** 최종 read-only REPEATABLE READ 검증:

- 최종 0002 snapshot과 14개 테이블·286개 컬럼·71개 index·12개 FK·168개 CHECK·6개 enum을 대조했다.
- CD guard 함수 **0개**, public 사용자 trigger **0개**다. 내부 FK trigger는 유지되고 publication FK 세 개는 DEFERRABLE INITIALLY DEFERRED다.
- 모든 제약 validated, 모든 index valid/ready다. CHECK 전체 식의 독립적 의미 정규화 비교는 수행하지 않았고 이름/검증 상태/SQL hash를 확인했다. 신규 세 CHECK의 실제 정의도 기록했다.
- Drizzle 적용 이력은 세 개이며 로컬 SQL/journal과 모두 일치한다. 기존 두 hash는 위 최초 기록과 같다. 추가 0002 hash는 `2824fef82ae5387a28da5c4961aef206c76a28f8b92d8494a63e833c993b5dde`, journal created_at은 `1791317406439`다. 이 값은 생성 메타데이터이며 적용 시각이 아니다.
- 업무 테이블은 모두 0건이다. 합성 fixture·시장 자료를 실제 DCD에 넣지 않았고 PCD는 접속/적용하지 않았다.
- 개발 3001과 최종 standalone 3107에서 각 13건, **실제 HTTP 26건 통과**. HTML 10개는 200/미공개, 미공개 CSV 두 개는 404, 검색 JSON은 200/빈 배열이다. 헤더가 없는 상태를 정상 완료된 0건으로 표시하지 않았다.

검증용 standalone은 종료하고 개발 3001은 유지한다. 최종 적용·HTTP 증거는 [v2 실측 JSON](cd-dcd-verification-2026-10-07.json)에 보관했다. 운영 배포, 대규모 성능 측정, 실제 tem 원천/공식 계산 및 웹·CSV 대조는 수행하지 않았다. 제거된 O(N²) trigger의 이전 성능 측정을 현재 구조의 성능 결과로 사용하지 않는다.
