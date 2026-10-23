# Next.js 안정 버전 업데이트 검증 — 2026-10-23

확인 기준은 2026-10-23(Asia/Seoul)의 공식 npm 레지스트리 `latest`와 Next.js 공식 릴리스·보안 공지다. 의존성 업데이트와 안전하게 가능한 검증을 완료했다. **일반 standalone 전체 프로덕션 빌드는 테스트 DB 부재로 실패했다.** 합성 데이터로 수행한 전체 정적 export 빌드의 성공과 구분해야 한다.

## 버전 및 변경 범위

| 패키지 | 변경 전 | 변경 후 |
| --- | --- | --- |
| `next` | 16.4.0 | 16.4.2 |
| `@next/third-parties` | 16.4.0 | 16.4.2 |
| `eslint-config-next` | 16.4.0 | 16.4.2 |
| Next 내부 의존성 `@next/env`, `@next/eslint-plugin-next`, 플랫폼별 `@next/swc-*` | 16.4.0 | 16.4.2 |
| `react`, `react-dom`, 앱의 `react-is` | 19.3.0 | 19.3.1 |
| `@types/react`, `@types/react-dom` | 19.3.0 | 19.3.0 유지: 레지스트리의 최신 안정 버전 |

시작 시 Git 작업 트리는 깨끗했다. `AGENTS.md`, `.github/copilot-instructions.md`, package/lock/workspace/runtime 설정을 읽었다. 기존 정확한 버전 고정 정책, pnpm 10.34.6, Node 22.23.3, `strictPeerDependencies: true`를 유지했다. 셸 기본 Node는 24.21.0이므로 실제 검증에는 프로젝트가 지정한 기존 Node 22.23.3과 pnpm 10.34.6 실행 경로를 명시했다. 전역 Homebrew pnpm 12의 네트워크 기반 버전 선택에 의존하거나 검증 설정을 끄지 않았다.

`pnpm update`가 선택한 일부 간접 패키지 갱신도 제거했다. 원래 lockfile의 패키지 버전을 우선 재사용하도록 `pnpm install --lockfile-only --prefer-offline`로 다시 해석했다. 최종 lockfile의 패키지 버전 변경은 위 Next/React 계열에 한정된다. React peer 식별자가 바뀌어 lockfile의 여러 snapshot 행이 함께 변경된다. lockfile은 삭제하지 않았다.

`patchedDependencies`, `overrides`, `resolutions`, `patch-package`, 사용자 설치 훅, `.pnpmfile.cjs`, 패치 디렉터리는 발견되지 않았다. Next 원본에 적용할 기존 패치나 버전·해시 우회는 없다.

변경 파일:

- `package.json`: 관련 직접 의존성 6개를 정확한 버전으로 변경.
- `pnpm-lock.yaml`: 해당 의존성과 peer 그래프를 재현 가능하게 갱신.
- `docs/spec.md`: 실제 프레임워크/React/타입 버전과 도구 정책 기록.
- `docs/ui.md`, `docs/service.md`: 현재 런타임 호환성 및 이 검증 기록 연결.
- 이 문서: 공식 근거, 검증 결과와 미검증 범위 기록.

애플리케이션 코드, TypeScript 별칭, ESLint 규칙, 빌드 설정은 수정하지 않았다.

## 공식 릴리스와 호환성

