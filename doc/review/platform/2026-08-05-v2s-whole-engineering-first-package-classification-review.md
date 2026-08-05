# RP-12 classification — independent adversarial review (Round 1)

REVIEW_TARGET=IMPLEMENTATION
reviewObject=RP12_CLASSIFICATION
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805-RP12-CLASSIFICATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

## Blind declaration

I received the required input checklist and reviewed the frozen instructions, source scope,
classification artifact, and real production Java source. I formed the findings and verdict
before reading any author intake, self-review, or Claude review material. This report is a
fresh, source-first Round 1 review. No source, contract, classification artifact, runtime,
database, seed/reset, HTTP/L2, or Git action was performed by this reviewer.

## Verdict

**NO-GO — M=1, S=2, N=0.** The classification artifact must not authorize RP-12-pre or
RP-12a..n replacements. Round 2 is allowed in this same cycle only after the source bytes and
classification artifact are regenerated/bound and the findings below are re-read independently.

Authorization boundary: this is a classification review only. It grants no implementation,
runtime, DEV/UAT, HTTP/L2, database/migration, seed/reset, or repository-control authority.

## Reviewed inputs and reproducibility

The required v2s-rooted inputs were reopened before source review: `AGENTS.md`,
`PLATFORM-BLUEPRINT.md`, `doc/platform/README.md`, the registry and current Roadmap
(`CURRENT_STEP=RM1-P6-3`), `scripts/README.md`, the six routed project-memory kernels,
`project-memory/decisions/deterministic-context-only.md`,
`contracts/policy/standards-coverage-matrix.json`, the verification governance decision, the
independent-review governance decision, and the RP-12 implementation-facing design.

The reviewed object was:

`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-classification.json`

Artifact SHA-256 at review time:

`b7508d6c20e2e0fc32b9e371fa1a9ef129c5433286bd485cb31b833b08596223`

Its declared denominator is 320 rows / 477 occurrences over production Java (excluding tests),
with five semantic sets. The artifact has no per-file source SHA-256 or immutable source
snapshot binding; it stores only relative path and line anchors.

Checklist evidence (all values are the bytes/output observed in this Round 1):

```text
AGENTS.md                                      4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda
CLAUDE.md                                      8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f
PLATFORM-BLUEPRINT.md                          3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d
doc/platform/roadmap-program-registry.json    f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8
current Roadmap                               d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73
deterministic-context-only.md                  4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20
independent-review governance                  108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3
verification governance                        c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc
standards-coverage-matrix.json                 b0519ea0e8691b204fc41f9a481665eaf381e067c1bf4f002b7913171476b149
recall-memory output                           4ae0834903a4ea021ced475b4d7459396052c9ea662889d7c92a365aa8b1ae30c
kernel/01                                      f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63
kernel/02                                      45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032
kernel/03                                      f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44
kernel/04                                      1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d
kernel/05                                      f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736
kernel/06                                      5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c
```

The classification review has no author source-change point, so per-change pre/post reread
receipts are `NOT_APPLICABLE`; the production source rows and their current bytes were instead
reopened directly. Corpus search was performed for the five token vocabulary and RP-12 terms;
the reviewed object's exact full readback is recorded below.

## Independent source checks

I independently scanned `apps/backend/catering-business-server`, excluding `src/test`, with the
declared double-quoted token regex `(GROUP|REGION|PROJECT|HEAD_COMPANY|STORE)`:

```text
current source: 477 occurrences / 320 matching lines / 32 files
artifact:       477 occurrences / 320 rows
```

The aggregate totals therefore do not establish row-level freshness. Reading the current source
at each artifact `path + line` and comparing the ordered token list gives:

```text
66 row mismatches across 7 artifact files
current-at-artifact-lines: 429 occurrences / 286 matching lines
```

The mismatching artifact rows are:

```text
ExtensionDefinitionService.java:26
BusinessEntityService.java:35,96,135,136,146,164,165,166,167,183,186,191,209,219,221,227,243,251,254,261,268,276,282,288,328,347,351,377,378,395,413,414,500,501,518,519
OrganizationCommandService.java:207
OrganizationHierarchyService.java:25,101,113,121,130,136,141,146,152,153,159,193,211,223,410,427,465,486
ContractCommandService.java:157
WorkspaceInvitationService.java:154,467,468,469,470,605,606,607
WorkspaceRoleService.java:39
```

