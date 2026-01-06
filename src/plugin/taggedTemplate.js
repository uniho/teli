// plugin/taggedTemplate.js

import { t, createPath } from './babel-compat.js';
import {
  SELF_CLOSING_TAGS,
  PROPERTY_ATTRIBUTE_MAP,
} from './constants.js';
import {
  cleanStringForHtml,
  isHTMLElement,
  needsToBeExpression,
  isEmptyLiteralWrap,
  createAttributeExpression,
} from './utils.js';
import {
  getPartMetaStringLiteral,
  getNonFragmentParent,
  isWrappedWithString,
  getPreviousSiblingIndex,
} from './partUtils.js';

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
      partMeta.attributeIndex = path.node.staticAttributes ? path.node.staticAttributes.length : 0;
    } else {
      partMeta = { ...partMeta, ...getPreviousSiblingIndex(path) };
    }

    partsMeta.push(partMeta);
    expressions.push(expression);
  }

  function recursePath(path) {
    if (!path || !path.node) return;
    const { node } = path;

    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      if (t.isJSXElement(node)) {
        const { openingElement } = node;
        const tagName = openingElement.name.name;

        if (isHTMLElement(tagName)) {
          // HTML要素 (div, a, img等) の処理
          node.elementCounter = elementCounter;
          node.staticAttributes = [];
          elementCounter += 1;
          stringPart.push(`<${tagName}`);
          openingElement.attributes.forEach((attr) => {
            if (t.isJSXSpreadAttribute(attr)) {
              const attrPath = createPath(attr, path);
              pushToExpressions(attr.argument, attrPath, true);
              stringPart.push(' ');
            } else {
              const { name, value } = attr;
              let attrName = name.name;
              if (needsToBeExpression(tagName, attrName) || (value && t.isJSXExpressionContainer(value))) {
                const expr = createAttributeExpression(name, value);
                const attrPath = createPath(attr, path);
                pushToExpressions(expr, attrPath, true);
                stringPart.push(' ');
              } else {
                attrName = PROPERTY_ATTRIBUTE_MAP[attrName] || attrName;
                let attrString = ` ${attrName}`;
                if (value) {
                  const attrValue = value.value;
                  const quote = attrValue.includes('"') ? `'` : `"`;
                  attrString = `${attrString}=${quote}${attrValue}${quote}`;
                }
                stringPart.push(attrString);
                node.staticAttributes.push(attr);
              }
            }
          });
          stringPart.push('>');
          const children = path.get('children');
          if (Array.isArray(children)) {
            children.forEach(child => recursePath(child));
          }
          if (!SELF_CLOSING_TAGS.includes(tagName)) {
            stringPart.push(`</${tagName}>`);
          }
          return;
        } else {
          // コンポーネント (App, Test等) 処理
          const propsProperties = [];
          openingElement.attributes.forEach((attr) => {
            if (t.isJSXAttribute(attr)) {
              // 通常の属性
              let attrName = attr.name.name;
              const value = attr.value;
              let valNode;
              attrName = PROPERTY_ATTRIBUTE_MAP[attrName] || attrName;
              if (!value) {
                valNode = { type: 'Literal', value: true };
              } else if (t.isJSXExpressionContainer(value)) {
                valNode = value.expression;
              } else {
                valNode = { type: 'Literal', value: value.value };
              }
              propsProperties.push({
                type: 'Property',
                key: { type: 'Identifier', name: attrName },
                value: valNode,
                kind: 'init'
              });
            } else if (t.isJSXSpreadAttribute(attr)) {
              // 【追加】スプレッド属性 ({...props} 等)
              propsProperties.push({
                type: 'SpreadElement',
                argument: attr.argument
              });
            }
          });

          let extractedText = "";
          const children = path.get('children');
          if (Array.isArray(children)) {
            children.forEach(cp => {
              if (t.isJSXText(cp.node)) {
                extractedText += cleanStringForHtml(cp.node.value);
              }
            });
          }

          const callExpr = {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'jsx' },
            arguments: [
              { type: 'Identifier', name: tagName },
              { type: 'ObjectExpression', properties: propsProperties },
              { type: 'Literal', value: extractedText }
            ]
          };

          pushToExpressions(callExpr, path, false);
          return;
        }
      }
      const children = path.get('children');
      if (Array.isArray(children)) {
        children.forEach(child => recursePath(child));
      }
    } else if (t.isJSXText(node)) {
      const cleanStr = cleanStringForHtml(node.value);
      if (cleanStr) stringPart.push(cleanStr);
    } else if (t.isJSXExpressionContainer(node) && !t.isJSXEmptyExpression(node.expression)) {
      if (isWrappedWithString(path)) {
        stringPart.push('');
      }
      pushToExpressions(node.expression, path, false);
    }
  }

  recursePath(rootPath);
  pushToStrings(true);

  return { strings, expressions, partsMeta };
}

export default function getTaggedTemplate(node) {
  const path = createPath(node);
  const { strings, expressions, partsMeta } = getLiteralParts(path);
  if (expressions.length === 1 && isEmptyLiteralWrap(strings)) {
    return expressions[0];
  }
  const metaStr = getPartMetaStringLiteral(partsMeta);

  return {
    type: 'TaggedTemplateExpression',
    tag: 'html',
    template: { 
      strings: strings,
      expressions: expressions 
    },
    meta: metaStr
  };
}