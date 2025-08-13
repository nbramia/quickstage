const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
    
    // Copy extension files
    console.log('📁 Copying extension files...');
    fs.copyFileSync('dist/extension.js', `${packageDir}/extension.js`);
    fs.copyFileSync('package.json', `${packageDir}/package.json`);
    fs.copyFileSync('LICENSE', `${packageDir}/LICENSE`);
    
    // Create extension manifest
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
      main: "extension.js",
      contributes: {
        commands: [
          {
            command: "quickstage.stage",
            title: "QuickStage: Stage"
          },
          {
            command: "quickstage.stageManual",
            title: "QuickStage: Stage (Manual output…)"
          },
          {
            command: "quickstage.openDashboard",
            title: "QuickStage: Open Dashboard"
          },
          {
            command: "quickstage.settings",
            title: "QuickStage: Settings"
          }
        ]
      }
    };
    
    fs.writeFileSync(`${packageDir}/package.json`, JSON.stringify(manifest, null, 2));
    
    // Create VSIX package
    console.log('📦 Creating VSIX package...');
    execSync(`cd ${packageDir} && zip -r ../quickstage-${version}.vsix .`, { stdio: 'inherit' });
    
    // Clean up
    fs.rmSync(packageDir, { recursive: true });
    
    console.log(`✅ Extension packaged successfully as quickstage-${version}.vsix!`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildManual();
