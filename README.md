# QuickStage

QuickStage is a one-click "stage and share" workflow for static front-end prototypes directly from Cursor/VS Code. It builds locally, uploads the static output to Cloudflare R2, and returns a short-lived, password-gated share URL. No CI, no GitHub, no public sandboxes.

## Features

- **One-Click Staging**: VS Code extension with single "Stage" button
- **Local Build Execution**: Runs your project's build script using corepack
- **Framework Support**: Vite (React/Vue/Svelte), CRA, SvelteKit (static), Next.js (export)
- **Secure Sharing**: Per-snapshot auto-generated passwords, editable, private by default
- **Real-time Comments**: Inline sidebar with Turnstile anti-spam protection
- **Cloudflare Stack**: Pages, Workers, R2, KV, Durable Objects, Turnstile
- **Billing Integration**: Stripe Checkout for Pro tier upgrades
- **Web Dashboard**: Complete web interface for managing snapshots and settings

## Architecture

### Monorepo Structure
```
/quickstage
├── apps/
│   ├── extension/     # VS Code extension
│   ├── web/          # Dashboard & viewer (React + Vite)
│   └── worker/       # Cloudflare Worker API
├── packages/
│   └── shared/       # Common types & utilities
└── infra/            # Deployment configs
```

### Cloudflare Services
- **Workers**: Backend API (Hono), authentication, snapshot lifecycle
- **Pages**: Frontend hosting for dashboard and viewer
- **R2**: Object storage for snapshot assets
- **KV**: User data, snapshot metadata, license records
- **Durable Objects**: Real-time comments per snapshot
- **Turnstile**: Anti-spam protection for comments

### Data Flow
1. Extension detects project type and build script
2. Executes local build using corepack
3. Scans output directory for static files
4. Creates snapshot via Worker API
5. Uploads files to R2 (presigned URLs with proper content-type handling or streaming fallback)
6. Finalizes snapshot and returns share URL

## Web Dashboard

### Features
- **Dashboard**: View and manage all snapshots with creation dates, expiry, and status
- **Settings**: Account management, plan details, upgrade to Pro, API access info
- **Viewer**: Password-protected snapshot viewing with real-time comments
- **Navigation**: Seamless navigation between Dashboard and Settings

### Comment System
- **Real-time Comments**: Inline sidebar for each snapshot
- **Turnstile Protection**: Cloudflare Turnstile anti-spam integration
- **Anonymous Posting**: Optional handle/nickname for commenters
- **Durable Objects**: Persistent comment storage per snapshot with proper Cloudflare Workers implementation

## API Endpoints

### Authentication
- `POST /auth/dev-login` - Development login
- `POST /auth/register-passkey/begin` - Start Passkey registration
- `POST /auth/register-passkey/finish` - Complete Passkey registration
- `POST /auth/login-passkey/begin` - Start Passkey authentication
- `POST /auth/login-passkey/finish` - Complete Passkey authentication
- `GET /me` - Get current user info

### Snapshots
- `POST /snapshots/create` - Create new snapshot
- `POST /upload-url` - Get R2 presigned PUT URL
- `PUT /upload` - Stream upload fallback
- `POST /snapshots/finalize` - Complete snapshot creation
- `GET /snapshots/list` - List user snapshots
- `POST /snapshots/expire` - Mark snapshot as expired
- `POST /snapshots/extend` - Extend snapshot expiry
- `POST /snapshots/rotate-password` - Change snapshot password

### Assets & Viewing
- `GET /s/:id/*` - Serve snapshot assets with password gating
- `POST /s/:id/gate` - Verify password and set access cookie

### Comments
- `POST /comments` - Add comment (requires Turnstile token)
- `GET /comments/:snapshotId` - Get comments for snapshot

### Billing
- `POST /billing/checkout` - Create Stripe Checkout session
- `POST /billing/webhook` - Handle Stripe webhooks

## Security & Privacy

### Authentication
- **Passkeys (WebAuthn)**: Primary authentication method
- **Dev Login**: Simplified development authentication
- **Sessions**: HttpOnly, Secure cookies with HMAC signing
- **Rate Limiting**: Per-endpoint abuse prevention

### File Security
- **MIME Type Validation**: Strict allowlist for file types
- **Size Limits**: Configurable per-snapshot and per-file caps
- **Password Protection**: Scrypt-based hashing per snapshot
- **Access Control**: Private by default, optional public sharing

### Anti-Spam Protection
- **Turnstile Integration**: Cloudflare's privacy-first CAPTCHA alternative
- **Server-side Validation**: Token verification on comment submission
- **Configurable Site Keys**: Environment-specific Turnstile configuration

### Headers & CSP
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=()`
- `Cache-Control: no-cache` for sensitive assets

## Local Development

### Prerequisites
- Node.js 18+ with corepack enabled
- pnpm (via corepack or global install)
- Cloudflare account with Workers/Pages/R2 access

### Setup
```bash
# Enable corepack and install dependencies
corepack enable
pnpm install

