# 에이전트 지침 개편 검증 — 2026-11-01

범위: cd4의 지침·문서만 개편했다. 제품 기능·패키지/CI 설정·DB·tem 파일·사용자 전역 설정은
변경하지 않았다. branch/commit/push/PR·배포도 수행하지 않았다.
조사에서 확인한 차이를 현재 구현 완료로 포장하지 않는다.

## 조사와 구조 결정

- 기존 진입점은 9줄 `AGENTS.md`의 Next.js 관리 블록이었다.
  CLAUDE.md·하위 AGENTS·기존 Rules/Skills/Learnings는 저장소에서 찾지 못했다.
  `.github/copilot-instructions.md`, README, 종합 개발 지침과 날짜별 설계/검증 기록을 조사했다.
  `.impeccable/`의 config/design·surface·review 자료도 확인했다.
- 단일 서비스 앱이므로 공통 원본은 루트 AGENTS, 범위별 규칙은 `docs/rules/` 네 파일로 나눴다.
  서로 다른 디렉터리를 가로지르는 UI·데이터·정적 빌드 작업은 조건 표로 함께 선택한다.
  현재 쓰이지 않는 CLAUDE.md나 도구별 paths 설정은 추가하지 않았다.
- package scripts·Node/pnpm 설정·배포 workflow·실제 조회/DTO/publication·정적 생성 소스를 대조했다.
  별도 `/Users/craigchoi/tem`의 AGENTS·CD 규칙·v2 운영 문서는 읽기 전용으로 확인했다.

## 기존 지침의 보존·통합·이동

| 기존 내용 | 처리와 현재 위치 |
| --- | --- |
| Next.js bundled docs 필독·자동 생성 블록 | [AGENTS](../AGENTS.md) 안에 원문 그대로 보존; 설치된 generate-agent-files.js와 대조 |
| 제품 목적·사용자 승인·현재 디자인 | PRODUCT·DESIGN 원본 무수정; [UI Rules](rules/ui.md)에서 우선 참조 |
| shadcn 우선·모바일·접근성·데이터 정확성·SEO·보안 | 관련 [앱](rules/app-server.md)·[UI](rules/ui.md)·[데이터](rules/data-temporal.md) Rules로 통합 |
| 긴 개발 예시·개선 이력·과거 계획 | [개발 지침 보존본](archive/development-guidelines-2026-10-05.md); 원문 593줄과 이동 링크 보존 |
| Copilot의 중복 규칙 | [.github/copilot-instructions.md](../.github/copilot-instructions.md)는 AGENTS를 읽도록 연결 |
| Next 15·dark default·CRUD 4파일 제한·pnpm-only | 현행 지침에서 제거; 실제 소스·PRODUCT·Bun 호출 기준으로 교체 |
| README의 서버 전용/정적 지원 모순·현재 빈 DB 주장 | [README](../README.md)와 [문서 색인](README.md)에서 모드/역할·날짜별 기록으로 분리 |
| 설치·정적·배포 실행 안내 | [PostgreSQL](postgresql.md)·[정적 빌드](static-export.md)·[Vercel](../VERCEL_SETUP.md)에 Bun 호출과 남은 제약 표시 |
| 구 spec/service/ui/market-analysis의 예시 | 파일 보존, 현행 기준 안내 추가; 실시간·API·UI 단일 원본 등의 잘못된 적용 방지 |
| 저장·lifecycle 계약 | 원문 유지, 저장 계약에 현행 Rules 연결; 식별자 후속 계약·tem 운영 차이를 대조하도록 명시 |
| 확인된 사용자 교정·실패 수정 | [Learnings](learnings.md) L1~L3에 발생 조건·원인/근거·다음 행동·범위·검증 상태로 이관 |

## 요구사항별 반영 위치

| 요청 | 반영 |
| --- | --- |
| 1. 기존 프로젝트 조사 | 위 조사·보존 표, 실제 scripts/CI·tem 경계를 각 Rules에 기록 |
| 2. 짧은 진입점 | AGENTS 104줄; 목적/제약 → 필수 → 작업 원칙 → 도구/검증 → 읽기 경로 |
| 3. 여섯 원칙 | AGENTS의 Think before coding부터 Continuous learning까지; 실제 Bun/플러그인 절차는 Rules |
| 4. 범위별 Rules | 네 파일 각각 적용 경로/조건·행동·예외·확인 방법; 명시적 선택 읽기 |
| 5. Learnings 운영 | 시작 시 키워드 검색·관련 근거 읽기, 수정/검증 후 기록, 중복 통합·Rules 승격·대체 범위 |
| 6. Git 분담 | AGENTS의 현재 위임 범위·동일 승인 재확인 금지·미정 범위 처리·기존 변경 보존 |
| 7. 결과 검증 | verification Rules의 실제 Bun script 표와 변경별 최소 확인·미실행 보고 |
| 8. 개편 자체 검증 | 아래 링크/스크립트/관리 블록/보존 검사와 독립 읽기 추적 |

