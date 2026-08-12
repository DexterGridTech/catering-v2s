# Final catalog-contract and executable-DAG design — Round 1 disposition

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`
`REVIEW_TARGET=DESIGN`
`AUTHOR_DISPOSITION=ROUND_1_CONFIRMED_AND_MINIMALLY_REPAIRED`

## Confirmed findings

- `FINAL-CATALOG-DAG-R1-M-000` is confirmed. The checker required a raw standalone
  `implementationAuthority: false` line; Markdown inline code did not satisfy its deterministic
  parser. The bound authorization and design now both expose raw declarations. No checker change
  was needed.
- `FINAL-CATALOG-DAG-R1-M-001` is confirmed. Combining a six-path owner/consumer contract repair
  with materialization of the 592-binding graph would hide an unbounded changed-path denominator.
  The current delivery unit is narrowed to contract correctness only. Catalog/checker/materializer/
  workload/adapter conversion is explicitly excluded and requires a separate later detailed design.
- `FINAL-CATALOG-DAG-R1-S-001` is confirmed. The correction now declares a dedicated
  `CatalogTemporaryPromotionEdgeIntegrationTest` for the governed operations HTTP handoff:
  selected data node, live capability, server grant, owner recheck, one envelope and wrong-scope
  rejection. It adds no endpoint or capability.
- `FINAL-CATALOG-DAG-R1-N-001` remains a baseline disclosure. 396/592/113 has not been claimed as
  executable fixture or dynamic evidence.

## Scope and authority after remediation

The six future technical paths are catalog owner, category owner test, promotion owner integration
test, promotion edge integration test, CatalogItemDrawer and its consumer test. OpenAPI, byte
coverage, generators and generated outputs remain read-only reproducibility inputs. The present
package still has `implementationAuthority=true` only for its previously admitted static work;
this new design artifact itself is design-only and does not authorize any of these six source
changes until Round 2 and Claude recheck are GO and the manifest/active package are expanded.

No runtime directory, process, remote resource, seed/reset, Testcontainers, browser L2, UAT or
dynamic snapshot was created. The final dynamic authority remains separately inactive.

## Round 2 post-remediation disposition

`FINAL-CATALOG-DAG-R2-M-002` is confirmed. The manifest's first source binding retained the
superseded heading `## Finite executable-DAG contract` after the design was narrowed and renamed
to `## Finite executable-DAG follow-on boundary`. This is a one-anchor manifest correction only:
the bound design bytes, six-path source denominator, authorization, actor boundary and dynamic
authority do not widen. The manifest is corrected to the existing unique heading, then must be
validated against the preserved Round 2 JSON under its explicit POST_REMEDIATION declaration and
sent to Claude for the required targeted recheck. No third Codex adversarial round is permitted.
