<p align="center">
  <img src="https://unpkg.com/brahmos@0.5.0/brahmos.svg" alt="Brahmos.js" width="250">
</p>

# Potate

**Po**wered by **Ta**gged **Te**mplate.

Supercharged JavaScript library to build user interfaces with modern React API and native templates.

Potate supports all the APIs of React including the upcoming concurrent mode APIs and the existing ones. It has its own custom fiber architecture and concurrent mode implementation to support the concurrent UI patterns.

forked from [brahmosjs/brahmos](https://github.com/brahmosjs/brahmos)


## Features

- Lightweight and Fast.
- Exact same React's Declarative APIs with JSX.
- Fast alternative to Virtual DOM. (JSX without VDOM).
- Smaller transpiled footprint of your source code, than traditional JSX.

## Installation

Add `potate` as a dependency. And `esbuild` as a dev dependency.
```
npm install teli
npm install -D esbuild
```

Add brahmos in your babel config.
```
{
  presets: ['@babel/preset-env'],
  plugins: [
    //...
    'brahmos'
  ]
}
```
**Note:** You will have to remove react preset from babel if you trying brahmos on existing project.

## Usage
The API is exact same as React so build how you build application with React, but instead of importing from `react` or `react-dom` import from `brahmos`;

```js
import {useState, useEffect} from 'brahmos';

export default function App(props) {
  const [state, setState] = useState(0);

  return (
    <div>
      ...
    </div>
  )
}
```


### Using React 3rd party libraries

Just alias react and react-dom with brahmos. And you are good to go using 3rd party react libraries.

You need to add following aliases.
```js
alias: {
  react: 'brahmos',
  'react-dom': 'brahmos',
  'react/jsx-runtime': 'brahmos'
},
```

-  **webpack** ([https://webpack.js.org/configuration/resolve/#resolvealias](https://webpack.js.org/configuration/resolve/#resolvealias))
- **parcel** ([https://parceljs.org/module_resolution.html#aliases](https://parceljs.org/module_resolution.html#aliases))
- **rollup** ([https://www.npmjs.com/package/@rollup/plugin-alias](https://www.npmjs.com/package/@rollup/plugin-alias))
- **babel** ([https://www.npmjs.com/package/babel-plugin-module-resolver](https://www.npmjs.com/package/babel-plugin-module-resolver))


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
- [x] Enhanced `useTransition` hook
  *(Note: Currently seeking to remove the requirement for the `timeout` option)*
- [x] Enhanced `useDeferredValue` hook
  *(Note: Currently seeking to remove the `timeout` requirement and add support for initial values)*
- [x] `use(resource)` API
- [x] `watch(resource)` API
- [ ] `use(context)` API
- [ ] Support for `ref` as a prop
- [ ] `startTransition(action)` for POST request.
- [ ] Performance improvement
- [ ] Bug fixes
- [ ] Test Cases
- [ ] Rewrite core source code with MoonBit


## Out of Scope

*The following features are not planned for the core roadmap (though contributors are welcome to explore them):*

* Potate Server Components (PSC)
* Potate Compiler
* `useOptimistic` hook
* Type definitions/Type safety: We do not prioritize or provide type information unless it directly impacts runtime execution safety.
