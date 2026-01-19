// server/vite-render.js

import fs from 'node:fs';
import path from 'node:path';

export default ({viteConfig, name, initName, renderToStringPath, pageRoot}) => {

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
    import { createElement, render } from 'potatejs';
    import { renderToString, FUNCTIONAL_COMPONENT_NODE } from '${renderToStringPath}';
    import * as mod from '/src/${pageRoot}/${cleanName}';

    ${globalPropsCode}

    export const run = async () => {
      const globalProps = await getGlobalProps();
      const pageProps = typeof mod.main === 'function' ? await mod.main() : {};
      const props = { ...globalProps, ...pageProps };

      let head = '';
      if (mod.head) {
        const node = {
          nodeType: FUNCTIONAL_COMPONENT_NODE,
          type: mod.head,
          props: { ...props }
        };
        head = renderToString(node);
      }

      const Body = mod.default || mod.App || mod.body;
      if (!Body) {
        return { body: '', head, ids: [], css: '', hydrate: false };
      }

      const node = {
        nodeType: FUNCTIONAL_COMPONENT_NODE,
        type: Body,
        props: { ...props }
      };

      const body = renderToString(node);
      const { extractCritical } = await import('@emotion/server');

      return {
        body,
        head,
        ...extractCritical(body),
        hydrate: pageProps.hydrate || false,
      };
    }
  `;
}