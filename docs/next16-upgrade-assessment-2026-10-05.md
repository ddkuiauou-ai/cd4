# Next.js 16 업그레이드 현황과 실행 계획

기준일: 2026-10-05, Asia/Seoul. 조사 대상: cd4 `main`, 시작 커밋 `81c9289`, 시작 작업 트리 clean. 이 문서는 **업데이트 전 현황 조사와 승인된 실행 계획**이다. 아래의 현재 버전·오류 수는 조사 당시 기준이다. 같은 날 실행한 변경과 최종 결과는 [업그레이드 검증 기록](next16-upgrade-verification-2026-10-05.md)에서 확인한다.

관련 기록: [기존 인수인계](upgrade-handoff.md), [메인 복구 검증](main-recovery-verification-2026-10-05.md), [랭킹 복구 검증](ranking-fix-verification-2026-10-05.md). 이전 기록의 타입 오류 8개는 현재도 재현되지만, 공통 캐시와 회귀 테스트는 이후 추가된 상태다.

## 판단: 정적 배포를 기본안으로 유지

사용자는 비용이 허용되면 Vercel을 고려하지만, 댓글·사용자 쓰기 기능 없이 공개 정보를 보여주는 서비스라 정적 파일 배포를 생각하고 있다고 설명했다. 현재 제품과 코드에는 **Next.js 16 + 정적 export + CDN**을 기본안으로 권한다. 호스팅 업체의 최종 선택과 실제 운영 경로는 아직 확정하지 않았다.

- 배치로 계산한 동일 금융 데이터를 모든 사용자에게 제공한다. 방문마다 Node 서버와 DB를 거치게 할 필요가 작다.
- 정적 HTML에도 검색, 차트, 테마, CSV 같은 브라우저 상호작용을 유지할 수 있다. 댓글 유무보다 **갱신 빈도, 허용 지연, 개인화, 전체 빌드 비용**이 서버 필요성을 결정한다.
- DB 갱신 후 검증된 자료로 빌드·배포해야 공개 화면이 바뀐다. 데이터 최종화가 끝나기 전에 만드는 export에는 서로 다른 기준일이 섞일 수 있다.
- Next.js 16의 Cache Components/PPR는 서버가 필요한 기능이다. 현재 목표를 위해 전역 활성화하지 않는다. 전체 재빌드가 요구된 갱신 시간 안에 끝나지 않을 때 Vercel의 SSG/ISR 등 서버 지원 배포를 다시 비교한다.

현재 [Next 설정](../next.config.ts:9)은 기본 `standalone`, `NEXT_OUTPUT_MODE=export`에서 정적 출력이다. [R2](../.github/workflows/deploy-r2.yml:51)와 [Netlify](../.github/workflows/deploy-netlify.yml:63) workflow는 모두 export 후 `out`을 업로드한다. 두 경로는 수동 실행이며, 어떤 경로가 현재 운영인지 설정 파일만으로 확정할 수 없다.

### 비용을 고려한 호스팅 비교

2026-10-05 공식 공개 요금 확인. 실제 계정의 기존 플랜·청구·트래픽은 확인하지 않았다. 금액은 USD이며 실제 월 비용 예측값이 아니다.

