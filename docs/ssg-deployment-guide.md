# CD3 Project - SSG 배포 가이드

## 🚀 Static Site Generation (SSG) 최적화

CD3 프로젝트는 주식 데이터 특성상 하루 1회 업데이트가 적합하므로 완전 SSG로 구성되었습니다.

### 📋 주요 특징

- **완전 정적 사이트**: 모든 페이지가 빌드 시점에 미리 생성
- **일일 자동 업데이트**: 매일 오전 6시 자동 재빌드
- **최적화된 캐싱**: 24시간 캐시 정책으로 빠른 로딩
- **SEO 최적화**: 정적 페이지로 검색엔진 최적화

### 🏗️ 빌드 과정

1. **데이터 수집**: 모든 종목 코드와 회사 정보 수집
2. **페이지 생성**: `generateStaticParams`로 동적 페이지 미리 생성
3. **정적 내보내기**: `next export`로 완전 정적 파일 생성
4. **배포**: CDN에 정적 파일 배포

### 📦 생성되는 페이지

#### 종목별 페이지 (약 3,000개 종목 × 7개 페이지)

- `/security/[secCode]` - 종목 상세
- `/security/[secCode]/eps` - EPS 분석
- `/security/[secCode]/per` - PER 분석
- `/security/[secCode]/pbr` - PBR 분석
- `/security/[secCode]/div` - 배당 분석
- `/security/[secCode]/dps` - DPS 분석
- `/security/[secCode]/bps` - BPS 분석

#### 회사별 페이지 (약 2,500개 회사 × 7개 페이지)

- `/company/[secCode]` - 회사 상세
- `/company/[secCode]/marketcap` - 시가총액 분석
- 기타 재무지표 페이지

#### 랭킹 페이지 (각 지표별 약 100페이지)

- `/per/[page]` - PER 랭킹
- `/pbr/[page]` - PBR 랭킹
- `/marketcaps/[page]` - 시가총액 랭킹
- 기타 지표별 랭킹 페이지

**총 예상 페이지 수: 약 50,000+ 페이지**

### ⚙️ 설정

#### 1. 환경 변수 설정

```bash
cp .env.example .env.local
```

필수 환경 변수:

- `DATABASE_URL`: 데이터베이스 연결 문자열
- `NEXT_PUBLIC_SITE_URL`: 사이트 URL
- `REVALIDATION_TOKEN`: 캐시 무효화 토큰

#### 2. 로컬 빌드 테스트

```bash
# 개발 서버 실행
pnpm dev

# 정적 빌드 테스트
pnpm build

# 빌드 결과 확인
ls -la out/
```

#### 3. Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 배포
vercel --prod
```

### 🔄 자동 업데이트 설정

#### GitHub Actions (권장)

- `.github/workflows/daily-ssg-rebuild.yml` 파일이 설정됨
- 매일 오전 6시 자동 재빌드
- Vercel과 연동하여 자동 배포

#### Vercel Cron Jobs

- `vercel.json`에 cron 설정 포함
- `/api/revalidate` 엔드포인트로 캐시 무효화

### 📊 성능 최적화

#### 캐시 전략

- **브라우저 캐시**: 24시간
- **CDN 캐시**: 24시간
- **데이터 캐시**: `unstable_cache`로 24시간 캐시

#### 빌드 최적화

- **이미지 최적화**: `unoptimized: true`로 빌드 시간 단축
- **코드 스플리팅**: 자동 코드 분할
- **트리 쉐이킹**: 사용하지 않는 코드 제거

### 🚀 병렬 빌드 최적화 (2025년 6월 추가)

대규모 데이터셋(수천 개 종목)의 SSG 빌드 속도 최적화를 위해 병렬 빌드 시스템을 구축했습니다.

#### 📈 성능 비교

- **기존 단일 빌드**: 약 15-20분 (전체 데이터셋)
- **병렬 빌드 (4개 청크)**: 약 4-6분 (이론상 4배 향상)
- **테스트 결과**: 100개 종목 기준 609페이지 성공적 생성

#### 🔧 병렬 빌드 방법

##### 1. 데이터베이스 연결 최적화

```typescript
// db/index.ts - 병렬 빌드용 설정
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 5 : 10, // 연결 풀 증가
  idle_timeout: 60, // 더 긴 idle timeout
  connect_timeout: 60, // 더 긴 connection timeout
});
```

##### 2. 청크 기반 빌드 시스템

**자동 병렬 빌드** (권장):

```bash
# 지연된 병렬 빌드 (DB 부하 분산)
pnpm build:staggered

