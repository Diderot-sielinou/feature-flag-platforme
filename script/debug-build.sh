#!/bin/bash

set -e

echo "🧹 Cleaning all build artifacts..."
rm -rf .turbo
rm -rf node_modules/.cache
find . -type d -name "dist" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "📋 Generating Prisma Client..."
npm run db:generate

echo ""
echo "=========================================="
echo "🔨 Building @repo/shared..."
echo "=========================================="
npx turbo run build --filter=@repo/shared --force

echo ""
echo "🔍 Detailed check for @repo/shared..."
echo "Directory structure:"
ls -la packages/shared/

echo ""
echo "Looking for dist folder:"
if [ -d "packages/shared/dist" ]; then
  echo "✅ dist folder exists"
  echo "Contents of dist/:"
  ls -lah packages/shared/dist/
else
  echo "❌ dist folder does NOT exist"
  echo ""
  echo "Checking tsconfig.json configuration:"
  cat packages/shared/tsconfig.json | grep -A 2 "outDir\|rootDir"
  echo ""
  echo "Looking for any .js files in @repo/shared:"
  find packages/shared -name "*.js" -type f 2>/dev/null || echo "No .js files found"
  echo ""
  echo "Trying manual build to see errors:"
  cd packages/shared && npx tsc --listFiles && cd ../..
  exit 1
fi

echo ""
if [ -f "packages/shared/dist/index.js" ] && [ -f "packages/shared/dist/index.d.ts" ]; then
  echo "✅ @repo/shared built successfully"
  echo "Files created:"
  ls -lh packages/shared/dist/
else
  echo "❌ @repo/shared build failed - files missing"
  echo "Expected: index.js and index.d.ts"
  echo "Found:"
  ls -lh packages/shared/dist/ || echo "Nothing in dist/"
  exit 1
fi

echo ""
echo "=========================================="
echo "🔨 Building @repo/database..."
echo "=========================================="
npx turbo run build --filter=@repo/database --force

echo ""
echo "🔍 Checking @repo/database outputs..."
if [ -f "packages/database/dist/index.js" ] && [ -f "packages/database/dist/index.d.ts" ]; then
  echo "✅ @repo/database built successfully"
  ls -lh packages/database/dist/
else
  echo "❌ @repo/database build failed"
  echo "Contents of packages/database/dist/:"
  ls -lah packages/database/dist/ || echo "dist folder doesn't exist"
  exit 1
fi

echo ""
echo "=========================================="
echo "🔨 Building @repo/sdk..."
echo "=========================================="
npx turbo run build --filter=@repo/sdk --force

echo ""
echo "🔍 Checking @repo/sdk outputs..."
if [ -f "packages/sdk/dist/index.js" ] && [ -f "packages/sdk/dist/index.d.ts" ]; then
  echo "✅ @repo/sdk built successfully"
  ls -lh packages/sdk/dist/
else
  echo "❌ @repo/sdk build failed"
  echo "Contents of packages/sdk/dist/:"
  ls -lah packages/sdk/dist/ || echo "dist folder doesn't exist"
  exit 1
fi

echo ""
echo "=========================================="
echo "🔨 Building all packages..."
echo "=========================================="
npm run build

echo ""
echo "✅ All builds completed successfully!"