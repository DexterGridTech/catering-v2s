# Backend-acceptance source-audit finding register — 2026-08-13

## Record boundary

- **Status:** OPEN. No entry is repaired or dynamically verified by this document.
- **Purpose:** preserve confirmed gaps found by rereading the approved requirement/design and current source before any corrective patch. This is a source-audit register, not a runtime report or completion claim.
- **Closure rule:** a repair needs the listed source condition, real red-to-green proof where required, fresh managed execution, and package-exit equality. Historical reports, file existence, provider count, a static gate, or a filtered call list never close an entry.
- **Approved source binding:** requirement SHA-256 12e8f75cdf267eae2fa3c5d7a2bb0ba061d8cf95202677423cbb95133a3738bb; design SHA-256 11d88e9cf5f1ce9063293cff1f2067816982aaecdbd1ccf4c453999adb1f3a56.
- **Source snapshots:** provider SPI f876b56f8f32738df422d9964058703cd40c7b159ceed7dbff4ab846b8275675; suite 13d75a12d7e5a7a9c0fef98d6c3f953a65b4280b04f754a85d7e971b36eb2ab0; workload ec2bfdab62e9376a257ccdd5e8917d2b5160627160b77f5873b6a7a50a560917; CLI f47dca77938654e0763f0f8d0ac2b329ec95b3c888aedf314faca94ede09c43d; parent runner c142fa08dd142c1b375c44191715138e71ecdc68ef3ee4e23e8ed339b641df5d; remote runner ab0e9e37fb684d543306a7ab57ca1c12c045b00d317ffacaf860807c5f5c690c.

The requirement demands one fresh real-HTTP correlation with CONTRACT, BUSINESS, deterministic PERFORMANCE, and CLEANUP; each scenario has identity, fixture, request, businessOracle, performanceCriterion, and cleanup. The design requires selected owner-provider execution (BA-U03 §6.2) and serial per-operation migration (BA-U05/BA-U06). This register records current source against those rules.

## Family scan

