# 종목 코드와 복수 상장 기간 / 이름 사건 계약

2026-10-13 사용자 승인 구현. TEM CD의 소비 웹은 `/Users/craigchoi/silla/cd4`다. 이전 문서의 코드 재사용 시 서로 다른 SID라는 전제는 이 계약으로 대체한다. 운영 전환/공개 재발행과 서비스 적용 결과는 TEM의 전환 보고서에서 별도로 확정한다. 이 문서는 코드·DDL·오프라인 검증 범위다.

## 저장

- `security.ticker`는 전역 유일 문자열이며 선행 0을 보존한다. `security.security_id`는 코드당 하나다. 기존 93코드의 복수 ID는 TEM 전환 작업이 canonical ID로 연결한다.
- `security_listing_period`: `period_id text PK`, `security_id FK`, `listing_date date`, `delisting_date date NULL`, `last_present_on date`, `listing_source_ref`, `delisting_source_ref`, `relisting_review_ref`, `mapping_ref`, 생성·수정 시각.
- 기간은 `[listing_date, delisting_date)`다. 마지막 관측일은 기간 안에 있어야 하고 종료일과 종료 근거는 함께 존재한다. 같은 SID의 기간 시작은 유일하며 중첩은 SQL trigger가 거부한다. trigger는 identity row의 no-op UPDATE로 동시 변경을 직렬화하고 반복 읽기에서도 stale snapshot으로 중첩을 허용하지 않는다.
- `security_event`: `event_id text PK`, `security_id FK`, `company_id FK NULL`, `event_type`, `effective_on date NULL`, `date_precision`, `event_year NULL`, `old_name`, `new_name`, `source_ref`, `basis`, `review_ref`, `mapping_ref`, 생성·수정 시각.
- 사건 종류는 `security_name_change`/`company_name_change`, 근거는 `roster_observed`/`disclosure`/`reviewed`다. 회사명 사건에는 company ID가 필요하다. 이름은 서로 달라야 한다. disclosure/reviewed에는 검토 근거가 필요하다.
- day는 정확한 날짜, year는 연도만, unknown은 날짜·연도가 미확정인 사건이다. year/unknown 사건에 임의 1월1일을 저장하거나 화면에 정확한 날짜로 표시하지 않는다.
- 상장·상폐·재상장은 기간표로 연혁을 생성한다. 이름 변경만 사건표에 저장해 상폐 중 변경을 독립적으로 표현한다. 명단에서 보이지 않은 기간의 사명 변경일은 명단으로 추정하지 않는다.

## 웹 조회

- 상세 URL의 `?period=<period_id>`가 특정 상장기를 선택한다. 생략하면 가장 최근 상장기다. 잘못된 period ID는 live 페이지에서 404, static adapter에서 null, 정적 브라우저에서 찾을 수 없다는 상태를 표시한다.
- 가격·시총·재무·최근 가격 SQL은 선택한 기간을 제한한다. 기간을 생략한 일반 조회도 SID별 최신 기간에 제한한다. 기간 자료가 없는 이전 fixture/미전환 master만 종전 조회 동작을 유지한다.
- 모든 날짜 비교는 한국 업무일 자정과 half-open 종료 경계를 따른다. 종목명·시장 변경은 같은 상장기 안에 머문다.
- 최신 공개값과 마지막 제공값의 날짜도 선택 기간을 검사한다. 과거 상장기 선택은 현재 공개값/순위/이웃 순위/현재 회사 합산을 표시하지 않고 해당 시기의 원천 이력만 제공한다. 과거 공식 순위를 새로 계산하거나 원천 값을 공식 현재값으로 대체하지 않는다.
- 과거 상장기 이름은 해당 기간의 `last_present_on` 명단 이름으로 읽는다. 날짜가 확인된 이름 사건만으로 명칭을 역추론해야 하는 fallback도 제공하지만 명단 값이 우선한다.
- 상세 상단에 상장 기간 선택과 전체 연혁을 표시한다. 지표 탭은 period 선택을 유지하고 CSV·통계·가격 이동평균은 선택한 상장기 안의 이력만 사용한다. 전체 연혁은 상폐 중 공시 이름 변경도 표시한다.

## 정적 경로

- bounded batch 추출에서 lifecycle 3개 query(기간·사건·최종 명단 이름)를 읽으며 최대 원천 이력 4개 query와 합쳐 batch당 최대7개다. 날짜별·종목별 N+1 원천 조회를 만들지 않는다.
- 정적 파일/asset은 과거 선택을 위한 전체 raw archive를 보관하고 현재 DTO 및 회사합산 history는 최신 기간에 제한한다. file adapter와 browser adapter가 선택한 기간을 동일하게 필터한다. 최신 기간에는 공개 as_of 상한도 유지한다.
- 상장기별 원천 자료를 별도 종목 ID로 복제하지 않는다. 기간 선택이 바뀌어도 원천 저장 키는 동일 코드·SID·날짜다.

## 설치·검증

- migration은 `drizzle/0003_security_lifecycle.sql`. 0000~0002 이력은 수정하지 않았다. 0003 마지막의 `security_ticker_unique` index는 기존 alias 통합 뒤 생성해야 한다. TEM이 원자 전환 트랜잭션에서 이를 순서대로 적용한다.
- Drizzle snapshot/journal은 0003을 포함한다. SQL trigger는 수동 migration 항목이며 schema push로 migration 이력을 대체하지 않는다.
- 오프라인 `tests/security-lifecycle.test.cjs`는 half-open 경계, 과거 현재값/last-provided 차단, 상폐 중 이름 사건, 최종 명단 이름, live/static 기간 선택, 잘못된 ID, raw archive와 회사합산 분리, UI 연혁/탭 링크를 검증한다.
- TypeScript·변경파일 ESLint·Drizzle check 및 기존 웹 회귀를 수행했다. 실제 DB 제약·데이터 전환·서비스 HTTP 검증은 TEM 전환 보고서의 결과를 사용한다. 이 작업은 Worker/Collector/수집을 시작하지 않는다.

선택한 과거 상장기의 이름과 시장은 `last_present_on`의 명단에서 읽는다. 현재 master의 시장으로 과거 KONEX 구간을 KOSDAQ으로 표시하지 않는다. 이 표시용 `displayName`/`displayExchange`는 projection 컬럼을 추가하지 않는 읽기 DTO다. 기간 직접 지정과 지표 이동도 `period`를 유지한다.
