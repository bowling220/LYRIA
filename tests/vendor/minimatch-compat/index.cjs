'use strict';
// Legacy callers require minimatch as a function; modern releases expose it by name.
// Matching, parsing and amplification protections all remain upstream implementations.
const modern = require('minimatch-modern');
const compatible = (...args) => modern.minimatch(...args);
Object.assign(compatible, modern);
module.exports = compatible;