# Install per-app dependencies
cd apps/web && pnpm install
cd ../extension && pnpm install
cd ../worker && pnpm install
cd ../..

# Set up environment variables
cp infra/.env.example infra/.env
# Edit infra/.env with your Cloudflare credentials
```

### Development Commands
```bash
# Start web app dev server
cd apps/web && pnpm dev

# Start worker dev server
cd apps/worker && pnpm dev

# Build extension
cd apps/extension && pnpm build
```

## Deployment

### Cloudflare Setup
1. **Workers**: Deploy with `wrangler deploy` from `infra/`
2. **Pages**: Connect repository and deploy from `apps/web/`
3. **R2**: Create bucket and configure CORS
4. **KV**: Create namespaces for users and snapshots
5. **Durable Objects**: Configure for comments

### Environment Variables
```bash
# Worker bindings (wrangler.toml)
KV_USERS=your-users-kv
KV_SNAPS=your-snapshots-kv
R2_SNAPSHOTS=your-r2-bucket
COMMENTS_DO=your-comments-do

# Authentication
SESSION_HMAC_SECRET=your-session-secret
RP_ID=your-domain.com

# Anti-spam
TURNSTILE_SECRET_KEY=your-turnstile-secret

# Billing
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_PRICE_ID=your-price-id
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# URLs
PUBLIC_BASE_URL=https://your-domain.com
```

### Routing Configuration
- **Worker API**: Route `/api/*` to your Worker
- **Pages App**: Route root and `/app/*` to your Pages app
- **Asset Serving**: Route `/s/:id/*` to Worker for password gating

## Extension Usage

### Commands
- `QuickStage: Stage` - One-click staging
- `QuickStage: Stage Manual` - Manual path selection
- `QuickStage: Open Dashboard` - Open web dashboard
- `QuickStage: Settings` - Open/create `.quickstage.json`

### Configuration
Create `.quickstage.json` in your project root:
```json
{
  "outputDir": "dist",
  "ignore": ["*.map", "*.log"],
  "maxFileSizeMB": 5,
  "expiryDays": 7,
  "passwordMode": "auto",
  "spaFallback": true,
  "public": false
}
```

### Supported Frameworks
- **Vite**: Detects `vite.config.*` and runs `npm run build`
- **Create React App**: Runs `npm run build`
- **SvelteKit**: Detects `svelte.config.*` and runs `npm run build`
- **Next.js**: Detects `next.config.*` and runs `npm run build`

## Billing & Quotas

### Free Tier
- 10 active snapshots
- 20 MB per snapshot
- 5 MB per file
- 7-day expiry (configurable 1-14 days)
- 1,000 views per month

### Pro Tier
- Unlimited snapshots
- 100 MB per snapshot
- 25 MB per file
- 30-day expiry (configurable 1-90 days)
- 10,000 views per month
- Priority support

### Stripe Integration
- **Checkout**: Redirects to Stripe for subscription
- **Webhooks**: Updates user plan on successful payment
- **Edge Compatible**: Uses FetchHttpClient and SubtleCryptoProvider

## Testing

### Test Matrix
- **Frameworks**: Vite, CRA, SvelteKit, Next.js
- **Build Tools**: npm, yarn, pnpm
- **Node Versions**: 18, 20, 22
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Authentication**: Passkeys, dev login
- **File Types**: HTML, CSS, JS, images, fonts

### Test Commands
```bash
# Run all tests
pnpm test

# Test specific app
cd apps/web && pnpm test
cd ../worker && pnpm test
cd ../extension && pnpm test
```

## Notes

### Passkey Implementation
- Uses `@simplewebauthn/server` for server-side validation
- Client-side marshalling required for binary field conversion
- Stores public keys in KV with user records

### Turnstile Integration
- Server-side validation on comment submission
- Requires `cf-turnstile-token` header from client
- Configurable site keys per environment
- Privacy-first alternative to traditional CAPTCHAs

### R2 Presigned URLs
- Generates AWS SigV4-compatible URLs for direct uploads
- Properly handles content-type headers for PUT requests
- 10-minute expiration for security (configurable up to 600 seconds)
- Fallback to Worker streaming upload if presigned fails
- Full AWS SigV4 signature calculation with proper canonical request formatting

### Extension Development
- VS Code API for file system and terminal access
- Output channel for build progress feedback
- Error handling with user-friendly messages

### Web Dashboard
- React-based SPA with React Router
- Responsive design with consistent navigation
- Real-time comment updates via Durable Objects
- Integrated Turnstile widget for comment protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

Proprietary - All rights reserved by QuickStage.

## Support

For support and questions:
- Email: support@quickstage.tech
- Documentation: https://docs.quickstage.tech
- Issues: GitHub repository issues
