// server/vite-runtime.js

export default ({initName, pageRoot, clientModules}) => {
  const modulesCode = clientModules
    ? `const modules = { ${clientModules.join(',\n    ')} };`
    : `const modules = import.meta.glob('/src/${pageRoot}/**/*.{js,ts,jsx,tsx}');`;

  return `
  import { createElement, render } from 'potatejs'; 
  ${modulesCode}
  const initModules = import.meta.glob('/src/${initName}.{js,ts}');

  async function boot() {
    let globalProps = {};
    const initKey = Object.keys(initModules)[0];
    if (initKey) {
      const initMod = await initModules[initKey]();
      if (typeof initMod.main === 'function') globalProps = await initMod.main();
    }

    const islands = document.querySelectorAll('[data-island][data-client]');
  
    for (const el of islands) {
      const { island: rawName, client: mode } = el.dataset;
      const [name, exportName] = (rawName || '').split(':');
      const cleanName = name.startsWith('/') ? name.slice(1) : name;
      const path = Object.keys(modules).find(p => {
        const noExt = p.replace(/\\.[^/.]+$/, "");
        // Use concatenation to avoid template literal confusion
        return noExt === '/src/${pageRoot}/' + cleanName;
      });

      if (!path) {
        console.warn(\`[Potate] "${pageRoot}\${name}" not found.\`);
        continue;
      }

      const mod = await modules[path]();
      const Component = exportName ? mod[exportName] : (mod.App || mod.default);
      const localProps = typeof mod.main === 'function' ? await mod.main() : {};
      const props = { ...globalProps, ...localProps };

      const cache = document.createElement('div');
      render(createElement(Component, props), cache);
      el.replaceChildren(...Array.from(cache.childNodes));
    }
  }

  boot();
`;
}