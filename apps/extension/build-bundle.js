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
      }
    });
    
    console.log('✅ Extension bundled successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
