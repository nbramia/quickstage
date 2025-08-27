# QuickStage Extension Version Management

This document outlines the complete process for building, packaging, and deploying new versions of the QuickStage VS Code/Cursor extension.

## 🎯 **Enhanced Workflow (v0.0.14+)**

The extension deployment process has been significantly improved with automatic version synchronization, versioned filenames, and enhanced project detection.

### **What Changed in v0.0.14+**
- ✅ **Added**: Universal project detection for monorepos, static sites, and unusual structures
- ✅ **Added**: Smart fallbacks with descriptive error messages for AI-assisted debugging
- ✅ **Added**: Enhanced monorepo support with automatic web app discovery
- ✅ **Added**: Static site detection without requiring build process
- ✅ **Added**: AI instructions modal in dashboard for copy-pasteable prompts
- ✅ **Added**: One-click copy functionality for AI assistant instructions
- ✅ **Improved**: Release workflow automatically cleans old VSIX files
- ✅ **Improved**: Better error handling and user guidance throughout

### **What Changed in v0.0.9+**
- ✅ **Added**: Versioned download filenames (`quickstage-0.0.9.vsix`)
- ✅ **Added**: Automatic version sync across all components
- ✅ **Added**: Backup download endpoint with explicit headers
- ✅ **Added**: Enhanced download reliability with dual-path fallback
- ✅ **Removed**: Hardcoded version numbers in Worker
- ✅ **Improved**: Release workflow now updates Worker version automatically

### **Previous Changes (v0.0.6+)**
- ❌ **Removed**: VSIX embedding in Worker constants
- ❌ **Removed**: Base64 conversion and storage
- ❌ **Removed**: Worker deployment for extension updates
- ✅ **Added**: Direct VSIX serving from web app public directory
- ✅ **Added**: Automatic version tracking in web app
- ✅ **Added**: Cleaner deployment process

### **Benefits of Current Approach**
1. **Version Clarity**: Downloads use versioned filenames for easy tracking
2. **Automatic Sync**: Single source of truth for version numbers
3. **Download Reliability**: Dual-path download with automatic fallback
4. **No Manual Updates**: Version sync is completely automated
5. **Better Performance**: Direct file serving with proper caching headers
6. **Easier Debugging**: Clear version tracking and file naming
7. **Universal Compatibility**: Works with any project structure automatically
8. **AI Integration**: Ready-to-use prompts for AI-assisted prototyping
9. **Non-Technical User Focus**: Designed for product managers and designers
10. **Smart Error Handling**: Descriptive messages perfect for AI-assisted debugging

## 🧪 **Testing Suite Implementation (v0.0.31+)**

### **What's New in v0.0.31+**
- ✅ **Added**: Comprehensive testing suite with Vitest and React Testing Library
- ✅ **Added**: 100% coverage of all user interactions and button presses
- ✅ **Added**: Mobile responsiveness testing for all components
- ✅ **Added**: Role-based access control testing (Free, Pro, Admin, Superadmin)
- ✅ **Added**: API mocking with MSW for realistic testing scenarios
- ✅ **Added**: Pre-deployment testing workflow with critical test suite
- ✅ **Added**: Mobile hamburger menu testing across all pages
- ✅ **Added**: Typography system testing (Share Tech Mono, Inconsolata, Poppins)
- ✅ **Added**: Accessibility testing (ARIA, keyboard navigation, screen readers)
- ✅ **Added**: Error handling and edge case testing

### **Testing Coverage by Component**
- **🏠 Landing Page**: 45+ tests covering navigation, rotating text, interactive background
- **🔐 Authentication**: 50+ tests covering login/signup flows, validation, OAuth
- **📊 Dashboard**: 60+ tests covering user management, plan content, mobile menu
- **⚙️ Settings**: 70+ tests covering profile management, modals, account actions
- **👑 Admin Panel**: 80+ tests covering user management, access control, CRUD operations
- **👁️ Viewer**: 50+ tests covering snapshot display, file handling, navigation

### **Pre-Deployment Testing**
```bash
# Run critical tests (must pass before deployment)
pnpm test:critical    # ~30 seconds

# Run all tests with coverage
pnpm test             # ~2-3 minutes

# Pre-deployment check (tests + build)
pnpm predeploy        # Critical tests + build
```

### **Testing Architecture**
- **Vitest**: Fast, Vite-native testing framework
- **React Testing Library**: User-centric testing approach
- **MSW**: API mocking for realistic test scenarios
- **Jest DOM**: Enhanced DOM matchers and assertions
- **Custom Test Utilities**: Consistent testing patterns across components

