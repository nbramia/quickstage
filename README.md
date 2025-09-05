# QuickStage

A modern, lightning-fast platform for sharing and collaborating on web prototypes. Built with React, TypeScript, and Cloudflare Workers.

## Features

- **One-Click Sharing**: Share your web prototypes instantly with a single click
- **Clean URLs**: Beautiful, professional URLs at `quickstage.tech/s/{id}` 
- **Real-Time Preview**: View prototypes in real-time with live updates
- **Advanced Comment System**: Professional-grade threaded discussions with visual pinning, state management, and file attachments
- **AI UX Assistant**: Get expert UI/UX feedback powered by OpenAI GPT-4o-mini (40 requests/hour)
- **Project Management**: Organize snapshots into folders with bulk operations and modern sidebar interface
- **Notification System**: Real-time notifications with unread badges accessible from all main pages
- **Subscription Management**: Comment thread subscriptions with pause/resume controls in account settings
- **Follow System**: Follow snapshots to get notifications for new comments and review updates
- **Review Workflows**: Structured review requests with participant management and approval workflows
- **Unified Dashboard**: Modern interface combining project management, extension downloads, and analytics
- **Admin Dashboard**: Comprehensive admin interface for managing users, snapshots, and system analytics
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

# Set up OpenAI API key for AI features
cd infra
wrangler secret put OPENAI_API_KEY --config ../../infra/wrangler.toml
# Enter your OpenAI API key when prompted

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

## 🤖 AI UX Assistant

QuickStage includes a powerful AI assistant that analyzes your prototypes and provides expert UI/UX feedback. Powered by OpenAI GPT-4o-mini, it offers conversational, contextual suggestions to improve your designs.

### Features

- **Real-time Analysis**: AI analyzes your HTML, CSS, and JavaScript files to understand your design
- **Conversational Interface**: Chat with the AI to ask specific questions about your prototype
- **Expert Feedback**: Get suggestions based on modern UI/UX principles, accessibility guidelines, and design best practices
- **Multiple Categories**: Feedback covers accessibility, usability, design, performance, and mobile responsiveness
- **Rate Limited**: Smart rate limiting (40 requests/hour, 100K tokens/hour) to prevent abuse
- **Anonymous Access**: Works for both signed-in users and anonymous viewers of public snapshots

### Key Areas of Analysis

- **Accessibility**: WCAG compliance, screen reader compatibility, keyboard navigation
- **Visual Design**: Typography hierarchy, color contrast, spacing consistency
- **Mobile UX**: Responsive design, touch targets, mobile-first considerations
- **Usability**: Navigation flow, error handling, loading states, user feedback
- **Performance**: Image optimization, code efficiency, loading patterns
- **Modern Standards**: Latest design trends and best practices

### How It Works

1. **Click "AI UX Assistant"** in any snapshot viewer
2. **Start Analysis**: AI reads your prototype files and provides initial feedback
3. **Ask Questions**: Continue the conversation with specific questions like:
   - "How can I improve accessibility for screen readers?"
   - "What's the best way to organize this navigation?"
   - "Is this color scheme accessible?"
   - "How can I make this more mobile-friendly?"

### Rate Limiting & Error Handling

