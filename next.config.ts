import type { NextConfig } from "next";
import path from "path";

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

  // Turbopack 설정
  turbopack: {
    // 프로젝트 루트 명시 (경고 제거)
    root: path.resolve(__dirname),
  },

  // 빌드 최적화
  experimental: {
    // 병렬 빌드 워커 (10 CPU 코어 활용)
    cpus: 8,  // 10코어 중 8개 사용 (2개는 시스템용)
    
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
