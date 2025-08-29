#!/bin/bash

# QuickStage Full-Stack Deployment Script with Mandatory Testing
# This script ensures tests pass before deploying both worker and web app

set -e  # Exit on any error

echo "🚀 QuickStage Full-Stack Deployment with Testing"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Must run from apps/worker directory"
    exit 1
fi

# Store the worker directory for later
WORKER_DIR=$(pwd)

echo ""
print_info "Phase 1: Worker Testing & Deployment"
echo "----------------------------------------"

# Step 1: Install dependencies
print_status "Installing worker dependencies..."
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

# Step 5: Deploy worker to Cloudflare
print_status "Deploying worker to Cloudflare..."
cd ../../infra
if npx wrangler deploy; then
    print_status "Worker deployment successful! 🎉"
else
    print_error "Worker deployment failed!"
    exit 1
fi
cd "$WORKER_DIR"

# Step 6: Verify worker deployment
print_status "Verifying worker deployment..."
sleep 5  # Wait for deployment to propagate

# Test a simple endpoint
HEALTH_CHECK=$(curl -s https://quickstage-worker.nbramia.workers.dev/debug/health || echo "FAILED")
if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    print_status "Worker health check passed! Backend is operational."
else
    print_warning "Worker health check failed or returned unexpected response:"
    echo "$HEALTH_CHECK"
fi

echo ""
print_info "Phase 2: Web App Testing & Deployment"
echo "------------------------------------------"

# Step 7: Navigate to web app directory
print_status "Switching to web app directory..."
cd ../web

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Web app directory structure not found"
    exit 1
fi

# Step 8: Install web app dependencies
print_status "Installing web app dependencies..."
npm install

# Step 9: Run web app tests
print_status "Running web app tests..."
if npm run test:critical; then
    print_status "Web app tests passed!"
else
    print_error "Web app tests failed! Cannot deploy."
    exit 1
fi

# Step 10: Build web app
print_status "Building web app..."
if npm run build; then
    print_status "Web app build successful!"
else
    print_error "Web app build failed! Cannot deploy."
    exit 1
fi

# Step 11: Deploy web app to Cloudflare Pages
print_status "Deploying web app to Cloudflare Pages..."
if npx wrangler pages deploy dist --project-name=quickstage --branch=main --commit-dirty=true; then
    print_status "Web app deployment successful! 🎉"
else
    print_error "Web app deployment failed!"
    exit 1
fi

# Step 12: Verify web app deployment
print_status "Verifying web app deployment..."
sleep 3  # Wait for deployment to propagate

# Test web app accessibility (basic check)
WEB_APP_CHECK=$(curl -s -I https://quickstage.pages.dev | head -1 || echo "FAILED")
if echo "$WEB_APP_CHECK" | grep -q "200\|302"; then
    print_status "Web app deployment verified!"
else
    print_warning "Web app verification check failed:"
    echo "$WEB_APP_CHECK"
fi

echo ""
print_status "🎉 FULL-STACK DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
echo "Deployed Services:"
echo "• Backend Worker: https://quickstage-worker.nbramia.workers.dev"
echo "• Frontend Web App: https://quickstage.pages.dev"
echo ""
echo "Next steps:"
echo "1. Test the complete application flow"
echo "2. Verify all endpoints are working"
echo "3. Check analytics and monitoring"
echo "4. Test user authentication and features"
echo ""
echo "🚀 QuickStage is now live and ready for users!"
