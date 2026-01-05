// src/core/watch.js
import { getCurrentComponentFiber, getFiberFromComponent, markPendingEffect } from './fiber';
import { withUpdateSource } from './updateUtils';
import { BRAHMOS_DATA_KEY, EFFECT_TYPE_OTHER, UPDATE_SOURCE_IMMEDIATE_ACTION, UPDATE_SOURCE_TRANSITION } from './configs';
import reRender from './reRender';
import { handlePromise } from './use';
import { startTransition } from './hooks';

/**
 * The Constructor: Purely functional resource creation with smart cleanup.
 * Executes the listener registration immediately outside of the render cycle.
 */
export function initWatch(sub) {
  const promise = Promise.resolve(); // create an immediately fulfilled Promise.
  const listeners = new Set(); // A Set used as a listener registry.
  
  /**
   * Run the side effect (listener registration) immediately.
   * This is the functional equivalent of a class constructor.
   */
  const unsub = sub((val) => {
    listeners.forEach((l) => l(val));
  });

  /**
   * Smart Finalizer:
   * Only executes the actual destruction when no subscribers are left.
   */
  promise._finalize = (listenerToRemove) => {
    if (listenerToRemove) {
      listeners.delete(listenerToRemove);
    }
    
    // Physical guard: Prevent premature teardown of shared resources.
    if (listeners.size === 0 && unsub) {
      unsub();
    }
  };

  /**
   * Subscribe method:
   * Connects a component instance to the resource.
   */
  promise._subscribe = (l) => {
    listeners.add(l);
    // Returns a closure that calls the smart finalizer for this specific listener.
    return () => promise._finalize(l);
  };

  return promise;
}

/**
 * The watch API.
 * Bridges a shared resource to the component instance and handles suspension.
 */
export function watch(usable) {
  watchBase(usable);
}

watch.sync = (usable) => {
  watchBase(usable, { sync: true });
};

function watchBase(usable, option = {}) {
  startTransition(() => {
    const fiber = getCurrentComponentFiber();
    const inst = fiber ? fiber.nodeInstance : null;

    if (!inst) throw new Error('watch() must be called during render.');

    /**
     * Register the instance to the engine's observer system.
     * The 'use resource' pattern ensures that new promises are handled correctly.
     */
    if (usable._subscribe && !inst.__unmount?.has(usable)) {
      const listener = () => {
        const latestFiber = getFiberFromComponent(inst);
        if (latestFiber) {
          /**
           * Wrap the re-render call with an explicit update source.
           */
          const lane = option.sync ? UPDATE_SOURCE_IMMEDIATE_ACTION : UPDATE_SOURCE_TRANSITION;
          withUpdateSource(lane, () => {
            // Trigger the engine's re-render cycle.
            inst[BRAHMOS_DATA_KEY].isDirty = true;
            markPendingEffect(latestFiber, EFFECT_TYPE_OTHER);
            reRender(inst);
          });        
        }
      };

      // Obtain the instance-specific unsubscription function.
      const unsubscribe = usable._subscribe(listener);

      // Store the unmount logic.
      // See tearDownFiber() in tearDown.js if you want to use this unmount logic.
      if (!inst.__unmount) {
        inst.__unmount = new Map();
      }
      inst.__unmount.set(usable, unsubscribe);
    }

    // Delegate to handlePromise to manage the Suspense lifecycle.
    handlePromise(usable);
  });
}
