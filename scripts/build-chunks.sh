#!/bin/bash
# CD3 Project - Simple Parallel Build Script

echo "🚀 Starting chunked SSG builds..."

CHUNK_SIZE=${CHUNK_SIZE:-500}
TOTAL_CHUNKS=${TOTAL_CHUNKS:-4}

echo "📊 Configuration:"
echo "   - Chunk size: $CHUNK_SIZE securities per chunk"  
echo "   - Total chunks: $TOTAL_CHUNKS"

for i in $(seq 0 $((TOTAL_CHUNKS-1))); do
    echo ""
    echo "🔨 Building chunk $((i+1))/$TOTAL_CHUNKS..."
    BUILD_CHUNK_INDEX=$i BUILD_CHUNK_TOTAL=$TOTAL_CHUNKS BUILD_CHUNK_SIZE=$CHUNK_SIZE pnpm build:ssg
    
    if [ $? -ne 0 ]; then
        echo "❌ Chunk $((i+1)) failed!"
        exit 1
    fi
    
    echo "✅ Chunk $((i+1)) completed!"
done

echo ""
echo "🎉 All chunks completed successfully!"
echo "🗺️ Regenerating final sitemap..."
node scripts/generate-sitemap.js

echo "✅ Build complete!"
