// server/renderToString.js

import {
  isTagNode,
  isComponentNode,
  isPrimitiveNode,
} from '../core/brahmosNode';

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
      key === 'dangerouslySetInnerHTML' ||
      value === false ||
      value === null ||
      value === undefined) {
      continue;
    }

    if (value === true) {
      str += ` ${key}`;
    } else {
      str += ` ${key}="${escapeHtml(value)}"`;
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

  if (Array.isArray(node)) {
    return node.map(renderToString).join('');
  }

  if (isComponentNode(node)) {
    const Component = node.type;
    const props = node.props || {};
    
    if ((Component.prototype && Component.prototype.isReactComponent) || Component.__isReactCompat) {
      throw new Error('React Components are not supported in Potate Native SSR.');
    }

    if (typeof Component === 'function') {
      // Functional Component
      const child = Component(props);
      return renderToString(child);
    }
  }

  if (isTagNode(node)) {
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