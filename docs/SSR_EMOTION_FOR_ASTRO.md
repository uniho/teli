# SSR [Emotion](https://emotion.sh/docs/@emotion/css) for Astro

A natural and powerful Zero-Runtime CSS-in-JS solution, seamlessly integrated with Astro.

## 🚀 Why it matters

I used to think there wasn't much point in writing static content in JSX components (`.jsx` or `.tsx` files) instead of just using Astro components (`.astro` files). It seemed like standard Astro components were more than enough for most cases, because I thought having frontmatter, the HTML tag section, and the style section was all I ever needed.

However, I've realized one major advantage: "SSR EMOTION". While other frameworks often struggle with complex configurations to get [Emotion](https://emotion.sh/docs/@emotion/css) working with SSR, Potate bridges this gap naturally. It allows you to use the power of CSS-in-JS without any of the typical performance trade-offs.

## 💎 The Result

* **Zero Runtime by default:** No `Emotion` library is shipped to the browser. It delivers a pure Zero-JS experience.
* **Familiar DX:** Use the full expressive power of the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css) that you already know.
* **Static by Default:** Styles are automatically extracted into static CSS during the Astro build process.
* **Performance:** No hydration overhead for styles and no Flash of Unstyled Content (FOUC).


## 🛠 How it looks

In Potate, you don't need to learn any special properties or complex setups. It just works with the standard `class` attribute and the [Emotion `css()` function](https://emotion.sh/docs/@emotion/css). It feels completely natural, even in Astro's **"No directive" (Server Only)** mode.