Eight of the 32 source files represented by the artifact are currently byte-different from the
repository baseline, including the seven files above and `ManagedInvitationBootstrap.java`.
The current hashes of the directly affected production files are recorded here so a subsequent
round can distinguish this observed byte state from a regenerated artifact:

```text
ExtensionDefinitionService.java  53a6b9c5bc31a5fb349ca0e1316214de9a5b87b3d936bcd5d5d8e30a13614068
BusinessEntityService.java       380b89146dbfc27d8cffd4c5cd62cd038ed2418b4984213bae4584c81046e991
OrganizationCommandService.java  5829f8d80e304041435b18b8069aef096217faa77f0ecb2d4bd6fa1143c0d016
OrganizationHierarchyService.java c7b6306d69ba5966f49ad2a6bc9a2a9bb069914c6a6a81a44cee8e02edf32332
ContractCommandService.java      76ca47d02cf368bb0b191eded258e85a11adce1c71244fb9a6fa0ec4b02182ed
WorkspaceInvitationService.java  86aea0b60a7f232b2902d5a7fd00b66dbf6b02b2bdb16137f44e4f8f2a31b64c
WorkspaceRoleService.java         a19e6621cc0878741527760f2e31bec0f7c11f53583294ee87395f9c122060ac
ManagedInvitationBootstrap.java   2d45a811880f1a002c416ecaa087665c4ee81a33f6874ce7c7a626d408a84766
```

## Findings

### RP12-CLASSIFICATION-M-001 — classification is not bound to the current source bytes

**Status: CONFIRMED.** The aggregate denominator still matches, but 66 ordered row readbacks
do not. The observed edits add/import or otherwise change bytes before classified occurrences,
so the artifact's line anchors now identify unrelated source lines in several files. The same
problem affects normative-source anchors: the artifact names
`ExtensionDefinitionService.java:26 (MANAGEMENT_HOST_TYPES)`,
`BusinessEntityService.java:35 (ENTITY_TYPES)`, and
`OrganizationHierarchyService.java:25 (NODE_TYPES)`, while the current declarations are at
`:27`, `:36`, and `:26` respectively. The artifact contains no source hash map with which to
prove which byte snapshot it was generated from.

**Risk:** RP-12 replacement is line-bounded by this artifact. A replacement can therefore edit
the wrong literal or silently omit the intended one while the 477/320 aggregate check remains
green. A stale normative source line also breaks owner/source proof.

**Minimal repair:** Freeze the exact production Java bytes for the review round, regenerate the
classification from that byte set, add a deterministic per-file source hash (or immutable source
snapshot reference), then rerun the independent ordered token/line/set/owner/normative-source
readback. Existing artifact rows must not be used for replacement.

### RP12-CLASSIFICATION-S-001 — mixed-token rows do not identify set membership per occurrence

**Status: CONFIRMED evidence deficiency.** The artifact permits one row to contain multiple
tokens and multiple sets but has no token ordinal, column span, or token-to-set mapping. Examples
include `BusinessEntityService.java:219` (`STORE`, `PROJECT` with
`SERVICE_NODE|ORGANIZATION_TREE`) and `BusinessEntityService.java:227` (three `STORE` occurrences
with `SERVICE_NODE|AUDIT_ENTITY_TYPE|EXTENSION_HOST`). The implementation design says each
replacement is bounded by classified rows and each occurrence is assigned to one or more finite
sets; the current row shape cannot mechanically prove which occurrence receives which set when a
same-name token belongs to more than one vocabulary.

**Risk:** Ordered collection replacements can select the whole mixed line or assign the wrong
owner/normative source to one occurrence. Aggregate row and occurrence counts will not detect the
error.

**Minimal repair:** Keep the existing row denominator if desired, but add a deterministic
per-occurrence ordinal/column plus set, owner, generated, and normative-source assignment (or
split mixed rows into one row per occurrence). Add a set-equality/readback check and a red fixture
that moves or duplicates one token on a mixed line.

