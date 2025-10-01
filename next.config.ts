import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CD3 프로젝트 - SSG 최적화 설정
  output: 'export', // 정적 사이트 내보내기 활성화
  trailingSlash: true, // SEO 최적화를 위한 슬래시 추가
  images: {
    unoptimized: true, // 정적 내보내기에서 이미지 최적화 비활성화
  },
  // CD3 프로젝트 - 빌드 최적화 설정
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 빌드 성능 및 캐시 최적화
  experimental: {
    // CD3 프로젝트 - 타입 안전 라우팅 활성화
    optimizePackageImports: ['@radix-ui/react-icons', '@radix-ui/react-slot'],

    // 메모리 및 디스크 사용량 최적화
    optimizeCss: false, // CSS 최적화 비활성화 (critters 모듈 문제 해결)
    scrollRestoration: true, // 스크롤 복원으로 페이지 전환 개선

    // 대용량 빌드를 위한 설정

    // 2코어 8GB 환경 최적화 (안정성 중심)
    workerThreads: false, // 안정성을 위해 워커 스레드 비활성화 (DataCloneError 방지)
    cpus: 2, // 2코어 모두 활용하여 속도 향상
  },

  // webpack 최적화 설정 (2코어 8GB 환경용)
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 속도 중심 최적화 (8GB 환경용)
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // 노드 모듈을 적절한 크기로 분리 (속도 최적화)
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2, // 적절한 크기로 분리하여 빌드 속도 향상
          },
        },
      },
      // 최적화 활성화
      minimize: true,
      minimizer: [
        ...(config.optimization.minimizer || [])
      ]
    };

    // 메모리 절약을 위한 추가 설정
    config.performance = {
      ...config.performance,
      hints: false, // 성능 힌트 비활성화로 빌드 속도 향상
      maxEntrypointSize: 512000, // 엔트리포인트 크기 제한 완화
      maxAssetSize: 512000, // 애셋 크기 제한 완화
    };

    // 빌드 시 불필요한 파일 제외 (메모리 절약)
    config.externals = config.externals || [];
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'supports-color': 'commonjs supports-color',
      'bufferutil': 'commonjs bufferutil',
    });

    return config;
  },

  // 환경 변수 설정 (빌드 시점에 설정)
  env: {
    // 빌드 시점에 설정하여 런타임 오버헤드 감소
    NEXT_BUILD_ID: process.env.NEXT_BUILD_ID || 'development',
  },
};

export default nextConfig;
