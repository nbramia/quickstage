# QuickStage

QuickStage is a one-click "stage and share" workflow for static front-end prototypes directly from Cursor/VS Code. It builds locally, uploads the static output to Cloudflare R2, and returns a short-lived, password-gated share URL. No CI, no GitHub, no public sandboxes.

## License

This software is proprietary and confidential. It is licensed, not sold, and requires an active subscription to QuickStage services. See [LICENSE](apps/extension/LICENSE) for full terms and conditions.

This software is proprietary and confidential. It is licensed, not sold, and requires an active subscription to QuickStage services. See [LICENSE](apps/extension/LICENSE) for full terms and conditions.

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
- `POST /billing/webhook`