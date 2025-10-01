#!/usr/bin/env node
/**
 * CD3 Project - Parallel Build Script
 *
 * 종목을 청크별로 나누어 병렬 빌드를 수행합니다.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 400; // 2코어 8GB 환경용 속도 최적화 한 청크당 종목 수
const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL) || 2; // 2코어 활용하여 속도 향상

console.log("🚀 Starting parallel SSG build...");
console.log(`📊 Configuration:`);
console.log(`   - Chunk size: ${CHUNK_SIZE} securities per chunk`);
console.log(`   - Max parallel processes: ${MAX_PARALLEL}`);

/**
 * 종목 청크별로 환경변수를 설정하여 빌드 실행
 */
async function runBuildChunk(chunkIndex, totalChunks) {
  return new Promise((resolve, reject) => {
    const chunkId = `chunk-${chunkIndex}`;
    const env = {
      ...process.env,
      BUILD_CHUNK_INDEX: chunkIndex.toString(),
      BUILD_CHUNK_TOTAL: totalChunks.toString(),
      BUILD_CHUNK_SIZE: CHUNK_SIZE.toString(),
      // 🎯 각 청크별로 독립적인 디렉토리 사용
      NEXT_BUILD_DIR: `.next-${chunkId}`,
      BUILD_OUTPUT_DIR: `out-${chunkId}`,
      NEXT_CACHE_DIR: `.next-cache-${chunkId}`,
      BUILD_ID: `${chunkId}-${Date.now()}`,
      // 포트도 다르게 설정 (dev 모드에서 충돌 방지)
      PORT: (3000 + chunkIndex).toString(),
    };

    console.log(
      `🔨 Starting build chunk ${chunkIndex + 1}/${totalChunks} (${chunkId})...`
    );
    console.log(`📁 Output directory: out-${chunkId}`);

    const buildProcess = spawn("pnpm", ["run", "build"], {
      env,
      stdio: ["inherit", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    buildProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      // 실시간 로그 출력 (청크 번호 포함)
      process.stdout.write(`[${chunkId}] ${data}`);
    });

    buildProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(`[${chunkId}] ${data}`);
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        console.log(
          `✅ Chunk ${
            chunkIndex + 1
          }/${totalChunks} (${chunkId}) completed successfully`
        );
        resolve({ chunkIndex, chunkId, stdout, stderr });
      } else {
        console.error(
          `❌ Chunk ${
            chunkIndex + 1
          }/${totalChunks} (${chunkId}) failed with code ${code}`
        );
        reject(new Error(`Build chunk ${chunkIndex + 1} failed`));
      }
    });
  });
}

/**
 * 청크들을 배치로 나누어 병렬 실행
 */
async function runParallelBuild() {
  try {
    // 총 종목 수 추정 (실제로는 DB에서 가져와야 함)
    const estimatedSecurities = parseInt(process.env.TOTAL_SECURITIES) || 2500;
    const totalChunks = Math.ceil(estimatedSecurities / CHUNK_SIZE);

    console.log(
      `📈 Estimated ${estimatedSecurities} securities → ${totalChunks} chunks`
    );

    const chunks = Array.from({ length: totalChunks }, (_, i) => i);
    const results = [];

    // 배치별로 병렬 실행 (메모리 효율적으로)
    const BATCH_SIZE = Math.min(MAX_PARALLEL, 1); // 안정성을 위해 1개씩 배치 처리
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(
        `\n🔄 Processing batch: chunks ${batch.map((c) => c + 1).join(", ")}`
      );

      const batchPromises = batch.map((chunkIndex) =>
        runBuildChunk(chunkIndex, totalChunks)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(
          `✅ Batch completed: ${batchResults.length} chunks finished`
        );
      } catch (error) {
        console.error(`❌ Batch failed:`, error.message);
        throw error;
      }
    }

    console.log(`\n🎉 All ${totalChunks} chunks completed successfully!`);

    // 결과 병합
    await mergeResults(results);
  } catch (error) {
    console.error("❌ Parallel build failed:", error.message);
    process.exit(1);
  }
}

/**
 * 각 청크의 빌드 결과를 병합
 */
async function mergeResults(results) {
  console.log("🔗 Merging build results...");

  const fs = require("fs");
  const { execSync } = require("child_process");

  // 메인 out 디렉토리 정리
  if (fs.existsSync("out")) {
    execSync("rm -rf out");
  }
  fs.mkdirSync("out", { recursive: true });

  // 각 청크의 out 디렉토리를 병합
  for (const result of results) {
    const chunkOutDir = `out-${result.chunkId}`;
    if (fs.existsSync(chunkOutDir)) {
      console.log(`📁 Merging ${chunkOutDir} into out/`);
      execSync(`cp -r ${chunkOutDir}/* out/`);

      // 청크 디렉토리 정리
      execSync(`rm -rf ${chunkOutDir}`);
    }
  }

  // 빌드 캐시 디렉토리들도 정리
  for (const result of results) {
    const chunkDirs = [
      `.next-${result.chunkId}`,
      `.next-cache-${result.chunkId}`,
    ];

    chunkDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        console.log(`🧹 Cleaning up ${dir}`);
        execSync(`rm -rf ${dir}`);
      }
    });
  }

  console.log("✅ Results merged successfully!");

  // 사이트맵 재생성
  console.log("🗺️ Regenerating sitemap...");
  const sitemapProcess = spawn("node", ["scripts/generate-sitemap.js"], {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    sitemapProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Sitemap regenerated!");
        resolve();
      } else {
        reject(new Error("Sitemap generation failed"));
      }
    });
  });
}

// 스크립트 실행
if (require.main === module) {
  runParallelBuild();
}

module.exports = { runParallelBuild, runBuildChunk };
