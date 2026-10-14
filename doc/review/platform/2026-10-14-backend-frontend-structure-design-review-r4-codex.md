# 前后台结构优化 · R4 独立差量报告

Dexter，R4 独立差量核验完成：`GO_WITH_UNVERIFIED_UI，0M/0S/0N`。没有发现本轮范围内新的设计阻断。以下内容供主 agent 原样存档；本 reviewer 未写文件。

```text
REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=4
ROUND_AUTHORITY=DEXTER_EXPLICIT_UNTIL_GO
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-14-backend-frontend-structure-design-review-inputs-r4-codex.md
APPROVED_REVIEW_SCOPE=NODE_TEST_ENTRY_DESIGN_DELTA_AND_SAME_ROOT_WITH_COMPLETE_CURRENT_DOCUMENT_READBACK
blindReviewDeclaration=先亲读适用输入和当前源码、独立形成findings/verdict，之后才读取R3报告及作者intake
authorMaterialReadAfterIndependentVerdict=true
ACTION_1_VARIANT=1-B
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS_STATIC_ONLY，本差量登记、真实root校验、原子同步和运行边界闭合
L2_USER_VISIBLE=本设计差量无新增用户操作或可见行为冲突；真实UI NOT_RUN
L3_UNVERIFIED=优化后菜单与导航、Page/Drawer/cursor/dirty/迟到响应、远控start/restart/end与焦点/资源关闭、扩展字段提交及持久化读回；全部F/H/L2/cleanup NOT_RUN
SAME_ROOT_SCAN=四个新增Node测试逐项核对；真实scripts发现/登记差集的五个既存文件逐项读源核对；其余已登记成员及TS/Vitest/Java/App架构测试按实际入口分类
DESIGN_GAPS=NONE_IN_REVIEWED_DELTA
TEMPLATE_COVERAGE=下表逐节记录
EVIDENCE_TIER=STATIC_ONLY
```

本结论没有从零重审全部未改 production/helper，也没有宣称整批实现或动态验收通过。

当前字节 SHA 两次亲算一致：

| 文件 | SHA-256 |
|---|---|
| 正式需求 `2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md` | `378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47` |
| 详设 `2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md` | `87e382793739557ad3ef524c59d9ec5d04fde7bad66abf56fcc1b59c339eb921` |
| 计划 `2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md` | `64fbf23fe057ab867728b57d6d29f14d8cf04c2a734142cd98d72de24b5855f0` |
| 附件 `2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md` | `2872ac8713ca0e48edb1dfa1560d8b317cd94b4aa0bd798fac418cf9de4e30ce` |

四文件均位于 `doc/plans/platform/`，均全文亲读。

实际证伪结果：

| 攻击 | 当前源证与结论 |
|---|---|
| 四个新测试能单跑，却遗漏正式执行入口 | 计划:82、附件:153、详设:267明确同 CP 登记四路径、同步删除/重命名和 runner/test 控制面。没有发现遗漏 |
| 只登记四项，真实 health focused 仍因旧缺项失败 | 纯文件读取复算 `declared=53 / discovered=58`，缺项恰为下面五项，extra/duplicate 均为空。计划:82、附件:153已安排同组只补共享入口元数据 |
| mock 子进程掩盖真实目录 | health test:15–22只注入 `spawnSyncImpl`；runner:146–148先用默认真实 repository root 执行 `validateExplicitTestSet`，再调用 mock。附件明确不能改 mock 掩盖发现集 |
| 自动发现代替显式执行清单 | runner:77–111发现集仅用于登记双差/重复判定；实际执行仍使用 declared。计划禁止宽 glob、新入口和自动发现执行替代 |
| red 只检查文字存在 | runner:118–132现有 missing/duplicate red 实际调用 validator；91–101亦有 extra 拒绝分支。计划要求同步其 test 并验证 missing/duplicate/extra。**extra 专用 red 尚属未来测试义务，未声称当前已运行** |
| 登记 seed/LiveKit 测试导致运行 scope 膨胀 | 三工件明确仅相关 focused 文件及入口 self-test，不默认 `--node` 全集合或完整 verify；登记不是 seed/服务授权 |
| R15–17/V16–18被元数据修订改成新业务方案 | 需求对应条款、详设:238–240/254–267、计划:76–107、附件:147–171仍保留原 focused、日志、准入、CP/6b、最终 full backend-acceptance 与独立实施复核顺序；未发现新增业务/权限或证据降档 |

同根成员完整核对：

