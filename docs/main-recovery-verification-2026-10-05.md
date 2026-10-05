# 메인 화면·Temporal 1차 수정 및 검증 결과

2026-10-05 Asia/Seoul. 실행 계획: [main-recovery-execution-plan-2026-10-05.md](./main-recovery-execution-plan-2026-10-05.md).

## 현재 완료 범위

로컬 웹 수정·회귀 검증, 임시 Temporal 서버 통합 검증, 실제 KONEX 날짜별 명부의 격리 DB 재생까지 완료했다. 실제 업무 DB 반영, 기존 Temporal 서버의 Workflow 시작, 운영 프로세스 재기동·예약 변경·배포는 수행하지 않았다. 웹이 다시 표시되는 것과 최신 금융 집계 복구 완료는 별도로 판단한다.

## 변경 내용

- `lib/data/cache-policy.ts`: 개발 서버는 DB를 직접 읽고, 서버 운영 조회는 공통 namespace `financial-data-v2`와 300초 재검증을 사용한다. 예전 빈 캐시를 재사용하지 않는다. 재검증은 요청 기반이며 정적 export에는 런타임 갱신이 없다.
- `lib/data/company.ts`, `lib/data/security.ts`, `lib/getSearch.ts`: 메인 회사 목록·총수·가격·헤더 검색 조회의 예외를 `[]`, `{}`, `0`으로 바꾸지 않는다. 기존 오류 경계가 오류를 처리한다. 실제 가격이 없는 회사에는 빈 가격 배열을 전달한다. 같은 파일에 다른 랭킹 작업의 변경도 있으므로 이번 변경과 구분한다.
- `app/dashboard/page.tsx`, `app/dashboard/loading.tsx`: 조회 중 로딩을 전용 파일로 옮기고, 정상 빈 결과는 최종 빈 안내로 표시한다. 가격 없는 기업의 시총은 유지하며 가격은 `—`로 표시한다. 실제 전체 기업 수와 시총·가격 기준일을 표시하고 고정된 실시간 업데이트 문구를 제거한다. Temporal 상태 UI나 webhook은 추가하지 않았다.
- `/Users/craigchoi/tem/src/cd_temporal/finance_planning.py`, `web_service.py`: 전체 일일 작업의 반복 재처리에서 최종화 요구가 사라지는 결함을 고쳤다. 기존 `finalize_dates`로 요구를 이어가고, 저장된 Workflow 입력을 기준으로 범위를 검증한다. 단일 시장·부분 데이터 수집은 전체 최종화 범위를 얻지 않는다. 모델·Workflow·Activity·보호 기준은 변경하지 않았다. 운영 GUI 적용에는 해당 프로세스 재기동이 필요하다.

## 검증 결과

| 검증 | 결과 | 실제 확인 범위 |
|---|---|---|
| `npm run test:main` | 11 passed | 실제 Next 캐시 구현의 오류 후 복구·개발 우회·정상 빈 값 만료·기존 정상 캐시 보존·새 namespace, 실제 페이지 렌더링의 빈 상태·무가격 회사·서로 다른 기준일 |
| 종목마스터·관련 Activity 회귀 | 80 passed | 최신 직접 차단, 시간순 반영, ID/이력 보존, 실패 무변경, 과거 관측의 현행 명부 되돌림 방지, 시장별 기준일, 명부 commit 후 가격 실패 재개 |
| 반복 재처리 계획·웹·CLI 관련 검증 | 119 passed | 날짜별 최종화 요구 유지, 범위 확대 방지, 실패 복구·완료 child 재사용·history replay 포함 |
| `tests/test_finance_workflows.py` 전체 | 20 passed | 새 임시 Temporal 서버에서 SDK Worker/Workflow/Activity 통합. 기존 서버 7233이나 업무 DB는 사용하지 않음 |
| 독립 코드 리뷰·`git diff --check`·Temporal 변경 파일 Ruff | 통과 | 이번 메인·캐시·재처리 변경의 추가 blocker 없음 |
| 타입 검사 | 기존 오류 8개로 실패 | 변경 전후 출력 동일, 이번 변경 파일의 새 오류 없음. sitemap params, 지표 페이지 nullable keywords, root layout 중복 metadataBase가 남아 있음 |

위 테스트 묶음은 일부 중복한다. 단순 합계로 고유 테스트 수를 계산하지 않는다. 빌드의 타입·린트 오류 무시 설정을 통과 근거로 사용하지 않았다.

### 실제 입력으로 보호 조건 검증

업무 DB의 읽기 전용 기준선은 KONEX 119행 중 활성 116개, 기준일 2025-09-22였다. 실제 KRX 명부는 2026-03-31 109개, 2026-10-02 107개였다.

| 경로 | 누락 / 신규 | 한도 | 실제 입력의 격리 DB 재생 |
|---|---:|---:|---|
| 최신 날짜 직접 | 14 / 5 | 12 | 차단, 모든 fixture 표 무변경 |
| 2026-03-31 중간 날짜 | 9 / 2 | 12 | 성공, 활성 109개 |
| 2026-10-02 최종 날짜 | 5 / 3 | 11 | 성공, 활성 107개 |

기존 119개 ID·기존 listing_date·country와 합성 과거 가격의 ID 연결을 보존했다. 같은 날짜 중복 재시도도 변경 없이 통과했다. 원본과 SHA-256, 결과, 재현 스크립트는 `/Users/craigchoi/tem/reports/main-recovery-2026-10-05/`에 보관했다. 재현 명령은 Temporal 프로젝트에서 실행한다.

```bash
.venv/bin/python reports/main-recovery-2026-10-05/replay_fixture.py
```

이 재생은 실제 관측 명부가 기존 정책을 통과한다는 증거다. 공식 상장폐지 날짜, 실제 과거 가격 보존 전체, PostgreSQL 잠금, 실제 업무 Workflow 완료나 최종 집계 완료까지 증명하지는 않는다.

### 로컬 브라우저 확인

`http://localhost:3000/dashboard/`에서 메인 이동, 기업 카드·시총 목록·검색 결과를 확인했다. 전체 기업 수 2,601개, 시총 기준일 2025-09-22, 가격 기준일 2026-10-02가 표시됐다. 검색에서 삼성전자 관련 기업·종목 결과를 확인했다. 영구 로딩 화면이 아닌 실제 데이터가 표시된다. 빈 상태와 가격 없는 회사는 위 회귀 테스트로 검증했다.

화면 캡처: `/Users/craigchoi/.codex/visualizations/2026/10/05/01a109ca-02b2-7542-af35-435ea3bad0e2/main-dashboard-local.jpg`.

## 남은 실행·최종 점검

1. 실행 직전 업무 DB 기준선과 원본 hash를 다시 확인한다.
2. 저장된 2026-03-31 KONEX 단일 날짜 계획을 실행하고 명부·가격 저장과 verify까지 성공해야 다음 단계로 간다.
3. 원래 전시장 2026-10-02 실패 보고서에서 KONEX를 재처리하고 목표 날짜의 전체 최종화를 수행한다. 다른 시장의 성공 영수증·저장값을 재검증한다.
4. 독립 SQL audit에서 최신값·합산·순위·목표 날짜·기존 ID/이력 보존을 확인한다.
5. 로컬 메인·랭킹을 SQL 결과와 대조한 뒤 운영 방식에 맞춰 반영한다. 운영 URL과 캐시 재검증 이후의 결과 또는 새 정적 HTML을 확인한다.

현재 로컬 화면의 시총 기준일은 여전히 2025-09-22다. 최신 집계 복구와 운영 배포는 아직 완료되지 않았다.
