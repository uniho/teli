import { isHTMLElement } from './utils.js';

/**
 * Check if svg has a dynamic part either as attribute or node part
 */
export function isSvgHasDynamicPart(part) {
  let hasDynamicPart = false;

  function walk(node) {
    if (hasDynamicPart) return;
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXSpreadAttribute') {
      hasDynamicPart = true;
      return;
    }

    if (node.type === 'JSXExpressionContainer') {
      hasDynamicPart = true;
      return;
    }

    if (node.type === 'JSXElement') {
      const nameNode = node.openingElement.name;
      if (nameNode.type === 'JSXMemberExpression') {
        hasDynamicPart = true;
        return;
      }
      const tagName = nameNode.name;
      if (!isHTMLElement(tagName)) {
        hasDynamicPart = true;
        return;
      }
    }

    for (const key in node) {
      if (key === 'parent' || key === 'parentPath' || key === 'loc') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        val.forEach(walk);
      } else if (val && typeof val === 'object') {
        walk(val);
      }
    }
  }

  walk(part.node);

  return hasDynamicPart;
}
