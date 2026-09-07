# TER terminal input CP-1 focused evidence

```text
CP=CP-1
SCOPE=local frame measurement and input public-face convergence
IMPLEMENTATION_AUTHORITY=true
ANDROID_WEB_RUNTIME=NOT_RUN
```

## Focused commands

```text
yarn --cwd apps/terminal/ui/base/input typecheck
PASS

yarn --cwd apps/terminal/ui/base/input test
PASS
Test Files  7 passed (7)
Tests       36 passed (36)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input

yarn --cwd apps/terminal/ui/integration/sample-console typecheck
PASS

yarn --cwd apps/terminal/ui/integration/sample-console test
PASS
Test Files  6 passed (6)
Tests       13 passed (13)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console
```

CP-1 also re-ran the already affected feature packages after the frame-test fixture migration:

```text
@catering-v2s/ui-feature-sample-member-desk: typecheck PASS; 17/17 REAL_TESTS PASS
@catering-v2s/ui-feature-sample-staff-auth: typecheck PASS; 5/5 REAL_TESTS PASS
```

## Independent stage reconciliation

Fresh read-only reviewer result:

```text
CP1_RECONCILIATION=PASS
MATCHED=10
OPEN=0
REVIEW_SCOPE=CP-1 only
ANDROID_WEB_RUNTIME=NOT_RUN
```

The ten matched rows covered: root `onLayout` measurement; unmeasured first-frame behavior;
geometry/capacity constants; removal of `surfaceSize` and `InputSurfaceSize`; private measurement
types and index/invariant alignment; assembly retaining only `imeInset`; no Android orientation or
topology source change; unsupported resize owner cleanup; real first-frame component behavior; and
all affected fixtures explicitly invoking the real frame `onLayout` seam.

The first reconciliation attempt was intentionally retained as a historical first failure: it
found the private-type export, active-owner resize dead state, and missing first-frame/fixture
coverage. Those were root-fixed before the final PASS; no runtime claim is derived from this file.
