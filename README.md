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

선언 버전은 [package.json](package.json), Node 버전은 [.nvmrc](.nvmrc)를 확인한다.
Next.js 코드를 바꾸기 전에 설치된 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다.
PostgreSQL 연결 환경은 [.env.example](.env.example)과 [DB 안내](docs/postgresql.md)를 참고한다.
비밀값과 전체 연결 문자열을 출력하지 않는다.

사용자 지정 실행 규약은 **Bun으로 프로젝트 스크립트 실행**이다.
현재 `packageManager`·잠금파일·CI와 정적 빌드 내부의 pnpm 검사는 아직 일치하지 않는다.
기존 설치를 임의로 다시 만들거나 잠금파일을 바꾸지 말고
[검증 규칙의 실행 조건과 미정합](docs/rules/verification.md)을 먼저 읽는다.
아래는 실제 정의된 script 이름이며 Bun 설치 재현·전체 빌드 통과를 의미하지 않는다.

```sh
bun run dev
bun run test
bun run test:main
bun run lint
bun run typecheck
bun run build
bun run start
```

`test`·`test:main`은 기존 `node --test`를 실행한다. Bun 테스트 실행기로 교체하지 않는다.
DB 조회를 사용하는 개발·서버 빌드는 적절한 데이터 환경이 필요하다.
검사는 변경 범위에 맞게 선택하고, 실패·미실행·과거 성공을 구분한다.

## 정적 출력과 서버 실행

두 모드를 지원한다. 정적 모드는 프리징된 PostgreSQL 입력을 한 번 추출한 뒤
비공개 파일 입력으로 페이지를 생성한다. 새 데이터는 재빌드·배포 후 공개된다.
서버 모드는 요청 시 DB 조회와 해당 캐시 정책을 사용한다.

```sh
# 실행 전 검증 규칙에서 정적 빌드의 pnpm 내부 검사·데이터 조건을 확인
bun run build:static
bun run verify:static
bun run preview:static
```

정적 미리보기는 `out/`만 제공하며 Next 서버나 DB를 사용하지 않는다.
업로드할 때는 `_headers`, 공유 자료, `_next/`, `.txt`·`__next.*` 탐색 파일을 포함한
전체 출력을 보존한다. 입력 추출·파일 형식·재사용 조건은 [정적 빌드 안내](docs/static-export.md)를 따른다.
과거 검증 보고서의 pnpm 실행 예시는 당시 기록이며 현재 명령 규약은 위 검증 규칙이 우선한다.

기본 `build`는 standalone 출력을 생성한다. `start`는 통상적인 로컬 production 확인 명령으로,
standalone 경고가 발생할 수 있다. standalone 산출물을 직접 실행할 때는
`public`과 `.next/static`을 서버 산출물에 함께 패키징하고 Node로 실행한다.
[배포 안내](VERCEL_SETUP.md)의 모드별 설명도 현재 설정과 대조한다.

R2·Netlify CI는 기존 수동 `workflow_dispatch` 방식의 배포 경로이며 로컬 `build:static`과
단계가 다르다. 검사·빌드 성공은 외부 업로드나 운영 공개 성공을 뜻하지 않는다.
이 문서 개편은 workflow를 실행하거나 배포 설정을 바꾸지 않는다.

## 데이터 계약

- 공식 값·회사 합계·순위는 tem이 공개한 결과를 읽으며 CD가 재계산해 대체하지 않는다.
- 업무일은 Asia/Seoul 기준으로 해석한다. 큰 정수·numeric·revision은 JSON/CSV에서
  정확한 십진 문자열을 유지하고, 실제 0·음수와 NULL·미제공 상태를 구분한다.
- 최신 결측과 마지막 제공값, 미공개와 정상 공개 0건, 조회 실패를 서로 구분한다.
- [저장 계약](docs/cd-business-schema-contract-2026-10-07.md)과
  [상장기 계약](docs/security-lifecycle-contract-2026-10-13.md)을 실제 스키마·migration과 대조한다.
  오래된 문서의 테이블 수·migration 끝 번호를 현재 상태로 가정하지 않는다.
- migration은 versioned SQL과 journal을 따른다. schema push로 설치 이력·수동 SQL 제약을 대체하지 않는다.
  실제 DB 적용 전 대상·요청 범위를 확인한다.

`bun run db:check`는 migration 일관성 검사이고 `bun run test:db`는 전용 임시 PostgreSQL 18
클러스터의 계약 검사다. `db:generate`는 파일을 생성하며 `db:migrate`·`db:studio`는
설정된 DB에 연결한다. 환경 요구와 실행 범위는 [검증 규칙](docs/rules/verification.md)을 따른다.

2026-10-07 DCD 설치·빈 상태·HTTP 결과는 [당시 검증 기록](docs/cd-business-schema-verification-2026-10-07.md)에 있다.
현재 DB 내용·tem 실제 처리·운영 배포 성공은 별도로 확인해야 한다.

## UI와 기여

기존 shadcn/ui 구성 요소를 먼저 검토하고 [UI 규칙](docs/rules/ui.md)과 Impeccable을 사용한다.
가격 상승 빨강·하락 파랑의 의미를 유지하되 실제 토큰은 `DESIGN.md`와 소스를 따른다.
순위 이동·가격 등락·순위 식별색을 구분하고 모바일·데스크톱, 라이트·다크와 접근성을 검증한다.
테마는 첫 방문 기기 설정을 따르고 사용자의 수동 선택을 보존한다.

진행 중인 변경을 보존하고 요청과 관련된 파일만 수정한다. Git 작업은 현재 위임 범위를 따르며,
일반 commit·push 위임을 이력 재작성·작업 폐기 권한으로 확대하지 않는다.
확인한 교정과 실패 원인은 [Learnings](docs/learnings.md)에 근거·적용 범위·검증 상태와 함께 남긴다.
