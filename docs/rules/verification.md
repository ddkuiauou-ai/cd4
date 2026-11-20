# 도구·검증 Rules

## 실행 환경

- [package.json](../../package.json)의 스크립트를 `bun run <스크립트>`로 호출한다. Next.js와 `node --test`는 기존 Node 런타임으로 실행한다. 설치·lockfile·CI 전환은 별도 변경이다.
- 실행 전 `bun --version`·`node --version`을 확인한다. Node는 [.nvmrc](../../.nvmrc)·[pnpm 설정](../../pnpm-workspace.yaml), 의존성은 [pnpm 잠금파일](../../pnpm-lock.yaml)을 따른다. 전체 정적 빌드·벤치마크의 [내부 검사](../../scripts/static-tools.cjs)는 Node 22.23.3과 pnpm 10.34.6을 요구한다.
- **프로덕션 빌드 전** `NODE_ENV`를 확인한다. 개발 셸에서 `development`가 상속됐다면 해당 실행에서 해제하거나 `production`으로 지정한다. `bun run build`와 `bun run build:static` 모두에 적용한다.
- [Netlify](../../.github/workflows/deploy-netlify.yml)·[R2](../../.github/workflows/deploy-r2.yml)는 pnpm 기반 수동 배포다. 배포 workflow는 배포 요청 범위에서 실행한다.

## 명령 선택

| 목적 | 명령과 조건 |
| --- | --- |
| 개발·서버 빌드·시작 | `bun run dev`는 기본 `-H 0.0.0.0`이므로 연결 대상·포트를 확인한다. `bun run build`는 기본 standalone이고 DB 환경이 필요할 수 있다. `bun run start`는 `next start`다. |
| 전체 정적 출력 | `bun run build:static`은 동결 입력·디스크 공간이 필요하다. 생성한 out은 `bun run preview:static`과 `bun run verify:static`으로 확인한다. |
| 정적 성능·SEO | 성능 비교는 `bun run benchmark:static`, 사이트맵은 출력 모드와 origin을 확인한 뒤 `bun run sitemap`을 사용한다. |
| 단위·회귀 | `bun run test`는 Node로 `tests/*.test.cjs`를 실행한다. `bun run test:main`은 메인 캐시·대시보드 두 파일이다. 개별 회귀는 `node --test tests/<파일>.test.cjs`로 선택한다. |
| 정적 분석 | `bun run lint`는 ESLint, `bun run typecheck`는 TypeScript 검사다. |
| 스키마 검증 | `bun run db:check`는 DB 접속 없이 migration 체인을, `bun run test:db`는 독립된 임시 PostgreSQL 18에서 계약을 검사한다. |
| 스키마 변경 | `bun run db:generate`는 SQL·메타데이터를 생성하므로 diff를 검토한다. `bun run db:migrate`와 `bun run db:studio`는 실제 DB를 변경할 수 있어 대상과 요청 범위를 먼저 확인한다. |

## 변경별 최소 확인

| 변경 | 확인할 결과 |
| --- | --- |
| 문서·지침 | 변경 전후 분량·diff·상대 링크와 절·명령·중복 또는 충돌·`git diff --check`를 확인한다. 대표 작업이 진입점에서 최종 기준과 근거까지 이어지는지 읽어 본다. 새 세션의 자동 주입 여부는 별도 확인 사항이다. |
| 로직·컴포넌트 | 관련 회귀부터 실행하고 필요에 따라 lint·typecheck를 더한다. 영향이 넓으면 전체 테스트·lint·typecheck와 해당 출력 모드 빌드를 실행한다. 새 테스트는 기존 검사가 놓칠 동작·실패 위험을 대상으로 한다. |
| 공개 결과·DTO | 관련 business-results, data-snapshot-contract, ranking-csv, security-lifecycle 회귀를 선택한다. 값·기준일·0/NULL·큰 수·미공개/0건·revision 변경과 화면/CSV 일치를 확인한다. |
| 스키마·migration | 체인 검사와 필요한 격리 PG18 검사를 수행한다. 지원 환경 부재나 권한 실패를 명시한다. 실제 업무 DB 적용 여부는 [DB 안내](../postgresql.md)에 따라 확인한다. |
| UI | [UI 규칙](ui.md#구현과-확인)에 따라 변경한 흐름을 실제 브라우저에서 확인한다. |
| 정적 출력 | [출력 계약](../static-export.md)에 따라 동결 입력과 출력의 revision·표본 값·JSON/CSV·사이트맵·이동을 대조한다. 빌드는 격리 작업 폴더에서 수행하고 표본·전체 범위를 명시한다. |
| Temporal 연동 | [데이터 규칙](data-temporal.md#db-변경과-tem-연동)에 따라 tem 입력부터 CD 응답까지 같은 공개 결과를 대조한다. |

통과한 검사는 후속 변경·실패·미해결 문제가 있을 때 다시 실행한다. 실제 확인 결과와 기존 실패, 환경 때문에 확인하지 못한 범위를 기록한다. lint ignore나 테스트 skip으로 실패를 숨기지 않는다.
