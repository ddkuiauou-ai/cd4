# CD 프로젝트 에이전트 지침

공통 규칙의 원본은 [AGENTS.md](../AGENTS.md)다. 작업 전에 해당 파일을 읽는다.
이 링크가 다른 파일을 자동으로 import한다고 가정하지 않는다.

1. 요청과 작업 대상 경로를 확인한다.
2. `AGENTS.md`의 경로 표에서 관련 `docs/rules/*.md`를 골라 읽는다.
3. [Learnings](../docs/learnings.md)에서 관련 교훈과 근거를 읽고 작업한다.
4. 필요한 검증을 수행하고, 재사용 가능한 교정·실패 원인이 확인되면 교훈을 갱신한다.

구현·검증 명령과 Bun 전환의 미정합은
[검증 규칙](../docs/rules/verification.md)을 따른다.
UI 작업은 [UI 규칙](../docs/rules/ui.md), 현재 `PRODUCT.md`·`DESIGN.md`와
Impeccable을 따른다. 이 파일에 별도의 버전·색상·데이터 접근 규칙을 복제하지 않는다.
