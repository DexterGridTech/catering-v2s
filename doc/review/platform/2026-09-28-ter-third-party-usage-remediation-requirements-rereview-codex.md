# TER 第三方库用法整改正式需求 v3.1 复评（Codex）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档应然事实、矛盾与无出处阈值提取
被审对象=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md（v3.1）
此前评审=doc/review/platform/2026-09-28-ter-third-party-usage-remediation-requirements-review-codex.md（v3）
处置记录=doc/review/platform/2026-09-28-ter-third-party-remediation-requirements-blind-review-claude.md
reviewerKind=CODEX_REVIEW
EVIDENCE_TIER=当前需求与源码静态核验；执行了 scripts/check/handoff-debt、scripts/check/project-memory；未运行测试、构建、Web、Metro、Android 或设备
VERDICT=GO
M/S/N=0/0/0
```

## 结论

**GO**：v3.1 已关闭上一轮 M-1、S-1 至 S-3、N-1；本轮核对的新增事实和范围同步也与当前字节相符，未发现新的需求级阻断项。该结论仅表示需求文本可作为 Dexter 接受后的详设输入，不代表需求已获接受，也不授权详设或实施。

## 本轮独立提取与核验

本轮没有重开 F-1 至 F-28，按委托聚焦 v3.1 改动、上轮 findings 与 F-29/F-30。

| 核验项 | 当前复核 | 判定与证据 |
|---|---|---|
| M-1：T-3 与 Sentry 延期 | §1.1 选择 6 明确裁定延期并登记；§1.2 第 77 行、TP-B1 第 317 行、§6 第 557 行及 §7 第 575 行均把范围限定为 T-3 的错误边界部分，未再声称完整落实 T-3。 | **闭合**。Sentry 的延期状态、风险、触发条件、未来验收证据及 decisionSource 均有 HANDOFF 七列表达位置；HANDOFF 引言也被 TP-A1 要求扩展。该 TER 登记表与 10 项正本欠账表分离。HANDOFF 明确该登记不授权后续实施，未来启动仍需新的明确决策。 |
| F-29：HANDOFF 表与检查器分母 | `HANDOFF.md:7-30` 有 TER 补充登记表和 10 项正本表；`scripts/check/handoff-debt:9-17,119-149,173-184` 固定七列，并通过 approved ID 选择正本表、校验 10 行及逐行清单。 | **CONFIRMED**。新增 TER 行不会扩张门内 10 项 approved denominator；门的自测已有 preceding supplementary table 选择控制（脚本第 223-228 行）。新鲜运行 `scripts/check/handoff-debt` 得 `HANDOFF_DEBT=PASS`。当前 HANDOFF 尚无 Sentry 行；TP-A1 将新增该行，这是未来实施事项，不被本复评误报为已完成。 |
| F-30：原生测试源集 | 当前 4 个测试文件分别有 17、2、5、2 个 `@Test`，合计 26；三个模块都声明 `junit:junit:4.13.2`。静态检索未发现 `@Ignore`、JUnit assumption、`@RunWith` 或参数化标记。 | **CONFIRMED**。证据：`apps/terminal/adapter/android/dual-screen/android/src/test/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalSurfaceHostActivityHandlerTest.kt`、`apps/terminal/adapter/android/persist-kv/android/src/test/java/com/catering/v2s/terminal/adapter/persistkv/StorageModeResolverTest.kt`、`apps/terminal/adapter/android/persist-kv/android/src/test/java/com/catering/v2s/terminal/adapter/persistkv/StorageValidationTest.kt`、`apps/terminal/application/base/android/android/src/test/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServerTest.kt`；相应三个 `android/build.gradle`。 |
| S-1：ESLint 计数级棘轮 | TP-A3 第 196、200-209 行明确披露同文件同规则等量替换的过渡期风险；要求按规则×包清零、清零即移除相应批量豁免；TP-D4 第 445-450 行要求零违例、零批量豁免。保留的行内豁免须有理由并经评审接受。 | **闭合**。最终批量豁免文件为空时，计数级 batch suppression 不会隐藏交付字节中的违例；若使用行内豁免则进入显式报告和评审，不是同一计数替换的静默路径。作者把风险限定为实施过程是成立的，不需要另行请求 Dexter 接受该已披露的暂态风险。 |
| S-2：JUnit XML 发现与执行 | TP-A4 第 220-222 行定义逐类关系 `discovered = executed + skipped`，要求 skipped、failures、errors 均为 0，且每个含 `@Test` 的类都有报告；另有编译失败与断言失败两个拷贝夹具。 | **闭合**。跳过用例不能靠 XML 的总 `tests` 数伪装成执行；缺少类级报告也会失败。F-30 只说明当前基线，不被当作永久豁免。 |
| S-3：TP-A9 锁交错 | TP-A9 第 271-274 行要求测试专用同步点确定性建立两条反向持锁等待，修复前连续 10 次有界判红，修复后两条生产路径均完成并断言 close reason。 | **闭合**。普通并发调度不再是唯一触发机制；同步点被限制为测试侧，且不改变生产行为。 |
| N-1：TP-A7 重复与回收窗口 | TP-A7 第 249-256 行冻结 20 次连接/断开、至少 5 次半开，以及最后一次后的 `heartbeatTimeoutMs + heartbeatIntervalMs` 观察窗口；线程识别方式明确交详设。 | **闭合**。重复次数、半开分母和观察时限均已具体化；线程识别属于实现测量细节，详设仍须给出可审计的线程集合判据。 |
| 治理登记与授权边界 | §2 第 136-140 行将 decision、HANDOFF TER 表和两处项目记忆指针列入范围；TP-A1 第 171-186 行分别要求它们；§6 第 563-571 行授权接受后执行 §2 范围，并明确接受前不授权实施。 | **一致**。新决策承载选择与边界，HANDOFF 作非授权登记，项目记忆只更新 T-3 与失效路径指针。新鲜运行 `scripts/check/project-memory` 得 `PROJECT_MEMORY_CHECK=PASS`。 |

## 方案合理性与剩余边界

- “延期并记录，而不是声称 Sentry 已实施”与 Dexter 选择 6 一致；七列登记结构足以表达现状、理由、风险、触发、未来验收与决策来源。后续 HANDOFF 行的具体 token 和证据文案仍须按该结构实际填写；HANDOFF 本身不授予实施权限。
- ESLint 棘轮机制不提供逐条诊断身份保证，v3.1 已把这个限制写成明示的暂态风险，并用交付时零批量豁免和显式审阅的行内豁免限定最终状态。该安排与既定需求目标相符。
- Kotlin 报告与同步点测试判据现在足以排除此前指出的假绿路径；TP-A7 的次数与时间窗也可按同一口径实施。线程识别、具体同步 seam 等应由唯一详设选择，不需要在需求层重复规定代码形态。
- 本轮没有运行 Gradle、测试、构建或任何动态环境，因此不声称上述测试已经实现或通过。它们是后续获批详设/实施中的待验收项，不构成当前需求复评的未决事实。

## 固定结论块

```text
L1_ENGINEERING=PASS：本轮复核范围内，M-1、S-1..S-3、N-1 均闭合；F-29、F-30 与当前字节一致；HANDOFF_DEBT 与 PROJECT_MEMORY_CHECK 均 PASS。
L2_USER_VISIBLE=PASS：本轮确认的是需求中已裁定的错误边界恢复与输入行为判据表达；未评价或声称任何运行界面通过。
L3_UNVERIFIED=空（无实现/UI 运行结果作为本轮评审对象或通过声明；运行期验收留在获批实施范围）。
SAME_ROOT_SCAN=复核上述全部 v3.1 变更点、HANDOFF 两表与解析器分母、三个原生测试源集、TP-A3/TP-A4/TP-A7/TP-A9/TP-D4，以及 §2/§6 授权闭合；未重开 F-1 至 F-28。
DESIGN_GAPS=未发现。
TEMPLATE_COVERAGE=正式需求评审，不是交互设计、IA、详设或实施计划；对应模板均 NOT_APPLICABLE。
EVIDENCE_TIER=静态需求/源码/规范核验 + 两项获准静态门；未做测试、构建或动态验证。
```

## 授权边界

本复评只给出需求质量结论。`GO` 不等于 Dexter 接受需求，不授权详设、实施、修改源码/测试/依赖或运行动态环境；后续阶段须由 Dexter 另行明确指派。
