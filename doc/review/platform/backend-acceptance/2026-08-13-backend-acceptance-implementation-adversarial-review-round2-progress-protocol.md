REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
authorMaterialReadAfterIndependentVerdict=false
blindReviewDeclaration=Fresh independent reviewer first formed the source-only falsification verdict, then read the prompt-authorized fresh dynamic evidence; no author self-review, author finding disposition, existing reviewer finding, or conversation summary was read.

# Backend-acceptance implementation adversarial review — round 2 / progress protocol

## 审查边界与独立性

本轮只审 `PF-10` 的父/子 heartbeat 进度协议，以及它对 `PF-09` 的 stall/cleanup 分离有无回归。
在读取指定 fresh run 的 manifest、`runner.jsonl` 和 r5 child manifest 前，已基于当前
runner、r5 wrapper 与测试源码形成 source-only `VERDICT=NO_GO`：协议必须只接受两种已知
布局、不得放宽任何计数范围或 `firstFailure`，并须有旧相邻字段实现的真实 red proof。随后读取
动态 evidence；它证明 valid r5 happy path，却不能反证 malformed record 被错误接受。

未读取作者自审、作者 finding disposition、既有 reviewer finding 或会话摘要。提示明确要求的
problem-family 文档只作为 PF-09/PF-10 的有限分母与历史问题描述，不采纳其结论代替本轮判断。

## Reviewer input checklist

