// src/plugin/partUtils.js
import { t } from './babel-compat.js';
import { cleanStringForHtml, isHTMLElement } from './utils.js';

/**
 * We want to reduce the total bytes we send down the wire.
 * So convert undefined or -1 index to empty string
 */
function getSlimIndex(index) {
  return index === undefined || index === -1 ? '' : index;
}

// check if a node is valid element for templates static part
function isValidTemplateElement(node) {
  return t.isJSXText(node) || (node && node.elementCounter !== undefined);
}

/**
 * Function to ignore fragment wrapping.
 */
function getEffectiveNodePath(path) {
  let currentPath = path;
  while (currentPath.parentPath && t.isJSXFragment(currentPath.parentPath.node)) {
    currentPath = currentPath.parentPath;
  }
  return currentPath;
}

// function to get the effective children ignoring all the fragments
export function flattenFragmentChildren(parent) {
  if (!parent || !parent.children) return [];
  const children = [];

  parent.children.forEach((node) => {
    if (t.isJSXFragment(node)) {
      children.push(...flattenFragmentChildren(node));
    } else {
      children.push(node);
    }
  });

  return children;
}

/**
 * Convert parts meta to part code which can be consumed at runtime.
 */
export function getPartMetaStringLiteral(partsMeta) {
  const partsMetaWithShortKeys = partsMeta.map((part) => {
    const { isAttribute } = part;
    let combinedBooleanCode;

    if (isAttribute) {
      combinedBooleanCode = 0;
    } else {
      combinedBooleanCode = part.hasExpressionSibling ? 2 : 1;
    }

    const primaryIndex = getSlimIndex(part.refNodeIndex);
    const secondaryIndex = getSlimIndex(isAttribute ? part.attributeIndex : part.prevChildIndex);

    return `${combinedBooleanCode}|${primaryIndex}|${secondaryIndex}`;
  });
  
  // Potate's babel-compat returns a Literal for stringLiteral
  return t.stringLiteral(partsMetaWithShortKeys.join(','));
}

// function to get the parent above the fragment wrap
export function getNonFragmentParent(path) {
  const effectivePath = getEffectiveNodePath(path);
  const parentNode = effectivePath.parentPath ? effectivePath.parentPath.node : null;

  if (parentNode && !isValidTemplateElement(parentNode)) return parentNode;
  return parentNode;
}

// get the previous sibling index wrt to native elements
export function getPreviousSiblingIndex(path) {
  const { node } = path;
  const parent = getNonFragmentParent(path);
  if (!parent) return {};

  const children = flattenFragmentChildren(parent);
  if (!children.length) return {};

  const validChildren = children.filter((child) => {
    if (t.isJSXText(child)) {
      return !!cleanStringForHtml(child.value);
    } else if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)) {
      return false;
    }
    return true;
  });

  const nodeIndex = validChildren.indexOf(node);
  if (nodeIndex === -1) return {};

  const prevSibling = validChildren[nodeIndex - 1];

  /**
   * check if prev sibling is expression node.
   * If it is a expression node we will be adding an empty text node between
   */
  const hasExpressionSibling = !!prevSibling && !isValidTemplateElement(prevSibling);

  let prevChildIndex = -1;
  for (let i = 0; i <= nodeIndex; i++) {
    if (
      isValidTemplateElement(validChildren[i]) ||
      (i > 0 && !isValidTemplateElement(validChildren[i - 1]))
    ) {
      prevChildIndex += 1;
    }
  }

  return {
    prevChildIndex,
    hasExpressionSibling,
  };
}

/**
 * check if the node is native html element (static element)
 */
function isHTMLNode(node) {
  if (!t.isJSXElement(node)) return false;
  const nameNode = node.openingElement.name;
  const tagName = nameNode.name;
  return isHTMLElement(tagName) && tagName !== 'svg';
}

function isRenderableText(node) {
  return t.isJSXText(node) && !!cleanStringForHtml(node.value);
}

/**
 * check if expression nodes are wrapped around text node.
 * Uses the while loop from blueprint to handle consecutive expressions.
 */
export function isWrappedWithString(path) {
  const effectivePath = getEffectiveNodePath(path);
  const parent = getNonFragmentParent(path);
  if (!parent) return false;

  const children = flattenFragmentChildren(parent);
  let nodeIndex = children.indexOf(effectivePath.node);
  const prevNode = children[nodeIndex - 1];

  if (!(prevNode && isRenderableText(prevNode))) return false;

  let nextNode;
  while ((nextNode = children[nodeIndex + 1])) {
    if (isRenderableText(nextNode)) {
      return true;
    } else if (t.isJSXExpressionContainer(nextNode) || !isHTMLNode(nextNode)) {
      nodeIndex += 1;
    } else {
      return false;
    }
  }

  return false;
}