# QuickStage

QuickStage is a one-click "stage and share" workflow for static front-end prototypes directly from Cursor/VS Code. It builds locally, uploads the static output to Cloudflare R2, and returns a short-lived, password-gated share URL. No CI, no GitHub, no public sandboxes.

## License

This software is proprietary and confidential. It is licensed, not sold, and requires an active subscription to QuickStage services. See [LICENSE](apps/extension/LICENSE) for full terms and conditions.

## How It All Works - Complete System Architecture

### 🏗️ **System Overview**
QuickStage consists of three main components that work together seamlessly:

1. **VS Code/Cursor Extension** (`apps/extension/`) - Desktop editor integration
2. **Cloudflare Worker API** (`apps/worker/`) - Backend API and file serving
3. **Web Dashboard** (`apps/web/`) - User interface for managing snapshots

### 🔄 **Complete Workflow: From Editor to Shareable URL**

#### **Step 1: User Triggers "Stage" Command**
- User opens Command Palette (`Cmd/Ctrl + Shift + P`)
- Types "QuickStage: Stage" 
- Extension activates and begins the staging process

#### **Step 2: Project Analysis & Build**
- Extension detects project type (Vite, CRA, SvelteKit, Next.js)
- Identifies package manager (pnpm, yarn, npm)
- Runs the project's build script using corepack
- Scans output directory for static files

#### **Step 3: Snapshot Creation**
- Extension calls `POST /api/snapshots/create` with:
  ```json
  {
    "expiryDays": 7,
    "public": false
  }
  ```
- Worker generates unique snapshot ID and password
- Creates metadata record in KV storage
- Returns `{ id: "abc123", password: "xyz789" }`

#### **Step 4: File Upload Process**
For each file in the build output:
- Extension calculates file hash and size
- Calls `POST /api/upload-url` with:
  ```
  ?id=abc123&path=index.html&ct=text/html&sz=1234&h=abc123hash
  ```
- Worker generates R2 presigned PUT URL
- Extension uploads file directly to R2 using presigned URL

#### **Step 5: Snapshot Finalization**
- Extension calls `POST /api/snapshots/finalize` with:
  ```json
  {
    "id": "abc123",
    "totalBytes": 45678,
    "files": ["index.html", "main.js", "style.css"]
  }
  ```
- Worker marks snapshot as "ready" in KV storage
- Snapshot is now accessible via web

#### **Step 6: URL Generation & Sharing**
- Extension generates shareable URL: `https://quickstage-worker.nbramia.workers.dev/s/abc123`
- Copies password to clipboard (not full URL)
- User can now share the URL with others

#### **Step 7: Universal Commenting System**
- Every staged prototype automatically includes a commenting overlay
- Blue "💬 Comments" button appears in top-right corner
- Clicking opens a sliding side panel with comment form and list
- Comments are stored in Durable Objects and shared across all visitors
- Users can add their name or remain anonymous
- Real-time collaboration on any prototype regardless of framework

### 🌐 **API Endpoints & Routing Architecture**

#### **Cloudflare Worker Routes Configuration**
Your Worker is configured with these routes:
- `quickstage.tech/api/*` → `quickstage-worker` (API endpoints)
- `quickstage.tech/s/*` → `quickstage-worker` (Snapshot serving)

#### **Current Routing Strategy for /s/* Routes**
QuickStage currently uses a **direct Worker approach** for reliability:

1. **Extension generates URLs**: Directly to `https://quickstage-worker.nbramia.workers.dev/s/abc123`
2. **No Pages routing**: Bypasses Cloudflare Pages routing complexity
3. **Direct Worker access**: Ensures 100% reliability for snapshot serving
4. **Comments system**: Fully functional with Durable Objects

This approach prioritizes reliability over URL aesthetics, ensuring staged prototypes always work.

#### **API Endpoints by Component**

##### **Extension-Only Endpoints** (No `/api` prefix needed)
- `POST /snapshots/create` - Create new snapshot
- `POST /upload-url` - Get R2 presigned URLs
- `POST /snapshots/finalize` - Complete snapshot creation
- `GET /s/:id/*` - Serve snapshot files

