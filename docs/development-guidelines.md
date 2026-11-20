# CD 개발 지침 안내

[작업별 읽기 경로](../AGENTS.md#작업을-시작할-때)에서 변경할 영역을 찾는다. 실행 명령·필요한 환경과 검사 선택은 [검증 규칙](rules/verification.md)에 있다.

예를 들어 순위 CSV를 바꾸면 [공개 결과 계약](rules/data-temporal.md#보존할-저장조회-계약)에서 대상과 revision을 확인한다. 다운로드 버튼도 바꾸면 [화면 기준](../DESIGN.md#buttons-and-csv)을, 정적 파일도 바꾸면 [출력 계약](static-export.md#데이터와-화면)을 함께 읽는다.

관련 실패 사례와 최종 결정은 [Learnings](learnings.md)에서 찾는다. 날짜별 검증 기록은 [문서 안내](README.md#날짜별-구현검증-기록), 예전 종합 가이드의 예시는 [보존본](archive/development-guidelines-2026-10-05.md)에 있다.