| 输入 | 路径与 SHA-256 | 已读 / 结果 |
| --- | --- | --- |
| AGENTS | `AGENTS.md` @ `81da35d3e83937ba1b40581e9a490a3b0ec954556471eef30b1a7928313766bc` | READ |
| Claude entry | `CLAUDE.md` @ `2526c69a5740b52ec85b4907f83bbac3abb6fa68695057346b934b0fdbdc4ff2` | READ |
| Blueprint | `PLATFORM-BLUEPRINT.md` @ `414f737c1a9337caad157653cf132e79038724280897ef828f84ac0af8aa2e81` | READ |
| Platform entry | `doc/platform/README.md` @ `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` | READ |
| Program registry | `doc/platform/roadmap-program-registry.json` @ `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ; selected `V2S_W0_W4_EXECUTION` |
| Current Roadmap `CURRENT_*` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` @ `bb4ecd2e0979545e52bb779dbaf01ba855ea12084ea0ef32374b20bb3d3a838b` | READ; current Roadmap step is backend-performance final closure; it is not a backend-acceptance package-exit acceptance |
| Project-memory index | `project-memory/index.md` @ `6067f8400921c4ec9f09caef69ee93a838fb9f18fb11a30fbbb2e5ed1c61d48a` | READ |
| All kernels | `project-memory/kernel/01-workspace-and-roadmap.md` @ `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`; `02-service-shape-and-owner.md` @ `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`; `03-transaction-data-and-dependencies.md` @ `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`; `04-contract-consumer-and-admin.md` @ `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`; `05-evidence-runtime-and-git.md` @ `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736`; `06-heritage-and-change.md` @ `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ_ALL |
| Six-dimension route | `scripts/memory/query --task-kind review --domain backend --consumer-face backend --owner platform --impact runtime --trigger review` | RUN; 12 hits below |
| Routed hits | `project-memory/decisions/confirmed-business-language-corpus.md` @ `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3`; `operations/business-corpus-adoption-and-read-policy.md` @ `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9`; `operations/phase-retrospective-and-systemic-repair.md` @ `a3b18747224364531419b1a1a8de01c610baa3a40daa5f9d1d0b4f754f1dadb3`; `operations/business-corpus-parked-domain-intake.md` @ `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e`; `operations/test-closed-loop.md` @ `6503cadcc35afc01f3b2444cb230752b26e94d2bfc7ccba80d338745ab9a35c5`; `operations/backend-acceptance.md` @ `9771673f43447d9789fa1bc658c523657c51d7476d854f164c68079f5582fba5` | READ_ALL; kernels are the other six route hits |
| Mandatory review memories | `project-memory/decisions/deterministic-context-only.md` @ `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`; `decisions/independent-subagent-adversarial-review.md` @ `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`; `operations/verification-governance.md` @ `5e248d47091b2ff6122f9a0d7fa77793b21aef476add819cac59345d52312bc3`; `operations/implementation-source-reread-discipline.md` @ `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` | READ_ALL |
| Corpus search | `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md` @ `eb8772599be4ec7c9c111c074946f0ff22ce7b73c54ba29bc17e72131eb3849b`; terms `backend-acceptance`, `heartbeat`, `progress protocol`, `stall`, `cleanup` | `NO_CORPUS_ENTRY_MATCHED`; this is runner observability, not a new business fact |
| Scripts entry | `scripts/README.md` @ `c455944fab27809bf934d8e4d37ff836c7feddec70a5bd9cad47af54f86ad31f` | READ |
| All decisions title scan | `doc/decisions/` first-level title listing | READ_ALL_TITLES; directory scan has no file SHA-256 |
| Relevant decisions, full text | `2026-07-24-v2s-verification-governance.md` @ `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5`; `2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` @ `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`; `2026-07-27-v2s-identified-finding-generalization-and-prevention.md` @ `0aca450c2bc6e83da1d6d5e6d5bc1ec74b67245c4c1bb2f1fa65fab841b17bba`; `2026-07-29-v2s-observability-and-acceptance-standard.md` @ `fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777`; `2026-08-11-v2s-routine-runtime-command-classification.md` @ `23ff63cce0853cc77587d8e629717804326914cc87f4217f8e00c28af8f340b0`; `2026-08-13-v2s-backend-acceptance-standard.md` @ `b3635b6d27769cb4e4d1cf26c67d224687985a2389b990a7051cf98e21363dab` | READ_FULL |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` @ `e8469396403d0713ce81204c9a6aeb5baccfa95daf0ca426b310012b5372e71c` | READ_CHECKLIST; `scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE` = PASS, alias `R5` |
| Requirement | `doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md` @ `12e8f75cdf267eae2fa3c5d7a2bb0ba061d8cf95202677423cbb95133a3738bb` | READ_FULL |
| Detailed design | `doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md` @ `11d88e9cf5f1ce9063293cff1f2067816982aaecdbd1ccf4c453999adb1f3a56` | READ_FULL |
| Package authority/admission | `doc/evidence/platform/backend-acceptance/design-admission.json` @ `f2cf435aacdd6281abb63df8853551ee07cc5a3cb72cd82c37776bc0de52f478`; `implementation-manifest.json` @ `c914372e5b1ca037773f2a37ea098f128a38965d91411246ddac6a838c9ef17f` | READ |
| PF denominator | `doc/evidence/platform/backend-acceptance/2026-08-13-unattributed-signal-receipt-and-exit-problem-family.json` @ `6809cbed28a590cf6c39d5ca29e05523def36b735e700040358385b6a917c523` | READ; bounded to PF-09/PF-10 |
| Current implementation | `tools/backend-acceptance/runner.mjs` @ `51e363d2e1317b4c30a751e751ef6b95499cde2cc336e1e24ee4788fa7d04361`; `scripts/test/backend-acceptance` @ `307f0f5595e027e87c6cfdb1a0baba0ab6f35251a0c0c27daf24c994413d1a94`; `scripts/test/backend-acceptance.test.mjs` @ `4587cc55e632e2fa5fdcdb6f03cfe0fe89af2b436819dba43f2114cceb535e00`; `scripts/test/r5-remote-testcontainers.mjs` @ `ab0e9e37fb684d543306a7ab57ca1c12c045b00d317ffacaf860807c5f5c690c`; `scripts/test/r5-remote-testcontainers.test.mjs` @ `4aa5023aa77818b90e511379a0e5ec27798c86a1c4b67e965bead741276e927b`; `scripts/test/r5-testcontainers-daemon-lanes.mjs` @ `5034d30a472ae105029e5b29b3d93d76f709012e9e8f9ee872bc2f757341b177` | READ_FULL |
| Fresh parent evidence | `.runtime/backend-acceptance/backend-acceptance-1786623583031-8d05bbd9/run-manifest.json` @ `071631f7487984ac90c1b448d1db8cc1b1859ac8e088547084fae5a22818e822`; `runner.jsonl` @ `c2d70831c9ff93b54ec2f286e8b6a970dc1d729bea2507c084295add13c42c27`; `managed-child-result.json` @ `8d6faac44bb9d8cdb9c06bc4f8c5a2698e145d0cc87e0b9aca7dd82383d59a6d`; `lanes/lane-1/managed-child-result.json` @ `ffe21b479320a5ebb3416ad061d89484fa3188975cdfd985ed9bffb2fb28939a` | READ_FULL; one-operation focused run only |
| Fresh r5 evidence | `.runtime/backend-acceptance/backend-acceptance-1786623583031-8d05bbd9/lanes/lane-1/evidence/remote-testcontainers/r5-tc-1786623584401-99195/run-manifest.json` @ `174935af10e81ee4552c4a454b23994cd8b59d36c0099f2e2fb6031063e8dfbd`; `backend-acceptance-workload-result.json` @ `aa6431cfcc0ec18f6306cdd1430df5ab52f853ec41194e20edca803e0dca14e5` | READ_FULL; valid r5 `CURRENT=1 COMPLETED=1 TOTAL=1`, `BUSINESS=PASS`, `CLEANUP=PASS` |

