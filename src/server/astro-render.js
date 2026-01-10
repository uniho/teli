// astro-render.js

import { renderToString } from './renderToString';
import { FUNCTIONAL_COMPONENT_NODE } from '../core/brahmosNode';

export default {
  name: 'potate',
  check(Component) {
    // Treat Potate components as functional components
    return typeof Component === 'function';
  },
  renderToStaticMarkup(Component, props, slots) {
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

    return {
      html: renderToString(node),
    };
  },
};