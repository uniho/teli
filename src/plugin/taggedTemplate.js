// src/plugin/taggedTemplate.js

import { t, createPath } from './babel-compat.js';
import {
  SELF_CLOSING_TAGS,
  PROPERTY_ATTRIBUTE_MAP,
  BRAHMOS_PLACEHOLDER
} from './constants.js';
import {
  cleanStringForHtml,
  isHTMLElement,
  needsToBeExpression,
  isEmptyLiteralWrap,
  createAttributeExpression,
  transformToAstNode,
  createAttributeProperty,
} from './utils.js';
import {
  getPartMetaStringLiteral,
  getNonFragmentParent,
  isWrappedWithString,
  getPreviousSiblingIndex,
} from './partUtils.js';
import { isSvgHasDynamicPart } from './svg.js';

/**
 * Physical conversion of JSX name nodes to JS nodes.
 */
function jsxToObject(node) {
  if (t.isJSXIdentifier(node)) {
    return t.identifier(node.name);
  } else if (t.isJSXMemberExpression(node)) {
    /**
     * recursively change object property of JSXMemberExpression
     * to MemberExpression
     */
    const objectNode = jsxToObject(node.object);
    const property = jsxToObject(node.property);
    return t.memberExpression(objectNode, property);
  }
}

/**
 * Subroutine: Determine if a JSXElement should be handled as a Component/Keyed call.
 */
function needsToBeJSXCall(path) {
  const { node } = path;
  if (node.type === 'JSXFragment') return false; // Fragments themselves are not calls

  const nameNode = node.openingElement.name;
  if (nameNode.type === 'JSXMemberExpression') return true;
  
  const tagName = nameNode.name;
  if (!isHTMLElement(tagName)) return true;

  if (tagName === 'svg' && isSvgHasDynamicPart(path)) return true;

  return node.openingElement.attributes.some(attr => 
    attr.type === 'JSXAttribute' && attr.name.name === 'key'
  );
}

/**
 * Subroutine: Extract value from JSX attribute value node.
 */
function getAttrValue(value) {
  if (!value) return { type: 'Literal', value: true };
  return value.type === 'JSXExpressionContainer' ? value.expression : { type: 'Literal', value: value.value };
}

