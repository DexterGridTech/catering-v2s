---
title: RM1 P6-2 U06 organization and contract overview IA source reconciliation
status: CURRENT_SOURCE_RECONCILED
packageId: RM1P6-UI-IA-CONFORMANCE-U06
---

# U06 organization and contract overview IA source reconciliation

## Purpose and bounded ruling

This is a source reconciliation, not a silent rewrite of the accepted IA.  The 2026-07-29 IA03 screen sheets and
matrix state that organization and contract filters are unavailable until the named GAPs close.  Current owner
contracts, controllers, task reads, generated platform client, and platform-admin consumer now prove that both
GAPs are closed.  Therefore the old “筛选功能准备中”/disabled-control wording is superseded **only for U06 final
conformance of IA03-ORG-OVERVIEW and IA03-CONTRACT-OVERVIEW**.  The actor, workspace boundary, read-only task,
list-to-detail flow, no-operation-column boundary, and all other IA behavior remain unchanged.

## Reopened sources and factual comparison

| original IA claim | current owning source | reconciled fact |
| --- | --- | --- |
| IA03 organization overview: filters unavailable pending `GAP-PLATFORM-ORG-OVERVIEW-FILTER-SEMANTICS` and `...-CANDIDATES` | `contracts/openapi/paths/platform-admin/organization-overview.paths.yaml`; `PlatformOrganizationOverviewController`; `OrganizationOverviewTaskReadService` | Generated request accepts category/type/name/code/status/source/projectId/brandId/tenantId/page/pageSize.  The controller forwards all values to the organization owner `Query`; page and count use the owner predicate, and owner returns PROJECT/BRAND/TENANT candidates. |
| IA03 contract overview: filters unavailable pending `GAP-PLATFORM-CONTRACT-OVERVIEW-FILTER-SEMANTICS` | `contracts/openapi/paths/platform-admin/contract-overview.paths.yaml`; `PlatformContractOverviewController`; `ContractTaskReadService#list(ContractListQuery)` | Generated request accepts contractNo/storeName/phaseName/tenantName/itemCode/status/page/pageSize.  The platform edge is only a transport/DTO adapter; both platform and operations pass their page-specific conditions into the same contract-owner `ContractListQuery`, whose one predicate is shared by count and page and validates status/sort/direction. |
| UI must not client-filter/materialize a whole list | `PlatformReadPage.tsx`; `OrganizationOverviewFilters.ts`; `OrganizationOverviewFilters.test.ts`; `platform-read-boundary.test.mjs` | The selected workspace is passed through `contextScopedQueryArgs`; each submitted condition is placed in the generated request, tab changes remove STORE-only references, owner candidate options are consumed directly, and list rows open owner detail readback.  No client list filtering, operation column, or locally derived owner identifier is present. |

## Final control contract used by U06

### IA03-ORG-OVERVIEW

- The selected workspace is a prerequisite; `WorkspaceScope` prevents read when none is confirmed.
- Five fixed business tabs select hierarchy, brand, tenant, head company, or store.  Switching tab resets page and
  removes project/brand/tenant conditions outside STORE.
- Name and code are text inputs; status and source are fixed selects; STORE uses owner-returned project, brand, and
  tenant select candidates.  Submit resets pagination and sends all selected conditions to the organization owner.
- Loading, error alert, hierarchy empty prompt, page result, refresh, and name-link owner-detail readback remain
  distinct.  The page is read-only and has no action column.

### IA03-CONTRACT-OVERVIEW

- The selected workspace is a prerequisite.  Contract number, store, phase, tenant, and item code are text inputs;
  status is a fixed select.  Submit resets pagination and forwards the complete condition set to the contract owner.
  Platform sends no artificial project/store IDs: its different page purpose is expressed only by its own condition
  set.  Operations supplies its role-scoped project ID through the same owner query, rather than calling a parallel
  operations list implementation.
- Refresh rereads the active request.  Contract-number links open owner detail readback.  The page is read-only and
  has no action column.

## Proof boundary

`OrganizationOverviewFilters.test.ts` proves the organization query forwarding, owner-only candidates, and tab
cleanup; `platform-read-boundary.test.mjs` proves generated RTK reads, context scope, link-to-detail, and the
absence of a row action column.  These are focused implementation proof, not a managed-browser business result.
The U06 final record must retain this reconciliation and still require the contract-side focused proof, all screen
rows, and later managed L2 with separate business and cleanup PASS.

## Source hashes at reconciliation

| source | SHA-256 |
| --- | --- |
| IA03 decision | `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17` |
| organization OpenAPI path | `c36938fa43d75f5b5c1c731fe33fdadeca000c954f2c47a61534865bd47c70bf` |
| contract OpenAPI path | `b5e3d1a77cfef554d8558397af468d2fb7071de871b8b140b51c4d2cc3a7a6fa` |
| organization controller | `8d9563d8b67d580eeb043a7b0c86b03c8f89fbc83e5359175cbcaa5bc801b09f` |
| contract controller | `0ef9a10656646c37348934ee90686fbe585086193d58531ef1c0d74b7e061f5d` |
| organization task read | `076de4c784fd46ff91c92952e905cf04e5df8e668a39e3523e8ffe5a2b175ede` |
| contract task read | `2180c11ff5b87eb30db68ed04916cd31d94a97d7688e536b9fee66673d42f23d` |
| platform consumer | `9fe798d5fb6357c005ca65600481a5ccbb35e9f5df3535dddb5f37194ec25f1c` |
| organization query helper | `f8b5c32f7c6ca54fbf835175c4dff46acb62311c99ef35b0bf5101fc49c13929` |

## Explicit exclusions

- This does not add a client-derived operations address, edit/status control, or list action column.
- It does not convert the static focused proof into business PASS or authorize L2.
- It does not claim all 38 physical screens complete; it closes only the stale-GAP interpretation for the two
  overview screen entries while their remaining accessibility and final-record checks continue.

## Dexter 2026-07-30 list-operation-column reconciliation

Dexter's later hard boundary is that a list must not carry an operation column.  It supersedes the older
IA03-ACCOUNT-DETAIL wireframe's last “撤销任职” column without changing the approved user task or command:
the owner-readback assignment table now has only organization, role, and status columns; an administrator first
selects one owner-marked active assignment using the accessible radio selection, then activates the separate
detail-surface “撤销所选任职” control.  The existing IA03-ACCOUNT-ACTION confirmation Modal still receives exactly
one latest assignment and performs the same owner recheck.  Inactive assignments cannot be selected, selection is
cleared when the detail readback changes, and no inline list command or new screen is introduced.

This is a minimal interaction placement correction: it preserves account detail → independent confirmation Modal,
removes the prohibited action column, and does not change P6-3 behavior, owner APIs, permissions, or data shape.