# 설정 가능한 옵션
TOTAL_CHUNKS=4 CHUNK_SIZE=500 STAGGER_DELAY=30 pnpm build:staggered
```

**수동 병렬 빌드** (최고 성능):

터미널 1:

```bash
BUILD_CHUNK_INDEX=0 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-0
```

터미널 2:

```bash
BUILD_CHUNK_INDEX=1 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-1
```

터미널 3:

```bash
BUILD_CHUNK_INDEX=2 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-2
```

터미널 4:

```bash
BUILD_CHUNK_INDEX=3 BUILD_CHUNK_TOTAL=4 BUILD_CHUNK_SIZE=500 pnpm build:ssg
mv out out-chunk-3
```

##### 3. 결과 합치기

```bash
# 모든 청크 빌드 완료 후
mkdir -p out
cp -r out-chunk-*/* out/
node scripts/generate-sitemap.js

# 최종 확인
ls -la out/
```

#### 🏗️ GitHub Actions 병렬 빌드

```yaml
# .github/workflows/ssg-parallel.yml
strategy:
  matrix:
    chunk: [0, 1, 2, 3] # 4개 병렬 작업

env:
  BUILD_CHUNK_INDEX: ${{ matrix.chunk }}
  BUILD_CHUNK_TOTAL: 4
  BUILD_CHUNK_SIZE: 500
```

#### ⚠️ 주의사항

1. **데이터베이스 부하**: 동시 연결 수 제한 고려
2. **메모리 사용량**: 4개 프로세스 동시 실행 시 RAM 사용량 증가
3. **파일 시스템**: Next.js 내부 파일 충돌 방지를 위해 순차 실행 권장
4. **CI/CD 비용**: GitHub Actions 병렬 실행 시 총 분/시간 합산

#### 📊 청크 분할 전략

```typescript
// lib/ssg-chunks.ts
export function getChunkFilter(
  chunkIndex: number,
  totalChunks: number,
  chunkSize: number
) {
  const startIndex = chunkIndex * chunkSize;
  const endIndex = startIndex + chunkSize;
  return { startIndex, endIndex };
}
```

#### 🛠️ 사용 가능한 빌드 스크립트

```json
{
  "scripts": {
    "build:ssg": "next build && node scripts/generate-sitemap.js",
    "build:chunks": "./scripts/build-chunks.sh", // 순차 청크 빌드
    "build:staggered": "./scripts/build-staggered.sh", // 지연된 병렬 빌드
    "build:parallel-real": "./scripts/build-parallel-real.sh" // 진짜 병렬 빌드
  }
}
```

#### 🔍 트러블슈팅

**문제**: DB 연결 타임아웃

- **해결**: 연결 풀 크기 증가, 타임아웃 시간 연장

**문제**: Next.js 파일 시스템 충돌

- **해결**: 완전 분리된 빌드 디렉토리 사용 또는 순차 실행

**문제**: 메모리 부족

- **해결**: 청크 크기 감소, 동시 실행 수 제한

### 📈 모니터링

#### 빌드 상태 확인

- GitHub Actions 탭에서 빌드 로그 확인
- Vercel 대시보드에서 배포 상태 확인

#### 성능 모니터링

- Vercel Analytics로 페이지 성능 측정
- Google Search Console로 SEO 상태 확인

### 🚨 문제 해결

#### 빌드 실패 시

1. 데이터베이스 연결 상태 확인
2. 환경 변수 설정 확인
3. 메모리 부족 시 Vercel 플랜 업그레이드 고려

#### 데이터 업데이트 안됨

1. 캐시 무효화 API 호출
2. 수동 재빌드 실행
3. 데이터베이스 업데이트 상태 확인

### 💡 추천 사항

1. **CDN 활용**: Vercel Edge Network로 전 세계 빠른 로딩
2. **모니터링 설정**: 빌드 실패 시 알림 설정
3. **백업 전략**: 중요한 정적 파일 백업
4. **점진적 개선**: 페이지별 성능 최적화 지속

---

이 설정으로 CD3 프로젝트는 완전 정적 사이트로 운영되며, 매일 자동으로 최신 주식 데이터로 업데이트됩니다.
