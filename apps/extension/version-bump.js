const fs = require('fs');
const path = require('path');

// Read current version from package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Increment patch version (0.0.1 -> 0.0.2)
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`🔄 Bumping version from ${packageJson.version} to ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// Update package-lock.json if it exists
const lockPath = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lockJson.version = newVersion;
  fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, 2) + '\n');
}

// Update README.md if it contains version references
const readmePath = path.join(__dirname, 'README.md');
if (fs.existsSync(readmePath)) {
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  // Replace version references like "quickstage-0.0.1.vsix" with new version
  readmeContent = readmeContent.replace(
    /quickstage-\d+\.\d+\.\d+\.vsix/g,
    `quickstage-${newVersion}.vsix`
  );
  fs.writeFileSync(readmePath, readmeContent);
}

// Update the build script to use new version
const buildScriptPath = path.join(__dirname, 'build-manual.js');
if (fs.existsSync(buildScriptPath)) {
  let buildScript = fs.readFileSync(buildScriptPath, 'utf8');
  buildScript = buildScript.replace(
    /const packageDir = 'quickstage-\d+\.\d+\.\d+'/g,
    `const packageDir = 'quickstage-${newVersion}'`
  );
  buildScript = buildScript.replace(
    /const manifest = {\s+name: "quickstage",\s+version: "\d+\.\d+\.\d+"/g,
    `const manifest = {\n      name: "quickstage",\n      version: "${newVersion}"`
  );
  fs.writeFileSync(buildScriptPath, buildScript);
}

console.log(`✅ Version bumped to ${newVersion}`);
console.log(`📝 Updated package.json, package-lock.json, README.md, and build scripts`);
console.log(`🚀 Ready to build and package extension v${newVersion}`);
