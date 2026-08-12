# Final catalog-contract and executable-DAG design authorization

implementationAuthority: false
runtimeAuthority: false
scope: design-only

## Objective

Prepare a bounded correction to the final backend-performance fixture design. The correction must
make the 396-row workload's owner-derived values and two catalog owner response shapes honest
before any static assembler or managed dynamic execution is attempted.

## Fixed boundary

- The workload remains 396 rows: U05 78+5, U04 79+38 and U07 196.
- Platform administrators remain platform-admin actors; operations writes remain operations-admin
  sessions with selected data node, live capability and owner recheck. No platform session gains a
  workspace capability.
- Temporary external-order item preparation uses existing normal owner HTTP create -> save ->
  detail -> preflight -> execute in the final isolated namespace. No terminal fixture, SQL, RM1/R5
  runtime/root, reset, seed, new API, deployment or UAT is in scope.
- This design admits only a six-path catalog owner/edge/consumer response-correction unit. The
  592-binding literal DAG remains a separate future detailed-design unit after these canonical
  response shapes are proved. Canonical OpenAPI, generators and generated artifacts are read-only
  inputs and must be reproducibility-checked.

## Required proof before later implementation

The next static implementation must obtain a fresh independent DESIGN GO plus Claude recheck;
then, and only then, expand the static package manifest/approved surface. Dynamic authority stays
false here and no SQL numerical optimization claim is authorized.
