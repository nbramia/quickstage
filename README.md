# QuickStage

QuickStage is a one-click "stage and share" workflow for static front-end prototypes directly from Cursor/VS Code. It builds locally, uploads the static output to Cloudflare R2, and returns a short-lived, password-gated share URL. No CI, no GitHub, no public sandboxes.

## License

This software is proprietary and confidential. It is licensed, not sold, and requires an active subscription to QuickStage services. See [LICENSE](apps/extension/LICENSE) for full terms and conditions.

## Recent Updates

### Enhanced Authentication System (2025-01-27)
- **Email/Password Authentication**: Traditional login and registration with secure password handling
- **Google OAuth Integration**: One-click sign-in using Google accounts with proper OAuth 2.0 flow
- **Passkey Support**: Modern WebAuthn-based authentication for passwordless login
- **Unified Auth Context**: Centralized authentication management with multiple provider support
- **Modern UI Design**: Clean, responsive interface with improved user experience

### TypeScript Build Issues (2025-08-10)
- Fixed passkey support detection in Login.tsx that was causing Cloudflare deployment failures
- Resolved async function calls for `isUserVerifyingPlatformAuthenticatorAvailable` and `isConditionalMediationAvailable`
- All builds now pass successfully: `pnpm build`, `pnpm package`

## Features

- **One-Click Staging**: VS Code extension with single "Stage" button
- **Local Build Execution**: Runs your project's build script using corepack
- **Framework Support**: Vite (React/Vue/Svelte), CRA, SvelteKit (static), Next.js (export)
- **Secure Sharing**: Per-snapshot auto-generated passwords, editable, private by default
- **Real-time Comments**: Inline sidebar with Turnstile anti-spam protection
- **Cloudflare Stack**: Pages, Workers, R2, KV, Durable Objects, Turnstile
- **Billing Integration**: Stripe Checkout for Pro tier upgrades
- **Web Dashboard**: Complete web interface for managing snapshots and settings
- **Multi-Provider Authentication**: Email/password, Google OAuth, and passkey support

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

### Authentication System
- **Email/Password**: Traditional registration and login with secure password handling
- **Google OAuth**: One-click sign-in using Google accounts with OAuth 2.0
- **Passkey Support**: Modern WebAuthn-based authentication for passwordless login
- **Unified Experience**: Seamless switching between authentication methods
- **Secure Sessions**: Cookie-based session management with proper security

### Snapshot Management
- **View Snapshots**: See all your snapshots with creation dates, expiry times, and view counts
- **Extend Snapshots**: Extend the expiry time of any snapshot by 7 days
- **Expire Snapshots**: Manually expire snapshots before their natural expiry
- **Rotate Passwords**: Generate new passwords for password-protected snapshots
- **Copy URLs**: One-click copying of snapshot share URLs
- **Password Display**: View current passwords for password-protected snapshots

### Comment System
- **Real-time Comments**: Inline sidebar for each snapshot
- **Turnstile Protection**: Cloudflare Turnstile anti-spam integration
- **Anonymous Posting**: Optional handle/nickname for commenters
- **Durable Objects**: Persistent comment storage per snapshot with proper Cloudflare Workers implementation

## API Endpoints

### Authentication
- `POST /auth/dev-login` - Development login
- `POST /auth/login` - Email/password login
- `POST /auth/register` - Email/password registration
- `POST /auth/google` - Google OAuth authentication
- `POST /auth/logout` - Logout and clear session
- `PUT /auth/profile` - Update user profile (name, email)
- `POST /auth/change-password` - Change user password
- `DELETE /auth/passkeys/:credentialId` - Remove passkey
- `POST /auth/register-passkey/begin` - Start Passkey registration
- `POST /auth/register-passkey/finish` - Complete Passkey registration
- `POST /auth/login-passkey/begin` - Start Passkey authentication
- `POST /auth/login-passkey/finish` - Complete Passkey authentication
- `GET /me` - Get current user info

### Snapshots
- `POST /snapshots/create` - Create new snapshot
- `GET /snapshots/:id` - Get individual snapshot details
- `POST /upload-url` - Get R2 presigned PUT URL
- `PUT /upload` - Stream upload fallback
- `POST /snapshots/finalize` - Complete snapshot creation
- `GET /snapshots/list` - List user snapshots
- `POST /snapshots/:id/expire` - Mark snapshot as expired
- `POST /snapshots/:id/extend` - Extend snapshot expiry
- `POST /snapshots/:id/rotate-password` - Change snapshot password

### Assets & Viewing
- `GET /s/:id/*` - Serve snapshot assets with password gating
- `POST /s/:id/gate` - Verify password and set access cookie

### Comments
- `POST /comments` - Add comment (requires Turnstile token)
- `GET /comments` - Get comments for snapshot (with query parameter)

### Billing
- `POST /billing/checkout` - Create Stripe Checkout session
- `POST /billing/webhook` - Stripe webhook handler

## Environment Configuration

### Required Environment Variables
```bash
# Google OAuth (for web app)
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id-here

# API Configuration
VITE_API_BASE_URL=http://localhost:8787
```

### Google OAuth Setup
1. Create a project in Google Cloud Console
2. Enable Google+ API and Google OAuth 2.0
3. Create OAuth 2.0 credentials
4. Add authorized origins and redirect URIs
5. Set `VITE_GOOGLE_CLIENT_ID` in your environment

### Backend Environment Variables (Worker)
```bash
# Authentication
SESSION_HMAC_SECRET=your-session-secret-here-change-in-production
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# Stripe (for billing)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Turnstile (for comments)
TURNSTILE_SECRET_KEY=your-turnstile-secret-key
```

### Google OAuth Configuration
For the Google Cloud Console OAuth 2.0 credentials:

**Authorized JavaScript origins:**
- `http://localhost:5173` (development)
- `https://quickstage.tech` (production)

**Authorized redirect URIs:**
- `http://localhost:5173` (development)
- `https://quickstage.tech` (production)

## Development

### Prerequisites
- Node.js 18+ with corepack enabled
- pnpm package manager
- Cloudflare account with Workers, Pages, and R2

### Setup
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
# Edit .env with your configuration

# Start development servers
pnpm dev

# Build for production
pnpm build

# Package extension
pnpm package
```

### Authentication Testing
- **Email/Password**: Use the registration form to create test accounts
- **Google OAuth**: Requires valid Google OAuth client ID in environment
- **Passkeys**: Test with browsers that support WebAuthn (Chrome, Safari, Edge)

### Complete Authentication Flow
The system now supports three authentication methods:

1. **Email/Password Authentication**
   - Secure registration with email verification
   - Password hashing using Argon2id
   - Session management with secure cookies
   - Password change functionality

2. **Google OAuth 2.0**
   - One-click sign-in using Google accounts
   - Automatic user creation for new Google users
   - Secure token verification with Google's servers
   - Seamless integration with existing accounts

3. **Passkey (WebAuthn)**
   - Modern passwordless authentication
   - Platform authenticator support
   - Multiple passkey management
   - Secure credential storage

### User Management Features
- **Profile Updates**: Change name and email
- **Password Management**: Change passwords securely
- **Passkey Management**: Add/remove passkeys
- **Session Management**: Secure logout and session handling
- **Multi-Provider Linking**: Link multiple authentication methods to one account