1. rg -l --glob '*.java' 'class .*BackendAcceptanceScenarioProvider' apps/backend/catering-business-server/modules: **196** concrete providers.
2. rg -l --glob '*.java' 'GENERATED_OPERATION_REQUEST_BUILDER' apps/backend/catering-business-server/modules: **196** static request tokens.
3. rg -l --glob '*.java' 'executeBackendAcceptanceInteraction' apps/backend/catering-business-server/modules/*/src/testFixtures: **0** executable owner-fixture calls.
4. Full-chain source scan: runGeneralWorkload, operationScope, filterEvidenceToOperationScope, aggregateBackendAcceptanceEvidence, validateBaselineComparison, closeDynamic, SIGTERM, SIGINT, SIGHUP, process.once, process.on, kill -0.
5. **BA-SA-007 regression-fixture scan:** `node scripts/test/backend-acceptance.test.mjs` first failed at `BACKEND_ACCEPTANCE_ENTRY_BUNDLE_ACTIVATION_MISSING`; the finite same-root denominator was the one `copyFixture()` flat-entry copier in `scripts/test/backend-acceptance.test.mjs`. The test fixture must use the production no-replace bundle publisher in its temporary repository. It must not create an activation or recapture entry bytes in the real repository.
6. **BA-SA-007 entry-schema sibling scan:** after the fixture was made bundle-shaped, all references to `knownUncoveredEntrySha256` were searched. `tools/backend-acceptance/cli.mjs` had four consumers still reading the removed top-level field although `captureEntry()` and the impact owner place it under `entrySnapshot.entryBundle`. The finite denominator is `validateEntrySnapshot`, dynamic closure validation, and dynamic closure write; all must consume the one bundle-bound value.

## Detailed-design to source matrix

This is a clause-by-clause source-audit classification, not a claim that any
unit is implemented or dynamically accepted. `STATIC CONTROL EXISTS` means
only that the named source has a real, relevant static control; it never
upgrades an open dependency to PASS. At the end of this pass every BA-U01..U06
and I0..I9 clause has either such a source path or one or more concrete
root-family records below; there is no remaining unclassified detailed-design
clause in the current source audit. A repair can still expose a new defect and
must then reopen this matrix.

| detailed-design scope | current source classification | confirmed root family or source path |
| --- | --- | --- |
| I0 — atomic package entry | DEVIATES: production surface is hand-picked and the correlated entry records are exposed through sequential writes, not one immutable activation. | BA-SA-007 |
| BA-U01 / I1 — route freshness and design admission | STATIC CONTROL EXISTS for route/binding exact-set and digest freshness (`operationState()` / `compareProjectionFreshness()`); DEVIATES for Gradle-derived P0/W0/O0 and entry binding. | BA-SA-007 |
| BA-U02 / I2 — denominator, scenario registry and ratchet preflight | STATIC CONTROL EXISTS for set/field shape and monotonic subset checks; DEVIATES because the registry is metadata-only at runtime and accepted-baseline history is not a ratchet. | BA-SA-001, BA-SA-003, BA-SA-010 |
| BA-U03 / I3 — selected real HTTP harness and four dimensions | DEVIATES: no owner provider is invoked, scope is applied after the predecessor workload, and receipt dimensions derive from transport joins. | BA-SA-001, BA-SA-002, BA-SA-003 |
| BA-U04 / I4 — per-edit impact, disposition, BUG_FIX and consumer proof | DEVIATES: impact entry is not frozen from the actual Gradle graph and validators accept opaque text rather than reopening the protected facts. | BA-SA-006, BA-SA-007 |
| BA-U05 / I5 — source-ordered operation migration | DEVIATES: one terminal bulk close changes all operation state; no authoritative per-operation journal links scenario, baseline, P4, legacy assertion and history migration. | BA-SA-004, BA-SA-008, BA-SA-010 |
| BA-U06 / I6 — fresh full pre-retirement run | DEVIATES: there is no source-complete operation/assertion/predecessor denominator or independent I6 artifact. | BA-SA-009 |
| BA-U06 / I7 — exact predecessor dispositions and retirement | DEVIATES: asset inventory omits module tests and predecessor runner families; assertion identity is a source-file name, not a semantic assertion. | BA-SA-009 |
| BA-U06 / I8 — fresh full post-retirement run | DEVIATES: lifecycle has no distinct post-retirement state and cannot bind final bytes to a new full run. | BA-SA-009 |
| BA-U06 / I9 — package exit six-denominator reconciliation | DEVIATES: package exit only delegates to shallow impact validation and does not join all six denominators, hook receipts, I6/I8 or historical closure. | BA-SA-006, BA-SA-009 |
| managed cancellation, required before another long dynamic run | DEVIATES: outer local and remote parents have no idempotent exact-identity cancellation supervisor. | BA-SA-005 |

## Confirmed findings

### BA-SA-001 — Static owner declarations do not become executable owner scenarios

- **Class:** CONFIRMED; implementation wiring deviation and control false-green.
- **Generic root:** declaration/materialization is accepted although no engine instantiates it or executes fixture, request, business oracle, performance criterion, and cleanup.
- **Source facts:** shared SPI is metadata-only at modules/asset/src/testFixtures/java/com/catering/v2s/platform/asset/acceptance/BackendAcceptanceScenarioProvider.java:7-17; a catalog provider returns GENERATED_OPERATION_REQUEST_BUILDER and strings at modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/PreflightOperationsBrandCatalogCopyBackendAcceptanceScenarioProvider.java:8-19. The app facade is a subinterface at apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioProvider.java:7-9, so the 196 shared-SPI providers cannot be collected through it. BackendAcceptanceTest.java:91-151 launches Node without discovery/invocation. tools/backend-acceptance/cli.mjs:1133-1160 validates only file/package/implements shape.
- **Finite denominator:** 196 owner fixture providers; shared SPI; app facade; app suite; app fixture classpath; materialization validator.
- **Counterexample:** ten owner fixture roots are already on the app test classpath at apps/backend/catering-business-server/build.gradle.kts:88-97 and the Java HTTP/metric harness exists. That is a bridge location, not execution proof.
- **Minimum repair:** one closed executable provider contract loaded from owner fixture roots and consumed before selected HTTP. ServiceLoader is acceptable only with exact discovery, identity equality, and invocation proof; an app-local 196-class list is not.
- **Close condition:** sorted bootstrap provider runs all four dimensions; static-only/unconsumed provider red mutations fail; then migrate all 196 in owner order.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — extend materialization/harness tests with real provider-load/invocation red mutations.

### BA-SA-002 — Selection happens after the full predecessor workload already ran

- **Class:** CONFIRMED; execution-selection deviation.
- **Generic root:** report-time filtering cannot constrain prior side effects, fixture ownership, first failure, duration, or cleanup.
- **Source facts:** tools/backend-acceptance/workload.mjs:699-816 unconditionally runs foundation, invitation, operations, catalog, performance, remaining, recovery, and finalization. execute() calls it at 1205, only then derives scopedExpectedOperations and filters calls at 1207-1217; event filtering at 957-976 is likewise post-execution. The public `--per-edit` route also deliberately returns the full current denominator while BA-U04 is inactive (`tools/backend-acceptance/runner.mjs:74-84`), rather than consuming an impact-owner result before scheduling lanes.
- **Finite denominator:** scope parsing; impact-owner-to-runner selection bridge; workload selection/aggregation; parent lane assignment; remote child invocation; predecessor diagnostic registry/recipe executor; receipt writer.
- **Counterexample:** post-execution filtering can be a report projection for an already correctly selected run. It cannot implement bootstrap selection, lane ownership, or serial migration.
- **Minimum repair:** select identity before every fixture/HTTP action, run only its provider plus declared prerequisites, and produce an exact executed-identity receipt. Old diagnostic recipes may remain only as deliberate lower-level helpers.
- **Close condition:** one-operation red test rejects outside-closure request/fixture; two-operation isolation shows no cross-execution/reporting; no hidden full general workload.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — executable scope-before-side-effect tests.

### BA-SA-003 — Four-dimensional receipts are assigned from transport joins, not required oracles

- **Class:** CONFIRMED; acceptance-oracle false-green.
- **Generic root:** correlation/route/status prove transport observation, not schema/envelope/Problem, business readback/state, structural budget, or full managed cleanup.
- **Source facts:** executeBackendAcceptanceInteraction accepts 2xx or expected 4xx and parses JSON but has no schema/envelope/Problem validation (tools/backend-acceptance/workload.mjs:316-359). Diagnostic oracle is a string at scripts/test/http-diagnostic-scenarios.mjs:3-5; validator checks route/status/rejection only at scripts/test/http-diagnostic-workload.mjs:1139-1153. Aggregator assigns contract/business/performance/cleanup PASS at workload.mjs:1052-1066, uses the first observed call as representative at 1079-1084, and only merges catalog-private-file cleanup plus a text owner at 1087-1093.
- **Finite denominator:** common HTTP interaction; diagnostic facts/validator; aggregate/receipt writer; common OpenAPI/Problem path; provider business-oracle path; runner cleanup-result bridge.
- **Counterexample:** an exact typed rejection is a valid narrow assertion and calibration validates its metric path. Neither is a universal contract/business oracle.
- **Minimum repair:** common OpenAPI/envelope/Problem validation; typed owner business oracle with readback/state change; measured-versus-accepted operation metrics; cleanup joined from identity-bound runner result. Aggregate only evaluated outcomes.
- **Close condition:** wrong business value despite valid schema, wrong envelope, wrong typed Problem, metric overrun, and cleanup-component fail each red in the corresponding dimension; 2xx cannot yield BUSINESS PASS alone.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — mutate production validator/oracle paths, not receipt literals.

### BA-SA-004 — Baseline and migration state move in one all-operation close action

- **Class:** CONFIRMED; I5 state-machine deviation.
- **Generic root:** an unpersisted first measurement is marked PASS and a later full-run action promotes rows together, erasing the serial per-operation migration boundary.
- **Source facts:** validateBaselineComparison reports FIRST_FRESH_ROUTE_MEASUREMENT PASS for an unmeasured row without writing it at tools/backend-acceptance/workload.mjs:904-954. tools/backend-acceptance/cli.mjs:1919-2072 uses closeDynamic() to promote baseline/known-uncovered state; its first-measurement form appears at 2032-2036.
- **Finite denominator:** baseline registry/validator; known-uncovered ledger; receipt writer; closeDynamic mutation; owner-migration loop; legacy-test and P4 disposition paths.
- **Counterexample:** a truly accepted baseline may compare a previously migrated operation later. It does not permit batch promotion or coverage before provider/oracle/cleanup/legacy migration.
- **Minimum repair:** persist/validate each selected operation’s candidate and disposition, remove only its matching rows after source-backed proof, and reserve full run for verification of completed state.
- **Close condition:** two-operation red test proves A cannot promote B; midstream failure leaves B unmeasured/uncovered; I5 owner order is observable.
- **Prevention:** REVIEW_CHECKLIST, OPEN — row equality is mechanical; owner business/legacy assertion equivalence requires reread and independent review.

### BA-SA-005 — Cancellation can bypass identity-bound terminal cleanup

- **Class:** CONFIRMED; managed-runtime lifecycle gap.
- **Generic root:** outer parents rely on ordinary finally cleanup, but lack an idempotent signal supervisor that records terminal facts and reaps only exact owned children.
- **Source facts:** tools/backend-acceptance/runner.mjs:285-475 launches lane/aggregation children; execute at 535-640 has no parent signal-to-terminal handler. scripts/test/r5-remote-testcontainers.mjs:1191-1318 similarly relies on try/finally; its remote process is detached via setsid. reap() uses kill -0 as liveness at 1068-1088, so a zombie is treated as live. Workload one-shot listeners are a counterexample to “no signal handling,” but do not supervise outer parent/remote trees.
- **Finite denominator:** parent lane/aggregation spawns; remote launch/control/reap; workload child helper; suite-daemon child control; manifest/result writers; SIGTERM/SIGINT/SIGHUP tests.
- **Counterexample:** ordinary in-process failure reaches existing finally cleanup. Preserve it; do not kill daemon or any PID whose host/boot/start-ticks do not match the current run.
- **Minimum repair:** idempotent outer cancellation supervisor: first signal stops new work, records cancellation, reaps only exact process groups, waits/diagnoses/writes terminal result; repeats are idempotent; zombie is terminal for reaping but diagnostic is retained.
- **Close condition:** real child process test sends TERM then another signal, proves one terminal path, zero owned residuals, and identity-mismatch refusal; business and cleanup remain distinct.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — real process/signal red-to-green tests, never source-string-only tests.

### BA-SA-006 — BA-U04 accepts opaque references instead of validating the claimed protection

- **Class:** CONFIRMED; change-impact/disposition false-green.
- **Generic root:** a production control accepts nonempty text in place of opening and binding the scenario, contract, receipt, consumer artifact, or preserved pre-fix byte it claims to protect.
- **Source facts:** `tools/backend-acceptance/impact.mjs:586-665` checks only strings for `SCENARIO_UPDATED`, `REGRESSION_ADDED`, `BEHAVIOR_UNCHANGED`, consumer dispositions, and BUG_FIX receipts. It does not require a changed scenario digest or a closed direction enum; open and hash the referenced scenario/receipt/artifact; compare an unchanged contract to current bytes; prove all four fresh verdicts and accepted-baseline equality; or bind `preByteHash`/`postByteHash` to preserved bytes and the same fixture/case. `scripts/check/backend-acceptance-change-impact.test.mjs:41-79` has only an in-memory happy path and does not perform the required production-path red mutations. Both package-exit adapters merely call this shallow validator (`tools/backend-acceptance/impact.mjs:733-756`, `tools/compliance-control/cli.mjs:1531-1554`), and both allow the required BUG_FIX red-proof mode to be changed by ambient `V2S_BACKEND_ACCEPTANCE_PACKAGE_KIND` (`impact.mjs:746`, `compliance-control/cli.mjs:1549`) instead of an entry-bound package classification.
- **Finite denominator:** BA-U04 operation disposition validator; consumer disposition validator; BUG_FIX validator and entry-bound package classification; both package-exit adapters; their production-path scratch tests; the run-scoped disposition schema.
- **Counterexample:** `tools/backend-acceptance/cli.mjs:1216-1458` does open and bind selected historical receipt references. That later, full-closure-specific path cannot validate a BA-U04 per-edit disposition or substitute for its required red proof.
- **Minimum repair:** make every disposition field a typed, repository- or run-scoped hash-bound reference; reopen its target and enforce exact scenario/direction, contract/current-byte, accepted-baseline, consumer-artifact, and four-verdict invariants. Preserve `UNPROTECTED_FIX` only as an explicit sealed exception that becomes an implementation-review input, never an indistinguishable PASS.
- **Close condition:** production validator red mutations reject unchanged scenario digest, invalid direction, fake or stale four-dimension receipt, mismatched baseline, missing/forged consumer artifact, and BUG_FIX whose pre bytes or pre verdict do not fail; each resulting route uses real referenced bytes rather than test literals.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — expand the existing change-impact scratch suite to mutate copied production inputs through the production validator.

### BA-SA-007 — BA-U04 lacks one immutable, Gradle-derived entry bundle

- **Class:** CONFIRMED; impact-surface/entry-integrity deviation.
- **Generic root:** two commands independently reconstruct a hand-picked production list, then four correlated entry artifacts are written in sequence; exit anchor validation also consults current inventory bytes instead of only entry-captured reverse mappings.
- **Source facts:** `tools/backend-acceptance/impact.mjs:21-25,198-228` and `tools/backend-acceptance/cli.mjs:292-311` duplicate the same hard-coded directory/build-file scan. It does not derive Gradle main source sets, compile/process-resource task inputs, or generator dependency inputs; the app build defines such inputs at `apps/backend/catering-business-server/build.gradle.kts:8-49`. The catalog module additionally makes repository `contracts/` a real main Java source root (`modules/catalog/build.gradle.kts:6-10`), while root `settings.gradle.kts:17-33` and `build.gradle.kts:29-42` affect inclusion/toolchain; none are derived from the current hand list. `captureEntry()` obtains its own P0/W0 at `tools/backend-acceptance/cli.mjs:798-842` and writes manifest, impact snapshot, uncovered ledger, and package input separately at 939-942. Its later validator re-reads active-selected paths but does not rebind the captured active-package hash or implementation-manifest hash (`cli.mjs:953-985`). `loadEntrySnapshot()` and `deriveImpact()` validate W0 against `semantic.sourceInventory` reloaded from current bytes (`tools/backend-acceptance/impact.mjs:459-464,522-527`), not an entry-frozen reverse map. Finally `impact.mjs --package-exit` and the compliance package-exit command are duplicate exit owners with different inputs (`impact.mjs:733-756`, `compliance-control/cli.mjs:1531-1554`).
- **Finite denominator:** actual Gradle backend project closure, main/task/generator input derivation and Gradle-model provenance; one impact owner; entry capture; P0/W0/O0 bundle; entry inventory reverse map and source hashes; active/manifest/bundle hashes; one no-replace activation pointer; one exit adapter and derivation.
- **Counterexample:** `changedSurfacePaths()` does correctly compute existence/full-hash delta for files that made it into P0. That does not protect a production task input omitted by the duplicated hand list or a partially written entry capture.
- **Minimum repair:** one impact owner must derive a serializable P0/W0/O0 bundle from the actual Gradle source/task/generator graph and freeze both anchor bytes and operation reverse mappings at entry. Construct all dependent entry artifacts in a staged immutable bundle and make one no-replace activation visible only after bundle completion; bind active-package, manifest, pointer and bundle hashes together. Exit must consume entry mappings, never current inventory as an authority, and the public per-edit path must consume this same owner result.
- **Close condition:** production-path scratch mutations prove omitted Gradle source/task/generator input becomes ALL, source-inventory drift cannot rewrite entry mapping, active/manifest/pointer mutation fails, direct duplicate exit is unavailable, and interrupted bundle construction has no admissible partial active state.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — route all entry/exit derivation through the one owner and add red mutations for Gradle task-input omission, W0 self-admission, current-inventory drift, active/manifest/pointer drift, duplicate adapter invocation, and partial activation.
- **Lifecycle disposition (2026-08-13 implementation audit):** the already-present flat entry has `P0=633`, while the first real Gradle derivation yields 822 inputs.  It is therefore not a valid I0 authority. Because source writes followed that historical capture, recapturing its P0 from the current tree would falsely describe post-entry bytes as I0. The repair rejects that legacy flat entry and leaves per-edit/package-exit fail-closed until a newly authorized, pre-write implementation-package entry is created through the staged-bundle path. This is an explicit implementation-lifecycle gap, not evidence that I0 has been repaired retroactively.

### BA-SA-008 — I5 is represented as one bulk terminal promotion, not serial owner/operation migration

- **Class:** CONFIRMED; I5 state-machine deviation.
- **Generic root:** the registries have only entry and globally closed states, so per-operation provider/assertion/history/P4/baseline proof has nowhere to become authoritative before every other operation completes.
- **Source facts:** `closeDynamic()` forbids any ledger change after entry (`tools/backend-acceptance/cli.mjs:1932-1935`), demands one full run (`1936`), maps every baseline row from that run (`2016-2043`), and clears every uncovered row in one write (`2045-2057`). Historical closure requires the final closed state and full dynamic state (`tools/backend-acceptance/cli.mjs:1248-1254`), not owner-order intake. `validateP4Retirement()` only accepts zero rows (`1628-1634`); the current 28 P4 rows have no `operationId`. These facts contradict BA-U05/I5's per-owner, per-operation sequence.
- **Finite denominator:** operation migration journal; owner/path/operation ordering; scenario/provider invocation; candidate/accepted baseline state; KNOWN_UNCOVERED; historical 6+15+8 dispositions; P4 cases; assertion migration; shared authority-file writer.
- **Counterexample:** a final full run is still required to verify a completed migration. It cannot create the per-operation facts or replace their serial proof and source reread.
- **Minimum repair:** represent migration state per operation with source-derived owner order and explicit links to the provider, route red/green, candidate baseline, relevant assertion/P4/history rows, and cleanup. Only the selected operation may transition after its proof; the full run verifies the completed set without promoting it.
- **Close condition:** two-operation production-path red test proves A cannot alter B's baseline/uncovered/history/P4/assertion state; a midstream failure preserves B as open; owner and operation order are observable and exact.
- **Prevention:** REVIEW_CHECKLIST, OPEN — mechanical set equality plus mandatory per-operation source reread; no shared registry mutation may be parallelized.

### BA-SA-009 — Assertion, predecessor, retirement and package-exit denominators are not the detailed-design lifecycle

- **Class:** CONFIRMED; BA-U05/BA-U06 denominator and exit deviation.
- **Generic root:** source files are treated as assertion identities, discovery omits owner-module tests and predecessor runner families, and the remaining retirement/exit path has no I6→I7→I8 artifact lineage or six-denominator reconciliation.
- **Source facts:** `assetSnapshot()` captures three r5 scripts and app test Java only (`tools/backend-acceptance/cli.mjs:348-365`), while current owner modules contain 69 `src/test/java` files. `assertion-migration.json` has 52 rows whose `assertionKey` equals `sourcePath`, so it has no assertion-level denominator. The predecessor disposition list contains neither the fixed-number backend-performance runner nor the HTTP diagnostic/workload chain. `preflight()` validates dynamic and retirement together once the ledger is globally closed (`tools/backend-acceptance/cli.mjs:2127-2143`); `closeDynamic()` can run only from static entry state (`1927-1931`), so no post-retirement full run can be bound. Finally, `backendAcceptancePackageExit()` validates only impact/dispositions (`tools/compliance-control/cli.mjs:1531-1554`) and does not reconcile the six design denominators, pre/post hook receipts, historical closure, or I6/I8 dynamic artifacts.
- **Finite denominator:** app/module test and fixture source discovery; semantic assertion inventory; predecessor runner/fixture/report inventory; P4 case→operation mapping; I6 pre-retirement run; I7 exact dispositions; I8 post-retirement run; I9 six source denominators and incremental receipts.
- **Counterexample:** a module test that is truly an architecture or pure-algorithm test may be retained with a different duty. It still needs a source-derived assertion/duty disposition; omitting the module tree cannot establish that exemption.
- **Minimum repair:** derive a semantic assertion and predecessor asset inventory from all relevant app/module test, fixture, runner, report, and policy roots; map every P4 case to its source-derived operation or a closed exemption. Persist distinct I6/I7/I8 state artifacts and require I9 to join their hashes with all six denominators and actual Pre/Post receipt equality.
- **Close condition:** discovery red tests detect a newly added module assertion or old runner, an unmapped P4 row, missing I6/I8 pair, changed post-retirement byte without rerun, and missing source-denominator or hook receipt at exit.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — source-derived inventory and phase-lineage validators, with independent review sampling semantic assertions rather than file counts.

### BA-SA-010 — Accepted baseline has neither append-only history nor controlled increase/decrease semantics

- **Class:** CONFIRMED; BA-U02/BA-U05 performance-policy deviation.
- **Generic root:** the registry models only `NOT_MEASURED` versus a single first measurement, so it cannot preserve previous/current/direction/reason/owning-source/approval facts or decide a later baseline increase/decrease.
- **Source facts:** detailed design §3.3 requires append-only accepted history and explicit approval for an increase. `validateBaseline()` only requires a nonempty `latest` and `history` for measured rows (`tools/backend-acceptance/cli.mjs:1163-1202`), with no history-chain, direction, reason, owning source, approval, calibration, or metric comparison validation. `closeDynamic()` rejects every non-entry baseline (`2021-2025`) and writes one first measurement as the whole history (`2027-2042`); no command can append an accepted change. The workload comparator treats an unmeasured operation as a temporary first-measurement PASS instead of creating the required state (`tools/backend-acceptance/workload.mjs:904-954`).
- **Finite denominator:** accepted-baseline schema; per operation/case/metric history; calibration receipt; baseline comparator; migration journal; increase approval source; decrease reason/owning source; full-run verifier.
- **Counterexample:** a first fresh measurement may legitimately initialize a previously unmeasured operation after calibration. It does not remove the required append-only record or authorize later movement of an accepted baseline.
- **Minimum repair:** make baseline history append-only per operation/case/metric, hash-bind each calibration and receipt, and validate previous/current/direction/reason/owning source. Forbid an increase without an explicit approval reference; allow a decrease only through the same per-operation migration transition, never by replacing the registry.
- **Close condition:** production-path red mutations reject an overwritten history, skipped predecessor, uncalibrated first write, unapproved increase, and decrease lacking reason/owning source; a valid per-operation append succeeds without changing any unrelated operation.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — baseline validator and scratch mutations operate on copied registry/history bytes, not output literals.

## Equality and repair order

| finding set | prevention set | result |
| --- | --- | --- |
| BA-SA-001, BA-SA-002, BA-SA-003, BA-SA-004, BA-SA-005, BA-SA-006, BA-SA-007, BA-SA-008, BA-SA-009, BA-SA-010 | BA-SA-001, BA-SA-002, BA-SA-003, BA-SA-004, BA-SA-005, BA-SA-006, BA-SA-007, BA-SA-008, BA-SA-009, BA-SA-010 | equal; all prevention items remain OPEN |

Order: **BA-SA-007** first to make the entry authority one and immutable; then **BA-SA-001/002/003** to create an executable selected-operation bridge; then **BA-SA-004/006/008/010** to make per-operation migration, baseline history, and protections real; then **BA-SA-009** for source-complete I6–I9 retirement/exit; then **BA-SA-005** before another long managed run. Only after that may the 196-operation migration, historical-finding migration, baseline closure, and independent implementation review advance.

## BA-SA-011 — Invalidated package identity was bound as a singleton rather than an explicitly admitted successor chain

- **Class:** CONFIRMED; implementation-package re-entry and I0 authority deviation.
- **Generic root:** a package-entry control plane that embeds one historical package identity in every executor cannot recover honestly after its entry bytes become invalid. Replacing that identifier in one artifact either reuses stale authority or permits an arbitrary package-shaped state; both break the immutable entry boundary.
- **Source facts:** the original package has no active entry-bundle pointer, so the entry guard fails `BACKEND_ACCEPTANCE_ENTRY_BUNDLE_ACTIVATION_MISSING`. Its source surface was subsequently corrected from the original incomplete denominator to the Gradle-derived denominator, so no new I0 can truthfully be attributed to the original package. The hard-coded identity appears in the backend-acceptance CLI, change-impact owner, compliance control adapter, implementation-design admission validator, derivation policy, and active registries. The unrelated RM1 successor mechanism has an RM1-specific ID grammar, roots, and authorization model and therefore is not a valid re-entry route.
- **Finite denominator:** active backend-acceptance package binding; successor authorization and predecessor-terminal record; implementation design admission; derivation policy; entry-bundle pointer, bundle, package input, manifest, entry snapshot and entry ledger; backend acceptance CLI, impact owner, compliance adapter, design-admission validator, and their scratch red controls.
- **Counterexamples:** a syntactically valid package with `backend-source` and a closed per-edit profile is not backend-acceptance authority; a historical package with a valid prior design binding is not recoverable if its I0 bytes are invalidated. The legacy RM1 successor admission remains valid only for its own RM1 scope and is deliberately not generalized.
- **Minimum repair:** create one backend-acceptance-specific successor binding that names exactly one successor package and hash-binds its Dexter authorization, terminal predecessor record, design admission, and derivation policy. Every backend-acceptance executor resolves its expected identity and entry-bundle location from that binding, validates exact all-member equality, and refuses missing I0, arbitrary IDs, stale active hashes, or mixed predecessor/successor artifacts. The successor captures a new immutable I0 at current bytes; the old package remains terminal and cannot be recaptured or closed.
- **Close condition:** focused production-path red controls reject arbitrary package shape, a successor binding with a mismatched admission/active/bundle member identity, a changed active-package hash, a missing I0 activation pointer, and a legacy flat recapture; the authorized successor captures I0 once and its guard, entry check, P0/W0/O0 derivation and post-write gate all pass.
- **Prevention:** EXISTING_MACHINE_CONTROL, OPEN — backend-acceptance successor binding validator plus entry-bundle and design-admission scratch mutations; package-exit will require BA-SA-011 prevention equality before any dynamic claim.
