// astro-render.js

import { renderToString } from './renderToString';
import { FUNCTIONAL_COMPONENT_NODE } from '../core/brahmosNode';
import { Window } from 'happy-dom';

export default {
  name: 'potate',
  check(Component) {
    // Treat Potate components as functional components
    return typeof Component === 'function';
  },
  async renderToStaticMarkup(Component, props, slots) {
    // Polyfill for SSR
    if (!global.window) {
      const window = new Window();
      global.window = window;
      global.document = window.document;
      global.HTMLElement = window.HTMLElement;
    }

    // Pass slots (HTML strings) as objects with innerHTML
    const children = {};
    if (slots) {
      for (const [key, value] of Object.entries(slots)) {
        children[key] = { innerHTML: value };
      }
    }

    // Create Potate node structure
    const node = {
      nodeType: FUNCTIONAL_COMPONENT_NODE,
      type: Component,
      props: {
        ...props,
        children: children.default, // Pass default slot as children
      },
    };

    const html = renderToString(node);

    // Dynamic import to avoid bundling issues with Node.js built-ins in esbuild
    const emotionServer = '@emotion/server';
    const { extractCritical } = await import(emotionServer);
    const { ids, css } = extractCritical(html);

    return {
      html: `<style data-emotion="css ${ids.join(' ')}">${css}</style>${html}`,
    };
  },
};