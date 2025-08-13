# QuickStage Extension Version Management

This document explains how to manage extension versions automatically using our new version management system.

## 🎯 **Why Version Management Matters**

- **User Experience**: Users need to know when updates are available
- **Consistency**: Version numbers should match across all files
- **Automation**: Reduces manual errors and saves time
- **Deployment**: Ensures Worker and extension versions stay in sync

## 🚀 **Available Commands**

### **Version Bump Only**
```bash
npm run version:bump
```
- Increments patch version (0.0.1 → 0.0.2)
- Updates `package.json` and `package-lock.json`
- Updates version references in `README.md`
- Updates build scripts with new version

### **Basic Release**
```bash
npm run release
```
- Bumps version
- Builds extension
- Packages into VSIX file

### **Full Release Workflow**
```bash
npm run release:full
```
- Complete automated release process
- Updates all version references
- Copies VSIX to worker directory
- Converts to base64
- Updates worker constants
- Prepares for deployment

## 📋 **Release Workflow Steps**

The `release:full` command automates these steps:

1. **Version Bump**: Increment version number
2. **Build**: Compile TypeScript to JavaScript using esbuild bundler
3. **Package**: Create VSIX file using manual packaging script
4. **Copy**: Move VSIX to worker directory
5. **Convert**: Convert VSIX to base64
6. **Update Worker**: Update version info and constants
7. **Deploy Ready**: Extension ready for deployment

## 🔄 **Version Numbering Strategy**

We use **Semantic Versioning** (SemVer):

- **Major** (X.0.0): Breaking changes, major rewrites
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, small improvements

**Current Strategy**: We're in early development, so we increment patch versions for now.

## 📁 **Files Updated Automatically**

When you run version management commands, these files are updated:

- `package.json` - Extension version
- `package-lock.json` - Lock file version
- `README.md` - Version references
- `build-manual.js` - Build script version
- `src/version-info.ts` - Worker version info
- `src/constants.ts` - VSIX base64 content

## 🚀 **Complete Release Process**

### **Step 1: Run Full Release Workflow**
```bash
npm run release:full
```

### **Step 2: Deploy Worker**
```bash
cd ../../infra
npx wrangler deploy
```

### **Step 3: Deploy Web App**
```bash
cd apps/web
pnpm build
cd ../../infra
npx wrangler pages deploy dist --project-name=quickstage
```

### **Step 4: Test**
- Download new extension from dashboard
- Verify version number is correct
- Test extension functionality

## 🔧 **Extension Build System**

### **Build Process**
Our extension uses **esbuild** to bundle all dependencies into a single file:

1. **Source**: `src/extension.ts` (TypeScript with external imports)
2. **Bundler**: `build-bundle.js` (esbuild configuration)
3. **Output**: `dist/extension.js` (Single bundled JavaScript file)
4. **Packaging**: `build-manual.js` (Manual VSIX creation)

### **Why esbuild?**
- **Dependencies**: Bundles all npm packages into single file
- **No Missing Modules**: Eliminates "Cannot find module" errors
- **Performance**: Faster builds than webpack
- **Reliability**: Avoids vsce packaging issues

### **Build Commands**
```bash
# Build bundled extension
npm run build          # Runs build-bundle.js

# Package into VSIX
npm run package        # Runs build-manual.js

# Complete workflow
npm run release:full   # Bump → Build → Package → Update Worker
```

## 🌐 **Deployment Architecture**

### **System Components**
1. **Extension Source** (`apps/extension/`) - VS Code/Cursor extension
2. **Cloudflare Worker** (`apps/worker/`) - Backend API + VSIX serving
3. **Web Dashboard** (`apps/web/`) - User interface + extension download
4. **Infrastructure** (`infra/`) - Deployment configuration

### **Deployment Flow**
```
Extension Build → VSIX Package → Worker Update → Deploy Worker → Deploy Web App
```

### **Critical Deployment Order**
**ALWAYS deploy in this order:**
1. **Worker First** - Contains the new VSIX file
2. **Web App Second** - Serves the dashboard that downloads the extension

**Why this order matters:**
- Web app downloads extension from Worker
- If Worker isn't updated first, users get old version
- Deployment order is critical for version consistency

## 📋 **Complete Deployment Checklist**

### **Before Deployment**
- [ ] Run `npm run release:full` in `apps/extension/`
- [ ] Verify new VSIX was created and copied to worker
- [ ] Verify `apps/worker/src/constants.ts` was updated
- [ ] Check that version numbers match across all files

