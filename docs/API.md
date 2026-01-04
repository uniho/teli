
# Potate API Documentation

## `watch(resource)`

The `watch(resource)` API connects your component to a shared resource and manages the **Suspense** lifecycle. It can be called inside `if` statements, `for` loops, or after early returns.

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
  // Suspension & Observation
  watch(resource)

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

* **Pure Getters**: `store.get()` must be a **pure function**.
* **No Side Effects**: Executing I/O operations or state updates inside `get()` is strictly prohibited.
* **Idempotency**: If `get()` is called multiple times without a state update, it must return the same value and perform no side effects. All side-effectful logic should be handled within the `initializer` function passed to `initWatch`.


* **Notification Responsibility**: It is the **resource's responsibility** to notify the engine when data changes.
* **Re-render Guarantee**: Side effects may be executed during an update, provided they are triggered through the listener registered in `initWatch`, which guarantees a re-render.
* **State Inconsistency**: Failing to notify the engine when the state changes leads to UI inconsistency and is considered a violation of these principles.


## Jotai の使用例

``` js
import { Suspense, watch, initWatch } from 'potate'
import {createStore, atom} from "jotai"

// Your human rights (specifically your liberty) are fully guaranteed,
// including the freedom to name this as you wish — such as a 'signal'.
const createSignal = initValue => {
  const _store = createStore()
  const _atom = atom(initValue)
  const f = () => _store.get(_atom)
  f.set = newValue => _store.set(_atom, newValue)
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
