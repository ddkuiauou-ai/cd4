# Next.js 16 변경과 검증 결과

2026-10-05, Asia/Seoul. 시작 커밋 `81c9289`에서 사용자가 승인한 [순차 업그레이드 계획](next16-upgrade-assessment-2026-10-05.md)을 실행했다. 최신 안정판 확인 후 의존성을 고정하고, 기존 타입 오류와 실제 호환성 문제를 수정했다. 전량 정적 빌드는 사용자의 결정에 따라 **공간 확보 후 진행**한다.

## 설치한 버전

| 묶음 | 최종 버전 |
| --- | --- |
| Next.js / eslint-config-next / third-parties | 16.3.8 |
| React / React DOM / react-is / React 타입 | 19.3.0 |
| Tailwind / PostCSS | 4.3.3 |
| Recharts / Motion / Jotai | 3.10.1 / 14.0.0 / 3.0.1 |
| Drizzle ORM / Kit | 0.45.3 / 0.31.11 |
| Node / pnpm | 22.23.3 / 10.34.6 |
| ESLint / TypeScript | 9.39.5 / 5.9.3 |

직접 의존성 55개는 exact pin이며 package 선언·lockfile·설치 버전이 일치한다. 전체 선택은 [목표 버전 JSON](next16-upgrade-targets-2026-10-05.json)을 따른다. ESLint 10은 설치된 React plugin의 peer 범위 밖이고, TypeScript 7은 typescript-eslint의 범위 밖이라 호환되는 최신 9.x/5.x를 선택했다. Node 타입은 실행 환경과 같은 22.x, pnpm은 기존 10.x 계열 최신 패치로 고정했다.

`.nvmrc`, `packageManager`, `engines`, `pnpm-workspace.yaml`, 두 배포 workflow의 Node/pnpm을 맞췄다. pnpm의 `useNodeVersion`이 프로젝트 명령을 Node 22.23.3으로 실행한다. 시스템 전역 Node를 바꾸지는 않았다. `strictPeerDependencies: true`와 native build 허용 목록을 설정했고 `pnpm install --frozen-lockfile`을 재현했다. Netlify CLI 등 별도 배포 도구까지 모두 고정했다는 의미는 아니다.

## 구현 변경