function getLiteralParts(rootPath) {
  const strings = [];
  const expressions = [];
  const partsMeta = [];
  let stringPart = [];
  let elementCounter = 0;

  function pushToStrings(tail = false) {
    const string = stringPart.join('');
    strings.push({
      type: 'TemplateElement',
      value: { raw: string, cooked: string },
      tail
    });
    stringPart = [];
  }

  function pushToExpressions(expression, path, isAttribute) {
    pushToStrings();
    const parent = getNonFragmentParent(path);
    const refNodeIndex = isAttribute ? elementCounter - 1 : (parent ? parent.elementCounter : 0);

    let partMeta = { refNodeIndex, isAttribute };
    if (isAttribute) {
      const elementNode = path.parentPath.node;
      partMeta.attributeIndex = elementNode.staticAttributes ? elementNode.staticAttributes.length : 0;
    } else {
      partMeta = { ...partMeta, ...getPreviousSiblingIndex(path) };
    }

    partsMeta.push(partMeta);
    expressions.push(expression);
    return expression;
  }

  function pushAttributeToExpressions(expression, lastExpression, path) {
    if (lastExpression && lastExpression.type === 'ObjectExpression') {
      const props = expression.type === 'ObjectExpression' 
        ? expression.properties 
        : [{ type: 'SpreadElement', argument: expression }];
      lastExpression.properties.push(...props);
      return lastExpression;
    }
    pushToExpressions(expression, path, true);
    stringPart.push(' ');
    return expression;
  }

  function recursePath(path) {
    if (!path) return;
    if (Array.isArray(path)) {
      path.forEach(recursePath);
      return;
    }
    if (!path.node) return;
    const { node } = path;

    // Handle both JSXElement and JSXFragment (shorthand <></>)
    if (node.type === 'JSXElement') {
      const { openingElement } = node;
      const nameNode = openingElement.name;

      if (!needsToBeJSXCall(path)) {
        const tagName = nameNode.name;
        node.elementCounter = elementCounter;
        node.staticAttributes = [];
        elementCounter += 1;
        stringPart.push(`<${tagName} `);

        let lastExpression = null;
        openingElement.attributes.forEach((attr) => {
          if (attr.type === 'JSXSpreadAttribute') {
            lastExpression = pushAttributeToExpressions(attr.argument, lastExpression, createPath(attr, path));
          } else {
            const { name, value } = attr;
            if (needsToBeExpression(tagName, name.name) || (value && value.type === 'JSXExpressionContainer')) {
              const expr = createAttributeExpression(name, value);
              lastExpression = pushAttributeToExpressions(expr, lastExpression, createPath(attr, path));
            } else {
              const attrName = PROPERTY_ATTRIBUTE_MAP[name.name] || name.name;
              let attrString = ` ${attrName}`;
              if (value) {
                const attrValue = value.value;
                const quote = attrValue.includes('"') ? "'" : '"';
                attrString = `${attrString}=${quote}${attrValue}${quote}`;
              }
              stringPart.push(attrString);
              node.staticAttributes.push(attr);
              lastExpression = null;
            }
          }
        });

        stringPart.push('>');
        path.get('children').forEach(recursePath);
        if (!SELF_CLOSING_TAGS.includes(tagName)) stringPart.push(`</${tagName}>`);
      } else {
        const componentName = isHTMLElement(nameNode.name)
          ? t.stringLiteral(nameNode.name)
          : jsxToObject(nameNode);

        // add props
        const propsProperties = [];
        let keyValue = null;

        openingElement.attributes.forEach((attr) => {
          if (attr.type === 'JSXAttribute') {
            if (attr.name.name === 'key') {
              keyValue = getAttrValue(attr.value);
            } else {
              propsProperties.push(createAttributeProperty(attr.name, attr.value));
            }
          } else if (attr.type === 'JSXSpreadAttribute') {
            propsProperties.push(t.spreadElement(attr.argument));
          }
        });

        const jsxArguments = [componentName, t.objectExpression(propsProperties)];

        // if the node has children add it in props
        const childrenPaths = path.get('children');
        if (childrenPaths && childrenPaths.length) {
          propsProperties.push(
            createAttributeProperty(
              t.identifier('children'),
              transformToAstNode(getTaggedTemplate(childrenPaths))
            )
          );
        }

        // add key if present on arguments
        if (keyValue) {
          jsxArguments.push(keyValue);
        }

        const brahmosJSXFunction = t.identifier('_brahmosJSX');
        const expression = t.callExpression(brahmosJSXFunction, jsxArguments);

        pushToExpressions(expression, path, false);
      }
    } else if (node.type === 'JSXFragment') {
      // Explicitly handle Fragment children
      path.get('children').forEach(recursePath);
    } else if (node.type === 'JSXText') {
      const cleanStr = cleanStringForHtml(node.value);
      if (cleanStr) stringPart.push(cleanStr);
    } else if (node.type === 'JSXExpressionContainer' && node.expression.type !== 'JSXEmptyExpression') {
      if (isWrappedWithString(path)) {
        stringPart.push(`<!--${BRAHMOS_PLACEHOLDER}-->`);
      }
      pushToExpressions(node.expression, path, false);
    }
  }

  recursePath(rootPath);
  pushToStrings(true);
  return { strings, expressions, partsMeta };
}

function getSingleTextChild(path) {
  let jsxText;
  if (Array.isArray(path) && path.length === 1 && path[0].node.type === 'JSXText') {
    jsxText = path[0].node;
  } else if (
    path.node &&
    path.node.type === 'JSXFragment' &&
    path.node.children.length === 1 &&
    path.node.children[0].type === 'JSXText'
  ) {
    jsxText = path.node.children[0];
  }
  return jsxText && { type: 'Literal', value: cleanStringForHtml(jsxText.value) };
}

export default function getTaggedTemplate(nodeOrPath) {
  let path;
  if (Array.isArray(nodeOrPath) || (nodeOrPath.node && nodeOrPath.get)) {
    path = nodeOrPath;
  } else {
    path = createPath(nodeOrPath);
  }

  const singleTextChild = getSingleTextChild(path);
  if (singleTextChild) return singleTextChild;

  const { strings, expressions, partsMeta } = getLiteralParts(path);
  if (expressions.length === 1 && isEmptyLiteralWrap(strings)) return expressions[0];

  return {
    type: 'TaggedTemplateExpression',
    tag: '_brahmosHtml',
    template: {
      type: 'TemplateLiteral',
      strings: strings,
      expressions: expressions
    },
    meta: getPartMetaStringLiteral(partsMeta)
  };
}