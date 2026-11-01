# 도구·검증 Rules

적용: `tests/**`, `scripts/**`, 빌드/실행 환경·CI·검증 계획·완료 보고 및 지침 변경.
명령의 원본은 [package.json](../../package.json)이며 없는 스크립트를 추측하지 않는다.

## Bun 호출과 남아 있는 설정 차이

- 사용자 운영 기준에 따라 빌드와 프로젝트 스크립트는 `bun run <스크립트>`로 실행한다.
  `bun test`는 현재의 `node --test`와 다른 실행기다. 테스트 프레임워크를 교체하지 않는다.
  `bun run --bun` 등으로 Node 런타임까지 일괄 대체하지 않는다.
- 현재 `packageManager`는 pnpm@10.34.6, engines는 Node >=22.23.3 <23 / pnpm 10.x다.
  [.nvmrc](../../.nvmrc)는 Node 22.23.3, [pnpm-workspace.yaml](../../pnpm-workspace.yaml)도 Node를 고정한다.
  Bun lock/config는 없고 [pnpm-lock.yaml](../../pnpm-lock.yaml)이 기존 의존성 해석 기록이다.
- Bun 호출이 pnpm의 Node 자동 선택을 재현한다고 가정하지 않는다.
  실행 전 `bun --version`, `node --version`을 확인하고 기존 도구로 지원 Node를 선택한다.
  환경이 맞지 않으면 해당 검사의 제한을 보고하며 검사를 우회하지 않는다.
- [static-tools.cjs](../../scripts/static-tools.cjs)의 `runtimeInfo({ enforce: true })`는
  정확한 Node 22.23.3과 pnpm 10.34.6을 검사한다. build:static/benchmark:static은 Bun에서
  호출해도 이 내부 의존성이 남는다. pnpm 없는 Bun 전용 파이프라인으로 검증된 상태가 아니다.
- 의존성 설치·lockfile 전환은 스크립트 실행과 별도다. 없는 bun.lock을 전제로
  `bun install --frozen-lockfile` 성공을 약속하지 않는다. 설치가 필요하면 현행 lock/설정과
  전환 범위를 먼저 확인한다. 이번 지침 개편은 설치·lockfile/CI/런타임 마이그레이션을 수행하지 않는다.
- [Netlify](../../.github/workflows/deploy-netlify.yml)·[R2](../../.github/workflows/deploy-r2.yml)
  CI는 현재 pnpm 기반 `workflow_dispatch` 배포다. 자동 test/lint/typecheck 통과나 Bun CI를
  보장하지 않는다. 문서 검증을 위해 배포 workflow를 실행하지 않는다.

## 실제 명령과 확인 대상

| 명령 | 동작·조건 |
| --- | --- |
| `bun run dev` | Next 개발 서버; 기본 `-H 0.0.0.0`, 연결 대상과 포트를 먼저 확인 |
| `bun run build` | Next build; 기본 standalone, DB/환경 요구 확인 |
| `bun run start` | next start; 실제 standalone 엔트리 검증은 별도 서버 실행과 구분 |
| `bun run build:static` | 기존 Node 스크립트 `--full`; 동결 입력·내부 pnpm 검사·디스크 여유 필요 |
| `bun run preview:static` / `bun run verify:static` | 생성된 out 미리보기 / 계약·파일 검사 |
| `bun run benchmark:static` | 비용 있는 정적 비교; 성능 변경 등 필요할 때만 |
| `bun run sitemap` | 기존 sitemap 스크립트; 출력 모드·origin 확인 |
| `bun run test` | Node test runner로 `tests/*.test.cjs` |
| `bun run test:main` | 메인 캐시·dashboard 두 테스트 파일 |
| `bun run lint` / `bun run typecheck` | `eslint .` / `tsc --noEmit` |
| `bun run db:check` | DB 접속 없이 Drizzle migration chain 확인 |
| `bun run test:db` | 기존 스크립트의 독립 임시 PostgreSQL 18 계약 테스트 |
| `bun run db:generate` | schema/snapshot으로 SQL/meta 생성; diff 검토 필요 |
| `bun run db:migrate` / `bun run db:studio` | 실제 DB 변경/편집 가능; 요청 범위·대상 확인 후만 실행 |

개별 회귀는 설치된 Node로 `node --test tests/<실제 파일>.test.cjs`를 실행할 수 있다.
이는 기존 테스트 실행기를 유지하는 선택 실행이며 새 package 스크립트가 아니다.

## 변경별 최소 확인

- **문서·지침만:** 줄 수·상대 링크·실제 스크립트명·규칙 경로·중복/충돌·`git diff --check`.
  대표 작업의 읽기 순서를 추적하고, 새 세션 자동 주입과 직접 파일 읽기 검증을 구분한다.
- **로직/컴포넌트:** 관련 기존 테스트와 필요 시 lint/typecheck. 영향 범위가 넓으면 전체
  `bun run test`, `bun run lint`, `bun run typecheck`와 해당 출력 모드의 빌드를 수행한다.
  새 동작/실패 위험을 검증하는 테스트만 추가한다. 단순 변경에 구현을 복제한 테스트를 만들지 않는다.
- **공개/DTO:** `tests/business-results.test.cjs`, `tests/data-snapshot-contract.test.cjs`,
  `tests/ranking-csv.test.cjs`, lifecycle 변경은 `tests/security-lifecycle.test.cjs` 등 실제 관련 파일을 선택한다.
  값·기준일·0/NULL·큰 숫자·미공개/0건·revision 변경과 화면/CSV 일치를 확인한다.
- **schema/migration:** chain 검사와 필요 시 `test:db`. PG18 부재·권한·Node 미지원 실패를
  skip 성공으로 바꾸지 않는다. [DB 안내](../postgresql.md)를 읽고 실제 DB 설치와 격리 검사를 구분한다.
- **UI:** [Impeccable 규칙](ui.md)에 따라 모바일/데스크톱·두 테마·실제 탐색/검색/다운로드 등
  변경한 흐름을 브라우저에서 확인한다. DOM/단위 테스트만으로 화면 검증을 대신하지 않는다.
- **정적 출력:** [빌드 안내](../static-export.md)의 입력/출력 revision·표본 값·JSON/CSV·sitemap·이동을 확인한다.
  일부 경로 검증을 전체 export 완료로 보고하지 않는다. 빌드 중 사용자 원본 route를 삭제하지 않는다.
- **Temporal 연동:** [데이터 규칙](data-temporal.md)의 플러그인과 tem 프로젝트 검증 절차를 따르고
  CD 입출력·공개 결과까지 확인한다. Python Worker를 Bun으로 바꾸지 않는다.

## 예외와 보고

관련 검사가 통과하면 새로운 변경·실패·미해결 문제가 없는 한 전체 검사·benchmark를 반복하지 않는다.
환경/접근 문제로 실행하지 못했으면 검사명·이유·미확인 결과를 보고한다.
기존 실패와 자신의 변경으로 생긴 실패를 구분하고, lint ignore나 테스트 skip으로 숨기지 않는다.
명령 종료·파일 존재·과거 성공 기록만으로 제품 성공을 선언하지 않는다.
완료 보고에는 실제 동작·검사 결과·수행하지 않은 범위를 적고 재사용할 교훈은 [Learnings](../learnings.md)에 남긴다.
