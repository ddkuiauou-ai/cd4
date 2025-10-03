import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // CD3 프로젝트 - 정적 사이트 생성 설정
  trailingSlash: true,
  ...(process.env.NEXT_OUTPUT_MODE?.toLowerCase() === 'export' ? { output: 'export' as const } : {}),

  images: {
    unoptimized: true,
  },

  // 타입체크 및 린트 설정 (빌드 속도 최적화)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Turbopack 설정
  turbopack: {
    root: path.resolve(__dirname),
  },

  // 빌드 최적화
  experimental: {
    // Vercel 환경에서는 CPU 수 줄이기 (메모리 절약)
    cpus: process.env.VERCEL ? 4 : 8,

    // 메모리 최적화
    memoryBasedWorkersCount: true,

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
};

export default nextConfig;
