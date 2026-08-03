---
title: RM1 U13 workspace session-entry owner reuse repair
status: IMPLEMENTATION_AUTHORIZED
---

`PF-HTTP-EFF-04` concerns the three operations session-entry paths: password login, OTP verification
and existing-session entry.  The first two create a workspace session and then the edge asks the
owner to compose that entry again.  The existing-session route first resolves a session for its
workspace guard and then independently asks for the canonical entry, duplicating the same session
resolution boundary.

Repair this only inside `workspace-iam`: password and OTP login return the canonical
`WorkspaceSessionEntryReadback` with the raw token, and a key-bound entry owner method validates the
raw token's workspace key before composing the entry.  The operations edge writes its existing
HttpOnly cookie and maps the owner entry to generated wire; it must not build role, navigation,
authorization, visible-data-node or context facts itself.

The repair preserves the existing general `LoginResult` and its P4 SQL-budget denominator.  Only the
HTTP login paths use a narrow owner-local entry result that skips the intermediate general-session
read; the public-flow test asserts OTP login's account-bound owner entry.  No HTTP schema, OpenAPI
face, generated wire, cookie policy or public-security operation changes.

Preserve credential verification and lockout, login/OTP rate limits, OTP supersede/expiry/attempt and
one-time consumption, enabled-account/workspace checks, fresh token issuance, session expiry,
typed 401/422/429 failures, context-version/CAS flows, the canonical session-entry task readback,
and logo resolution through the asset owner.  The key-bound GET must reject a token belonging to a
different group workspace inside the owner; removing the edge check without this owner check is
forbidden.

Focused proof must cover password and OTP success wiring without a second owner `sessionEntry` call,
the key-mismatch typed rejection, one-time OTP replay failure, and P4's actual SQL budget.  Any
budget change is acceptable only when its measured operation chain is reduced and all semantic
assertions remain true; it must not be concealed by changing an expected count alone.

## Runtime safety correction

Before final remote proof, the runner must reject an earlier identity-matching managed process,
RSS above 2048 MiB, or a pre-existing `org.testcontainers=true` container/volume. It records
resource observations in the manifest and treats residual Testcontainers resources as cleanup
failure. It never guesses ownership or kills an unknown process. This changes no C14 owner, wire,
HTTP, seed/reset, L2 or business behavior.
