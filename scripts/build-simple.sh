#!/bin/bash
# CD3 Project - Simple Single Build (No Chunking)

set -e

echo "🚀 Starting full SSG build..."
echo ""

# Configuration
export NODE_OPTIONS="--max-old-space-size=6144"

echo "📊 Configuration:"
echo "   - Build mode: Full build (no chunking)"
echo "   - Memory allocation: 6GB for Node.js"
echo ""

# Initial disk usage
echo "📊 Initial disk usage:"
df -h | head -2
echo ""

# Clean previous artifacts
echo "🧹 Cleaning up previous build artifacts..."
rm -rf .next out
echo ""

# Run Next.js build
echo "🔨 Starting Next.js build..."
pnpm next build

echo ""
echo "✅ Build completed successfully!"
echo ""

# Final disk usage
echo "📊 Final disk usage:"
df -h | head -2
echo ""

# Output summary
if [ -d "out" ]; then
    file_count=$(find out -type f | wc -l)
    echo "📈 Build summary:"
    echo "   - Total output files: $file_count"
    echo "   - Output directory: ./out"
    echo ""
    echo "🎉 Build completed successfully!"
else
    echo "❌ Error: out directory not found!"
    exit 1
fi