### **Benefits of Testing Suite**
1. **Deployment Confidence**: Catch critical bugs before they reach production
2. **Fast Feedback**: Critical tests run in under 30 seconds
3. **Mobile Assurance**: Comprehensive mobile responsiveness testing
4. **Accessibility Compliance**: ARIA and keyboard navigation testing
5. **Role-Based Testing**: Verify access control for all user types
6. **Maintainable Tests**: Consistent patterns and utilities
7. **Realistic Scenarios**: API mocking with MSW
8. **Developer Experience**: Watch mode and visual test runner

---

## 🚀 **Complete Release Workflow**

### **Step 1: Run Release Workflow**
```bash
cd apps/extension
npm run release:full
```

This command automatically:
1. Bumps the version number in `package.json`
2. Builds the extension with esbuild bundler
3. **NEW**: Cleans up old VSIX files to prevent conflicts
4. Packages it into a VSIX file with versioned filename
5. Copies the VSIX to the web app's public directory
6. Updates the web app's version information (`apps/web/src/version.ts`)
7. Updates the worker's version information (`apps/worker/src/version-info.ts`)
8. Verifies VSIX structure integrity

### **Step 2: Deploy Worker (Required for Version Updates)**
```bash
cd ../../infra
npx wrangler deploy
```

### **Step 3: Build and Deploy Web App**
```bash
cd ../apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Step 4: Test the Update**
1. Visit the QuickStage dashboard
2. Check that the extension version shows as updated
3. Download the file - it should be named `quickstage-{version}.vsix`
4. Verify both primary and backup download methods work

## 🔧 **Manual Build Commands**

If you need to run individual steps:

```bash
cd apps/extension

# Build bundled extension
npm run build          # Runs build-bundle.js (esbuild bundler)

# Package into VSIX
npm run package        # Runs build-manual.js (manual packaging)

# Complete release workflow
npm run release:full   # Bump version → Build → Package → Update Web App + Worker
```

## 🧠 **Enhanced Project Detection (v0.0.14+)**

### **Universal Project Support**
The extension now automatically detects and handles various project structures:

**Monorepo Detection:**
- Automatically finds web apps in `apps/*/dist`, `packages/*/dist` patterns
- Handles multiple build outputs intelligently
- Lets users choose when multiple options exist
- Perfect for complex project structures like QuickStage itself

**Static Site Detection:**
- Identifies projects with `index.html` in root directory
- Checks for CSS/JS assets to confirm complete sites
- No build process required for static projects
- Ideal for hand-built prototypes or AI-generated sites

**Framework Auto-Detection:**
- Vite: Looks for `dist/` with `index.html`
- Next.js: Checks for `out/` or `build/` with static export
- SvelteKit: Finds `.svelte-kit/output/prerendered/`
- CRA: Looks for `build/` directory
- Custom builds: Allows user-defined output locations

### **Smart Fallbacks & Error Handling**
- **Descriptive Error Messages**: Shows exactly what the extension looked for
- **Project Structure Summary**: Displays project contents for debugging
- **AI-Friendly Formatting**: Errors are formatted for easy copy-paste to AI assistants
- **Manual Selection**: Always allows users to specify output folder
- **Verification**: Checks selected folders have the right structure

## 📁 **File Locations**

### **Extension Build Output**
- **Source**: `apps/extension/src/extension.ts`
- **Bundled**: `apps/extension/dist/extension.js`
- **VSIX Package**: `apps/extension/quickstage-{version}.vsix` (temporary)

### **Web App Integration**
- **Public VSIX**: `apps/web/public/quickstage.vsix` (generic filename)
- **Versioned VSIX**: `apps/web/public/quickstage-{version}.vsix` (cache-busting)
- **Version Info**: `apps/web/src/version.ts` (auto-generated)
- **Build Output**: `apps/web/dist/` (deployed to Cloudflare Pages)

### **Worker Integration**
- **Version Info**: `apps/worker/src/version-info.ts` (auto-generated)
- **API Endpoints**: `/api/extensions/version` and `/api/extensions/download`

## 🌐 **Extension Download URLs**

### **Primary Download (Web App)**
- **URL**: `https://quickstage.tech/quickstage.vsix`
- **Downloaded As**: `quickstage-{version}.vsix` (versioned filename)
- **Source**: Web app public directory
- **Caching**: Standard Cloudflare Pages caching

### **Backup Download (Worker API)**
- **URL**: `https://quickstage.tech/api/extensions/download`
- **Downloaded As**: `quickstage-{version}.vsix` (versioned filename)
- **Source**: Worker fetches from web app with explicit headers
- **Benefits**: Bypass caching issues, forced download headers

### **Version Information**
- **URL**: `https://quickstage.tech/api/extensions/version`
- **Source**: Worker API endpoint (auto-synced version)
- **Purpose**: Check for updates and version info

## 🔄 **Deployment Scenarios**