- 新增：`scripts/test/{admin-ui-l2-admission,admin-ui-l2-p1,admin-ui-l2-fixture,browser-l2-terminal-transport}.test.mjs`。四个目前均不存在；这是明确计划新增，不是设计缺陷。
- 既存 missing：`scripts/test/terminal-remote-control-protocol.test.mjs`，`scripts/dev/{terminal-update-seed-plan,terminal-update-seed-executor,r5-fixture-contract,r5-livekit-resident}.test.mjs`。五个均全文读源确认；未计成新回归或新 finding。
- 其余 53 个现登记成员已通过文件集合读取核对登记关系，**没有逐个审计其业务断言，也没有执行它们**。
- 反例：本批 TS/Vitest 与 Java 测试不属于 scripts `.test.mjs` 发现集；App 下现有 `public-entry-boundary.test.mjs` 归其 App 入口，不能误塞入 scripts health。现 wire-client、browser runtime、owner seed helper 等相关 `.test.mjs` 已登记。
- 后续写前如出现新的真实发现差集，仍须 `OPEN`、核归属并协调；不因此预造额外 scope 或放宽目录校验。

方案合理性：本差量的真实目标是让新增测试被既有正式入口消费。更小候选“只追加四条”会留下真实 root 的五项缺口；“让扫描直接执行全部文件”会取消显式入口纪律。当前方案复用原列表和 validator，只同步九项元数据及必要健康测试，是当前最小可维护方案，不需要产品裁定。

四模板适用 coverage：

| 模板章节 | 本轮处置 |
|---|---|
| Journey §1/2/3/4/5/6及6.1/7 | `NOT_APPLICABLE_WITH_REASON`：Node 登记差量不改变 Journey、actor、前提、任务或 UI；当前详设§0保留已有 Journey 来源。本轮不重新判定未改 Journey |
| IA §1/2.1/2.2/2.1.1/3/4/6 | `NOT_APPLICABLE_WITH_REASON`：差量不改权限、集合、刷新、容器、错误或交互；全文读回三工件，未将 Node 登记扩为 UI 变更 |
| IA §5交叉对账 | 有：计划:82、附件:153、详设:267及原 R/V 落点一致 |
| UI §1/1.1/1.2/2/3/4及字段、候选、控件 roster/5/6/7/8/9/10 | `NOT_APPLICABLE_WITH_REASON`：本差量没有新 screen、动作、文案、字段、线框或 demo。现附件§4观察清单仍 `OPEN`，未升级为 DOM/用户行为证明；testId/运行准入边界保留 |
| implementation §0/1/2/3/3a/4/5/6/7/8/9/9a/9b/10/10b/11/11a/12/13/13b/13c/14 | 全部有当前文档落点；本差量重点消费 §9a同步、§11/11a测试落点、§13b/13c对账、§14证据边界。新 owner 审计/DB migration 为有理由 N/A；动态状态保留 NOT_RUN |

阅读顺序及最小输入闭合：

1. R4 输入清单、仓内 `cs-review/cs-memory-recall`、AGENTS/CLAUDE、BLUEPRINT、platform README、全部六 kernel、deterministic-context。
2. 六维 `review/platform/operations-admin/platform/evidence/review`。`recall-memory`输出自身截断后读取其入口，并使用同路由 `scripts/memory/query`恢复完整 refs；34个命中逐项打开原文，亲算哈希。适用判据包括 Node explicit denominator、存在≠执行、分母自建、red、同根、执行经济学与独立 review。
3. 正式需求和三当前工件全文；corpus 全文及读取政策。Node登记本身是机械 tooling，无新增业务词干；三工件业务术语回读保留 G02–05B/G08–12/CIPG01 禁推边界。
4. `doc/decisions/`顶层标题列表、相关治理/验证/防再犯/授权/日志决定；四模板适用同步、测试、计划槽位原文，review-standard、backend-acceptance主动规范§4、scripts README测试健康、implementation-task-template对账/动态准入、领域规范与 charter 适用条款。
5. health runner及其 test 全文、verify:371调用接缝、现五缺项全文、相关 generator/check/self-test源码、App架构测试及 verify consumer 接缝；纯文件集合复算；独立锁定上述 verdict。
6. **仅此后**读取 R3报告及实际作者文件 `doc/review/platform/2026-10-14-backend-frontend-structure-design-review-intake-codex.md`。最初尝试的 `...-r3-intake-codex.md`不存在，随后用文件清单找到实际文件；没有以此缺路径构造设计 finding。

具名 N/A：未变 production 的逐行重审、历史 SQL/index/字节码/性能实测、邀请恢复、parked domains、TER键盘/Android截图/设备媒体矩阵，以及退役 compliance 控制面，不消费此次 Node 入口差量；其不相关 sourceRefs 不作为新分母展开。实施逐点前后双读/focused留痕为未来义务，本轮没有 implementation，故不伪造记录。

后置对照：R3-S01 的反例与独立当前源证一致，当前文字已闭合登记遗漏；旧 R3 `NO-GO 0/1/0`及旧 SHA 保持历史结果。作者 `CLOSED_DESIGN_ONLY`没有被当作 proof，本轮结论仍限设计差量。

本轮无文件写入、测试、构建、生成、verify、环境、数据、设备或 `.runtime`读取。审查 task 已完成；全部实现及动态验证仍待后续授权和真实 evidence。
