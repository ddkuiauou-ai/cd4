# 라이브러리 최신화와 문서 현행화 인수인계

기준일: 2026-10-04, Asia/Seoul. cd4 기준 커밋은 `5ceb6c2`(커밋일 2025-10-04)이다. 이 문서는 현재 체크아웃의 소스·설정·lockfile·설치된 패키지를 확인한 기록이다. 이후 별도 채팅에서 라이브러리를 업데이트하고 기존 문서를 현행화할 때 출발점으로 사용한다. 여기에 적힌 버전은 조사 당시 프로젝트 버전이며, 인터넷에서 확인한 최신 버전이 아니다.

- 서비스 목적·화면·현재 이슈: [프로젝트 현황](./project-current-state.md)
- 수집·계산·DB·웹 반영 계약: [DAG 연동](./dag-integration.md)
- 주식 파이프라인 소스: [DAG의 CD 처리](../../dag/dag/cd_metrics_processing.py), [DAG 스케줄](../../dag/dag/schedules.py)

## 이번에 완료한 범위와 후속 작업의 경계

이번 작업은 현황 조사와 문서 작성이다. 라이브러리 설치·업데이트, 코드 오류 수정, lockfile 재생성, DB 스키마 변경, 마이그레이션, DAG 실행, 빌드·운영 배포는 수행하지 않았다. 아래 작업 순서와 검증 항목은 후속 작업 제안이며 완료 내역이 아니다.

사용자는 별도 채팅에서 라이브러리 최신화 후 문서 싱크를 진행할 계획을 밝혔다. 따라서 새 채팅은 이 문서를 읽고 해당 채팅의 실제 작업 요청·현재 Git 상태를 확인한 뒤 진행한다. 이 문서는 DB 변경·파이프라인 실행·운영 배포에 대한 자동 승인으로 사용하지 않는다. Drizzle 업데이트 자체와 Drizzle migration/push 실행은 서로 다른 작업이다.

## 버전 기준선

[package.json](../package.json)의 선언 범위, [pnpm-lock.yaml](../pnpm-lock.yaml)의 루트 importer 해석 결과, 로컬 `node_modules/<패키지>/package.json`의 설치 버전을 각각 확인했다. `^` 범위는 설치된 버전을 뜻하지 않는다. 아래 lockfile 버전은 peer dependency 식별자를 생략한 주 버전 표기다. 핵심 항목은 선언·lockfile·설치 결과가 서로 일치했다.

| 역할 | 패키지 | package.json 선언 | lockfile 해석 | 로컬 설치 |
|---|---|---|---|---|
| 프레임워크 | `next` | `15.5.4` | `15.5.4` | `15.5.4` |
| UI 런타임 | `react` / `react-dom` | 각각 `^19.1.1` | 각각 `19.1.1` | 각각 `19.1.1` |
| Next 외부 스크립트 | `@next/third-parties` | `^15.3.2` | `15.3.2` | `15.3.2` |
| 타입 검사 | `typescript` | `^5.9.2` | `5.9.2` | `5.9.2` |
| 린트 | `eslint` | `^9` | `9.27.0` | `9.27.0` |
| Next 린트 설정 | `eslint-config-next` | `15.5.4` | `15.5.4` | `15.5.4` |
| ESLint 호환 계층 | `@eslint/eslintrc` | `^3` | `3.3.1` | `3.3.1` |
| CSS | `tailwindcss` / `@tailwindcss/postcss` | 각각 `^4` | 각각 `4.1.7` | 각각 `4.1.7` |
| ORM | `drizzle-orm` | `^0.43.1` | `0.43.1` | `0.43.1` |
| 스키마 도구 | `drizzle-kit` | `^0.31.1` | `0.31.1` | `0.31.1` |
| 활성 PostgreSQL 드라이버 | `postgres` | `^3.4.6` | `3.4.6` | `3.4.6` |
| 추가 PostgreSQL 의존성 | `pg` | `^8.16.0` | `8.16.0` | `8.16.0` |
| 남아 있는 libSQL 의존성 | `@libsql/client` | `^0.15.7` | `0.15.7` | `0.15.7` |
| 차트 | `recharts` | `^2.15.3` | `2.15.3` | `2.15.3` |
| 차트 | `lightweight-charts` | `^5.0.8` | `5.0.8` | `5.0.8` |
| 차트 | `@nivo/core` / `@nivo/heatmap` | 각각 `^0.99.0` | 각각 `0.99.0` | 각각 `0.99.0` |
| 시각화 기반 | `d3` | `^7.9.0` | `7.9.0` | `7.9.0` |
| 애니메이션 | `motion` | `^12.23.22` | `12.23.22` | `12.23.22` |
| 상태 | `jotai` | `^2.12.4` | `2.12.4` | `2.12.4` |
| 컴포넌트 도구 | `shadcn` | `^2.5.0` | `2.5.0` | `2.5.0` |
| Node 타입 | `@types/node` | `^24.5.2` | `24.5.2` | `24.5.2` |
| React 타입 | `@types/react` | `^19.1.15` | `19.1.15` | `19.1.15` |
| React DOM 타입 | `@types/react-dom` | `^19.1.5` | `19.1.5` | `19.1.5` |

