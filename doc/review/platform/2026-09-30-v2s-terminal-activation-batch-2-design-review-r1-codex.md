# 批次二详设与实施计划 · 独立 DESIGN Round 1 处置记录

```text
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
M/S/N=1/0/0
INITIAL_TARGET_DESIGN_SHA256=434442593ed8e629475989b45cc5f2eb6a13675e3d9c0ab435375f42ed384974
INITIAL_TARGET_PLAN_SHA256=61364ef8bf823d231d04f6fecc49d7f805781b073a25c25efffb51da6ac2567a
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
authorMaterialReadAfterIndependentVerdict=true
```

## Finding DR1 · accepted Journey 的持久凭证住址与本批写入范围冲突

- **Severity / reviewer status**：M / `CONFIRMED`。
- **Reviewer 定位**：详设 §0（初稿第 33 行）、CP-01（初稿第 169 行）；计划 CP-01 修改全集（初稿第 77 行）。
- **事实与证据**：`doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md:48` 把当前 generation 与秘密说成保存在 server-config 管理的终端凭证状态，同时 owner 栏写 `terminal-data-client/state`；`...journey.md:54` 又说按 server-config state 持久化，同时把实现责任分给 `terminal-data-client/state` 与 `server-config`。需求 R-9.3/R-9.6、D-16 与本次 Dexter 指派将 `terminal-data-client/state` 定为唯一凭证身份住址，`server-config` 仅保留环境/服务覆盖配置。初稿 §0 与 CP-01 却提出在批次实施中改写已接受 Journey 第 48、54 行，超出当前设计/计划授权，也会让实施者修改 accepted decision。
- **影响**：设计计划把被禁止的 accepted-source 修改误列入 CP-01；凭证 owner 的唯一事实来源在执行前仍未由该 source owner 修正，增加将来按矛盾文案实施或越权修改 Journey 的风险。
- **最小可验收修正**：详设与计划均不得列 Journey 或 accepted decision 为本批修改目标；将差异明确记录为 source drift，写明按当前 Dexter 指派与需求 R-9.3/R-9.6/D-16，唯一凭证持久化 owner 为 `terminal-data-client/state`，`server-config` 仅保留配置。实施开始前重读 Journey 原文；若仍冲突，须先由 Journey owner 修订或由 Dexter 明确裁定来源优先级，未解决不得进入 CP-01 写入。不得由实施者自行修改 accepted Journey，不得建立第二凭证库。
- **作者独立核验**：`CONFIRMED`。回读需求 R-9.3、R-9.6，service-shape decision D-16 与 Journey 两行；finding 成立。
- **作者处置**：已按最小判据修改详设 §0、CP-01 与计划 CP-01 修改全集。两份目标文件不再把 Journey/accepted decision 列为写入目标，并把 source-drift 处理写为 CP-01 前置条件。Journey 和 decision 原文件未修改。修正后的具体行号以 Round 2 输入清单所绑定的当前字节为准。
- **待独立复核**：Round 2 定向核验上述处置是否足以消除越权写入与设计歧义；Round 1 原 `NO-GO` 不自动转为 `GO`。

## R1 输入记录与方法校准

独立 reviewer 后置补报：六个 project-memory kernel 均已读，并列出文件名；执行了六维 recall，补报 25 条 `id/path` 与 sourceRefs；打开了任务点名及路由命中的相关决策；implementation-design template 被逐节标记 PRESENT，Journey 模板按来源适用，IA 与交互模板为 N/A。其补报的输入索引见 [R1 输入清单](2026-09-30-v2s-terminal-activation-batch-2-design-review-r1-input-checklist-codex.md)。

输入审计发现 Round 1 留痕不完整：没有保存 `doc/decisions` 的完整标题 inventory，也没有证明从完整 inventory 筛选并读取了所有相关 accepted decision；corpus 专项搜索的原始留痕缺失，reviewer 的后置回忆与另一个方法校准消息对该搜索是否在 verdict 前执行存在冲突。作者按回忆给出的命令重放当前 corpus，当前字节命中第 262 行“设备协议”的负面边界；这不能证明 reviewer 当时执行过命令。因此 Round 1 的独立 finding 保留，但不把其 checklist 说成全项齐备。Round 2 必须独立列出完整 decision inventory、实际相关 decision 与 corpus 检索结果；Round 1 是本 cycle 的第一轮，不因留痕缺口重置。

Reviewer 校准后的盲审声明为：先从证伪立场形成候选问题，再读取两份 primary review targets，最后形成 verdict；`authorMaterialReadAfterIndependentVerdict=true` 仅表示 verdict 后才读取作者 finding 处置。Round 1 未读取作者自评或本处置记录后置以外的作者结论。

## 静态核验范围与限制

- 同根检索族：`Journey`、`server-config state`、`terminal-data-client/state`、`第 48、54 行`、`accepted decision`。初稿所有写 Journey 的命中都定位在详设 §0、CP-01 和计划 CP-01 修改全集；其余仅引用来源或声明不编辑。作者修订后再以同族检索确认没有残留写入承诺。
- 四模板：implementation-design template 覆盖为 PRESENT；Journey template 是适用来源；IA 与 UI interaction template 对本批设计为 `NOT_APPLICABLE_WITH_REASON`（无新增 TER Journey、页面、交互或 L2 控件）。Round 1 reviewer 未以可审计的全文逐节表附于原 verdict，因此 Round 2 仍须填完整模板逐节状态。
- 静态/官方资料：reviewer 报告核对 Node/Undici、Spring Boot Actuator 与 HAProxy 的官方资料。详设把 Node `22.23.3` 与 standalone Undici `8.11.2` 标为拟 pin 而非当前解析版本。Spring Boot readiness 的 Round 1 URL 记录混有 4.0.0-M3、4.2/latest 与 4.1.0 引用；Round 2 需核实详设声称的精确 4.1.0 官方依据及链接。
- **未运行** build、test、生成器、`scripts/verify`、DEV、Testcontainers、reset、seed、L2、UAT 或部署；本轮授权为设计文档与静态审查。

```text
ROUND_1_DISPOSITION=AUTHOR_CONFIRMED_MINIMAL_DOC_ONLY_FIX
ROUND_2_REQUIRED=FRESH_INDEPENDENT_DESIGN_REVIEW_AND_HARD_STOP
```
