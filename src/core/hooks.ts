// core/hooks.ts

import reRender from './reRender';
import { getConsumerCallback } from './createContext';
import { getUniqueId } from './utils';
import { doDeferredProcessing } from './workLoop';

import {
  UPDATE_TYPE_SYNC,
  UPDATE_TYPE_DEFERRED,
  UPDATE_SOURCE_TRANSITION,
  BRAHMOS_DATA_KEY,
  UPDATE_SOURCE_IMMEDIATE_ACTION,
  TRANSITION_STATE_INITIAL,
  TRANSITION_STATE_START,
} from './configs';

import {
  getCurrentUpdateSource,
  withUpdateSource,
  withTransition,
  getPendingUpdates,
  getUpdateType,
  guardedSetState,
} from './updateUtils';

import { getFiberFromComponent, getCurrentComponentFiber } from './fiber';
import { PREDEFINED_TRANSITION_DEFERRED } from './transitionUtils';

import type {
  Fiber,
  Transition,
  ObjectRef,
  StateCallback,
  ContextType,
  FunctionalComponentUpdate,
} from './flow.types';

type StateHookResult = [any, (state: any) => any];

type UseTransitionResult = [boolean, (cb: Function) => void];

function getCurrentComponent() {
  return getCurrentComponentFiber().nodeInstance;
}

/**
 * clone hooks, syncHooks to deferredHooks
 */
function cloneHooks(component) {
  const { renderCount } = component[BRAHMOS_DATA_KEY];

  component.deferredHooks = component.syncHooks.map((hook, index) => {
    if (Array.isArray(hook)) {
      return [...hook];
    } else if (hook.transitionId) {
      /**
       * Transition hooks are shared across sync and deferred hooks,
       * so use the same instance of hook don't clone it
       */
      return hook;
      // eslint-disable-next-line no-prototype-builtins
    } else if (hook.hasOwnProperty('current') && renderCount > 1) {
      /**
       * In case of useRef we need to retain the the reference if there if the
       * render is getting called multiple times in one render cycle
       */
      return component.deferredHooks[index] || hook;
    }
    return { ...hook };
  });
}

/**
 * Get the current hooks array based on updateType
 */
function getHooksList(updateType, component) {
  const { syncHooks, deferredHooks } = component;
  return updateType === UPDATE_TYPE_SYNC ? syncHooks : deferredHooks;
}

/**
 * Get the current hooks array from the fiber
 */
function getHooksListFromFiber(fiber) {
  const {
    nodeInstance,
    root: { updateType },
  } = fiber;

  return getHooksList(updateType, nodeInstance);
}

/**
 * Get current hook, based on the type of update we are doing
 * If it is inside transition of deferred update we need deferredHooksList,
 * or else we need the sync hooks list
 */
function getCurrentHook(updateType, hookIndex, component) {
  /**
   * if deferred hooks is not populated clone from the syncHooks
   * This will happen if the component has never been rendered in deferred mode.
   */
  if (updateType === UPDATE_TYPE_DEFERRED && !component.deferredHooks.length) {
    cloneHooks(component);
  }

  const hooks = getHooksList(updateType, component);
  return hooks[hookIndex];
}

/**
 * Method to check if two dependency array are same
 */
function isDependenciesChanged(deps, oldDeps) {
  // if oldDeps or deps are not defined consider it is changed every time
  if (!deps || !oldDeps || deps.length !== oldDeps.length) return true;
  for (let i = 0, ln = deps.length; i < ln; i++) {
    if (deps[i] !== oldDeps[i]) return true;
  }
  return false;
}

/**
 * Function to rerender component if state is changed
 */
function reRenderComponentIfRequired(component, param, lastState) {
  const isFunctionUpdate = typeof param === 'function';

  /**
   * check if state are different before rerendering, for seState triggered by event
   * we should always reRerender as event can have some side effects which are controlled
   *
   * Also if the update is a function, we cannot know the result beforehand,
   * so we should always re-render, which is how React works.
   */
  if (
    getCurrentUpdateSource() === UPDATE_SOURCE_IMMEDIATE_ACTION ||
    isFunctionUpdate ||
    !Object.is(param, lastState)
  ) {
    reRender(component);
  }
}