While you can use [`css()`](https://emotion.sh/docs/@emotion/css) directly, you can also create reusable functions like `flexCol()` (which we call **"The Patterns"**).

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
// src/components/InteractiveBox.jsx

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

```astro
---
// src/pages/index.astro

import Layout from '../layouts/Layout.astro';
import StaticBox from '../components/StaticBox';
import InteractiveBox from '../components/InteractiveBox';
---

<Layout>
  <StaticBox />
  <InteractiveBox client:load />
</Layout>

```

### Key Benefits

* **No FOUC (Flash of Unstyled Content):** Since the "Server Side" style is already in the static CSS, there's no flickering.
* **Unlimited Flexibility:** Need to change colors based on user input or mouse position? Just pass the props/state to css() like you always do.
* **Zero Learning Curve:** If you know how to use useEffect and Emotion, you already know how to build dynamic Islands with Potate.


## 🛠 The Patterns 

In Potate, we refer to reusable CSS logic as "The Patterns".

Honestly? They’re just standard JavaScript functions that return styles. No complex registration, no hidden magic. You just write a function, and that's it. Simple, right? 🤤

### LinkOverlay

You can easily implement the LinkOverlay pattern. This expands a link's clickable area to its nearest parent with `position: relative`.

```jsx
import { css } from '@emotion/css'

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
}, ...args)

export default props => (
  // The parent must have position: relative
  <div class={css({ position: 'relative', border: '1px solid #ccc', padding: '1rem' })}>
    <img src="https://via.placeholder.com/150" alt="placeholder" />
    <h3>Card Title</h3>
    <a href="/details" class={linkOverlay()}>
      View more
    </a>
  </div>
)

```

### Media Query

```jsx
import { css } from '@emotion/css';

const BP = {
  sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px',
}

const isBP = value => value in BP
const _gt = bp => `(min-width: ${isBP(bp) ? BP[bp] : bp})`
const _lt = bp => `(max-width: ${isBP(bp) ? BP[bp] : bp})`

const gt = (bp, ...args) => css({[`@media ${_gt(bp)}`]: css(...args)})
const lt = (bp, ...args) => css({[`@media ${_lt(bp)}`]: css(...args)})
const bw = (min, max, ...args) => css({[`@media ${_gt(min)} and ${_lt(max)}`]: css(...args)})

export default props => (
  <div class={css(
    { color: 'black' }, // default css
    bw('sm', '75rem', { color: 'blue' }), // between
    gt('75rem', { color: 'red' }), // greater than
  )}>
    Responsive Design!
  </div>
);

```


## 🛠 Advanced

### Styled Components (MUI-like)

If you prefer the Styled Components pattern (popularized by libraries like MUI or styled-components), `Emotion` makes it incredibly easy to implement.

Even with this minimal custom (but powerful) function, the result remains the same: Zero-Runtime CSS. All styles are pre-calculated during SSR and extracted into static CSS files.

```jsx
import {css, cx} from '@emotion/css'

export const styled = (Tag) => (style, ...values) => props => {
  const makeClassName = (style, ...values) =>
    typeof style == 'function' ? makeClassName(style(props)) : css(style, ...values);
 
  const {as: As, sx, className, 'class': _class, children, ...wosx} = props;

  // cleanup transient props
  Object.keys(wosx).forEach(key => {
    if (key.startsWith('$')) delete wosx[key];
  });

  const newProps = {
    ...wosx,
    class: cx(makeClassName(style, ...values), makeClassName(sx), _class, className),
  };

  const T = As || Tag;
  return (<T {...newProps}>{children}</T>);
};

```

What is the sx prop? For those unfamiliar with libraries like [MUI, the sx prop](https://mui.com/system/getting-started/the-sx-prop/) is a popular pattern that allows you to apply "one-off" styles directly to a component.

In this implementation, you can pass raw style objects to the sx prop without wrapping them in `css()` or "The Patterns" functions.

However, defining a `styled` component inside a render function is **a pitfall** because it creates a new component identity every time, forcing React to re-mount.
I personally prefer the approach shown below. In any case, how you choose to implement this is entirely up to you.

```js
// the-sx-prop.jsx

import {css, cx} from '@emotion/css'

export const sx = (props, style, ...values) => {
  let result = (props && typeof props === 'object' ? props : {});
  if (typeof style === 'function') {
    result = {...style(result), ...result};
    result.class = cx(css(result?.$css, ...values), result.class);
  } else {
    result.class = cx(css(style, ...values), result.class);
  }

  // cleanup transient props
  Object.keys(result).forEach(key => {
    if (key.startsWith('$')) delete result[key];
  });

  return result;
}

// Factory for component-scoped sx functions (adds `.css()` automatically)
sx._factory = (genCSS) => {
  const f = (props, ...styles) => sx(props || {}, genCSS, ...styles);
  f.css = (...styles) => f({}, ...styles); // style only
  // f.curry = (props) => (...values) => f(props || {}, ...values); // currying
  return f;
}

// My button style
sx.button = sx._factory(props => {
  const style = {
    // default is text button
    padding: '8px 16px',
    border: 'none',
    borderRadius: '2px',
    color: 'var(--style-palette-primary)',
    backgroundColor: 'inherit',
    boxShadow: 'none',
  };

  if (props.$elevated) {
    style.borderRadius = '0';
    style.border = 'none';
    style.color = 'var(--style-palette-primary)';
    style.backgroundColor = 'var(--style-palette-surface-container-low)';
    style.boxShadow = 'var(--style-shadows-level1)';
  }

  return {$css: [
    css`
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      &:not(:disabled) {
        cursor: pointer;
      }
    `,
    style,
  ]};
});

```

```jsx
import {sx} from './the-sx-prop'

export default props => {
  return (<>
  <button {...sx.button({}, {margin: '1rem'})}>Buuton1</button>
  <button {...sx.button.css({margin: '1rem'})}>Buuton1</button>
  <button {...sx.button({$elevated: true}, {margin: '1rem'})}>Button2</button>
  <div {...sx.button({$elevated: true}, {margin: '1rem'})}>Button3</div>
  <button disabled {...sx.button.css({margin: '1rem'})}>Button4</button>
  <button {...sx.button({disabled: true}, {margin: '1rem'})}>Button5</button>
  </>);
}

```

Furthermore, by creating a component like the one below, you evolve into a **Super Saiyan** (for those who aren't familiar, it's like a classic Superman).

```js
// the-sx-prop.jsx

:
:

export const As = ({as: Tag = 'div', children, ...props}) => <Tag {...props}>{children}</Tag>;

// My list style
sx.ul = sx._factory(props => ({
  as: 'ul',
  $css: css`
  & > li {
    position: relative;
    padding-left: 1.5rem;

    &:before {
      content: "\\2022";
      position: absolute;
      width: 1.5rem;
      left: 0; top: 0;
      text-align: center;
    }
    & + li, & > ul {
      margin-top: .25rem;
    }
  }
  & > ul {
    margin-left: 1rem;
  }
`}));

```

```jsx
import {sx, As} from './the-sx-prop'

const MyComponent = props => {
  return (
  <As {...sx.ul.css({ padding: '20px', border: '1px solid #ccc' })}>
    <li>Is it Flexible?</li>
    <li>Is it Dynamic?</li>
    <li>Is it Polymorphic?</li>
    <li>No, it's <strong>As</strong>!</li>
  </As>
  )
}

```
