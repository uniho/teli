<p align="center">
  <img src="https://raw.githubusercontent.com/uniho/potate/main/assets/potate.svg" alt="potate" width="250">
</p>

# Potate

**Po**wered by **Ta**gged **Te**mplate.

**Note**: This project is a fork of [brahmosjs/brahmos](https://github.com/brahmosjs/brahmos).

Supercharged JavaScript library to build user interfaces with modern React API and native templates.

Potate supports all the APIs of React including the upcoming concurrent mode APIs and the existing ones. It has its own custom fiber architecture and concurrent mode implementation to support the concurrent UI patterns.

## Features

- Lightweight and Fast.
- Exact same React's Declarative APIs with JSX.
- Fast alternative to Virtual DOM. (JSX without VDOM).
- Smaller transpiled footprint of your source code, than traditional JSX.

## Installation

### Vite

Create your new app with `select a framework: > Vanilla`.

``` bash
npm create vite@latest my-app
cd my-app
```

Add `potatejs` as a dependency.
``` bash
npm install potatejs
```

Add Potate in your `vite.config.js|.ts` file.

``` js
import { defineConfig } from 'vite'
import potatejs from 'potatejs/vite'

export default defineConfig({
  plugins: [potatejs()],
})

```

Create `src/main-potate.jsx`.

``` jsx
import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import Potate from 'potatejs'

const App = props => {
  return (
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src={viteLogo} class="logo" alt="Vite logo" />
    </a>
    <a href="https://github.com/uniho/potate" target="_blank">
      <img class="logo" alt="potate" src="https://raw.githubusercontent.com/uniho/potate/main/assets/potate.svg" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src={javascriptLogo} class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Potate on Vite!</h1>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
  )
}

const root = Potate.createRoot(document.querySelector('#app'))
root.render(Potate.createElement(App)) // ✖ root.render(<App/>) Please avoid JSX at the root

```

Edit your `index.html`.

``` html
  :
  :
    <script type="module" src="/src/main-potate.jsx"></script>
  :
  :
```


### Esbuild

Add `potatejs` as a dependency. And `esbuild` as a dev dependency.
``` bash
npm install potatejs
npm install -D esbuild
```

Build your app.

NOTE: This CLI is build-only. For watch / dev usage, use esbuild's JS API directly.

``` bash
npx potatejs src/entry-point.js --outdir dist
```


## Usage

The API is exact same as React so build how you build application with React, but instead of importing from `react` or `react-dom` import from `potatejs`;

```js
import Potate from 'potatejs'

export default function App(props) {
  const [state, setState] = Potate.useState(0)

  Potate.useEffect(() => {
      ...
  }, [])

  return (
    <div>
      ...
    </div>
  )
}

const root = Potate.createRoot(document.querySelector('#app'))
root.render(Potate.createElement(App)) // ✖ root.render(<App/>) Please avoid JSX at the root

```


### Using React 3rd party libraries

Just alias react and react-dom with potatejs. And you are good to go using 3rd party react libraries.

You need to add following aliases.

```js
// vite.config.ts
export default defineConfig({

  resolve: {
    alias: {
      'react': 'potatejs',
      'react-dom': 'potatejs',
      'react/jsx-runtime': 'potatejs',
    },
  },

});

```

```json
// tsconfig.json
{
  "compilerOptions": {

    "paths": {
      "react": ["./node_modules/potatejs"],
      "react-dom": ["./node_modules/potatejs"],
      "react/jsx-runtime": ["./node_modules/potatejs"],
    },

  }
}

```


## Idea

It is inspired by the rendering patterns used on hyperHTML and lit-html.

It has the same declarative API like React, but instead of working with VDOM, it uses tagged template literals and HTML's template tag for faster rendering and updates.
It divides the HTML to be rendered into static and dynamic parts, and in next render, it has to compare the values of only dynamic parts and apply the changes optimally to the connected DOM.
It's unlike the VDOM which compares the whole last rendered VDOM to the new VDOM (which has both static and dynamic parts) to derive the optimal changes that are required on the actual DOM.

Even though tagged template literals are the key to static and dynamic part separation, the developer has to code on well adopted JSX.

Using the babel-plugin-brahmos it transforms JSX into tagged template literals which are optimized for render/updates and the output size.

Consider this example,

```jsx
class TodoList extends Component {
  state = { todos: [], text: '' };
  setText = (e) => {
    this.setState({ text: e.target.value });
  };
  addTodo = () => {
    let { todos, text } = this.state;
    this.setState({
      todos: todos.concat(text),
      text: '',
    });
  };
  render() {
    const { todos, text } = this.state;
    return (
      <form className="todo-form" onSubmit={this.addTodo} action="javascript:">
        <input value={text} onChange={this.setText} />
        <button type="submit">Add</button>
        <ul className="todo-list">
          {todos.map((todo) => (
            <li className="todo-item">{todo}</li>
          ))}
        </ul>
      </form>
    );
  }
}
```

It will be transformed to

```js
class TodoList extends Component {
  state = { todos: [], text: '' };
  setText = (e) => {
    this.setState({ text: e.target.value });
  };
  addTodo = () => {
    let { todos, text } = this.state;
    this.setState({
      todos: todos.concat(text),
      text: '',
    });
  };
  render() {
    const { todos, text } = this.state;
    return html`
      <form class="todo-form" ${{ onSubmit: this.addTodo }} action="javascript:">
        <input ${{ value: text }} ${{ onChange: this.setText }} />
        <button type="submit">Add</button>
        <ul class="todo-list">
          ${todos.map((todo) =>
            html`
              <li class="todo-item">${todo}</li>
            `(),
          )}
        </ul>
      </form>
    `("0|0|1,0|1|0,1|3|");
  }
}
```

With the tagged template literal we get a clear separating of the static and dynamic part. And on updates it needs to apply changes only on the changed dynamic parts.

Tagged template literals also have a unique property where the reference of the literal part (array of static strings) remain the same for every call of that tag with a given template.
Taking advantage of this behavior Brahmos uses literal parts as a cache key to keep the intermediate states to avoid the work done to process a template literal again.

Tagged template is natively supported by the browser, unlike the React's JSX which has to be transformed to React.createElement calls. So the output generated to run Brahmos has a smaller footprint than the output generated for the react.
For the above example, the Brahmos output is 685 bytes, compared to 824 bytes from the React output. More the static part of an HTML, greater the difference will be.


## Progress

- [x] Babel Plugin to transpile JSX to tagged template
- [x] Class components with all life cycle methods (Except deprecated methods)
- [x] Functional Component
- [x] List and Keyed list
- [x] Synthetic input events - onChange support
- [x] Hooks
- [x] Context API
- [x] Refs Api, createRef, ref as callback, forwardRef
- [x] SVG Support
- [x] Suspense, Lazy, Suspense for data fetch, Suspense List
- [x] Concurrent Mode
- [x] 3rd Party React library support (Tested React-router, redux, mobx, react-query, zustand, recharts)
- [x] React Utilities and Methods
- [x] Vite Plugin to transpile JSX to tagged templates
- [x] Esbuild Plugin to transpile JSX to tagged templates
- [x] The Lanes Light **(Though I haven't cleaned up the no-longer-needed TRANSITION_STATE_TIMED_OUT yet.)**
- [x] The Standalone `startTransition`
- [x] Enhanced `useTransition` hook
- [x] Enhanced `useDeferredValue` hook
- [x] `use(resource)` API
- [x] [watch(resource) API](docs/API.md)
- [x] React 19 style root management
- [ ] `use(context)` API
- [ ] [use(store) API](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more#concurrent-stores)
- [ ] [ref as a prop](https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop)
- [ ] [Cleanup functions for refs](https://react.dev/blog/2024/12/05/react-19#cleanup-functions-for-refs)
- [ ] [<Context> as a provider](https://react.dev/blog/2024/12/05/react-19#context-as-a-provider)
- [ ] [startTransition(action) for POST request](https://react.dev/blog/2024/12/05/react-19#actions)
- [ ] [useEffectEvent hook](https://react.dev/reference/react/useEffectEvent)
- [ ] `useImperativeHandle` hook
- [ ] `useInsertionEffect` hook
- [ ] Clean up
- [ ] Performance improvement
- [ ] Bug fixes
- [ ] Test Cases
- [ ] Rewrite core source code with [MoonBit](https://www.moonbitlang.com/)


## Won't Do

*The following features are not planned for the core roadmap (though contributors are welcome to explore them):*

* Potate Server Components (PSC)
* Potate Compiler
* `useSyncExternalStore` hook
* `useOptimistic` hook
* Superficial Type Definitions: We do not provide type information solely to satisfy IDE warnings unless it directly impacts runtime execution safety.
