// server/vite-integration.js

import potateVite from '../plugin/index-vite-jsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

const pageRoot = 'pages';
const initName = '_init';
const appId = 'app';

export default function(options = {}) {

  let viteConfig, devServer, runner, nodeServer, runtimeRefId

  const RUNTIME_PUBLIC_ID = 'virtual:potate-runtime';
  const RUNTIME_INTERNAL_ID = '\0' + RUNTIME_PUBLIC_ID;
  const ENTRY_PUBLIC_ID = 'virtual:potate-entry';

  const RUNNER_PUBLIC_ID = 'virtual:potate-runner';
  
  // Calculate path here to be available in load()
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const renderToStringPath = path.join(__dirname, 'renderToString.js').replace(/\\/g, '/');

  const virtualHtmlMap = new Set();

  return {
    name: 'potate',
    enforce: 'pre',
    config(userConfig) {
      const projectRoot = process.cwd();
      const root = userConfig.root || projectRoot;

      // MPA support: Check root/index.html and generate virtual HTML entries from components under src/pages
      const input = {};
      const pagesDir = path.resolve(root, `src/${pageRoot}`);

      // Only index.html is allowed as a physical HTML file
      const indexHtml = path.resolve(root, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        throw new Error(`[potate] index.html not found in root: ${root}`);
      }
      input['index'] = indexHtml;

      // Scan src/pages and register virtual HTML (File System Routing)
      const scanPages = (dir, baseRoute = '') => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // Exclude directories starting with _ (e.g. src/pages/_components)
            if (file.startsWith('_')) continue;
            scanPages(filePath, path.join(baseRoute, file));
          } else if (/\.(jsx|tsx|js|ts)$/.test(file)) {
            const ext = path.extname(file);
            const basename = path.basename(file, ext);
            
            // Exclude files like _xxxx.js
            if (basename.startsWith('_')) continue;

            // Determine route path
            let routeName = path.join(baseRoute, basename === 'index' ? '' : basename);
            routeName = routeName.replace(/\\/g, '/'); // Windows support
            
            // Skip root (index) as it uses the physical file
            if (!routeName || routeName === '.') continue;

            // Entry name (output path in dist: about -> about/index.html)
            const entryName = `${routeName}/index`;

            // Generate virtual HTML file path (end with .html for Vite recognition)
            // Handle with resolveId/load since physical file does not exist
            const virtualPath = path.resolve(root, `${entryName}.html`);
            input[entryName] = virtualPath;
            virtualHtmlMap.add(virtualPath);

            // const sourcePath = filePath.replace(/\\/g, '/');
            // input[`js/${entryName}`] = `${ENTRY_PUBLIC_ID}:${sourcePath}`;            
          }
        }
      };
      
      // Execute scan only during build when input is not specified
      if (!userConfig.build?.rollupOptions?.input) {
        scanPages(pagesDir);
      }

      return {
        plugins: [potateVite()],
        resolve: {
          alias: {
            'react': 'potatejs',
            'react-dom': 'potatejs',
            'react/jsx-runtime': 'potatejs',
          },
        },
        ssr: { noExternal: ['@emotion/css', '@emotion/server', 'potatejs'] },
        optimizeDeps: { exclude: ['@emotion/css', '@emotion/server', 'potatejs'] },
        build: {
          rollupOptions: {
            input
          }
        }
      };
    },

    configResolved(config) { viteConfig = config; },

    configureServer(server) {
      devServer = server;
      // Create the SSR runner and server once for dev mode and reuse them on every request.
      nodeServer = new ViteNodeServer(server);
      runner = new ViteNodeRunner({
        root: server.config.root,
        fetchModule: id => nodeServer.fetchModule(id),
        resolveId: (id, importer) => nodeServer.resolveId(id, importer),
      });

      // Middleware to serve virtual HTML files in development mode
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url || req.method !== 'GET') return next();

        let targetPath = url;
        
        // Handle extension-less paths (e.g. /about)
        if (!path.extname(targetPath)) {
          if (!targetPath.endsWith('/')) {
             // Check if this is a virtual route
             const potentialHtml = path.resolve(viteConfig.root, targetPath.slice(1), 'index.html');
             if (virtualHtmlMap.has(potentialHtml)) {
                // Redirect /about to /about/
                res.statusCode = 301;
                res.setHeader('Location', url + '/');
                res.end();
                return;
             }
          } else {
             targetPath += 'index.html';
          }
        }

        if (targetPath.endsWith('.html')) {
           const absolutePath = path.resolve(viteConfig.root, targetPath.startsWith('/') ? targetPath.slice(1) : targetPath);
           
           if (virtualHtmlMap.has(absolutePath)) {
             try {
               const template = fs.readFileSync(path.resolve(viteConfig.root, 'index.html'), 'utf-8');
               const html = await server.transformIndexHtml(url, template, req.originalUrl);
               
               res.statusCode = 200;
               res.setHeader('Content-Type', 'text/html');
               res.end(html);
               return;
             } catch (e) {
               return next(e);
             }
           }
        }
        
        next();
      });
    },

    buildStart() {
      if (viteConfig.command === 'build') {
        runtimeRefId = this.emitFile({
          type: 'chunk',
          id: RUNTIME_PUBLIC_ID,
          name: 'runtime'
        });
      }
    },

    resolveId(id) {
      if (id === RUNTIME_PUBLIC_ID) return RUNTIME_INTERNAL_ID;
      if (id.startsWith(ENTRY_PUBLIC_ID)) return id;
      if (id.startsWith(`${RUNNER_PUBLIC_ID}:`)) return '\0' + id;
      if (virtualHtmlMap.has(id)) {
        return id;
      }
    },
    
    async load(id) {
      if (id === RUNTIME_INTERNAL_ID) {
        return `
          import { createElement, render } from 'potatejs';
          const pages = import.meta.glob('/src/${pageRoot}/**/*.{jsx,tsx,js,ts}');
          const initModules = import.meta.glob('/src/${initName}.{js,ts}', { eager: true });

          async function start() {
            console.log(1);
            const self = document.querySelector('script[data-comp]');
            const compPath = self?.getAttribute('data-comp');
            if (!compPath || !pages[compPath]) return;

            const mod = await pages[compPath]();
            console.log(2);

            let globalProps = {};
            for (const path in initModules) {
              const initMod = initModules[path];
              if (typeof initMod.main === 'function') globalProps = await initMod.main();
            }

            const container = document.getElementById('${appId}');
            const Component = mod.default || mod.App || mod.body;
            const localProps = typeof mod.main === 'function' ? await mod.main() : {};
            const props = { ...globalProps, ...localProps };
            const cache = document.createElement('div');
            render(createElement(Component, props), cache);
            container.replaceChildren(...Array.from(cache.childNodes));
          }
          start();
        `;
      }

      if (virtualHtmlMap.has(id)) {
        const templatePath = path.resolve(viteConfig.root, 'index.html');
        const html = fs.readFileSync(templatePath, 'utf-8');
        return `<!--POTATE_ID:${id}-->\n${html}`;
      }

      if (id.startsWith(`\0${RUNNER_PUBLIC_ID}:`)) {
        const name = id.substring(`\0${RUNNER_PUBLIC_ID}:`.length);
        const cleanName = name.startsWith('/') ? name.slice(1) : name;
        const dirName = path.dirname(cleanName).replace(/\\/g, '/');
        
        let initImportPath = null;
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts'];
        for (const ext of extensions) {
          if (fs.existsSync(path.join(viteConfig.root, 'src', initName + ext))) {
            initImportPath = `/src/${initName}` + ext;
            break;
          }
        }

        const globalPropsCode = initImportPath 
          ? `
            async function getGlobalProps() {
              try {
                const init = await import('${initImportPath}');
                return (init && typeof init.main === 'function') ? await init.main() : {};
              } catch (e) { return {}; }
            }
          `
          : `async function getGlobalProps() { return {}; }`;

        return `
          import { renderToString, FUNCTIONAL_COMPONENT_NODE } from '${renderToStringPath}';
          import { createElement, render } from 'potatejs';
          import * as mod from '/src/${pageRoot}/${cleanName}';
          
          ${globalPropsCode}

          export const run = async () => {
            const globalProps = await getGlobalProps();
            const pageProps = typeof mod.main === 'function' ? await mod.main() : {};
            const hydrate = pageProps.hydrate || false;
            const props = { ...globalProps, ...pageProps };
            const Layout = mod.default || mod.App || mod.body;
            if (Layout) {
              const node = {
                nodeType: FUNCTIONAL_COMPONENT_NODE,
                type: Layout,
                props: { ...props }
              };
              let body = renderToString(node);
              const { extractCritical } = await import('@emotion/server');
              return { body, ...extractCritical(body), hydrate };
            }
            return { body: '', ids: [], css: '', hydrate: false };
          }
        `;
      }
    },

    //
    async transformIndexHtml(html, ctx) {
      // This function will be used in both dev and build
      const ssrRender = async (componentName) => {
        if (devServer) {
          const mod = await runner.executeId(`${RUNNER_PUBLIC_ID}:${componentName}`);
          return await mod.run();
        } else {
          // Build mode: Create a temporary, isolated server and runner for each page.
          const serverForRender = await createServer({
              root: viteConfig.root,
              configFile: viteConfig.configFile,
              server: { middlewareMode: true, hmr: false },
              optimizeDeps: { noDiscovery: true, include: [] },
              ssr: { noExternal: ['@emotion/css', '@emotion/server', 'potatejs'] },
              plugins: [potateVite()]
          });
          try {
            const nodeServerForRender = new ViteNodeServer(serverForRender);
            const nodeRunnerForRender = new ViteNodeRunner({ root: serverForRender.config.root, fetchModule: id => nodeServerForRender.fetchModule(id), resolveId: (id, importer) => nodeServerForRender.resolveId(id, importer) });
            const mod = await nodeRunnerForRender.executeId(`${RUNNER_PUBLIC_ID}:${componentName}`);
            return await mod.run();
          } finally {
            await serverForRender.close();
          }
        }
      }

      let virtualId = null;
      const idMatch = html.match(/<!--POTATE_ID:(.*?)-->/);
      if (idMatch) {
        virtualId = idMatch[1];
        html = html.replace(idMatch[0], '');
      }

      let processedHtml = html;
      let allIds = new Set();
      let allCss = "";
      let clientPath = null;

      // Identify target page component from URL (ctx.path)
      // e.g. /about/index.html -> src/pages/about.jsx OR src/pages/about/index.jsx
      let componentPath = null;
      let urlPath = ctx.path;
      
      if (virtualId) {
        const rel = path.relative(viteConfig.root, virtualId).replace(/\\/g, '/');
        urlPath = '/' + rel;
      }

      urlPath = urlPath.replace(/^\//, '').replace(/index\.html$/, '').replace(/\/$/, '');
      const pagesDir = path.resolve(viteConfig.root, 'src', pageRoot);
      
      const extensions = ['.jsx', '.tsx', '.js', '.ts'];
      const searchPaths = [
        path.join(pagesDir, urlPath || 'index'), // /about -> src/pages/about
        path.join(pagesDir, urlPath, 'index')    // /about -> src/pages/about/index
      ];

      for (const basePath of searchPaths) {
        for (const ext of extensions) {
          if (fs.existsSync(basePath + ext)) {
            clientPath = '/src/' + path.relative(path.join(viteConfig.root, 'src'), basePath + ext).replace(/\\/g, '/');
            componentPath = path.relative(path.join(viteConfig.root, 'src', pageRoot), basePath + ext).replace(/\\/g, '/').replace(/\.[^/.]+$/, "");
            break;
          }
        }
        if (componentPath) break;
      }

      let hydration = false;
      if (componentPath) {
        console.log(`[potate] Rendering ${ctx.path} -> ${componentPath}`);

        const name = componentPath;
        const { body: appHtml, css, ids, hydrate } = await ssrRender(name);

        console.log(css)

        hydration = hydrate;

        ids?.forEach(id => allIds.add(id));
        if (css) allCss += css;

        let content = appHtml;

        // const window = new Window();
        // const document = window.document;
        // const clean = (h) => {
        //   if (!h) return "";
        //   document.body.innerHTML = h;
        //   document.body.querySelectorAll('[data-csr-only]').forEach(el => el.remove());
        //   return document.body.innerHTML;
        // };
        // content = clean(content);
        // //const head = clean(res.head);


        if (hydrate) content = `<div id="${appId}">${appHtml}</div>`;

        if (/<slot\s*\/>/.test(html)) {
          processedHtml = html.replace(/<slot\s*\/>/, content);
        } else {
          const reBody = new RegExp('(<body[^>]*>)([\\s\\S]*?)(</body>)', 'i');
          processedHtml = html.replace(reBody, (m, s, c, e) => s + content + e);
        }
      }

      let headStyleChildren = false;
      const tags = [];
      if (allCss) {
        if (!devServer) {
          // Build mode: Use emitFile to let Vite handle the asset creation
          const hash = crypto.createHash('md5').update(allCss).digest('hex').slice(0, 8);
          const fileName = path.posix.join(viteConfig.build.assetsDir, `p${hash}e.css`);
          this.emitFile({ type: 'asset', fileName, source: allCss });
          tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href: path.posix.join(viteConfig.base, fileName) }, injectTo: 'head' });
          headStyleChildren = '' // id only, no css
        } else {
          headStyleChildren = allCss; // Dev mode: Inject as style tag
        }
      }

      if (headStyleChildren !== false) {
        tags.push({
          tag: 'style',
          attrs: { 'data-emotion': `css ${Array.from(allIds).join(' ')}` },
          children: headStyleChildren,
          injectTo: 'head'
        });
      }

      // Hybrid?
      if (hydration) {
        let src;
        if (devServer) {
          src = `/@id/${RUNTIME_PUBLIC_ID}`;
        } else {
          src = path.posix.join(viteConfig.base, this.getFileName(runtimeRefId));
        }
        tags.push({ 
          tag: 'script', 
          attrs: { type: 'module', src, 'data-comp': clientPath }, 
          injectTo: 'body' 
        });        
      }

      return { html: processedHtml, tags };
    },
  }
}
