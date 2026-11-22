# CD 에이전트 진입 지침

CD(천하제일 단타대회)는 국내 주식의 전체 순위·기업/종목 지표·이력·CSV를 제공하는 Next.js 앱이다.
모바일에서 숫자를 읽고 다음 종목을 찾는 동선과 SEO를 지킨다. 제품 범위는 [PRODUCT](PRODUCT.md), 승인된 화면은 [DESIGN](DESIGN.md)을 따른다.
CD는 업무 DB를 조회해 화면을 제공하고, 별도 `tem`은 수집·정정·공식 계산·검증·공개를 담당한다.

## 작업을 시작할 때

`git status --short`와 관련 diff를 확인한다. 아래에서 작업에 해당하는 규칙을 함께 읽고, [Learnings](docs/learnings.md)에서 작업 키워드를 검색한다.
작업 범위가 바뀌면 해당 규칙을 추가로 읽는다. 링크된 파일은 직접 열어야 한다.

| 작업 대상 | 먼저 읽을 문서 |
| --- | --- |
| `app/**`, Next.js 설정, 서버 조회·캐시·SEO·Route Handler·정적 export | [앱·서버 규칙](docs/rules/app-server.md) |
| 화면·CSS·`components/**`·`hooks/**`의 설계·구현·검토 | [UI 규칙](docs/rules/ui.md) · `impeccable:impeccable` |
| `db/**`, `drizzle/**`, `lib/data/**`, `lib/static-build/**`, 금융값·CSV·종목 식별·tem 연동 | [데이터 규칙](docs/rules/data-temporal.md) · Temporal 작업은 `temporal:temporal-developer` |
| `tests/**`, `scripts/**`, 빌드·CI·검사 선택·완료 보고 | [검증 규칙](docs/rules/verification.md) |
| 지침·계약 문서 정리 | [문서 안내](docs/README.md) · 해당 분야 규칙 · [문서 검증](docs/rules/verification.md#변경별-최소-확인) |

기업·종목 상세를 변경할 때는 [상세 화면 brief](.impeccable/surfaces/components-detail-surface-tsx.md)의 화면별 순서, 종목별 제공 상태, CSV 범위와 서버·정적 검수 기준을 함께 읽는다.

## 공통 작업 원칙

- 성공 조건을 먼저 정한다. 해석에 따라 결과가 크게 달라질 때만 확인하고, 요청을 충족하는 가장 단순한 변경에 집중한다.
- [package.json](package.json)의 프로젝트 스크립트는 `bun run <스크립트>`로 호출한다. 설치·Node/pnpm·CI 조건은 검증 규칙을 따른다.
- 날짜·정확한 숫자·결측·공개 상태·종목 식별 계약을 보존한다. 비밀값은 로그·문서·클라이언트·정적 산출물에서 제외한다.
- 기존 수정과 미추적 파일을 보존한다. Git 작업은 현재 요청과 기존 위임 범위에서 변경 내용·branch·remote·검증을 확인하고 수행한다. 이력 재작성·작업 폐기에는 별도 위임이 필요하다.
- DB 접근·쓰기·배포는 요청한 대상과 범위에서 수행한다. 다른 프로젝트나 전역 설정 변경은 별도 범위다. 위임한 조사·수정은 읽기 전용 또는 겹치지 않는 파일로 나눠 통합 검토한다.
- 변경에 맞는 검사를 수행하고 실제 결과·기존 실패·미확인 범위를 구분해 보고한다. 도구 접근이 막히면 가능한 로컬 확인을 진행하고 한계를 밝힌다.
- 사용자 교정이나 반복 가능한 실패는 수정·검증한 뒤 [교훈 정리 방법](docs/learnings.md#교훈을-정리할-때)에 따라 해당 기준 문서와 근거를 연결한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
