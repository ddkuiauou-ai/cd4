#!/bin/bash
# CD3 Project - TRUE Parallel Build Script with Memory Optimization

echo "🚀 Starting TRUE parallel SSG builds with memory optimization..."

CHUNK_SIZE=${CHUNK_SIZE:-400}  # 2코어 8GB 환경용 속도 최적화 청크 크기
TOTAL_CHUNKS=${TOTAL_CHUNKS:-6}  # 적절한 수의 청크로 나누기
MAX_PARALLEL=${MAX_PARALLEL:-2}  # 2코어 활용하여 속도 향상

echo "📊 Configuration:"
echo "   - Chunk size: $CHUNK_SIZE securities per chunk"
echo "   - Total chunks: $TOTAL_CHUNKS"
echo "   - Max parallel processes: $MAX_PARALLEL"
echo "   - Running builds in batches for memory efficiency!"

# 디스크 사용량 확인
echo "📊 Initial disk usage:"
df -h

# Clean up any existing chunk outputs
echo "🧹 Cleaning up previous build artifacts..."
rm -rf out-chunk-*
rm -rf out
rm -rf .next 2>/dev/null || true

# Ensure cache directories exist to prevent webpack warnings
echo "📁 Ensuring cache directories exist..."
mkdir -p .next/cache/webpack/client-production
mkdir -p .next/cache/webpack/server-production

# Launch chunks in batches for memory efficiency
echo "📋 Processing chunks in batches of $MAX_PARALLEL..."

for ((start_idx=0; start_idx<TOTAL_CHUNKS; start_idx+=MAX_PARALLEL)); do
    end_idx=$((start_idx + MAX_PARALLEL))
    if [ $end_idx -gt $TOTAL_CHUNKS ]; then
        end_idx=$TOTAL_CHUNKS
    fi

    echo ""
    echo "🔄 Processing batch: chunks $((start_idx+1))-$end_idx"

    # Launch current batch in background
    batch_pids=()
    for i in $(seq $start_idx $((end_idx-1))); do
        echo "🔨 Starting chunk $((i+1))/$TOTAL_CHUNKS..."
        (
            export BUILD_CHUNK_INDEX=$i
            export BUILD_CHUNK_TOTAL=$TOTAL_CHUNKS
            export BUILD_CHUNK_SIZE=$CHUNK_SIZE
            export NEXT_BUILD_DIR="out-chunk-$i"
            export BUILD_OUTPUT_DIR="out-chunk-$i"
            export NODE_OPTIONS="--max-old-space-size=2048"  # 8GB 환경에서 2GB 할당으로 안정성 극대화

            echo "  📦 Chunk $((i+1)) building to: out-chunk-$i"

            # 디스크 사용량 모니터링
            echo "  💾 Disk usage before build:"
            df -h | grep -E "(Filesystem|overlay)"

            pnpm build:ssg

            if [ $? -eq 0 ]; then
                echo "  ✅ Chunk $((i+1)) completed!"

                # 완료된 청크의 캐시 정리 (메모리 절약)
                rm -rf .next-${i} 2>/dev/null || true

                echo "  💾 Disk usage after cleanup:"
                df -h | grep -E "(Filesystem|overlay)"
            else
                echo "  ❌ Chunk $((i+1)) failed!"
                exit 1
            fi
        ) &
        batch_pids+=($!)
    done

    echo "⏳ Waiting for batch to complete..."
    # Wait for current batch to complete
    for pid in "${batch_pids[@]}"; do
        if ! wait $pid; then
            echo "💥 Batch failed! Exiting..."
            exit 1
        fi
    done

    echo "✅ Batch completed successfully!"

    # 배치 완료 후 메모리 정리
    echo "🧹 Cleaning up memory and temporary files..."
    sync
    echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
done

echo ""
echo "⏳ Waiting for all $TOTAL_CHUNKS parallel builds to complete..."

# Wait for all background processes
failed=0
for i in "${!pids[@]}"; do
    pid=${pids[$i]}
    if wait $pid; then
        echo "✅ Chunk $((i+1)) finished successfully"
    else
        echo "❌ Chunk $((i+1)) failed!"
        failed=1
    fi
done

if [ $failed -eq 1 ]; then
    echo "💥 Some chunks failed! Exiting..."
    exit 1
fi

echo ""
echo "🔗 Merging all chunk outputs into final 'out' directory..."

# 디스크 사용량 확인
echo "💾 Disk usage before merge:"
df -h

# Create main output directory
mkdir -p out

# Merge all chunk directories (메모리 효율적으로)
for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    if [ -d "out-chunk-$i" ]; then
        echo "  📁 Merging out-chunk-$i..."

        # 대용량 파일 복사를 위해 배치 처리
        find "out-chunk-$i" -type f -name "*.html" -exec cp {} out/ \; 2>/dev/null
        find "out-chunk-$i" -type f -name "*.json" -exec cp {} out/ \; 2>/dev/null
        find "out-chunk-$i" -type f -name "*.xml" -exec cp {} out/ \; 2>/dev/null
        find "out-chunk-$i" -type d -exec mkdir -p out/{} \; 2>/dev/null

        # 완료된 청크 디렉토리 즉시 정리 (디스크 공간 절약)
        rm -rf "out-chunk-$i"

        echo "  💾 Disk usage after merging chunk $((i+1)):"
        df -h | grep -E "(Filesystem|overlay)"
    fi
done

# 중간 정리
echo "🧹 Cleaning up temporary files..."
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

echo "🗺️ Regenerating final sitemap from merged output..."
node scripts/generate-sitemap.js

# 최종 정리
echo "🧹 Final cleanup..."
rm -rf .next 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

echo ""
echo "🎉 TRUE parallel build complete!"
echo "📊 Final output in: ./out"
echo "💾 Final disk usage:"
df -h