The parent and r5 files above are source-of-record evidence inside the named immutable run tree. They are
intentionally not substituted by a historical review or an aggregate status line.

## 用户任务

业务用户需要可信的后台统一验收进度：当一个受管 backend-acceptance child 正在执行时，父进程
只能显示真实、可解释的 operation progress；遇到停滞或 artifact collection 问题时，用户仍能区分
业务/evidence failure 与已证明的资源 cleanup，而不是看到伪完成或伪 cleanup failure。

## Dexter 立场

Dexter 要求第二轮是 fresh 独立、定向证伪审查：只承认两种实际协议，不降低 `TOTAL`、范围或
`firstFailure` 约束；同时不把单 operation focused PASS、196-operation 历史资料或静态通过冒充
全包完成。

## 替代方案

替代方案是继续用当前宽松正则并只依赖 terminal child result。它较短，但不选：运行中的 parent
heartbeat 是受管诊断合同，错误把不一致的 `COMPLETED` 接受为完成会掩盖 child/wrapper 协议漂移。
更小的正确修复是两个显式 parser 加一组调用 production parser 的 scratch red/green 测试，而非
重写 r5 runner、增加轮询，或改变 timeout/stall 策略。

## 方案合理性

当前修复的收益是 valid r5 interleaved layout 已能将 parent 从 `0/1` 推进到 `1/1`；指定 run
在 child 的 `CURRENT=1 COMPLETED=1 TOTAL=1` 后，下一 parent heartbeat 确为 `current=1,total=1`。
但问题仍未完全关闭：`parseChildProgress` 使用的可选 `COMPLETED=\\d+` 没有捕获或检查其值，且
不限定记录属于两种已知 heartbeat。它会把 `CURRENT=1 COMPLETED=999 TOTAL=1` 当作合法进度。
这是一项小实现改动、低复杂度、高诊断收益的修复；不需要扩大为新 runner 或新动态环境。

## UI 与交互

NOT_APPLICABLE：本轮无 UI、无 Journey 页面或用户交互变更；审查对象是受管后台测试 runner 的
本机/远端技术协议。用户可观察的结果仅是 CLI/manifest 进度与 business/cleanup 状态，未涉及
platform-admin 或 operations-admin 的页面、URL、session、actor 或权限语义。

## 实施代码核验

已重开 runner 与 r5 源码，并执行：`node tools/backend-acceptance/runner.mjs --self-test`、
`node scripts/test/backend-acceptance.test.mjs`、`node scripts/test/r5-remote-testcontainers.test.mjs`
及 `node scripts/test/r5-remote-testcontainers.mjs --self-test`；均 PASS。它们是代码/测试 evidence，
不替代业务用户行为或 fresh managed evidence。

指定 fresh run 是一次真实 HTTP 的单 operation focused run，四维与 cleanup 都为 PASS；它在 raw
runtime evidence 增长、operation 尚为 0 时进入 `STALL_DIAGNOSING`，随后才以 semantic event 把
`CURRENT/COMPLETED` 推进到 1，并最终 `CLEANUP=PASS`。这支持业务用户所需的可解释诊断，亦表明
PF-09 当前未回归。它不覆盖 196 operations、历史 finding 或 package-exit。

## 审查意见复核

每项 disposition 都以当前源码与 fresh evidence 复核；反例限定适用边界。M-01 的更小修复是
strict parser 加 production-path red test，避免为一个文本协议过度设计新的 runner、轮询或 timeout，
并把成本限制在既有 parser/test owner。

### M-01 — CONFIRMED：父端并未严格接受两种已知协议，且缺少旧实现真红证明

- **证据**：`tools/backend-acceptance/runner.mjs:197-210` 用
  `CURRENT=(\\d+)(?:\\s+COMPLETED=\\d+)?\\s+TOTAL=(\\d+)` 解析任意文本；仅校验
  `CURRENT` 与 `TOTAL`，完全忽略显式 `COMPLETED`。`scripts/test/r5-remote-testcontainers.mjs:586-593`
  产生的合法 r5 record 始终令 `current===completed`，因而该不变量是可验证的。runner self-test
  只证明当前 parser 能读两条 happy-path 字符串，未在 scratch copy 中把旧相邻-field parser
  变回去并观察 interleaved r5 layout 失败。指定 fresh run 的 valid `1/1/1` 只能证明正例，不能
  证明拒绝不一致记录。
- **适用分母**：PF-10 声明的每个 parent 解析 child heartbeat 的位置；当前扫描到的 legacy
  `CURRENT/TOTAL` 与 r5 `CURRENT/COMPLETED/TOTAL` 两种布局。
