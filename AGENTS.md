# CD 에이전트 진입 지침

CD(천하제일 단타대회)는 국내 주식의 전체 순위·기업/종목 지표·이력과 CSV를 제공한다.
모바일에서 숫자를 빠르게 확인하고 다른 종목을 탐색하는 경험과 SEO를 지킨다.
이 저장소는 Next.js 서비스 앱이다. `app/`, `components/`, `lib/data/`, `db/`,
`scripts/`가 화면·서버 조회·정확한 DTO·스키마·정적 빌드를 담당한다.
별도 `tem` 프로젝트는 수집·정정·공식 계산·검증·공개를 담당한다.
현재 연동은 공용 업무 DB의 저장/공개 계약이며 직접 Workflow 호출은 확인되지 않았다.

빌드와 프로젝트 스크립트는 **Bun으로 호출**한다. 다만 저장소의 pnpm 설정·CI와
정적 빌드 내부의 Node/pnpm 검사에는 전환되지 않은 부분이 있다.
이를 숨기거나 이번 지침을 근거로 lockfile·실행기를 바꾸지 말고 [검증 규칙](docs/rules/verification.md)을 따른다.

## 필수 규칙

- 제품 방향과 승인된 디자인은 [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md)가 기준이다.
  실시간성·거래·회원·포트폴리오·실제 대회 기능을 근거 없이 추가하거나 주장하지 않는다.
- CD의 Next.js 서버 기능과 tem의 데이터 처리를 구분한다.
  앱마다 Temporal을 설치하거나 수집·공식 순위 계산을 복제하지 않는다.
- 날짜·정확한 숫자·결측·공개 상태·종목 식별 계약을 보존한다.
  구체적인 기준은 [데이터·Temporal 규칙](docs/rules/data-temporal.md)을 읽는다.
- 비밀값을 로그·문서·클라이언트·정적 산출물에 노출하지 않는다.
  DB 접근·쓰기·배포는 해당 요청의 범위와 대상에 맞춰 수행한다.
- 작업 전 `git status --short`와 관련 diff를 확인한다. 기존 수정·미추적 파일을 보존하며
  무관한 파일의 reset/checkout/clean·포맷 변경을 하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 일반 작업 원칙

1. **Think before coding:** 중요한 가정과 모호성을 확인한다. 해석에 따라 결과가 크게
   달라질 때만 선택지와 영향을 확인하고, 명확한 작은 작업은 바로 진행한다.
2. **Simplicity first:** 요청을 충분히 해결하는 가장 단순한 구현을 선택한다.
   요청하지 않은 기능·추측성 확장·불필요한 추상화를 추가하지 않는다.
3. **Surgical changes:** 각 변경을 요청과 연결한다. 무관한 리팩터링·dead code 정리를
   섞지 않는다. 별개 문제는 보고하고, 자신의 변경으로 생긴 불필요한 부분만 정리한다.
4. **Goal-driven execution:** 요청을 관찰 가능한 성공 조건으로 바꾸고 필요한 구현과
   확인 절차를 정한다. 작업 규모·위험에 맞게 계획과 테스트를 선택한다.
5. **Tool overrides:** 실제 `package.json` 스크립트를 Bun으로 호출한다.
   Temporal 작업은 `temporal:temporal-developer`, UX/UI 작업은 `impeccable:impeccable`
   스킬과 제공 도구를 확인해 사용한다. 접근 실패 시 로컬 확인과 미확인 범위를 밝힌다.
6. **Continuous learning:** 사용자 교정이나 재사용 가능한 실패 원인을 확인하면 먼저
   수정·검증하고 [Learnings](docs/learnings.md)에 근거와 다음 행동을 남긴다.

### Git과 위임

- 이 저장소에서 고정된 수동 전용/자동 Git 위임 규칙은 확인되지 않았다.
  현재 요청·이전 명시적 위임 범위에 따라 branch·commit·push·PR을 수행할 수 있다.
- 승인된 동일 범위를 반복해서 묻지 않는다. 미정 범위는 실제 Git 작업이 필요할 때만
  확인하며, 지침 개편 승인을 모든 원격 작업의 위임으로 해석하지 않는다.
