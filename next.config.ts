import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CD3 프로젝트 - 정적 사이트 생성 설정
  trailingSlash: true,
  output: 'export',
  
  images: {
    unoptimized: true,
  },

  // 타입체크 및 린트 설정
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 빌드 최적화 및 병렬 처리
  experimental: {
    // 병렬 빌드 워커 (10 CPU 코어 활용)
    workerThreads: true,
    cpus: 8,  // 10코어 중 8개 사용 (2개는 시스템용)
    
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
