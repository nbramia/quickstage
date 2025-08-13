# QuickStage Extension Version Management

This document outlines the complete process for building, packaging, and deploying new versions of the QuickStage VS Code/Cursor extension.

## 🎯 **New Simplified Workflow (v0.0.6+)**

The extension deployment process has been simplified and no longer requires embedding the VSIX in the Worker. Instead, the extension is served directly from the web app's public directory.

### **What Changed**
- ❌ **Removed**: VSIX embedding in Worker constants
- ❌ **Removed**: Base64 conversion and storage
- ❌ **Removed**: Worker deployment for extension updates
- ✅ **Added**: Direct VSIX serving from web app public directory
- ✅ **Added**: Automatic version tracking in web app
- ✅ **Added**: Cleaner deployment process

### **Benefits of New Approach**
1. **Faster Updates**: No worker deployment needed for extension changes
2. **Cleaner Code**: No more base64 constants or file copying
3. **Better Performance**: Direct file serving instead of base64 decoding
4. **Easier Debugging**: VSIX files are directly accessible
5. **Version Consistency**: Web app and extension versions stay in sync

## 🚀 **Complete Release Workflow**

### **Step 1: Run Release Workflow**
```bash
cd apps/extension
npm run release:full
```

This command automatically:
1. Bumps the version number
2. Builds the extension with esbuild bundler
3. Packages it into a VSIX file
4. Copies the VSIX to the web app's public directory
5. Updates the web app's version information

### **Step 2: Build and Deploy Web App**
```bash
cd ../web
pnpm build
cd ../../infra
npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Step 3: Test the Update**
1. Visit the QuickStage dashboard
2. Check that the extension version shows as updated
3. Download and test the new extension

## 🔧 **Manual Build Commands**

If you need to run individual steps:

```bash
cd apps/extension

# Build bundled extension
npm run build          # Runs build-bundle.js (esbuild bundler)

# Package into VSIX
npm run package        # Runs build-manual.js (manual packaging)

# Complete release workflow
npm run release:full   # Bump version → Build → Package → Update Web App
```

## 📁 **File Locations**

### **Extension Build Output**
- **Source**: `apps/extension/src/extension.ts`
- **Bundled**: `apps/extension/dist/extension.js`
- **VSIX Package**: `apps/extension/quickstage-{version}.vsix` (temporary)

### **Web App Integration**
- **Public VSIX**: `apps/web/public/quickstage.vsix`
- **Version Info**: `apps/web/src/version.ts` (auto-generated)
- **Build Output**: `apps/web/dist/` (deployed to Cloudflare Pages)

## 🌐 **Extension Download URLs**

### **Direct Download**
- **URL**: `https://quickstage.tech/quickstage.vsix`
- **Source**: Web app public directory
- **Caching**: Standard Cloudflare Pages caching

### **Version Information**
- **URL**: `https://quickstage.tech/api/extensions/version`
- **Source**: Worker API endpoint
- **Purpose**: Check for updates and version info

## 🔄 **Deployment Scenarios**

### **Extension Updates Only**
```bash
# Only need to deploy web app
cd apps/extension && npm run release:full
cd ../web && pnpm build
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Worker Changes (API updates, etc.)**
```bash
# Deploy worker first, then web app if needed
cd infra && npx wrangler deploy
cd apps/web && pnpm build
cd ../../infra && npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

### **Full System Update**
```bash
# Update everything in correct order
cd apps/extension && npm run release:full
cd ../web && pnpm build
cd ../../infra
npx wrangler deploy
npx wrangler pages deploy ../apps/web/dist --project-name=quickstage
```

## 🚨 **Troubleshooting**

### **VSIX Not Found After Release**
- Check that `apps/web/public/` directory exists
- Verify VSIX was copied successfully
- Ensure web app build includes public directory

### **Version Mismatch**
- Run `npm run release:full` again to sync versions
- Check `apps/web/src/version.ts` is up to date
- Verify web app deployment was successful

### **Extension Download Fails**
- Check Cloudflare Pages deployment status
- Verify `/quickstage.vsix` is accessible
- Check browser console for errors

## 📊 **Version History**

### **Recent Updates**
- **v0.0.6**: Simplified deployment workflow, direct VSIX serving
- **v0.0.5**: Fixed build and packaging issues
- **v0.0.4**: Improved release workflow automation
- **v0.0.3**: Initial esbuild bundling implementation

### **Breaking Changes**
- **v0.0.6**: Removed VSIX embedding from Worker, now served directly from web app
- **v0.0.3**: Switched from TypeScript compilation to esbuild bundling

## 🔮 **Future Improvements**

- **Automated Testing**: Add extension installation tests
- **Rollback Support**: Quick rollback to previous versions
- **CDN Integration**: Serve VSIX from Cloudflare R2 for better performance
- **Version Signing**: Cryptographic verification of extension authenticity
