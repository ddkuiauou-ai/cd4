# CD 문서 안내

새 작업은 [AGENTS.md](../AGENTS.md)를 진입점으로 삼는다.
현재 요청·작업 대상 확인 → 관련 Rules 선택 → 관련 Learnings와 근거 읽기 → 수행·검증 순서다.
링크된 상세 파일이 자동으로 로드된다고 가정하지 않는다.

## 현재 지침과 기준

| 문서 | 역할·읽는 조건 |
| --- | --- |
| [개발 지침](development-guidelines.md) | 사람을 위한 작업 경로, 기존 가이드와의 연결 |
| [앱·서버 규칙](rules/app-server.md) | 페이지·서버 조회·Route Handler·SEO·캐시 변경 |
| [UI 규칙](rules/ui.md) | UX/UI 설계·구현·검토, Impeccable 사용 |
| [데이터·Temporal 규칙](rules/data-temporal.md) | DB·DTO·공식 결과·상장기·tem 경계 변경 |
| [검증 규칙](rules/verification.md) | Bun 명령, test·lint·typecheck·빌드·DB·CI 조건 |
| [Learnings](learnings.md) | 관련 작업 시작 시 읽고, 확인한 교정·실패 수정 뒤 갱신 |
| [지침 개편 검증](agent-guidance-verification-2026-11-01.md) | 보존·이동·요구사항 대응과 읽기 경로 검증 결과 |
| [PRODUCT](../PRODUCT.md)·[DESIGN](../DESIGN.md) | 현재 사용자 제품 결정·시각 기준과 변경 이력 |

Bun 실행 규약과 아직 pnpm을 사용하는 package metadata·잠금파일·CI·정적 빌드 내부의
차이는 검증 규칙에 기록한다. 아래 과거 문서의 실행 예시나 검사 결과가 이 차이를 해소하지 않는다.

## 데이터·출력 계약

| 문서 | 역할 |
| --- | --- |
| [CD → tem 저장 계약 v2](cd-business-schema-contract-2026-10-07.md) | 업무키·날짜·정확한 숫자·결측·UPSERT·원자적 공개 계약 |
| [상장기·이벤트 계약](security-lifecycle-contract-2026-10-13.md) | 코드별 식별자·상장기·이벤트·기간 선택; 이전 식별자 전제를 대체 |
| [PostgreSQL 안내](postgresql.md) | 연결 우선순위·격리 검사·설치 이력; 실행 전에 현행 SQL/journal과 대조 |
| [정적 빌드 안내](static-export.md) | 파일 입력·HTML·공유 JSON/CSV·검증·미리보기; 명령 규약은 검증 Rules 우선 |
| [업무 스키마 변경 계획](cd-business-schema-web-plan-2026-10-07.md) | 기존 테이블과 공개 헤더를 선택한 당시 설계 근거 |

CD는 업무 스키마·DTO·조회·표시와 선택 기간 분석을 담당한다.
tem은 별도 프로젝트에서 수집·정정·공식 계산·검증·공개를 담당한다.
계약 문서의 날짜별 설치 결과를 현재 운영 상태로 해석하지 않는다.
최신 계약 변경과 진행 중인 migration은 실제 소스·작업 트리·tem 인수인계와 대조한다.

## 날짜별 구현·검증 기록

아래의 성공·실패·미확인 결과는 명시된 날짜·입력·코드·환경의 증거다.
현재 서비스·DB·Worker·배포 상태를 증명하거나 다음 작업을 자동 승인하지 않는다.

