---
title: RM1 U13 Test fixture persistence-integrity repair
status: IMPLEMENTATION_AUTHORIZED
---

Remote Testcontainers exposed two fixture defects that occur before their target assertions. This unit
repairs test data only. `PlatformAssetServiceTest` must keep the production content-addressing and
unique storage-key behavior intact, but generate distinct valid PNG bytes for distinct staged assets.
`WorkspaceUserTaskScopeTest` must retain readable organization labels while deriving a separate bounded,
nonblank, unique `credit_code` that satisfies the owner schema.

No production source, schema, owner behavior, OpenAPI contract, browser L2, Seed/reset, performance
claim or authorization behavior may change. Focused proof is remote Testcontainers only: the asset suite
must exercise the two-object batch read without storage-key collision; workspace-iam must no longer fail
before its explicit head-company command-target assertion. The suite result and cleanup are reported
separately from business evidence.
