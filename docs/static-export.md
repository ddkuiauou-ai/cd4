# 전체 정적 빌드 사용법

Next.js 16.4 / React 19.3, Node **22.23.3**, pnpm **10.34.6** 기준이다. 기존 `pnpm dev`, `pnpm build`, `pnpm start`의 DB 조회 모드도 유지한다.

2026-10-09의 전체 빌드와 검증은 완료했다. 실제 페이지·파일 수, 종류별 용량, 단계 시간, 병렬 처리 비교와 브라우저 전송량은 [검증·성능 보고서](static-export-verification-2026-10-09.md)와 [상세 JSON](static-export-verification-2026-10-09.json)에 기록했다.

## 전체 빌드와 확인

외부에서 프리징한 PostgreSQL 데이터를 기존 `.env` 연결 설정으로 읽는다. 입력 추출은 읽기 전용이며 DB에 값을 쓰지 않는다.

```sh
pnpm install --frozen-lockfile
pnpm build:static
pnpm verify:static
pnpm preview:static
```

미리보기는 `http://127.0.0.1:4173`에서 **`out/` 파일만** 제공한다. Next 서버와 DB 연결을 사용하지 않는다. 업로드 대상은 `out/` 전체다. `.txt`와 `__next.*` 탐색 파일, `_next/`, `static-data/`, `_headers`를 함께 보존한다. 이 명령들은 Netlify에 업로드하지 않는다.

