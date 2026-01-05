
# Potate API Documentation

## `watch(resource)`

The `watch(resource)` API connects your component to a shared resource and manages the **Suspense** lifecycle. It can be called inside `if` statements, `for` loops, or after early returns.

By default, watch utilizes Transition Updates. This ensures a stable UI where the Suspense fallback is not displayed; the engine maintains the current screen until the resource is ready.

For interactions requiring zero-latency feedback (e.g., keyboard inputs), use watch.sync to force a Sync Update.

```javascript
import { Suspense, watch, initWatch } from 'potate'
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
const resource = initWatch((set) => {
  // side effects like subscribing to a store or fetching data
  const unsubscribe = myStore.subscribe(set)
  return unsubscribe
})

```

## `initWatch(initializer)`

A constructor to bridge external reactive sources to the engine's observer system. It ensures that the engine is notified whenever the underlying data changes.


### Guiding Principles & Responsibilities

The following rules must be observed:

* ​Pure Getters: `store.get()` must be a pure function. It is strictly prohibited to execute I/O operations or state updates inside `get()` to ensure idempotency.

* ​Side Effects in initWatch: Feel free to perform side effects (such as subscribing to stores or initiating data fetches) inside the function passed to initWatch. Because this function is executed before the component renders, it is perfectly safe and designed to handle these operations.

* ​Store's Responsibility & Re-render Guarantee: It is the store's responsibility to notify the engine via the listener whenever its data changes. It is perfectly safe for side effects to occur when the listener is triggered, as the engine guarantees a subsequent re-render to synchronize the UI.


## Jotai Example

``` js
import { Suspense, watch, initWatch } from 'potate'
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

const resource = initWatch(listener => {
  const unsubscribe = mySignal.sub(listener)
  return unsubscribe
})

```
