# QuickStage

A modern, lightning-fast platform for sharing and collaborating on web prototypes. Built with React, TypeScript, and Cloudflare Workers.

## Features

- **One-Click Sharing**: Share your web prototypes instantly with a single click
- **Real-Time Preview**: View prototypes in real-time with live updates
- **Collaborative Comments**: Add feedback and collaborate with team members
- **Secure Access Control**: Role-based permissions and secure sharing
- **Mobile Responsive**: Optimized for all devices and screen sizes
- **Pro Features**: Advanced features for power users and teams

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS 4, Vite 5
- **Backend**: Cloudflare Workers, Hono.js, TypeScript
- **Authentication**: Custom JWT-like tokens, Google OAuth
- **Storage**: Cloudflare KV, Cloudflare R2
- **Deployment**: Cloudflare Pages, Wrangler
- **Package Manager**: pnpm (monorepo)

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
```

### Deployment

```bash
# Deploy to Cloudflare
pnpm deploy

# Deploy specific service
pnpm --filter @quickstage/worker deploy
pnpm --filter @quickstage/web deploy
```

## Project Structure

```
quickstage/
├── apps/
│   ├── web/                 # React web application
│   ├── worker/              # Cloudflare Worker backend
│   └── extension/           # VS Code extension
├── packages/
│   └── shared/              # Shared utilities and types
├── infra/                   # Infrastructure configuration
└── docs/                    # Documentation
```

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
