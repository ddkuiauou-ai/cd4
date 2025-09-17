#!/usr/bin/env node

/**
 * CD3 Project - Cache Revalidation Script
 *
 * 이 스크립트는 주식 데이터 업데이트 후 캐시를 무효화하는 데 사용됩니다.
 * 하루에 한 번 실행하여 모든 캐시를 새로고침합니다.
 */

const { revalidateTag } = require("next/cache");

const CACHE_TAGS = [
  "getAllSecurityCodes",
  "getAllCompanyCodes",
  "getCompanies",
  "getMarketcapData",
  "getSecurityData",
  "getMetricsData",
  "getSearchData",
];

async function revalidateAllCaches() {
  console.log("🔄 캐시 재검증을 시작합니다...");

  try {
    for (const tag of CACHE_TAGS) {
      await revalidateTag(tag);
      console.log(`✅ ${tag} 캐시가 무효화되었습니다.`);
    }

    console.log("🎉 모든 캐시가 성공적으로 재검증되었습니다!");
  } catch (error) {
    console.error("❌ 캐시 재검증 중 오류 발생:", error);
    process.exit(1);
  }
}

// 환경 변수 확인
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  console.error("❌ NEXT_PUBLIC_SITE_URL 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

revalidateAllCaches();