##### **Web Dashboard Endpoints** (All have `/api` prefix)
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/me` - Get current user info
- `GET /api/snapshots/list` - List user snapshots
- `POST /api/snapshots/:id/expire` - Expire snapshot
- `POST /api/snapshots/:id/extend` - Extend snapshot expiry
- `POST /api/snapshots/:id/rotate-password` - Change password

##### **Shared Endpoints** (Both `/api` and non-`/api` versions)
- `POST /api/snapshots/create` - Web dashboard snapshot creation
- `POST /api/upload-url` - Web dashboard file uploads
- `POST /api/snapshots/finalize` - Web dashboard finalization
- `GET /api/s/:id/*` - Web dashboard file serving

##### **Extension Download Endpoints**
- `GET /quickstage.vsix` - Download QuickStage VSIX extension (served directly from web app)
- `GET /api/extensions/version` - Get extension version information and update status

### 🔐 **Authentication & Security Flow**

#### **Session Management**
- All API calls require valid session token
- Session stored in `ps_sess` httpOnly cookie
- Token contains encrypted user ID and expiration
- Automatic token verification on every request

#### **Cross-Origin Cookie Handling**
- Web dashboard: `quickstage.tech` (same domain)
- Extension: Uses Bearer token in Authorization header
- Worker accepts both cookie and header authentication

#### **File Access Control**
- Snapshot files require valid session or access cookie
- Password-protected snapshots check viewer access cookie
- R2 presigned URLs expire after 10 minutes

### 📁 **File Storage & Serving Architecture**

#### **R2 Storage Structure**
```
snapshots/
├── snap/
│   ├── abc123/
│   │   ├── index.html
│   │   ├── main.js
│   │   └── style.css
│   └── def456/
│       ├── app.js
│       └── styles.css
```

#### **File Serving Flow**
1. Request: `GET /s/abc123/index.html`
2. **Multi-layer routing** ensures request reaches Worker
3. Worker checks snapshot metadata in KV
4. Verifies user has access (session or viewer cookie)
5. Retrieves file from R2: `snap/abc123/index.html`
6. Returns file with appropriate Content-Type headers
7. Increments view count in metadata

### 🚀 **Extension Installation & Usage**

#### **Extension Build System**
Our extension uses **esbuild** to bundle all dependencies into a single file:

```bash
cd apps/extension

# Build bundled extension
npm run build          # Runs build-bundle.js (esbuild bundler)

# Package into VSIX
npm run package        # Runs build-manual.js (manual packaging)

# Complete release workflow
npm run release:full   # Bump version → Build → Package → Update Worker
```

**Version Management**: Every release automatically increments the version number:
- **Automatic Version Bumping**: `npm run release:full` automatically bumps from `0.0.29` → `0.0.30` → `0.0.31`
- **Versioned VSIX Files**: Each release creates `quickstage-{version}.vsix` (e.g., `quickstage-0.0.31.vsix`)
- **Cache Busting**: Both `quickstage.vsix` (generic) and `quickstage-{version}.vsix` (versioned) are served
- **Automatic Updates**: Users always get the latest version when downloading from the dashboard

#### **Why esbuild Bundling?**
- **Dependencies**: Bundles all npm packages into single file
- **No Missing Modules**: Eliminates "Cannot find module" errors
- **Performance**: Faster builds than webpack
- **Reliability**: Avoids vsce packaging issues

#### **VSIX Package Generation**
```bash
cd apps/extension
npm run build          # Compile TypeScript with esbuild bundler
npm run package        # Generate .vsix file using manual packaging
```

#### **Enhanced Extension Download System**
Users can download the QuickStage extension directly from the web dashboard with advanced location selection:

1. **Login to Dashboard**: Access the QuickStage web dashboard
2. **Choose Save Location**: Select from dropdown options:
   - **Downloads Folder**: Standard browser download location
   - **VS Code Extensions Folder**: Direct installation path for VS Code
   - **Cursor Extensions Folder**: Direct installation path for Cursor
   - **Custom Location**: User-defined path with file picker support
3. **Download Extension**: Click "Download Extension" button
4. **Automatic Instructions**: Installation instructions appear automatically after download
5. **Manual Instructions**: Click "View Instructions" button for detailed steps
6. **AI Instructions**: Click "AI Instructions" button for copy-pasteable AI assistant prompts
7. **Preference Persistence**: User's location choice is remembered across sessions

**Features:**
- **Consistent Naming**: All downloads use `quickstage.vsix` filename
- **Version Tracking**: Automatically detects when updates are available
- **Update Notifications**: Clear visual indicators for update status
- **Cross-Platform Paths**: Smart suggestions for Windows, macOS, and Linux
- **Modern File API**: Uses File System Access API when available for custom locations
- **Fallback Support**: Gracefully falls back to traditional download for older browsers
- **Smart Defaults**: Automatically detects and suggests common extension paths
- **Preference Persistence**: User's location choice and version info remembered across sessions
- **AI Integration**: Ready-to-use prompts for AI-assisted prototyping

#### **Extension Installation**
1. Download `quickstage.vsix` from the dashboard
2. In VS Code/Cursor: Extensions → Install from VSIX
3. Extension appears in Extensions panel
4. Command "QuickStage: Stage" available in Command Palette

#### **Enhanced Project Detection**
The extension now automatically detects and handles various project structures:

**Monorepo Detection:**
- Automatically finds web apps in `apps/*/dist`, `packages/*/dist` patterns
- Handles multiple build outputs intelligently
- Lets users choose when multiple options exist

**Static Site Detection:**
- Identifies projects with `index.html` in root directory
- Checks for CSS/JS assets to confirm complete sites
- No build process required for static projects

**Framework Auto-Detection:**
- Vite: Looks for `dist/` with `index.html`
- Next.js: Checks for `out/` or `build/` with static export
- SvelteKit: Finds `.svelte-kit/output/prerendered/`
- CRA: Looks for `build/` directory
- Custom builds: Allows user-defined output locations

**Smart Fallbacks:**
- Provides clear error messages when auto-detection fails
- Shows project structure summary for debugging
- Offers manual folder selection as backup
- Formats errors for easy copy-paste to AI assistants

#### **Extension Configuration**
Extension reads these settings from `package.json`:
- `outputDir` - Custom build output directory
- `ignore` - Files to exclude from staging
- `maxFileSizeMB` - Maximum file size limit
- `expiryDays` - Default snapshot expiry
- `passwordMode` - Password generation behavior
- `spaFallback` - Single-page app routing support

### 🌍 **Web Dashboard Features**

#### **Authentication Methods**
1. **Email/Password**: Traditional registration/login
2. **Google OAuth**: One-click sign-in
3. **Passkeys**: WebAuthn-based authentication

#### **Snapshot Management**
- View all snapshots with creation dates and expiry
- Extend snapshot lifetime by 7 days
- Manually expire snapshots
- Rotate passwords for security
- Copy shareable URLs

#### **Real-time Comments**
- Inline comment sidebar for each snapshot
- Turnstile anti-spam protection
- Anonymous posting with optional handles
- Persistent storage in Durable Objects

#### **AI Assistant Integration**
- **Copy-Paste Instructions**: Ready-to-use prompts for AI assistants
- **Comprehensive Templates**: Covers project goals, features, and technical requirements
- **QuickStage Context**: Ensures AI understands deployment and sharing requirements
- **One-Click Copy**: Copy complete instruction template to clipboard
- **Pro Tips**: Guidance for effective AI collaboration
- **Non-Technical Focus**: Designed for product managers and designers

### 🔧 **Development & Deployment**

#### **Local Development Setup**
```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev              # Starts web app + worker locally

# Build for production
pnpm build            # Builds web app
cd apps/worker && pnpm build  # Builds worker
```

#### **Environment Variables Required**

##### **Web App** (`.env` file)
```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_API_BASE_URL=http://localhost:8787/api  # Local dev
```

##### **Worker** (Cloudflare environment)
```bash
SESSION_HMAC_SECRET=your-session-secret
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
STRIPE_SECRET_KEY=your-stripe-key
TURNSTILE_SECRET_KEY=your-turnstile-key
```

#### **Deployment Commands**

##### **Quick Fix Deployment (Recommended)**
Use the automated deployment script for routing fixes:

```bash
# Run the automated deployment script
./deploy-fix.sh
```

This script automatically:
1. Builds the web app with all routing fixes
2. Deploys the worker first
3. Deploys the web app to Cloudflare Pages

##### **Manual Deployment**
```bash
# Deploy Worker
cd infra
npx wrangler deploy

# Deploy Web App
cd apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy dist --project-name=quickstage
```

### 🔄 **Data Flow Diagrams**

#### **Extension → Worker Flow**
```
Extension → POST /snapshots/create → Worker → KV Storage
Extension → POST /upload-url → Worker → R2 Presigned URL
Extension → R2 Direct Upload → Cloudflare R2
Extension → POST /snapshots/finalize → Worker → KV Update
```

#### **Web Dashboard → Worker Flow**
```
Dashboard → POST /api/auth/google → Worker → Google OAuth
Dashboard → GET /api/me → Worker → KV User Data
Dashboard → GET /api/snapshots/list → Worker → KV Snapshots
Dashboard → POST /api/snapshots/:id/expire → Worker → KV Update
```

#### **Snapshot Serving Flow (Current)**
```
Browser → GET https://quickstage-worker.nbramia.workers.dev/s/abc123 → Worker → KV Check → R2 Fetch → Response
```

### 🚨 **Troubleshooting Common Issues**

#### **401 Unauthorized Errors**
- Check session cookie is valid
- Verify user is logged in
- Check session hasn't expired

#### **404 Not Found Errors**
- Verify API endpoint exists in Worker
- Check route configuration in Cloudflare
- Ensure `/api` prefix is used for web dashboard calls

#### **Extension Build Failures**
- Ensure Node.js 18+ with corepack enabled
- Check TypeScript compilation errors
- Verify all dependencies are installed
- Run `npm run build` to bundle with esbuild

#### **Extension Not Working After Installation**
- Verify VSIX was properly bundled with esbuild
- Check that all dependencies are included in single file
- Ensure activation events are set to `onStartupFinished`
- Reload VS Code/Cursor window

#### **File Upload Failures**
- Check R2 credentials are correct
- Verify file size limits
- Check MIME type restrictions

#### **/s/* Routing Issues (Resolved)**
The `/s/*` routing issue has been resolved by using a direct Worker approach:

**Symptoms**: Users see the QuickStage dashboard instead of staged snapshots
**Root Cause**: Cloudflare Pages routing complexity and configuration issues
**Solution**: Extension generates URLs directly to the Worker, bypassing Pages routing entirely

**Current Status**:
1. ✅ **Extension generates working URLs**: `https://quickstage-worker.nbramia.workers.dev/s/abc123`
2. ✅ **Comments system working**: No more 404 errors
3. ✅ **Password protection working**: Secure access control
4. ✅ **Asset loading working**: CSS/JS files load correctly

**Benefits of Current Approach**:
- **100% reliability**: No routing failures
- **Simpler architecture**: Direct Worker access
- **Faster response**: No proxy layers
- **Easier debugging**: Clear request flow

### 📊 **Performance & Scaling**

#### **KV Storage Limits**
- User data: 25MB per user
- Snapshot metadata: 25MB per snapshot
- Automatic cleanup of expired snapshots

#### **R2 Storage**
- Unlimited file storage
- Global CDN distribution
- Automatic compression and optimization

#### **Worker Performance**
- Cold start: ~23ms
- Request processing: <100ms
- Concurrent request handling: 1000+

### 🔮 **Future Enhancements**

#### **Planned Features**
- Team collaboration and sharing
- Custom domains for snapshots
- Advanced analytics and insights
- Webhook notifications
- API rate limiting and quotas

#### **Architecture Improvements**
- Edge caching optimization
- Database migration from KV to D1
- Real-time collaboration features
- Advanced security features

## Recent Updates

### Dashboard Functionality & Configuration Improvements (2025-08-24)
- **Centralized Configuration**: Created `apps/web/src/config.ts` to centralize all URLs and configuration values
- **Configurable Worker URLs**: Worker base URL is now configurable in one place for easy future clean URL implementation
- **Dynamic Version Display**: Dashboard now shows actual extension version instead of hardcoded "0.0.1"
- **Fixed Dashboard Buttons**: Extend, Expire, and New Password buttons now work properly with proper `/api` prefixed endpoints
- **Password Display Fix**: Dashboard now shows actual snapshot passwords for easy sharing (stored in plain text for casual sharing)
- **Improved Sorting**: Snapshots are now sorted newest to oldest by default
- **Route Conflict Resolution**: Fixed duplicate routes and routing precedence issues in Worker
- **View URL Fix**: Dashboard View button now correctly links to Worker URLs instead of broken Pages routes
- **Enhanced Filtering**: Added All/Active toggle filter to show all snapshots or only active ones
- **Expired Snapshot Handling**: Expired snapshots now show "Expired" status and "Renew" button instead of "Extend"
- **Visual Confirmations**: Added success/error message notifications for all dashboard actions
- **Auto-clipboard Integration**: New passwords are automatically copied to clipboard when generated
- **Consistent Password Generation**: Password rotation uses the same 20-character generation logic as original passwords
- **Fixed Expired Snapshot Visibility**: Expired snapshots now remain visible when "All" filter is selected (fixed cron job cleanup)
- **Improved Password Storage**: All snapshot creation endpoints now consistently store plain text passwords for display
- **Cleaner Password Display**: Changed "Password protected (original not stored)" to just "Password protected" for better UX
- **Fixed View Counter**: Implemented unique viewer tracking that counts distinct visitors instead of raw page loads

### Universal Commenting System & System Stabilization (2025-08-21)
- **Added Universal Comments Overlay**: Every staged prototype now includes a commenting system
- **Top-Right Comments Button**: Blue "💬 Comments" button appears on all staged prototypes (after password entry)
- **Sliding Side Panel**: 400px wide panel slides in from the right with comment form and list
- **Real-Time Comments**: Comments are stored in Durable Objects and shared across all visitors
- **Anonymous Commenting**: Users can add their name or remain anonymous
- **Universal Compatibility**: Works on any HTML prototype regardless of framework or structure
- **System Stabilization**: Resolved routing issues by using direct Worker URLs for 100% reliability
- **Comments 404 Fix**: Resolved critical issue where comment posting was failing

### Asset Path & Routing Fixes (2025-08-21)
- **Fixed Asset Path Issues**: Resolved critical problem where CSS/JS files weren't loading
- **Hono Wildcard Parameter Fix**: Fixed issue with `c.req.param('*')` returning empty strings
- **Manual Path Extraction**: Added fallback URL parsing when Hono wildcard fails
- **Asset Path Replacement**: HTML content is modified to use correct snapshot-scoped asset paths
- **Multi-Layer Routing**: Implemented `_redirects`, `_routes.json`, and `_worker.js` for reliable routing
- **Automated Deployment**: Created `deploy-fix.sh` script for easy deployment of routing fixes
- **Comprehensive Testing**: Added test-routing.html for debugging routing issues
- **Enhanced Build Process**: Updated build scripts to include all routing configuration files

### Enhanced Project Detection & AI Instructions (2025-08-13)
- **Universal Project Detection**: Extension now automatically detects monorepos, static sites, and unusual project structures
- **Monorepo Support**: Automatically finds web apps in `apps/*/dist`, `packages/*/dist` patterns
- **Static Site Detection**: Identifies and stages projects with `index.html` without requiring build process
- **Smart Fallbacks**: Provides intelligent suggestions when auto-detection fails
- **AI Assistant Integration**: New dashboard modal with copy-pasteable instructions for AI-assisted prototyping
- **One-Click Copy**: Copy comprehensive AI prompt template to clipboard for perfect AI collaboration
- **Non-Technical User Focus**: Designed for product managers using AI to create prototypes

### Extension Build System Overhaul (2025-01-27)
- **esbuild Bundling**: Replaced TypeScript compilation with esbuild bundler that includes all dependencies
- **Manual VSIX Packaging**: Created custom packaging script to avoid vsce dependency issues
- **Single File Output**: Extension now bundles into single `extension.js` file with all dependencies included
- **No More Missing Modules**: Eliminated "Cannot find module" errors by bundling all npm packages
- **Build Commands**: Added `npm run build`, `npm run package`, and `npm run release:full` commands
- **Deployment Workflow**: Streamlined deployment process with automated version management

### Enhanced Extension Download System (2025-01-27)
- **Location Selection**: Added dropdown for choosing save location (Downloads, VS Code, Cursor, Custom)
- **Consistent Naming**: All downloads now use `quickstage.vsix` filename instead of versioned names
- **Version Tracking**: Automatic detection of available updates with visual notifications
- **Cross-Platform Support**: Smart path suggestions for Windows, macOS, and Linux
- **Update Notifications**: Clear indicators for "Update Available", "Up to Date", and "First Time Install"
- **Modern File API**: Integrated File System Access API for custom save locations
- **Preference Persistence**: User's location choice and version info remembered across sessions
- **Smart Fallbacks**: Graceful degradation for browsers without modern file API support

### Complete API Routing Fix (2025-01-27)
- **Fixed Extension API Endpoints**: Added missing `/api/snapshots/create`, `/api/upload-url`, `/api/snapshots/finalize`, and `/api/s/:id/*` endpoints
- **Resolved Routing Issues**: All `/api/*` requests now properly reach the Worker
- **Extension Compatibility**: VS Code/Cursor extension now works end-to-end
- **Ready for VSIX Generation**: All critical issues resolved

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

- **One-Click Staging**: VS Code extension with single "Stage" command
- **Universal Project Detection**: Automatically detects monorepos, static sites, and unusual project structures
- **AI Assistant Integration**: Copy-pasteable instructions for AI-assisted prototyping
- **Secure Sharing**: Per-snapshot auto-generated passwords, editable, private by default
- **Universal Commenting System**: Every staged prototype includes a commenting overlay with real-time collaboration
- **Real-time Comments**: Inline sidebar with Turnstile anti-spam protection
- **Cloudflare Stack**: Pages, Workers, R2, KV, Durable Objects, Turnstile
- **Billing Integration**: Stripe Checkout for Pro tier upgrades
- **Web Dashboard**: Complete web interface for managing snapshots and settings
- **Multi-Provider Authentication**: Email/password, Google OAuth, and passkey support
- **Multi-Layer Routing**: Reliable /s/* routing with fallback strategies

## Architecture

### Monorepo Structure
```
/quickstage
├── apps/
│   ├── extension/     # VS Code extension (esbuild bundled)
│   ├── web/          # Dashboard & viewer (React + Vite)
│   └── worker/       # Cloudflare Worker API
├── packages/
│   └── shared/       # Common types & utilities
└── infra/            # Deployment configs
```

### Cloudflare Services
- **Workers**: Backend API (Hono), authentication, snapshot lifecycle
- **Pages**: Frontend hosting for dashboard and viewer (with multi-layer routing)
- **R2**: Object storage for snapshot assets
- **KV**: User data, snapshot metadata, license records
- **Durable Objects**: Real-time comments per snapshot
- **Turnstile**: Anti-spam protection for comments

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
cd apps/extension
npm run build          # Bundle with esbuild
npm run package        # Create VSIX file
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

## Deployment

### Critical Deployment Order
**For routing fixes and general updates:**
1. **Run Automated Script**: `./deploy-fix.sh` (recommended)
2. **Or Manual Deployment**: Worker first, then web app

**For extension updates only:**
1. **Web App Only** - Extension is served directly from web app's public directory

**For worker changes (API updates, etc.):**
1. **Worker First** - Contains API logic and business rules
2. **Web App Second** - Serves the dashboard and extension

**Why this matters:**
- Extension downloads now come directly from web app (`/quickstage.vsix`)
- Worker only handles API endpoints, not file serving
- Extension updates only require web app deployment
- Routing fixes require both worker and web app deployment

### Complete Deployment Process

#### **Automated Deployment (Recommended)**
```bash
# Use the automated script for routing fixes
./deploy-fix.sh
```

#### **Manual Deployment**
```bash
# For routing fixes and general updates:
cd apps/extension && npm run release:full    # Creates VSIX and copies to web app public directory
cd ../../infra && npx wrangler deploy        # Deploy worker with new version
cd ../apps/web && pnpm build                 # Builds web app with new extension
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage

# For worker changes:
cd infra && npx wrangler deploy              # Deploy worker changes
cd ../apps/web && pnpm build                 # Build web app if needed
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### Extension Build Commands
```bash
cd apps/extension

# Build bundled extension
npm run build          # Runs build-bundle.js (esbuild bundler)

# Package into VSIX
npm run package        # Runs build-manual.js (manual packaging)

# Complete release workflow
npm run release:full   # Bump version → Build → Package → Update Worker
```

### **Configuration File Structure**
The main configuration file `apps/web/src/config.ts` contains:

```typescript
export const config = {
  // Worker API base URL - change this when you get clean URLs working
  WORKER_BASE_URL: 'https://quickstage-worker.nbramia.workers.dev',
  
  // Web app base URL
  WEB_BASE_URL: 'https://quickstage.tech',
  
  // API endpoints
  API_BASE_URL: '/api',
  
  // Snapshot viewer URL template
  getSnapshotUrl: (snapshotId: string) => `${config.WORKER_BASE_URL}/s/${snapshotId}`,
  
  // Extension download URL
  EXTENSION_DOWNLOAD_URL: '/quickstage.vsix',
  
  // Version info endpoint
  VERSION_INFO_URL: '/api/extensions/version'
};
```

**To implement clean URLs in the future:**
1. Update `WORKER_BASE_URL` in `config.ts`
2. All components automatically use the new URLs
3. No need to search and replace throughout the codebase

For detailed deployment instructions, see [VERSION_MANAGEMENT.md](apps/extension/VERSION_MANAGEMENT.md).

### Routing Configuration
### **Configuration System**
The system now uses a centralized configuration approach for easy maintenance and future improvements:

1. **Centralized URLs**: All URLs are defined in `apps/web/src/config.ts`
2. **Easy Clean URL Migration**: When you implement clean URLs, change only one value in the config
3. **Consistent Configuration**: All components use the same configuration source
4. **Future-Proof**: Easy to switch between Worker URLs and clean URLs

### **Current Routing Strategy**
The system currently uses a **direct Worker approach** for maximum reliability:

1. **Extension generates URLs**: Directly to `https://quickstage-worker.nbramia.workers.dev/s/abc123`
2. **No Pages routing**: Bypasses Cloudflare Pages routing complexity
3. **Direct Worker access**: Ensures 100% reliability for snapshot serving
4. **Simplified architecture**: Fewer moving parts, easier to maintain

**Future Clean URL Implementation**: When you're ready to implement clean URLs, simply update the `WORKER_BASE_URL` in `apps/web/src/config.ts` and all components will automatically use the new URLs.

This approach prioritizes functionality over URL aesthetics, ensuring staged prototypes always work reliably.

For detailed deployment instructions, see [VERSION_MANAGEMENT.md](apps/extension/VERSION_MANAGEMENT.md).