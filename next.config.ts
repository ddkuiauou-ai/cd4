import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "path";

const outputMode = process.env.NEXT_OUTPUT_MODE?.toLowerCase();
const staticBuild = outputMode === 'export';
const positiveInteger = (name: string, fallback: number) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be a positive integer`);
  return Number(value);
};

const nextConfig = (phase: string): NextConfig => ({
  // CD3 프로젝트 - 정적 사이트 생성 설정
  trailingSlash: true,
  output: outputMode === 'export' ? 'export' : 'standalone',

  images: {
    unoptimized: true,
  },

  // Turbopack 설정
  turbopack: {
    root: path.resolve(process.env.STATIC_BUILD_PROJECT_ROOT || __dirname),
  },

  // 빌드 최적화
  experimental: {
    // Next 16.4: 개발 중 사용하지 않는 캐시·컴파일 작업과 CSS worker 비용을 줄인다.
    ...(phase === PHASE_DEVELOPMENT_SERVER ? {
      turbopackGc: true,
      turbopackLazyDynamicImports: true,
      turbopackPluginRuntimeStrategy: 'workerThreads' as const,
    } : {}),

    // Vercel 환경에서는 CPU 수 줄이기 (메모리 절약)
    cpus: staticBuild ? positiveInteger('STATIC_BUILD_CPUS', 4) : process.env.VERCEL ? 4 : 8,

    // 메모리 최적화
    memoryBasedWorkersCount: !staticBuild,
    ...(staticBuild ? {
      staticGenerationMaxConcurrency: positiveInteger('STATIC_BUILD_CONCURRENCY', 2),
      staticGenerationMinPagesPerWorker: 25,
      turbopackFileSystemCacheForBuild: process.env.STATIC_BUILD_COMPILER_CACHE !== '0',
    } : {}),

    // 패키지 임포트 최적화
    optimizePackageImports: [
      '@radix-ui/react-icons',
      '@radix-ui/react-slot',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tooltip',
    ],
  },
});

export default nextConfig;
