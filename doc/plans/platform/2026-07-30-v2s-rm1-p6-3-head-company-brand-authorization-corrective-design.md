---
title: RM1 P6-3 head-company brand authorization corrective design
status: DEXTER_AUTHORIZED_DESIGN_ADMISSION
implementationAuthority: false
---

# RM1 P6-3 head-company brand authorization corrective design

## 1. Business problem, source and placement

The authoritative business source is
`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`, §12.2
“总公司经营品牌”.  An **运营管理后台** administrator has opened a selected total-company detail Drawer.  Their
business goal is to see the owner-confirmed current authorized brands, add one eligible brand, or remove one
authorized brand while safely learning when a store still uses it.  The approved interaction is a searchable
candidate Select plus an immediate single add, and current rows plus an immediate single remove; it is explicitly
not a multi-select draft or a “save all” action.

This belongs to P6-3 because its actor, selected assignment/context, operation consumer face, owner task-read and
Drawer all belong to `operations-admin`.  It is not a platform governance task and must not be an exception in
P6-2.  The existing page still calls the retired collection-replace operation, while current contract and owner
bytes expose per-resource add/remove commands; P6-3 must correct that mismatch without moving any other P6-3
surface forward or recreating bulk semantics.

## 2. Current fact, GAP and future exact chain

The P6-3 implementation set is exact:

- Detail/readback: `getOperationsOrganizationHeadCompany` returns the owner-confirmed authorization membership.
- Candidate search is **not yet owner-paginated in current bytes**. The contract accepts `name`, `status`,
  `expectedContextVersion`, `page` and `pageSize`, but `BusinessEntityService#listEntities` currently returns an
  unfiltered `List` and `OperationsBusinessEntityController#page(...)` filters, sorts, counts and slices it at the
  edge. Record this as `GAP-BRAND-CANDIDATE-OWNER-PAGINATION`; it is neither a candidate-ready claim nor a reason
  to fetch a full browser list.
- One add intent: `addOperationsOrganizationHeadCompanyBrandAuthorization` is one POST containing one `brandId`.
- One remove intent: `removeOperationsOrganizationHeadCompanyBrandAuthorization` is one DELETE containing that
  `brandId` in its path.

`BusinessEntityService` remains owner for the authorization and detects the in-use condition before delete and on
database integrity conflict. Current `ContractProblemAdvice` handles its subclass through the generic
`OrganizationConflictException` fallback, so the declared OpenAPI code is **not yet the current edge result**.
P6-3 must add an explicit most-specific owner-exception → edge 409 generated-code mapping before the superclass
fallback; generic conflict mapping is not sufficient. The operation contract already declares the safe code.
For this future slice, `OperationsTransport`, adapter and Drawer state carry **only** the declared `errorCode`; no
blocker/details field is admitted.  They must never copy raw `Problem.detail`, a store identifier, a store count,
`brandAuthorizationBlockers`, `visibleStores`, or any persistence-derived detail into feature state.  The Drawer
maps the code to the fixed copy “该品牌仍被门店使用” and keeps that row unchanged.

Before UI binding, P6-3 closes `GAP-BRAND-CANDIDATE-OWNER-PAGINATION` by changing
`OperationsBusinessEntityController#brands` and replacing the general owner `List` read
used by this operation with an owner query whose exact predicate is `entityType=BRAND`, workspace, group key,
`name`, `code`, `status`, `sort`, `direction`, `page` and `pageSize`, and whose result contains current-page items
plus total. The edge passes the query through and must not materialize/filter/sort/slice the candidate set. The
candidate Select remains remote-search and page-bounded; it must never download a full candidate set. The owner
query test and concrete
`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityControllerTest.java`
must prove exact predicate pass-through and exact owner `items/total` return; restoring local `page(...)` must fail.

## 3. Adapter state machine and idempotency

Create nonvisual
`features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts`, used only by
the final `features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx`, and not a second
API/store/query mechanism. This is a **nonvisual import contract**, deliberately outside the physical-screen
table: the Drawer is its sole UI consumer; the adapter consumes only the established `OperationsTransport`
generated-client/error-code boundary and the four declared operations; neither the adapter nor Drawer creates an
API slice, imports `OperationsApi`/`operationsRtk`, makes raw HTTP calls, or contains a second query mechanism.
Its focused adapter test is the import/consumer proof. The precise legacy removal denominator is
`features/head-company-management/ui/HeadCompanyManagementPage.tsx` and
`src/tests/architecture/static-boundary.test.mjs`: the page's nested multi-select collection-replace Drawer and
the assertion requiring `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` are removed or rewritten
together. They are not a second final implementation path. The command receipt
identity is `(workspaceUuid, idempotencyKey)` and its canonical request hash contains method, path and body.
Therefore every new add or remove intent obtains a new key; a key cannot be reused for another brand, another
method, or an add/remove pair.

For a determined 204, the adapter immediately uses the generated head-company detail operation and replaces
visible authorization truth with owner readback.  For a determined 4xx it never replays: the in-use typed conflict
keeps the current row and shows the safe fixed message; other typed failures retain the current owner-confirmed
view and expose the applicable normal recovery state.

Only `PLATFORM_COMMON_RESULT_UNKNOWN`, or an absent determinate HTTP outcome, enters the unknown-result branch.
It first reads current owner detail.  Add is complete only if the readback now contains the requested `brandId`;
remove is complete only if it no longer contains it.  If (and only if) this fresh membership predicate is still
unsatisfied, it may replay the exact same method/path/body/key once through the existing command path.  It must
not mint a new key, loop a selection, perform collection replacement, or replay any known 4xx.

## 4. Focused proof and red mutations

Before UI binding, owner/service and `OperationsBusinessEntityControllerTest` prove owner-paginated candidate query,
add/remove
receipt replay, membership readback, and the typed in-use 409 projection. The typed projection test throws the
actual subclass and fails if it falls through to `PLATFORM_COMMON_VERSION_CONFLICT`; the capability-invariant
check must likewise select the most-specific thrown exception rather than accept its mapped superclass. Frontend
adapter-focused proof proves: one command per user intent; fresh
detail readback after a 204; determined failure retention; unknown-result membership predicates; and exact-key
replay only after an unresolved readback.  Required red mutations are: restore the retired bulk operation; reuse a
key across two brand changes; restore edge-local candidate `page(...)`; delete the explicit typed in-use mapping;
make an unknown-result branch replay a known 4xx; and place `visibleStores` or raw detail in Drawer state. The
focused proof is not a substitute for the
package-exit receipt set or the future P6-3 integration review.

## 5. Bounded scope and forbidden alternatives

This slice changes only the named P6-3 head-company authorization owner/edge/contract/generated/transport/Drawer
chain and its focused tests.  It does not pull forward the other P6-3 pages.  It must not restore the retired
replace operation, write generated bytes by hand, infer authorization from `pageKey` or assignment, add a
page-local fetch/refetch loop, locally reconstruct a final list after 204, or use raw Problem text as UI copy.
