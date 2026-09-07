# TER terminal input CP-3 focused evidence

```text
CP=CP-3
SCOPE=sample consumers, local-frame matrix, and Web responsive surface tree
IMPLEMENTATION_AUTHORITY=true
CP3_RECONCILIATION=PASS
ANDROID_WEB_RUNTIME=NOT_RUN_BY_AUTHORITY
```

## Focused commands

```text
yarn workspace @catering-v2s/ui-base-dev-host typecheck
PASS

yarn workspace @catering-v2s/ui-base-dev-host test
PASS
Test Files  3 passed (3)
Tests       5 passed (5)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-dev-host

yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck
PASS

yarn workspace @catering-v2s/ui-feature-sample-member-desk test
PASS
Test Files  1 passed (1)
Tests       24 passed (24)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-feature-sample-member-desk

yarn workspace @catering-v2s/ui-feature-sample-staff-auth typecheck
PASS

yarn workspace @catering-v2s/ui-feature-sample-staff-auth test
PASS
Test Files  1 passed (1)
Tests       7 passed (7)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-feature-sample-staff-auth

yarn workspace @catering-v2s/ui-integration-sample-console typecheck
PASS

yarn workspace @catering-v2s/ui-integration-sample-console test
PASS
Test Files  6 passed (6)
Tests       15 passed (15)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console

yarn workspace @catering-v2s/kernel-feature-sample-member-registry typecheck
PASS

yarn workspace @catering-v2s/kernel-feature-sample-member-registry test
PASS
Test Files  1 passed (1)
Tests       9 passed (9)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-feature-sample-member-registry
```

## First failure and root-cause repair

The first CP-3 run found an obsolete `sample-console` test assertion that expected the old
outer content measurement and fixed canvas width. The responsive host no longer owns a logical
scale wrapper, so that assertion could not observe the new local-frame model. The test was changed
to invoke each real `InputSurfaceFrame` `onLayout` and observe untransformed responsive surface
style (`aspectRatio`, no transform, no numeric fixed width/height). No production fallback or
orientation change was added.

The first independent fresh read-only reconciliation then found five OPEN items. Four were
closed with focused/source evidence: explicit landscape/portrait local-frame consumer tests;
actual alpha/financial key and complete-path coverage; S-30..S-39 business assertions including
the narrow-frame recovery path; and the missing S-38 late-confirm member-store oracle. The Web
DOM hit-target observation remains a CP-4 dynamic evidence item because browser execution was not
authorized in this run; it is not reported as PASS here.

## CP-3 source and behavior boundary

- `MemberForm` registers alpha and financial fields after phone with explicit sample-only copy;
  submit and dirty read only name/phone, and the probes do not enter `Member`, `PendingMember`,
  command payloads, or customer confirmation.
- Focused local-frame matrix tests cover staff full in `1157 × 723` and `360 × 720`, member
  numeric/alpha/financial in both shapes, and customer numeric in confirm and handheld-confirm
  modes. The dimensions are test fixtures delivered through `InputSurfaceFrame.onLayout`; they
  are not App orientation declarations.
- The dual-screen assembly tests cover age input on SECONDARY, confirm-time age persistence,
  rejection without member creation, and withdrawal followed by a late confirm. The late confirm
  assertion compares the member collection before and after the late command.
- Narrow width `320` produces no virtual keyboard, exposes the unsupported-size notice, and leaves
  confirm/reject/hand-back actions available. The input package owns the scroll implementation;
  its real primitive scroll ancestor observation remains in `apps/terminal/ui/base/input/test/scrollArea.test.tsx`.
- `SurfaceCanvas` is responsive and untransformed; `sample-console` passes only `imeInset` to
  `InputSurfaceFrame`. No App orientation, Manifest, Activity handler, Presentation topology,
  host, VM, process, or device policy change belongs to CP-3.

## Independent stage reconciliation

Second-round fresh independent read-only result:

```text
CP3_RECONCILIATION=PASS
MATCHED=6
OPEN=0
REVIEW_SCOPE=CP-3 only
```

The six matched rows were: the real consumer matrix; alpha/financial key and complete behavior
with sample-only boundary; S-30..S-39 coverage; static Web responsive-tree boundary; forbidden
scope boundary; and evidence-tier separation. Browser `getBoundingClientRect`/
`elementFromPoint` proof and any Android/Web runtime proof remain explicitly deferred to CP-4
dynamic evidence and are not promoted to a runtime result by this document.

Model red vectors and production focused results remain separate. This file does not claim a Web
browser run, Android run, real POS validation, or real physical pointer-rectangle validation.
