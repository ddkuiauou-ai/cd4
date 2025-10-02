#!/bin/bash
# CD3 Project - High-Performance Build Script with Parallel Processing

set -e  # Exit on error

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "🚀 Starting high-performance SSG build..."

# Configuration
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=12288}"
export NEXT_TELEMETRY_DISABLED=1
export UV_THREADPOOL_SIZE=32  # Increase libuv thread pool

# Detect CPU cores
if [[ "$OSTYPE" == "darwin"* ]]; then
    CPU_CORES=$(sysctl -n hw.ncpu)
else
    CPU_CORES=$(nproc)
fi

echo "📊 Configuration:"
echo "   - Build mode: Full build with Turbopack (beta)"
echo "   - CPU cores detected: $CPU_CORES"
echo "   - Memory allocation: 12GB for Node.js"
echo "   - Next.js cpus: 8 (parallel static generation)"
echo "   - Turbopack: Rust-based bundler (2-5x faster)"

# 디스크 사용량 확인 함수
check_disk() {
    echo "💾 Disk usage:"
    df -h / | head -2
}

# 디스크 정리 함수
cleanup_cache() {
    echo "🧹 Cleaning up cache and temporary files..."
    # 빌드 중에는 webpack 캐시만 정리 (다른 파일은 필요함)
    rm -rf .next/cache/webpack 2>/dev/null || true
    # 시스템 캐시 정리
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf /tmp/next-* 2>/dev/null || true
}

echo ""
check_disk

# Clean up previous build artifacts
echo ""
echo "🧹 Cleaning up previous build artifacts..."
rm -rf out
rm -rf .next
rm -rf build-*.log 2>/dev/null || true
cleanup_cache

# Build with optimizations
echo ""
echo "🔨 Starting Next.js build with Turbopack (beta)..."
echo "   ⚡ Expected: 10-20 minutes for ~28K pages (2-5x faster than Webpack)"
echo ""

start_time=$(date +%s)

# Progress monitoring with aggressive cleanup during export phase
(
    while true; do
        sleep 180  # 3분마다 체크
        if ps aux | grep -q "[n]ext build"; then
            echo ""
            echo "⏳ Build in progress..."
            check_disk
            
            # Export 단계에서 .next 캐시 삭제 (out 디렉토리가 생성되면)
            if [ -d "out" ] && [ -d ".next" ]; then
                echo "🧹 Emergency: Deleting .next cache during export..."
                rm -rf .next/cache 2>/dev/null || true
                rm -rf .next/server 2>/dev/null || true
                rm -rf .next/static 2>/dev/null || true
                echo "💾 After cleanup:"
                check_disk
            fi
        else
            break
        fi
    done
) &
MONITOR_PID=$!

if pnpm next build --turbopack 2>&1 | tee build.log; then
    end_time=$(date +%s)
    build_time=$((end_time - start_time))
    
    # Stop monitoring
    kill $MONITOR_PID 2>/dev/null || true
    
    echo ""
    echo "✅ Build completed successfully!"
    
    # Immediately delete .next to free disk space
    echo "🧹 Cleaning up .next directory..."
    rm -rf .next
    
    echo "💾 After cleanup:"
    check_disk
    echo ""
else
    # 모니터링 프로세스 종료
    kill $MONITOR_PID 2>/dev/null || true
    
    echo ""
    echo "❌ Build failed!"
    echo ""
    check_disk
    echo ""
    echo "📋 Last 100 lines of build log:"
    tail -100 build.log
    exit 1
fi

# Verify build output
echo ""
echo "🔍 Verifying build output..."
if [ ! -d "out" ]; then
    echo "❌ Error: out directory not found!"
    check_disk
    exit 1
fi

file_count=$(find out -type f | wc -l)
echo "✅ Build output verified: $file_count files generated"

if [ $file_count -lt 100 ]; then
    echo "⚠️ Warning: File count seems low ($file_count files)"
    exit 1
fi

# Generate sitemap
echo "🗺️ Generating sitemap..."
node scripts/generate-sitemap.js

# Final cleanup - keep .next for incremental builds
echo ""
echo "🧹 Cleanup build artifacts..."
rm -rf build.log

# Build summary
echo ""
echo "📈 Build summary:"
echo "   - Build time: $((build_time / 60))m $((build_time % 60))s"
echo "   - Total output files: $file_count"
echo "   - Output size: $(du -sh out | cut -f1)"
echo "   - Avg time per page: $((build_time * 1000 / file_count))ms"
echo ""
check_disk
echo ""
echo "🎉 Build completed successfully!"