| 선택지 | 확인한 요금 조건 | 이 서비스에서의 판단 |
| --- | --- | --- |
| Vercel | Pro 월 $20부터, 포함 사용 크레딧 $20. 사용량 항목 추가 비용 가능 | Next 운영 편의와 ISR이 가치 있을 때 선택. Vercel에서도 정적 생성 가능하며 호스팅 선택이 곧 매 요청 SSR을 뜻하지 않음. [공식 가격](https://vercel.com/pricing) |
| Vercel Hobby | 무료지만 개인·비상업용 제한 | 광고 등 수익화 시 무료 운영 전제로 잡지 않음. [공식 조건](https://vercel.com/docs/plans/hobby) |
| Netlify | 현재 공개 credit 플랜 Free 300/월, Personal $9·1,000/월. production 배포 15 credits/회, 전송 20/GB, 요청 2/10,000 | 정적 파일도 배포·트래픽 비용이 존재. 월 22회 production 배포를 가정하면 배포만 330 credits로 Free 한도를 초과한다는 계산. 기존 계정에 이 요금이 적용되는지는 별도 확인. [공식 가격](https://www.netlify.com/pricing/) |
| Cloudflare R2 + CDN | Standard 무료 범위 10 GB-month, 쓰기 계열 100만회, 읽기 계열 1,000만회. R2 egress 무료 | 저장소에 이미 R2 배포 경로가 있어 저비용 후보. CDN miss 읽기·업로드·저장과 연결된 Worker 등 다른 서비스 비용은 별도. [공식 가격](https://developers.cloudflare.com/r2/pricing/) |
| Cloudflare Workers Static Assets | 정적 asset 요청 무료·무제한, asset 저장 추가 요금 없음. Worker 실행 요청은 별도 과금 | 추후 대안. export의 실제 **파일 수**와 플랫폼 한도를 먼저 대조하고, 이번 Next 업그레이드와 호스팅 이전은 분리. [공식 과금](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |

따라서 비용 최소화는 기존 R2/CDN 정적 경로를 우선 평가하고, Netlify는 배포 편의와 실제 계정 요금·트래픽을 확인해 선택한다. 파일 업로드·도메인·CDN 설정까지 포함한 관리 부담이 월 $20 이상의 가치가 있다면 Vercel도 충분히 합리적이다. 현재 정보만으로 어느 업체의 최종 청구액이 가장 낮다고 단정하지 않는다.

## 버전 현황과 목표 조합

직접 의존성 55개를 package 선언·lockfile·로컬 설치와 대조했고 불일치는 없었다. 최신 값은 2026-10-05 11:53:43 KST의 npm 공식 registry `latest` dist-tag 기준이다. canary/beta/rc/preview는 목표에서 제외했다. 전체 metadata와 출처는 [의존성 조사 JSON](next16-dependency-audit-2026-10-05.json)에 저장한다.

| 패키지 | 현재 설치 | 조회한 latest | 1차 Next 전환 목표 |
| --- | --- | --- | --- |
| `next` | 15.5.4 | 16.3.8 | 16.3.8 |
| `eslint-config-next` | 15.5.4 | 16.3.8 | 16.3.8 |
| `@next/third-parties` | 15.3.2 | 16.3.8 | 16.3.8 |
| `react` / `react-dom` | 19.1.1 | 19.3.0 | 같은 19.3.0으로 묶음 |
| `@types/react` / DOM | 19.1.15 / 19.1.5 | 모두 19.3.0 | 모두 19.3.0 |
| `eslint` | 9.27.0 | 10.12.0 | **9.39.5** |
| `typescript` | 5.9.2 | 7.0.2 | **5.9.3** |
| Tailwind / PostCSS | 모두 4.1.7 | 모두 4.3.3 | 후속 CSS 묶음 |
| `@types/node` | 24.5.2 | 26.6.4 | 선택한 Node runtime major에 맞춤 |

Next/React 조회 근거: [Next registry](https://registry.npmjs.org/next/latest), [React registry](https://registry.npmjs.org/react/latest). 실제 설치 성공·런타임 정상은 metadata만으로 증명되지 않는다. 실행일에는 최신 **16.x 안정판**을 다시 조회하고 확정 버전을 기록한다. 그때 `latest`가 다른 major를 가리키더라도 그대로 설치하지 않는다.

ESLint와 TypeScript는 전체 latest를 바로 선택할 수 없다. Next 16.3.8이 의존하는 `eslint-plugin-react@7.37.5`는 ESLint 10을 peer 범위에 포함하지 않고, `typescript-eslint@8.71.0`은 TS `>=4.8.4 <6.1.0`을 요구한다. ESLint 9.39.5는 maintenance 태그, TS 5.9.3은 5.x 안정 최신으로 선택한 호환 목표다. [React plugin peer](https://registry.npmjs.org/eslint-plugin-react/latest), [TypeScript ESLint 지원](https://typescript-eslint.io/users/dependency-versions/).

기존 third-parties 15.3.2는 Next 16을 peer 범위에 포함하지 않으므로 유지한다면 Next와 동반 교체한다. root layout에 GoogleAnalytics import가 있지만 현재 렌더링 사용까지 확인한 것과는 구분한다.

실행 환경은 로컬 Node 22.14.0·pnpm 10.7.1, CI는 Node `20`·pnpm `9`다. package의 `engines`·`packageManager` 및 버전 파일이 없다. Next 16 최소 Node 20.9·TS 5.1은 로컬이 충족한다. 우선 동일 Node 22 계열의 지원되는 패치와 pnpm 10을 로컬·CI에서 고정하는 것을 제안하며, 런타임 전체 최신화는 별도 호환성 검토로 다룬다.

## Next.js 16에서 실제 영향을 받는 부분

아래 필수 변경은 [공식 16 업그레이드 가이드](https://nextjs.org/docs/app/guides/upgrading/version-16) 및 현 코드와 대조했다.

| 구분 | 현재 근거 | 후속 조치 |
| --- | --- | --- |
| 필수 | [package scripts](../package.json:10) `next lint` | ESLint CLI로 변경하고 generated output ignore 설정 |
| 필수 | [Next config](../next.config.ts:19) `eslint.ignoreDuringBuilds` | 제거된 `eslint` 옵션 삭제 |
| 필수 | [flat config](../eslint.config.mjs:13) `FlatCompat.extends` | 16의 native flat exports를 import/spread. 낡은 .eslintrc 두 파일과 의도 통합. [공식 ESLint 설정](https://nextjs.org/docs/app/api-reference/config/eslint) |
| 필수 | [분할 sitemap](../app/sitemaps/[segment]/sitemap.xml/route.ts:45) 동기 params | Promise 타입과 await 적용 |
| 기준선 수정 | [root metadata](../app/layout.tsx:85), 지표 6페이지의 nullable keywords | 기존 타입 오류를 먼저 해결하고 업그레이드 회귀와 분리 |
| 이미 대응 | 동적 page의 params·metadata 대부분 Promise/await | sitemap 제외 전면 변환 필요성 작음 |
| 이미 대응 | [config](../next.config.ts:24) 최상위 turbopack, dev/build 모두 Turbopack | 기본 bundler 전환 자체의 추가 이익은 제한적 |
| 유지 후 검증 | experimental `cpus`, `memoryBasedWorkersCount`, `optimizePackageImports` | 16.3.8에서도 유효. 일괄 제거/최상위 이동하지 않음. [공식 schema](https://github.com/vercel/next.js/blob/v16.3.8/packages/next/src/server/config-schema.ts) |
| 영향 제한 | [images.unoptimized](../next.config.ts:12) | 현재는 이미지 optimizer 기본값 변경이 직접 적용되지 않음. BaseImage `priority` deprecated 정리는 실제 LCP와 함께 후속 검토 |
| 미발견 | middleware, Parallel Routes @slot, 동적 OG/icon 생성, generateSitemaps, dynamicIO/PPR, 서버 cookies/headers/draftMode | 발견하지 못한 기능을 위한 임의 새 구조 추가 없음 |

현재 `typescript.ignoreBuildErrors: true`라 빌드 성공은 타입 검사 통과를 의미하지 않는다. 독립 검사 통과 후 이를 제거해 이후 회귀를 빌드에서 막는 방향을 권한다.

두 sitemap Route Handler는 Request URL을 사용하고 `revalidate=0`이다. CI는 export용 checkout에서 sitemap route 디렉터리를 제거하고 별도 JS 스크립트로 정적 sitemap을 만든다. 로컬 export 검증도 **분리된 복사본**에서 이 조건을 재현해야 한다. 원본 route 디렉터리를 삭제해 검증하지 않는다. Netlify sitemap 단계에 `NEXT_OUTPUT_MODE=export`가 없는 기존 누락도 이 단계에서 수정 대상이다. [정적 export 제한](https://nextjs.org/docs/app/guides/static-exports).

## 캐시 현황: API 이름보다 갱신 계약을 먼저 정비

TypeScript AST 호출식과 앱·components·lib의 참조를 조사했다. 미참조 판정은 삭제 후보를 뜻하며 외부 사용까지 부재를 증명하지 않는다.

| 항목 | 조사 결과 |
| --- | --- |
| `unstable_cache` 호출식 | 45: 직접 44 + 공통 wrapper 1 |
| `cachedData` 적용 함수 | 6 |
| 직접 44의 재검증 주기 | 미지정 32 / 3,600초 6 / 86,400초 6 |
| 캐시 export 50 중 코드 참조 확인 | 활성 32 / 미참조 legacy 후보 18 |
| 활성 직접 캐시 26 | 주기 미지정 20 / 86,400초 6 |
| `generateStaticParams` | 19개 |
| route segment `revalidate` | sitemap 두 곳의 0 |
| `cacheComponents`, `use cache`, `cacheLife`, `cacheTag` | 미사용 |
| `revalidateTag`, `revalidatePath`, `updateTag` 호출 | 앱·lib·scripts에서 미발견 |

공통 [cachedData](../lib/data/cache-policy.ts:4)는 namespace `financial-data-v2`, 300초, 개발 DB 직접 조회를 구현한다. 회사 목록·총수, 종목 랭킹·총수·가격, 헤더 검색 6개에 적용되어 있으며 기존 회귀 테스트가 있다.

반면 실제 상세 페이지에서 쓰는 `getSecurityByCode`, `getCompanySecurities`, 지표/시총 이력, `getCompanyAggregatedMarketcap` 등의 직접 캐시 20개에는 주기가 없다. [종목 조회](../lib/data/security.ts:346), [회사 집계](../lib/data/company.ts:180). 일부는 예외를 `null` 또는 `[]`로 바꿔 정상 결과처럼 저장한다. 일시 DB 장애가 오래된 빈 화면·404로 이어질 위험이며, 메인에서 이미 적용한 오류 전파 계약을 확대하는 것이 우선이다.

태그만 붙이는 것은 자동 갱신이 아니다. 공식 API의 주기 생략은 무기한 캐시다. 페이지 캐시가 다시 생성되어도 상세 Data Cache의 이전 결과를 다시 읽을 수 있다. [unstable_cache 계약](https://nextjs.org/docs/app/api-reference/functions/unstable_cache).

### 정적 빌드에서 우선 해결할 캐시 문제

1. **새 export가 현재 DB를 읽게 한다.** 빌드 간 캐시를 복원하면서 무기한 금융 조회 결과까지 복원하면 새 배포에도 옛 데이터가 들어갈 수 있다. export에서 persistent 데이터 캐시를 우회하고 빌드 내 중복 조회를 줄이거나, 검증된 데이터 snapshot을 namespace/key에 포함하는 구현을 검토한다. DB를 페이지마다 불필요하게 재조회하는 방식은 피한다.
2. **출력 모드가 캐시 키에 반영되어야 한다.** [코드 생성 helper](../lib/select.ts:388)는 함수 내부 환경변수로 서버 상위 10개와 export 전체 종목을 나눈다. `keyParts`와 인자에는 모드가 없다. 같은 캐시를 복원하며 모드를 바꾸면 다른 모드의 목록을 재사용할 위험이 있어, 모드별 키/namespace 또는 우회로 해결한다. 아직 잘못된 export를 실증한 것은 아니다.
3. **실패는 배포 중단으로 이어져야 한다.** [static params](../app/security/[secCode]/per/page.tsx:92)의 예외→빈 목록, 상세 조회의 예외→null을 구분해 실제 DB 장애로 페이지·sitemap이 누락된 산출물을 공개하지 않는다. 정상 데이터 없음은 별도 정상 상태다.
4. **컴파일 캐시와 금융 데이터 캐시를 구분한다.** `.next/cache` 복원은 빌드를 빠르게 하지만 신선도 검증을 대체하지 못한다. 금융 조회가 snapshot/모드로 격리된 뒤 compile cache를 CI에서 유지한다.
5. **공개 CDN 캐시까지 확인한다.** [vercel.json](../vercel.json)의 광범위 Cache-Control과 R2/CDN 실제 HTML 캐시 설정을 대조한다. 금융 데이터 주기 300초만으로 사용자 화면 반영 지연을 보장할 수 없다. HTML·sitemap 갱신, 해시 JS/CSS 장기 캐시, 배포 전환·되돌리기를 함께 검증한다.

정적 export에서는 런타임 서버 재검증·ISR이 작동하지 않는다. 최신 자료를 공개하는 주체는 성공한 빌드와 배포다. 수집·집계 파이프라인의 기준일 계약은 그대로 유지하며 새 webhook/DB 스키마 시스템을 업그레이드 필수 작업으로 추가하지 않는다.

### 데이터 타입 계약

설치된 Next 15 캐시 엔진으로 격리 메모리 fixture를 실행한 결과, 첫 조회의 Date는 cache hit에서 ISO string으로 바뀌고 Map은 `{}`가 되며 객체의 undefined 속성은 빠진다. 단독 undefined 반환은 양쪽 모두 undefined다. 구현의 JSON 저장/복원과 일치한다.

현재 캐시 결과에서 Map 반환은 발견하지 않았으므로 현행 Map 장애로 판단하지 않는다. Date는 [회사 DTO](../lib/data/company.ts:47) 등에서 Date로 선언되어 warm 값과 계약이 다르다. 반환 DTO를 일관된 ISO string/null 등으로 정리하고 기준일·updatedAt·KST 표시와 CSV가 cold/warm에서 같은지 검증한다.

## 16의 성능 이점을 얻을 수 있는 부분

| 항목 | 기대할 이점 | 적용 판단·검증 |
| --- | --- | --- |
| 최신 Turbopack과 파일시스템 캐시 | 재실행 dev와 반복 build에서 중복 컴파일 감소 | 16.3은 build 파일 캐시가 기본 활성화. 실제 cache 복원 필요. 전체 SSG DB 조회·렌더링이 같은 비율로 빨라진다고 보장하지 않음. [공식 캐시 문서](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache), [CI 캐시](https://nextjs.org/docs/app/guides/ci-build-caching) |
| 공유 layout·prefetch 개선 | 랭킹/기업/종목 간 이동의 중복 전송 감소 | 기본 업그레이드 후 production 탐색 네트워크로 측정. 새 요청 수보다 총 전송량·이동 지연을 비교. [공식 routing 변경](https://nextjs.org/docs/app/guides/upgrading/version-16#enhanced-routing-and-navigation) |
| React Compiler | 차트·필터 상호작용의 불필요 렌더 감소 후보 | 정적 배포에서도 가능. 먼저 기존 조건부 Hooks 오류 해결, 선택 컴포넌트 opt-in으로 profile. 자동 전역 활성화는 보류. 빌드 시간 증가도 측정. [공식 설정](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler) |
| `use cache` + PPR | 서버 배포에서 캐시된 shell·필요한 동적 영역 조합 | 정적 기본안에서는 도입하지 않음. 서버 지원 배포로 전환할 때만 별도 검증 |

과거 문서의 27,945페이지·15–20분은 지금 측정한 수치가 아니다. export는 [전체 코드 목록](../lib/select.ts:391)을 사용하므로 전체 규모가 커질 수 있다. 최신 DB snapshot으로 생성 URL 수와 **HTML/RSC/JS 등 총 파일 수**, 산출물 크기, compile/render/upload 각 시간을 새로 재야 한다.

## 순차 실행 계획

각 단계는 별도 diff/검증 기록을 남기고 이전 단계의 완료 조건을 확인한 뒤 진행한다. 설치·업그레이드는 후속 실행 작업이다.

| 순서 | 작업 범위 | 완료 조건 |
| --- | --- | --- |
| 1. 환경·검사 기준 정리 | Node/pnpm 고정, scripts에 독립 typecheck/소스 lint/전체 기존 웹 테스트 추가. 기존 타입 8개 및 차트 조건부 Hooks 10개 수정. CJS 테스트의 Node 환경 설정, generated output ignore 정리. Next 15의 성능 기준선 수집 | 타입 0개, Hooks 위반 0개, 기존 웹 테스트 21개 통과. 동일 snapshot/환경에서 15의 clean/warm build·artifact 규모·대표 화면 지표 기록. 지금 DB 접근이 안 되면 재현 가능한 15 checkout과 lockfile을 보존해 양쪽을 나중에 비교. 나머지 lint 부채는 파일/규칙별 기록; 전체 lint가 미통과면 전체 검사 완료로 표시하지 않음 |
| 2. Next 핵심 전환 | 정확한 16.x 목표로 upgrade codemod를 검토·실행. Next/React/DOM/types/Next lint/third-parties 묶음 설치. ESLint 9/TS 5 유지. removed config·async sitemap·native flat config 대응 | lock/설치/peer 재현, typecheck·회귀 통과. 16의 native flat config로 소스 lint 재실행, Hooks 0·기존 부채 대비 신규 오류 0. `cacheComponents` 기본 비활성. codemod diff와 설치본 bundled docs 확인 |
| 3. 조회·export 신선도 정비 | 실제 사용하는 상세 캐시 20개 우선. 실패 전파, Date DTO, export 빌드의 snapshot/모드 키와 중복 조회 정리. Netlify sitemap env 누락 수정 | 같은 snapshot의 cold/warm 결과·metadata/HTML/CSV 일치. 장애 시 이전 정상 산출물 보존, 실패 빌드 공개 차단. DB 변경 후 새 export가 이전 캐시를 재사용하지 않음 |
| 4. 두 모드 기능 검증 | 유지되는 서버 모드의 build/start, 분리 checkout의 export build·정적 파일 serve. SSR sitemap 제거 조건은 복사본에서만 재현 | 홈·dashboard·회사/종목 순위 1/2페이지·대표 상세 6지표·검색·차트·CSV·404·SEO/sitemap·다크/모바일 정상. 서버의 미생성 params와 정적 URL 누락 확인 |
| 5. 성능·비용 정비 | 동일 snapshot/하드웨어에서 전후 clean/warm build. 금융 캐시 격리 후 CI compile cache 복원. 실제 artifact 규모와 월 배포/트래픽으로 호스팅 비교 | 생성 페이지/파일·최대 메모리·DB query·build/upload 시간, LCP/INP/CLS·JS/RSC 전송량 기록. 개선 수치는 측정으로만 보고 |
| 6. 나머지 라이브러리 최신화 | CSS/UI → DB → 차트/애니메이션/상태·도구 순으로 묶음. 큰 major는 각각 별도 변경 | 묶음별 peer/type/lint/해당 UI 검증. DB 묶음은 기존 쿼리·날짜·금액·null·관계 결과 보존. schema migration/push는 자동 실행하지 않음 |
| 7. 선택 최적화·문서 반영 | Hooks 해결 후 Compiler 제한 도입 측정. 완료 상태에 맞춰 README/spec/service/개발·배포 문서 현행화 | 향상된 동작과 실제 명령·버전·배포 절차 일치. 운영 배포는 로컬 검증과 구분해 실제 결과 기록 |

단계 2 전에는 공식 codemod 안내와 실제 옵션을 확인한다. 목표 버전 명시, 안전한 checkout 사용, 광범위 `pnpm update --latest` 금지가 원칙이다. codemod의 canary 채널 사용은 마이그레이션 도구 선택이며 앱에 canary Next를 설치한다는 뜻이 아니다. 버전 맞춤 문서는 16.2+의 `node_modules/next/dist/docs/`를 기준으로 갱신한다.

### 나머지 라이브러리 묶음

| 묶음 | 현재 → 조사 latest | 별도 확인할 점 |
| --- | --- | --- |
| CSS/UI | Tailwind/PostCSS 4.1.7→4.3.3, tailwind-merge 3.3.0→3.7.0, tw-animate-css 1.3.0→1.4.0, Radix 각각 patch/minor | 레이아웃·다크모드·모바일·popup/focus. Nivo 0.99, d3 7.9 등은 이미 latest |
| DB | Drizzle ORM 0.43.1→0.45.3, Kit 0.31.1→0.31.11, postgres 3.4.6→3.4.9 | 활성 adapter는 postgres-js. Drizzle 1.0은 rc/beta라 제외. pg/libSQL은 import 조사상 정리 후보 |
| 차트 | Recharts 2.15.3→3.10.1, lightweight-charts 5.0.8→5.2.1 | [Customized](../components/chart-company-marketcap.tsx:309)의 yAxisMap/offset 주입 제거에 맞춰 축 생략 표시 재구현. [공식 3.0 migration](https://github.com/recharts/recharts/wiki/3.0-migration-guide) |
| 애니메이션·아이콘·상태 | Motion 12.23.22→14.0.0, Lucide 0.511.0→1.52.0, Jotai 2.12.4→3.0.1 | 별도 major. Lucide 다수 화면 사용, Jotai는 Provider 외 atom 사용 미발견 |
| 개발 도구 | shadcn 2.5.0→4.21.1, dotenv 16.5.0→18.0.5, jsdom 26.1.0→30.1.2 | shadcn CLI 설치로 복사 UI가 자동 갱신되지 않음. jsdom latest는 Node 요구가 현재 환경보다 높아 사용 필요성과 runtime 전환 먼저 검토 |

### 향후 서버 배포를 선택할 때의 추가 단계

정적 경로를 그대로 둔 채 전역 `cacheComponents: true`를 켜지 않는다. 공식 `use cache` 지원표는 Static export No를 명시한다. [지원표](https://nextjs.org/docs/app/api-reference/directives/use-cache#platform-support).

서버 운영으로 범위를 확정하면 16 기본 전환이 통과한 뒤 다음을 별도 수행한다.

1. 공통 wrapper의 directive 치환 대신 실제 async 조회 함수에 `use cache`, `cacheTag`, 금융 데이터 profile을 정의한다. `stale`은 브라우저 허용 시간, `revalidate`는 요청 기반 background refresh, `expire`는 다음 요청이 새 값을 기다릴 시점이며 TTL 하나와 동일하지 않다. [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife).
2. route `dynamic/revalidate/fetchCache` 설정, top-level DB/params await, metadata와 Suspense 경계를 함께 전환한다. flag는 전역이라 함수 한 개 실험이라도 관련 전체 route가 검증 대상이다. [이전 가이드](https://nextjs.org/docs/app/guides/migrating-to-cache-components).
3. `use cache` 기본 메모리 저장과 배포별 키 때문에 서버 재시작·serverless instance에서 DB 조회가 늘 수 있다. 실제 topology와 DB 부하를 보고 handler 필요성을 결정한다. 외부 캐시 시스템을 선제 추가하지 않는다. [저장 동작](https://nextjs.org/docs/app/api-reference/directives/use-cache#runtime-caching-considerations).
4. 기존 Date/undefined, 중첩 캐시 수명, 인스턴스 재시작, 오류 후 복구를 실제 16 build/start에서 검증한다. 기존 Next 내부 storage 테스트만으로 새 directive 동작을 인증하지 않는다.
5. 새 무효화 연결이 제품에 필요할 때 `revalidateTag(tag, 'max')`와 즉시 만료 `{ expire: 0 }`를 선택한다. `updateTag`는 Server Action 전용이라 외부 수집 프로그램에 바로 적용하지 않는다. [공식 revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag).

## 이번에 실제 실행한 검사

| 검사 | 결과 | 해석 |
| --- | --- | --- |
| `pnpm test:main` | 11 passed | 기존 메인 캐시·dashboard 격리 회귀 |
| `node --test tests/ranking-data.test.cjs` | 10 passed | 기존 랭킹 격리 회귀. test:main script에는 포함되지 않음 |
| `pnpm exec tsc --noEmit --incremental false --pretty false` | exit 2, 기존 8개 | sitemap params 1, nullable metadata 6, 중복 metadataBase 1. 기존 .next/types 포함; 새 build typegen 결과 아님 |
| 소스 한정 ESLint | 195 files, 263 errors, 175 warnings, fatal 0 | any 211, empty-object 5, Hooks 10, prefer-const 4, require-imports 32, display-name 1. warnings unused 172 + font 1 + deps 2 |
| repository 전체 `eslint .` | 중단 | 기존 설정이 큰 .next 출력도 순회. 전체 lint 결과로 사용하지 않음 |
| Next 15 캐시 타입 fixture | Date/Map/undefined cold/warm 확인 | 업무 DB가 아닌 메모리 fixture; Next16 동작 인증 아님 |
| 전체 build·실제 DB·브라우저·운영 배포·청구 | 이번 조사에서 미실행/미확인 | 소스/registry 조사와 단위 회귀가 성공한 전체 운영을 증명하지 않음 |

소스 lint 명령:

```sh
pnpm exec eslint app components config db hooks lib types typings.ts next.config.ts drizzle.config.ts scripts tests --format json
```

타입·소스 lint·테스트 요약과 기존 오류 위치는 [검사 기준선 JSON](next16-baseline-2026-10-05.json)에 보관한다. 전체 웹 테스트 21개 통과를 Next16 업그레이드 완료로 표시하지 않는다. 현재 완료된 것은 업그레이드 현황 파악과 단계별 계획이다.
