# CP2 lockfile closure and first-failure record

RUN_DATE=2026-09-15
SCOPE=CP2/B2 package/link artifact closure
AUTHORITY=implementation authorization from Dexter; no Git operation

## First failure

The first command was malformed and was retained as a tooling failure:

```text
yarn install --immutable --mode=skip-builds
Usage Error: Invalid value for --mode: expected one of "update-lockfile" or "skip-build"
```

The corrected immutable check then exposed the actual repository boundary failure:

```text
yarn install --immutable --mode=skip-build
YN0028: The lockfile would have been modified by this install, which is explicitly forbidden.
```

The diff named stale workspace entries for the two App packages, missing adapter dependencies
under `assembly-base-android`, the new `ui-base-console-assembly` dependencies/peers, and the
picker contracts entry. This confirmed the fresh CP2 finding rather than treating it as a
device/build issue.

## Root cause and repair

The current package manifests and graph had moved the Android adapter ownership into
`apps/terminal/assembly/base/android`, removed direct App adapter/platform-ports declarations,
and added the shared console assembly dependencies. The existing `yarn.lock` still described the
previous workspace manifests. The main Codex regenerated only the lock projection with:

```sh
yarn install --mode=update-lockfile
```

No source, test, runtime, or Git action was part of this step.

## Re-verification

```sh
yarn install --immutable --mode=skip-build
```

Result: exit `0`, Yarn resolution/fetch/link completed. Yarn emitted pre-existing peer warnings
(`YN0002`/`YN0086`) but no lockfile mutation request; those warnings are not being relabeled as
package/link PASS. The lock closure itself is now green and requires a fresh CP2 read-only
reconciliation before CP2 can be marked matched.

## Boundary

- `FIRST_FAILURE`: stale `yarn.lock` workspace dependency projection.
- `BROKEN_BOUNDARY`: package.json/graph/source → lockfile workspace entry.
- `LAST_KNOWN_GOOD`: `yarn install --immutable --mode=skip-build` after the update-lockfile repair,
  with only the separately reported peer warnings.
- `OPEN`: fresh CP2 stage reconciliation, native/build/aapt2 proof, release/device and cleanup;
  immutable install success does not prove them.
