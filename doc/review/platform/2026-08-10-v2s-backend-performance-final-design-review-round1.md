{
  "kind": "implementation-design-adversarial-review",
  "reviewTarget": "DESIGN",
  "reviewCycleId": "BACKEND_PERFORMANCE_FINAL_CLOSURE_DESIGN_20260810",
  "reviewRound": 1,
  "reviewRoundLimit": 2,
  "verdict": "NO_GO",
  "reviewerKind": "INDEPENDENT_SUBAGENT",
  "reviewerInputChecklist": {
    "path": "doc/review/platform/2026-08-10-v2s-backend-performance-final-design-input-checklist.md",
    "sha256": "e1c6b90a0904ba744eb3e8e10ea08bc276d815a91f170ba430a29eac292296f9"
  },
  "blindReviewDeclaration": "Fresh independent-subagent review: I recomputed the required hashes and denominators, opened the current production and control sources, and formed this falsification-first finding set before reading any author self-review, finding disposition, or Claude material.",
  "authorMaterialReadAfterIndependentVerdict": true,
  "manifestSha256": "1b2aea7bfa3db0708c73a65bc0cad0372d25aaae6c9a2aa15fc8cb932033362b",
  "reviewMethod": {
    "sourceFirst": true,
    "solutionReasonablenessReviewedBeforeClosure": true,
    "allDeliveryUnitsReviewed": true,
    "riskClasses": [
      "module dependency direction and edge coordination ownership",
      "typed catalog route replacement and command semantic parity",
      "immutable snapshot provenance and measured-status admission",
      "source-absence denominator closure",
      "dynamic authority and RM1 pause boundary"
    ]
  },
  "expectedBehavior": [
    "BP-U06 retires exactly three production sources, four colocated tests, two registry sources with two tests, and one root artifact only after direct typed replacements compile.",
    "The 42 catalog routes remain a closed 16 GET plus 26 workspace-command set with route, owner transaction, scope recheck, CAS or replay, asset and response parity preserved per route.",
    "The nine operations-audit and seven platform-audit branches move outside app/application without an owner dependency cycle or cross-owner edge coordinator.",
    "A measured status accepts only the one final backend-performance snapshot and rejects historic, foreign, partial, cross-run, unclassified and cap-overflow evidence.",
    "RM1-P6-3 remains paused, dynamic authority is not used by this design package, and final workload processes remain local except for approved remote middleware reached through the tunnel."
  ],
  "findings": [
    {
      "id": "BPF-D-M-001",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U06"],
      "title": "The proposed audit-read module cannot relocate the platform audit coordinator with its declared dependency boundary.",
      "evidence": "Plan final-closure design lines 348-350 and manifest BP-U06 require modules/audit-read to depend only on owner public APIs, while the current PlatformAuditHistoryTaskReadService imports app.edge.platform.session.PlatformSessionResolver.PlatformReadSessionFacts. That nested class is owned by the deployable edge, has a private constructor, and exposes requireEnabledSelectedWorkspace(WorkspaceAdministrationService). settings.gradle.kts has no audit-read module and the manifest names neither PlatformSessionResolver nor a replacement owner/public read-fact API as a change surface. Making audit-read depend on the app would form app -> audit-read -> app; retaining the import leaves the reader in forbidden app/application.",
      "risk": "The implementation either fails Gradle compilation, retains the forbidden source, or moves platform selected-workspace and cross-owner coordination into the edge, violating the stated BP-U06 success condition.",
      "disposition": "Before Round 2, freeze one directionally legal platform read-fact API outside the app edge (including construction authority, selected-workspace typed failure and ReadBudget component ownership), add its exact source and test surfaces, and bind audit-read only to that API plus owner projections. A module dependency graph check must red-fail an audit-read -> app edge."
    },
    {
      "id": "BPF-D-M-002",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U06"],
      "title": "The catalog cutover has a numerical denominator but no executable route-to-typed-replacement contract.",
      "evidence": "The source inventory and current operation-handler-bindings.json independently yield 42 catalog routes (16 READ, 26 COMMAND), but the manifest supplies only one CatalogInventoryCoordinator file with the aggregate target 'provide forty-two named typed route methods' and one controller target with the aggregate target 'bind all'. Current OperationsCatalogInventoryController uses four URI-selected registry calls, respond(Operation,...), CatalogInventoryWorkspaceCommandTokenRegistry and CatalogInventoryApplicationService#dispatchWorkspaceCommand; the application also retains four public dispatch(String operationId, ...) overloads plus private copy dispatches. The current registry metadata calls the legacy entry CatalogInventoryApplicationService.dispatch(String,...) but does not identify which overload or the direct typed successor. No approved source maps each operationId/route to a coordinator method, typed request, closed token, transaction boundary, scope recheck, replay or CAS branch, asset path and focused proof.",
      "risk": "A partial or behavior-changing rewrite can satisfy a 42-count source scan while silently dropping an idempotency, owner transaction, asset lifecycle, copy-source or readback invariant for one command route.",
      "disposition": "Add a checked 42-row replacement matrix before implementation. Each row must bind current controller handler/legacy overload or helper -> exact new coordinator method and typed input -> owner/REQUIRED transaction -> scope and replay or CAS/asset/readback preservation -> focused test. Regenerate operation-handler-bindings from that matrix, make controller source checks assert all 42 direct calls, and red-mutate one route mapping, one token path and one preserved command branch."
    },
    {
      "id": "BPF-D-M-003",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U07"],
      "title": "Final snapshot admission does not yet bind or reject foreign historic provenance.",
      "evidence": "The required experiment ran node scripts/generate/backend-performance-sql-merge-applicability.mjs --check --snapshot .runtime/r5/snapshots/650f35d79dbfcb7d3dac3ff9368e056e5edb5751590bf5877bf5c844a6f8d666 and returned BP_U07_SNAPSHOT=PASS. Current validateSnapshot accepts any absolute snapshots/<sha256> directory whose generic evidence checker passes; the snapshot manifest deliberately treats sourceRunDir as NON_VERIFICATION_PROVENANCE. The final design forbids RM1/historic reuse, but its BP-U07 change surfaces and tests do not freeze a final-run kind/packageId/runId/namespace binding or a red fixture that passes a structurally valid RM1 snapshot to final admission.",
      "risk": "After a mechanical status transition is added, the existing accepted RM1 snapshot can be relabelled or joined to final rows and produce a false MEASURED_NEW_FIXTURE result without a final workload.",
      "disposition": "Freeze a final-run provenance contract: final runner manifest kind, packageId, runId/namespace and exact snapshot root; bind every admitted tuple to that final run and reject any other run kind or package before status promotion. Add a real red fixture using the currently accepted .runtime/r5 snapshot and another structurally complete partial-final snapshot. The final-acceptance checker, generator and evidence snapshot checker must all consume the same provenance fields."
    },
    {
      "id": "BPF-D-N-001",
      "severity": "N",
      "status": "CONFIRMED",
      "unitIds": ["BP-U06"],
      "title": "BP-U06 source and route denominators are reproducible from current bytes.",
      "evidence": "All three listed app/application production sources, four focused tests, two registry sources, two registry tests and results/catalog-inventory-l2-test-fixture.json exist. operation-handler-bindings.json has exactly 42 catalog-inventory operations: 16 READ and 26 COMMAND. The current operations audit query is sealed to nine types and platform audit query is sealed to seven.",
      "risk": "None by itself; this is a verified denominator, not implementation admission.",
      "disposition": "Retain it as the exact source-absence and direct-mapping denominator once the blocking replacement matrix exists."
    },
    {
      "id": "BPF-D-N-002",
      "severity": "N",
      "status": "CONFIRMED",
      "unitIds": ["BP-U07"],
      "title": "The authorization and manifest correctly keep RM1 paused and dynamic execution outside this design package.",
      "evidence": "Final-closure authorization states RM1-P6-3 is paused, not closed, and package one is design-only. It further limits the later workload to local application processes and tunnel with isolated remote middleware, explicitly excluding browser, L2, UAT, deployment and reset. The manifest is PROPOSED_REVIEW_ONLY and has authorization scope design-only.",
      "risk": "None in the design bytes; future implementation must preserve this boundary.",
      "disposition": "Keep the serial activation prerequisite and include it in the final-run provenance and runner tests."
    },
    {
      "id": "BPF-D-M-004",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U07"],
      "title": "The proposed design manifest is not mechanically admissible as a design-only package.",
      "evidence": "scripts/check/implementation-design-granularity --manifest doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json --review doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round1.md returns AUTHORIZATION_IMPLEMENTATION_AUTHORITY_NOT_FALSE. The manifest authorization object declares only scope='design-only'; it omits the checker-required explicit implementationAuthority=false, so the required review gate cannot validate this package even before evaluating the review artifact.",
      "risk": "A design package can be mistaken for implementation-admissible or cannot pass the mandated mechanical gate, defeating the stated serial authority boundary.",
      "disposition": "Correct the manifest authorization declaration with explicit implementationAuthority=false and all corresponding non-runtime/non-dynamic flags required by the checker, then rerun the checker against the unchanged Round 1 bytes. This is a bounded manifest repair, not an implementation grant."
    }
  ],
  "unitVerdicts": [
    {"id": "BP-U06", "verdict": "NO_GO", "findingIds": ["BPF-D-M-001", "BPF-D-M-002", "BPF-D-N-001"]},
    {"id": "BP-U07", "verdict": "NO_GO", "findingIds": ["BPF-D-M-003", "BPF-D-N-002", "BPF-D-M-004"]}
  ],
  "solutionReasonableness": {
    "problemFit": "Retiring the app/application layout and replacing the immutable-snapshot admission is directionally appropriate, and the source denominators are bounded. The current design does not make the two architecture cutovers or final evidence provenance implementation-deterministic.",
    "simplerAlternativeAssessment": "Do not move the audit readers to edge or audit-model, and do not retain a compatibility dispatcher. A small public platform read-fact API, a checked 42-row direct-replacement matrix, and a final-run provenance tuple are smaller than a generic bus or a second runtime framework.",
    "costFit": "The three repairs extend only existing module, registry and snapshot-control surfaces. They avoid a likely compile-cycle rewrite and prevent a false numerical closure from historic evidence.",
    "verdict": "NO_GO_PENDING_DIRECTIONAL_AUDIT_FACT_API_ROUTE_REPLACEMENT_MATRIX_AND_FINAL_RUN_PROVENANCE"
  },
  "conclusion": {
    "verdict": "NO_GO",
    "summary": "Round 1 independently confirms the fixed BP-U06 3/4/2+2/root, 42=16+26 and audit 9/7 denominators, plus the paused/dynamic boundary. It rejects the final design for four material gaps: audit-read has an app-edge read-fact cycle, catalog cutover lacks a per-route typed parity mapping, a structurally valid historic RM1 snapshot currently passes the proposed admission input without a frozen final-run provenance discriminator, and the proposed design manifest itself fails the required design-only authority gate.",
    "severityCounts": {"M": 4, "S": 0, "N": 2},
    "authorizationBoundary": "This independent DESIGN Round 1 verdict authorizes no implementation, static source change, runtime, remote execution, DEV, seed/reset, browser L2/UAT, performance measurement claim, BP-U06 cutover, or repository-control action. Only a bounded design correction and the permitted final Round 2 review may follow."
  }
}
