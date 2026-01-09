# Potate Native Component

* In Native Mode, `PureComponent` and `memo()` offer no benefit.
  In fact, using them will likely decrease performance due to the overhead of unnecessary comparisons.
* In Native Mode, always use standard HTML attributes. For example, use class instead of className.
* In Native Mode, always use standard HTML event names. You don't need to use camelCase (e.g., use onclick instead of onClick).
* In Native Mode, the `style` attribute expects a CSS string, not an object.
* In Native Mode, use the `innerHTML` property directly (e.g. `<div innerHTML={htmlString} />`) instead of `dangerouslySetInnerHTML`.