### RP12-CLASSIFICATION-S-002 — at least two pure organization-node occurrences are overclassified

**Status: CONFIRMED.** In the source snapshot represented by the artifact, these literals are
passed directly to the organization owner's `nodes.requireNode`, whose `NODE_TYPES` is the
organization-tree source (`REGION`, `PROJECT`):

```text
BusinessEntityService.java:183  nodes.requireNode(..., "PROJECT")
BusinessEntityService.java:395  nodes.requireNode(..., "PROJECT").id()
```

Both artifact rows assign `SERVICE_NODE|ORGANIZATION_TREE`. These call sites are organization
tree node validation, not the OpenAPI service-node declaration/consumer vocabulary. The artifact
therefore overassigns `SERVICE_NODE` and would cause a service-node replacement to touch a pure
organization-tree occurrence. `OrganizationHierarchyService.java:152` is a related mixed
authorization/node-validation case and requires the per-occurrence decision above rather than a
blind global assignment.

**Minimal repair:** Reopen these rows against the owner source and classify the first two as
`ORGANIZATION_TREE` only (or record an explicit, source-backed reason if the intended design
requires dual membership). Add a focused semantic review assertion for `requireNode` call sites
so this class of false membership cannot recur.

## Disposition and next step

The NO-GO is driven first by the current-byte binding failure; the two S findings independently
prevent safe ordered replacements even after line regeneration. Do not proceed to RP-12-pre or
RP-12a..n from this artifact. Regenerate/bind the classification against one frozen source byte
set, correct the semantic rows and per-occurrence mapping, then run this same cycle's Round 2
independent review. No third round is permitted by the review governance.

## Round 2 final directional review

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805-RP12-CLASSIFICATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED

### Round 2 blind sequence

I first independently parsed and rescanned the latest artifact and current production Java
source, then compared those results with the Round 1 findings. I did not treat the author's
stated remediation as evidence until the independent checks below were complete. This is the
cycle's final permitted round; no third review will be opened.

Latest artifact SHA-256:

`cea91e4948fb012e28666dd315ae9cdcdb195b67203329ed3409b34614b22c58`

The latest artifact is valid JSON and now carries 32 per-file source SHA-256 values, a field map,
and one `occurrenceMappings` entry for every token occurrence. The independent checks were:

```text
current Java scanner:             477 occurrences / 320 matching lines / 32 files
artifact counts:                  477 occurrences / 320 matching lines / 32 files
artifact rows:                    320
ordered row token/line mismatches: 0
occurrence ordinal/token/map errors: 0
row-set versus mapping-set errors:  0
source-hash mismatches:             0
normative-source anchor errors:     0
empty owner/normative/disposition:  0
uncertain rows:                     0
```

The previously failing pure organization-node rows are now source-backed as follows:

```text
BusinessEntityService.java:184  PROJECT -> ORGANIZATION_TREE; owner=organization; NODE_TYPES :26 only
BusinessEntityService.java:396  PROJECT -> ORGANIZATION_TREE; owner=organization; NODE_TYPES :26 only
```

The mixed `STORE` line now has explicit per-occurrence mapping (extension host, service node,
audit entity type), and all three mapping sets union exactly to the row set. `columnStart=0` is
explicitly documented by the artifact field map as the scanner's no-column mode; ordinal plus
ordered token and row identity still provide an exact occurrence key.

### Round 2 final verdict

**GO — M=0, S=0, N=0.** The Round 1 M-001 source-byte binding finding and both S findings are
closed by independently verified current-source hashes, valid JSON, exact 477/320/32 scan
equality, complete per-occurrence mappings, and corrected pure organization-tree owner/source
assignments. The classification artifact is eligible to authorize the ordered RP-12 replacement
units under the implementation design's existing red-proof and source-reread gates.

This GO is limited to RP-12 classification admission. It does not authorize runtime, DEV/UAT,
HTTP/L2, seed/reset, database/migration, or repository-control actions. A later implementation
review remains mandatory after source changes; this review cycle is closed after Round 2.
