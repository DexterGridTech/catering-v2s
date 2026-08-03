---
title: RM1 U13 public invitation single typed-load repair
status: IMPLEMENTATION_AUTHORIZED
---

`PF-HTTP-EFF-03` concerns the five public invitation commands: accept, send OTP, verify OTP, save
credentials and complete.  Each starts with `requireGroupInvitation`, which currently reads the same
token once to check the workspace key and again to create the typed `Invitation`; the OTP helper
chain adds further token reads after the caller already holds that invitation.

Repair only this owner-local reuse: load one typed invitation with a workspace/key guard at the public
command boundary and pass it to private helpers.  In particular, OTP issuing invoked by public send
must accept the already loaded invitation rather than re-reading a raw token.  Public helper overloads
used by delivery adapters retain their existing raw-token validation boundary.

No rate-limit bucket, OTP state transition, invalid-attempt update, grant check, CAS, password policy,
audit, completion account creation, owner readback or typed failure may be removed.  No invitation
fact moves to the public edge.  Focused tests must cover successful flow plus wrong mobile, invalid
OTP, expired/state-invalid invitation, replay and completion readback; statement reduction is
secondary to semantic equivalence.
