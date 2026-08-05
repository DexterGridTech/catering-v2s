# v2s Whole Engineering Second Package Implementation Design

## Package authority

- package: `WHOLE-ENGINEERING-SECOND-PACKAGE-20260805`
- scope: RP-07, RP-08, RP-10, RP-11; one atomic implementation and verification delivery
- review cycle: `WHOLE-ENGINEERING-SECOND-PACKAGE-20260805`
- implementation/runtime authority: granted by Dexter for this package only
- seed/reset, UAT, remote app/browser execution, database/migration, and Git: not authorized

## Intent and source reopen

This package closes the remaining user-facing journey and managed-runtime defects from the whole-engineering review. The governing business source is IA04: brand authorization is a total-company detail Drawer with owner-returned candidates and one-at-a-time add/remove commands; all form Drawers use the shared foundation lifecycle. D2 makes the repository-controlled host allowlist the only remote-host trust source. RP-11 requires proof of the complete runner-owned process tree, not only a leader PID. The first package is already closed as static implementation GO and is not reopened.

The implementation keeps one truth per layer: OpenAPI owns the wire shape, organization owner owns brand search semantics, generated clients/wires are regenerated, the frontend adapter sends one `queryText`, the foundation lifecycle owns submission state, the allowlist owns remote trust, and the managed runner owns process-tree identity and cleanup evidence.

## Alternatives and selected shape

An adapter-only patch would leave the owner contract on AND semantics and would make the UI/runtime appear correct while the wire remained wrong. A generic platform-wide search or lifecycle framework would expand the package without a second owner or journey. The selected bounded shape is to change the brand operation contract and owner query together, regenerate both consumers, connect the existing foundation lifecycle to every affected operations form Drawer, add two small pure runner helpers (host trust and process-tree proof), and keep business/cleanup evidence explicit.

## Unit RP-07 — brand authorization `queryText`

1. Replace the brand list operation's separate `name` and `code` query parameters with one `queryText` parameter. The canonical operand is `q = lower(trim(queryText))`; blank becomes null. The owner brand predicate is `(q is null) OR lower(name) contains q OR lower(code) contains q`, with status, workspace scope, stable ordering, and page slicing unchanged. Tenant and head-company operations keep their own existing semantics.
2. Update `OperationsBusinessEntityController`, `BusinessEntityService`, focused owner/edge tests, generated Java wire, generated TypeScript API, and the brand authorization adapter in one codegen invocation. The adapter sends exactly one request and never copies the same value into two parameters or unions pages client-side.
3. Align the brand page filter with IA04's “品牌名称/状态” surface. The displayed code column remains, but code matching is supported by the same `queryText` value through the owner OR predicate; no second code input is retained for this operation.
4. Focused proof covers name-only, code-only, uppercase/trimmed name and code, no-match, and page boundary. Red mutations prove AND semantics and duplicate-client-request/union behavior fail.

## Unit RP-08 — submission close state

The shared `useDrawerFormLifecycle.submitting` is the sole close truth. The exact `FORM_DRAWER` denominator is: `business-entity-management/ui/BusinessEntityCreateDrawer.tsx`, `BusinessEntityEditDrawer.tsx`, `HeadCompanyBrandAuthorizationDrawer.tsx`, `organization-structure/ui/RegionCreateDrawer.tsx`, `ProjectCreateDrawer.tsx`, `OrganizationEditDrawer.tsx`, `CommercialGroupEditDrawer.tsx`, `contract-management/ui/ContractCreateDrawer.tsx`, `ContractEditDrawer.tsx`, `store-management/ui/StoreCreateDrawer.tsx`, `StoreEditDrawer.tsx`, `workspace-user/ui/WorkspaceInvitationCreateDrawer.tsx`, and `authentication/ui/OperationsPasswordChangeDrawer.tsx`. Each entry binds mask, close icon, keyboard/Esc, `onClose/requestClose`, and footer cancel to the same submitting value. Detail Drawers, status Modals, result surfaces, and public invitation surfaces are explicit exclusions. The brand Drawer's existing local flag is removed; lifecycle submission state is the only value. Focused source tests enumerate this exact set and include a red mutation for any bare `maskClosable`, unconditional close icon, or local second submitting truth.

## Unit RP-10 — repository-controlled remote host trust

`contracts/policy/r5-remote-host-allowlist.json` is the normative non-production source. Each entry has host, pre-approved fingerprint, maintainer, and rotation timestamp/version. `scripts/dev/r5-remote-host-trust.mjs` resolves and validates exact entries; it never derives an expected fingerprint from the supplied host. Unknown host, wrong fingerprint, production-like host, and attacker-supplied host plus attacker-supplied hash all fail closed. A legal allowlist rotation is accepted only when the new pre-approved entry is read back. All managed manifests record host, fingerprint, allowlist version, maintainer, and rotation time.

The finite RP-10 consumer denominator is: `scripts/dev/r5-dev-environment.mjs`, `scripts/dev/r5-reset.mjs`, `scripts/dev/r5-dev-runner.mjs`, `scripts/dev/http-diagnostic-runner.mjs`, `scripts/dev/r5-seed-bootstrap.mjs`, `scripts/dev/terminal-fixture-state.mjs`, `scripts/test/r5-joint-remote-l2.mjs`, `scripts/test/r5-remote-testcontainers.mjs`, plus their focused tests and `contracts/policy/r5-remote-host-allowlist.json`. Every entry calls this resolver or validates authoritative environment readback; no consumer retains a self-hash fallback. The helper has a pure self-test with valid, unknown, wrong-fingerprint, attacker-pair, and rotation cases.

## Unit RP-11 — owned process-tree cleanup

`scripts/dev/managed-process-tree.mjs` provides identity-safe process-table parsing, recursive descendant discovery, group termination, and readback. Ownership is established by PID plus OS start token and PGID; process name or port is never used as ownership. `r5-dev-runner`, `http-diagnostic-runner`, and joint L2 record a root identity and tree snapshot in the run manifest, terminate only the owned group, and require an empty tree readback before cleanup PASS. A leader-dead/child-alive mutation is a hard cleanup FAIL even if business evidence is PASS. The production-path red fixture is a `r5-dev-runner --self-test` manifest containing a synthetic owned root/child: the root is marked dead while the child remains, the same runner cleanup evaluator must emit `cleanup=FAIL`, and the evidence retains first-failure, last-known-good and broken-boundary. Invitation bootstrap children are attributed through the same tree snapshot.

## Verification and package exit

The six package-exit source denominators are: (1) `USER_TASK_JOURNEY_IA`, (2) `OWNER_CONTRACT_GENERATED`, (3) `RUNTIME_RUNNER`, (4) `FOCUSED_PROOF`, (5) `BUSINESS_EVIDENCE`, and (6) `CLEANUP_EVIDENCE`. Every changed path has pre/post compliance-hook receipts and the non-empty receipt set equals the changed-path set. Static checks run first; then the managed local runtime executes with remote middleware only. Business and cleanup are reported separately, with first-failure logs and process identity retained. `businessStatus` and `cleanupStatus` remain `PENDING` until fresh evidence closes them.