| 기록 | 확인 범위 |
| --- | --- |
| [2026-10-23 패키지 업데이트](next-upgrade-2026-10-23.md) | 당시 패키지·설치·fixture export·기존 lint/DB 제한 |
| [2026-10-23 반응형 헤더](responsive-header-2026-10-23.md) | 헤더 적용·검사 범위 |
| [2026-10-22 재무 지표 화면](records-room-financial-metrics-2026-10-22.md) | 지표별 표현·검증 |
| [2026-10-22 모바일 화면](records-room-mobile-2026-10-22.md) | 모바일 변경·검증 |
| [2026-10-21 기록실 구현](records-room-implementation-2026-10-21.md) | 실제 프런트엔드 적용·검사와 제한 |
| [2026-10-09 정적 빌드 검증](static-export-verification-2026-10-09.md) | 당시 전체 출력·측정·브라우저 결과; 운영 CDN 확인과 구분 |
| [2026-10-09 패키지 업데이트](next164-upgrade-2026-10-09.md) | 당시 설치 버전·단위 검사·서버 빌드 결과 |
| [2026-10-09 기존 화면 복원](frontend-restoration-2026-10-09.md) | 당시 28개 페이지 복원·조회·기간·CSV 검증 |
| [2026-10-07 스키마·DCD 검증](cd-business-schema-verification-2026-10-07.md) | 당시 신규 DB 설치·격리 writer·빈 상태·HTTP 검사; 실제 tem 통합과 구분 |
| [2026-10-07 DB 연결 진단](db-connection-diagnostic-2026-10-07.md) | 포트·연결·권한 단계의 구분; 후속 설치 전 기록 |
| [2026-10-05 사용자 교정 후 계획 대조](ui-plan-conformance-review-2026-10-05.md) | 메인 구조·0/결측·ID 선택·날짜·CSV·출력 모드 오류와 수정 |
| [2026-10-05 메인 복구](main-recovery-verification-2026-10-05.md) | 웹 조회 오류/빈 값·날짜와 격리 Temporal 회귀의 구분 |
| [2026-10-05 랭킹 수정](ranking-fix-verification-2026-10-05.md) | 순위 기준일·업데이트 시각·재처리 범위 검증 |
| [2026-10-05 Next.js 업그레이드](next16-upgrade-verification-2026-10-05.md) | 당시 서버 빌드·제한 정적 export 검증 |

성능 수치·테스트 개수·DB 행 수·실행 중 포트는 재확인 없이 현재 값으로 보고하지 않는다.
미실행·실패·skip은 통과와 구분한다. 합성 fixture나 격리 writer 검증을 실제 tem 데이터 처리·운영
공개 완료로 확대하지 않는다. 일회성 작업 상태는 날짜별 보고서, 재사용할 근거 있는 교훈은 Learnings에 둔다.

## 초기 조사·보존 자료

- [프로젝트 현황](project-current-state.md), [DAG 연동 조사](dag-integration.md),
  [업그레이드 인수인계](upgrade-handoff.md)는 초기 구조와 판단 근거다.
- [Next.js 16 초기 평가](next16-upgrade-assessment-2026-10-05.md),
  [의존성 조사](next16-dependency-audit-2026-10-05.json),
  [검사 기준선](next16-baseline-2026-10-05.json)은 업데이트 전 자료다.
- [기존 개발 지침 보존본](archive/development-guidelines-2026-10-05.md)은 과거 예시·개선 이력이다.
  과거 팔레트·CRUD 파일 제한·pnpm-only 규칙·미실행 통합 계획을 현재 지침으로 적용하지 않는다.
- [기술 명세](spec.md), [서비스 문서](service.md), [UI 문서](ui.md),
  [시장 분석](market-analysis.md), [Vercel 안내](../VERCEL_SETUP.md)는 과거 구조·예시가 남아 있다.
  현행 Rules·PRODUCT·DESIGN과 실제 소스로 확인한 부분만 사용한다.
- 과거 `../../dag/...` 링크는 형제 DAG checkout을 전제한다. 현재 별도 tem의 위치와
  담당 범위는 [데이터·Temporal 규칙](rules/data-temporal.md)에서 확인한다.

현재 구현·버전·배포 설정은 실제 소스, `package.json`, 잠금파일, workflow로 확인한다.
제품 의도는 사용자 결정이 기준이며 제안·시안 승인·구현·검증·배포·사용자 수락을 구분한다.
문서의 라인 번호는 조사 시점의 위치이므로 후속 작업에서는 함수명·설정 키도 함께 찾는다.
