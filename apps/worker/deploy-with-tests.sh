#!/bin/bash

# QuickStage Worker Deployment Script with Mandatory Testing
# This script ensures tests pass before any deployment

set -e  # Exit on any error

echo "🚀 QuickStage Worker Deployment with Testing"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Must run from apps/worker directory"
    exit 1
fi

# Step 1: Install dependencies
print_status "Installing dependencies..."
npm install

# Step 2: Run quick tests (5 seconds)
print_status "Running quick tests..."
if npm run test:quick; then
    print_status "Quick tests passed!"
else
    print_error "Quick tests failed! Cannot deploy."
    exit 1
fi

# Step 3: Run core tests
print_status "Running core tests..."
if npm run test:core; then
    print_status "Core tests passed!"
else
    print_error "Core tests failed! Cannot deploy."
    exit 1
fi

# Step 4: Build the worker
print_status "Building worker..."
if npm run build; then
    print_status "Build successful!"
else
    print_error "Build failed! Cannot deploy."
    exit 1
fi

# Step 5: Deploy Worker to Cloudflare
print_status "Deploying Worker to Cloudflare..."
cd ../../infra
if npx wrangler deploy; then
    print_status "Worker deployment successful! 🎉"
else
    print_error "Worker deployment failed!"
    exit 1
fi
cd ../apps/worker

# Step 6: Build and Deploy Web App
print_status "Building web app..."
cd ../web
if npm run build; then
    print_status "Web app build successful!"
else
    print_error "Web app build failed!"
    exit 1
fi

print_status "Deploying web app to Cloudflare Pages..."
if npx wrangler pages deploy dist --project-name=quickstage; then
    print_status "Web app deployment successful! 🎉"
else
    print_error "Web app deployment failed!"
    exit 1
fi
cd ../worker

# Step 7: Verify deployment
print_status "Verifying deployment..."
sleep 5  # Wait for deployment to propagate

# Test a simple endpoint
HEALTH_CHECK=$(curl -s https://quickstage-worker.nbramia.workers.dev/debug/health || echo "FAILED")
if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    print_status "Health check passed! Worker is operational."
else
    print_warning "Health check failed or returned unexpected response:"
    echo "$HEALTH_CHECK"
fi

echo ""
print_status "Deployment completed successfully! 🎉"
echo "Worker URL: https://quickstage-worker.nbramia.workers.dev"
echo "Web App URL: https://quickstage.tech"
echo ""
echo "Next steps:"
echo "1. Test the web app at https://quickstage.tech"
echo "2. Verify all endpoints are working"
echo "3. Check analytics and monitoring"
