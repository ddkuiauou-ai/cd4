# Vercel 배포 선택 가이드

기준일: 2026-10-05. 현재 기본안은 Next.js 정적 export와 CDN 배포다. R2·Netlify workflow가 저장소에 있으며, Vercel 프로젝트의 현재 연결·플랜·운영 상태는 별도로 확인해야 한다. 호스팅 판단과 버전 전환 범위는 [Next.js 16 실행 계획](docs/next16-upgrade-assessment-2026-10-05.md)을 따른다.

## 런타임과 설치

Node.js는 `.nvmrc`의 정확한 22 계열 버전, pnpm은 `package.json`의 `packageManager`에 고정된 10 계열 버전을 사용한다. Vercel 프로젝트의 Node major도 같은 계열로 설정한다.

- Framework: Next.js
- Install Command: `pnpm install --frozen-lockfile`
- 서버 빌드: `pnpm build`
- 로컬 production 검사: `pnpm build` 후 `pnpm start`

기존 `vercel.json`은 `icn1` 지역과 installCommand 및 Cache-Control headers를 포함한다. 저장소 파일만으로 실제 Vercel 프로젝트의 배포 모드나 dashboard override를 확정하지 않는다.

## 데이터베이스 읽기 환경

빌드 및 서버 조회에 필요한 PostgreSQL 읽기 권한을 구성한다. `db/index.ts`는 아래 연결 문자열 또는 분리된 환경 변수 전체를 사용한다.

```text
DATABASE_URL=postgres://[user]:[pwd]@[host]:5432/[db]
```

```text
POSTGRES_HOST=<database-host>
POSTGRES_PORT=5432
POSTGRES_USER=<read-user>
POSTGRES_PASSWORD=<password>
POSTGRES_DB=<database-name>
```

데이터 수집·집계가 끝난 snapshot을 읽고 종목 식별자·기준일 계약을 보존한다. 이 앱의 라이브러리 업그레이드로 DB migration이나 스키마 push를 자동 실행하지 않는다.

## 정적 export와 서버 모드

`NEXT_OUTPUT_MODE=export`는 완전 정적 파일을 `out`에 생성한다. 이 모드의 새 금융 데이터는 재빌드와 배포로 반영되며 ISR·Cache Components는 사용하지 않는다. 요청 URL을 읽는 SSR sitemap Route Handler는 export용 checkout에서 제외하고 `NEXT_OUTPUT_MODE=export pnpm sitemap`으로 정적 sitemap을 만든다. 로컬 검증은 복사본에서 진행해 원본 route 소스를 보존한다.

Vercel에 export를 배포하려면 export용 준비 단계·build 환경 변수·`out` output 설정을 명시적으로 맞춰야 한다. 현재 기본 `pnpm build`는 `NEXT_OUTPUT_MODE`가 없는 경우 standalone 서버 출력이다. 기본 명령만 실행하고 `out`이 생긴다고 가정하지 않는다.

서버 지원 배포는 Vercel의 Next.js 통합을 사용한다. `output` 설정과 Vercel 프로젝트 요구를 배포 시점의 공식 문서 및 preview build로 확인한다. 서버에서의 SSG/ISR 도입과 캐시 재검증은 정적 export 전환과 별도 변경으로 검증한다. [Vercel Next.js 문서](https://vercel.com/docs/frameworks/full-stack/nextjs), [Next 정적 export](https://nextjs.org/docs/app/guides/static-exports).

## 캐시와 신선도

R2·Netlify CI는 `.next/cache/turbopack` 컴파일 산출물만 복원한다. 금융 조회 결과를 다음 export의 데이터로 복원하지 않는다. Next.js 16.3의 build 파일 캐시 기본 활성화는 DB 신선도나 전체 정적 렌더 속도를 보장하지 않는다. [공식 Turbopack 캐시](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache).

기존 `vercel.json`의 광범위 HTML Cache-Control은 브라우저 1시간, CDN 24시간 및 stale-while-revalidate를 지정한다. 운영 배포 전에 실제 response header와 갱신 요구를 대조해 정책을 결정한다. query TTL만으로 공개 HTML 반영 지연이 결정되는 것은 아니다. 해시가 붙은 JS/CSS는 장기 캐시하고 HTML·sitemap의 새 배포 전환과 되돌리기를 확인한다.

`use cache`는 공식 지원표에서 Static export 미지원이다. 서버 배포를 선택할 때만 Cache Components·Suspense·metadata·캐시 저장과 재시작 동작을 함께 검증한다. [공식 지원표](https://nextjs.org/docs/app/api-reference/directives/use-cache#platform-support).

## 배포 전 검증

동일 snapshot에서 `pnpm lint`, `pnpm typecheck`, `pnpm test`, 전체 build와 주요 화면을 검증한다. 홈·dashboard·회사/종목 순위·상세 지표·검색·차트·CSV·404·metadata/sitemap·모바일·다크모드를 포함한다.

과거 기록의 27,945페이지, 15–20분, 90 GB는 현재 재측정값이 아니다. 실제 생성 URL·총 파일 수·산출물 크기·메모리·build/upload 시간으로 플랫폼 한도와 비용을 평가한다. 플랜·요금·build 한도는 선택 시 공식 현행 안내와 실제 계정을 확인한다. [Vercel 가격](https://vercel.com/pricing).

로컬 build 성공과 운영 공개 성공을 구분한다. Git push가 자동 배포를 유발하는지는 실제 프로젝트 연결·branch 설정에서 확인하며, production 배포는 별도 운영 작업으로 기록한다.
