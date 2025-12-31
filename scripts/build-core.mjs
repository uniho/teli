import esbuild from 'esbuild'

//
await esbuild.build({
  entryPoints: [
    "./src/core/index.js",
  ],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2018',
  sourcemap: false,
  minify: true,
})

console.log('✅ build core complete')
