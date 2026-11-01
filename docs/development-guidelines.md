# CD 개발 지침 안내

공통 작업 원칙은 [AGENTS.md](../AGENTS.md)가 소유한다.
작업 대상 확인 → 관련 Rules 읽기 → 관련 [Learnings](learnings.md) 읽기 →
구현·검증 순서로 진행한다. 아래 링크는 명시적으로 읽는 경로이며 자동 import가 아니다.

| 작업 | 읽을 규칙과 참고 자료 |
| --- | --- |
| Next.js 페이지·서버 조회·라우트·SEO·캐시 | [앱·서버](rules/app-server.md), 설치된 Next.js의 `node_modules/next/dist/docs/` 관련 가이드 |
| 화면 설계·구현·검토, CSS, 탐색·차트 | [UI](rules/ui.md), [PRODUCT](../PRODUCT.md), [DESIGN](../DESIGN.md), 대상 Impeccable brief |
| DB·DTO·공식 값·순위·상장기·tem 연동 | [데이터·Temporal](rules/data-temporal.md), 해당 저장 계약 |
| test·lint·typecheck·빌드·정적 출력·CI | [검증](rules/verification.md), 실제 [package scripts](../package.json) |

여러 영역에 걸친 작업은 해당 규칙을 함께 읽는다. 예를 들어 CSV 변경은 데이터 계약과
화면 다운로드 동작, 정적/서버 출력 검증을 함께 확인한다.

## 유지하는 프로젝트 기준

- 국내 주식의 실제 숫자·전체 순위·기준일을 모바일에서 빠르게 읽고, SEO 유입과 CSV 다운로드를 지원한다.
- 기존 shadcn/ui 구성 요소를 먼저 확인한다. 현재 제품 방향·시각 토큰은 `PRODUCT.md`와
  `DESIGN.md`를 따르며, 과거 팔레트나 시안을 최신 사용자 결정 위에 적용하지 않는다.
- UI의 모바일·데스크톱, 라이트·다크, 키보드·터치·접근성 동작을 해당 변경 범위에서 확인한다.
- DB는 PostgreSQL·Drizzle, 조회·DTO는 `lib/data/`, 연결은 `db/`가 담당한다.
  `lib/select.ts`에는 기존 조회가 남아 있다. 과거 CRUD 4파일 제한을 새 규칙으로 적용하지 않는다.
- tem은 별도 프로젝트의 수집·정정·공식 계산·검증·공개를 담당한다.
  서비스 앱의 서버 기능과 화면 기간 분석을 tem Worker로 일괄 이관하지 않는다.
- 업무 날짜·정확한 숫자·결측·공개 revision의 의미를 보존한다.
  계약의 상세와 예외는 [데이터 규칙](rules/data-temporal.md)에서 찾는다.
- 비밀번호·전체 DB URL·토큰을 문서나 로그에 출력하지 않는다.
  실제 DB 변경·외부 배포는 현재 요청의 대상과 승인 범위를 확인한다.
- 문서는 변경한 기능·계약에 맞는 문서만 갱신한다. 과거 검사 결과와 현재 실행 결과를 구분한다.

## 도구와 실행

프로젝트 스크립트는 `bun run <script>`로 실행한다. 실제 정의와 필요한 환경은
[검증 규칙](rules/verification.md)을 먼저 읽는다. 테스트 스크립트의 Node 테스트 실행기,
Next.js 서버 런타임, 별도 Temporal 프로젝트의 Worker 런타임은 그대로 구분한다.

현재 `packageManager`, pnpm 잠금파일·CI·정적 빌드 내부 검사는 사용자 Bun 규약과
일치하지 않는 부분이 남아 있다. 이 문서 개편은 설정·잠금파일 전환이나 검증 완료가 아니다.
필요한 다음 작업과 실행 제한은 검증 규칙에 기록한다.

Temporal 작업은 해당 플러그인의 관련 스킬·도구, UX/UI 작업은 Impeccable을 사용한다.
접근할 수 없으면 로컬 확인 범위와 미확인 범위를 구분해 보고한다.
Context7이 제공되는 환경에서는 기술 문법 확인의 보조 도구로 사용할 수 있으나,
제품 결정·시장 규칙·DB 계약을 대신하는 근거로 삼지 않는다.

## 기존 문서와 학습

기존 종합 가이드의 상세 예시·개선 이력·과거 계획은
[보존본](archive/development-guidelines-2026-10-05.md)에 있다.
현행 규칙으로 채택되지 않은 과거 통합 계획·성능 수치·색상은 새 작업 지시가 아니다.
관련 교정의 검증된 원인은 [Learnings](learnings.md)에 근거와 함께 기록하고,
안정된 행동 규칙은 해당 Rules에 반영한다. 일회성 상태와 실행 로그는 날짜별 보고서에 둔다.