Radix UI 패키지는 별도 버전으로 선언되어 있으며, UI 전체를 하나의 버전으로 취급하면 안 된다. 선언·lockfile에는 dialog `1.1.14`, dropdown-menu `2.1.15`, tabs `1.1.12`, tooltip `1.2.7` 등이 있다. 전체 직접 의존성과 peer dependency 조합은 package.json과 lockfile이 기준이다. `shadcn` 패키지 업데이트만으로 [components/ui](../components/ui)의 복사된 컴포넌트 코드가 자동으로 최신화되지는 않는다.

실제 앱 DB 연결은 [db/index.ts](../db/index.ts)의 `drizzle-orm/postgres-js` + `postgres`이다. PostgreSQL 설정은 [drizzle.config.ts](../drizzle.config.ts)를 사용한다. `@libsql/client`와 [Turso 스키마](../db/schema-turso.ts)가 남아 있다는 사실만으로 현재 운영이 Turso를 사용하는 것으로 판단하지 않는다.

### Node·pnpm 기준

| 위치 | 확인된 값 | 해석 |
|---|---|---|
| 현재 로컬 실행 환경 | Node `22.14.0`, pnpm `10.7.1` | 이번 타입 검사를 실행한 환경 |
| R2·Netlify GitHub Actions | Node `20`, pnpm `9` | 두 workflow의 설정값이며 실제 runner 실행 이력은 미확인 |
| lockfile | `lockfileVersion: '9.0'` | lockfile 형식 버전; pnpm 실행 버전과 동일 개념이 아님 |
| package.json | `engines`, `packageManager` 없음 | 저장소가 Node/pnpm 실행 버전을 명시적으로 고정하지 않음 |
| 버전 파일 | `.nvmrc`, `.node-version`, `.tool-versions` 미발견 | 조사한 저장소 기준 |
| 기존 README | Node `18+` | 현 workflow의 Node 20·로컬 Node 22와 구분 필요 |

근거: [package.json](../package.json), [R2 workflow](../.github/workflows/deploy-r2.yml), [Netlify workflow](../.github/workflows/deploy-netlify.yml), [README](../README.md).

후속 최신화에서는 먼저 목표 프레임워크가 지원하는 Node·pnpm 조합을 공식 문서로 확인하고 로컬·CI 기준을 맞춘다. 현재 설치된 `@types/node`가 24라는 사실은 Node 런타임을 24로 사용한다는 뜻이 아니다.

## 실행 스크립트와 설정의 실제 상태

현재 package.json에 있는 scripts는 아래 5개뿐이다.

| 명령 | 실제 내용 | 후속 작업에서 확인할 점 |
|---|---|---|
| `pnpm dev` | `next dev -H 0.0.0.0 --turbopack` | 프레임워크 업데이트 후 dev 동작과 터보 설정 |
| `pnpm build` | 메모리 12GB 옵션·telemetry 비활성화 후 `next build --turbopack` | 기본 output은 `standalone`; export는 환경 변수로 선택 |
| `pnpm start` | `next start` | standalone 산출물의 실제 기동 방식과 일치 여부 확인 |
| `pnpm lint` | `next lint` | 목표 Next 버전에서 CLI 지원과 ESLint 실행 방식을 확인 |
| `pnpm sitemap` | `node scripts/generate-sitemap.js` | `NEXT_OUTPUT_MODE=export`일 때만 실행 |

