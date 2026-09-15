# S-1 / R-S7 terminal-failure repair evidence

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
DATE=2026-09-15
SCOPE=ui/base/render container-empty terminal failure boundary
STATUS=FOCUSED_PASS_DYNAMIC_OPEN

## Finding intake

Fresh CP2 round6 record `cp2-stage-reconciliation-round6-current.md` identified that
`ScreenContainer` kept `container-empty` as a bare fallback even after the runtime and a
physical PRIMARY host were resolved. That could leave a native splash without a render-owned
terminal failure page. The same record correctly distinguished this from a host `pending`
state: the latter has no terminal fact until the native host owner emits `unavailable`.

## First failure / broken boundary / last known good

- first failure: `yarn --cwd apps/terminal/ui/base/render test` failed only in the newly added
  focused test because the test destructured `{logger}` and then attempted `logger.events`;
  the production assertion itself had already found the failure page.
- broken boundary: focused test evidence readback, not `ScreenContainer` or the native loading
  capability.
- last known good: before the test fix, `renderSurface.test.tsx` had 66/67 tests passing and
  the new test found both `container-empty` and `ui.base.render:splash-failure`.
- repair: the test now retains `events` from `createLogger()` and reads the event sink through
  that value; no production behavior was changed for this test failure.

## Source repair

`apps/terminal/ui/base/render/src/components/ScreenContainer.tsx` now treats an empty container
as terminal only when all of the following are true: runtime status is `started`, host
availability is `ready`, the host is the physical primary display, and the bound surface
identity is `PRIMARY` at display index `0`. It preserves the `container-empty` fallback for
unhosted/test/Web/secondary or still-pending states, and it preserves the existing explicit
`unavailable` host path. The failure page is still owned by `ui/base/render` and uses the
existing `startup-failure` hide path.

The design and plan now state the complementary boundary: `pending` is not a terminal fact and
must not be converted to a production timeout; the native host owner must publish terminal
`unavailable` when it knows the host cannot be provided. The U8 observation bound is fail-closed
test-runner behavior, not a production splash timeout.

## Focused verification

```text
yarn --cwd apps/terminal/ui/base/render test
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-render
Test Files 12 passed (12)
Tests 67 passed (67)

yarn --cwd apps/terminal/ui/base/render typecheck
exit 0
```

The new red boundary is the focused assertion that a started/resolved physical PRIMARY
`container-empty` must contain `ui.base.render:splash-failure` and emit
`startup.failure-page-visible`; removing the production branch makes that test fail.

## Independent re-review boundary

The fresh CP2 round6 reviewer inspected the pre-repair source and reported the finding. A new
fresh CP2 reconciliation is required against these current bytes before whole-scope or dynamic
admission. Native/build/release/device/Web/Metro/DEV and cleanup remain OPEN here.