/**
 * A base method to return hook at specific pointer,
 * and if not available create a new pane
 * We also pass a method to get value from the hook which is passed to the component
 * Plus a method to check if hook has to be updated
 *
 * H: Hook, R: Hook result
 */
function defaultShouldUpdate<H>(hook: H): boolean {
  return false;
}

function defaultReduce<H, R>(hook: H): H | R {
  return hook;
}

function getHook<H, R>(
  createHook: () => H,
  shouldUpdate: (hook: H) => boolean,
  reduce: (hook: H) => R,
): R {
  const fiber = getCurrentComponentFiber();
  const { nodeInstance: component } = fiber;
  const { pointer } = component;
  const hooks = getHooksListFromFiber(fiber);
  let hook = hooks[pointer];

  // if hook is not there initialize and add it to the pointer
  if (!hook || shouldUpdate(hook)) {
    hook = createHook();
    hooks[pointer] = hook;
  }

  // increment the hook pointer
  component.pointer += 1;
  return reduce(hook);
}

export function prepareHooksForRender() {
  const fiber = getCurrentComponentFiber();
  const {
    nodeInstance: component,
    root: { updateType },
  } = fiber;
  component.pointer = 0;

  // based on update type clone the hooks to deferred hooks
  if (updateType === UPDATE_TYPE_DEFERRED) {
    cloneHooks(component);
  }

  // call all the pending update before trying to render,
  const pendingUpdates = getPendingUpdates(fiber) as Array<FunctionalComponentUpdate>;
  pendingUpdates.forEach((task) => task.updater());
}

/**
 * Base logic for state hooks
 */

function useStateBase(
  initialState: any,
  getNewState: (state: any, lastState: any) => any,
): StateHookResult {
  const component = getCurrentComponent();
  const { pointer: hookIndex } = component;
  return getHook(
    (): StateHookResult => {
      /**
       * create a state hook
       */

      if (typeof initialState === 'function') initialState = initialState();

      const hook = [
        initialState,
        (param: any): void => {
          const updateType = getUpdateType();

          // get committed lastState, which will be up to date in sync hook list
          const currentHook = getCurrentHook(UPDATE_TYPE_SYNC, hookIndex, component);

          const lastState = currentHook[0];

          const shouldRerender = guardedSetState(component, (transitionId) => ({
            transitionId,
            updater() {
              /**
               * Get the hook again inside, as the reference of currentHook might change
               * if we clone sync hook to deferred hook
               */
              const stateHook = getCurrentHook(updateType, hookIndex, component);

              // The updater is now the only place where getNewState is called.
              stateHook[0] = getNewState(param, stateHook[0]);
            },
          }));

          if (shouldRerender) reRenderComponentIfRequired(component, param, lastState);
        },
      ];

      return hook;
    },
    defaultShouldUpdate,
    defaultReduce,
  );
}

/**
 * Use state hook
 */
export function useState(initialState: any): [any, StateCallback] {
  return useStateBase(initialState, (state, lastState) => {
    if (typeof state === 'function') state = state(lastState);
    return state;
  });
}

/**
 * Use ref hook
 */
export function useRef(initialValue: any): ObjectRef {
  return getHook(
    (): ObjectRef => {
      /**
       * create a ref hook
       */
      return {
        current: initialValue,
      };
    },
    defaultShouldUpdate,
    defaultReduce,
  );
}

/**
 * Use reducer hook
 */
export function useReducer(
  reducer: (state: any, action: any) => any,
  initialState: any,
  getInitialState: (initialState: any) => any,
): StateHookResult {
  /**
   * If getInitialState method is provided, use that to form correct initial state
   * Or else use passed initialState
   */

  const _initialState = getInitialState ? () => getInitialState(initialState) : initialState;

  return useStateBase(_initialState, (action, lastState) => {
    const state = reducer(lastState, action);
    return state;
  });
}

/**
 * use memo hook
 */
export function useMemo(create: () => any, dependencies: Array<any>): any {
  const createHook = () => {
    return {
      value: create(),
      dependencies,
    };
  };

  const shouldUpdate = (hook) => isDependenciesChanged(dependencies, hook.dependencies);

  const reduce = (hook) => hook.value;

  return getHook(createHook, shouldUpdate, reduce);
}

/**
 * Use callback hook
 */
export function useCallback(callback: Function, dependencies: Array<any>): Function {
  return useMemo(() => callback, dependencies);
}

