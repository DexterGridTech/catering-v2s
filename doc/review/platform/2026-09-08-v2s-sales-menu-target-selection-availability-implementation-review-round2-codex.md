# R5 销售菜单目标选择与细粒度沽清 implementation independent review round 2

```text
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-IMPLEMENTATION-20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=NO-GO
M/S/N=1/0/2
```

## 独立性与输入

本轮由 fresh independent subagent 以只读方式完成。审查者先按当前仓库字节进行证伪式核查，再对照 round 1；未写文件、未执行 Git、未启动 DEV、reset、seed、backend acceptance、browser L2、UAT 或部署。输入包括：

- 本 Journey 的 Journey amendment、requirements amendment、IA amendment、interaction design、implementation design、implementation plan；
- 当前 project-memory kernels、backend/frontend/review/managed-runtime 标准与 review governance；
- 当前 contract source/generated chain、SalesMenu owner/domain/migration/edge、Catalog task read；
- 当前 operations-admin editor/detail/page/testIds/focused/static tests；
- 当前 `SalesMenuAcceptanceScenarios.java`、Catalog acceptance bridge、seed plan/executor/tests；
- 当前 sales-menu L2 blueprint/fixture/generated bindings/scenarios/spec/runner 与 admin-ui-foundation reuse points。

## §5 Verdict Block

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=1/0/2
L1_ENGINEERING=PASS_WITH_STATIC_SOURCE_AND_TS_LSP; Java compile/LSP and dynamic runtime remain unrun by explicit boundary
L2_USER_VISIBLE=findings: M-1 stale SKU recovery UI over-terminal; N-2 ORDER_OPTION_VALUE status target lacks browser L2 user-visible exercise
L3_UNVERIFIED=backend acceptance not run; browser L2 not run; DEV/seed/UAT/deploy not run; Java compile not run; L2 self-test/generator/static source is not dynamic proof
SAME_ROOT_SCAN=M-1 scanned SKU selection/select-all/clear/option/price/stale controls plus backend owner update/publish validation; N-1 scanned option definition/value validation and acceptance negatives; N-2 scanned ITEM/SKU/ORDER_OPTION_VALUE backend/UI/L2 target chain
DESIGN_GAPS=none requiring new product rule; M-1 only needs Dexter decision if intended behavior is to make every stale SKU Catalog-restore-only even when replacement candidates exist
EVIDENCE_TIER=static source + focused test source/evidence + TypeScript diagnostics; no current-turn HTTP/browser/runtime proof
```

## Findings and disposition required

### M-1 — stale SKU recovery UI over-terminal (`CONFIRMED`)

`SalesMenuItemEditorDrawer.tsx` treated any stale selected row as a terminal failure, retained stale refs when clicking clear, and disabled the stale row checkbox. This blocked the valid case where stale SKU-A is replaced by still-ENABLED SKU-B. The owning backend already accepts a new non-empty ENABLED subset. The minimum repair is to let the clear action remove stale refs, reject only when a stale ref remains selected, and retain the terminal Catalog-recovery message only when no ENABLED candidate exists for a stale-only item.

### N-1 — value-level negative HTTP evidence (`UNVERIFIED_REQUIRES_EVIDENCE`)

Owner code rejects duplicate selected value refs and unknown value refs, but `selectionNegativeBoundaries` only sent definition-level exact-set mutations and required-empty. Add real HTTP `duplicate-value` and `unknown-value` mutations with their existing typed codes and draft/menu no-write assertions.

### N-2 — ORDER_OPTION_VALUE browser path (`UNVERIFIED_REQUIRES_EVIDENCE`)

The owner, UI target tree and backend acceptance cover option-value target status, but the current browser manual case materializes a SKU candidate and exercises only SKU plus ITEM. Reuse the existing denominator with a DIRECT option candidate (or an equivalent approved small case) and execute option-value target sold-out/restore, reason, state, submit and readback through real generated bindings.

## Root-cause and boundary notes

- No confirmed backend owner, migration, contract, shape, inventory/manual independence, detached-child event, generated drift, or Catalog admittedShapes scope defect was found.
- M-1 is an implementation behavior defect, not a product-rule expansion: the approved terminal condition is stale-only with zero ENABLED candidate.
- N-1 and N-2 are evidence gaps in the current implementation surface; they must not be silently reclassified as PASS by static source review.
- This is the final independent round for this cycle. After main-agent repairs, no third independent review may be started; the author must record repair evidence and proceed only within the existing authorization.

## Author intake status at review time

```text
AUTHOR_INTAKE=REPAIR_REQUIRED
AUTHOR_M1=CONFIRMED_REPAIR_PENDING
AUTHOR_N1=HTTP_RED_MUTATION_PENDING
AUTHOR_N2=BROWSER_L2_OPTION_TARGET_PENDING
```

## Author repair intake (after round 2)

```text
AUTHOR_INTAKE=REPAIRED_WITHOUT_THIRD_REVIEW
AUTHOR_M1=CONFIRMED_AND_REPAIRED
AUTHOR_M1_REPAIR=clear removes stale SKU refs; stale-only remains Catalog-recovery terminal; replacement by an ENABLED candidate is allowed
AUTHOR_N1=REPAIRED
AUTHOR_N1_REPAIR=acceptance adds duplicate-value and unknown-value real HTTP mutations with typed problem and no-write assertions
AUTHOR_N2=REPAIRED
AUTHOR_N2_REPAIR=the existing generated manual-status case now materializes a DIRECT option candidate and exercises ORDER_OPTION_VALUE sold-out/restore
STATIC_PROOF=frontend typecheck, frontend architecture, frontend unit, backend testClasses, L2 fixture test, generator self-test PASS
DYNAMIC_PROOF=PARTIAL_MANAGED_RUN; FULL_L2_AND_RESET_SEED_UNVERIFIED
ROUND_LIMIT_RESPECTED=true
```

The original round-2 verdict and findings remain unchanged. The repairs are author intake, not a third independent review; managed HTTP/browser evidence is still required before implementation closeout.

## Author follow-up dynamic evidence

The author executed the permitted managed backend acceptance and began the managed browser-L2 chain after the repairs. The backend acceptance run
`.runtime/backend-acceptance/backend-acceptance-1786632597738-b5a9c7c6/run-manifest.json`
reports `business.contract=PASS`, `business.business=PASS`, `business.performance=PASS`, and cleanup `status=PASS`.

The browser-L2 chain did not reach a full business closeout:

- `l2-1788805698523-73261-cd17f86e-c08c-4529-af51-056a4854df6b` reached readiness, edge materialization, and source-binding finalization, but its focused SKU-price case exposed the pre-correction `getOperationsSalesMenu` request budget; cleanup was `PASS`. The exact SM-L2-005 budget was corrected in the blueprint and guarded by a focused static assertion; no timeout or wait was changed.
- `l2-1788806673323-93623-66c1de6e-8abc-4f5f-86c4-70a94ceda4be` failed at `L2_OWNER_HTTP_NETWORK`: `MENU-10` was aborted locally at 30,001 ms while the server later recorded HTTP 201 after 38,449 ms; cleanup was `PASS`.
- `l2-1788807520300-11447-6de879b6-d590-4b5f-a14f-86033d0ac89b` failed at `L2_PROCESS_READINESS_TIMEOUT` while remote Flyway migration was still progressing; cleanup was `PASS`.
- `l2-1788811845727-98640-7ada1b0d-2063-4189-845d-d645933caca5` failed at `L2_PROCESS_EXITED_BEFORE_READY`; the remote tunnel logged SSH timeout/broken pipe and Spring logged PostgreSQL `08006`/`EOFException`. Its initial cleanup boundary was `FAIL`, then the exact managed cleanup recovery completed with `cleanup=PASS`.

The current runtime boundary is therefore `FULL_BROWSER_L2_UNVERIFIED`, `RESET_RESEED_NOT_RUN`, and `DEV_REMAINS_CLOSED`. These records do not change the original `NO-GO M=1/S=0/N=2` verdict, do not constitute a third review, and do not authorize a claim of implementation closeout.