- 실행 전 변경 내용·대상 branch/remote·관련 검증을 확인하고 사용자 변경을 섞지 않는다.
  일반 commit/push 위임은 이력 재작성·작업 폐기까지 포함하지 않는다.
- 병렬 위임은 읽기 전용 조사 또는 겹치지 않는 파일 범위로 나누고 결과를 통합 검토한다.
  다른 프로젝트의 지침·구현·사용자 전역 설정 변경은 별도 범위다.

## 도구와 검증 명령

명령 원본은 [package.json](package.json)이다. `bun run`은 호출 방식이며,
Node 기반 Next.js·`node --test` 및 tem의 Python Worker 실행 환경을 교체하지 않는다.
설치/Node 버전/정적 빌드 제약과 검사 선택은 [검증 규칙](docs/rules/verification.md)에 있다.

| 목적 | 실제 스크립트 호출 |
| --- | --- |
| 개발 / 서버 빌드 / 시작 | `bun run dev` / `bun run build` / `bun run start` |
| 전체 정적 빌드 / 미리보기 / 검증 | `bun run build:static` / `bun run preview:static` / `bun run verify:static` |
| 단위·회귀 / 메인 범위 | `bun run test` / `bun run test:main` |
| 린트 / 타입 검사 | `bun run lint` / `bun run typecheck` |
| migration chain / 격리 PG18 계약 검사 | `bun run db:check` / `bun run test:db` |

변경과 관련 있는 검사부터 실행한다. UI는 Impeccable 검토와 실제 브라우저 상호작용,
데이터 연동은 입출력·공개 상태·revision·결과 전달을 확인한다.
실행하지 못한 검사·기존 실패·현재 변경의 실패를 구분하고 완료로 보고하지 않는다.
문서만 바꾸면 링크·스크립트명·규칙 적용 경로·diff를 검사하며 제품 빌드를 의무화하지 않는다.

## Rules·Learnings 읽는 경로

**작업 대상 확인 → 아래에서 관련 Rules 읽기 → 관련 Learnings 검색·읽기 → 수행·검증** 순서다.
여러 영역에 걸치면 해당 규칙을 함께 읽는다. 폴더를 바꾸거나 새 영역을 수정하기 전 다시 선택한다.

| 적용 경로 또는 작업 조건 | 읽을 규칙 |
| --- | --- |
| `app/**`, 서버/클라이언트 경계, SEO, Route Handler, 정적 export | [앱·서버](docs/rules/app-server.md) |
| `components/**`, `hooks/**`, CSS·화면·UX/UI 설계·구현·검토 | [UI·Impeccable](docs/rules/ui.md) |
| `db/**`, `drizzle/**`, `lib/data/**`, `lib/static-build/**`, 금융/CSV/식별 로직, tem 연동 | [데이터·Temporal](docs/rules/data-temporal.md) |
| `tests/**`, `scripts/**`, build·lint·typecheck·CI·검증 계획·완료 보고 | [도구·검증](docs/rules/verification.md) |
| 지침·문서 개편 | 이 문서 → [문서 안내](docs/README.md) → 관련 규칙·[개편 검증 기록](docs/agent-guidance-verification-2026-11-01.md) |

- 작업 시작 시 `rg -n '작업 키워드' docs/learnings.md`로 관련 항목을 찾고 본문·근거를 읽는다.
  새 교훈은 수정 후 갱신한다. 안정된 교훈은 Rules로 승격하고 Learnings에 근거 연결을 남긴다.
- `docs/rules/*.md`는 수동으로 선택해 읽는 문서다. 파일명이나 Markdown 링크만으로
  조건부 자동 로딩·자동 기억이 생기지 않는다. 모든 상세 파일을 항상 import하지 않는다.
- Codex는 시작 시 저장소 루트부터 작업 디렉터리까지 `AGENTS.md` 계열을 탐색한다.
  현재 공통 원본은 이 파일 하나이며 별도 `CLAUDE.md`나 paths 설정은 만들지 않는다.
  자세한 로딩 근거·새 세션 검증 여부는 개편 검증 기록에 구분한다.
- [README](README.md)는 실행 안내, [문서 안내](docs/README.md)는 계약·설계·날짜별 증거의 색인이다.
  날짜가 있는 성공 기록을 현재 상태나 후속 작업의 승인으로 재사용하지 않는다.
