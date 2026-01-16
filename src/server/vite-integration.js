// server/vite-integration.js

import potateVite from '../plugin/index-vite-jsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';
import { createServer } from 'vite';
import getViteRuntime from './vite-runtime.js';

const pageRoot = 'pages';
const initName = '_init';

export default function(options = {}) {

  let viteConfig, devServer, runner, nodeServer, runtimeRefId

  const RUNTIME_PUBLIC_ID = 'virtual:potate-runtime';
  const RUNTIME_INTERNAL_ID = '\0' + RUNTIME_PUBLIC_ID;

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
      if (id.startsWith(`${RUNNER_PUBLIC_ID}:`)) return '\0' + id;
      if (virtualHtmlMap.has(id)) {
        return id;
      }
    },
    
    load(id) {
      if (id === RUNTIME_INTERNAL_ID) {
        const clientModules = [];
        const pagesDir = path.resolve(viteConfig.root, `src/${pageRoot}`);

        const scanDirForClientModules = (dir, base = '') => {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir, { withFileTypes: true });

          for (const file of files) {
            const filePath = path.join(dir, file.name);

            if (file.isDirectory()) {
              if (file.name.startsWith('_')) continue;
              scanDirForClientModules(filePath, path.join(base, file.name));
            } else if (/\.(jsx|tsx|js|ts)$/.test(file.name)) {
              if (file.name.startsWith('_')) continue;
              
              const relativePath = path.join(base, file.name).replace(/\\/g, '/');
              const importPath = `/src/${pageRoot}/${relativePath}`;
              clientModules.push(`'${importPath}': () => import('${importPath}')`);
            }
          }
        };
        scanDirForClientModules(pagesDir);
        return getViteRuntime({ initName, pageRoot, clientModules });
      }

      if (virtualHtmlMap.has(id)) {
        const templatePath = path.resolve(viteConfig.root, 'index.html');
        const html = fs.readFileSync(templatePath, 'utf-8');
        return `<!--POTATE_ID:${id}-->\n${html}`;
      }

      if (id.startsWith(`\0${RUNNER_PUBLIC_ID}:`)) {
        const name = id.substring(`\0${RUNNER_PUBLIC_ID}:`.length);
        const cleanName = name.startsWith('/') ? name.slice(1) : name;
        
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
          import * as mod from '/src/${pageRoot}/${cleanName}';
          
          export const client = mod.client;

          ${globalPropsCode}

          export const run = async (slot) => {
            const globalProps = await getGlobalProps();
            const pageProps = typeof mod.main === 'function' ? await mod.main() : {};
            const props = { ...globalProps, ...pageProps };

            if (mod.body) {
              const Layout = mod.body;
              const node = {
                nodeType: FUNCTIONAL_COMPONENT_NODE,
                type: Layout,
                props: { ...props }
              };
              let html = renderToString(node);
              
              const nestedIslandRegex = /<([a-z0-9]+)([^>]*?)\\s+data-island(?:="([^"]*)")?([^>]*?)>([\\s\\S]*?)<\\/\\1>/gi;
              const matches = Array.from(html.matchAll(nestedIslandRegex));
              let newHtml = '';
              let lastIndex = 0;
              
              for (const match of matches) {
                const [fullTag, tagName, attrsBefore, exportNameRaw, attrsAfter, content] = match;
                newHtml += html.substring(lastIndex, match.index);
                const exportName = exportNameRaw || 'default';
                const Component = exportName === 'default' ? (mod.App || mod.default) : mod[exportName];
                if (Component) {
                  const compNode = { nodeType: FUNCTIONAL_COMPONENT_NODE, type: Component, props: { ...props, children: content ? { innerHTML: content } : undefined } };
                  const compHtml = renderToString(compNode);
                  const hasClient = /data-client/.test(attrsBefore) || /data-client/.test(attrsAfter);
                  const newIslandValue = exportName === 'default' ? '${name}' : '${name}:' + exportName;
                  const islandAttr = hasClient ? \` data-island="\${newIslandValue}"\` : '';
                  newHtml += \`<\${tagName}\${attrsBefore}\${islandAttr}\${attrsAfter}>\${compHtml}</\${tagName}>\`;
                } else {
                  newHtml += fullTag;
                }
                lastIndex = match.index + fullTag.length;
              }
              newHtml += html.substring(lastIndex);
              const { extractCritical } = await import('@emotion/server');
              return { html: newHtml, ...extractCritical(newHtml) };
            } else {
              // Fallback: Treat default export as main content if no island export exists
              // This allows simple pages to work with just export default
              const Component = mod.App || mod.default;
              if (Component) {
                const node = { nodeType: FUNCTIONAL_COMPONENT_NODE, type: Component, props: { ...props, children: slot ? { innerHTML: slot } : undefined } };
                const html = renderToString(node);
                const { extractCritical } = await import('@emotion/server');
                return { html, ...extractCritical(html) };
              }
              return { html: slot || '', ids: [], css: '' };
            }
          };
        `;
      }
    },

    //
    async transformIndexHtml(html, ctx) {
      let server = ctx?.server;

      // This function will be used in both dev and build
      const ssrRender = async (componentName, slot) => {
        if (devServer) {
          // Dev mode: Reuse the existing runner after clearing ALL caches.
          // This is critical to prevent state (like hooks) from leaking between requests.
          runner.moduleCache.clear();
          nodeServer.moduleCache.clear();

          const mod = await runner.executeId(`${RUNNER_PUBLIC_ID}:${componentName}`);
          const result = await mod.run(slot);
          return { ...result, client: mod.client };
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
            const result = await mod.run(slot);
            return { ...result, client: mod.client };
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

      // Mask comments to avoid matching islands inside them
      const comments = [];
      let processedHtml = html.replace(/<!--[\s\S]*?-->/g, (m) => {
        comments.push(m);
        return `<!--POTATE_COMMENT_${comments.length - 1}-->`;
      });

      let allIds = new Set();
      let allCss = "";

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
            componentPath = path.relative(path.join(viteConfig.root, 'src', pageRoot), basePath + ext).replace(/\\/g, '/').replace(/\.[^/.]+$/, "");
            break;
          }
        }
        if (componentPath) break;
      }

      if (componentPath) {
        console.log(`[potate] Rendering ${ctx.path} -> ${componentPath}`);
        // Full Body Injection Mode
        const name = componentPath;
        const { html: appHtml, css, ids, client } = await ssrRender(name);
        
        ids?.forEach(id => allIds.add(id));
        if (css) allCss += css;

        let bodyContent = appHtml;
        if (client) {
          bodyContent = `<div data-island="${name}" data-client="${client}">${appHtml}</div>`;
        }
        
        processedHtml = processedHtml.replace(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i, (match, start, content, end) => {
          return `${start}${bodyContent}${end}`;
        });
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

      // Restore comments
      processedHtml = processedHtml.replace(/<!--POTATE_COMMENT_(\d+)-->/g, (_, i) => comments[i]);

      // Hybrid?
      if (/\sdata-client(=|[\s>])/.test(processedHtml)) {

        if (headStyleChildren !== false) {
          tags.push({
            tag: 'style',
            attrs: { 'data-emotion': `css ${Array.from(allIds).join(' ')}` },
            children: headStyleChildren,
            injectTo: 'head'
          });
        }

        let src;
        if (ctx?.server) {
          src = `/@id/${RUNTIME_PUBLIC_ID}`;
        } else if (runtimeRefId) {
          try {
            src = path.posix.join(viteConfig.base, this.getFileName(runtimeRefId));
          } catch (e) {}
        }

        if (src) {
          tags.push({
            tag: 'script',
            attrs: { type: 'module', src },
            injectTo: 'body'
          });
        }
      }

      return { html: processedHtml, tags };
    },
  }
}
