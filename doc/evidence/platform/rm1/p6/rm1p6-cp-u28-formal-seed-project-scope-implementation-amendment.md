# U28 formal seed PROJECT session-scope repair

## Dexter authorization and bounded objective

Dexter authorized this successor package on 2026-08-05 to repair the formal
`r5-full` owner-command seed after run
`rm1-seed-1254f68b-88e2-4a86-b889-e9d43f765960` stopped at
`store-store-operating_HTTP_403_PLATFORM_COMMON_ACCESS_DENIED`.

The repair is limited to the four explicitly declared script/test surfaces and
this package's evidence. It authorizes the mandated managed reset → start →
formal seed sequence only after focused proof passes. It does not authorize a
new API, capability, fixture SQL channel, manual reset, UAT, browser L2 claim,
or a rerun against the partial seed database.

## Confirmed owner/contract behavior

The GROUP assignment used by the executor starts with no selected PROJECT.
`createOperationsOrganizationStore`, store status transitions,
`createOperationsContract`, and `invalidateOperationsContract` derive their
project from owner-confirmed session scope. The executor must therefore read
the session entry after login and retain its `contextVersion`.

Before a command in another project it calls the existing generated operation
`selectOperationsWorkspaceSessionDataNode` with only:

```json
{"dataNodeRef":"<project id>","dataNodeType":"PROJECT","requiredContextVersion":"<last owner version>"}
```

The returned `contextVersion` replaces the local value. Consecutive commands
for the same project reuse that context; a project transition selects again.
Store and contract create bodies omit `projectId`, as their closed schemas and
owner controllers require.

## Finite implementation and proof denominator

The actual executor denominator is store creation, store status transition,
contract creation, and contract invalidation. The static generated-operation
denominator includes those four commands plus session entry and data-node
selection. Focused tests exercise A → A → B → A selection, rolling versions,
missing owner response version, stale request-body fields, and registry
absence. Seed-report tests preserve controlled lower-case/hyphenated stage
identifiers while redacting all sensitive value shapes.

## Readback and prevention

The formal run must start from a fresh reset, preserve its first failure if any,
and produce run manifest, owner readbacks, seed report pair and backend log.
Business and cleanup remain independent. The generic failure is recorded in
the paired problem-family evidence and prevented by focused source tests; it is
not solved by a retry, a client-supplied project ID, or report suppression.
