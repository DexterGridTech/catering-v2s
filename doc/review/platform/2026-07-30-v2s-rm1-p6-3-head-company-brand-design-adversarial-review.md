---
REVIEW_TARGET: DESIGN
REVIEW_CYCLE_ID: RM1-P6-3-HEAD-COMPANY-BRAND-DESIGN-20260730
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
verdict: GO
---

# RM1 / P6-3 总公司品牌授权 corrective slice 独立设计复核

## Scope and blind-input statement

This is a new design cycle caused by Dexter's material placement correction from P6-2 to P6-3.  It does not reopen
or extend the historical P6-2 two-round cycle.  The independent reviewer read the current business source IA04,
P6 plan, roster, physical-screen contract, granularity manifest, corrective design, OpenAPI, owner service, edge
advice and operations transport before reading author remediation material.  It performed the second, final
targeted check only after the Round-1 findings had been independently recorded.

## Round 1 — NO-GO

M1 found two contradictory final paths: the physical contract names the future
`business-entity-management` Drawer, while the corrective exact surface still named the old
`head-company-management` page.  S1 found the phrase “schema-safe field” could admit blocker-derived details into
frontend state despite the safe-code intent.  The bounded remedy was to make the physical-contract path the only
final implementation route, explicitly treat legacy bytes as removal-only in the same receipt set, and make this
slice code-only.

## Round 2 — GO, M=0 / S=0 / N=2

- The final consumer is only
  `business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx` plus its nonvisual action adapter.  The
  old nested Drawer and old static-boundary assertion are removal-only and cannot remain a second implementation
  chain.
- The code-only boundary is explicit: `errorCode` is the sole transport/adapter/Drawer failure state; raw detail,
  blocker payloads, `visibleStores`, store identity/count and persistence details are forbidden, with a red
  mutation.
- The exact operation set remains owner detail, server-paginated enabled candidate search, one add and one remove;
  fresh key, 204 detail readback, membership-predicate unknown recovery and known-4xx-no-replay remain intact.
- Existing RTK/context behavior remains a substrate boundary: no page-local fetch/refetch loop, no bypass of
  `expectedContextVersion`, and no duplicate API/store.

N1: current generated problem schema may carry a blocker payload, but the P6-3 adapter boundary deliberately
discards it.  N2: future implementation must preserve the removal-only receipt-set declaration.

## Authorization boundary

Static independent DESIGN verdict only.  It authorizes no production source, OpenAPI, generated output, test run,
runtime, DEV, seed/reset, Roadmap or repository-control action.  Claude review remains required before any P6-3
implementation admission.
