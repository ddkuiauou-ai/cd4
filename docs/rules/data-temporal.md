# 데이터·Temporal Rules

## 책임과 실제 연결

CD는 업무 스키마·migration·조회·DTO·표시와 선택 기간 분석을 담당한다. 별도 tem은 수집·정정·날짜별 종목 연결·공식 최신값과 마지막 제공값·회사 합계·순위 계산·검증·공개를 담당한다.
연결점은 공용 업무 DB다. CD에서 직접 호출하는 Workflow·webhook은 확인되지 않았다. `result_publication`은 업무 결과의 공개 헤더이며 Worker 실행 상태는 tem에서 확인한다.

## 보존할 저장·조회 계약

- [저장 계약](../cd-business-schema-contract-2026-10-07.md)과 [상장기 계약](../security-lifecycle-contract-2026-10-13.md)을 [현재 스키마](../../db/schema-postgres.ts)·[migration journal](../../drizzle/meta/_journal.json)과 대조한다. SQL은 snake_case, Drizzle/TypeScript는 camelCase다.
- 업무일은 Asia/Seoul 자정과 DTO `YYYY-MM-DD`, 공개·갱신 시각은 실제 시점으로 처리한다. UTC 문자열 앞 10자리 추출이나 일괄 9시간 보정을 피한다.
- bigint·numeric·revision은 정확한 십진 문자열을 유지한다. 금융 원값의 JS Number 변환 손실과 NaN·Infinity를 막는다. 유효한 0·음수, NULL과 미제공 상태, 최신값과 마지막 제공값을 구분한다.
- [공개 조회](../../lib/data/publication.ts)는 읽기 전용 REPEATABLE READ에서 헤더와 행의 key·revision·calculationId·scope·metric·asOf를 맞춘다. 미공개·공개 0건·조회 오류를 구분한다. [순위 CSV](../../lib/data/ranking-export.ts)는 미공개 404, revision 변경 409, 포함 건수를 검사한다.
- 공식 회사 합계와 순위는 공개 결과를 사용한다. 선택 기간 분석은 실제 관측 표본·범위·같은 관측의 값과 날짜를 표시한다. CSV는 제공 대상 전체·정확한 값·코드 선행 0·UTF-8 BOM을 유지한다.
- 코드당 SID 하나에 여러 상장 기간과 이름 사건을 연결한다. 상장일은 포함하고 상폐일은 제외한다. `?period=`는 같은 종목의 지표 이동에만 이어 주고 다른 종목으로 이동할 때는 뺀다. 과거 상장기에는 현재 공식값·순위·회사 합계를 섞지 않는다.
- 기업 구성 종목과 공통 검색은 [각각의 공개 기준일과 헤더 부재 시 대체 기준](../security-lifecycle-contract-2026-10-13.md#웹-조회)을 서버·정적 추출에 동일하게 적용한다. 상세 대표 URL과 사이트맵은 [전체 식별자 목록](../static-export.md#데이터와-화면)을 사용한다.

## DB 변경과 tem 연동

- DB 변경 전 [연결 설정](../postgresql.md#연결-환경변수)의 URL 우선순위와 CLI·Next 환경 차이를 확인한다. 비밀값 없이 host·port·DB·계정과 쓰기 범위를 확인한다. 적용된 migration을 보존하고 검토한 후속 SQL을 사용한다. 저장소의 SQL 존재와 실제 DB 적용 여부는 따로 확인한다.
- Temporal 개발·디버깅·검증 전 `temporal:temporal-developer` 스킬과 해당 SDK 가이드를 읽는다. 재시도·결정성·재실행은 변경 범위에 맞춰 검증한다.
- 별도 checkout의 [AGENTS](../../../../tem/AGENTS.md), [CD 업무 규칙](../../../../tem/docs/cd-rules.md), [CD 운영 안내](../../../../tem/docs/cd-operations.md)를 따른다. 링크는 이 로컬 디렉터리 배치 기준이다. Python Worker의 실행법과 큐는 tem 운영 안내에서 확인한다.
- `source_ref/input_ref/rule_ref`는 현행 tem 업무 규칙과 스키마를 대조한다. 과거 원문 artifact·전체 mapping snapshot·실행별 승인/hash 원장을 새 실행 조건으로 삼지 않는다. 양쪽 계약이 충돌하면 근거와 필요한 결정을 인계한다.
- 연동 변경은 tem 입력 → 저장된 결과·공개 헤더 → CD 응답의 날짜·값·revision을 대조한다. CD의 격리 PG18 검사는 dcd와 분리하고 임시 schema 검사를 업무 DB에 연결하지 않는다. tem이나 CLI에 접근할 수 없으면 CD의 SQL·DTO·fixture 결과와 미확인 통합 범위를 보고한다. CD 작업을 NPS·IS·pcd로 확대할 때는 위임 범위를 확인한다.
