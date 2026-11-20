# CD — 천하제일 단타대회

국내 주식의 시가총액·PER·PBR·EPS·BPS·배당수익률·주당배당금 전체 순위와
기업·종목 이력을 조회하고 CSV로 내려받는 Next.js 서비스 앱이다.
모바일에서 숫자를 빠르게 읽는 경험과 SEO 유입을 중시한다.
제품 목적은 [PRODUCT.md](PRODUCT.md), 시각 기준은 [DESIGN.md](DESIGN.md)에 있다.
실시간 거래·회원·포트폴리오·대회 참가 기능은 현재 제품 범위로 가정하지 않는다.

에이전트는 [AGENTS.md](AGENTS.md)에서 시작해 작업에 맞는 Rules와 Learnings를 읽는다.
사람을 위한 문서 경로는 [문서 안내](docs/README.md), 개발 절차는
[개발 지침](docs/development-guidelines.md)에 있다.

## 구조와 책임

| 경로·프로젝트 | 책임 |
| --- | --- |
| `app/`, `components/`, `hooks/` | App Router 페이지·서버 렌더링·메타데이터·클라이언트 상호작용 |
| `db/`, `drizzle/` | PostgreSQL 연결, Drizzle 업무 스키마, 버전별 migration |
| `lib/data/`, `lib/select.ts` | 공개 결과·원천 이력 조회, 정확한 DTO, 기존 조회 경로 |
| `lib/business-analysis.ts` 등 | 선택한 화면 기간의 평균·최소·최대·변화 분석 |
| `lib/static-build/`, `scripts/*static*` | 고정 입력 추출, 정적 HTML·공유 JSON·CSV·사이트맵 생성·검증 |
| 별도 `tem` 프로젝트 | 원천 수집·정정·당시 종목 연결, 공식 최신값·회사 합계·순위 계산·검증·공개 |

CD의 Next.js 서버는 조회·SSR·메타데이터·라우트를 처리한다. tem의 Workflow·Activity·Worker를
이 저장소에 복제하지 않는다. 연결 경로와 현재 계약은 [데이터·Temporal 규칙](docs/rules/data-temporal.md)에 있다.

## 실행과 검사

DB 조회를 사용하는 개발·서버 빌드에는 PostgreSQL 연결이 필요하다. [.env.example](.env.example)과 [DB 연결 안내](docs/postgresql.md#연결-환경변수)로 대상을 확인한다.
프로젝트 스크립트는 Bun으로 호출한다. 실행 전 [런타임·프로덕션 빌드 조건](docs/rules/verification.md#실행-환경)을 확인한다.

```sh
bun run dev
bun run test
bun run test:main
bun run lint
bun run typecheck
bun run build
bun run start
```

## 정적 출력과 서버 실행

두 모드를 지원한다. 정적 모드는 프리징된 PostgreSQL 입력을 한 번 추출한 뒤
비공개 파일 입력으로 페이지를 생성한다. 새 데이터는 재빌드·배포 후 공개된다.
서버 모드는 요청 시 DB 조회와 해당 캐시 정책을 사용한다.

```sh
bun run build:static
bun run verify:static
bun run preview:static
```

정적 미리보기는 `out/`만 제공하며 Next 서버나 DB를 사용하지 않는다.
업로드할 때는 `_headers`, 공유 자료, `_next/`, `.txt`·`__next.*` 탐색 파일을 포함한
전체 출력을 보존한다. 입력 추출·파일 형식·재사용 조건은 [정적 빌드 안내](docs/static-export.md)를 따른다.

기본 `build`는 standalone 출력을 생성한다. `start`는 통상적인 로컬 production 확인 명령으로,
standalone 경고가 발생할 수 있다. standalone 산출물을 직접 실행할 때는
`public`과 `.next/static`을 서버 산출물에 함께 패키징하고 Node로 실행한다.
[배포 안내](VERCEL_SETUP.md)의 모드별 설명도 현재 설정과 대조한다.

R2·Netlify는 별도 수동 배포 경로다. [배포 workflow와 로컬 실행 조건](docs/rules/verification.md#실행-환경)

## 데이터 계약

공식 값·회사 합계·순위의 공개 기준, 업무일·정확한 숫자·결측 처리는 [데이터 규칙](docs/rules/data-temporal.md)을 따른다. 종목 식별·상장기·기업 구성과 검색 대상은 [상장 기간 계약](docs/security-lifecycle-contract-2026-10-13.md#웹-조회)에 있다.

DB 접속 없이 migration 체인을 검사하려면 `bun run db:check`, 임시 PostgreSQL 18에서 저장 계약을 확인하려면 `bun run test:db`를 사용한다. 실제 DB 적용은 [설치 안내](docs/postgresql.md)를 따른다.

## UI와 기여

화면 작업은 [UI 규칙](docs/rules/ui.md)에서 시작한다. 변경 범위와 Git 위임은 [공통 작업 원칙](AGENTS.md#공통-작업-원칙), 재사용할 교훈은 [Learnings](docs/learnings.md)를 따른다.
