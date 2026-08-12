# Final catalog-contract design — independent Round 2 recheck checklist

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`
`REVIEW_TARGET=DESIGN`
`REVIEW_ROUND=2`
`REVIEW_ROUND_LIMIT=2`

Work fresh and source-first. Read the Round 1 report only after independently reopening the
current manifest/design/input, project-memory/business-role rules, catalog owner/edge/consumer,
canonical contract/generator and final fixture boundary. Then verify these exact dispositions:

1. raw `implementationAuthority: false` is present in both bound design and authorization and
   `scripts/check/implementation-design-granularity --manifest <manifest> --review <round2.json>`
   can admit a properly formed Round 2 JSON report;
2. the unit contains exactly six future technical paths and does not promise catalog/checker/
   materializer/workload/adapter conversion;
3. the new edge integration test is sufficient and bounded to operations HTTP selected-node,
   capability, server-grant, owner-recheck and one-envelope propagation, without an API or
   capability change;
4. temporary external-order preparation remains normal owner HTTP create->save->detail->preflight
   ->execute, never terminal SQL/RM1/R5 reuse; and
5. dynamic authority is still false and no runtime evidence root exists.

Round 2 must make its own `SELF_DECIDED` final decision. It must not authorize a third Codex
adversarial round.