/**
 * Base module to create effect hooks
 */
function useEffectBase(effectHandler, dependencies) {
  const fiber = getCurrentComponentFiber();
  const { nodeInstance: component } = fiber;
  const { pointer } = component;
  const hooks = getHooksListFromFiber(fiber);

  const lastHook = hooks[pointer] || {
    animationFrame: null,
    cleanEffect: null,
  };

  const hook = {
    ...lastHook,
    isDependenciesChanged: isDependenciesChanged(dependencies, lastHook.dependencies),
    dependencies,
    effect() {
      // if dependency is changed then only call the the effect handler
      if (hook.isDependenciesChanged) {
        effectHandler(hook);
      }
    },
  };

  hooks[pointer] = hook;
  component.pointer += 1;
}

/**
 * Use effect hook
 */
export function useEffect(callback: () => Function | null | undefined, dependencies: Array<any>): void {
  useEffectBase((hook) => {
    /**
     * Run effect asynchronously after the paint cycle is finished
     */

    // cancel the previous callback if not yet executed
    cancelAnimationFrame(hook.animationFrame);

    // run affect after next paint
    hook.animationFrame = requestAnimationFrame(() => {
      setTimeout(() => {
        hook.cleanEffect = callback();
      });
    });
  }, dependencies);
}

export function useLayoutEffect(callback: () => Function | null | undefined, dependencies: Array<any>): void {
  useEffectBase((hook) => {
    // run effect synchronously
    hook.cleanEffect = callback();
  }, dependencies);
}

/**
 * useImperativeHandle hook
 */
export function useImperativeHandle(ref: any, create: () => any, dependencies: Array<any>): void {
  useLayoutEffect(() => {
    if (typeof ref === 'function') {
      const cleanup = ref(create());
      // React 19: If cleanup is returned, do not call ref(null)
      if (typeof cleanup === 'function') return cleanup;
      return () => ref(null);
    } else if (ref !== null && ref !== undefined) {
      ref.current = create();
      return () => {
        ref.current = null;
      };
    }
  }, dependencies ? dependencies.concat([ref]) : undefined);
}

/**
 * useDebugValue hook. For now this is just a placeholder,
 * As there is no devtool support it. Revisit it when devtool is supported
 */
export function useDebugValue() {
  // This is just a placeholder for react compatibility
}

/**
 * useId hook
 */
export function useId(): string {
  const [id] = useState(() => getUniqueId());
  return id;
}

/**
 * Create context hook
 */
export function useContext(Context: ContextType): any {
  const { nodeInstance: component, context } = getCurrentComponentFiber();
  const { id, defaultValue } = Context;

  /**
   * $FlowFixMe: Context will always be present in component fiber
   * We have kept it optional for fiber as we don't want to create new object for each fiber
   */
  const provider = context[id];

  const value = provider ? provider.props.value : defaultValue;

  useLayoutEffect(() => {
    // subscribe to provider for the context value change
    if (provider) {
      const { subs } = provider;

      const callback = getConsumerCallback(component);

      subs.push(callback);

      return () => {
        subs.splice(subs.indexOf(callback), 1);
      };
    }
  }, []);

  // store the context value in current component so we can check if value is changed on subscribed callback
  component.context = value;

  return value;
}

/**
 * Standalone startTransition API
 * Start a transition in any context without using hooks.
 */
export function startTransition(callback: Function) {
  const transitionConfig = {
    // Unique ID to identify the transition
    transitionId: getUniqueId(),
    
    // Set the initial status to start
    transitionState: TRANSITION_STATE_START,
    
    /**
     * The engine's handleSuspender requires this array to track suspended Promises.
     * Without this, calling .includes() will cause a TypeError.
     */
    pendingSuspense: [],

    // Optional properties for future extensions
    tryCount: 0,
  };

  /**
   * Execute the callback within the global transition context.
   * This allows state updates (like setState) within the scope to inherit this transitionId.
   */
  let result;
  withTransition(transitionConfig, () => {
    result = callback();
  });

  // Handle async errors for standalone startTransition
  if (result && typeof result.then === 'function') {
    result.then(null, (error) => {
      console.error('Uncaught error in transition:', error);
    });
  }
}

/**
 * Transition hook
 */
