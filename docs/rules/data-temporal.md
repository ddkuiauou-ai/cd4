# 데이터·Temporal Rules

적용: `db/**`, `drizzle/**`, `lib/data/**`, `lib/static-build/**`, 금융 계산·CSV·검색 식별,
종목 lifecycle, tem의 입출력/상태/결과 연동을 바꾸거나 디버깅할 때.

## 책임과 실제 연결

| 영역 | 담당 |
| --- | --- |
| CD 서비스 앱 | 업무 schema·migration·DTO·조회·표시·선택 기간 평균/최소/최대/변화율 |
| 별도 tem | 원천 수집·정정·날짜별 종목 연결·공식 최신/마지막 제공값·회사 합계·순위 계산/검증/공개 |
| 연동 | tem이 업무 DB에 기록한 원천과 공개 헤더/결과를 CD가 읽음 |

- 직접 Temporal Client 호출·webhook·Workflow 상태 API는 이 저장소에서 확인되지 않았다.
  호출 계약을 상상해 문서화하거나 Worker·수집 코드를 앱에 복제하지 않는다.
- `result_publication`은 현재 업무 결과의 공개 헤더다. Temporal의 진행 중/재시도/실패
  상태를 뜻하지 않는다. Workflow 성공과 CD 화면 갱신 성공도 구분해 검증한다.
- 계약 변경은 CD의 schema/DTO/조회 변경과 tem 담당자의 writer/Workflow 변경을 분리한다.
  현재 요청에 다른 프로젝트 수정 권한이 없으면 근거·변경 필요·검증 항목을 인계한다.

## 보존할 저장·조회 계약

- [저장 계약 v2](../cd-business-schema-contract-2026-10-07.md)와
  [lifecycle 후속 계약](../security-lifecycle-contract-2026-10-13.md)을 읽되,
  현재 [schema](../../db/schema-postgres.ts)·[migration journal](../../drizzle/meta/_journal.json)과 대조한다.
  10월 7일의 0000→0002·테이블 수·빈 DCD 확인은 당시 기록이다.
  작업 트리의 후속 migration 존재를 실제 DB 적용 완료로 간주하지 않는다.
- 업무일은 Asia/Seoul 자정 및 DTO `YYYY-MM-DD`, 공개/갱신 시각은 실제 시점이다.
  UTC ISO 앞 10글자나 임의 +9시간으로 업무일·발행 시각을 만들지 않는다.
- bigint/numeric/revision·금융 DTO의 정확한 십진 문자열을 보존한다.
  원값을 JS Number로 손실 변환하지 않고 NaN/Infinity를 거부한다.
  유효한 0·음수, NULL과 상태, 최신 결측과 마지막 제공값을 별개로 취급한다.
- SQL은 snake_case, Drizzle/TypeScript는 camelCase 매핑을 따른다.
- [publication.ts](../../lib/data/publication.ts)의 read-only REPEATABLE READ와
  key/revision/calculationId·scope/metric/asOf 일치를 보존한다.
  미공개(헤더 없음), 공개 0건, 데이터 오류를 구분하고 실패를 성공 빈 값으로 저장하지 않는다.
  CSV의 미공개 404·revision 변경 409·포함 건수 검증은 [ranking-export.ts](../../lib/data/ranking-export.ts)를 따른다.
- 공식 회사 합계/순위를 화면에서 임의 재계산·제외하지 않는다.
  기간 분석은 실제 선택 이력으로 계산하고 표본/범위·값/기준일 쌍을 표시한다.
  CSV는 전체 대상·정확한 값·코드 선행 0·UTF-8 BOM을 보존한다.
- 코드당 하나의 SID, 별도 상장 기간·이름 사건·half-open 경계는 lifecycle 계약을 따른다.
  `?period=`를 이동 시 유지하고 과거 기간에 현재 공식값/순위/회사 합계를 섞지 않는다.
- DB 변경 전 실제 host/port/DB/계정과 쓰기 범위를 확인하되 비밀값은 출력하지 않는다.
  `DATABASE_URL` 우선순위와 CLI `.env`/Next `.env*` 차이는 [DB 안내](../postgresql.md)를 따른다.
  적용된 migration을 다시 쓰거나 schema push·임의 baseline으로 SQL 이력을 대체하지 않는다.

## Temporal 플러그인과 별도 프로젝트

- 관련 개발·디버깅·검증 전 `temporal:temporal-developer`의 실제 `SKILL.md`를 읽는다.
  SDK 언어와 작업을 확인해 해당 core/언어별 참조를 선택한다.
  결정성·재시도·버전/재실행 등 해당 변경에 필요한 절차를 적용한다.
- 현재 별도 checkout은 `/Users/craigchoi/tem`이다. 그곳의
  [AGENTS.md](../../../../tem/AGENTS.md), [CD 업무 규칙](../../../../tem/docs/cd-rules.md),
  [v2 운영 안내](../../../../tem/docs/cd-v2-operations.md)를 작업 시 다시 확인한다.
  이 로컬 상대 링크는 해당 배치를 전제로 하며 다른 clone에서는 실제 checkout을 찾는다.
- 확인된 tem 실행 환경은 Python `.venv`와 `cd_temporal.v2.runtime` Worker다.
  Workflow·Activity·Worker 구성/queue·실행·검증은 tem 문서에 두고 여기 복제하지 않는다.
  CD의 Bun 명령 규약을 Python Worker에 강제하지 않는다.
- Temporal CLI가 필요한 작업에서만 설치 여부와 실제 제공 명령을 확인한다.
  플러그인은 스킬 지침도 제공하며 별도 MCP 관리 도구의 존재나 live 연결 성공을 뜻하지 않는다.
  접근 불가 시 CD 측 DTO/SQL/fixture 확인을 진행하고 미확인 Workflow·통합 범위를 보고한다.

## 예외·인계·검증

- tem 현재 규칙은 정상 원문 artifact·전체 mapping snapshot·실행별 승인/hash 원장을
  요구하지 않는다. 오래된 CD 계약의 근거 보관 문구를 실행 승인 조건으로 되살리지 않는다.
  `source_ref/input_ref/rule_ref`는 현재 tem의 논리 참조 설명과 실제 schema를 대조한다.
  충돌하는 의미를 새로 확정하거나 컬럼을 삭제하지 말고 양쪽 근거와 필요한 결정을 인계한다.
- tem의 dcd 실제 저장/재수집 검증과 CD의 `test:db` 임시 PG18 검사는 별도다.
  임시 schema 생성·삭제 fixture를 dcd에 연결하지 않는다. CD 작업을 NPS·IS·pcd까지 확대하지 않는다.
- [검증 규칙](verification.md)의 관련 DTO·결측·공개·lifecycle 회귀를 실행한다.
  연동 변경은 tem 입력 → 저장 결과/헤더 → CD 응답/표시의 같은 날짜·값·revision을 확인한다.
  fixture 통과를 live 수집·계산·배포 성공으로 보고하지 않는다. 관련 교훈은 [L1·L2](../learnings.md)다.
