# SSR Emotion for Astro

A natural and powerful Zero-Runtime CSS-in-JS solution, seamlessly integrated with Astro.

## 🚀 Why it matters

I used to think there wasn't much point in writing static content in JSX instead of just using `.astro` files. It seemed like standard `.astro` was more than enough for most cases.

However, I've realized one major advantage: "SSR EMOTION". While other frameworks often struggle with complex configurations to get Emotion working with SSR, Potate bridges this gap naturally. It allows you to use the power of CSS-in-JS without any of the typical performance trade-offs.

## 💎 The Result

* **Zero Runtime:** No Emotion library is shipped to the browser. It delivers a pure Zero-JS experience.
* **Familiar DX:** Use the full expressive power of the Emotion `css()` function that you already know.
* **Static by Default:** Styles are automatically extracted into static CSS during the Astro build process.
* **Performance:** No hydration overhead for styles and no Flash of Unstyled Content (FOUC).

## 🛠 How it looks

In Potate, you don't need to learn any special properties or complex setups. It just works with the standard `class` attribute and the Emotion `css()` function. It feels completely natural, even in Astro's **"No directive" (Server Only)** mode.

While you can use `css()` directly, you can also create reusable functions like `flexCol()` (which we call **"Patterns"**).

```jsx
import { css } from '@emotion/css'

export const MyComponent = () => (
  <div class={flexCol({ 
    color: 'hotpink',
    '&:hover': { color: 'deeppink' }
  })}>
    Hello, SSR EMOTION!
  </div>
)

const flexCol = (...args) => css({
  display: 'flex',
  flexDirection: 'column',
}, ...args)

```

## 🛠 Patterns Example

### LinkOverlay

You can easily implement the LinkOverlay pattern. This expands a link's clickable area to its nearest parent with `position: relative`.

```jsx
import { css } from '@emotion/css';

const linkOverlay = (...args) => css({
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
}, ...args);

export const Card = () => (
  // The parent must have position: relative
  <div class={css({ position: 'relative', border: '1px solid #ccc', padding: '1rem' })}>
    <img src="https://via.placeholder.com/150" alt="placeholder" />
    <h3>Card Title</h3>
    <a href="/details" class={linkOverlay()}>
      View more
    </a>
  </div>
);

```
