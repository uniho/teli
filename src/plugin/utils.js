// src/plugin/utils.js
import { t } from './babel-compat.js';
import { RESERVED_ATTRIBUTES } from './constants.js';

/**
 * Method to remove newlines and extra spaces which does not render on browser
 * Logic taken from
 * https://github.com/babel/babel/blob/master/packages/babel-types/src/utils/react/cleanJSXElementLiteralChild.js
 */
export function cleanStringForHtml(rawStr) {
  const lines = rawStr.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) lastNonEmptyLine = i;
  }

  let str = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;

    let trimmedLine = line.replace(/\t/g, ' ');
    if (!isFirstLine) trimmedLine = trimmedLine.replace(/^[ ]+/, '');
    if (!isLastLine) trimmedLine = trimmedLine.replace(/[ ]+$/, '');

    if (trimmedLine) {
      if (!isLastNonEmptyLine) trimmedLine += ' ';
      str += trimmedLine;
    }
  }
  return str;
}

/**
 * Check if an element is html element or not.
 * same as what react does for jsx
 * https://github.com/babel/babel/blob/master/packages/babel-types/src/validators/react/isCompatTag.js
 */
export function isHTMLElement(tagName) {
  return !!tagName && /^[a-z]/.test(tagName);
}

export function needsToBeExpression(tagName, attrName) {
  /**
   * TODO: No need to change value attribute of a checkbox or radio button.
   */
  const tags = ['input', 'select', 'textarea'];
  const attributes = ['value', 'defaultValue', 'checked', 'defaultChecked'];
  return RESERVED_ATTRIBUTES[attrName] || (tags.includes(tagName) && attributes.includes(attrName));
}

/** Check if a template literal is an empty wrap for single expression */
export function isEmptyLiteralWrap(strings) {
  const emptyStrings = strings.filter((strNode) => !strNode.value.raw);
  return strings.length === 2 && emptyStrings.length === 2;
}

export function getPropValue(value) {
  return t.isJSXExpressionContainer(value) ? value.expression : value;
}

/**
 * Get the attribute name from a JSXAttribute name node
 */
export function getAttributeName(nameNode) {
  if (nameNode.type === 'JSXNamespacedName') {
    return `${nameNode.namespace.name}:${nameNode.name.name}`;
  }
  return nameNode.name;
}

export function createAttributeProperty(name, value) {
  value = value || t.booleanLiteral(true); // if value is not present it means the prop is of boolean type with true value

  const attrNameStr = getAttributeName(name);
  const propName = attrNameStr.match('-|:')
    ? t.stringLiteral(attrNameStr)
    : t.identifier(attrNameStr);

  const propValue = getPropValue(value);
  
  const isShorthand = propName.type === 'Identifier' && 
                      propValue.type === 'Identifier' && 
                      propName.name === propValue.name;
  
  // Create physical Property object via compat layer
  return t.objectProperty(propName, propValue, false, isShorthand);
}

export function createAttributeExpression(name, value) {
  return t.objectExpression([createAttributeProperty(name, value)]);
}

/**
 * Inject Brahmos/Potate runtime imports
 */
export function addBrahmosRuntime(programPath) {
  if (programPath.node.hasBrahmosRuntime) return;

  const jsxImport = t.importSpecifier(t.identifier('_brahmosJSX'), t.identifier('jsx'));
  const htmlImport = t.importSpecifier(t.identifier('_brahmosHtml'), t.identifier('html'));
  const importStatement = t.importDeclaration([jsxImport, htmlImport], t.stringLiteral('potatejs'));

  programPath.node.body.unshift(importStatement);
  programPath.node.hasBrahmosRuntime = true;
}

/**
 * Maps the result of getTaggedTemplate into a valid AST node.
 * Note: Ensured that 'astring' correctly recognizes TemplateElement content
 * by guaranteeing value: { raw, cooked } structure and building (html`...`)("meta") format.
 */
export function transformToAstNode(res) {
  if (typeof res === 'string') {
    return { type: 'Literal', value: res, raw: `'${res}'` };
  }
  
  if (res.type === 'TaggedTemplateExpression') {
    return {
      type: 'CallExpression',
      callee: {
        type: 'TaggedTemplateExpression',
        tag: { type: 'Identifier', name: res.tag },
        quasi: {
          type: 'TemplateLiteral',
          quasis: res.template.strings.map(s => ({
            type: 'TemplateElement',
            value: {
              raw: s.value.raw || '',
              cooked: s.value.cooked || ''
            },
            tail: s.tail
          })),
          expressions: res.template.expressions
        }
      },
      arguments: [res.meta]
    };
  }
  return res;
}