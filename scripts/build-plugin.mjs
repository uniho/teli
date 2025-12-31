import esbuild from 'esbuild'

//
await esbuild.build({
  entryPoints: [
    "./src/plugin/index-vite.js",
    "./src/plugin/index-esbuild.js",
  ],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2018',
  sourcemap: false,
  minify: false,

  // external: [
  //   // 'esbuild',
  //   'acorn',
  //   'acorn-jsx',
  //   'astring',
  //   'fs',
  //   'path',
  //   'url',
  // ],  
})

console.log('✅ build plugin complete')
