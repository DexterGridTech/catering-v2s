---
title: RM1-SEED-REPORT-U12 current design byte post-remediation intake
reviewTarget: IMPLEMENTATION
status: DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
createdAt: 2026-08-01
authorizationBoundary: This intake changes no production source, contract, schema, runtime, seed/reset or historical package-exit byte. It does not convert the historical U12 review into review of the current design byte.
---

# U12 current-byte binding

The active U12 input pinned `rm1-seed-report-package-design.md` at
`878cd3a4e18ed5180a6f989d844c61e0353ac409fbbcd2569b48fe57fede22f8`. The controlled write
`exec-ab02109a-6085-4a5b-8232-4bcda8f69cf8` subsequently changed that same design to
`4deb185fb105fbc828aa2c1c1e75450b28a9cef2c1a3aff0ad172d806921cf0a`.

The historic before-byte is not retained in the workspace, so this intake must not assert the
change was editorial or already reviewed. It instead applies the existing post-remediation rule:
the active input is mechanically rebound to the current byte only with this immutable provenance;
the current byte is explicitly not represented as independently reviewed, and a Claude recheck is
required before any statement that it has renewed U12 semantic acceptance.

## Reopened current obligations

The current design still limits U12 to the authorized minimal owner-command seed and joint L2,
keeps reset/UAT/full 32-scenario seed outside scope, requires canonical server operation metadata,
request-local accounting, secret exclusion, finally-written paired reports and separate business/
cleanup results. No production or runtime behavior changes in this intake. The existing U12 Claude
`S1` concerning two missing secret-negative focused proofs remains open and is not relabelled as
closed by this binding repair.

## Required recheck

Claude must read this intake, the current design byte, U12 round-two and final review, and the
controlled write receipt. The recheck is limited to whether the current design remains sound under
the originally authorized U12 boundary; it must report `GO`/`NO-GO` with `M/S/N`. Until then,
`static-scan` can prove only the input hash is mechanically current, not a renewed U12 semantic GO.
