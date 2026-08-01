---
title: RM1 P6 generic control-plane source-template correction
packageId: RM1P6-CP-U03
status: ACTIVE_CONTROL_PLANE
---

# RM1 P6 generic control-plane source-template correction

## Business problem and authorization

Control-plane packages exist to preserve the truthfulness of P6 implementation evidence. A hardcoded historical package anchor means the source-disposition record can no longer identify the package it audits. Dexter authorized this isolated tooling repair so CP-U01 can close with a truthful source record; it changes no business behavior.

## Exact scope and exclusions

Only the compliance-control template and CP-U03 evidence may change. The manifest anchor must derive from the active delivery unit ID and the amendment anchor must derive from the active package ID present in its front matter. A focused self-test must prove CP-U01 produces its own two anchors, a mutation to the historical CP-U00 anchor is rejected, and a non-control U01 route remains on the non-control six-dimension branch.

## Exit and handback

After the control package exits, CP-U01 is restored unchanged and may produce its own source disposition and exit. CP-U02 remains a separate capability-invariant repair and is not folded into this package.
