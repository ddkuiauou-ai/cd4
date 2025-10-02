# Vercel 배포 가이드

## 1. 환경 변수 설정

Vercel 프로젝트 설정 > Environment Variables에서 다음 환경 변수를 추가하세요:

### Database (필수)
```
POSTGRES_HOST=<your-database-host>
POSTGRES_PORT=5432
POSTGRES_USER=<your-username>
POSTGRES_PASSWORD=<your-password>
POSTGRES_DB=<your-database-name>
```

또는 단일 연결 문자열 (형식):
```
DATABASE_URL=postgres://[user]:[pwd]@[host]:5432/[db]
```

### Build 최적화
```
NODE_OPTIONS=--max-old-space-size=12288
NEXT_TELEMETRY_DISABLED=1
```

## 2. 빌드 설정

`vercel.json`에 이미 설정되어 있습니다:
- **Build Command:** `pnpm run build`
- **Output Directory:** `out`
- **Install Command:** `pnpm install --frozen-lockfile`
- **Framework:** Next.js

## 3. 지역 설정

현재 Seoul (`icn1`)로 설정되어 있습니다. 필요시 변경 가능:
- `icn1` - Seoul, South Korea
- `hnd1` - Tokyo, Japan
- `sin1` - Singapore
- `iad1` - Washington DC, USA

## 4. 캐싱 전략

### Static Assets (JS/CSS)
- `max-age=31536000` (1년)
- `immutable` (절대 변경되지 않음)

### HTML Pages
- `max-age=3600` (1시간 - 브라우저)
- `s-maxage=86400` (24시간 - CDN)
- `stale-while-revalidate=604800` (1주일 - 백그라운드 재검증)

### Sitemap
- `max-age=3600` (1시간)

## 5. 배포 방법

### Git 연동 (권장)
```bash
git push origin main
```
→ 자동으로 Vercel에 배포됩니다.

### CLI 배포
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

## 6. 성능 최적화

### Turbopack
- Next.js 15.5의 Turbopack이 자동으로 활성화됩니다
- 빌드 시간: 15-20분 (27,945 페이지)

### Edge Network
- Vercel의 글로벌 CDN 자동 활용
- 한국 리전 사용 시 최적 성능

## 7. 빌드 타임아웃

대규모 사이트 (27K+ 페이지)의 경우:
1. Vercel 대시보드 > Settings > General
2. "Build & Development Settings" 섹션
3. "Maximum Build Duration" 증가 (Pro 플랜 필요)

기본: 15분 → Pro: 45분

## 8. 문제 해결

### 빌드 실패
- Vercel 로그 확인: `vercel logs`
- 메모리 부족: Pro 플랜으로 업그레이드
- 타임아웃: 빌드 시간 증가 또는 페이지 수 줄이기

### 데이터베이스 연결
- IP 화이트리스트에 Vercel IP 추가 필요
- 또는 공개 접근 허용 (SSL 권장)

### 느린 로딩
- CDN 캐시 확인: `Cache-Control` 헤더
- 이미지 최적화: Next.js Image 컴포넌트 사용
