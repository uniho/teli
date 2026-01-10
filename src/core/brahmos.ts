// core/brahmos.ts

/** Component classes,  Suspense and lazy */
import {
  Component,
  PureComponent,
  createElement,
  createBrahmosNode,
  Suspense,
  SuspenseList,
  lazy,
} from './circularDep';

import { html } from './tags';

/** render methods */
import render from './render';

/** Portal */
import createPortal from './createPortal';

/** Hooks */
import {
  useState,
  useEffect,
  useRef,
  useReducer,
  useMemo,
  useCallback,
  useLayoutEffect,
  useContext,
  useTransition,
  useDeferredValue,
  useImperativeHandle,
  useDebugValue,
} from './hooks';

/** createContext */
import createContext from './createContext';

/** ForwardRef and createRef */
import { forwardRef, createRef } from './refs';

/** unmountComponentAtNode */
import unmountComponentAtNode from './unmountComponentAtNode';

/** unstableBatchedUpdate */
import { deferredUpdates, syncUpdates } from './updateUtils';

/** import top level api */
import { Children, isValidElement, cloneElement } from './Children';

import memo from './memo';

const NoopComponent = (props) => props.children;

// add a noop component for StrictMode and Fragment, as brahmos don't support any deprecated API
const StrictMode = NoopComponent;
const Fragment = NoopComponent;

/**
 * Mock for unstable_batchedUpdates as third party lib like Redux uses it.
 * Brahmos by default batches update so we can just call the passed callback directly
 */
function unstable_batchedUpdates(cb) {
  cb();
}

export {
  createElement,
  render,
  Component,
  PureComponent,
  useState,
  useEffect,
  useRef,
  useReducer,
  useMemo,
  useCallback,
  useLayoutEffect,
  useContext,
  useTransition,
  useDeferredValue,
  useImperativeHandle,
  useDebugValue,
  createContext,
  forwardRef,
  createRef,
  createPortal,
  unmountComponentAtNode,
  Suspense,
  SuspenseList,
  lazy,
  Children,
  isValidElement,
  cloneElement,
  deferredUpdates as unstable_deferredUpdates,
  syncUpdates as unstable_syncUpdates,
  unstable_batchedUpdates,
  memo,
  StrictMode,
  Fragment,
};

export {createRoot} from './root'
export {use} from './use';
export {startTransition} from './hooks';
export {watch, initWatch} from './watch';

export function reacty(...Components: any[]) {
  Components.forEach((Component) => {
    Component.__isReactCompat = true;
  });
}

/** Export transforms */
export const jsx = createBrahmosNode;
export const jsxs = createBrahmosNode;
export const jsxDev = createBrahmosNode;
export { html };

import { setCurrentComponentFiber } from './fiber';
import functionalComponentInstance from './functionalComponentInstance';

/**
 * TODO: Remove this export once the Dispatcher pattern is implemented.
 *
 * Currently, these internals are exposed to support SSR by creating a "dummy Fiber"
 * in `renderToString`. This allows hooks to function without crashing by tricking
 * them into thinking they are running in a valid Fiber context.
 *
 * The correct architectural approach is to implement a Dispatcher pattern (similar to React),
 * where the implementation of hooks is switched based on the environment (Client vs Server).
 * - Client: Uses Fiber-based hooks (current implementation).
 * - Server: Uses lightweight, Fiber-independent hooks.
 *
 * When that refactoring is complete, `renderToString` will no longer need access
 * to these internals, and this export should be deleted.
 */
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  setCurrentComponentFiber,
  functionalComponentInstance,
};
