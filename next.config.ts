import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { createHash } from "node:crypto";
import path from "path";

const outputMode = process.env.NEXT_OUTPUT_MODE?.toLowerCase();
const staticBuild = outputMode === 'export';
const releaseBuildId = staticBuild ? process.env.STATIC_RELEASE_BUILD_ID : undefined;
const positiveInteger = (name: string, fallback: number) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be a positive integer`);
  return Number(value);
};

const staticReleaseClientIds = {
  apply(compiler: webpack.Compiler) {
    const name = 'StaticReleaseClientEntryIds';
    const root = compiler.context + path.sep;
    const isFlightEntry = (request: string) => /next-flight-client-entry-loader(?:\.js)?\?/.test(request);
    // Next embeds resolved imports inside a URL-encoded loader query.
    // Webpack's own path normalization cannot see these absolute paths.
    const normalized = (request: string) => request.replaceAll(encodeURIComponent(root), './').replaceAll(root, './');
    const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 20);
    compiler.hooks.compilation.tap(name, (compilation: webpack.Compilation) => {
      compilation.hooks.moduleIds.tap({ name, stage: -10 }, (modules: Iterable<webpack.Module>) => {
        for (const entry of modules) {
          const request = entry.identifier();
          if (isFlightEntry(request)) compilation.chunkGraph.setModuleId(entry, 'cd-flight-' + digest(normalized(request)));
        }
      });
      compilation.hooks.chunkIds.tap({ name, stage: -10 }, (chunks: Iterable<{
        name?: string; id: string | number | null; ids: (string | number)[] | null;
        runtime?: string | Iterable<string>; idNameHints: Iterable<string>;
      }>) => {
        const graph = compilation.chunkGraph;
        const assigned = new Set<string>();
        for (const chunk of chunks) {
          if (chunk.name || chunk.id !== null) continue;
          if (!graph.getChunkRootModules(chunk).some((entry: webpack.Module) => isFlightEntry(entry.identifier()))) continue;
          const members = Array.from(graph.getChunkModulesIterable(chunk), (entry: webpack.Module) => normalized(entry.identifier())).sort();
          const runtime = typeof chunk.runtime === 'string' ? [chunk.runtime] : [...(chunk.runtime ?? [])].sort();
          const hints = [...chunk.idNameHints].sort();
          const id = 'cd-flight-chunk-' + digest(JSON.stringify([runtime, hints, members]));
          if (assigned.has(id)) throw new Error('Duplicate static release chunk signature');
          assigned.add(id);
          chunk.id = id;
          chunk.ids = [chunk.id];
        }
      });
    });
  },
};

const nextConfig = (phase: string): NextConfig => ({
  // CD3 프로젝트 - 정적 사이트 생성 설정
  trailingSlash: true,
  output: outputMode === 'export' ? 'export' : 'standalone',
  ...(releaseBuildId
    ? {
      generateBuildId: async () => releaseBuildId,
      webpack(config, { isServer }) {
        if (!isServer) config.plugins.push(staticReleaseClientIds);
        return config;
      },
    }
    : {}),

  images: {
    unoptimized: true,
  },

  // Turbopack 설정
  turbopack: {
    root: path.resolve(process.env.STATIC_BUILD_PROJECT_ROOT || __dirname),
  },

  // 빌드 최적화
  experimental: {
    agentUpgrade: 'security',

    // Next 16.4: 개발 중 지연 컴파일과 CSS worker로 작업 비용을 줄인다.
    ...(phase === PHASE_DEVELOPMENT_SERVER ? {
      // GC가 제거한 작업을 HMR이 참조하는 패닉과 반복 새로고침을 피한다.
      turbopackGc: false,
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
