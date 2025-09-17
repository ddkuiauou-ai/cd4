#!/bin/bash
# CD3 Project - Staggered Parallel Build Script
# 각 청크를 30초씩 지연시켜 시작하여 DB 부하 분산

echo "🚀 Starting staggered parallel SSG builds..."

CHUNK_SIZE=${CHUNK_SIZE:-500}
TOTAL_CHUNKS=${TOTAL_CHUNKS:-4}
STAGGER_DELAY=${STAGGER_DELAY:-30}  # 30초 지연

echo "📊 Configuration:"
echo "   - Chunk size: $CHUNK_SIZE securities per chunk"  
echo "   - Total chunks: $TOTAL_CHUNKS"
echo "   - Stagger delay: ${STAGGER_DELAY}s between starts"

# Clean up any existing chunk outputs
rm -rf out-chunk-*
rm -rf out

# Launch chunks with staggered start times
pids=()
for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    echo "🔨 Starting chunk $((i+1))/$TOTAL_CHUNKS (${i}x${STAGGER_DELAY}s delay)..."
    (
        if [ $i -gt 0 ]; then
            echo "  ⏳ Chunk $((i+1)) waiting $((i * STAGGER_DELAY))s..."
            sleep $((i * STAGGER_DELAY))
        fi
        
        export BUILD_CHUNK_INDEX=$i
        export BUILD_CHUNK_TOTAL=$TOTAL_CHUNKS
        export BUILD_CHUNK_SIZE=$CHUNK_SIZE
        # 완전히 분리된 빌드 환경 생성
        export NEXT_BUILD_DIR=".next-chunk-$i"
        export BUILD_OUTPUT_DIR="out-chunk-$i"
        
        echo "  📦 Chunk $((i+1)) building:"
        echo "      .next dir: .next-chunk-$i"
        echo "      output dir: out-chunk-$i"
        
        # 각 청크별로 독립된 .next 디렉토리 생성
        rm -rf ".next-chunk-$i" "out-chunk-$i"
        
        # Next.js 빌드 실행
        pnpm build:ssg
        
        # Next.js export는 항상 out/에 출력되므로 수동으로 이동
        if [ -d "out" ]; then
            echo "  📁 Moving output: out -> out-chunk-$i"
            mv out "out-chunk-$i"
        fi
        
        # .next 디렉토리도 이동 (디버깅용)
        if [ -d ".next" ]; then
            mv ".next" ".next-chunk-$i"
        fi
        
        if [ $? -eq 0 ]; then
            echo "  ✅ Chunk $((i+1)) completed!"
        else
            echo "  ❌ Chunk $((i+1)) failed!"
            exit 1
        fi
    ) &
    pids+=($!)
done

echo ""
echo "⏳ Waiting for all $TOTAL_CHUNKS staggered builds to complete..."

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

# Create main output directory
mkdir -p out

# Merge all chunk directories
for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    if [ -d "out-chunk-$i" ]; then
        echo "  📁 Merging out-chunk-$i..."
        cp -r out-chunk-$i/* out/
    fi
done

echo "🗺️ Regenerating final sitemap from merged output..."
node scripts/generate-sitemap.js

echo ""
echo "🎉 Staggered parallel build complete!"
echo "📊 Final output in: ./out"
echo "🧹 Chunk directories preserved for debugging: out-chunk-*"
