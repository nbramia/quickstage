const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function buildManual() {
  try {
    console.log('🔨 Building extension manually...');
    
    // Read version from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = packageJson.version;
    
    // Create package directory
    const packageDir = `quickstage-${version}`;
    if (fs.existsSync(packageDir)) {
      fs.rmSync(packageDir, { recursive: true });
    }
    fs.mkdirSync(packageDir);
    
    // Create extension subdirectory (VS Code expects this structure)
    const extensionDir = path.join(packageDir, 'extension');
    fs.mkdirSync(extensionDir);
    
    // Copy extension files to the extension subdirectory
    console.log('📁 Copying extension files...');
    fs.copyFileSync('dist/extension.js', path.join(extensionDir, 'extension.js'));
    fs.copyFileSync('LICENSE', path.join(extensionDir, 'LICENSE'));
    
    // Create extension manifest to be placed INSIDE extension/ folder
    const manifest = {
      name: "quickstage",
      displayName: "QuickStage",
      description: "Stage and share static prototypes privately in 1 click.",
      version: version,
      publisher: "quickstage",
      private: true,
      license: "SEE LICENSE IN LICENSE",
      engines: {
        vscode: "^1.85.0"
      },
      categories: ["Other"],
      activationEvents: ["onStartupFinished"],
      // main is relative to this package.json location (extension/)
      main: "extension.js",
      contributes: {
        commands: [
          { command: "quickstage.stage", title: "QuickStage: Stage" },
          { command: "quickstage.stageManual", title: "QuickStage: Stage (Manual output…)" },
          { command: "quickstage.openDashboard", title: "QuickStage: Open Dashboard" },
          { command: "quickstage.settings", title: "QuickStage: Settings" }
        ]
      }
    };
    
    // Write the manifest inside extension/ as package.json
    fs.writeFileSync(path.join(extensionDir, 'package.json'), JSON.stringify(manifest, null, 2));
    
    // Create VSIX package using archiver
    console.log('📦 Creating VSIX package...');
    const output = fs.createWriteStream(`quickstage-${version}.vsix`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    output.on('close', () => {
      console.log(`✅ Extension packaged successfully as quickstage-${version}.vsix!`);
      console.log(`📦 Archive size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
      // Clean up
      fs.rmSync(packageDir, { recursive: true });
    });
    
    archive.on('error', (err) => { throw err; });
    
    archive.pipe(output);
    archive.directory(packageDir, false);
    await archive.finalize();
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildManual();
