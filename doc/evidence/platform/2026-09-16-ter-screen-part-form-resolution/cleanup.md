# TER screenPart 机型解析 · obsolete-source and runtime cleanup evidence

```text
SCOPE=implementation obsolete-source check and authorized runner cleanup
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
```

## v1 source check

The implementation plan required a consumer-first check before deleting any old
orchestration source, alias, or test. The current repository was searched from the
repository root with:

```text
rg -n -i "v1|v2|作废|obsolete|deprecated|old hand-built|旧.*路径|旧.*source" \
  doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md \
  doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md \
  doc/review/platform/2026-09-16-ter-screen-part-form-resolution*

rg --files apps/terminal/ui/base/admin-shell apps/terminal/ui/base/render \
  apps/terminal/ui/base/primitives apps/terminal/ui/integration/sample-console \
  apps/terminal/ui/integration/sample-wallpaper-console | sort

rg -n "AdminShell|AdminShellLaptop|AdminShellMobile|AdminSectionNavigation|AdminSectionNavigationLaptop|AdminShellFrame|sections/.*(Laptop|Mobile)" \
  apps/terminal --glob '*.{ts,tsx}'
```

The first search found only plan/review vocabulary and current historical review context;
it did not identify a concrete v1 source file to remove. The second search enumerated the
current live source tree. The third search confirmed that `AdminShell.tsx`,
`AdminSectionNavigation.tsx`, and the form-specific renderers are current imports or current
public/compatibility boundaries, not unreferenced v1 leftovers. In particular,
`AdminShell` remains the existing compatibility wrapper and `AdminLayer` remains the
authenticated owner; neither is safe to delete as cleanup.

```text
OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED
DELETIONS_PERFORMED=NONE
REASON=no concrete obsolete source path was present and current similarly named files have live consumers/public ownership
```

No blind deletion or empty-shell retention was used to satisfy a test. If a future review
names a concrete obsolete path, it must repeat the same exact consumer search before any
removal.

## Authorized runtime cleanup

All current release runs reported cleanup separately from business behavior:

| run family | scenarios | cleanup |
|---|---|---|
| U8 release cold-start | sample-terminal mobile/dual; sample-wallpaper-terminal mobile/dual | PASS for every scenario |
| sample1 frozen journey | mobile normal; dual normal | PASS for every scenario |
| sample2 frozen journey | mobile; dual | PASS for every scenario |

The runners removed their remote UI dump files, verified absence, force-stopped only the
package they owned, and checked that the package PID was absent. Their raw command logs and
per-scenario cleanup/result fields remain under
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/`.

```text
BUSINESS_CLEANUP_SEPARATED=true
CURRENT_RUN_CLEANUP=PASS
UNKNOWN_PROCESS_ACTION=NONE
```
