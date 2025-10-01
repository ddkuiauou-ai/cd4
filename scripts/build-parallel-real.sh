#!/bin/bash
# CD3 Project - Optimized Full Build Script with Disk Management

set -e  # Exit on error

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "🚀 Starting optimized SSG build..."

# Configuration
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
export NEXT_TELEMETRY_DISABLED=1

echo "📊 Configuration:"
echo "   - Build mode: Full build"
echo "   - Memory allocation: 6GB for Node.js"
echo "   - Disk management: Aggressive cleanup enabled"

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
echo "🔨 Starting Next.js build..."
echo "   ⚠️  This will take 30-45 minutes for ~28K pages"
echo ""

start_time=$(date +%s)

# 빌드 중 디스크 모니터링 (더 자주 체크 및 정리)
(
    while true; do
        sleep 180  # 3분마다 체크 (더 자주)
        if ps aux | grep -q "[n]ext build"; then
            echo ""
            echo "⏳ Build in progress..."
            check_disk
            
            # 더 적극적인 정리
            echo "🧹 Aggressive cleanup during build..."
            rm -rf .next/cache/webpack 2>/dev/null || true
            rm -rf .next/cache/images 2>/dev/null || true
            rm -rf node_modules/.cache 2>/dev/null || true
            rm -rf /tmp/* 2>/dev/null || true
            
            # 디스크 사용량이 85% 이상이면 경고
            usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
            if [ "$usage" -gt 85 ]; then
                echo "⚠️  WARNING: Disk usage at ${usage}%! Build may fail!"
                echo "🧹 Emergency cleanup..."
                rm -rf .next/standalone 2>/dev/null || true
                rm -rf .next/types 2>/dev/null || true
            fi
        else
            break
        fi
    done
) &
MONITOR_PID=$!

if pnpm next build 2>&1 | tee build.log; then
    end_time=$(date +%s)
    build_time=$((end_time - start_time))
    
    # 모니터링 프로세스 종료
    kill $MONITOR_PID 2>/dev/null || true
    
    echo ""
    echo "✅ Build completed successfully!"
    
    # IMMEDIATELY delete .next to free disk space before next steps
    echo "🧹 Deleting .next directory to free disk space..."
    rm -rf .next
    
    echo "💾 Disk after .next deletion:"
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
echo ""
echo "🗺️ Generating sitemap..."
node scripts/generate-sitemap.js

# Final cleanup
echo ""
echo "🧹 Final cleanup..."
rm -rf .next
rm -rf build.log
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf /tmp/next-* 2>/dev/null || true

# Final disk usage
echo ""
check_disk

# Build summary
echo ""
echo "📈 Build summary:"
echo "   - Build time: $((build_time / 60))m $((build_time % 60))s"
echo "   - Total output files: $file_count"
echo "   - Output directory: ./out"
echo "   - Avg time per page: $((build_time * 1000 / file_count))ms"
echo ""
echo "🎉 Build completed successfully!"
