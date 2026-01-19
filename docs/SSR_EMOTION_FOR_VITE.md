
# SSR [Emotion](https://emotion.sh/docs/@emotion/css) for Vite

A natural and powerful Zero-Runtime CSS-in-JS solution, seamlessly integrated with Vite.

## **Server Side Rendering / Static Site Generation Styling (SSR / SSG Only)**

SSR Emotion for Vite might be the new go-to choice for those who haven't found their favorite SSG yet!

* You can build SEO-friendly MPA (Multi-Page Application) sites just by preparing a single `index.html` as a skeleton.
* HTML can be constructed using JSX.
* CSS can be styled using [Emotion](https://emotion.sh/docs/@emotion/css).
* You can also specify the content of the `HEAD` tags.

### Skeleton `index.html`

```index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>potate</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>

```

The `<div id="app"></div>` part will be replaced via SSR.

> **Note:**
> * The location of `index.html` can be changed in the Vite `root` settings. Please note that the default is the project root, not the `src` directory.
> * If you need multiple "islands," they should be implemented on the CSR side (described later).


### Page Structure

Create your site structure under `src/pages`.

Example:
src/pages/index.jsx
src/pages/_part.jsx
src/pages/about.jsx
src/pages/contents/index.jsx
src/pages/_lib/util.js

Files or directories starting with `_` will not be processed as page sources.

> **Note:** Of course, you can use `.tsx`, `.js`, or `.ts` extensions as well.


### JSX

You don't need to learn any special properties or complex setups. It just works with the standard `class` attribute and the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css). It feels completely natural, even in SSR/SSG.

While you can use [`css()`](https://emotion.sh/docs/@emotion/css) directly, you can also create reusable functions like `flexCol()` (which we call ["The Patterns"](/docs/SSR_EMOTION_FOR_ASTRO.md#-the-patterns)).

```jsx
// src/pages/index.jsx

import { css } from '@emotion/css'

export const head = props => {
  return (<>
    <title>Potate, potato, potahto</title> 
  </>)
}

export default props => (
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

### 💎 The Result

* **Zero Runtime by default:** No `Emotion` library is shipped to the browser. It delivers a pure Zero-JS experience.
* **Familiar DX:** Use the full expressive power of the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css) that you already know.
* **Static by Default:** Styles are automatically extracted into static CSS during the Astro build process.
* **Performance:** No hydration overhead for styles and no Flash of Unstyled Content (FOUC).


## 🌗 Hybrid Styling (SSR + CSR)

Hybrid mode is also easy.

### How it works

1. At Build Time (SSR): Potate executes your `css()` calls and extracts the initial styles into a static CSS file. This ensures your component looks perfect even before JavaScript loads.

2. At Runtime (Hydration): Once the Island hydrates in the browser, the Emotion runtime takes over.

### Why this is powerful

Because the Emotion runtime remains active inside Islands, you can use standard React/Preact patterns to handle dynamic styles without any special "Potate-specific" APIs.

### Example: Hydration-aware Styling

You can easily change styles when the component "wakes up" in the browser:

```jsx
// src/pages/index.jsx

export const main = props => ({ hydrate: true }) // Just this line enables hydration!

export const head = props => {
  return (<>
    <title>Potate, potato, potahto</title> 
  </>)
}

export default props => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true); // Triggers once JS is active
  }, []);

  return (
    <div class={css({
      // Red on server (SEO/LCP friendly), Blue once interactive!
      background: isLoaded ? 'blue' : 'red',
      transition: 'background 0.5s',
      padding: '20px'
    })}>
      {isLoaded ? 'I am Interactive!' : 'I am Static HTML'}
    </div>
  );
};

```

## **Client Side Styling (CSR Only)**

"Client Side Styling Only" is just a standard Web App created with Vite, isn't it? You can use Emotion normally (right?). There are three types of CSR Only usage.

### When you want to make only specific nodes CSR Only

Nodes with the `data-client-only` attribute and their children will not be SSR'd.

```jsx
const MyComponent = props => (
  const [color, setColor] = useState('blue');

  useEffect(() => {
    setColor('red');
  }, []);

  <div class={css({color})} data-client-only>
    I am CSR only! NO SSR!
  </div>
)

```

### AWhen you want to make the entire App CSR Only

Simply specify the `data-client-only` attribute at the root.

```jsx

export const main = props => ({hydrate: true})

export default props => (
  const [color, setColor] = useState('blue');

  useEffect(() => {
    setColor('red');
  }, []);

  <div class={css({color})} data-client-only>
    Bye, SSR EMOTION, Hello, CSR EMOTION!
  </div>
)

```

### Using pure Vite-standard CSR Only

By specifying clientOnly: true in the Potate plugin, it functions as a standard Vite CSR-only application.

``` js
import { defineConfig } from 'vite'
import potate from 'potatejs/vite'

export default defineConfig({
  plugins: [potate()],
})

```

```html
  <!-- index.html -->

  <body>
    <div id="app"></div>
    <script type="module" src="/src/main"></script>
  </body>

```

```jsx
// src/main.jsx 

import Potate from 'potatejs'
import { css } from '@emotion/css'

const App = () => {
  const [color, setColor] = useState('blue');

  useEffect(() => {
    setColor('red');
  }, []);

  return (
    <div class={css({color})}>
      Hello, CSR EMOTION! It is just pure Vite, right?
    </div>
  );
};

//
const root = Potate.createRoot(document.querySelector('#app'))
root.render(<App/>)

```
