# SSR Emotion for Astro

A natural and powerful Zero-Runtime CSS-in-JS solution, seamlessly integrated with Astro.

## 🚀 Why it matters

I used to think there wasn't much point in writing static content in JSX instead of just using `.astro` files. It seemed like standard `.astro` was more than enough for most cases.

However, I've realized one major advantage: "SSR EMOTION". While other frameworks often struggle with complex configurations to get Emotion working with SSR, Potate bridges this gap naturally. It allows you to use the power of CSS-in-JS without any of the typical performance trade-offs.

## 💎 The Result

* **Zero Runtime by default:** No `Emotion` library is shipped to the browser. It delivers a pure Zero-JS experience.
* **Familiar DX:** Use the full expressive power of the Emotion `css()` function that you already know.
* **Static by Default:** Styles are automatically extracted into static CSS during the Astro build process.
* **Performance:** No hydration overhead for styles and no Flash of Unstyled Content (FOUC).


## 🛠 How it looks

In Potate, you don't need to learn any special properties or complex setups. It just works with the standard `class` attribute and the Emotion `css()` function. It feels completely natural, even in Astro's **"No directive" (Server Only)** mode.

While you can use `css()` directly, you can also create reusable functions like `flexCol()` (which we call **"The Patterns"**).

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

## 🌗 Hybrid Styling (SSR + CSR)

In Potate, Island components (`client:*`) get the best of both worlds.

### How it works

1. At Build Time (SSR): Potate executes your `css()` calls and extracts the initial styles into a static CSS file. This ensures your component looks perfect even before JavaScript loads.

2. At Runtime (Hydration): Once the Island hydrates in the browser, the Emotion runtime takes over.

### Why this is powerful

Because the Emotion runtime remains active inside Islands, you can use standard React/Preact patterns to handle dynamic styles without any special "Potate-specific" APIs.

### Example: Hydration-aware Styling

You can easily change styles when the component "wakes up" in the browser:

```jsx
export const InteractiveBox = () => {
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

### Key Benefits

* **No FOUC (Flash of Unstyled Content):** Since the "Server Side" style is already in the static CSS, there's no flickering.
* **Unlimited Flexibility:** Need to change colors based on user input or mouse position? Just pass the props/state to css() like you always do.
* **Zero Learning Curve:** If you know how to use useEffect and Emotion, you already know how to build dynamic Islands with Potate.


## 🛠 The Patterns 

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

## 🛠 Advanced

### Styled Components (MUI-like)

If you prefer the Styled Components pattern (popularized by libraries like MUI or styled-components), Potate makes it incredibly easy to implement.

Even with this sophisticated API, the result remains the same: Zero-Runtime CSS. All styles are pre-calculated during SSR and extracted into static CSS files.

```jsx
import {css, keyframes, injectGlobal, cx} from '@emotion/css'
import * as patterns from './my-patterns'

export const styled = (Tag, options) => (style, ...values) => props => {
  const makeClassName = (style, ...values) =>
    typeof style == 'function' ? makeClassName(style(props)) : css(style, ...values);
 
  const {sx, 'class': _class, children, ...wosx} = props;

  Object.keys(wosx).forEach(key => {
    if (options && options.shouldForwardProp && !options.shouldForwardProp(key)) {
      delete wosx[key];
    }
  });

  const newProps = {
    ...wosx,
    'class': cx(makeClassName(style, ...values), makeClassName(sx), _class),
  };

  return (<Tag {...newProps}>{children}</Tag>);
};

```

> **Note:** What is the sx prop? For those unfamiliar with libraries like [MUI, the sx prop](https://mui.com/system/getting-started/the-sx-prop/) is a popular pattern that allows you to apply "one-off" styles directly to a component.
>
> In this implementation, the sx prop is merged with the component's base styles. This gives you the flexibility to tweak margins or colors on a specific instance without needing to define a new styled component every time.