### **Deployment Steps**
- [ ] Deploy Worker: `cd infra && npx wrangler deploy`
- [ ] Build Web App: `cd apps/web && pnpm build`
- [ ] Deploy Web App: `cd ../../infra && npx wrangler pages deploy dist --project-name=quickstage`

### **After Deployment**
- [ ] Test extension download from dashboard
- [ ] Verify new version is detected
- [ ] Test extension functionality in VS Code/Cursor
- [ ] Check that update notifications work correctly

## 🔍 **Manual Version Updates**

If you need to manually update versions:

### **Update Extension Version**
```bash
# Edit package.json
"version": "0.0.2"

# Then run
npm run version:bump
```

### **Update Worker Version**
```bash
# Edit apps/worker/src/version-info.ts
version: '0.0.2'
```

### **Update Constants**
```bash
# Convert new VSIX to base64
cd apps/worker
base64 -i quickstage-0.0.2.vsix > vsix_base64_new.txt

# Update constants.ts with new content
```

## ⚠️ **Important Notes**

1. **Always run `npm run release:full`** before deploying
2. **Deploy Worker first**, then Web App
3. **Test the new version** after deployment
4. **Version numbers must match** between extension and worker
5. **Build order matters** - extension must be built before worker deployment

## 🐛 **Troubleshooting**

### **Version Mismatch Errors**
- Ensure you ran `npm run release:full`
- Check that worker and extension versions match
- Verify constants.ts was updated

### **Build Failures**
- Check TypeScript compilation errors
- Ensure all dependencies are installed
- Verify build scripts are updated

### **Deployment Issues**
- Deploy Worker before Web App
- Check Cloudflare deployment logs
- Verify environment variables are set

### **Extension Not Working**
- Verify VSIX was properly bundled
- Check that all dependencies are included
- Ensure activation events are correct

## 📚 **Best Practices**

1. **Use `npm run release:full`** for all releases
2. **Test locally** before deploying
3. **Deploy in order**: Worker → Web App
4. **Verify versions** after deployment
5. **Document changes** in commit messages
6. **Test extension functionality** after each deployment

## 🔮 **Future Enhancements**

- **Git integration**: Automatic version bumping on release tags
- **Changelog generation**: Automatic changelog updates
- **Release notes**: Integration with GitHub releases
- **Rollback support**: Easy version rollback if issues arise
- **Automated testing**: CI/CD pipeline for extension validation
- **Deployment automation**: Single command for complete deployment

## 🚨 **Emergency Procedures**

### **If Extension Breaks After Deployment**
1. **Immediate Rollback**: Deploy previous Worker version
2. **Investigate**: Check build logs and extension activation
3. **Fix**: Resolve the issue in extension code
4. **Redeploy**: Run complete release process again

### **If Worker Deployment Fails**
1. **Check Logs**: Review Cloudflare deployment logs
2. **Verify Configuration**: Check wrangler.toml settings
3. **Environment Variables**: Ensure all required env vars are set
4. **Retry**: Attempt deployment again

### **If Web App Deployment Fails**
1. **Build Issues**: Check for TypeScript compilation errors
2. **Dependencies**: Verify all packages are installed
3. **Configuration**: Check Vite and build configuration
4. **Retry**: Rebuild and redeploy

## 📞 **Support & Resources**

### **Key Files to Know**
- `apps/extension/package.json` - Extension configuration
- `apps/extension/build-bundle.js` - Build configuration
- `apps/worker/src/constants.ts` - VSIX content
- `infra/wrangler.toml` - Cloudflare configuration

### **Useful Commands**
```bash
# Check current versions
grep -r "version.*0.0" apps/extension/package.json apps/worker/src/version-info.ts

# Verify VSIX content
cd apps/worker && ls -la *.vsix

# Check Worker deployment status
cd infra && npx wrangler tail

# View build output
cd apps/extension && npm run build
```

### **Common Issues & Solutions**
- **Missing modules**: Run `npm run build` to bundle dependencies
- **Version mismatch**: Use `npm run release:full` to sync versions
- **Deployment failures**: Check Cloudflare logs and environment variables
- **Extension not working**: Verify VSIX was properly bundled and deployed

---

**Remember**: The deployment order is critical. Always deploy Worker first, then Web App. This ensures users get the correct extension version when they download from the dashboard.
