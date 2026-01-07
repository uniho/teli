// src/plugin/babel-compat.js

export const t = {
  // Matches physical TemplateLiteral structure
  templateLiteral(strings, expressions) {
    return {
      type: 'TemplateLiteral',
      strings,
      expressions,
    };
  },

  // Matches physical TemplateElement structure
  templateElement(value, tail) {
    return {
      type: 'TemplateElement',
      value: {
        raw: value.raw,
        cooked: value.cooked,
      },
      tail,
    };
  },

  // Matches physical TaggedTemplateExpression structure
  taggedTemplateExpression(tag, template) {
    return {
      type: 'TaggedTemplateExpression',
      tag,
      template,
    };
  },

  identifier(name) {
    return { type: 'Identifier', name };
  },

  // In Potate engine, these are just "Literal"
  stringLiteral(value) {
    return { type: 'Literal', value };
  },

  booleanLiteral(value) {
    return { type: 'Literal', value };
  },

  importSpecifier(local, imported) {
    return { type: 'ImportSpecifier', local, imported };
  },

  importDeclaration(specifiers, source) {
    return { type: 'ImportDeclaration', specifiers, source };
  },

  callExpression(callee, args) {
    return { type: 'CallExpression', callee, arguments: args };
  },

  memberExpression(object, property) {
    return { type: 'MemberExpression', object, property, computed: false };
  },

  objectExpression(properties) {
    return { type: 'ObjectExpression', properties };
  },

  objectProperty(key, value, computed = false, shorthand = false) {
    return { type: 'Property', key, value, kind: 'init', computed, shorthand };
  },

  spreadElement(argument) {
    return { type: 'SpreadElement', argument };
  },

  arrayExpression(elements) {
    return { type: 'ArrayExpression', elements };
  },

  // Type checkers (Physical check)
  isJSXElement(node) { return node && node.type === 'JSXElement'; },
  isJSXFragment(node) { return node && node.type === 'JSXFragment'; },
  isJSXText(node) { return node && node.type === 'JSXText'; },
  isJSXExpressionContainer(node) { return node && node.type === 'JSXExpressionContainer'; },
  isJSXEmptyExpression(node) { return node && node.type === 'JSXEmptyExpression'; },
  isJSXAttribute(node) { return node && node.type === 'JSXAttribute'; },
  isJSXSpreadAttribute(node) { return node && node.type === 'JSXSpreadAttribute'; },
};

export function createPath(node, parentPath = null) {
  return {
    node,
    parentPath,
    get(key) {
      const value = this.node[key];
      if (Array.isArray(value)) {
        return value.map((v) => createPath(v, this));
      }
      return value ? createPath(value, this) : null;
    },
  };
}