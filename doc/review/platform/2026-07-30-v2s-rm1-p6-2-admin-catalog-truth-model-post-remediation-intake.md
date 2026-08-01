---
title: Admin catalog truth model round-2 post-remediation intake
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-MODEL-20260730
REVIEW_TARGET: DESIGN
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
binding: POST_REMEDIATION_V1
status: DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
implementationAuthority: false
---

# Admin catalog truth model round-2 post-remediation intake

## Provenance

- immutable round-2 review: `doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-independent-round-2.md`
  (`271e9ce982968cd177c672953227f4e457e45dc9bd4eeca4cd863de48ae90869`);
- current repaired design: `doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md`
  (`bb28dace499c1f0096f0e48685f3532f26581017f8ab2b729828c294fcbf435a`);
- `currentBytesNotReviewedByAdversarialReviewer=true`;
- `claudeRecheckRequired=true`.

The two independent rounds are exhausted. This intake neither changes the
historical verdict nor asserts design GO or implementation authority.

## Verified dispositions

| Round-2 finding | Disposition | Current design repair |
| --- | --- | --- |
| S-1 optional operations business access | `CONFIRMED` | PAGE is now a strict union of 5 `OperationsRoleHomePage`, 12 `OperationsBusinessPage`, and 8 `PlatformPage`. Only operations business pages have mandatory `pageAccess + experience`; role home and platform pages prohibit those wrong-domain fields. |
| S-2 incomplete user-management projection | `CONFIRMED` | the required projection is now `userManagementFor(pageKey)`, containing target organization, invite action and role-revoke action; both current feature consumers are named. |
| S-3 semantic label reference | `CONFIRMED` | `labelRef` is removed. Every distinct business node owns a non-empty label; accidental equal strings create no cross-node relationship. |
| N-1 Java diff precision | `CONFIRMED` | a future package must freeze the old resolved Java projections and permit only the generated role-home lookup plus the home-switch replacement. |

## Scope and prevention

The failure pattern is “one static management relation split between positional
tuples, a parallel binding map, and an owner-code bypass.” The finite
denominator is 25 PAGE, 34 ACTION, 4 navigation group, 4 action group, 17
experience and 10 user-management relations. The smallest reusable prevention
is the single discriminated node list plus generator set/relationship checks;
the catalog does not absorb router ownership, dynamic owner facts, or
request-level security.

The only next review is Claude's independent recheck. No catalog, generator,
backend or frontend implementation starts from this intake.
