#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 QuickStage Extension Release Workflow');
console.log('=====================================\n');

// Step 1: Bump version
console.log('1️⃣ Bumping version...');
try {
  execSync('npm run version:bump', { stdio: 'inherit' });
  console.log('✅ Version bumped successfully\n');
} catch (error) {
  console.error('❌ Failed to bump version:', error.message);
  process.exit(1);
}

// Step 2: Read new version
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const newVersion = packageJson.version;

console.log(`2️⃣ Building extension v${newVersion}...`);
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Extension built successfully\n');
} catch (error) {
  console.error('❌ Failed to build extension:', error.message);
  process.exit(1);
}

// Step 3: Package extension
console.log('3️⃣ Packaging extension...');
try {
  execSync('npm run package', { stdio: 'inherit' });
  console.log('✅ Extension packaged successfully\n');
} catch (error) {
  console.error('❌ Failed to package extension:', error.message);
  process.exit(1);
}

// Step 4: Copy VSIX to worker directory
console.log('4️⃣ Copying VSIX to worker directory...');
const vsixPath = path.join(__dirname, `quickstage-${newVersion}.vsix`);
const workerDir = path.join(__dirname, '../worker');

if (!fs.existsSync(vsixPath)) {
  console.error('❌ VSIX file not found:', vsixPath);
  process.exit(1);
}

try {
  execSync(`cp "${vsixPath}" "${workerDir}/"`, { stdio: 'inherit' });
  console.log('✅ VSIX copied to worker directory\n');
} catch (error) {
  console.error('❌ Failed to copy VSIX:', error.message);
  process.exit(1);
}

// Step 5: Convert to base64 and update constants
console.log('5️⃣ Converting VSIX to base64...');
try {
  execSync(`cd "${workerDir}" && base64 -i quickstage-${newVersion}.vsix > vsix_base64_new.txt`, { stdio: 'inherit' });
  console.log('✅ VSIX converted to base64\n');
} catch (error) {
  console.error('❌ Failed to convert VSIX to base64:', error.message);
  process.exit(1);
}

// Step 6: Update version info in worker
console.log('6️⃣ Updating worker version info...');
const versionInfoPath = path.join(workerDir, 'src/version-info.ts');
let versionInfo = fs.readFileSync(versionInfoPath, 'utf8');
versionInfo = versionInfo.replace(
  /version: '\d+\.\d+\.\d+'/g,
  `version: '${newVersion}'`
);
fs.writeFileSync(versionInfoPath, versionInfo);
console.log('✅ Worker version info updated\n');

// Step 7: Update constants file
console.log('7️⃣ Updating constants file...');
try {
  execSync(`cd "${workerDir}" && echo "// VSIX extension file content (base64-encoded)" > src/constants_new.ts && echo "export const VSIX_EXTENSION_BASE64 = '\$(cat vsix_base64_new.txt)';" >> src/constants_new.ts && mv src/constants_new.ts src/constants.ts`, { stdio: 'inherit' });
  console.log('✅ Constants file updated\n');
} catch (error) {
  console.error('❌ Failed to update constants file:', error.message);
  process.exit(1);
}

console.log('🎉 Release workflow completed successfully!');
console.log(`📦 Extension v${newVersion} is ready for deployment`);
console.log('\n📋 Next steps:');
console.log('1. Deploy the worker: cd ../../infra && npx wrangler deploy');
console.log('2. Deploy the web app: cd apps/web && pnpm build && cd ../../infra && npx wrangler pages deploy dist --project-name=quickstage');
console.log('3. Test the new extension download from the dashboard');
console.log(`4. The new version ${newVersion} will be automatically detected by users`);
