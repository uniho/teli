// server/vite-integration.js

import potateVite from '../plugin/index-vite-jsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';
import { createServer } from 'vite';
import runtime from './vite-runtime';
import render from './vite-render';
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

  const virtualHtmlMap = new Map();
  const deleteList = new Set();

  const csrOnly = options.clientOnly || false;

  return {
    name: 'potate',
    enforce: 'pre',

    config(userConfig) {
      const config = {
        plugins: [potateVite()],
        resolve: {
          alias: {
            'react': 'potatejs',
            'react-dom': 'potatejs',
            'react/jsx-runtime': 'potatejs',
          },
        },
      };
      if (csrOnly) return config;

      const projectRoot = process.cwd();
      const root = userConfig.root || projectRoot;

      const input = {};
      const pagesDir = path.resolve(root, `src/${pageRoot}`);

      // Scan src/pages and register virtual HTML (File System Routing)
      const scanPages = (dir, baseRoute = '') => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith('_')) continue;

          const source = path.join(dir, file);
          const stat = fs.statSync(source);
          
          if (stat.isDirectory()) {
            scanPages(source, path.join(baseRoute, file));
          } else if (/\.(jsx|tsx|js|ts)$/.test(file)) {
            const component = path.join(baseRoute, file).replace(/\\/g, '/'); // Windows support
            const component_no_ext = component.replace(/\.[^.\/]+$/, '');
            
            const virtualPath = path.resolve(root, `${component_no_ext}.html`);
            input[component_no_ext] = virtualPath;
            virtualHtmlMap.set(virtualPath, component);
          }
        }
      };
      
      scanPages(pagesDir);

      return {...config, ...{
        ssr: { noExternal: ['@emotion/css', '@emotion/server', 'potatejs'] },
        optimizeDeps: { exclude: ['@emotion/css', '@emotion/server', 'potatejs'] },
        build: { rollupOptions: { input　} },
      }};
    },

    configResolved(config) { viteConfig = config; },

    configureServer(server) {
      if (csrOnly) return;

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
            // Check for /about.html
            const potentialHtmlFile = path.resolve(viteConfig.root, targetPath.slice(1) + '.html');
            if (virtualHtmlMap.has(potentialHtmlFile)) {
              targetPath += '.html';
            } else {
              // Check if this is a virtual route
              const potentialHtml = path.resolve(viteConfig.root, targetPath.slice(1), 'index.html');
              if (virtualHtmlMap.has(potentialHtml)) {
                // Redirect /about to /about/
                res.statusCode = 301;
                res.setHeader('Location', url + '/');
                res.end();
                return;
              }
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
              const html = await server.transformIndexHtml(targetPath, template, req.originalUrl);
              
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

    configurePreviewServer(server) {
      if (csrOnly) return;
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url && !path.extname(url) && !url.endsWith('/')) {
          res.statusCode = 301;
          res.setHeader('Location', url + '/');
          res.end();
          return;
        }
        next();
      });
    },
    
    buildStart() {
      if (csrOnly) return;
      if (viteConfig.command === 'build') {
        runtimeRefId = this.emitFile({
          type: 'chunk',
          id: RUNTIME_PUBLIC_ID,
          name: 'runtime'
        });
      }
    },

    resolveId(id) {
      if (csrOnly) return;
      if (id === RUNTIME_PUBLIC_ID) return RUNTIME_INTERNAL_ID;
      if (id.startsWith(ENTRY_PUBLIC_ID)) return id;
      if (id.startsWith(`${RUNNER_PUBLIC_ID}:`)) return '\0' + id;
      if (virtualHtmlMap.has(id)) return id;
    },
    
    async load(id) {
      if (csrOnly) return;

      if (id === RUNTIME_INTERNAL_ID) {
        return runtime({initName, pageRoot, appId});
      }

      if (virtualHtmlMap.has(id)) {
        return fs.readFileSync(path.resolve(viteConfig.root, 'index.html'), 'utf-8');
      }

      if (id.startsWith(`\0${RUNNER_PUBLIC_ID}:`)) {
        const name = id.substring(`\0${RUNNER_PUBLIC_ID}:`.length);
        return render({viteConfig, initName, name, renderToStringPath, pageRoot});
      }
    },

    //
    async transformIndexHtml(html, ctx) {
      if (csrOnly) return html;

      const htmlPath = ctx.filename ? path.resolve(ctx.filename) : null;
      if (!virtualHtmlMap.has(htmlPath)) return html;

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

      const component = virtualHtmlMap.get(htmlPath);
      const clientPath = `/src/${pageRoot}/${component}`;
      const { body, head, css, ids, hydrate } = await ssrRender(component);

      let newHtml = body;

      const window = new Window();
      const document = window.document;

      const removeSSR = (h) => {
        if (!h) return "";
        document.body.innerHTML = h;
        document.body.querySelectorAll('[data-client-only]').forEach(el => el.remove());
        return document.body.innerHTML;
      };
      newHtml = removeSSR(newHtml);

      if (hydrate) newHtml = `<div id="${appId}">${newHtml}</div>`;

      document.write(html);
      const container = document.getElementById(appId);
      if (container) {
        container.outerHTML = newHtml;
        newHtml = document.documentElement.outerHTML;
      } else {
        const reBody = new RegExp('(<body[^>]*>)([\\s\\S]*?)(</body>)', 'i');
        newHtml = html.replace(reBody, (match, start, inner, end) => `${start}${newHtml}${inner}${end}`);
      }

      if (head) {
        const reHead = new RegExp('(<head[^>]*>)([\\s\\S]*?)(</head>)', 'i');
        newHtml = newHtml.replace(reHead, (match, start, inner, end) => `${start}${inner}${head}${end}`);
      }

      let headStyleChildren = false;
      const tags = [];
      if (css) {
        if (!devServer) {
          // Build mode: Use emitFile to let Vite handle the asset creation
          const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
          const fileName = path.posix.join(viteConfig.build.assetsDir, `p${hash}e.css`);
          this.emitFile({ type: 'asset', fileName, source: css });
          tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href: path.posix.join(viteConfig.base, fileName) }, injectTo: 'head' });
          headStyleChildren = '' // id only, no css
        } else {
          headStyleChildren = css; // Dev mode: Inject as style tag
        }
      }

      if (headStyleChildren !== false) {
        tags.push({
          tag: 'style',
          attrs: { 'data-emotion': `css ${ids.join(' ')}` },
          children: headStyleChildren,
          injectTo: 'head'
        });
      }

      // Hybrid?
      if (hydrate) {
        const src = devServer
          ? `/@id/${RUNTIME_PUBLIC_ID}`
          : path.posix.join(viteConfig.base, this.getFileName(runtimeRefId))
        ;
        tags.push({ 
          tag: 'script', 
          attrs: { type: 'module', src, 'data-runtime-props': JSON.stringify({ page: component }) }, 
          injectTo: 'body' 
        });        
      } else {
        deleteList.add(clientPath);
      }

      return { html: newHtml, tags };
    },

fix: invalidate vite-node runner cache on hot update
    handleHotUpdate({ file, server, modules }) {
      if (csrOnly) return;
      if (runner) {
        runner.moduleCache.clear();
      }
    },

    writeBundle(options, bundle) {
      // Remove unused JS
      if (viteConfig.command !== 'build' || deleteList.size === 0) return;
      const outDir = path.resolve(viteConfig.root, viteConfig.build.outDir);
      deleteList.forEach(sourcePath => {
        const targetChunk = Object.values(bundle).find(chunk => 
          chunk.type === 'chunk' && 
          chunk.facadeModuleId && 
          chunk.facadeModuleId.replace(/\\/g, '/').endsWith(sourcePath)
        );

        if (targetChunk) {
          const fullPath = path.join(outDir, targetChunk.fileName);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`[potate] Pruned unused JS: ${path.relative(viteConfig.root, fullPath)}`);
            } catch (e) {
            }
          }
        }
      });
    },

  }
}
