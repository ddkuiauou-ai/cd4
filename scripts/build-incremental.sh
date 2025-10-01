#!/bin/bash
# CD3 Project - Incremental Export Build (Disk-optimized for GitHub Actions)

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting incremental SSG build (disk-optimized)..."

# Configuration
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
export NEXT_TELEMETRY_DISABLED=1

PAGES_PER_BATCH=${PAGES_PER_BATCH:-5000}  # 배치당 페이지 수

echo "📊 Configuration:"
echo "   - Build mode: Incremental export"
echo "   - Pages per batch: $PAGES_PER_BATCH"
echo "   - Memory: 6GB for Node.js"
echo ""

# Disk usage check
check_disk() {
    df -h / | tail -1
}

echo "💾 Initial disk:"
check_disk
echo ""

# Clean up
echo "🧹 Cleaning previous builds..."
rm -rf out .next build.log
echo ""

# Step 1: Build only (no export)
echo "🔨 Step 1: Building Next.js (no export)..."
echo "   This compiles the app but doesn't generate static files yet"
echo ""

# Temporarily disable output export
cat > next.config.temp.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // NO output: 'export' - we'll handle export manually
  
  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      '@radix-ui/react-slot',
      'lucide-react',
    ],
  },
};

export default nextConfig;
EOF

# Backup original config
mv next.config.ts next.config.original.ts
mv next.config.temp.ts next.config.ts

# Build without export
if ! pnpm next build 2>&1 | tee build.log; then
    echo "❌ Build failed!"
    mv next.config.original.ts next.config.ts
    exit 1
fi

echo ""
echo "✅ Build completed!"
echo "💾 Disk after build:"
check_disk
echo ""

# Restore original config
mv next.config.original.ts next.config.ts

# Step 2: Use next start + wget to generate static files
echo "🔨 Step 2: Generating static files..."
echo "   Starting Next.js server and crawling pages..."
echo ""

mkdir -p out

# Start Next.js server in background
pnpm next start -p 3000 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Server ready!"
        break
    fi
    sleep 1
done

# Use wget to mirror the site (generates static files)
echo "📥 Crawling and generating static pages..."
wget \
    --recursive \
    --no-parent \
    --page-requisites \
    --html-extension \
    --convert-links \
    --restrict-file-names=windows \
    --domains localhost \
    --no-clobber \
    --directory-prefix=out-temp \
    http://localhost:3000/

# Stop server
kill $SERVER_PID 2>/dev/null || true

# Move files to out directory
mv out-temp/localhost:3000/* out/
rm -rf out-temp

echo ""
echo "✅ Static generation completed!"
echo "💾 Final disk:"
check_disk
echo ""

# Generate sitemap
echo "🗺️ Generating sitemap..."
node scripts/generate-sitemap.js

# Final cleanup
echo "🧹 Final cleanup..."
rm -rf .next
rm -rf build.log

echo ""
echo "🎉 Incremental build completed successfully!"
echo "📊 Summary:"
echo "   - Output files: $(find out -type f | wc -l)"
echo "   - Output size: $(du -sh out | cut -f1)"