- **User Limits**: 40 AI requests per hour per user/IP
- **Token Limits**: 100,000 tokens per hour to manage OpenAI costs
- **Conversation Limits**: 20 messages per conversation (24-hour expiry)
- **Graceful Degradation**: Clear error messages when service is unavailable
- **Privacy**: User-friendly error messages (doesn't expose API funding issues)
- **Browser Compatibility**: Enhanced error handling for MutationObserver and iframe-related issues
- **Retry Mechanism**: Automatic retry functionality with user-friendly error messages
- **DOM Safety**: Proper null checks and timing delays to prevent browser compatibility issues

### Configuration

The AI assistant requires an OpenAI API key to be configured:

```bash
# Add your OpenAI API key to Cloudflare Workers secrets
cd infra
wrangler secret put OPENAI_API_KEY --config ../../infra/wrangler.toml
```

**API Documentation**: [OpenAI API Reference](https://platform.openai.com/docs/api-reference/authentication)

### Technical Implementation

- **Backend**: `/api/snapshots/:id/ai-chat/` endpoints in Cloudflare Workers
- **AI Model**: GPT-4o-mini for fast, cost-effective responses
- **Storage**: Conversations stored in Cloudflare KV with automatic expiry
- **Frontend**: Real-time chat interface with markdown-like formatting
- **Error Handling**: Comprehensive error handling for API failures, rate limits, and browser compatibility issues
- **DOM Safety**: Enhanced iframe handling with proper timing and null checks
- **Retry Logic**: Built-in retry mechanism with exponential backoff for failed requests

## 💬 Enhanced Comment System

QuickStage features a professional-grade comment system that rivals tools like Figma, Notion, and other collaborative platforms. The system supports threaded discussions, visual element pinning, and comprehensive state management.

### Comment Features

- **Threaded Conversations**: Nested discussions with visual thread indicators and depth-based spacing
- **Element Pinning**: Pin comments to specific UI elements with coordinate tracking
- **State Management**: Comments can be draft, published, resolved, or archived
- **File Attachments**: Drag & drop support for images, PDFs, and documents (10MB limit)
- **Rich Text Editing**: Live preview mode with character counting (5000 char limit)
- **Keyboard Shortcuts**: Ctrl/Cmd + Enter to submit, Escape to close
- **Real-time Updates**: Comments update via Durable Objects for instant collaboration
- **Permission System**: Owner and author-based permissions for editing/deleting

### Visual Features

- **Thread Connectors**: Visual lines connecting nested comments with depth indicators
- **State Badges**: Color-coded badges showing comment status with icons
- **Action Menus**: Contextual menus for resolve/archive/delete operations
- **Auto-expanding Threads**: First 3 levels auto-expand, deeper levels collapsible
- **Maximum Depth Protection**: 5-level nesting with continuation indicators
- **Mobile Responsive**: Touch-friendly interface with proper spacing

### Technical Architecture

- **Backend**: Enhanced comment routes in `/api/snapshots/:id/comments`
- **Storage**: Durable Objects (CommentsRoom) for real-time synchronization
- **Frontend Components**: CommentThread.tsx and CommentModal.tsx
- **TypeScript Types**: Comprehensive Comment interface with all fields
- **File Storage**: R2 bucket for attachment storage with secure URLs

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
- **Comment Analytics**: Creation, replies, edits, resolutions, archival, deletion
- **Subscription Events**: Comment thread subscriptions, activations, pauses, removals
- **Review Workflows**: Review requests, approvals, rejections, cancellations
- **System Events**: Error tracking, performance monitoring
- **Real-time Metrics**: Live user activity and system health with comprehensive metadata tracking

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

✅ **Comprehensive Test Coverage**: 166 tests across 15 test files

**Core Components:**
- `Login.test.tsx` - 13 tests ✅ (Authentication flows, form validation)
- `Landing.test.tsx` - 29 tests ✅ (Marketing page, responsive design)
- `Dashboard.test.tsx` - 5 tests ✅ (Main user interface, navigation)
- `Settings.test.tsx` - 6 tests ✅ (User preferences, account management)
- `AdminDashboard.test.tsx` - 5 tests ✅ (Admin interface, user management)
- `Viewer.test.tsx` - 5 tests ✅ (Snapshot viewing, file handling)
- `Simple.test.tsx` - 2 tests ✅ (Basic rendering)

**New Features:**
- `ProjectSidebar.test.tsx` - Project organization and management ✅
- `SnapshotTable.test.tsx` - Enhanced dashboard with sorting/filtering ✅
- `CommentSystem.test.tsx` - Collaborative commenting system ✅
- `CommentModal.test.tsx` - Enhanced comment interface with threading ✅
- `DashboardWidgets.test.tsx` - Dashboard analytics widgets ✅
- `BulkOperations.test.tsx` - Bulk snapshot operations ✅
- `ai-suggestions.test.ts` - AI UX Assistant functionality ✅ (11 tests)
- `notifications.test.ts` - Notification system ✅
- `subscriptions.test.ts` - Subscription management ✅

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