- Next 16에서 제거된 `next lint`와 Next config의 `eslint` 옵션을 ESLint CLI/native flat config로 전환했다. 기존 타입 오류 8개를 해결하고 `ignoreBuildErrors`를 제거해 빌드의 타입 검사를 복구했다. sitemap params는 Promise/await 계약에 맞췄다. [공식 전환 가이드](https://nextjs.org/docs/app/guides/upgrading/version-16)
- 활성 금융 조회를 공통 캐시 정책으로 모았다. 서버는 300초, 종목 코드 목록은 24시간 재검증한다. Date는 cold/warm/dev/export 모두 ISO DTO로 통일한다. DB 실패는 정상 빈 결과로 저장하지 않고 오류를 전달한다.
- 정적 export는 서버의 영속 Data Cache를 재사용하지 않는다. 실제 빌드 자료를 읽으며, worker마다 조회별 최대 32개 Promise를 보관해 중복 조회를 줄이고 실패 항목은 제거한다. CI는 금융 Data Cache를 제외하고 Turbopack compiler cache만 재사용한다.
- 정적 배포를 유지하기 위해 Cache Components/`use cache`와 React Compiler를 활성화하지 않았다. 서버 캐시의 `unstable_cache`는 호환 API로 유지했다. 미참조 legacy 후보 18개의 직접 캐시 호출 정리는 별도 작업이다. [unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache), [정적 export 제한](https://nextjs.org/docs/app/guides/static-exports)
- Recharts 3의 공개 `usePlotArea`/`useYAxisScale`로 내부 axis map 참조를 교체했다. 차트의 조건부 Hook 10개, 입력 배열을 직접 정렬하는 문제, DPS grid 축 지정도 수정했다.
- 2,882개 검색 항목을 네 layout의 페이지별 props에서 `/search-data.json` 한 개로 분리했다. 검색 메뉴를 열 때 가져오고 300초 동안 공유한다. 동시 요청을 합치고 실패 후 재시도를 제공한다. 기업·종목 검색의 기존 잘못된 경로도 실제 ticker 경로로 고쳤다.
- export 경로 생성에서 현재 시가총액이 없는 활성 종목을 포함하고 상장폐지 기업을 제외했다. 검색 대상과 생성 코드 목록의 누락은 0개다. 시가총액의 현재 집계가 없을 때는 실제 과거 이력의 금액·날짜를 사용한다. 날짜나 0원을 만들어 채우지 않는다.
- 지표 경로의 활성 보통주 68개 누락을 보완했다. 그중 이력이 없는 10개도 존재하는 종목으로 다룬다. PER/PBR/EPS/BPS/DIV/DPS의 정상 무이력은 안내 화면, 존재하지 않는 코드는 404, DB 실패는 오류로 구분한다.
- 회사·종목·대시보드·종목 시가총액 랭킹의 canonical/OG URL을 실제 경로에 맞췄다. `/marketcaps/`는 홈과 같은 화면이라 홈 canonical을 유지한다. 정적 sitemap에서 오류 페이지와 검색엔진 소유권 확인 문서를 제외했다.

## 최종 검증

최종 집계와 실제 HTTP 결과는 [검증 JSON](next16-verification-results-2026-10-05.json)에 기록한다.

| 검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 성공, strict peer 설정 적용 |
| `pnpm test` | 81/81 통과, skip 0 |
| `pnpm typecheck`와 Next build의 타입 검사 | 통과 |
| 서버 `pnpm build` | 성공, 326개 생성 경로 |
| 생성된 standalone 서버 | public/static 포함, 대표 경로 39개·sitemap 분할 8개 통과 |
| 대표 정적 export | 18개 동적 페이지 계열, 88개 생성 경로·83개 콘텐츠 URL 통과 |
| 실제 브라우저 | 검색→기업·보통주·우선주 이동, 차트, 테마, CSV, 390px 모바일 확인 |
| 전체 `pnpm lint` | 기존 오류 205개·경고 213개가 남음 |

회귀 테스트는 캐시 실패/회복·정상 무이력·Date DTO·SSG params·실제 지표 페이지의 404 구분·Recharts DOM·검색 공유 요청/실패 재시도·메타데이터·정적 sitemap을 다룬다. 설치된 lock 패키지 887개의 peer 조건 288개와 Node engine에 충돌이 없음을 별도 대조했다.

lint는 통과로 간주하지 않는다. 남은 error는 기존 `any` 196개, empty object type 5개, prefer-const 4개이며 parse/Hook 순서 오류는 없다. React Compiler 도입에 관련된 새 진단 41개는 warning으로 표시하고 Hook 순서 규칙은 error로 유지했다. 전체 위치와 규칙은 [lint 부채 JSON](next16-lint-debt-2026-10-05.json)에 보존했다.

## 대표 정적 빌드 범위

검증 복사본은 `/private/tmp/cd4-next16-export-verification`에 있다. 원본의 18개 `generateStaticParams`를 그대로 호출한 뒤, 반환 목록에서 선택한 종목과 랭킹의 1·2·마지막 페이지만 남겼다. DB 조회·TTL·렌더링 코드는 같다. CI처럼 복사본의 두 서버 sitemap route만 제외하고 정적 sitemap을 생성했다. 원본 페이지 수를 줄이는 조건은 추가하지 않았다.

삼성전자·삼성전자우·SK하이닉스·KOSDAQ 종목, 현재 시가총액이 없는 이력 종목 `KOSDAQ.0001A0`, 지표 이력이 0건인 `KOSDAQ.0010F0`를 포함한다. 출력은 589개 파일·약 87.7 MiB이고, 콘텐츠 URL 83개를 모두 HTTP 200 및 canonical/OG 일치로 확인했다. 무이력 6개 지표는 안내 화면, 없는 종목 코드는 404로 확인했다. 표본 설정·원본 hash·최종 출력 수는 [검증 JSON](next16-verification-results-2026-10-05.json)을 따른다. **이 표본의 `out`은 전량 배포 산출물이 아니다.**

## 확인한 크기 개선

검색 데이터 분리 전후의 Next 16 서버 출력에서 같은 322개 HTML 페이지를 비교했다. HTML + full RSC + segment RSC + metadata의 압축 전 논리 크기는 약 **1,579 MiB → 811 MiB, 48.6% 감소**했다. 삼성전자 기본 종목 페이지는 약 95.1%, 종목 시가총액 페이지는 약 63.3% 줄었다. 검색 JSON은 약 527 KiB를 한 번 가져온다. [측정값과 계산](next16-artifact-comparison-2026-10-05.json)

이는 **검색 데이터 중복 제거의 효과**다. Next 15 대 Next 16의 순수 성능 비교가 아니며, 압축된 실제 HTTP 전송량·CDN 비용·LCP 개선을 측정한 값도 아니다. cold/warm 빌드 로그를 보존했으나 타입 검사와 캐시·DB 상태가 달라 버전만의 속도 향상으로 단정하지 않는다.

## 남은 작업과 운영 조건

현재 DB 기준 export 후보는 상세 27,784 + 목록 218 + 핵심 2 = **28,004개**다. 표본의 크기를 가중한 추정은 단일 페이지 payload 약 26 GiB, `.next`와 `out` 복사 시 약 52 GiB이며 compiler·의존성·추가 파일 공간은 별도다. 상위 종목 표본의 편향이 있어 확정 요구 용량은 아니다. 사용자 지시에 따라 전량 빌드는 공간 확보 후 진행한다.

전량 검증 시에는 완료된 동일 DB 자료와 충분한 여유 공간을 준비하고, 새 복사본에서 대표 경로 filter 없이 CI의 sitemap 제거 → `NEXT_OUTPUT_MODE=export pnpm build` → `NEXT_OUTPUT_MODE=export pnpm sitemap`을 실행한다. 실제 페이지·전체 파일 수, 출력 크기, peak memory, 경로별 HTTP와 실패 로그를 확인한 뒤 호스팅 업로드를 진행한다.

업그레이드는 금융 데이터 수집·집계 상태를 갱신하지 않는다. 읽기 전용 조회 당시 현재 금융 집계·순위의 기준일은 2025-09-22, KOSPI/KOSDAQ 원시 이력은 2026-10-02였다. DAG의 최종화·공개 계약을 지켜야 같은 기준일의 자료를 배포할 수 있다. 정적 사이트는 성공한 재빌드·배포 뒤에 새 자료가 공개된다.

대시보드의 `/news`, `/watchlist`, `/screener`, `/compare`, `/portfolio`, `/alerts` 미구현 링크는 기존 상태이며 새 기능을 추가하지 않았다. 기존 lint와 미참조 의존성 정리, React Compiler 도입, 실제 호스팅 비용·CDN 정책 확인은 후속 항목이다. 이번에는 DB 쓰기·migration·운영 배포·workflow 실행을 하지 않았다.
