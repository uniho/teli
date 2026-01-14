// server/vite-integration.js

import potateVite from '../plugin/index-vite-jsx';

export default function(options = {}) {
  return {
    name: 'potate',
    config() {
      return {
        plugins: [potateVite()],
        resolve: {
          alias: {
            'react': 'potatejs',
            'react-dom': 'potatejs',
            'react/jsx-runtime': 'potatejs',
          },
        },
      };
    },
  }
}