- [npm Next `latest`](https://registry.npmjs.org/next/latest): 16.4.2. `canary`는 16.5.0-canary.24였으며 선택하지 않았다. beta/rc도 선택하지 않았다.
- [npm React `latest`](https://registry.npmjs.org/react/latest)와 `pnpm view react-dom@latest`: 19.3.1.
- [Next 16.4.1 릴리스](https://github.com/vercel/next.js/releases/tag/v16.4.1), 2026-10-14: 아래 세 보안 공지 수정.
- [Next 16.4.2 릴리스](https://github.com/vercel/next.js/releases/tag/v16.4.2), 2026-10-15: Turbopack snapshot 일관성, GC 의존성 정리, lazy dynamic-import chunk 충돌, 모듈 해석 및 code-frame 처리 수정.
- [React 19.3.1 릴리스](https://github.com/react/react/releases/tag/v19.3.1), 2026-10-14: RSC transport protocol 개선.
- [공식 업그레이드 안내](https://nextjs.org/docs/app/getting-started/upgrading)와 [16 마이그레이션 가이드](https://nextjs.org/docs/app/guides/upgrading/version-16)를 확인했다. 설치 전 16.4.0과 설치 후 16.4.2의 `node_modules/next/dist/docs/`에서 upgrading, installation, building, TypeScript/ESLint, static export 및 프로젝트의 Turbopack 설정 문서를 읽었다.

Next의 Node 최소 요구사항은 20.9.0, TypeScript는 5.1.0이다. 사용한 Node 22.23.3/TypeScript 5.9.3이 충족한다. 16 가이드의 비동기 요청 API, `middleware`→`proxy`, 기본 Turbopack 등은 15→16 변경 사항이며, 현재 16.4.0 코드에서 추가 마이그레이션이 필요한 사용은 발견되지 않았다. 이번 패치 릴리스에 별도 breaking change는 명시되지 않았다. codemod는 실행하지 않았다. 개발 전용 `turbopackGc`, `turbopackLazyDynamicImports`, `turbopackPluginRuntimeStrategy` 설정도 설치 버전 문서에서 지원함을 확인하고 유지했다.

실제 설치 트리와 semver 검사에서 다음을 확인했다.

- Next의 React/DOM peer `^19.0.0` 범위에 19.3.1이 포함된다. React DOM의 React peer `^19.3.1`도 충족한다.
- `@next/third-parties`의 Next/React, `eslint-config-next`의 ESLint/TypeScript, React DOM 타입의 React 타입 peer가 모두 충족된다. 설치되지 않은 Next의 선택적 peer를 필수 누락으로 취급하지 않았다.
- 도달 가능한 앱 의존성에서 Next/third-parties/config는 각각 16.4.2 단일 설치, React/DOM은 각각 19.3.1 단일 설치다.
- 기존 ESLint 개발 의존성의 `react-is` 16.13.1은 유지된다. 앱과 Recharts는 19.3.1을 사용한다.
- 실제 Next가 사용하는 `sharp` 0.35.5 및 libvips 8.18.7을 Node 22.23.3에서 네이티브 로딩했다.
- 공식 안정 Next 16.4.2 내부에는 React/RSC transport `19.3.0-canary-278794d7-20261002`가 번들된다. 이는 Next가 배포한 내부 구현이며, 앱의 직접 의존성을 canary로 선택한 것이 아니다. 내부 transport 버전 문자열을 19.3.1로 보고하거나 루트 React 업데이트만으로 Next 내부 보안 수정까지 적용했다고 판단하지 않았다.

## 보안 공지와 실제 사용 조건

[2026-10-14 Next 공식 보안 공지](https://nextjs.org/blog/nextjs-security-update-october-14-2026) 및 각 advisory를 직접 확인했다. 현재 버전 16.4.0은 공지의 버전 범위에 포함되지만, 실제 영향 여부는 사용 기능과 배포 조건에 함께 좌우된다.

| 공지 | 영향 조건 및 수정 | 프로젝트 대조 |
| --- | --- | --- |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), Critical | App Router + Cache Components + 여러 typed array를 반환하는 `use cache`; 16.0.0–16.4.0 영향, 16.4.1 수정 | App Router 사용. `cacheComponents`/`use cache` 사용은 발견되지 않음. `cachedData`는 자체 query wrapper다. |
| [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), Critical / CVE-2026-96889 | SVG 이미지 최적화의 upstream 메모리 문제, glibc Linux 조건. 16.x 공지 범위는 `>16.0.0 <=16.4.0`, 16.4.1 수정. `sharp >=0.35.5` 우회책 | `images.unoptimized: true`, `remotePatterns`/`dangerouslyAllowSVG` 설정 없음. 설치된 sharp 0.35.5 확인. 운영 플랫폼의 libc는 이번 로컬 검사로 단정하지 않음. |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), High | App Router + 최소 하나의 Server Action; 과도한 CPU 사용. 16.0.0–16.4.0 영향, 16.4.1 수정 | Server Actions/`use server` 구현을 발견하지 못함. |

[2026-09-30 보안 공지](https://nextjs.org/blog/september-2026-security-release)도 확인했다. 해당 수정 버전 16.3.8은 기존 16.4.0보다 이전이다. 이미지 remote pattern, SSG/ISR, 중첩 cache, Draft Mode, 개발 MCP 등 조건을 구분했고 이번 업데이트만의 신규 보안 수정으로 계산하지 않았다. exploit 재현은 수행하지 않았으며 악용 가능/불가능을 단정하지 않는다.

## 실행 명령과 결과

아래 pnpm 명령은 기존 pnpm 10.34.6/Node 22.23.3으로 실행했다. DB를 사용할 수 있는 일반 빌드에는 셸 환경에서 합성 loopback URL을 명시하여 `.env`의 DB 설정보다 우선하도록 했다.

```sh
export PATH=/Users/craigchoi/Library/pnpm/nodejs/22.23.3/bin:/Users/craigchoi/Library/pnpm/.tools/pnpm/10.34.6/bin:$PATH
export DATABASE_URL='postgres://next_upgrade_test:local_only@127.0.0.1:1/next_upgrade_test?sslmode=disable'
export PGHOST=127.0.0.1 PGPORT=1
```

위 URL은 테스트용 상수이며 실제 환경파일의 값이 아니다. 환경파일 내용을 출력하거나 변경하지 않았다. 빌드 중 DB 읽기 후보인 검색 JSON, CSV, sitemap을 먼저 확인했고 메일 전송/외부 API 호출 구현은 발견되지 않았다. 폰트는 로컬 파일이다.

| 명령/검증 | 변경 전 | 최종 변경 후 |
| --- | --- | --- |
| `pnpm view … --registry=https://registry.npmjs.org` | 버전·dist-tags·engines·peer 확인 | 안정 목표 버전 존재 확인 |
| `pnpm typecheck` | 통과 | 통과 |
| `pnpm lint` | 오류 28 / 경고 27 | 같은 오류 28 / 경고 27. 로그가 바이트 단위로 동일 |
| `pnpm test` | 308/308 통과 | 308/308 통과 |
| `pnpm test:main` | 전체 test에 포함 | 별도 12/12 통과 |
| `pnpm build` (일반 standalone, loopback DB guard) | 실패 | 동일한 DB 연결 단계 실패 |
| `pnpm list … --depth Infinity --json` + 실제 package/peer/native 로딩 | 기준 설치 트리 저장 | 버전·단일 React 설치·peer·sharp 확인 통과 |
| `pnpm install --frozen-lockfile` | 해당 없음 | 최종 프로젝트 설치 통과 |
| 빈 임시 디렉터리의 `pnpm install --offline --frozen-lockfile` | 해당 없음 | 통과. 설치 전후 lockfile SHA-256 동일 |
| `NEXT_OUTPUT_MODE=export … pnpm build` (합성 fixture) | 미실행 | 전체 정적 export 통과, 45/45 생성 |
| `finalize` + `verifyStatic({allowSample:true,httpAll:true,…})` | 미실행 | 28개 페이지/HTTP URL, 자산 25개, sitemap 3개/정규 URL 19개 통과 |
| 추가 HTTP/데이터 smoke | 미실행 | 18개 통과 |
| `pnpm preview:static --allow-sample --port 0` + 실제 브라우저 | 미실행 | 순위→종목 상세, 검색 입력→기업 결과→기업 상세, 표 펼치기 통과 |

의존성 변경 명령은 다음과 같다. lockfile을 원래 잠긴 간접 버전으로 다시 해석한 뒤 고정 설치와 최종 검사를 반복했다.

```sh
pnpm update next@16.4.2 @next/third-parties@16.4.2 eslint-config-next@16.4.2 \
  react@19.3.1 react-dom@19.3.1 react-is@19.3.1 --save-exact \
  --registry=https://registry.npmjs.org
pnpm install --lockfile-only --prefer-offline --registry=https://registry.npmjs.org
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
```

기존 lint 오류는 `no-explicit-any` 26개와 `no-empty-object-type` 2개다. 관련 없는 기존 코드를 고치거나 규칙을 끄지 않았다. 일반 build는 양 버전에서 컴파일·내장 TypeScript 검사를 통과한 뒤 `/search-data.json` prerender의 `lib/getSearch.ts` DB 조회에서 `ECONNREFUSED 127.0.0.1:1`로 실패했다. `lib/static-build/server.ts`의 동적 파일 경로 tracing 경고 3건도 변경 전부터 존재한다. **이 결과를 일반 전체 프로덕션 빌드 성공으로 보고하지 않는다.**

초기 sandbox 실행에서는 HTTP 테스트 4개가 `listen EPERM`으로 실패했고 Turbopack 빌드가 진행되지 않았다. localhost 생성이 허용된 실행 환경에서 같은 guard로 재실행하여 테스트 308개 통과 및 실제 DB 실패 단계를 확인했다. 레지스트리 DNS 제한도 허용된 네트워크 환경에서 해결했다. 최종 고정 오프라인 설치의 첫 시도는 보존한 예전 간접 tarball이 캐시에 없어 실패했지만, 버전 변경 없이 공식 레지스트리에서 받은 뒤 빈 디렉터리의 오프라인 재설치가 통과했다.

## 경계 검증과 한계

합성 fixture는 기존 `tests/helpers/business-data.cjs`의 메모리 DB와 실제 snapshot/ranking/CSV/asset 생성 함수를 사용했다. 종목·회사 각 1개, 8종 순위, 2일 이력이며 `sample.enabled=true`, `selection=synthetic-next-upgrade`로 표시한다. SQL 연결이나 migration 없이 `/tmp/cd4-next-upgrade-fixture`에 생성했다.

```sh
NEXT_OUTPUT_MODE=export STATIC_PREPARING=0 \
STATIC_SNAPSHOT_DIR=/tmp/cd4-next-upgrade-fixture \
STATIC_BUILD_CPUS=2 STATIC_BUILD_CONCURRENCY=2 pnpm build
```

실제 Next HTML/RSC와 검색 JSON, CSV 8종의 MIME/attachment/행수/revision, 콘텐츠 해시 JSON과 immutable cache, HTML revalidation, 쿼리를 보존하는 308, RSC MIME, 알 수 없는 상세 URL의 404를 확인했다. 실제 브라우저에서 `/per/`의 종목 링크 클릭, 상세의 검색창 열기/문자 입력/기업 결과 선택, 기업 상세의 표 펼치기로 클라이언트 이벤트와 탐색도 확인했다. 전체 페이지/모든 차트 상호작용 또는 브라우저 console 전체를 검사한 것은 아니다.

로그인·인증·Server Actions·Proxy/Middleware·명시적 application redirect 구현은 발견되지 않아 해당 시나리오를 실행하지 않았다. 후행 슬래시/404/이미지의 비최적화 구성은 검증 범위에 포함했다. 실제 DB 데이터·운영 호스트의 SSR/ISR/CDN 재검증·glibc 환경은 확인하지 않았다.

`pnpm test:db`는 실제 migration을 실행하므로 요청에 따라 미실행했다. `pnpm build:static --full` 역시 실제 DB에서 전체 데이터를 추출하므로 안전한 데이터 환경 없이 실행하지 않았다. fixture 정적 export는 이 전체 데이터 검증을 대체하지 않는다. 커밋·푸시·배포·DB migration은 실행하지 않았다. 기존 개발 서버와 `.next/dev`를 보존했고 이번에 띄운 preview 서버와 브라우저 탭은 종료했다.

## 증거 및 운영 반영 전 단계

일시적인 검증 자료:

- `/tmp/cd4-next-upgrade-baseline-{typecheck,lint,test-unsandboxed,build}.log`
- `/tmp/cd4-next-upgrade-{typecheck,lint,test-main,test,build}.log`
- `/tmp/cd4-next-upgrade-reinstall-final.log` 및 lockfile 해시 비교 파일
- `/tmp/cd4-next-upgrade-dependencies-summary.json`, `/tmp/cd4-next-upgrade-dependency-tree.json`
- `/tmp/cd4-next-upgrade-fixture-build.log`
- `/tmp/cd4-next-upgrade-fixture/{create-fixture.cjs,verify-static-result.json,http-smoke-result.json,verification.log,browser-smoke.txt}`

운영 반영 전에는 Node 22.23.3/pnpm 10.34.6에서 운영과 분리된 테스트 DB/데이터로 일반 `pnpm build`를 끝까지 통과시키고 데이터가 포함된 SSR/ISR 및 배포 대상의 캐시 동작을 확인해야 한다. 기존 개발 서버에는 이미 로드된 이전 코드가 있을 수 있으므로 다음 개발 실행 시 재시작해야 한다. 기존 lint 오류는 별도 작업으로 정리해야 한다. 로컬 `out/`은 합성 sample 결과이므로 운영에 사용하지 않는다. 실제 정적 배포가 목적이라면 승인된 데이터 환경에서 정식 전체 추출·빌드·검증을 새로 수행해야 한다.
