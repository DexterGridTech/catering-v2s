# TER screenPart post-fix startup readiness ports reconciliation

```text
REVIEW_TARGET=POST_FIX_RECONCILIATION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEW_FALLBACK=NONE
REVIEWER=McClintock
AGENT_ID=01a0a9ce-4c45-7460-b351-c8a654993fe7
READ_ONLY=true
VERDICT=MATCHED
M=0
S=0
N=0
```

## Scope

This fresh, read-only reconciliation checked the post-fix startup readiness boundary:
`console-assembly` must not use development-only port descriptor metadata as a
functional release prerequisite. It compared the current source with the screenPart
requirements, implementation design, implementation plan, and the applicable project
memory/terminal standards. It did not modify files, use Git, or run a device, Android,
Web, visual, release, or cleanup validation.

## Matched facts

1. `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`
   checks the ten required `PlatformPorts` bindings for `groups.ports`. The predicate
   does not require `descriptorStatus === 'complete'`.
2. `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`
   keeps the startup tracker and descriptor diagnostics behind `__DEV__`; it remains a
   sink/diagnostic owner and does not write or decide `startup.complete`.
3. `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`
   still requires `modules`, `slices`, `commands`, `actors`, `ports`, and `parts`, plus
   PRIMARY declared, measured, and real-ready facts before writing one completion event.
4. The release-like focused fixture in
   `apps/terminal/ui/integration/sample-console/test/support.ts` strips descriptor
   metadata, while `sampleAssembly.test.tsx` still requires two independent
   `startup.complete` identities. The focused suite passed with 8 files / 38 tests.
5. The prior mechanism-batch and B-batch reconciliations remain applicable: this fix
   changes only the startup ports readiness predicate and its release-like test boundary;
   it does not change the admin layout, hook, catalog, or screenPart ownership.

## Evidence boundary

```text
SOURCE_AND_FOCUSED= MATCHED
NATIVE= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
ANDROID= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
WEB= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
VISUAL= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
RELEASE= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
CLEANUP= OPEN_NOT_RUN_BY_THIS_RECONCILIATION
```

The `MATCHED` verdict is limited to this post-fix source/focused reconciliation. It is
not an implementation-acceptance or release PASS.

## Residual risk

Reconnecting `descriptorStatus` to `startupReadiness.groups.ports` would reintroduce the
release failure because production descriptors are intentionally absent. Any such
change must therefore fail the release-like focused fixture before it can proceed.
