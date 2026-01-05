// plugin/index-esbuild.js

import fs from 'node:fs/promises';
import { transformCode } from './transformer.js';

export default (options = {}) => ({
  name: 'potatejs',
  setup(build) {
    build.onLoad({ filter: /\.(jsx|tsx)$/ }, async (args) => {
      if (args.path.includes('node_modules')) return null;

      const source = await fs.readFile(args.path, 'utf8');
      if (!source.includes('<')) return null;

      try {
        const contents = transformCode(source);
        return {
          contents,
          loader: 'js',
        };
      } catch (err) {
        console.error(`Error parsing ${args.path}:`, err);
        return {
          errors: [{ text: err.message }],
        };
      }
    });
  },
});