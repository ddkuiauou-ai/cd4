#!/bin/bash
# CD3 Project - High-Speed R2 Upload Script

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting high-speed upload to Cloudflare R2..."

# Check if out directory exists
if [ ! -d "out" ]; then
    echo "❌ Error: out directory not found!"
    echo "Please run build first: pnpm run build"
    exit 1
fi

# Count files
file_count=$(find out -type f | wc -l | tr -d ' ')
total_size=$(du -sh out | cut -f1)

echo "📊 Upload statistics:"
echo "   - Total files: $file_count"
echo "   - Total size: $total_size"
echo ""

# Check for required environment variables
if [ -z "$R2_ACCOUNT_ID" ] || [ -z "$R2_BUCKET_NAME" ]; then
    echo "❌ Error: Required environment variables not set!"
    echo "Please set: R2_ACCOUNT_ID, R2_BUCKET_NAME"
    exit 1
fi

R2_ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "🔧 Configuring AWS CLI for maximum performance..."

# Configure AWS CLI for high-speed uploads
aws configure set default.s3.max_concurrent_requests 100
aws configure set default.s3.max_queue_size 10000
aws configure set default.s3.multipart_threshold 64MB
aws configure set default.s3.multipart_chunksize 16MB
aws configure set default.s3.max_bandwidth 200MB/s

echo "✅ AWS CLI configured"
echo ""
echo "📤 Uploading to R2 with 100 concurrent connections..."
echo "   Endpoint: $R2_ENDPOINT_URL"
echo "   Bucket: $R2_BUCKET_NAME"
echo ""

start_time=$(date +%s)

# Upload with progress
aws s3 sync ./out s3://${R2_BUCKET_NAME}/ \
    --endpoint-url $R2_ENDPOINT_URL \
    --delete \
    --only-show-errors

end_time=$(date +%s)
upload_time=$((end_time - start_time))

echo ""
echo "✅ Upload completed successfully!"
echo ""
echo "📈 Upload summary:"
echo "   - Total files: $file_count"
echo "   - Total size: $total_size"
echo "   - Upload time: $((upload_time / 60))m $((upload_time % 60))s"
if [ $upload_time -gt 0 ]; then
    echo "   - Average speed: ~$((file_count / upload_time)) files/sec"
fi
echo ""
echo "🎉 Deployment completed!"
