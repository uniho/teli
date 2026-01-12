// server/renderToString.js

import {
  isHtmlTagNode,
  isTagElementNode,
  isComponentNode,
  isPrimitiveNode,
} from '../core/brahmosNode';

import Potate from 'potatejs';

const VOID_TAGS = {
  area: 1,
  base: 1,
  br: 1,
  col: 1,
  embed: 1,
  hr: 1,
  img: 1,
  input: 1,
  link: 1,
  meta: 1,
  param: 1,
  source: 1,
  track: 1,
  wbr: 1,
};

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attributesToString(attributes) {
  if (!attributes) return '';
  let str = '';
  for (const key in attributes) {
    const value = attributes[key];
    
    if (key === 'children' ||
      key === 'key' ||
      key === 'ref' ||
      value === false ||
      value === null ||
      value === undefined) {
      continue;
    }

    const attrName = key === 'className' ? 'class' : key;

    if (value === true) {
      str += ` ${attrName}`;
    } else {
      str += ` ${attrName}="${escapeHtml(value)}"`;
    }
  }
  return str;
}

export function renderToString(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (isPrimitiveNode(node)) {
    return escapeHtml(node);
  }

  // Support for raw HTML via innerHTML property (similar to Potate Native Component)
  if (node.innerHTML) {
    return String(node.innerHTML);
  }

  if (Array.isArray(node)) {
    return node.map(renderToString).join('');
  }

  if (isComponentNode(node)) {
    const Component = node.type;
    const props = node.props || {};
    
    if ((Component.prototype && Component.prototype.isReactComponent) || Component.__isReactCompat || (typeof Component === 'object' && Component !== null)) {
      // Return empty string for React components to allow client-side rendering.
      // This enables support for Astro directives like client:load, where the
      // component is rendered entirely on the client side.
      return '';
    }

    if (typeof Component === 'function') {
      // Functional Component
      let child;

      // Setup dummy fiber for hooks support if internals are available
      const { setCurrentComponentFiber, functionalComponentInstance } = Potate.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED || {};

      if (setCurrentComponentFiber && functionalComponentInstance) {
        const nodeInstance = functionalComponentInstance(Component);
        const dummyFiber = { nodeInstance, root: { updateType: 'sync' } };
        setCurrentComponentFiber(dummyFiber);
        try {
          child = Component(props);
        } finally {
          setCurrentComponentFiber(null);
        }
      } else {
        child = Component(props);
      }

      return renderToString(child);
    }
  }

  // Handle standard VDOM elements (createElement result)
  if (isTagElementNode(node)) {
    const tag = node.type;
    const props = node.props || {};
    let html = `<${tag}${attributesToString(props)}`;

    if (VOID_TAGS[tag]) {
      html += ' />';
    } else {
      html += '>';
      if (props.children) html += renderToString(props.children);
      html += `</${tag}>`;
    }
    return html;
  }

  // Handle Tagged Template Literals (_brahmosHtml result)
  if (isHtmlTagNode(node)) {
    const { template, values } = node;
    const strings = template.strings;
    const partsMeta = template.getPartsMeta();
    
    let html = strings[0];

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const meta = partsMeta[i];

      if (meta.isAttribute) {
        html += attributesToString(value);
      } else {
        html += renderToString(value);
      }

      html += strings[i + 1];
    }

    return html;
  }

  return '';
}