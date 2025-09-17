#!/bin/bash
# CD3 Project - TRUE Parallel Build Script

echo "🚀 Starting TRUE parallel SSG builds..."

CHUNK_SIZE=${CHUNK_SIZE:-500}
TOTAL_CHUNKS=${TOTAL_CHUNKS:-4}

echo "📊 Configuration:"
echo "   - Chunk size: $CHUNK_SIZE securities per chunk"  
echo "   - Total chunks: $TOTAL_CHUNKS"
echo "   - Running $TOTAL_CHUNKS builds in parallel!"

# Clean up any existing chunk outputs
rm -rf out-chunk-*
rm -rf out

# Launch all chunks in parallel (background processes)
pids=()
for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    echo "🔨 Starting chunk $((i+1))/$TOTAL_CHUNKS in background..."
    (
        export BUILD_CHUNK_INDEX=$i
        export BUILD_CHUNK_TOTAL=$TOTAL_CHUNKS
        export BUILD_CHUNK_SIZE=$CHUNK_SIZE
        export NEXT_BUILD_DIR="out-chunk-$i"
        export BUILD_OUTPUT_DIR="out-chunk-$i"
        
        echo "  📦 Chunk $((i+1)) building to: out-chunk-$i"
        pnpm build:ssg
        
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

# Create main output directory
mkdir -p out

# Merge all chunk directories
for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    if [ -d "out-chunk-$i" ]; then
        echo "  📁 Merging out-chunk-$i..."
        cp -r out-chunk-$i/* out/
        # Keep chunk dirs for debugging
        # rm -rf "out-chunk-$i"
    fi
done

echo "🗺️ Regenerating final sitemap from merged output..."
node scripts/generate-sitemap.js

echo ""
echo "🎉 TRUE parallel build complete!"
echo "📊 Final output in: ./out"
echo "🧹 Chunk directories preserved for debugging: out-chunk-*"
