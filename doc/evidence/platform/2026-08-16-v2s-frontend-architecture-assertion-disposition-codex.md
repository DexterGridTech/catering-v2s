# Frontend architecture assertion disposition

## Scope

This record closes the source-assertion portion of Step 12 in:

- `doc/platform/frontend-coding-standard.md`
- `doc/review/platform/2026-08-16-v2s-frontend-remediation-sequence-claude.md`
- `project-memory/operations/frontend-coding-standard.md`

The baseline was 13 architecture files with 175 `assert.match` calls and 42
`assert.doesNotMatch` calls. The rule is not to delete all positive assertions:
an existence assertion may remain when it is paired with a meaningful
prohibition, while a UI behavior claim needs behavior evidence.

## Disposition

- 160 positive assertions remain inside boundary tests that also reject an
  explicit forbidden alternative. The paired tests cover generated-client
  ownership, app/face boundaries, legacy operation substitution, query-form
  boundaries, and immutable-field boundaries.
- The operations and platform audit page-size assertions now each reject a
  numeric page size other than `10`; removing the positive half would leave a
  `50`-row implementation unguarded.
- The operations context-generation test now rejects an unkeyed registration
  directly. Its red mutation removes the key and proves that the prohibition,
  rather than the same positive grep, turns red.
- Fifteen source-only UI behavior assertions were removed: public invitation
  next-step/heading/path rendering, operations shell branding/tab/icon
  rendering, authored-value truncation, and platform invitation-link
  rendering. Each is represented as an explicit `test.todo` for later no-seed
  browser/focused behavior evidence; no browser L2 result is claimed here.
- The RP-08 assertion for the exact local state spelling
  `[submitting, setSubmitting]` was removed because a harmless local-variable
  rename made it red. The shared-lifecycle behavior remains a TODO until a
  real focused or browser proof is added.

## Related false gate repair

`R5_FRONTEND_GENERIC_CLIENT_INVOCATION` was removed from
`tools/verify-gates/cli.mjs`, together with its red fixture. The generated
clients are typed objects, so calling one as a function is already rejected by
TypeScript; the old regex could only match an already-invalid program. The
remaining generic-operation-facade and raw-transport prohibitions are the
compile-valid boundaries that remain meaningful.

The Step 9.5 content-derived idempotency implementation also now passes
generated `*_OPERATION_IDS` constants instead of repeating operation ID string
literals in handwritten consumers, preserving the existing generated-contract
boundary.

## Evidence boundary

- Operations architecture: 13 passing tests, 4 explicit TODOs.
- Platform architecture: 9 passing tests, 1 explicit TODO.
- Operations Vitest: 66/66 passing.
- Platform Vitest: 9/9 passing.
- `node tools/verify-gates/cli.mjs frontend`: PASS.
- Operations and platform typecheck: PASS.
- Browser L2, complete HTTP, DEV, seed, reset, UAT and runtime behavior are
  not claimed by this record or by this goal.
