"use strict";
// Expo config uses default merging plus a per-call arrayMerge callback.
// Keep that interface while replacing the unmaintained implementation entirely.
const createMerge = require("@fastify/deepmerge");
function merge(target, source, options = {}) {
  for (const key of Object.keys(options)) {
    if (!["arrayMerge", "isMergeableObject", "clone"].includes(key) || (key === "clone" && options.clone === false)) {
      throw new TypeError("Unsupported Expo merge option: " + key);
    }
  }
  const settings = { symbols: true };
  if (options.isMergeableObject) settings.isMergeableObject = options.isMergeableObject;
  if (options.arrayMerge) settings.mergeArray = tools => (left, right) => tools.clone(options.arrayMerge(tools.clone(left), tools.clone(right), {
    ...options,
    cloneUnlessOtherwiseSpecified: tools.clone,
    isMergeableObject: tools.isMergeableObject
  }));
  return createMerge(settings)(target, source);
}
merge.all = (values, options) => {
  if (!Array.isArray(values)) throw new TypeError("Expected an array");
  return values.reduce((result, value) => merge(result, value, options), {});
};
module.exports = merge;