README·기존 문서의 `db:migrate`, `cache:revalidate`, `build:ssg`, `build:chunks`, `build:staggered`, `build:parallel-real`, `deploy`, `lint:fix`는 현재 package.json에 정의되어 있지 않다. 이 명령들을 검증 명령으로 복사해서 사용하면 안 된다. 현재 scripts 디렉터리에는 병렬·청크 빌드용 shell 파일도 없다.

[next.config.ts](../next.config.ts)는 `typescript.ignoreBuildErrors: true`와 `eslint.ignoreDuringBuilds: true`를 설정한다. 따라서 빌드 성공만으로 타입 검사·린트 통과를 판단할 수 없다. `tsconfig.json`은 strict와 noEmit이 켜져 있고 기존 `.next/types/**/*.ts`를 검사 대상에 포함한다.

ESLint 설정은 [eslint.config.mjs](../eslint.config.mjs), [.eslintrc.json](../.eslintrc.json), [.eslintrc.mjs](../.eslintrc.mjs)가 공존하며 규칙도 다르다. 후속 작업에서는 실제 CLI가 읽는 설정을 확인하고 단일 기준으로 정리한다. Tailwind도 [postcss.config.mjs](../postcss.config.mjs), [app/globals.css](../app/globals.css)의 v4 CSS 설정, [tailwind.config.js](../tailwind.config.js)가 함께 있다. 남아 있는 설정 파일의 존재만으로 모든 설정이 적용된다고 가정하지 않는다.

## 배포 모드에 따른 검증 차이

[next.config.ts](../next.config.ts)는 `NEXT_OUTPUT_MODE=export`면 정적 export, 그 외에는 `standalone`을 선택한다. [vercel.json](../vercel.json)과 [VERCEL_SETUP.md](../VERCEL_SETUP.md)가 남아 있고, 별도로 R2·Netlify workflow가 존재한다. 소스에서 복수 경로를 확인했지만, 현재 운영 도메인이 어떤 경로로 배포되었는지와 최신 성공 배포 시각은 확인하지 않았다.

| 경로 | 코드상 동작 | 최신화 시 주의점 |
|---|---|---|
| 기본 빌드 | `standalone`; 동적 sitemap route 유지 | 서버 기동·route handler·캐시 동작 검증 필요 |
| R2 workflow | self-hosted, 수동 실행, `NEXT_OUTPUT_MODE=export`, `out` 업로드 | 빌드 전에 SSR sitemap 디렉터리 제거; sitemap 단계에도 export 환경 변수 전달 |
| Netlify workflow | self-hosted, 수동 실행, export 빌드 후 `out` 배포 | 빌드 전에 SSR sitemap 디렉터리 제거; sitemap 단계에는 export 환경 변수 없음 |
| Vercel 설정·문서 | Vercel 설정 파일과 안내 문서 존재 | 문서의 output `out` 설명과 실제 기본 `standalone` 설정을 대조할 필요 |

두 GitHub Actions는 `workflow_dispatch`만 활성화되어 있고 push 트리거는 주석이다. 최신화 검증이 workflow를 실행하거나 배포가 발생한다는 뜻은 아니다.

Netlify의 `NEXT_OUTPUT_MODE: export`는 Build step의 env에만 정의되어 있다. Generate sitemap step에는 동일 env가 없고, [scripts/generate-sitemap.js](../scripts/generate-sitemap.js) 167–169행은 이 값이 없으면 성공 코드로 생성을 건너뛴다. 별도 runner 환경 주입이 없다면 Netlify 경로에서는 sitemap을 생성하지 않는다는 코드상 추론이다. 실제 runner의 환경과 배포 산출물은 미확인이다. R2 경로는 sitemap step에 export 값을 명시한다.

export 빌드는 정적 페이지 생성 과정에서 DB 접근이 필요하다. DAG가 DB를 갱신해도 이미 배포된 `out`의 HTML은 새 빌드·배포가 있어야 바뀐다. 서버 모드에서는 조회 캐시·페이지 캐시·CDN 캐시를 함께 확인해야 한다. 라이브러리 업데이트 과정에서 캐시 API만 바꾸고 데이터 공개 흐름을 완료했다고 판단하지 않는다. 갱신 연결의 상세 계약은 [DAG 연동 문서](./dag-integration.md)를 따른다.