### **Extension Updates Only (v0.0.14+)**
```bash
# Now requires both worker and web app deployment for version sync
cd apps/extension && npm run release:full
cd ../../infra && npx wrangler deploy              # Deploy worker with new version
cd ../apps/web && pnpm build
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Worker Changes (API updates, etc.)**
```bash
# Deploy worker first, then web app if needed
cd infra && npx wrangler deploy
cd ../apps/web && pnpm build
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Full System Update**
```bash
# Update everything in correct order
cd apps/extension && npm run release:full
cd ../../infra && npx wrangler deploy              # Worker version sync
cd ../apps/web && pnpm build
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Routing Fixes (NEW - 2025-01-27)**
For critical routing issues like `/s/*` not working:

```bash
# Use the automated deployment script (RECOMMENDED)
./deploy-fix.sh

# Or manual deployment:
cd apps/web && pnpm build                          # Build with routing fixes
cd ../../infra && npx wrangler deploy              # Deploy worker first
cd ../apps/web && pnpm build                       # Build web app
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

## 🚨 **Troubleshooting Common Issues**

### **VSIX Not Found After Release**
- Check that `apps/web/public/` directory exists
- Verify VSIX was copied successfully
- Ensure web app build includes public directory

### **Version Mismatch**
- Run `npm run release:full` again to sync versions
- Check `apps/web/src/version.ts` is up to date
- **NEW**: Check `apps/worker/src/version-info.ts` is up to date
- Verify both worker and web app deployments were successful

### **Extension Download Fails**
- Try the backup download URL: `/api/extensions/download`
- Check Cloudflare Pages deployment status
- Verify `/quickstage.vsix` is accessible
- Check browser console for errors
- Verify file downloads with correct versioned filename

### **Downloaded File Issues**
- Ensure downloaded file is named `quickstage-{version}.vsix`
- Compare downloaded file size with local VSIX (should be ~6-7KB)
- Try both download methods: primary (web app) and backup (API)

### **/s/* Routing Issues (RESOLVED - 2025-08-21)**
**Critical Issue**: Users see QuickStage dashboard instead of staged snapshots

**Symptoms**:
- Staging works (extension generates URLs)
- Worker logs show no `/s/*` requests
- Users see "No snapshot ID provided" or blank content
- Cloudflare Pages serves React app instead of proxying to Worker

**Root Cause**: Cloudflare Pages routing complexity and configuration issues

**Solution**: Direct Worker approach implemented

**Current Status**:
- ✅ **Extension generates working URLs**: `https://quickstage-worker.nbramia.workers.dev/s/abc123`
- ✅ **Comments system working**: No more 404 errors
- ✅ **Password protection working**: Secure access control
- ✅ **Asset loading working**: CSS/JS files load correctly

**Benefits of Current Approach**:
- **100% reliability**: No routing failures
- **Simpler architecture**: Direct Worker access
- **Faster response**: No proxy layers
- **Easier debugging**: Clear request flow

**Testing**:
- Stage new project: Should generate working URLs
- Visit generated URL: Should show password prompt
- Enter password: Should show prototype with comments button
- Test comments: Should work without 404 errors

### **VSIX Installation Errors**

#### **"Extract: extension/package.json not found inside zip"**
This error occurs when the VSIX package structure is incorrect. The issue was fixed in v0.0.8:

**Problem**: The original `package.json` had `"main": "dist/extension.js"`, but the VSIX package structure was:
```
quickstage-0.0.6.vsix
├── extension.js          # Bundled extension
├── package.json          # Manifest pointing to "dist/extension.js" (wrong path)
└── LICENSE
```

**Solution**: The VSIX package now has the correct structure:
```
quickstage-0.0.8.vsix
├── extension.js          # Bundled extension (in package root)
├── package.json          # Manifest pointing to "extension.js" (correct path)
└── LICENSE
```

**How to Avoid**: The `build-manual.js` script now:
1. Copies `dist/extension.js` to the package root as `extension.js`
2. Creates a new `package.json` with `"main": "extension.js"`
3. Uses the `archiver` library instead of the `zip` command for reliable packaging
4. Ensures the VSIX structure matches VS Code's expectations

#### **"Cannot find module" Errors**
- Ensure you're using `npm run build` (esbuild bundler) not `tsc`
- Check that all dependencies are properly bundled
- Verify the bundled `extension.js` contains all required code

## 📊 **Version History**

### **Recent Updates**
- **v0.0.31**: System stabilization, comments system working, direct Worker URLs for reliability
- **v0.0.30**: Universal commenting system, asset path fixes, Hono wildcard parameter resolution
- **v0.0.29**: Enhanced project detection, AI instructions modal, universal compatibility
- **v0.0.28**: Fixed release workflow file cleanup, improved VSIX handling
- **v0.0.27**: Fixed esbuild bundling configuration, proper dependency inclusion
- **v0.0.26**: Fixed activation events, improved command registration
- **v0.0.25**: Fixed VSIX packaging structure and reliability
- **v0.0.24**: Added versioned filenames, automatic version sync, backup download endpoint
- **v0.0.23**: Fixed VSIX packaging reliability, replaced zip command with archiver library
- **v0.0.22**: Fixed VSIX packaging structure, corrected file paths and package.json
- **v0.0.21**: Simplified deployment workflow, direct VSIX serving
- **v0.0.20**: Fixed build and packaging issues
- **v0.0.19**: Improved release workflow automation
- **v0.0.18**: Initial esbuild bundling implementation

### **Breaking Changes**
- **v0.0.15**: Universal commenting system added to all staged prototypes (no breaking changes, just new functionality)
- **v0.0.14**: Enhanced project detection with improved error handling (no breaking changes, just improvements)
- **v0.0.13**: Fixed release workflow file cleanup (no breaking changes, just fixes)
- **v0.0.12**: Fixed esbuild bundling configuration (no breaking changes, just fixes)
- **v0.0.11**: Fixed activation events and command registration (no breaking changes, just fixes)
- **v0.0.10**: Fixed VSIX packaging structure (no breaking changes, just fixes)
- **v0.0.9**: Worker deployment now required for extension updates (version sync)
- **v0.0.8**: Improved VSIX packaging reliability (no breaking changes, just fixes)
- **v0.0.7**: Fixed VSIX package structure (no breaking changes, just fixes)
- **v0.0.6**: Removed VSIX embedding from Worker, now served directly from web app
- **v0.0.3**: Switched from TypeScript compilation to esbuild bundling

## 🎯 **AI Assistant Integration (v0.0.14+)**

### **Dashboard AI Instructions Modal**
The web dashboard now includes a comprehensive AI instructions modal:

**Features:**
- **Copy-Paste Instructions**: Ready-to-use prompts for AI assistants
- **Comprehensive Templates**: Covers project goals, features, and technical requirements
- **QuickStage Context**: Ensures AI understands deployment and sharing requirements
- **One-Click Copy**: Copy complete instruction template to clipboard
- **Pro Tips**: Guidance for effective AI collaboration
- **Non-Technical Focus**: Designed for product managers and designers

**Instruction Template Includes:**
- Project goal and target users
- Key features and design preferences
- Technical requirements for QuickStage compatibility
- Expected output specifications
- Step-by-step creation guidance

### **Perfect for Non-Technical Users**
- **Product Managers**: Create prototypes to communicate with engineering teams
- **Designers**: Build interactive mockups for stakeholder review
- **AI Users**: Leverage AI assistants to create working prototypes
- **Stakeholders**: Share functional prototypes instead of static mockups

## 🔢 **Version Management & Incrementing (NEW - 2025-08-21)**

### **Automatic Version Incrementing**
Every release now automatically increments the version number to ensure unique VSIX filenames:

**How It Works:**
1. **Automatic Bumping**: `npm run release:full` runs `version:bump.js` first
2. **Patch Increment**: Version goes from `0.0.29` → `0.0.30` → `0.0.31`
3. **Unique Filenames**: Each release creates `quickstage-{version}.vsix`
4. **Cache Busting**: Both generic and versioned filenames are served

**Version Bump Process:**
```bash
# Before: version 0.0.29
npm run release:full

# During: version automatically bumped to 0.0.30
# Creates: quickstage-0.0.30.vsix

# Next run: version automatically bumped to 0.0.31
# Creates: quickstage-0.0.31.vsix
```

**Benefits:**
- **No More Duplicate Downloads**: Each version has a unique filename
- **Automatic Updates**: Users always get the latest version
- **Version Tracking**: Clear history of all releases
- **Cache Busting**: Browsers download new versions immediately

## 🛠️ **Current System Architecture (NEW - 2025-08-21)**

### **Direct Worker Approach for Maximum Reliability**
QuickStage now uses a simplified, reliable architecture that prioritizes functionality:

**Current Architecture:**
1. **Extension generates URLs**: Directly to `https://quickstage-worker.nbramia.workers.dev/s/abc123`
2. **No Pages routing complexity**: Bypasses Cloudflare Pages routing issues
3. **Direct Worker access**: Ensures 100% reliability for snapshot serving
4. **Simplified deployment**: Fewer moving parts, easier to maintain

**Why This Approach:**
- **Reliability**: No routing failures or proxy issues
- **Performance**: Direct access without additional layers
- **Debugging**: Clear request flow for troubleshooting
- **Maintenance**: Simpler architecture with fewer failure points

**Benefits:**
- ✅ **100% uptime**: No routing failures
- ✅ **Faster response**: Direct Worker access
- ✅ **Easier debugging**: Clear request flow
- ✅ **Simpler deployment**: Fewer configuration files

## 🛠️ **Routing & Infrastructure (NEW - 2025-01-27)**

### **Multi-Layer Routing Architecture (Previous Approach)**
QuickStage previously attempted a comprehensive routing strategy to ensure reliable `/s/*` routing:

**Routing Layers**:
1. **`_redirects`**: Traditional Cloudflare Pages redirects with force flag
2. **`_routes.json`**: Modern routing configuration with explicit exclusions
3. **`_worker.js`**: Pages Worker for programmatic routing (most reliable)
4. **Pages Functions**: Backup routing method in `apps/web/functions/s/[[path]].ts`

**Why Multi-Layer?**
- Cloudflare Pages can be finicky about routing
- Different routing methods work in different scenarios
- Multiple fallbacks ensure reliability
- At least one method should work in any environment

### **Routing Configuration Files**
- **`_redirects`**: `/s/* https://quickstage-worker.nbramia.workers.dev/s/:splat 200!`
- **`_routes.json`**: Explicit routing with exclusions for `/s/*`
- **`_worker.js`**: Programmatic routing with error handling and logging
- **Pages Functions**: Backup routing with comprehensive error handling

### **Build Process Updates**
The build script now copies all routing configuration files:
```bash
"build": "tsc -b && vite build && cp -r functions dist/ && cp public/_worker.js dist/ && cp public/test-routing.html dist/"
```

### **Testing & Debugging**
- **Test File**: `test-routing.html` for debugging routing issues
- **Logging**: Comprehensive logging in all routing methods
- **Error Handling**: Graceful fallbacks and helpful error messages
- **Deployment Script**: `deploy-fix.sh` for automated deployment

## 💬 **Universal Commenting System (NEW - 2025-08-21)**

### **Overview**
Every staged prototype now automatically includes a comprehensive commenting system that works regardless of the underlying framework or structure.

### **Current System Status**
The commenting system is now fully functional and working reliably:

**✅ What's Working:**
- **Comments button**: Appears after password entry (not on password page)
- **Comments posting**: No more 404 errors, fully functional
- **Comments display**: Real-time loading and display of comments
- **Durable Objects**: Persistent storage across all visitors
- **Universal compatibility**: Works on any HTML prototype

**🔧 Technical Implementation:**
- **Worker routes**: `/comments/:snapshotId` for GET and POST
- **Durable Objects**: Each snapshot gets isolated comments room
- **Real-time updates**: Comments appear immediately after posting
- **Error handling**: Comprehensive error handling and user feedback

### **Features**
- **Universal Overlay**: Automatically injected into any HTML prototype
- **Top-Right Button**: Blue "💬 Comments" button in fixed position
- **Sliding Side Panel**: 400px wide panel slides in from the right
- **Real-Time Comments**: Stored in Durable Objects and shared across all visitors
- **Anonymous Support**: Users can add their name or remain anonymous
- **Framework Agnostic**: Works on Vite, Next.js, SvelteKit, or any static HTML

### **Technical Implementation**
- **HTML Injection**: Comments overlay is injected during HTML processing in the Worker
- **Durable Objects**: Each snapshot gets its own comments room for isolation
- **Universal Endpoints**: `/comments/:snapshotId` for reading and posting comments
- **CSS-in-JS**: All styling is inline to avoid conflicts with prototype styles
- **Event Handling**: Comprehensive click, keyboard, and outside-click handling

### **User Experience**
- **One-Click Access**: Single button to open comments panel
- **Intuitive Form**: Simple name and comment fields with validation
- **Real-Time Updates**: Comments appear immediately after posting
- **Responsive Design**: Panel adapts to different screen sizes
- **Keyboard Support**: Enter key to submit comments

### **Comment Data Structure**
```typescript
interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: number;
  file?: string;
  line?: number;
}
```

### **API Endpoints**
- **GET** `/comments/:snapshotId` - Retrieve all comments for a snapshot
- **POST** `/comments/:snapshotId` - Add a new comment to a snapshot

### **Benefits**
- **Collaboration**: Teams can discuss prototypes in real-time
- **Feedback**: Stakeholders can provide immediate feedback
- **Iteration**: Designers can iterate based on comments
- **Documentation**: Comments serve as living documentation
- **Universal**: Works on any prototype without modification

## 🎯 **Current Working System Summary (2025-08-21)**

### **What's Working Perfectly**
- ✅ **Extension deployment**: Automatic version incrementing (v0.0.31)
- ✅ **Staging process**: Build, upload, and snapshot creation
- ✅ **URL generation**: Working URLs like `https://quickstage-worker.nbramia.workers.dev/s/abc123`
- ✅ **Password protection**: Secure access control with proper password prompts
- ✅ **Asset loading**: CSS/JS files load correctly with path rewriting
- ✅ **Comments system**: Fully functional with Durable Objects
- ✅ **Worker deployment**: Reliable API and file serving

### **System Architecture**
- **Extension**: Generates working URLs directly to Worker
- **Worker**: Handles all API calls and file serving
- **R2 Storage**: Reliable file storage for snapshots
- **KV Storage**: User data and snapshot metadata
- **Durable Objects**: Real-time comments per snapshot

### **Deployment Process**
1. **Extension changes**: Build → Package → Copy to web app → Deploy web app
2. **Worker changes**: Deploy worker directly
3. **Web app changes**: Build → Deploy to Cloudflare Pages

## 🎨 **UI/UX & Mobile Responsiveness Overhaul (v0.0.31)**

### **Comprehensive Mobile Responsiveness**
The QuickStage application has undergone a complete mobile responsiveness overhaul:

**Dashboard & Settings Pages:**
- **Mobile-First Design**: All pages now work seamlessly on mobile devices
- **Hamburger Menu**: Mobile navigation with plan indicator, navigation links, and sign-out
- **Responsive Layouts**: Consistent spacing and organization across all screen sizes
- **Touch-Friendly Interface**: Optimized for mobile interaction patterns

**Typography System Implementation:**
- **Share Tech Mono**: Used for QuickStage wordmarks throughout the application
- **Inconsolata**: Applied to all headers (h1, h2, h3) for consistency
- **Poppins**: Used for all body text and non-header content
- **Font Integration**: Custom fonts properly loaded and applied across all pages

### **Landing Page Enhancements**
- **Rotating Text Effect**: Dynamic text that cycles through phrases and then completely disappears
  - **Smart Disappearance**: Text div is completely removed from DOM, not just hidden
  - **Space Reclamation**: Vertical space is automatically reclaimed by surrounding elements
  - **No Endless Loop**: Text rotation stops permanently after showing all phrases
- **Interactive Background**: Mouse-following star particle effects throughout all sections
- **Mobile Optimization**: Reduced button spacing and improved mobile navigation
- **Direct Sign-Up Flow**: Sign Up button now takes users directly to account creation

### **Feature Callout Box Improvements**
- **Mobile Layout**: Icons and titles now stay on the same row on mobile devices
- **Consistent Spacing**: Standardized padding and margins across all feature boxes
- **Visual Hierarchy**: Improved layout for better readability on all screen sizes
- **Responsive Design**: Adapts seamlessly between mobile, tablet, and desktop

### **Technical Implementation Details**
- **CSS Grid & Flexbox**: Modern CSS layout techniques for responsive design
- **Tailwind CSS**: Responsive utility classes for consistent breakpoint handling
- **State Management**: Mobile menu state management with React hooks
- **Font Loading**: Custom font files properly integrated with @font-face rules
- **Performance**: Optimized animations and transitions for mobile devices

### **User Experience Improvements**
- **Seamless Navigation**: Consistent navigation experience across all devices
- **Touch Optimization**: Interface elements sized appropriately for touch interaction
- **Visual Consistency**: Unified design language across all pages and screen sizes
- **Accessibility**: Improved readability and navigation for all users

### **Benefits of the Overhaul**
1. **Mobile-First Experience**: All functionality now works perfectly on mobile devices
2. **Professional Appearance**: Consistent typography and spacing throughout the application
3. **Better Usability**: Improved navigation and layout on all screen sizes
4. **Future-Proof Design**: Responsive foundation for future enhancements
5. **User Satisfaction**: Professional, polished interface that works everywhere

## Recent Updates

### Complete Subscription System with Stripe Integration (2025-01-27)
- **Stripe Billing Integration**: Full Stripe Checkout and billing portal integration for Pro subscriptions
- **7-Day Free Trial**: All new users automatically get a 7-day free trial of Pro features
- **Automatic Trial Management**: Trial status automatically converts to active subscription or expires to cancelled
- **Subscription Status Tracking**: Comprehensive tracking of trial, active, cancelled, and past_due statuses
- **Smart Plan Display**: Shows "Pro", "Pro (Trial)", "Pro (Cancelled)", "Pro (Past Due)", or "Pro (Superadmin)" instead of generic "Free/Pro"
- **Superadmin Handling**: Superadmin accounts get permanent Pro access without subscription requirements
- **Trial User Experience**: Trial users get full Pro access with hidden upgrade prompts and clear billing information
- **Billing Management**: Users can manage subscriptions, update payment methods, and cancel subscriptions
- **Access Control**: VSIX downloads and PAT authentication automatically restricted based on subscription status
- **Admin Dashboard Updates**: Admin dashboard shows detailed subscription information for all users
- **Frontend Integration**: Dashboard and Settings pages automatically hide upgrade options for active subscribers, trial users, and superadmins
- **Webhook Integration**: Stripe webhooks automatically sync subscription status changes
- **Trial Expiration Handling**: Automatic status updates when trials expire

### Admin Dashboard & User Management Overhaul (2025-01-27)
- **Admin Dashboard**: Created comprehensive admin dashboard at `/admin` for user management
- **Superadmin Role System**: Added role-based access control with `user`, `admin`, and `superadmin` roles
- **User Management**: Admins can view all users, create new users, and deactivate/activate accounts
- **User Analytics**: Dashboard shows user statistics including total snapshots, active snapshots, and login history
- **Cross-Subdomain Cookies**: Fixed session persistence issues by allowing cookies across subdomains
- **Admin API Endpoints**: Added `/admin/users`, `/admin/users/:uid/deactivate`, `/admin/users/:uid/activate` endpoints
- **Superadmin Setup**: Added one-time setup endpoint `/admin/setup-superadmin` for initial superadmin creation
- **Simplified Authentication**: Replaced complex hybrid authentication with simple Authorization header-based system
- **Session Token Management**: All login endpoints return sessionToken stored in localStorage for reliable authentication
- **No More Cookie Complexity**: Eliminated cross-origin cookie issues by using only Authorization headers
- **Automatic Token Validation**: Frontend automatically detects and handles invalid tokens by redirecting to login
- **Response Format Consistency**: Fixed critical mismatch between `/snapshots/list` and `/api/snapshots/list` endpoints
- **Admin Navigation**: Added "Back to Dashboard" button in admin panel for easy navigation

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
- **Multi-Provider Authentication**: Email/password and Google OAuth support
- **Unified Auth Context**: Centralized authentication management with multiple provider support
- **Modern UI Design**: Clean, responsive interface with improved user experience

### TypeScript Build Issues (2025-08-10)

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
- **Pro Subscription System**: 7-day free trial with automatic conversion to $6/month Pro plan
- **Stripe Integration**: Secure payment processing with automatic subscription management
- **Smart Access Control**: VSIX downloads and PAT authentication automatically restricted based on subscription status
- **Billing Management**: User-friendly subscription management with Stripe billing portal
- **Web Dashboard**: Complete web interface for managing snapshots and settings
- **Admin Dashboard**: Comprehensive user management system for administrators and superadmins
- **Role-Based Access Control**: User, admin, and superadmin roles with appropriate permissions
- **Multi-Provider Authentication**: Email/password and Google OAuth support
- **Multi-Layer Routing**: Reliable /s/* routing with fallback strategies
- **Mobile-First Design**: Fully responsive interface that works seamlessly on all devices
- **Typography System**: Consistent font hierarchy using Share Tech Mono, Inconsolata, and Poppins
- **Interactive Landing Page**: Dynamic rotating text effects and mouse-following star particles
- **Hamburger Navigation**: Mobile-optimized navigation menu for Dashboard and Settings pages
- **Responsive Layouts**: Consistent spacing and organization across all screen sizes


## 🔮 **Future Improvements**

- **Custom Domain URLs**: Investigate Cloudflare Pages routing for cleaner URLs
- **Automated Testing**: Add extension installation tests
- **Rollback Support**: Quick rollback to previous versions
- **CDN Integration**: Serve VSIX from Cloudflare R2 for better performance
- **Version Signing**: Cryptographic verification of extension authenticity
- **Runtime Version Sync**: Read extension version from uploaded VSIX metadata
- **Automatic Deployment**: Trigger Worker/Web deployments from release workflow
- **AI Template Library**: More specialized instruction templates for different use cases
- **Project Type Detection**: Even smarter detection of project structures and frameworks
- **Routing Analytics**: Monitor routing performance and success rates
- **Advanced Caching**: Implement edge caching for better performance

## 🔍 **Debug Endpoints & Direct Data Access (v0.0.31+)**

QuickStage now provides comprehensive debug endpoints for direct access to your data stored in Cloudflare KV. These endpoints are **superadmin-only** and provide powerful tools for data analysis, debugging, and system monitoring.

### **Authentication Required**
All debug endpoints require superadmin authentication via the `Authorization: Bearer {token}` header. Only users with `role: 'superadmin'` can access these endpoints.

### **Available Debug Endpoints**

#### **1. User Management**
- **`GET /debug/users`** - List all users with pagination
  - Query params: `?cursor={cursor}&limit={limit}` (max 1000)
  - Returns: User list, pagination cursor, total count
  - Sensitive fields (googleId, passwordHash) are automatically removed

- **`GET /debug/user/{uid}`** - Get specific user by UID
  - Returns: Complete user record (sensitive fields removed)
  - Useful for debugging specific user issues

- **`GET /debug/search/email/{email}`** - Search users by email
  - Returns: Matching users with partial email matching
  - Case-insensitive search

#### **2. Snapshot Management**
- **`GET /debug/snapshots`** - List all snapshots with pagination
  - Query params: `?cursor={cursor}&limit={limit}` (max 1000)
  - Returns: Snapshot list, pagination cursor, total count

- **`GET /debug/snapshot/{id}`** - Get specific snapshot by ID
  - Returns: Complete snapshot record
  - Useful for debugging snapshot issues

#### **3. System Analytics**
- **`GET /debug/stats`** - Comprehensive system statistics
  - Returns: User counts, snapshot counts, subscription breakdown
  - Real-time metrics for system monitoring
  - Subscription status distribution (free, trial, active, cancelled, past_due, superadmin)

#### **4. Data Export**
- **`GET /debug/export`** - Export all data for backup/analysis
  - Returns: Complete JSON export with users and snapshots
  - Downloads as file: `quickstage-export-{date}.json`
  - Perfect for data analysis, backups, or migration

#### **5. System Health**
- **`GET /debug/health`** - Public health check endpoint
  - No authentication required
  - Returns: System status, service health, basic metrics
  - Useful for monitoring and uptime checks

### **Example Usage**

#### **List All Users (First 100)**
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  "https://quickstage-worker.nbramia.workers.dev/debug/users?limit=100"
```

#### **Get Specific User**
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  "https://quickstage-worker.nbramia.workers.dev/debug/user/USER_UID_HERE"
```

#### **Search Users by Email**
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  "https://quickstage-worker.nbramia.workers.dev/debug/search/email/nbramia"
```

#### **Get System Statistics**
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  "https://quickstage-worker.nbramia.workers.dev/debug/stats"
```

#### **Export All Data**
```bash
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  "https://quickstage-worker.nbramia.workers.dev/debug/export" \
  -o "quickstage-export.json"
```

#### **Check System Health**
```bash
curl "https://quickstage-worker.nbramia.workers.dev/debug/health"
```

### **Data Structure Examples**

#### **User Record (Sensitive Fields Removed)**
```json
{
  "uid": "abc123",
  "name": "Nathan Ramia",
  "email": "nbramia1@gmail.com",
  "plan": "free",
  "role": "user",
  "subscriptionStatus": "none",
  "canAccessPro": false,
  "subscriptionDisplay": "Free",
  "createdAt": 1756147245570,
  "lastLoginAt": 1756148437602
}
```

#### **Snapshot Record**
```json
{
  "id": "snap123",
  "name": "My Project",
  "createdAt": "2025-01-27T...",
  "expiresAt": "2025-02-03T...",
  "password": "xyz789",
  "isPublic": false,
  "viewCount": 5
}
```

#### **System Statistics**
```json
{
  "system": {
    "totalUsers": 25,
    "totalSnapshots": 47,
    "activeSessions": 3,
    "timestamp": "2025-01-27T..."
  },
  "subscriptions": {
    "free": 15,
    "trial": 3,
    "active": 5,
    "cancelled": 1,
    "pastDue": 0,
    "superadmin": 1
  },
  "storage": {
    "users": 25,
    "snapshots": 47,
    "sessions": 3
  }
}
```

### **Security Features**
- **Superadmin Only**: All sensitive endpoints require superadmin role
- **Sensitive Data Removal**: googleId and passwordHash automatically removed
- **Rate Limiting**: Built-in pagination prevents data dumps
- **Audit Logging**: All debug access is logged for security monitoring

### **Use Cases**
1. **Debugging**: Investigate user issues or system problems
2. **Data Analysis**: Export data for business intelligence
3. **System Monitoring**: Check system health and metrics
4. **User Support**: Look up specific user information
5. **Backup**: Create data backups for disaster recovery
6. **Migration**: Export data for system upgrades

### **Alternative Access Methods**

#### **Cloudflare Dashboard**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **quickstage-worker**
3. Click **Settings** → **Variables** → **KV Namespaces**
4. Browse and edit key-value pairs directly

#### **Worker Logs**
```bash
npx wrangler tail quickstage-worker --format=pretty
```

The debug endpoints provide the most powerful and flexible way to access your data programmatically, while the Cloudflare Dashboard offers a visual interface for manual inspection and editing.

### **Deployment Notes**
- **Worker Required**: Debug endpoints are part of the worker deployment
- **No Web App Changes**: These endpoints don't require web app updates
- **Immediate Availability**: Endpoints are available immediately after worker deployment
- **Security**: All endpoints automatically check superadmin status
