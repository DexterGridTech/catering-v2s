# U13 picker child-command runtime evidence

## Scope

This record covers the picker defect that was added to B4: both production
picker entries must consume the result of the picker actor's kernel child
command. It is separate from the release cold-start/U8 record and does not
claim the full U10 journey.

## Command and result

```text
cd apps/terminal/ui/feature/sample-wallpaper-picker
yarn test

Test Files  3 passed (3)
Tests       16 passed (16)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-feature-sample-wallpaper-picker
```

## What was actually exercised

`test/pickerSystemFailure.test.ts` builds a real kernel runtime with the
production picker module, production picker actor and production
`WallpaperPicker` component. The injected module is a test-only runtime child
module; it is not imported by production assembly and its module name is
covered by the production-bundle forbidden-surface scan.

The four relevant tests are:

| Test | Runtime path | Readback/effect |
| --- | --- | --- |
| `propagates a real child write-after select failure through the production picker actor` | picker option entry → picker actor → child select command throws after pending write | result is error; confirmed remains `none`; pending is `w2`; feature notice props are `select/after-write` |
| `propagates a real child write-after confirm failure without rolling back confirmed state` | picker confirm entry → picker actor → child confirm command writes then throws | result is error; confirmed is `w2`; pending is cleared; no fabricated rollback |
| `closes the real picker UI to child result readback and system notice without a manual notice dispatch` | actual `WallpaperPicker` option callback through `dispatchWithRequestId` | UI callback opens the feature-owned ephemeral notice; state readback remains `confirmed=none,pending=w2` |
| `closes the real picker UI to a truthful before-write notice from a runtime child failure` | actual picker UI callback with child rejection before mutation | pending remains empty; confirmed remains `none`; notice phase is `before-write` |

The child failure is constructed at the real runtime dispatch boundary, not by
calling the classifier, reducer, presenter or a manually fabricated parent
promise. The production actor now reads the child `CommandDispatchResult` and
the same-runtime before/after wallpaper snapshot; it cannot return `null` on a
child failure. The picker entry consumes both resolved system failure and
rejection, finishes the request, and dispatches this feature's notice intent.

## Red/production-surface control

The test-only injection module is named
`test.ui.sample-wallpaper-picker-failure-injection`. The normal production
bundle scan rejects that token, and the checker test's mutation control also
passes. Therefore this runtime fixture is not a production debug seam and is
not present in the release APK bundle.

The current focused result closes the real runtime injection requirement for
the tested child paths. PF-06/PF-07/PF-09/PF-10 and the complete U10/U13
device-shape matrix remain separate acceptance evidence until their own
recorded runs exist.

## Cleanup

`releaseRuntimeForTest` runs in every test's `finally` block. No managed
device/runtime process is started by this focused command; release APK and
device cleanup therefore remain in the U8 records.

