# QuickStage Extension Version Management

This document outlines the complete process for building, packaging, and deploying new versions of the QuickStage VS Code/Cursor extension.

## 🎯 **Enhanced Workflow (v0.0.9+)**

The extension deployment process has been significantly improved with automatic version synchronization and versioned filenames.

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

## 🚀 **Complete Release Workflow**

### **Step 1: Run Release Workflow**
```bash
cd apps/extension
npm run release:full
```

This command automatically:
1. Bumps the version number in `package.json`
2. Builds the extension with esbuild bundler
3. Packages it into a VSIX file with versioned filename
4. Copies the VSIX to the web app's public directory
5. Updates the web app's version information (`apps/web/src/version.ts`)
6. **NEW**: Updates the worker's version information (`apps/worker/src/version-info.ts`)
7. Verifies VSIX structure integrity

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

### **Extension Updates Only (v0.0.9+)**
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

## 🚨 **Troubleshooting**

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
- **v0.0.9**: Added versioned filenames, automatic version sync, backup download endpoint
- **v0.0.8**: Fixed VSIX packaging reliability, replaced zip command with archiver library
- **v0.0.7**: Fixed VSIX packaging structure, corrected file paths and package.json
- **v0.0.6**: Simplified deployment workflow, direct VSIX serving
- **v0.0.5**: Fixed build and packaging issues
- **v0.0.4**: Improved release workflow automation
- **v0.0.3**: Initial esbuild bundling implementation

### **Breaking Changes**
- **v0.0.9**: Worker deployment now required for extension updates (version sync)
- **v0.0.8**: Improved VSIX packaging reliability (no breaking changes, just fixes)
- **v0.0.7**: Fixed VSIX package structure (no breaking changes, just fixes)
- **v0.0.6**: Removed VSIX embedding from Worker, now served directly from web app
- **v0.0.3**: Switched from TypeScript compilation to esbuild bundling

## 🔮 **Future Improvements**

- **Automated Testing**: Add extension installation tests
- **Rollback Support**: Quick rollback to previous versions
- **CDN Integration**: Serve VSIX from Cloudflare R2 for better performance
- **Version Signing**: Cryptographic verification of extension authenticity
- **Runtime Version Sync**: Read extension version from uploaded VSIX metadata
- **Automatic Deployment**: Trigger Worker/Web deployments from release workflow
