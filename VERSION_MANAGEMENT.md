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
2. **Build**: Compile TypeScript to JavaScript
3. **Package**: Create VSIX file
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

## 📚 **Best Practices**

1. **Use `npm run release:full`** for all releases
2. **Test locally** before deploying
3. **Deploy in order**: Worker → Web App
4. **Verify versions** after deployment
5. **Document changes** in commit messages

## 🔮 **Future Enhancements**

- **Git integration**: Automatic version bumping on release tags
- **Changelog generation**: Automatic changelog updates
- **Release notes**: Integration with GitHub releases
- **Rollback support**: Easy version rollback if issues arise
