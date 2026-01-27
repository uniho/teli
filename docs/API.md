
# Potate API Documentation

## `reacty(...ReactComponent)`

Declares that components created for React will be used within Potate. Once a component is marked as a React component, all of its descendants (children) are also treated as React components. You can pass multiple components as arguments to mark them all at once.

### Setup & Dependencies

How to setup aliases depends on your environment.

#### For Astro

Potate handles all Vite aliases automatically. However, whether you need to install the `a technical dummy react package for Node.js` depends on how you use `reacty`:

* **No directive (Server Only)**: The component is rendered as just static HTML tags. However, components registered with `reacty` are skipped because Potate cannot convert React Components into HTML strings. Therefore, using React components in this mode is completely pointless. In this case, `a technical dummy react package for Node.js` **is not required**.
* `client:only="potate"` **(Client Only)**: The component runs only in the browser. Since the server is bypassed entirely, there is no need for `a technical dummy react package for Node.js`.
* `client:load`(and others like `client:visible` or `client:idle`) **(SSR Hydration)**: If you want to inject React components using `reacty` within these directives, **you must install `react` as a development dependency.** This acts as `a technical dummy react package for Node.js` to resolve third-party imports during the SSR-to-Client handover.

```bash
# Only required for SSR Hydration
npm install -D react
```

> **Note:** It may go without saying, `a technical dummy react package for Node.js` is never included in the final client-side JavaScript bundle.


#### For Pure Vite

Potate handles all Vite aliases automatically.
For Pure Vite environments, installing `a technical dummy react package for Node.js` is not required.

### Implementation Example

The component definition remains the same, but the entry point differs between Astro and Pure Vite.

```bash
npm install react-select
npm install react-confetti
npm install react-simple-typewriter
```

```jsx
import Potate from 'potatejs'
import Confetti from 'react-confetti'
import Select from 'react-select'
import {Typewriter} from 'react-simple-typewriter'

const options = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' }
]

Potate.reacty(Confetti, Select, Typewriter)

const App = (props) => {
  return (<div>
    <Confetti width={1000} height={1000} />
    <Select options={options} />
    <Typewriter
      words={['Hello Potate', 'I am for React', 'It works!']}
      loop={5}
      cursor
    />
  </div>)
}

// --- Output ---

// For Astro: Just export the component. 
// Astro handles the mounting process based on client directives.
export default App

// For Pure Vite: Manually create a root and render.
// Use this for single-page applications (SPA).
const root = Potate.createRoot(document.querySelector('#app'))
root.render(<App/>)

```


## `watch(resource)`

The `watch(resource)` API connects your component to a shared resource and manages the **Suspense** lifecycle. It can be called inside `if` statements, `for` loops, or after early returns.

By default, watch utilizes Transition Updates. This ensures a stable UI where the Suspense fallback is not displayed; the engine maintains the current screen until the resource is ready.

For interactions requiring zero-latency feedback (e.g., keyboard inputs), use watch.sync to force a Sync Update.

```javascript
import { Suspense, watch } from 'potatejs'
import { myStore } from './my-store'

export props => {
  return (
  <Suspense>
    <Profile />
  </Suspense>
  )
}

const Profile = props => {
  // Default: Transition-based (No fallback shown)
  watch(resource)
  // Sync Update (For managed inputs)
  // watch.sync(resource)

  // Data Acquisition (Directly from the store)
  const data = myStore.get()

  return (<div>Name: {data.name}</div>)
}

//
const resource = watch.create(listener => {
  // side effects like subscribing to a store or fetching data
  const unsubscribe = myStore.subscribe(listener)
  return unsubscribe
})

```

## `watch.create(initializer)`

A constructor to bridge external reactive sources to the engine's observer system. It ensures that the engine is notified whenever the underlying data changes.


### Guiding Principles & Responsibilities

The following rules must be observed:

* ​Pure Getters: `store.get()` must be a pure function. It is strictly prohibited to execute I/O operations or state updates inside `get()` to ensure idempotency.

* ​Side Effects in initializer: Feel free to perform side effects (such as subscribing to stores or initiating data fetches) inside the function passed to `watch.create()`. Because this function is executed before the component renders, it is perfectly safe and designed to handle these operations.

* ​Store's Responsibility & Re-render Guarantee: It is the store's responsibility to notify the engine via the listener whenever its data changes. It is perfectly safe for side effects to occur when the listener is triggered, as the engine guarantees a subsequent re-render to synchronize the UI.


## Jotai Example

``` js
import { Suspense, watch } from 'potatejs'
import {createStore, atom} from "jotai"

// Your human rights (specifically your liberty) are fully guaranteed,
// including the freedom to name this as you wish — such as a 'signal'.
const createSignal = initValue => {
  const _store = createStore()
  const _atom = atom({v: initValue})
  const f = () => _store.get(_atom).v
  f.set = newValue => _store.set(_atom, {v: newValue})
  f.sub = listener => _store.sub(_atom, listener)
  f.atom = _atom
  return f
}

const mySignal = createSignal({name: 'jyaga'})

export props => {
  return (<Suspense><Profile /></Suspense>)
}

const Profile = props => {
  watch(resource)
  const data = mySignal()
  return (<div>Name: {data.name}</div>)
}

const resource = watch.create(listener => {
  const unsubscribe = mySignal.sub(listener)
  return unsubscribe
})

```
