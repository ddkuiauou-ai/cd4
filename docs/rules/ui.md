# UI·Impeccable Rules

## 작업 전

- [PRODUCT](../../PRODUCT.md)에서 제품 범위, [DESIGN](../../DESIGN.md)에서 해당 화면의 승인된 동작과 표현을 확인한다. [화면별 brief](../../.impeccable/implementation-brief.md)와 실제 컴포넌트·CSS를 대조한다. 오래된 시안과 충돌하면 최신 사용자 결정과 해당 brief를 따르고 차이를 알린다.
- 세션에 제공된 `impeccable:impeccable` 스킬을 읽는다. 저장소 루트에서 스킬의 `scripts/impeccable context --target <대상 경로>`를 세션당 한 번 실행한다. 해당 작업의 playbook을 선택하고 UI 편집 직전에 `reference/craft-floor.md`를 읽는다.
- 검토에는 critique/audit 등 해당 playbook을 쓴다. 런처에 접근할 수 없으면 PRODUCT·DESIGN·실제 화면으로 확인한 범위를 밝힌다. context 경고만으로 전역 설정을 바꾸지 않는다.

## 구현과 확인

- 기존 `components/ui/`와 디자인 토큰을 먼저 확인한다. 순위 → 상세 → CSV 동선, 모바일 숫자·단위·정렬, 접근성 이름·키보드 포커스·대비를 지킨다. 금융값과 기준일·선택 종목은 [데이터 규칙](data-temporal.md#보존할-저장조회-계약)을 따른다.
- 상승/하락색·차트 끝점은 [색상 기준](../../DESIGN.md#colors), 검색·최근 본·테마는 [공통 헤더](../../DESIGN.md#global-header)와 [탐색 기준](../../DESIGN.md#search-recent-and-theme)을 따른다. 동작 줄이기와 화면별 예외도 함께 적용한다.
- 변경한 흐름을 모바일·데스크톱과 두 테마의 실제 브라우저에서 확인한다. 해당하는 검색·공유·다운로드·이동, 빈 값·오류·로딩, 가로 넘침·콘솔을 점검한다. 발견한 문제를 묶어 고치고 영향을 받은 동작을 다시 확인한다.
- 시안 승인 범위를 지킨다. 완료 보고에는 자동 검사, 실제 화면 확인, 독립 검토, 사용자 수락, 정적 출력과 운영 배포의 확인 여부를 구분한다. [검증 규칙](verification.md#변경별-최소-확인)
