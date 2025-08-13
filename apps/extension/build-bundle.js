const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      format: 'cjs',
      platform: 'node',
      target: 'node16',
      external: ['vscode'], // Keep vscode as external
      sourcemap: false,
      minify: false,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      // Force bundling of all dependencies
      packages: 'bundle',
      // Ensure proper module resolution
      mainFields: ['module', 'main'],
      // Bundle all node_modules
      bundle: true,
      // Don't externalize any packages except vscode
      external: ['vscode']
    });
    
    console.log('✅ Extension bundled successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
