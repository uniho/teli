// plugin/transformer.js

import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import { generate } from 'astring';
import walkAndTransform from './walkAndTransform.js';

const parser = acorn.Parser.extend(jsx());

export function transformCode(source) {
  const ast = parser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });

  const LIBRARY_NAME = 'potatejs';
  const IMPORT_NAME = 'html';

  // 1. Check if 'html' is already imported
  let isHtmlImported = false;
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration' && node.source.value === LIBRARY_NAME) {
      if (node.specifiers.some(s => s.imported && s.imported.name === IMPORT_NAME)) {
        isHtmlImported = true;
        break;
      }
    }
  }

  // 2. Transform JSX
  const transformedAst = walkAndTransform(ast);

  // 3. Check usage
  const needsHtml = JSON.stringify(transformedAst).includes(`"name":"${IMPORT_NAME}"`);

  // 4. Inject ImportDeclaration if needed
  if (needsHtml && !isHtmlImported) {
    transformedAst.body.unshift({
      type: 'ImportDeclaration',
      specifiers: [
        {
          type: 'ImportSpecifier',
          imported: { type: 'Identifier', name: IMPORT_NAME },
          local: { type: 'Identifier', name: IMPORT_NAME }
        }
      ],
      source: {
        type: 'Literal',
        value: LIBRARY_NAME,
        raw: `'${LIBRARY_NAME}'`
      }
    });
  }

  return generate(transformedAst);
}