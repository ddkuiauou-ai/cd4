# 앱·서버 Rules

## 서버 조회와 라우트

- Next.js 구현 전 설치된 `node_modules/next/dist/docs/`에서 해당 버전의 Server and Client Components, Route Handlers 또는 Static Exports 가이드를 읽는다.
- page/layout의 데이터 조회·metadata·SEO는 서버에 두고, 브라우저 상태와 이벤트를 쓰는 부분에 Client Component를 적용한다. 조회는 [lib/data](../../lib/data), DB 연결은 [db/index.ts](../../db/index.ts)를 따른다.
- 페이지·Route Handler의 실제 URL·쿼리·응답을 기준으로 공개 링크와 종목코드의 선행 0을 보존한다. 공통 검색·상세 별칭·사이트맵의 대상 범위는 [정적 출력 계약](../static-export.md#데이터와-화면)을 따른다.
- 서버 캐시는 [캐시 정책](../../lib/data/cache-policy.ts)과 [공개 헤더 조회 계약](data-temporal.md#보존할-저장조회-계약)을 따른다. 화면에서 로딩·미공개·정상 0건·오류를 구분하고 조회 실패가 빈 결과로 캐시되지 않게 한다.

## 출력 모드

- [Next 설정](../../next.config.ts)의 기본 출력은 standalone이며 `NEXT_OUTPUT_MODE=export`는 정적 출력이다. 전체 export는 [준비 스크립트](../../scripts/prepare-static.cjs)로 입력을 동결하고 페이지 생성 중에는 파일만 읽는다. 새 데이터 공개에는 재빌드와 배포가 필요하다.
- 서버 전용 기능이나 출력 모드 변경은 요청 범위를 확인한다. 변경한 모드에서 실제 응답·화면·내부 이동을 확인하고 [검증 규칙](verification.md#변경별-최소-확인)에 따라 확인 범위를 보고한다.
