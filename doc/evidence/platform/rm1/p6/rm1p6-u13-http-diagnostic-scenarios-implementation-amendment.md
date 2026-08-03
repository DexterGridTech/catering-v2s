---
title: RM1 U13 source-derived HTTP diagnostic scenario declaration amendment
status: IMPLEMENTATION_AUTHORIZED
packageId: RM1P6-HTTP-DIAGNOSTIC-SCENARIOS-U13
sourceDesign: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
---

# Purpose

The generated route-face registry supplies the exact 147-tuple denominator, but has no legal business
preconditions, transition facts, secret handling, rejection mapping or owner readback. C04 turns the
source-derived per-operation mapping into a validated declarative inventory; it does not execute a route.

# Source-bound declaration rule

Each of the 43 `platform-admin`, 89 `operations-admin` and 15 `public` tuples must be represented once.
Its identity is always injected from the generated registry; its fact must independently bind the real
business task, one legal positive or typed expected-rejection scenario, symbolic prerequisites, a
non-sensitive request shape, business oracle, owner readback or an explicit 204/no-body state readback,
and controller/owner source references. Group helpers may reduce duplicated syntax but cannot supply
unstated route facts or infer a scenario from a method/path/name.

Only symbolic handles may name credentials, OTPs, cookies, grants or invitation links. Their values,
identities, raw payloads, SQL/binds and headers are prohibited from the declaration and all later output.
The runner will receive a separate in-memory secret channel in a later package.

# Owning sources reopened before declaration

- Generated denominator: `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`.
- Contract shapes: root `contracts/openapi/edge.openapi.yaml` and the consumer-face path shards.
- Platform: `PlatformAuthenticationController`, `PlatformAdminGovernanceController`, platform workspace,
  workspace-IAM, asset, extension, organization overview, contract overview and audit controllers with
  their named owner APIs.
- Operations: workspace authentication/session/access, organization/business-entity/hierarchy/store,
  contract and audit controllers with `WorkspaceAuthenticationService`, `WorkspaceInvitationService`,
  `WorkspaceUserService`, `WorkspaceAccountService`, organization and contract owner APIs.
- Public: public asset, invitation, operations recovery and password reset controllers plus their asset
  and workspace-IAM owner APIs.

# Focused proof

The scenario fact set must exact-match the generated 147 tuples, reject a missing or fabricated operation,
carry explicit business/source/readback facts for every item, and reject an attempt to persist a secret-like
field or literal. This is declaration/static proof only: it is not a call/metric/correlation completion,
DEV, seed/reset, L2, business PASS, cleanup PASS or performance result.
