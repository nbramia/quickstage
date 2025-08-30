# QuickStage

A modern, lightning-fast platform for sharing and collaborating on web prototypes. Built with React, TypeScript, and Cloudflare Workers.

## Features

- **One-Click Sharing**: Share your web prototypes instantly with a single click
- **Clean URLs**: Beautiful, professional URLs at `quickstage.tech/s/{id}` 
- **Real-Time Preview**: View prototypes in real-time with live updates
- **Collaborative Comments**: Add feedback and collaborate with team members
- **Secure Access Control**: Role-based permissions and secure sharing
- **Mobile Responsive**: Optimized for all devices and screen sizes
- **Pro Features**: Advanced features for power users and teams
- **Analytics & Insights**: Comprehensive user and system analytics tracking
- **Flexible Data Schema**: Modern, extensible data management with backward compatibility
- **Modular Architecture**: Clean, maintainable codebase with separated concerns

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS 4, Vite 5
- **Backend**: Cloudflare Workers, Hono.js, TypeScript
- **Authentication**: Custom JWT-like tokens, Google OAuth
- **Storage**: Cloudflare KV, Cloudflare R2, Cloudflare Analytics
- **Deployment**: Cloudflare Pages, Wrangler
- **Package Manager**: pnpm (monorepo)
- **Testing**: Vitest, React Testing Library, MSW
- **Code Organization**: Modular architecture with separated concerns

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers and Pages enabled
- Stripe account for billing (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/nbramia/quickstage.git
cd quickstage

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development
pnpm dev
```

### Development

```bash
# Start all services
pnpm dev

# Start specific service
pnpm --filter @quickstage/web dev
pnpm --filter @quickstage/worker dev
pnpm --filter @quickstage/extension dev

# Build for production
pnpm build

# Run tests
pnpm test

## 🚨 CRITICAL: Testing Requirements

**Before ANY deployment, AI agents MUST run tests:**

```bash
# Quick validation (5 seconds)
npm run test:quick

# Core functionality (1-2 minutes)  
npm run test:core

# Automated FULL-STACK deployment with testing
./deploy-with-tests.sh
```

**This script automatically:**
- ✅ Runs all tests for both worker and web app
- ✅ Deploys the backend worker to Cloudflare Workers
- ✅ Deploys the frontend web app to Cloudflare Pages
- ✅ Verifies both deployments are successful

**Failure to test will result in broken deployments.**
```

### Clean URL Configuration

QuickStage now uses clean URLs for all snapshots and API endpoints:
- Snapshots: `quickstage.tech/s/{id}` (instead of worker subdomain)
- All API calls route directly through the main domain
- Centralized configuration in `apps/web/src/config.ts`

### Deployment

```bash
# 🚀 RECOMMENDED: Full-stack deployment with testing
./deploy-with-tests.sh

# Alternative: Deploy specific service (if needed)
pnpm --filter @quickstage/worker deploy
pnpm --filter @quickstage/web deploy
```

**Note:** The `deploy-with-tests.sh` script handles both worker and web app deployment automatically, ensuring all tests pass before deployment.

## Project Structure

```
quickstage/
├── apps/
│   ├── web/                 # React web application
│   ├── worker/              # Cloudflare Worker backend
│   │   └── src/
│   │       ├── index.ts     # Main worker entry point (4,659 lines)
│   │       ├── auth.ts      # Authentication utilities
│   │       ├── user.ts      # User management functions
│   │       ├── stripe.ts    # Stripe webhook handlers
│   │       ├── snapshot.ts  # Snapshot management
│   │       ├── analytics.ts # Analytics tracking
│   │       ├── migrate-schema.ts # Schema migration helpers
│   │       ├── migration-system.ts # Data migration system
│   │       └── worker-utils.ts # Worker utilities
│   └── extension/           # VS Code extension
├── packages/
│   └── shared/              # Shared utilities and types
├── infra/                   # Infrastructure configuration
└── docs/                    # Documentation
```

## Data Schema & Analytics

The project uses a modern, extensible data schema designed for future growth and analytics:

### User Data Schema
- **Nested Structure**: Organized subscription and analytics data in dedicated objects
- **Backward Compatibility**: Maintains legacy fields while introducing new schema
- **Analytics Tracking**: Comprehensive event tracking for user interactions
- **Migration Support**: Built-in migration functions for schema evolution

### Analytics Capabilities
- **User Events**: Login, registration, page views, downloads
- **Snapshot Events**: Creation, viewing, expiration, extension
- **System Events**: Error tracking, performance monitoring
- **Real-time Metrics**: Live user activity and system health

### Schema Migration
- **Zero Downtime**: Seamless migration from legacy to new schema
- **Automatic Fallbacks**: Graceful handling of missing fields
- **Data Integrity**: Preserves all existing user data during transitions

## Testing

The project includes a comprehensive testing suite built with Vitest and React Testing Library. All tests are currently passing and cover:

- **Component Tests**: All major React components
- **Access Control**: User authentication and authorization
- **Core Actions**: Button clicks, form submissions, navigation
- **API Integration**: Mocked API calls and responses
- **User Experience**: Loading states, error handling, responsive design

### Test Status

✅ **All Tests Passing**: 65 tests across 7 test files

- `Login.test.tsx` - 13 tests ✅
- `Landing.test.tsx` - 29 tests ✅  
- `Dashboard.test.tsx` - 5 tests ✅
- `Settings.test.tsx` - 6 tests ✅
- `AdminDashboard.test.tsx` - 5 tests ✅
- `Viewer.test.tsx` - 5 tests ✅
- `Simple.test.tsx` - 2 tests ✅

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test "src/test/components/Dashboard.test.tsx"

# Run tests in watch mode
pnpm test:watch
```

## Code Architecture

The QuickStage codebase has been refactored for maintainability and scalability:

### **Modular Worker Structure**
- **`index.ts`** (4,659 lines): Main entry point with all API routes
- **`auth.ts`**: Authentication utilities (session, PAT, superadmin checks)
- **`user.ts`**: User management (creation, subscription, trial logic)
- **`stripe.ts`**: Stripe webhook handlers (payments, subscriptions)
- **`snapshot.ts`**: Snapshot management (view counting, cleanup)
- **`analytics.ts`**: Analytics tracking and event management
- **`migrate-schema.ts`**: Schema migration helpers
- **`migration-system.ts`**: Data migration system
- **`worker-utils.ts`**: Shared worker utilities

### **Benefits of Refactoring**
- **Reduced Complexity**: Main file reduced from 5,217 to 4,659 lines (11% smaller)
- **Better Maintainability**: Each module has a single responsibility
- **Easier Testing**: Modules can be tested independently
- **Team Collaboration**: Multiple developers can work on different modules
- **Code Reuse**: Modules can be imported where needed
- **Future Growth**: Easy to add new features without bloating main file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the `docs/` folder
- Review the `HOW_TO.md` for development guidelines