- **反例**：合法 legacy `CURRENT=1 TOTAL=1 FIRST_FAILURE=NONE` 与合法 r5
  `R5_TESTCONTAINERS_HEARTBEAT ... CURRENT=1 COMPLETED=1 TOTAL=1 FIRST_FAILURE=NONE` 必须继续
  accepted；它们不是本 finding。`CURRENT=1 COMPLETED=999 TOTAL=1`、或非 heartbeat 文本中夹带
  `CURRENT=1 TOTAL=1` 则不属于两个已知布局，当前实现却接受前者并推进父进度。
- **最小修复**：为两种 layout 使用显式、带事件-kind 的 parser；r5 分支捕获 `COMPLETED` 并要求
  `0 <= CURRENT === COMPLETED <= TOTAL === lane.operationIds.length`，legacy 分支保留
  `0 <= CURRENT <= TOTAL === lane.operationIds.length`。两支都只接受/保留首个有效
  `FIRST_FAILURE`，不能被后续 `NONE` 覆盖。将 parser 提为可由现有 self-test 调用的 production
  helper，新增 scratch red：旧相邻 parser 不匹配 valid interleaved record；不一致 completed、
  total mismatch、range overflow、未知 layout 与 `FIRST_FAILURE` 降级均必失败；未变字节的 valid
  两布局均 PASS。

### N-01 — REJECTED_WITH_EVIDENCE：PF-09 stall/cleanup 分离未见回归

- **证据**：r5 的 `backendAcceptanceObservationKey` 仅依赖 log/test bytes 与 semantic
  `completed/total/firstFailure`，不含 raw runtime evidence bytes；
  `finalizeCleanupAfterCollection` 仅把 collection failure 写入 `cleanup.collection`，不改资源组件。
  指定 run 的 parent log 显示 0-progress 时 raw evidence 持续变化、在 140s 进入
  `STALL_DIAGNOSING`、153s 才有 `CURRENT=1 COMPLETED=1 TOTAL=1`；r5 manifest 和 parent result
  都有 `firstFailure=null`、`BUSINESS=PASS`、`CLEANUP=PASS`。
- **适用分母**：PF-09 的每个受监测 child：raw artifact write、semantic HTTP completion、terminal
  collection 与 process/scratch/container/volume cleanup。
- **反例**：artifact collection 真失败时，business/evidence 必须 FAIL；资源 cleanup 组件真的 FAIL
  时 overall cleanup 仍必须 FAIL。此 finding 只拒绝“资源已 PASS 却因 collection 不可用被改写为
  cleanup FAIL”的当前回归，不把 focused PASS 扩张为全包动态 PASS。
- **最小修复**：无；保留现有分离并把 M-01 的 parser 测试同时证明 malformed progress 不会重置
  stall 判断或覆盖 firstFailure。

### S-01 — CONFIRMED：全包 closure 仍不可宣称

- **证据**：指定 run 是 `--operation` / 1 operation；`scripts/check/backend-acceptance-change-impact
  --package-exit` 当前返回 `BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING`。历史 disposition 仍是
  `ENTRY_REPLAY_DENOMINATOR`，implementation manifest 仍为 `IMPLEMENTATION_ACTIVE`。
- **适用分母**：196 current operations、6 performance + 15 HTTP + 8 non-route 历史 finding、P0/W0/P1
  package exit、pre/post-retirement full runs。
- **反例**：本次 focused HTTP four-dimension PASS 与 PF-09/PF-10 targeted evidence 合法且有价值，
  但不是 full denominator、historical replay 或 package-exit receipt。
- **最小修复**：先关闭 M-01，再按已批准 design 完成全部 operation/scenario/baseline/history
  dispositions、full dynamic four-dimension evidence 与 package-exit；不以增加 timeout、重复 focused
  run、删除 ledger 或改写 status 代替。

## 闭环核验

- `scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE`: PASS (`R5` alias)。
- runner/r5 static self-tests: PASS；它们没有满足 M-01 所需的 legacy-parser true-red proof。
- fresh focused dynamic run: contract/business/performance/cleanup PASS，且 r5 and parent progress
  correlation validates the valid interleaved layout.
- cleanup 与 business 保持独立：PF-09 targeted regression is `REJECTED_WITH_EVIDENCE`。
- 本轮为 round 2 hard stop；`ROUND_FINAL_DECISION=SELF_DECIDED`，不得以换 reviewer 或改文件名启动
  第三轮。作者可基于 M-01 的最小修复与新证明进行既有流程处置，但该动作不改变本 artifact verdict。

## 结论

VERDICT=NO_GO

**Targeted verdict**：`NO_GO`。M-01 使 PF-10 修复尚不可靠：当前代码接受不一致的 interleaved
counter，且没有证明旧实现会对 valid r5 layout 真红、修复后才绿。

**Scope limit**：即使 M-01 完成，也不得宣称整个 `BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813`
package GO；196 operation migration、历史 finding exact replay、full fresh dynamic evidence 与
package-exit 仍未关闭。
