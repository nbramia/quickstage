// This file reads the extension version from package.json to keep versions in sync
// We'll use this in the version endpoint to automatically return the correct version

export function getExtensionVersion() {
  // For now, return hardcoded version - in production this could read from a file
  // or be injected during build time
  return {
    version: '0.0.2', // This should match the extension's package.json version
    buildDate: new Date().toISOString(),
    filename: 'quickstage.vsix'
  };
}
