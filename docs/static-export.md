# 전체 정적 빌드 사용법

실행 전 [빌드 환경](rules/verification.md#실행-환경)에서 Node·pnpm 버전과 프로덕션 환경값을 확인한다. 입력의 날짜·값·공개 revision은 [데이터 규칙](rules/data-temporal.md)을 따른다.

2026-10-09의 전체 빌드와 검증은 완료했다. 실제 페이지·파일 수, 종류별 용량, 단계 시간, 병렬 처리 비교와 브라우저 전송량은 [검증·성능 보고서](static-export-verification-2026-10-09.md)와 [상세 JSON](static-export-verification-2026-10-09.json)에 기록했다.

## 로컬 R2 후보

장 마감 후 `bun run build:release`로 전체 후보를 빌드하고 검증된 객체를 로컬 저장소에 게시한다. 최초 빌드 이후에는 `bun run build:release:daily`를 사용한다. 두 명령은 기본적으로 DB에서 입력을 동결한다. 같은 동결 입력을 사용하려면 `--input <동결 입력 경로>`를 지정한다.

릴리스 실행기는 저장소에 고정된 Node와 pnpm을 `PATH`, 설치된 pnpm 도구, NVM에서 찾는다. `bun run build:release:daily --version`으로 선택한 버전을 확인한다. 도구를 다른 위치에 설치한 호스트는 해당 실행 파일 디렉터리를 `PATH`에 추가한다.

```sh
bun run build:release --input .static-build/release-input --candidate-only
bun run publish:local --candidate "$CD_RELEASE_OUTPUT" --dry-run --report .static-build/key-plan.json
bun run preview:release --port 4173 --request-log .static-build/release-requests.jsonl
bun run publish:local --rollback
bun run clean:release --dry-run
```

기본 객체 저장소는 `.static-build/local-release`이고 별도 검수 저장소는 모든 명령에 `--store <경로>`로 지정한다. `--candidate-only`는 생성한 후보와 작업 계획을 보존한다. 빌드가 출력한 `.static-build/release-builds/.../out` 경로를 `CD_RELEASE_OUTPUT`에 넣고 대상 키를 확인한다. `publish:local`에서 `--dry-run`을 빼면 후보를 로컬 저장소에서 활성화한다. 저장소의 `current.json`은 활성 릴리스를 선택하고, `builds/<릴리스 ID>.json`에는 다음 빌드에서 사용할 동결 입력과 경로 해시를 보존한다.

빌드를 시작할 때 선택된 릴리스가 이미 교체되었으면 후보를 다시 만든다. 전체 후보를 의도적으로 다른 기준 위에 게시하려면 `publish:local --replace-base`를 사용한다. `build:release --clean`은 격리 컴파일 캐시를 비우고 전체 결과를 대조할 때 사용한다.

- 일별 빌드는 직전 성공 동결 입력과 새 공개일의 원천 가격·시총·재무/배당 및 공식 공개 자료를 사용한다. 이미 처리한 공개는 그대로 유지한다. 과거 정정, 공개 계약 또는 기준선이 달라졌으면 수동 전체 빌드를 실행한다.
- 선택된 HTML 경로는 일반 Next 빌드의 정적 파라미터로 생성한다. 코드와 입력이 동일하면 빌드와 게시를 생략한다. 객체 인벤토리는 바이트 SHA-256과 응답 헤더를 비교하고, 변경 계획은 공유 파일·자료·HTML·사이트맵 순서로 작성한다.
- `putKeys`와 `putBytes`는 응답 헤더만 바뀐 객체도 포함한 예정 PUT 건수와 본문 바이트다. `deleteKeys`는 철회할 키 수다. `objectWrites`와 `bytesWritten`은 중복을 제외한 로컬 객체 기록이다.
- 로컬 미리보기는 현재 릴리스의 객체 목록만 읽는다. 문서 경로의 끝 슬래시는 `index.html`로 해석하고 CSV·JSON·스크립트는 파일 키로 조회한다. 공개 `ads.txt`와 `robots.txt`를 유지한다. Next 탐색용 RSC와 로컬 릴리스 메타데이터는 후보 객체에서 제외한다.
- 현재와 직전 성공 릴리스의 객체를 보관한다. 이전 날짜의 시장 CSV를 이어서 제공하고, 바로 전 HTML이 참조하던 해시 파일은 다음 전환 동안 유지한다. 롤백은 이전 HTML·CSV·사이트맵을 복구하고, 철회된 릴리스의 해시 파일은 캐시에서 이미 열린 문서를 위해 보관한다.
- 성공 후 소유 표시가 있는 빌드 실행의 불필요한 생성 입력과 출력만 정리한다. 활성·직전 릴리스의 참조, 승인 대기 후보, 최신 실패 확인 자료를 보존한다. `bun run clean:release --dry-run`의 결과로 정리 범위를 확인할 수 있다.
- 로컬 작업 계획의 순서와 헤더는 R2 객체 게시를 모의한다. 실제 커스텀 도메인에서는 HTML과 JSON에 Cache Rules의 캐시 적격성을 설정해야 한다. MIME·Cache-Control은 게시 요청의 R2 객체 메타데이터에 기록한다. [Cloudflare R2 캐시 안내](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)

## R2 운영

도메인을 정하기 전에는 [CD Worker](../workers/r2-site.mjs)의 `workers.dev` 주소로 접속할 수 있다. 이 Worker는 공개 자료 버킷 `cd-static`에서 `/security/KOSPI.005930/per/`를 `security/KOSPI.005930/per/index.html`로 조회하고 JSON과 CSV는 요청한 키 그대로 제공한다. Cloudflare에 연결된 `cd4` 프로젝트가 [Wrangler 설정](../wrangler.jsonc)을 배포한다. 임시 호스트에서 실제로 확인한 주소를 Actions 변수 `R2_PUBLIC_ORIGIN`에 등록한다.

장 마감 일정과 같은 처리를 수동으로 재실행할 때는 `daily`를 선택한다. 이미 게시한 거래일과 revision이면 새 파일을 올리지 않는다.

검색 대표 도메인은 [사이트 주소](../config/site-origin.cjs)에서 한 번 설정한다. 도메인 교체 시 새 주소를 R2에 연결하고 전체 배포하면 HTML의 canonical, 사이트맵, robots.txt, 공유 이미지와 홈의 구조화 데이터에 반영된다. 임시 R2 공개 호스트는 `R2_PUBLIC_ORIGIN`으로 별도 지정할 수 있다. 디렉터리 주소를 서비스하는 도메인에서는 `/`로 끝나는 요청 경로 뒤에 `index.html`을 붙이는 내부 재작성 규칙을 적용한다. 예를 들어 `/security/KOSPI.005930/per/`의 객체 키는 `security/KOSPI.005930/per/index.html`이다. [Cloudflare URL 재작성](https://developers.cloudflare.com/rules/transform/url-rewrite/)

[Publish CD to R2](../.github/workflows/deploy-r2.yml)는 신뢰된 `main`에서만 Mac self-hosted runner로 실행한다. 평일 서울 17:30에 당일 갱신을 실행하고, 첫 토요일 서울 09:00에 마지막 성공 기준일과 커밋으로 PostgreSQL을 독립 전체 조회·빌드한다. 월간 검증은 마지막 릴리스의 활성 파일 바이트와 응답 헤더를 대조한다. 차이가 있으면 검수 후보 ID와 변경 규모를 실행 요약에 기록한다.

- 최초 공개는 수동 `full`을 선택한다. 그날 사이트에 필요한 전체 파일을 올리고 이후 변경을 비교할 기준을 R2와 러너에 기록한다. 과거 데이터를 정정했거나 `main`의 커밋이 마지막 성공 배포와 달라졌을 때도 `full`을 실행한다.
- 이후 같은 커밋에서 새 거래일이 공개되면 `daily`가 변경된 HTML·JSON·CSV 등만 올린다. 같은 공개분으로 다시 실행하면 업로드는 0건이다. 종목·기업 HTML은 대표 주소에 게시하며, 철회 대상은 직전 배포 기록으로 식별한다. 과거 날짜 CSV와 직전 릴리스의 해시 자원은 보관한다.
- 월간 대조 결과가 같으면 공개 PUT은 0건이다. 차이가 있으면 원인을 확인하고 `promote`에 검수한 후보 ID를 입력한다. 승격 시 최초 비교의 기준 릴리스와 실행 ID가 여전히 활성 상태여야 한다.
- 워크플로에 사이트 파일 버킷 `cd-static`과 배포 기록 버킷 `cd-static-state`를 명시한다. 두 버킷의 직접 공개는 끄고 Worker는 사이트 파일만 읽는다. R2 인증에는 GitHub Secrets의 `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`를 사용한다. 업무 DB에는 기존 `POSTGRES_*` 시크릿 다섯 개를 사용한다.
- 첫 공개 전 수동 `status`로 두 버킷의 HEAD와 `ListObjectsV2(max-keys=1)`를 확인한다. 출력에는 역할별 HTTP 상태와 알려진 S3 오류 코드가 기록된다. 목록 응답이 `NoSuchBucket`을 반환하면 계정·관할·설정된 이름을 확인한 후 수동 `provision`을 실행할 수 있다. 이 작업은 미존재가 확인된 설정 버킷만 생성한 뒤 목록 접근을 다시 확인한다. 생성 권한이 없으면 Cloudflare에서 관리자가 상태 버킷을 준비하고 토큰의 권한 범위를 확인한다. [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)
- 워크플로의 `STATIC_RELEASE_HOME`을 비워 두면 러너 계정의 홈 아래 `.local/state/cd4-r2`에 동결 자료, 컴파일 캐시와 직전 배포 기준본을 보관한다. 전용 디스크로 옮길 때는 이 칸에 체크아웃 밖의 절대 경로를 적고 기준본도 함께 옮긴다.
- 공개 키는 공유 자원 → 자료 → 문서 → 사이트맵 → 철회 순서로 적용한다. 비공개 `cd-release/current.json`은 조건부 쓰기로 완료 상태를 한 번에 선택한다. 공개 버킷에서 여러 키가 적용되는 동안 문서와 사이트맵은 순서대로 전환된다. 중단되면 `resume`을 실행해 같은 후보에서 마지막 성공 묶음부터 재시도한다. 성공 포인터 저장 후 로컬 상태가 남아 있으면 같은 명령으로 맞춘다.
- 현장 실행은 `STATIC_RELEASE_HOME`과 위 환경을 지정한 후 `bun run deploy:r2 --mode status`, `--mode full`, `--mode verify`, `--mode promote --candidate-id <ID>`, `--mode resume`을 사용한다. `verify`에는 마지막 성공 커밋을 체크아웃한다. 후보와 인벤토리는 비공개 버킷과 전용 러너에 저장한다.
- 처음 `full`을 실행할 때 같은 커밋과 업무일로 검수한 완전 동결본을 재사용할 수 있다. 수동 실행의 `frozen_input`에는 러너의 절대 경로를, `frozen_day`와 `frozen_commit`에는 검수에 사용한 날짜와 커밋을 지정한다. CLI의 대응 인자는 `--input`, `--day`, `--input-commit`이다. 빌드는 새 HTML과 후보 인벤토리를 생성한다.
- 배포 뒤 수동 `smoke`로 마지막 완료 릴리스의 삼성전자 PER HTML과 해당 업무일의 시장 CSV를 검증한다. 서명된 R2 읽기의 SHA-256·Content-Type 대조 결과를 표시한다. 저장소 변수 `R2_PUBLIC_ORIGIN`을 지정하면 공개 문서 경로와 CSV도 익명 HTTPS로 읽어 별도 결과를 기록한다. 변수가 비어 있으면 공개 주소 검사를 생략한다.
- 평일 갱신의 업무일은 실제 최신 공개 헤더가 결정한다. 휴장일 또는 수집 대기 중 공개 헤더가 직전 성공과 같으면 그대로 유지한다. 중단 작업은 `resume`으로 완료하고, 일별 기준선을 건너뛴 관측이나 정정은 전체 실행에서 다시 동결한다.

## 기존 전체 정적 출력과 확인

기존 `.env` 연결 설정으로 PostgreSQL 데이터를 읽는다. 식별자·공개 결과·원천 이력·대회장·CSV를 한 번의 읽기 전용 REPEATABLE READ 트랜잭션으로 동결한다. 트랜잭션이 성공하면 입력 manifest가 완성된다.

```sh
bun run build:static
bun run verify:static
bun run preview:static
```

미리보기는 `http://127.0.0.1:4173`에서 **`out/` 파일만** 제공한다. Next 서버와 DB 연결을 사용하지 않는다. 업로드 대상은 `out/` 전체다. `.txt`와 `__next.*` 탐색 파일, `_next/`, `static-data/`, `_headers`를 함께 보존한다. 이 명령들은 Netlify에 업로드하지 않는다.

전체 출력은 25,000개 이상의 파일을 포함하므로, 사용자가 업로드할 때는 Netlify CLI의 폴더 배포나 파일 digest 방식이 적합하다. Netlify API의 ZIP 추출에는 [25,000개 파일 제한](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)이 있다. 전체 배포 파일 수에는 제한이 없지만 [디렉터리당 54,000개 파일 제한](https://docs.netlify.com/deploy/deploy-overview/)이 있어 정적 출력 검증에서 함께 확인한다.

`build:static`은 입력 추출 → 독립 작업 폴더에서 Next 컴파일·타입 검사·전체 페이지 생성 → 공유 JSON·CSV·헤더 조립 → 파일 전수 검사·로컬 HTTP 검사를 실행한다. 성공한 결과만 `out/`으로 교체하며 조립·검증이 실패하면 이전 출력으로 되돌린다. 전체 명령은 표본 입력을 거절한다.

입력과 보고서는 `.static-build/`에 저장한다. `.static-build/workspace/.next`는 정적 빌드 전용 컴파일 캐시다. 루트의 개발·서버용 `.next`와 분리되어 있다. 입력 파일은 공개 출력에 복사하지 않는다.

## 데이터와 화면

- 식별자·현재 공식 값·순위·이력을 한 번 추출한다. 페이지와 메타데이터는 파일 입력을 읽으며, 렌더링 단계의 DB 조회는 금지한다.
- 초기 HTML은 현재값·기본 분석·SEO를 담고 재무·배당 지표는 기본 분석에서 연도별 기록도 표시한다. 시가총액 상세는 합산·구성 요약을 먼저 제공하고 시총·종가 연도별 표는 공유 이력이 준비되면 채운다. 차트·기간 분석·전체 이력 CSV도 종목과 자료 종류별 공유 JSON을 사용한다.
- JSON은 열 정의와 행 배열로 저장한다. 금융 값·큰 정수·revision은 문자열을 유지한다. PER/EPS와 PBR/BPS는 같은 보조 자료를 참조한다. 종목이 달라도 내용이 같으면 동일한 해시 주소를 사용하며, 파일 생성 시각을 이력 내용에 넣지 않는다.
- 내용 해시가 붙은 JSON·CSV·JS·CSS는 장기 캐시하고, HTML·검색·사이트맵·일반 CSV 주소는 재검증한다. Next 탐색용 RSC `.txt`에는 `text/x-component`를 지정한다. 헤더는 [Netlify `_headers` 규칙](https://docs.netlify.com/manage/routing/headers/)에 맞춰 결과물에 생성한다.
- `start/end`, `scope`, `revision`, `period`는 브라우저에서 기존 규칙으로 해석한다. 초기 HTML의 기본 내용을 보존하는 작은 클라이언트 경계를 사용한다. 뒤로가기와 새로고침도 URL을 기준으로 복원한다.
- 순위 CSV는 공개 범위별 정적 명세로 기준일·revision·행 수를 검증한다. 상세 CSV는 화면의 `start/end` 범위와 무관하게 선택 상장기의 전체 제공 이력을 내보내며 `?period=`의 상장기 경계는 유지한다. 일반 `/ranking-data/*.csv` 주소도 유지한다.
- 시장 일별 CSV는 종목 공개 기준일의 상장 종목 전체를 `/downloads/market/YYYY-MM-DD.csv`로 제공한다. 원시 시가·고가·저가·종가·거래량은 당일 관측만 담는다. 종목 공식값과 종목 순위는 각자의 관측일과 공개 상태를 함께 기록하며, 이전 순위는 현재 순위 칸에 넣지 않는다. 공개 헤더가 있고 대상 종목이 없으면 열 이름만 내려받는다.
- 종목마다 시장과 종목코드로 지표별 대표 HTML을 생성한다. 기업 주소는 보통주의 시장·코드를 우선하고, 우선주만 있는 기업은 해당 종목의 시장·코드를 사용한다. 내부 링크, canonical과 사이트맵이 같은 주소를 가리킨다. 코드 단독·회사명·내부 ID 별칭의 HTML 생성 건수는 0이다.
- 정적 추출은 [상장 기간 기준](security-lifecycle-contract-2026-10-13.md#웹-조회)을 적용한 검색 대상 SID를 `.static-build/search-security-ids.json`에 저장한다. 렌더링은 그 SID로 공개 `/search-data.json`을 만든다. 전체 식별자 목록인 `.static-build/identities.json`은 상폐 종목을 포함한 대표 주소와 사이트맵에 사용한다. [크롤링 규칙](../app/robots.ts)은 공개 JavaScript, CSS와 JSON을 허용한다.
- 대회장은 전체 시장의 동결 순위로 오늘의 장과 가치·배당 종합을 구성한다. ‘1년 전 1위’의 관측 자료는 추출 단계에서 비공개 동결 입력 `data/dashboard-arena-history.json`에 저장한다. 기존 입력에 이 파일이 없거나 대회장 기준일과 다르면 당시 자료 미제공으로 표시한다. [장면별 자료 범위](../.impeccable/surfaces/app-dashboard-page-tsx.md)
- 공통 헤더는 브라우저에서 활성화된 뒤 유휴 시간에 `/search-data.json`을 먼저 요청한다. 첫 목록은 준비가 끝나야 검색할 수 있다. 5분 캐시 만료 후 갱신할 때는 마지막으로 받은 목록을 사용한다. 최근 본은 공유 검색 데이터를 구독한다. 차트 자료의 진행 중 요청과 완료 결과도 공유한다. [현행 검색 동작](../DESIGN.md#search-recent-and-theme)

일반 `/ranking-data/*.csv` 정적 주소는 이번 빌드의 기본 공개 범위를 제공한다. 화면에서 선택한 `scope`·`revision`의 다운로드 검증은 정적 명세와 해시 파일 주소를 사용한다. 정적 파일 서버는 URL 쿼리로 다른 CSV 본문을 계산하지 않는다.

## 비교와 튜닝

```sh
bun run benchmark:static
```

기본 40개 이상 표본에서 고정 입력을 사용해 워커 `2/4/8` × 동시 작업 `2`, 선택한 워커 × 동시 작업 `1/2/4/8`을 비교한다. 각 설정은 같은 컴파일 캐시 조건에서 3회 측정하며 중앙값을 사용한다. 캐시 없는 빌드는 별도로 기록한다. 5% 이내 속도 차이에서는 메모리를 적게 사용하는 설정을 선택한다. 표본 성능은 전체 빌드 완료를 대신하지 않는다.

직접 설정을 비교할 때는 `STATIC_BUILD_CPUS`, `STATIC_BUILD_CONCURRENCY`를 사용한다. 개발 전용 experimental 옵션과 정적 production 옵션은 `next.config.ts`에서 분리한다. 타입 검사와 Next 탐색 파일을 생략하지 않는다.

같은 소스의 완료된 벤치마크가 있으면 `bun run build:static`이 선택된 워커·동시 작업 수를 자동으로 사용한다. 명시한 환경 변수가 우선하며, 유효한 측정이 없으면 `4 × 2`를 사용한다. 소스가 바뀐 과거 측정은 자동 적용하지 않는다. 기존 벤치마크 코드가 출력하는 pnpm 명령 문자열은 아직 남아 있으므로 실행 시 실제 스크립트를 확인해 Bun 호출 규약을 적용한다.

Tailwind는 `app/globals.css`의 명시한 앱 소스 경로만 스캔한다. 독립 작업 폴더에서 의존성·이전 출력·보고서를 훑지 않도록 [명시적 소스 등록](https://tailwindcss.com/docs/detecting-classes-in-source-files)을 사용한다. 다른 최상위 폴더에 화면 코드를 추가하면 해당 `@source`도 등록한다.

이미 추출한 동일 입력으로 다시 빌드하려면 `bun run build:static --reuse`를 사용한다. `manifest.json`과 `search-security-ids.json`이 모두 있을 때 동결 입력을 재사용한다. 둘 중 하나라도 없는 이전 입력은 `--reuse`를 지정해도 DB에서 새로 추출한다. 새로운 영업일에는 기본 `bun run build:static`으로 입력을 새로 추출한다.

검색 필터 반영 여부는 완성된 `out/_static-build.json`의 `snapshotId`를 해당 실행 보고서와 대조하고, `out/search-data.json`에서 상폐 종목이 제외됐는지 확인한다. 정적 페이지 생성은 독립 작업 폴더로 복사한 소스를 사용한다.

브라우저 응답 바이트를 로컬에서 기록하려면 다음 명령을 사용한다.

```sh
bun run preview:static --traffic-report .static-build/reports/browser-traffic.json
```

이 기록은 로컬 브라우저에 실제로 쓴 응답 본문 바이트다. 로컬 Brotli/gzip 압축을 사용하며 HTTP 헤더, Netlify CDN의 실제 압축·캐시·청구량과 구분한다. 캐시 없는 최초 방문은 새 로컬 포트에서 측정한다. 업로드 크기와 방문자 전송량도 서로 다른 수치다.

Legacy Free의 [월 100GB 전송량](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/)은 팀 사이트에서 방문자에게 보낸 [응답 트래픽](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-for-legacy-plans/)을 기준으로 한다. `하루 출력 크기 × 월 배포 횟수`로 계산하지 않는다. 실제 운영 사용량은 업로드 후 사용자가 Netlify Billing에서 확인한다.

## 보고서와 검사

실행별 로그·단계 시간·표본 RSS·디스크 여유는 `.static-build/reports/<실행 ID>/report.json`에 남는다. 마지막 빌드·전수 검사·벤치마크 보고서는 각각 `build-latest.json`, `verify-latest.json`, `benchmark-latest.json`이다. RSS는 측정대상 Node 하위 프로세스를 주기적으로 더한 표본값이며, 조율하는 부모 프로세스·네이티브 하위 프로세스·매우 짧은 최고점은 포함하지 않는다.

```sh
bun run test
bun run typecheck
bun run lint
node scripts/verify-static-input.cjs
```

마지막 명령은 프리징된 DB와 준비한 입력을 대조하는 **읽기 전용 개발 검증**이다. 운영용 파일 미리보기에는 필요하지 않다. 기본 전체 입력에서는 최소 40개 종목과 12개 기업을 대조하며 `--all`은 전체를 대조한다. 금융 문자열·업무일·revision은 그대로 비교하고, ORM/원시 SQL의 감사 시각 표현 차이만 밀리초 ISO 형식으로 정규화한다.

프리징 시스템, 데이터 작성·공개, 자동 스케줄링, Netlify 업로드와 운영 CDN 확인은 이 빌드 도구의 범위 밖이다.