export function useTransition(): UseTransitionResult {
  const component = getCurrentComponent();

  return getHook(
    () => {
      /**
       * create a transition hook
       */

      const hook: Transition = {
        transitionId: getUniqueId(),
        tryCount: 0,
        isPending: false,
        transitionTimeout: null,
        isRunningAsyncAction: false,
        asyncActionCount: 0,
        pendingSuspense: [],
        transitionState: TRANSITION_STATE_INITIAL,
        clearTimeout() {
          clearTimeout(hook.transitionTimeout);
        },
        updatePendingState(isPending, updateSource) {
          hook.isPending = isPending;

          // mark component to force update as isPending is not treated as state change
          component[BRAHMOS_DATA_KEY].isDirty = true;

          const reRenderCb = () => {
            reRender(component);
          };

          if (updateSource === UPDATE_SOURCE_TRANSITION) {
            withTransition(hook, reRenderCb);
          } else {
            withUpdateSource(updateSource, reRenderCb);
          }
        },
        startTransition(cb: Function) {
          const initialUpdateSource = getCurrentUpdateSource();
          const { root } = getFiberFromComponent(component);

          // reset the transitionState and pending suspense
          hook.transitionState = TRANSITION_STATE_START;
          hook.pendingSuspense = [];
          hook.isRunningAsyncAction = false;

          // clear pending timeout
          hook.clearTimeout();

          // set the transitionId globally so that state updates can get the transition id
          let result;
          withTransition(hook, () => {
            result = cb();
          });

          /**
           * If cb does not have any setState, we don't have to unnecessary
           * set isPending flag, transitionState and trigger reRender.
           */
          const hasSyncUpdates = root.lastDeferredCompleteTime < root.deferredUpdateTime;

          if (result && typeof result.then === 'function') {
            hook.asyncActionCount = (hook.asyncActionCount || 0) + 1;
            hook.isRunningAsyncAction = true;
            hook.updatePendingState(true, UPDATE_SOURCE_TRANSITION);
            doDeferredProcessing(root);
            result.then(
              () => {
                hook.asyncActionCount--;
                if (hook.asyncActionCount === 0) {
                  hook.isRunningAsyncAction = false;
                  hook.updatePendingState(false, initialUpdateSource);
                }
              },
              (error) => {
                hook.asyncActionCount--;
                if (hook.asyncActionCount === 0) {
                  hook.isRunningAsyncAction = false;
                  hook.updatePendingState(false, initialUpdateSource);
                }
                console.error('Uncaught error in transition:', error);
              },
            );
          } else if (hasSyncUpdates) {
            hook.updatePendingState(true, initialUpdateSource);
          }
        },
      };

      return hook;
    },
    defaultShouldUpdate,
    ({ startTransition, isPending }: Transition): UseTransitionResult => [
      /**
       * Reordered the return value to [isPending, startTransition] 
       * to match the modern React API signature.
       */
      isPending,
      startTransition,
    ],
  );
}

/**
 * A hook to have deferred value
 */
export function useDeferredValue(value: any, initialValue?: any): any {
  /**
   * Initialize the state with initialValue if provided (React 19 style),
   * otherwise fall back to the current value.
   */
  const [deferredValue, setDeferredValue] = useState(
    initialValue !== undefined ? initialValue : value
  );

  useEffect(() => {
    startTransition(() => {
      setDeferredValue(value);
    });
  }, [value]);

  return deferredValue;
}

/**
 * Method to run all the effects of a component
 */
export function runEffects(fiber: Fiber) {
  const hooks = getHooksListFromFiber(fiber);

  for (let i = 0, ln = hooks.length; i < ln; i++) {
    const hook = hooks[i];
    if (hook.effect) {
      hook.effect();
    }
  }
}

/**
 * Method to run cleanup all the effects of a component
 */
export function cleanEffects(fiber: Fiber, unmount: boolean): void {
  const hooks = getHooksListFromFiber(fiber);

  for (let i = 0, ln = hooks.length; i < ln; i++) {
    const hook = hooks[i];
    if (hook.cleanEffect && (hook.isDependenciesChanged || unmount)) {
      hook.cleanEffect();
    }

    // clear any pending transitions on unmount
    if (hook.clearTimeout && unmount) {
      hook.clearTimeout();
    }
  }
}
