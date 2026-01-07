// src/plugin/transformer.js
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

  const transformedAst = walkAndTransform(ast);

  return generate(transformedAst);
}