## 로딩 방식과 대표 작업 추적

[공식 Codex AGENTS 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md)에 따르면
지침은 실행 시작 시 루트부터 작업 디렉터리까지 발견·결합된다. 임의 Markdown 링크를
조건부 import로 간주하지 않았다. `docs/rules/*.md`와 Learnings는 AGENTS가 명시적으로
찾아 읽게 하는 경로이며 모든 상세 파일을 상시 로드하지 않는다.

| 대표 작업 | 읽는 경로·확인 기준 |
| --- | --- |
| `components/ranking-page-view.tsx` 탭/배치 | AGENTS → UI Rules → PRODUCT/DESIGN·해당 brief → L2/L3 → verification; Impeccable context/playbook·브라우저 상호작용 |
| `lib/data/ranking-export.ts` revision/CSV | AGENTS → 데이터 Rules → 저장/lifecycle 계약 → L1/L2 → verification; 서버 응답 변경이면 앱 Rules, tem 영향이면 해당 스킬·별도 지침 |
| 정적 빌드 검증 | AGENTS → verification·앱·데이터 Rules → static-export 안내 → L1/L2/L3; Bun 호출과 Node/pnpm guard·동결 입력·출력 모드 구분 |

독립 서브에이전트를 대화 이력 전달 없이 시작했다. 첫 파일 읽기 전에 입력의
`# AGENTS.md instructions for /Users/craigchoi/silla/cd4`에 새 제목·여섯 원칙·Git·Bun 표·
Rules 경로가 포함된 개편 AGENTS 전체가 주입된 것을 확인했다.
그 후 위 대표 작업의 Rules·Learnings를 실제 읽어 경로를 검증했다.
이는 **이 환경의 새 Codex 서브에이전트 시작 시 주입 확인**이다.
독립 CLI·다른 도구·새 데스크톱 채팅의 시작은 별도 실행하지 않았다.

## 플러그인 확인 범위

- Temporal: 제공된 `temporal:temporal-developer` SKILL.md(0.4.3)를 읽어 SDK별 참조·
  결정성/재시도/검증·CLI 확인 절차를 연결했다. CLI 경로도 존재했다.
  별도 Temporal MCP 도구는 이 세션 도구 목록에서 확인되지 않았다.
  실제 Workflow 실행·Worker/서버 시작·live 연결·운영 검증은 수행하지 않았다.
- Impeccable: 제공된 `impeccable:impeccable` SKILL.md(4.3.1)의 context·대상 playbook·
  craft-floor·실패 시 직접 맥락 읽기 절차를 반영했다.
  이번은 지침 개편이므로 context 런처·디자인 편집·UI audit·브라우저를 실행하지 않았다.
- 오래된 `.impeccable/surfaces/app-market-page-tsx.md`의 황금 전광판/나눔명조 설명은
  최신 PRODUCT/DESIGN·10월 30일 ranking review brief와 다르다.
  UI Rules에 최신 결정 우선·충돌 보고를 명시했으며 기존 Impeccable 파일은 수정하지 않았다.

## 검사 결과와 남은 범위

- 변경·신규 파일 20개 모두 Markdown이다. 진입점은 104줄·8,242 bytes다.
  로컬 링크 214개 대상 존재 확인, 문서의 Bun 호출 17종을 package scripts와 대조해 모두 통과했다.
  기존 외부 참고 링크 12개 전체의 가용성은 재검증하지 않았다. Codex 로딩 공식 문서는 직접 확인했다.
- Git 원본과 비교해 Next.js 관리 블록이 동일하며, 종합 개발 지침 원문 593줄도
  보존본에서 상대 링크 이동을 제외하고 동일함을 확인했다.
- 작업 전 수정/미추적 상태였던 사용자 파일 38개의 SHA-256이 그대로였다.
  제품·설정·schema·테스트·PRODUCT/DESIGN 변경을 보존했다.
- `git diff --check` 통과. 별도 리뷰에서 발견한 상세 CSV의 `start/end`와 상장기 `period`
  혼동, PostgreSQL 문서의 미구현 period 문구도 실제 구현에 맞춰 수정했다.
- Bun 1.4.2는 존재하지만 현재 기본 `node`는 v24.21.0으로 저장소의 22.23.3과 다르다.
  문서 검사 외 제품 build/test/lint/typecheck·PG18·Temporal·브라우저 검사는 실행하지 않았다.
  이 개편을 Bun 빌드·설치·CI 전환 검증으로 보고하지 않는다.
- 후속 별도 범위: packageManager/lockfile/CI/정적 내부 pnpm 의존성의 Bun 정합화,
  실제 DB migration 적용 상태·tem 통합·운영 배포 확인, 양 프로젝트의 근거 참조 의미 대조.
  이번 요청으로 다른 프로젝트의 구현이나 사용자 전역 설정을 변경하지 않는다.
