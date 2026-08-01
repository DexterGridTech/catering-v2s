---
packageId: RM1P6-CP-U16-P6-2-ADMIN-SURFACE-DENOMINATOR
status: DEXTER_AUTHORIZED_DESIGN_CONTROL
implementationAuthority: false
---

# P6-2 platform administrator surface denominator corrective design

## Business problem and original requirement

P6-2 separates two user tasks: a platform administrator manages the platform-admin administrator
population, while a selected group workspace administrator manages that workspace's accounts. IA03 binds
the first task to the platform-administration screen; the frozen catalog route registry also binds
`PLATFORM-ADMIN-USERS` to `AdministratorsPage`. The final UI roster and the physical import contract
instead named `workspace-iam/AccountsPage`, which is the separate `PLATFORM-WORKSPACE-ACCOUNTS` task.

If implementation chose either document without correction, a platform user could be delivered the wrong
management task. This corrective unit exists only to restore a single, unambiguous design denominator
before P6-2 implementation starts.

## Verified source truth

| source | verified binding |
| --- | --- |
| IA03 administrator list/detail/create/edit/credential/status | platform administrator task |
| `pageRegistry.tsx` | `PlatformAdminUsers` → `platform-administration/ui/AdministratorsPage.tsx` |
| `pageRegistry.tsx` | `PlatformWorkspaceAccounts` → `workspace-iam/ui/AccountsPage.tsx` |
| physical contract and roster before this correction | incorrectly conflated both tasks with `AccountsPage.tsx` |

The correction is mechanical: `PLATFORM-ADMIN-USERS` and all IA03 administrator child surfaces use the
`platform-administration/ui/` module and administrator-specific child component names. The
`PLATFORM-WORKSPACE-ACCOUNTS` row remains the sole `workspace-iam/ui/AccountsPage.tsx` consumer.

## Rejected alternatives and bounds

Ignoring the roster during implementation is rejected: it makes a final implementation-facing source
non-authoritative. Moving the route registration to `AccountsPage` is rejected: it would collapse the
two distinct user tasks and contradict IA03. This unit does not edit IA, routes, contract, owner, edge,
generated output, frontend production source, tests, runtime, DEV, seed, reset, or Roadmap state.

## Completion and prevention

Both final downstream source denominators must name the same route-backed module, and the granularity
manifest must carry their revised hashes. The finite problem-family evidence records the review rule:
every final roster path for a catalog page must be reconciled with its physical import contract and route
registration before the page is implemented.
