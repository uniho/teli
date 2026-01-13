// server/astro-client.js

import { createElement, render } from 'potatejs';

export default (element) => {
  return (Component, props, slots, { client }) => {
    // Create an in-memory container (not attached to the DOM).
    const cache = document.createElement('div');

    // Render synchronously into the cache.
    // 'render' (unlike createRoot) is synchronous, so the DOM is ready immediately after this call.
    render(createElement(Component, props), cache);

    // Swap the SSR content with the newly rendered CSR content instantly.
    element.replaceChildren(...Array.from(cache.childNodes));
  }
}
