#!/bin/bash

# QuickStage Custom Domain Deployment Script
# This script sets up snap.quickstage.tech for clean snapshot URLs

set -e

echo "🚀 Starting QuickStage custom domain deployment..."

# Step 1: Deploy the worker with rate limiting fixes and custom domain config
echo "🔧 Deploying worker with rate limiting fixes and custom domain config..."
cd infra
npx wrangler deploy
cd ..

# Step 2: Build and deploy the web app with updated extension
echo "🌐 Building and deploying web app with updated extension..."
cd apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
cd ..

echo "✅ Deployment complete!"
echo ""
echo "🔍 Next steps to complete custom domain setup:"
echo "1. Go to Cloudflare Dashboard → Workers & Pages"
echo "2. Select your 'quickstage-worker'"
echo "3. Go to Settings → Custom Domains"
echo "4. Add custom domain: snap.quickstage.tech"
echo "5. Update the wrangler.toml zone_id with your actual zone ID"
echo ""
echo "📝 The extension now generates URLs like:"
echo "   https://snap.quickstage.tech/s/[snapshot-id]"
echo ""
echo "📝 Rate limiting has been fixed with retry logic and exponential backoff"
echo ""
echo "🎯 Test the deployment by staging a new project!"
