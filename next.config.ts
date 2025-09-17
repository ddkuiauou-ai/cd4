import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CD3 프로젝트 - SSG 최적화 설정
  output: 'export', // 정적 사이트 내보내기 활성화
  trailingSlash: true, // SEO 최적화를 위한 슬래시 추가
  // 청크별 빌드 지원: 환경변수에 따라 출력 디렉토리 변경
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // 청크별 출력 디렉토리 (export 모드에서는 항상 out/ 사용됨)
  ...(process.env.BUILD_OUTPUT_DIR && {
    experimental: {
      outputFileTracingRoot: process.cwd(),
    }
  }),
  images: {
    unoptimized: true, // 정적 내보내기에서 이미지 최적화 비활성화
  },
  // CD3 프로젝트 - 엄격한 오류 검사 활성화
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // CD3 프로젝트 - 타입 안전 라우팅 활성화
    optimizePackageImports: ['@radix-ui/react-icons'],
    // 병렬 빌드 최적화
    workerThreads: false, // Node.js worker threads 비활성화 (더 나은 성능)
    cpus: 8, // CPU 코어 활용 (10코어 중 8개 사용)
  },
};

export default nextConfig;
