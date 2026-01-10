import esbuild from 'esbuild'

//
await esbuild.build({
  entryPoints: [
    "./src/server/astro-render.js",
    "./src/server/astro-integration.js",
    "./src/server/ssr-vite.js",
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
