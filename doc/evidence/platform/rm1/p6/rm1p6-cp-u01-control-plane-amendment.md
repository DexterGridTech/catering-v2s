---
title: RM1 P6 public authentication metadata control-plane amendment
packageId: RM1P6-CP-U01
status: ACTIVE_CONTROL_PLANE
---

# RM1 P6 public authentication metadata control-plane amendment

## Business problem and authorization

The approved P6 business requirement is that platform-admin and operations-admin users can begin login and password recovery without an existing authenticated session. The public protocol must establish its own server-validated flow or grant state; it cannot infer authority from the user, page key, or a selected workspace. The exact owner source also shows that operations recovery maps invalid flow/grant state to `WORKSPACE_IAM_GRANT_INVALID`.

Dexter authorized this narrow control-plane package to correct the authoritative metadata before U01 carries the corresponding contract, generated and application implementation. It admits metadata only and does not advance P6 implementation status or assert business behavior.

## Exact scope and exclusions

The only mutable authoritative metadata sources are the IAM governance manifest, the R5 edge operation catalog, and the R5 typed-error disposition catalog. The package adds the two platform login-OTP operations and the eight platform/operations password-recovery operations, and corrects the four existing anonymous admin-face password/OTP entries from `AUTHENTICATED_WORKSPACE` to `PUBLIC_PROTOCOL`. These fourteen credential, OTP or bound-flow operations use `PUBLIC_PROTOCOL_OWNER_FACT`; the pre-existing invitation/reset-token protocol remains on `PUBLIC_PROTOCOL_TOKEN`.

The existing current-password commands remain authenticated session operations. This package may not alter OpenAPI, owner code, generated outputs, frontend, database, U01 baseline, or historical receipts. It may not turn an owner-specific recovery error into a generic error or use the R5 catalog as a substitute for U01 contract evidence.

## Exit and handback

The control package exits only after exact metadata records, per-write receipts, static public-protocol validation and a package exit. It then restores U01 without changing the U01 baseline or receipt chain. U01 still owns its contract, code generation, owner behavior, tests, runtime evidence and cleanup closure.
