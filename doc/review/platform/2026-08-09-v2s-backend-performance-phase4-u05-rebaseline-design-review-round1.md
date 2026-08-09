{
  "kind": "implementation-design-adversarial-review",
  "reviewTarget": "DESIGN",
  "reviewCycleId": "OVERALL_PHASE_4_U05_REBASELINE_DESIGN_20260809",
  "reviewRound": 1,
  "reviewRoundLimit": 2,
  "verdict": "NO_GO",
  "reviewerKind": "INDEPENDENT_SUBAGENT",
  "reviewerInputChecklist": {
    "path": "doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-review-input-checklist.md",
    "sha256": "d59c33a9fe4cbc0f0f1454910ed540960b475200edce127d48d54fb45d02a22c"
  },
  "blindReviewDeclaration": "I received this checklist in a fresh subagent context, tried to falsify the reviewed design, and wrote my findings and verdict before reading author self-review or author finding disposition.",
  "authorMaterialReadAfterIndependentVerdict": true,
  "manifestSha256": "bb60f8f08684187200d78d8177dded767bc933ccaef73bd8c6c15951335187e8",
  "reviewMethod": {
    "sourceFirst": true,
    "solutionReasonablenessReviewedBeforeClosure": true,
    "allDeliveryUnitsReviewed": true,
    "riskClasses": [
      "read-policy denominator and protocol exemption closure",
      "source-bound platform selected-workspace branch behavior",
      "command/read invocation and transaction separation",
      "request-local authorization-fact lifetime and cache boundary",
      "BP-U06 exclusion"
    ]
  },
  "expectedBehavior": [
    "83 GET operations are explicitly partitioned into 78 task reads and the five closed protocol/content exemptions.",
    "M1 has exactly 68 command and 58 task-read operations; M2 has exactly two C5 commands and the same 58 task-read operations.",
    "The pre-login operations workspace entry is never promoted into an authorization or structural read context.",
    "Only the approved platform audit entity-type branches may require an enabled selected workspace; the GROUP_WORKSPACE and PLATFORM_ADMIN branches remain outside that fact.",
    "C5 commands retain their own command invocation and do not call a task reader or borrow request-local read facts.",
    "BP-U06 legacy-dispatch and signature retirement remains excluded."
  ],
  "findings": [
    {
      "id": "BP-U05-RB-M-01",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U05"],
      "title": "The selected-workspace branch rule has no source-bound control or declared change path.",
      "evidence": "Rebaseline decision §4 requires updating the SQL applicability control; the BP-U05 plan requires EnabledSelectedWorkspaceFact to be a fact implementation and limits getPlatformEntityAuditHistory to five workspace-host entity-type branches. The phase4 manifest declares task-read policy/generator/checker but omits backend-performance-sql-merge-applicability.json, its generator, and PlatformAuditHistoryController. Current PlatformAuditHistoryController#history routes GROUP_WORKSPACE plus WORKSPACE_ROLE, WORKSPACE_ACCOUNT, WORKSPACE_INVITATION, EXTENSION_DEFINITION and STORE_CONTRACT through scope() -> WorkspaceAdministrationService#requireEnabled. Current applicability control has no EnabledSelectedWorkspaceFact factImplementation and its audit row carries no branch policy.",
      "risk": "A future policy could silently preserve an unconditional audit gate, remove the intended five branch gates, or label the fact as covered without a source anchor. The 78-row budget control would then prove only row presence, not the required observable branch behavior.",
      "disposition": "Before implementation, add the applicability registry/generator/checker and PlatformAuditHistoryController to the unit's exact change surface; freeze an explicit factImplementation with the 15 platform operation IDs plus an audit branch enum/set, sourcePath#method, preserved typed failure and a red mutation that moves GROUP_WORKSPACE or PLATFORM_ADMIN into the enabled-workspace branch. Use a small branch-local scope helper, not a global read abstraction."
    },
    {
      "id": "BP-U05-RB-M-02",
      "severity": "M",
      "status": "CONFIRMED",
      "unitIds": ["BP-U05"],
      "title": "The two C5 command reconciliations and request-local fact lifetime are not bound to their actual owner sources.",
      "evidence": "The rebaseline assigns selectOperationsWorkspaceSessionContext and selectOperationsWorkspaceSessionDataNode to a separate C5 command invocation. Their actual mutation/re-read flow is WorkspaceAuthenticationService#selectContext and #selectDataNode, each of which calls sessionEntry after mutation; sessionEntry invokes OrganizationVisibilityService#resolveSessionEntryFacts. The phase4 manifest declares only OrganizationVisibilityService and OperationsSessionResolver, not WorkspaceAuthenticationService or the operations session controller. Moreover OperationsSessionResolver#require delegates to WorkspaceAuthenticationService#session, whose implementation reads sessionCache, while the design prohibits cross-request read facts but does not define the new WorkspaceReadAuthorizationFacts minting method or cache-bypass rule.",
      "risk": "Implementation can either call a task reader from the C5 command transaction, continue duplicated owner reads after mutation, or accidentally derive a supposedly request-local authorization snapshot from the cross-request session cache. Each outcome violates a core correctness or M1/M2 boundary while still satisfying a superficial 58/60 count.",
      "disposition": "Freeze two separate call chains before implementation: (1) a request-local read-fact factory with an explicit fresh session/assignment/enabled-role query and no sessionCache reuse; (2) C5 command-local reconciliation in WorkspaceAuthenticationService after its mutation/readback, with the corresponding edge controller only passing typed command input. Add these exact source paths and focused red tests to the manifest; the negative case must reject any C5 -> TaskReadService call and any read-fact factory delegation to sessionCache."
    },
    {
      "id": "BP-U05-RB-S-01",
      "severity": "S",
      "status": "CONFIRMED",
      "unitIds": ["BP-U05"],
      "title": "The 78-row policy is named but not frozen enough to establish per-operation normal-path budgets.",
      "evidence": "The plan requires each task-read row to declare minimal ReadContextKind, requiredFactSet, primaryQueryCap, optionalCountCap and declaredExtrasCap=0. The current design package and manifest only say that a future task-read-surface-policy.json will be created. The source registries can derive the 83 operation IDs and five exemptions, but they cannot derive each row's minimum context kind, required fact set, optional-count semantics or named normal fixture. No pre-implementation 78-row source map is included in the design package.",
      "risk": "The implementer can choose broad context kinds or caps after observing code paths, which defeats the design's strict-supertype and no-fabricated-budget protections even if the exact GET count remains 78.",
      "disposition": "Create the design-time policy draft as a complete 83-row artifact before round 2, including the five exemption reasons and for all 78 task reads the minimum context kind, fact set, caps, owner task-reader/controller source anchor and named normal fixture. The generator may validate this artifact, but must not be its missing semantic author."
    }
  ],
  "unitVerdicts": [
    {"id": "BP-U05", "verdict": "NO_GO", "findingIds": ["BP-U05-RB-M-01", "BP-U05-RB-M-02", "BP-U05-RB-S-01"]}
  ],
  "solutionReasonableness": {
    "problemFit": "The rebaseline correctly rejects face-derived M2 applicability and keeps protocol GETs out of workspace read facts; owner-local request facts and a closed read policy remain the smallest viable direction.",
    "simplerAlternativeAssessment": "Moving every M2-looking operation into BP-U05 or using a generic read bus would be smaller only superficially: it would reintroduce consumer-face inference and command/read boundary leakage. The smaller safe repair is to freeze the missing branch and call-chain data in the existing registry/policy shape.",
    "costFit": "Adding three explicit source-bound policy bindings and a complete 83-row design artifact is proportional. It avoids a later rewrite across the 58 operations and does not require any BP-U06 retirement or public contract change.",
    "verdict": "NO_GO_PENDING_SOURCE_BOUND_POLICY_AND_CALL_CHAIN_FREEZE"
  },
  "conclusion": {
    "verdict": "NO_GO",
    "summary": "The 83/78/5, 126 and 60 arithmetic is independently reproducible, and the rebaseline correctly excludes the pre-login operations GET and face-derived generic commands. The design nevertheless omits the actual source-bound controls for the platform audit branch and C5/read-fact call chains, and it leaves the 78 row semantics to a future artifact. It cannot safely admit implementation yet.",
    "severityCounts": {"M": 2, "S": 1, "N": 0},
    "authorizationBoundary": "This is an independent DESIGN round-1 verdict only. It authorizes no implementation, runtime, reset/seed, DEV, L2/UAT, SQL optimization claim, BP-U06 work, or repository-control action."
  }
}