workflow의 `rm -rf app/sitemap.xml app/sitemaps`는 CI checkout에서 export용 route를 제거하는 처리다. 로컬 검증에 그대로 복사하여 원본 route를 삭제하지 않는다. 두 모드를 모두 유지할지 실제로 쓰는 경로만 유지할지는 후속 작업에서 운영 경로 확인 후 정한다.

## 실제 검증 내역과 미확인 항목

| 구분 | 이번 조사에서 한 일 | 결과 |
|---|---|---|
| 의존성 | package.json·lockfile·핵심 로컬 패키지 메타데이터 확인 | 위 버전 기준선 확보; 설치 변경 없음 |
| 실행 환경 | `node` 버전·`pnpm --version` 확인 | Node `22.14.0`, pnpm `10.7.1` |
| 타입 검사 | 아래 noEmit 명령 실행 | exit code 2, 기존 오류 8건 |
| DB 읽기 | 공유 조사에서 읽기 연결 시도 | sandbox에서 `EPERM`, 허용된 재시도에서 `EHOSTUNREACH`; DB 상태 확인 실패 |
| 라이브러리 최신 버전 | 외부 조회하지 않음 | 후속 채팅에서 공식 문서·release note 확인 필요 |
| lint·전체 build | 실행하지 않음 | 성공·실패 결과 없음 |
| UI·운영 배포·DAG 실행 | 실행하지 않음 | 검색·차트·최신 데이터·배포 동작은 미검증 |

실행한 타입 검사 명령:

```sh
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
```

| 기존 오류 | 위치 | 관찰 내용 |
|---|---|---|
| TS1117, 1건 | [app/layout.tsx](../app/layout.tsx), 17·85행 | 같은 metadata 객체에 `metadataBase` 중복 선언 |
| TS2322, 6건 | [bps](../app/(market)/bps/page.tsx), [div](../app/(market)/div/page.tsx), [dps](../app/(market)/dps/page.tsx), [eps](../app/(market)/eps/page.tsx), [pbr](../app/(market)/pbr/page.tsx), [per](../app/(market)/per/page.tsx), 각각 39–41행 부근 | metadata keywords에 들어가는 `latestDate`가 `string \| null`인데 `string` 요구 |
| TS2344, 1건 | `.next/types/validator.ts` 315행 → [동적 sitemap route](../app/sitemaps/[segment]/sitemap.xml/route.ts), 43–47행 | 생성된 validator는 `params: Promise<{ segment: string }>`를 요구하나 GET context가 동기 params로 선언됨 |

이 결과는 현재 설치 버전과 기존 `.next/types`를 포함한 체크아웃에서의 기준선이다. 깨끗한 새 빌드를 통해 route 타입을 재생성한 결과는 아니다. 업데이트 후 생성 타입 오류가 달라지면 기존 기준선과 신규 회귀를 구분한다. 타입 오류가 있다는 이유로 `as any`나 검사 무시를 추가하기보다 실제 nullable 데이터·route 계약에 맞춰 수정한다.

DB 연결 실패 때문에 최근 거래일, 테이블별 최신 날짜, 실제 행 수, 동일 기준일 여부, 실제 수집 성공 시각은 확인하지 못했다. 기존 로그·문서의 페이지 수와 빌드 성능 수치는 현재 환경에서 재측정한 값으로 취급하지 않는다.

## 기존 문서의 불일치 목록

아래는 이번에 찾은 문서 현행화 대상이다. 기존 문서 전체를 옳다고 인증하거나 모든 불일치를 빠짐없이 검사한 목록은 아니다. 이 작업에서는 원본 문서를 일괄 수정하지 않고 후속 변경의 근거로 보존했다.

