import esbuild from 'esbuild'

//
await esbuild.build({
  entryPoints: [
    "./src/server/renderToString.js",
  ],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2018',
  sourcemap: false,
  minify: true,
})

console.log('✅ build server complete')
