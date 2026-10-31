# Matcher compatibility for Firebase CLI test tooling

Firebase CLI 15.34.2 is the latest available parent at this update. Its legacy
CommonJS callers and Superstatic call `require('minimatch')(path, pattern)`;
maintained minimatch exposes this function as `.minimatch`. This tiny adapter
bridges that call shape and forwards the maintained named exports, including the
Minimatch class used by glob and readdir-glob. It contains no copied matcher or
parser code. All matching and amplification protections come from minimatch 11.0.3
via the explicit npm alias `minimatch-modern`.

The adapter is a direct local test dependency referenced by `$minimatch` in npm
overrides. `tests/.npmrc` uses install-links=true so clean installs package it with
its declared dependency rather than requiring an uninstalled workspace symlink.
The alias retains its real upstream name/version in the lockfile and audit data.
No vulnerability exception, falsified upstream version, or audit suppression is used.

This implements the interfaces used by the current CLI dependency tree, not every
historical minimatch API. In particular, the removed makeRe regex-building API is
not reintroduced. Actual parent callers were inspected; none require it. Any new
caller/API dependency must be reviewed and tested before upgrading.

The exact old glob 10.5.0 edge is separately upgraded to patched glob 14.0.3.
Compatibility tests exercise Firebase file discovery/ignores, Superstatic source
patterns, Archiver/Readdir globs and ZIP creation, Exegesis controller loading,
Rimraf glob cleanup, and canceled traversal. Emulator tests and the complete browser
suite verify the application's test infrastructure remains usable.

Remove the compatibility layer once upstream parents use patched versions through
supported dependency ranges. Keep future updates in reviewed PRs and retain the
upstream ISC license in installed minimatch; this adapter's original glue is MIT.
