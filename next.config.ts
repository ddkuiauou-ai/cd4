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

  // 빌드 최적화 (검증된 기능만 사용)
  experimental: {
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
