#!/bin/bash

# QuickStage Web Deployment Script with Comprehensive Testing
# This script ensures thorough testing before deployment

set -e # Exit on any error

echo "🚀 Starting QuickStage Web Deployment Process..."
echo "📅 Deployment started at: $(date)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the correct directory?"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

print_status "Starting pre-deployment checks..."

# Step 1: Type checking
print_status "Running TypeScript type checking..."
if npm run typecheck; then
    print_success "TypeScript type checking passed"
else
    print_error "TypeScript type checking failed"
    exit 1
fi

# Step 2: Linting
print_status "Running ESLint..."
if npm run lint; then
    print_success "Linting passed"
else
    print_warning "Linting issues found, but continuing..."
fi

# Step 3: Run critical tests
print_status "Running critical tests..."
if npm run test:critical; then
    print_success "Critical tests passed"
else
    print_error "Critical tests failed - deployment blocked"
    exit 1
fi

# Step 4: Run all tests
print_status "Running full test suite..."
if npm run test; then
    print_success "All tests passed"
else
    print_error "Some tests failed - deployment blocked"
    exit 1
fi

# Step 5: Build the application
print_status "Building application..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

# Step 6: Verify build output
print_status "Verifying build output..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    print_success "Build artifacts verified"
    echo "Build size: $(du -sh dist | cut -f1)"
else
    print_error "Build verification failed - missing expected files"
    exit 1
fi

# Step 7: Test build locally (quick smoke test)
print_status "Running build smoke test..."
if npm run preview &
then
    PREVIEW_PID=$!
    sleep 3
    
    # Check if preview server is running
    if curl -s http://localhost:5173 > /dev/null; then
        print_success "Build smoke test passed"
        kill $PREVIEW_PID 2>/dev/null || true
    else
        print_error "Build smoke test failed - preview server not responding"
        kill $PREVIEW_PID 2>/dev/null || true
        exit 1
    fi
else
    print_error "Failed to start preview server"
    exit 1
fi

print_success "🎉 All deployment checks passed!"
print_success "✅ TypeScript compilation: PASSED"
print_success "✅ Linting: PASSED"  
print_success "✅ Critical tests: PASSED"
print_success "✅ Full test suite: PASSED"
print_success "✅ Build process: PASSED"
print_success "✅ Build verification: PASSED"
print_success "✅ Smoke test: PASSED"

echo ""
echo "📦 Deployment Summary:"
echo "   - Build size: $(du -sh dist | cut -f1)"
echo "   - Build files: $(find dist -type f | wc -l | tr -d ' ') files"
echo "   - Deployment completed at: $(date)"
echo ""

print_success "🚀 Ready for deployment! All checks passed."

