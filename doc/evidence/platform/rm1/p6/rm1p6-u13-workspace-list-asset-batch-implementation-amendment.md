---
title: RM1 U13 workspace-list asset batch read
status: IMPLEMENTATION_AUTHORIZED
---

`listPlatformGroupWorkspaces` currently invokes the asset owner once per workspace logo. Add a
narrow asset-owner batch task read for the page's distinct logo references and map its result in the
edge only. The owner performs one bounded `IN` metadata query, still rejects any missing/non-ACTIVE
asset or missing object, and constructs public URLs itself. The existing single-reference API remains
the source for detail and other single-object consumers. This changes neither workspace ownership,
asset bytes/storage semantics nor cross-owner writes.
