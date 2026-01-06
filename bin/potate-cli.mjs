#!/usr/bin/env node

import esbuild from 'esbuild';
import potate from '../dist/index-esbuild.js';

/**
 * CLI Argument Parsing
 */
const args = process.argv.slice(2);
const entries = [];
let outdir = 'dist';
let sourcemap = false;
let minify = true; // Enabled by default

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--outdir') {
    const val = args[++i];
    if (val) outdir = val;
  } else if (arg === '--sourcemap') {
    sourcemap = true;
  } else if (arg === '--no-minify') {
    minify = false;
  } else if (!arg.startsWith('--')) {
    entries.push(arg);
  }
}

/**
 * Validation
 */
if (entries.length === 0) {
  console.error('❌ Error: No entry files specified.');
  console.log('Usage: node build.mjs <entry_file> [options]');
  console.log('\nOptions:');
  console.log('  --outdir <path>  Output directory (default: dist)');
  console.log('  --sourcemap      Enable sourcemap generation');
  console.log('  --no-minify      Disable minification (enabled by default)');
  process.exit(1);
}

/**
 * Execute esbuild
 */
try {
  await esbuild.build({
    entryPoints: entries,
    outdir: outdir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2018',
    plugins: [potate()],
    jsx: 'preserve',
    sourcemap: sourcemap,
    minify: minify,
    alias: {
      'react': 'potatejs',
      'react-dom': 'potatejs',
      'react/jsx-runtime': 'potatejs',
    },
  });

  console.log('✅ Build complete!');
  console.log(`- Entries:   ${entries.join(', ')}`);
  console.log(`- Output:    ${outdir}/`);
  console.log(`- Sourcemap: ${sourcemap ? 'Enabled' : 'Disabled'}`);
  console.log(`- Minify:    ${minify ? 'Enabled' : 'Disabled'}`);
} catch (error) {
  process.exit(1);
}
