# Vercel 디스크 용량 최적화 가이드

## 현재 상황
- **빌드 출력:** 88GB (.next: 44GB + out: 44GB)
- **Vercel 제한:** Free tier ~20GB, Pro tier 더 크지만 88GB는 여전히 부족
- **페이지 수:** 27,945개

## `.vercelignore`의 한계
❌ `.vercelignore`는 **업로드 시간만 단축**, 빌드 용량은 줄이지 못함
- Vercel이 서버에서 전체 재빌드하기 때문

## 실제 해결책

### 옵션 1: ISR (Incremental Static Regeneration) - 권장 ⭐
빌드 시 모든 페이지 생성 안 하고, 첫 요청 시 생성

#### 장점:
- **빌드 시간:** 30분 → 3분
- **디스크 사용:** 88GB → 5GB
- **배포 가능:** Free tier에서도 가능

#### 단점:
- 첫 방문 시 약간 느림 (이후엔 캐시됨)
- 덜 방문하는 페이지는 생성 안 될 수 있음

#### 구현 방법:

```typescript
// app/security/[secCode]/page.tsx
export async function generateStaticParams() {
  const securities = await getAllSecurityCodes();
  
  // 빌드 시 인기 종목만 미리 생성 (예: 100개)
  return securities.slice(0, 100).map((secCode) => ({
    secCode,
  }));
}

// 나머지 페이지는 on-demand로 생성
export const dynamicParams = true;  // 이게 핵심!
export const revalidate = 3600;     // 1시간마다 재생성
```

### 옵션 2: 정적 페이지 수 제한
빌드 시 일부만 생성, 나머지는 404

```typescript
export async function generateStaticParams() {
  const securities = await getAllSecurityCodes();
  
  // 상위 500개만 빌드
  return securities.slice(0, 500).map((secCode) => ({
    secCode,
  }));
}

export const dynamicParams = false;  // 나머지는 404
```

### 옵션 3: Vercel Pro + 빌드 분할
- Pro 플랜 구독 (더 큰 인스턴스)
- 여러 Vercel 프로젝트로 분할
  - project1: KOSPI 종목
  - project2: KOSDAQ 종목
  - project3: 지표별 페이지

### 옵션 4: 다른 호스팅 사용
- **Self-hosted (현재 사용 중):** 무제한 용량
- **Cloudflare Pages:** 무료 25,000 빌드/월, 디스크 제한 적음
- **GitHub Pages:** 정적 사이트만, 1GB 제한

## 추천 전략

### 단기 (즉시 적용 가능):
```typescript
// 인기 종목만 미리 빌드, 나머지는 ISR
export async function generateStaticParams() {
  const securities = await getAllSecurityCodes();
  
  // KOSPI 상위 200개 + KOSDAQ 상위 300개
  const popular = securities.filter(s => 
    isPopularStock(s)
  ).slice(0, 500);
  
  return popular.map(s => ({ secCode: s }));
}

export const dynamicParams = true;   // ISR 활성화
export const revalidate = 3600;      // 1시간 캐시
```

### 장기 (최적):
1. **Self-hosted runner 계속 사용** (GitHub Actions)
   - 무제한 디스크
   - 완전한 정적 사이트
   - Cloudflare R2에 배포

2. Vercel은 프리뷰용으로만
   - ISR 활성화
   - 빌드 시 최소 페이지만

## 성능 비교

| 방법 | 빌드 시간 | 디스크 | 첫 로딩 | Vercel 호환 |
|------|----------|--------|---------|------------|
| 전체 SSG (현재) | 30분 | 88GB | 빠름 | ❌ 불가능 |
| ISR (500개) | 3분 | 5GB | 보통 | ✅ 가능 |
| Self-hosted | 30분 | 무제한 | 빠름 | N/A |

## 결론

**Vercel 사용하려면:**
→ ISR 필수 (`dynamicParams: true`)

**완전한 정적 사이트 원하면:**
→ Self-hosted + R2/S3 (현재 설정 유지)
