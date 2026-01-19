// server/vite-runtime.js

export default ({initName, pageRoot, appId}) => {
  return `
    import { createElement, render } from 'potatejs';
    const pages = import.meta.glob('/src/${pageRoot}/**/*.{jsx,tsx,js,ts}');
    const initModules = import.meta.glob('/src/${initName}.{js,ts}', { eager: true });

    async function start() {
      let mod;
      {
        const self = document.querySelector('script[data-runtime-props]');
        const props = JSON.parse(self?.getAttribute('data-runtime-props'));
        const path = '/src/${pageRoot}/' + props.page;
        if (!pages[path]) return;
        mod = await pages[path]();
      }

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