# 앱·서버 Rules

적용: `app/**`, Next.js 설정, 서버 조회와 클라이언트 경계, 검색/CSV/sitemap,
SEO·캐시·정적 export를 변경할 때. UI·데이터 의미를 함께 바꾸면 해당 Rules도 읽는다.

## 행동

- 구현 전 설치된 Next.js의 `node_modules/next/dist/docs/`에서 해당 기능을 읽는다.
  시작점은 `01-app/01-getting-started/05-server-and-client-components.md`,
  `15-route-handlers.md`, `01-app/02-guides/static-exports.md`다.
  버전은 [package.json](../../package.json), 출력 모드는 [next.config.ts](../../next.config.ts)로 확인한다.
- 기본 page/layout의 서버 조회·metadata·SEO 역할을 지킨다. 브라우저 상태·이벤트·API가
  필요한 부분만 Client Component로 만들고 DB 연결/비밀값을 클라이언트에 전달하지 않는다.
- 조회는 [lib/data](../../lib/data), DB 연결은 [db/index.ts](../../db/index.ts)를 따른다.
  과거의 `lib/{insert,delete,update,select}.ts` 네 파일 제한을 재도입하지 않는다.
- 현재 앱의 서버 기능은 PostgreSQL 읽기·DTO·페이지 렌더링·검색·CSV·sitemap이다.
  이것을 별도 tem Worker로 옮기거나, tem 수집·공식 계산을 Route Handler에 복제하지 않는다.
- URL·쿼리·응답은 실제 `app/**/route.ts`와 페이지를 확인한다. 정적 준비 단계는
  [scripts/prepare-static.cjs](../../scripts/prepare-static.cjs)도 확인한다.
  `/search-data.json`, `/ranking-data/*.csv`, `/sitemap.xml`, `/sitemaps/...` 등 생성 경로와
  구 `docs/spec.md`의 `/api/*` 제안을 혼동하지 않는다. 존재하지 않는 endpoint를 만들지 않는다.
- `NEXT_OUTPUT_MODE`가 없으면 standalone, `export`면 정적 출력이다.
  전체 export는 [정적 빌드 안내](../static-export.md)의 추출 → 동결 파일 → 페이지/자산 생성
  경로를 따른다. 페이지 생성 중 DB 재조회는 금지한다.
- 정적 배포의 새 데이터는 재빌드·배포로 공개한다. 서버 ISR이나 Cache Components가
  정적 파일을 자동 갱신한다고 설명하지 않는다. 서버 조회 캐시는
  [cache-policy.ts](../../lib/data/cache-policy.ts)를 읽고 공개 헤더와 행의 일관성을 유지한다.
- 사이트맵·metadata·구조화 데이터의 공개 URL, 코드 선행 0과 검색 유입 동선을 보존한다.
  로딩·미공개·정상 0건·오류를 구분한다. DB 오류를 성공 빈 배열로 바꾸지 않는다.

## 예외와 확인

- 서버 전용 기능 또는 출력 모드 변경은 요청 범위에 있을 때만 도입한다.
  한 모드만 검증했으면 다른 모드의 성공을 주장하지 않는다.
- [검증 규칙](verification.md)에 따라 관련 회귀와 실제 응답/화면을 확인한다.
  정적 변경은 파일 존재뿐 아니라 JSON/CSV·내부 이동·sitemap 링크의 실제 내용을 확인한다.
- 관련 교훈: [L1·L2·L3](../learnings.md). 오래된 캐시 TTL·라우트 예시는 현재 소스보다 우선하지 않는다.
