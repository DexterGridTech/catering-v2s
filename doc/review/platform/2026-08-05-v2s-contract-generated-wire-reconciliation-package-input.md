# Contract/generated-wire reconciliation package input

`REVIEW_TARGET=IMPLEMENTATION`

This is Dexter's explicit GO for the large static reconciliation package after RP-02a's final
independent review identified generated-contract drift. Reopen before judging any byte:

- `doc/plans/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-implementation-design.md`
- `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-implementation-amendment.md`
- `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-package-exit.json`
- `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-round2.md`
- `.runtime/compliance-control/active-package.json`
- `project-memory/decisions/deterministic-context-only.md`
- `contracts/policy/standards-coverage-matrix.json`

The accepted semantic truth is U27's owner-confirmed `scopeContext`, server-derived project scope,
the owner-emitted `HEAD_COMPANY` page/navigation scope, and the four-field invitation action
(`scopeRef` optional plus required `expectedContextVersion`, `expectedVersion`, `idempotencyKey`).
The source catalog must make those facts replayable; generated YAML/Java/TS must not be hand-edited.
The prior RP-02a workload repair is retained with the finite invitation-action context/version
exception.

Post-review recheck input: Claude identified one remaining contract site where
`WorkspaceRolePage.pageAccessCatalog[].requiredDataNodeType` did not contain `HEAD_COMPANY`, even
though `WorkspaceAuthorizationCatalog.pageCatalog()` emits `PG-IAM-HEAD-COMPANY-USERS` and the
owner controller forwards it without filtering. The package denominator is therefore extended with
an `ENUM_PROPERTY_SURFACE` dimension covering every same-name property occurrence.

Required proof: `standards-coverage --phase R5`, `r5-edge-materialize --check`, materializer
self-test with real path/component/exception red mutations, `edge-codegen --check`, focused
diagnostic tests, syntax/JSON checks, current source hashes, and non-empty pre/post receipts for
every file actually changed. No DEV, HTTP, browser L2, seed/reset, UAT or Git action is in scope.

Independent reviewer must inspect the source and focused tests before reading author intake or any
Claude material, form a falsification-oriented verdict, and stop after review round 2. Only after
that verdict may Codex write intake and provide the copyable Claude brief.
