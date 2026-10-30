# Expo merge compatibility adapter

Expo Config 58.0.9 depends on unmaintained `deepmerge` 4.3.1, for which the current
advisory has no fixed upstream release. This package **replaces its implementation**
with maintained `@fastify/deepmerge` 3.2.4. No vulnerable source is copied, no advisory
is ignored, and no patched version number is invented.

The adapter preserves the APIs actually used by this Expo release: default nested
merges, concatenating arrays, and the per-call `arrayMerge` callback used to remove
duplicate update entries. `merge.all` and `isMergeableObject` are also supported.
Unsupported options fail explicitly; this is not a general replacement for every
third-party use of deepmerge. Prototype keys are rejected by the maintained engine.

`LYRIA/.npmrc` enables install-links so npm packs this local package into the normal
node_modules tree. Keep that setting for clean installs and EAS/CI builds. The
package lives inside the mobile project so its source is included in mobile builds.
Changes to this manifest require refreshing `LYRIA/package-lock.json`.

`npm run test:dependencies` at the repository root verifies actual Expo config
modification, plugin merging, cloning, arrays, and nested prototype-pollution cases.
Review this adapter and its targeted override when upgrading Expo. Remove it when
upstream stops depending on the unpatched implementation.
