---
title: RM1 P6 receipt-rename control-plane amendment
packageId: RM1P6-CP-U00
status: ACTIVE_CONTROL_PLANE
---

# RM1 P6 receipt-rename control-plane amendment

## Business problem and authorization

The underlying P6-1 business capability remains unchanged: public entry, OTP and password recovery need additive owner migration. A controlled migration was first written under `V20260729_020000_000__platform_public_otp_and_recovery.sql`, then removed, and the same transfer byte appeared under the final `V20260729_021000_000__platform_public_otp_and_recovery.sql` before its recorded update. U01's baseline therefore truthfully has no final-path entry while the final-path receipt truthfully begins at the transfer byte.

Dexter authorized a separate non-business control-plane package to admit only this receipt-rename gap. It exists to preserve historical evidence, not to alter application behavior, contracts, generated outputs, a U01 baseline, or any historical receipt.

## Exact scope and exclusions

This package changes only `tools/compliance-control/cli.mjs` and `doc/evidence/platform/rm1/p6`. Its evidence must pin the final migration baseline/current bytes and the three immutable pre/post receipt pairs: old-path creation, old-path deletion, and final-path current update. A recovery is valid only if the old-path transfer byte equals the final-path receipt before byte and all receipt file hashes match.

The package must expose a P6-focused red self-test for a receipt-hash drift and for a false historical claim once a direct final-path ABSENT-to-current receipt exists. It may not widen the registry, reuse owner-scope baseline addenda, write or delete a business/contract/generated source, or claim business PASS.

## Exit and handback

The control package exits only after its own exact baseline/receipt/exit closure. It then restores the exact U01 active package bytes and validates the U01 migration through the new P6-only recovery registry. U01 still owes all ordinary owner, edge, generation, business and cleanup proof.
