#!/bin/bash

# QuickStage Routing Fix Deployment Script
# This script fixes the /s/* routing issue by deploying everything in the correct order

set -e

echo "🚀 Starting QuickStage routing fix deployment..."

# Step 1: Build the web app with all routing fixes
echo "📦 Building web app with routing fixes..."
cd apps/web
pnpm build
cd ../..

# Step 2: Deploy the worker first (contains the /s/* route handlers)
echo "🔧 Deploying worker with /s/* route handlers..."
cd infra
npx wrangler deploy
cd ..

# Step 3: Deploy the web app to Cloudflare Pages
echo "🌐 Deploying web app to Cloudflare Pages..."
cd infra
npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
cd ..

echo "✅ Deployment complete!"
echo ""
echo "🔍 Testing the fix:"
echo "1. Visit: https://quickstage.tech/test-routing.html (should show routing test page)"
echo "2. Visit: https://quickstage.tech/s/test-routing.html (should show 404 or be proxied to worker)"
echo "3. Try staging a new project and check if /s/* routes work correctly"
echo ""
echo "📝 If routing still doesn't work, check Cloudflare Pages logs for errors."
echo "📝 The _worker.js file should handle /s/* routes by proxying to the main worker."
