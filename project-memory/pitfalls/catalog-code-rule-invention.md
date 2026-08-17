---
id: pitfalls.catalog-code-rule-invention
status: active
layer: routed
taskKinds: ["implementation","review","testing"]
domains: ["platform","admin-ui","backend","contract"]
consumerFaces: ["operations-admin"]
owners: ["frontend-platform","backend","product"]
impacts: ["architecture","contract"]
triggers: ["implementation","review","failure"]
assertions: ["CODE_RULE_REQUIRES_BUSINESS_SOURCE","OWNER_SUBMIT_UNIQUENESS"]
sourceRefs: ["doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md"]
---

# Do not invent catalog code formats

- Failure pattern: a frontend normalizer or owner regex makes catalog codes uppercase or limits their characters without a business source, then an availability query presents a non-authoritative result before submission.
- Root cause: a technical identifier convention was treated as a business identity rule and copied between product, category and metadata forms.
- Applicability: catalog item, category, dictionary, SKU attribute/value and production-tag create forms. Counterexample: an explicitly contracted external protocol code with an owner-defined format may validate that format.
- Minimum remedy: preserve entered nonblank text (trim only), keep created codes immutable, and let the owner command return the scope-specific `DUPLICATE_CODE` outcome at submission. Do not add a preflight availability request merely to predict that command.