| 문서 | 문서의 내용 | 현재 코드·설정과의 차이 | 후속 갱신 방향 |
|---|---|---|---|
| [README](../README.md) | CD3, Next 15, SSR 우선, Vercel, Node 18+ | 실제 폴더는 cd4; package name은 `cd3`; 기본 standalone + export workflow가 공존 | 서비스 명칭·저장소 명칭을 구분하고 실제 운영 모드·런타임을 확정 |
| README | DB migration·cache revalidate·SSG 병렬·deploy 명령 | 현재 package scripts에 없음 | 실제 실행 가능한 명령만 안내 |
| README | DB 연산을 `lib/select.ts`, `insert.ts`, `update.ts`, `delete.ts`에 집중 | 현재 조회는 `lib/data/*`, `lib/getSearch.ts`, sitemap utilities에도 있음; insert/update/delete 파일 미발견 | 현재 코드 책임 분리로 구조 설명 수정 |
| [spec](./spec.md) | Next `15.3.2`, React `19.0.0` | 실제 Next `15.5.4`, React `19.1.1` | 업데이트 완료 후 선언·lockfile 기준 버전 표로 교체 |
| spec | PostgreSQL을 `@libsql/client`로 표기 | 활성 연결은 postgres-js; libSQL은 별도 드라이버 | DB adapter·스키마·운영 연결을 정확히 구분 |
| spec·[development-guidelines](./development-guidelines.md)·[copilot instructions](../.github/copilot-instructions.md) | SSR 우선, Vercel 중심, DB 연산 4개 파일 규칙 | export 경로와 분산 조회 모듈 존재 | 실제로 유지할 개발 규칙을 코드와 함께 맞춤 |
| [service](./service.md) | 실시간 데이터, 100개 단위 페이지, Vercel Postgres·Turso 지원, `/api/*` endpoint 목록 | DAG 배치·정적 공개 경로가 존재; 나열된 API route 파일 미발견 | 현재 사용자 동작·갱신 주기·실제 route 중심으로 재작성 |
| service·spec | 이미지 자동 WebP/AVIF 최적화, 분석·모니터링 연동 설명 | `images.unoptimized: true`; GA·AdSense는 layout에서 import만 확인 | 설정·실제 렌더링·운영 관측 근거를 구분 |
| [VERCEL_SETUP](../VERCEL_SETUP.md) | `out` 출력, Vercel 자동 배포, 페이지 수·시간·디스크 측정치 | vercel.json에 해당 output 설정 없음; 기본 standalone; 최신 운영 상태·측정 미확인 | 선택한 배포 방식 기준으로 교체하고 측정 시점 표기 |
| [.env.example](../.env.example) | site URL·revalidation·analytics 예시 | 구현의 실제 환경 변수 소비·상수 설정과 대조 필요; revalidation endpoint 미발견 | 실제 필수 변수·선택 변수·실행 단계 구분; 비밀 값 제외 |
| [ui](./ui.md) | 광범위한 UI 가이드와 예시 | 현재 globals.css·components/ui·다양한 차트 구현과 직접 대조 필요 | 전체를 구현 사실로 간주하지 않고 적용 중인 규칙과 예시를 구분 |
| [market-analysis](./market-analysis.md) | `lib/market-utils.ts`의 RSI·MACD·MA 등을 구현 설명 | 해당 모듈 미발견 | 사용 중인 기능인지 확인 후 구현 기록 또는 제안 문서로 정리 |

기존 문서에 적힌 609페이지·100종목 테스트, 1,500+ URL, 27,945페이지, 15–20분 등의 수치는 과거 문서·로그의 주장이다. 후속 검증에서 생성 페이지 수·DB snapshot·빌드 모드·Node/pnpm·측정 일시를 함께 기록해야 현재 결과와 비교할 수 있다.

## 후속 채팅의 권장 작업 순서

