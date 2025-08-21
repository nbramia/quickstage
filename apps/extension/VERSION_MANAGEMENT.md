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

### **/s/* Routing Issues (NEW - 2025-01-27)**
**Critical Issue**: Users see QuickStage dashboard instead of staged snapshots

**Symptoms**:
- Staging works (extension generates URLs)
- Worker logs show no `/s/*` requests
- Users see "No snapshot ID provided" or blank content
- Cloudflare Pages serves React app instead of proxying to Worker

**Root Cause**: Cloudflare Pages wasn't routing `/s/*` requests to the Worker

**Solution**: Multi-layer routing configuration implemented

**Files Added**:
- `apps/web/public/_redirects` - Traditional redirects
- `apps/web/public/_routes.json` - Modern routing config
- `apps/web/public/_worker.js` - Pages Worker for routing
- `apps/web/functions/s/[[path]].ts` - Backup routing method

**To Fix**:
1. Run `./deploy-fix.sh` (automated deployment)
2. Or manually deploy worker first, then web app
3. Test routing with `/test-routing.html`
4. Check Cloudflare Pages logs for errors

**Testing**:
- Normal routes: `/test-routing.html` (should work)
- Snapshot routes: `/s/[id]` (should now work)
- Stage new project: Should generate working URLs

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

**Note**: The small file size (6-7KB) is normal due to efficient compression. The important thing is that all required files are present and the structure is correct.

#### **"Cannot find module" Errors**
- Ensure you're using `npm run build` (esbuild bundler) not `tsc`
- Check that all dependencies are properly bundled
- Verify the bundled `extension.js` contains all required code

## 📊 **Version History**

### **Recent Updates**
- **v0.0.14**: Enhanced project detection, AI instructions modal, universal compatibility
- **v0.0.13**: Fixed release workflow file cleanup, improved VSIX handling
- **v0.0.12**: Fixed esbuild bundling configuration, proper dependency inclusion
- **v0.0.11**: Fixed activation events, improved command registration
- **v0.0.10**: Fixed VSIX packaging structure and reliability
- **v0.0.9**: Added versioned filenames, automatic version sync, backup download endpoint
- **v0.0.8**: Fixed VSIX packaging reliability, replaced zip command with archiver library
- **v0.0.7**: Fixed VSIX packaging structure, corrected file paths and package.json
- **v0.0.6**: Simplified deployment workflow, direct VSIX serving
- **v0.0.5**: Fixed build and packaging issues
- **v0.0.4**: Improved release workflow automation
- **v0.0.3**: Initial esbuild bundling implementation

### **Breaking Changes**
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

## 🛠️ **Routing & Infrastructure (NEW - 2025-01-27)**

### **Multi-Layer Routing Architecture**
QuickStage now uses a comprehensive routing strategy to ensure reliable `/s/*` routing:

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

## 🔮 **Future Improvements**

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