전체 출력은 25,000개 이상의 파일을 포함하므로, 사용자가 업로드할 때는 Netlify CLI의 폴더 배포나 파일 digest 방식이 적합하다. Netlify API의 ZIP 추출에는 [25,000개 파일 제한](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)이 있다. 전체 배포 파일 수에는 제한이 없지만 [디렉터리당 54,000개 파일 제한](https://docs.netlify.com/deploy/deploy-overview/)이 있어 정적 출력 검증에서 함께 확인한다.

`build:static`은 입력 추출 → 독립 작업 폴더에서 Next 컴파일·타입 검사·전체 페이지 생성 → 공유 JSON·CSV·별칭·헤더 조립 → 파일 전수 검사·로컬 HTTP 검사를 실행한다. 성공한 결과만 `out/`으로 교체하며 조립·검증이 실패하면 이전 출력으로 되돌린다. 전체 명령은 표본 입력을 거절한다.

입력과 보고서는 `.static-build/`에 저장한다. `.static-build/workspace/.next`는 정적 빌드 전용 컴파일 캐시다. 루트의 개발·서버용 `.next`와 분리되어 있다. 입력 파일은 공개 출력에 복사하지 않는다.

## 데이터와 화면

- 식별자·현재 공식 값·순위·이력을 한 번 추출한다. 페이지와 메타데이터는 파일 입력을 읽으며, 렌더링 단계의 DB 조회는 금지한다.
- 현재값·기본 분석·연도별 표·SEO는 HTML에 들어간다. 차트·기간 분석·전체 이력 CSV는 종목과 자료 종류별 공유 JSON을 사용한다.
- JSON은 열 정의와 행 배열로 저장한다. 금융 값·큰 정수·revision은 문자열을 유지한다. PER/EPS와 PBR/BPS는 같은 보조 자료를 참조한다. 종목이 달라도 내용이 같으면 동일한 해시 주소를 사용하며, 파일 생성 시각을 이력 내용에 넣지 않는다.
- 내용 해시가 붙은 JSON·CSV·JS·CSS는 장기 캐시하고, HTML·검색·사이트맵·일반 CSV 주소는 재검증한다. Next 탐색용 RSC `.txt`에는 `text/x-component`를 지정한다. 헤더는 [Netlify `_headers` 규칙](https://docs.netlify.com/manage/routing/headers/)에 맞춰 결과물에 생성한다.
- `start/end`, `scope`, `revision`은 브라우저에서 기존 규칙으로 해석한다. 초기 HTML의 기본 내용을 보존하는 작은 클라이언트 경계를 사용한다. 뒤로가기와 새로고침도 URL을 기준으로 복원한다.
- 순위 CSV는 공개 범위별 정적 명세로 기준일·revision·행 수를 검증한다. 상세 CSV는 선택한 기간과 관계없이 전체 제공 이력을 내보낸다. 일반 `/ranking-data/*.csv` 주소도 유지한다.
- 해석 가능한 별칭은 정식 URL로 이동하는 작은 HTML을 생성한다. 이동 시 검색 파라미터와 해시를 보존하며, 모호하거나 존재하지 않는 대상은 404다.
- 검색 데이터는 검색창을 열 때 받고, 차트 자료는 진행 중 요청과 완료 결과를 공유한다. 최근 종목은 검색 데이터의 선행 다운로드를 일으키지 않는다.

일반 `/ranking-data/*.csv` 정적 주소는 이번 빌드의 기본 공개 범위를 제공한다. 화면에서 선택한 `scope`·`revision`의 다운로드 검증은 정적 명세와 해시 파일 주소를 사용한다. 정적 파일 서버는 URL 쿼리로 다른 CSV 본문을 계산하지 않는다.

## 비교와 튜닝

```sh
pnpm benchmark:static
```

기본 40개 이상 표본에서 고정 입력을 사용해 워커 `2/4/8` × 동시 작업 `2`, 선택한 워커 × 동시 작업 `1/2/4/8`을 비교한다. 각 설정은 같은 컴파일 캐시 조건에서 3회 측정하며 중앙값을 사용한다. 캐시 없는 빌드는 별도로 기록한다. 5% 이내 속도 차이에서는 메모리를 적게 사용하는 설정을 선택한다. 표본 성능은 전체 빌드 완료를 대신하지 않는다.

직접 설정을 비교할 때는 `STATIC_BUILD_CPUS`, `STATIC_BUILD_CONCURRENCY`를 사용한다. 개발 전용 experimental 옵션과 정적 production 옵션은 `next.config.ts`에서 분리한다. 타입 검사와 Next 탐색 파일을 생략하지 않는다.

같은 소스의 완료된 벤치마크가 있으면 `pnpm build:static`이 선택된 워커·동시 작업 수를 자동으로 사용한다. 명시한 환경 변수가 우선하며, 유효한 측정이 없으면 `4 × 2`를 사용한다. 소스가 바뀐 과거 측정은 자동 적용하지 않는다.

Tailwind는 `app/globals.css`의 명시한 앱 소스 경로만 스캔한다. 독립 작업 폴더에서 의존성·이전 출력·보고서를 훑지 않도록 [명시적 소스 등록](https://tailwindcss.com/docs/detecting-classes-in-source-files)을 사용한다. 다른 최상위 폴더에 화면 코드를 추가하면 해당 `@source`도 등록한다.

이미 추출한 동일 입력으로 다시 빌드하려면 `pnpm build:static --reuse`를 사용한다. 새로운 영업일에는 기본 `pnpm build:static`으로 입력을 새로 추출한다. `--reuse`는 현재 DB에서 새 데이터를 읽는 명령이 아니다.

브라우저 응답 바이트를 로컬에서 기록하려면 다음 명령을 사용한다.

```sh
pnpm preview:static --traffic-report .static-build/reports/browser-traffic.json
```

이 기록은 로컬 브라우저에 실제로 쓴 응답 본문 바이트다. 로컬 Brotli/gzip 압축을 사용하며 HTTP 헤더, Netlify CDN의 실제 압축·캐시·청구량과 구분한다. 캐시 없는 최초 방문은 새 로컬 포트에서 측정한다. 업로드 크기와 방문자 전송량도 서로 다른 수치다.

Legacy Free의 [월 100GB 전송량](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/)은 팀 사이트에서 방문자에게 보낸 [응답 트래픽](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-for-legacy-plans/)을 기준으로 한다. `하루 출력 크기 × 월 배포 횟수`로 계산하지 않는다. 실제 운영 사용량은 업로드 후 사용자가 Netlify Billing에서 확인한다.

## 보고서와 검사

실행별 로그·단계 시간·표본 RSS·디스크 여유는 `.static-build/reports/<실행 ID>/report.json`에 남는다. 마지막 빌드·전수 검사·벤치마크 보고서는 각각 `build-latest.json`, `verify-latest.json`, `benchmark-latest.json`이다. RSS는 측정대상 Node 하위 프로세스를 주기적으로 더한 표본값이며, 조율하는 부모 프로세스·네이티브 하위 프로세스·매우 짧은 최고점은 포함하지 않는다.

```sh
pnpm test
pnpm typecheck
pnpm lint
node scripts/verify-static-input.cjs
```

마지막 명령은 프리징된 DB와 준비한 입력을 대조하는 **읽기 전용 개발 검증**이다. 운영용 파일 미리보기에는 필요하지 않다. 기본 전체 입력에서는 최소 40개 종목과 12개 기업을 대조하며 `--all`은 전체를 대조한다. 금융 문자열·업무일·revision은 그대로 비교하고, ORM/원시 SQL의 감사 시각 표현 차이만 밀리초 ISO 형식으로 정규화한다.

프리징 시스템, 데이터 작성·공개, 자동 스케줄링, Netlify 업로드와 운영 CDN 확인은 이 빌드 도구의 범위 밖이다.