1. **현재 상태와 운영 경로 확정.** 이 문서·프로젝트 현황·DAG 연동을 읽고 Git 변경, 실제 사용하는 배포 모드, DB 접근 가능 환경을 확인한다. 목표 버전의 공식 지원 범위를 보고 Node/pnpm을 로컬과 CI에 맞춘다.
2. **업데이트 전 기준선 분리.** 위 타입 오류를 재현하고 기존 오류를 별도 변경으로 해결하거나 명시적으로 추적한다. lint의 실제 실행 설정·전체 기존 오류도 필요할 때 기록한다. 기존 실패를 새 버전의 회귀로 혼동하지 않는다.
3. **최신 목표 버전 조사.** 작업 시점의 Next·React·TypeScript·ESLint·Tailwind·Drizzle 및 차트 라이브러리 공식 문서와 release note를 확인한다. 지원하는 peer dependency·Node 범위를 보고 목표 버전을 정한다. 이 문서에는 최신 목표 버전을 선결정하지 않는다.
4. **서로 연결된 패키지 묶음으로 변경.** Next·React·React DOM·Next lint/third-parties·타입을 함께 검토하고, CSS 도구, ORM/driver, 차트/UI를 이어서 검토한다. 각 묶음에서 선언·lockfile과 필요한 코드 수정의 목적을 남긴다. 의존성 정리는 실제 import·기능 사용 여부를 확인한 뒤 한다.
5. **앱과 데이터 계약 검증.** 허용된 읽기 환경에서 두 빌드 모드 중 유지하는 모드와 주요 화면을 검증한다. API·캐시·static params가 변해도 DAG의 기준일·지표·종목 식별자 계약을 보존하는지 확인한다. 스키마 변경이 필요하면 DAG 영향을 별도 검토한다.
6. **코드 확정 후 문서 현행화.** README의 실행 경로·버전, spec의 설정·구조, service의 실제 기능·갱신, development-guidelines/copilot의 규칙, 배포 가이드를 업데이트한다. 현재 문서의 역사적 기준선은 날짜를 유지하고 새로운 상태 문서에 검증 일시·근거를 남긴다.

각 묶음이 완료될 때 필요한 검증을 먼저 통과시킨다. 모든 직접 의존성을 한꺼번에 올린 뒤 오류 원인을 찾는 방식보다 변경과 결과를 연결하기 쉽다. 단, 패키지별 순서는 목표 버전의 호환 제약을 우선한다.

## 후속 검증 항목과 완료 기준

아래는 아직 실행하지 않은 후속 검증 제안이다. DB 접근이나 배포 권한이 필요한 검증은 해당 환경을 확인한 뒤 수행한다.

| 검증 | 확인할 내용 | 완료 근거 |
|---|---|---|
| 설치 재현 | 합의한 Node/pnpm에서 `pnpm install --frozen-lockfile` | lockfile 임의 변경 없이 설치 성공; 선언·해석·설치 일치 |
| 타입·린트 | 독립 `tsc --noEmit`과 실제 ESLint 명령 | 기존 오류 처리 상태와 신규 오류를 구분한 통과 기록 |
| dev·server 모드 | dev 시작, 유지할 server 빌드·실제 기동, 동적 sitemap | 실행 로그와 주요 route 응답; 생성 route 타입 재검사 |
| export 모드 | 유지할 export 빌드, sitemap 생성, `out` route 존재 | 결과물 수와 생성 조건 기록; 원본 route 파일 삭제 없이 검증 |
| 주요 사용자 동작 | 홈, 기업/종목 시총, 6개 재무지표 순위, 상세 차트, 페이지 이동, 검색, 최근 본 종목, 공유·CSV | 모바일·PC의 실제 동작 기록; 현재 검색의 구 경로 이슈 해결 여부 포함 |
| 표시 데이터 | 기업 합산·개별 종목 구분, 값·단위·날짜·순위 방향 | 읽기 가능한 DB snapshot과 화면의 비교; DAG 계약 일치 |
| SEO·수익화 | canonical·metadata·sitemap·robots·구조화 데이터, 실제 광고/분석 렌더링 | 출력 확인; 활성화 여부는 실제 제품 범위에 따라 기록 |
| 문서 싱크 | 실행 명령·runtime·버전·DB adapter·route·배포 경로 | 코드·설정과 일치한 문서, 미확인 운영 사실 별도 표시 |

후속 라이브러리 최신화가 끝났다는 기준은 선택한 목표 버전의 호환성을 확인하고, 설치를 재현하며, 독립 타입·린트와 유지하는 배포 모드·주요 동작이 검증된 것이다. 문서 싱크의 완료 기준은 실행할 수 없는 명령과 존재하지 않는 API를 현행 기능처럼 안내하지 않고, 데이터 갱신·배포·캐시 경로를 코드와 같은 언어로 설명하는 것이다.

DB·운영 접근이 끝내 불가능한 항목은 통과 처리하지 않는다. 수행한 명령·결과, 미검증 항목, 필요한 환경을 새 기준일과 함께 남긴다. 라이브러리 업데이트 성공은 순위 정의 정합성 개선이나 DAG→웹 자동 갱신 구현의 완료를 대신하지 않는다.
