// plugin/walkAndTransform.js

import getTaggedTemplate from './taggedTemplate.js';
import { addBrahmosRuntime, transformToAstNode } from './utils.js';
import { createPath } from './babel-compat.js';

/**
 * Recursively walk through the AST and transform JSX nodes 
 */
export default function walkAndTransform(node) {
  if (!node || typeof node !== 'object') return node;

  if (node.type === 'Program') {
    addBrahmosRuntime(createPath(node));
  }

  if (Array.isArray(node)) {
    return node.map(walkAndTransform);
  }

  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    const result = getTaggedTemplate(node);
    const astNode = transformToAstNode(result);
    return walkAndTransform(astNode);
  }

  const newNode = { ...node };
  for (const key in newNode) {
    if (Object.prototype.hasOwnProperty.call(newNode, key)) {
      newNode[key] = walkAndTransform(newNode[key]);
    }
  }
  return newNode;
}
