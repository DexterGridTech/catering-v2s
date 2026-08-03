---
title: RM1 C01 root contract registry exact-set implementation amendment
status: IMPLEMENTATION_AUTHORIZED
packageId: RM1-C01-ROOT-CONTRACT-REGISTRY-U13
sourceDesign: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
---

# Purpose and confirmed root cause

The all-HTTP CRUD efficiency design requires one authoritative operation denominator before workload or performance claims. The root `contracts/openapi/edge.openapi.yaml` expands to 146 operations while the generated route registry has 147. The only registry-only operation is `releasePlatformStagedAsset`: `POST /api/platform/assets/staging/{assetRef}/release`, face `platform-admin`, owner `platform-asset`.

The route is not obsolete: its shard declares the operation, `PlatformAssetController` implements the same route, and the generated registry already exposes it. The root OpenAPI omits only its `$ref`. The repair is therefore to add that existing root reference and to make the existing edge-codegen contract check reject any root/registry operation-set drift.

# Constrained implementation

1. Add exactly one root `$ref` for `/api/platform/assets/staging/{assetRef}/release`, pointing to the existing group-workspace-management shard path.
2. In `scripts/generate/edge-codegen.mjs`, resolve root path references and derive a normalized operation tuple `(operationId, method, path, consumerFace, owner)`. Compare its exact set with the existing catalog-derived/generated-registry tuple set during `--check` and generation.
3. Extend the existing edge-codegen self-test with two real red mutations: delete the root release reference and make its root reference point to a non-matching shard path. Each must fail with the root registry-set drift signal.
4. Repair the successor-package bootstrap deadlock discovered while opening the next U13 delivery unit: a successor binding requires a delivery manifest, but the admission allowed only its input, amendment and problem-family evidence to be created. Permit exactly that successor's declared delivery-manifest path as a fourth bootstrap artifact; retain exact-set matching and forbid broad directory/bootstrap scopes. The admission self-test must prove omission of that manifest or a path outside the permitted evidence/review roots is rejected.

No controller, owner API, shard operation, generated output, frontend consumer, runtime behavior, DEV/seed/reset, L2, business result, cleanup result, or performance claim changes in this package. Generated artifacts remain projections and must not be hand-edited. The bootstrap repair is control-plane only; it does not grant a successor production surface.

# Completion and proof

Completion requires the root reference, exact-set enforcement, both red mutations, the successor-bootstrap red mutation, `edge-codegen --self-test`, `edge-codegen --check`, `openapi-contracts`, `remediation-compliance`, and a changed-path list that is a subset of the manifest. A passing C01 only proves static contract denominator closure and the bounded control-plane bootstrap repair; it is neither all-endpoint coverage nor a CRUD-performance, business, L2, DEV, seed, or cleanup PASS.
