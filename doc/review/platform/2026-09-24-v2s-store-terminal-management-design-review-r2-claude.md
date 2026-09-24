# 门店终端管理 · 详设与实施计划 DESIGN review 第 2 轮（Claude）

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=经 Dexter 中转的 Codex↔Claude review，第 2 轮
VERDICT=NO-GO
M/S/N=0/3/5
REVIEW_TARGET_SHA256_PREFIX=IA 30ee6cbfc98e9a6b；交互 329a7f29df90a3f5；详设 6059d003c80e7147；计划 089a238aa1d109a6（需求正本 d1ddc70a3f29f0be，本轮未改）
SESSION_PROVENANCE=续接会话（非 fresh v2s-rooted）；Claude 主会话评审，不是独立子 agent；本会话同时是需求正本作者
VERIFICATION_MODE=静态只读；四份工件与上一轮字节逐行 diff 后全文复读，承重事实回源码核对；未运行任何生成、构建、测试、reset、DEV、seed、L2、UAT
AUTHORIZATION=本结论不授权实施、契约或代码改动、DEV、seed 或任何动态动作
```

## 1 · 方案合理性

**问题对不对：对。**范围仍是规则的保存、校验与展示，没有扩到激活、打印或派发。

**方案优不优：比上一轮更好。**
- 存储改为「终端行＋一份 JSONB 配置＋回执」，与 Dexter 偏好的简单形态一致。数据库仍守终端级的两条唯一约束（集团激活码、门店内名称）；子项之间的关系由 owner 在同一事务、同一版本条件下整体校验。整份配置按版本 CAS 替换，并发写被版本串行化，owner 校验没有被削弱。
- D-35 的通用型号消除了「未登记型号录不进来」的死路。

**代价配不配：**有一处我上一轮给的修法过重，本轮自我纠正（N-2）。

**UI 强制自问：**主从布局、两步新建、编辑抽屉都维持 Dexter 已接受的线框。窄屏在 992 像素处改为上下排列，这是已接受线框「窄屏改上下」的落地，理由写清了。新暴露的交互缺口是：型号候选要随连接方式联动，而字段表没有写（S-2）。

## 2 · 上一轮 14 条的核验

- **已闭合（11 条）**：M-1、S-1、S-3、S-5、N-1、N-2、N-3、N-4、N-5、N-6、N-8。
  - S-1：`clientKey`、`printerRef`/`printerClientKey` 二选一、按 ref 原地保留、`clientKey` 进入幂等摘要，这几条规则足以让 V-12、V-22 成立（详设第 119 至 121 行）。措辞问题见 N-4。
  - S-5：见 §1。
- **部分闭合（2 条）**：
  - S-2：码已加前缀并冻结，但「逐 operation 确切集合」与仓内生成链不符，状态转换失败也缺码。见 S-1。
  - S-4：计数键、后置位置、整库 reset 与只读角色都已写清，但 seed 的操作人与写权限没有闭合。见 S-3。
- **改判（1 条）**：N-7 的修法是我上一轮给的，方向偏了，见 N-2。
- **补充项**：状态命令不再声明 `STORE_TERMINAL_RULE_INVALID`，我同意，理由成立；但由此暴露出非法转换没有码，见 S-1。

## 3 · Findings

### S-1 · 错误码表与仓内生成链不符，且缺「非法状态转换 / 已作废不可写」的码

- **位置**：详设第 131 行（直接登记 `store-terminal.paths.json`）、第 133 行、第 135 至 143 行（「x-error-codes 确切集合」）、第 159 行、第 251 行与第 257 行（同步分母）、第 127 行 ⑤ 与第 141 行（状态命令）；IA 第 133 至 145 行；计划第 91 行（V-21）。
- **仓内事实**：
  - `contracts/openapi/paths` 下的 paths 文件是生成物，不是登记源。`scripts/generate/r5-edge-materialize.mjs` 第 12 至 14 行从三份目录生成：`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`、`2026-07-26-v2s-r5-error-code-disposition-catalog.json`。
  - 每个 operation 的错误码按「基础集合 ∪ 逐 operation 增补」计算（同文件第 196 至 200 行；`scripts/generate/edge-codegen.mjs` 第 85 至 93 行）。读用 `AUTHZ_READ`，含未认证、无权限、上下文过期、空间停用、资源不存在五个通用码；写用 `OWNER_COMMAND`，在此基础上再加校验失败、`PLATFORM_COMMON_VERSION_CONFLICT`、幂等冲突、owner 不变量、结果未知。参照页的桌台读写正是这样登记的。
  - 新码要先进入处置目录的 `v2sNativeCodes`，才会出现在生成的 `EDGE_PROBLEM_CODES` 里（edge-codegen 第 77 至 83 行）。前端 `operationsProblemFeedback.ts` 第 17 行是覆盖全部码的 `Record`，缺文案就编译失败。
  - 参照实现对已作废对象的写入抛 `OrganizationConflictException`（`StoreServicePointService.java` 第 240、271、345、382 行）。它经 `ContractProblemAdvice.java` 第 361 行落到 `PLATFORM_COMMON_VERSION_CONFLICT`，而本设计明确不用这个码。组织门店的先例是专用码 `ORGANIZATION_STORE_STATUS_TRANSITION_INVALID`。
- **影响**：
  - 按详设施工，要么手改生成物、被 `r5-edge-materialize --check` 拦下；要么生成出来的集合与详设「确切集合」不一致，acceptance 按详设写的 oracle 会错。
  - 「作废后再启用」「编辑已作废终端」这两种失败没有声明码，也没有 UI 恢复口径。V-21 要求负例证明 typed problem（详设第 298 行），现在无法写成可证伪的判据，只能留到实现期再选码。这正是详设第 159 行自己禁止的。
  - 顺带：IA 把 `PLATFORM_COMMON_RESULT_UNKNOWN` 写成「网络断开」。服务端这个 500 的含义是「owner 结果无法确认」（`ContractProblemAdvice.java` 第 741 至 745 行）；网络断开是前端自己的状态。两者恢复方式相同，措辞要分开。
- **验收判据**：
  - 详设给出每个 operation 的 `errorSetRef` 与增补清单，文中的逐 operation 集合必须等于「基础集合 ∪ 增补」。
  - 六个领域码登记进处置目录。
  - 三份 doc/plans 目录进入 §9a 同步分母；删去「直接登记 paths 文件」的说法。
  - 状态与编辑命令各有一个码表达「当前状态不允许此操作」，含已作废，并在 IA 写明恢复方式：重读详情，不保留可提交入口。
  - V-21 断言这个码，且断言没有写入。
- **需 Dexter 裁决**：否。

### S-2 · 「内置型号只配内置连接」是一条新硬约束，却不在 contract 里，还与 V-29 的做法冲突

- **位置**：详设第 110、111 行（`BUILTIN_*` 仅适用于设备内置）、第 113 行（内置只能选内置型号）、第 94 行（型号字段只有 modelKey、brandKey、可见名、paperSpecKeys、来源，没有连接方式）、第 309 行（V-29 用同一台打印机逐格替换）；交互第 227 行、第 354 行；计划第 81 行（V-11）、第 99 行（V-29）。
- **性质**：文档内部事实加推论。需求 §4.9 与 D-35 只定义了这两个型号，没有定义它们与连接方式的耦合。
- **影响**：
  - contract 的型号字段装不下这条规则，实现只能在 Java 和 TS 各手写一份，违反 R-C.1 的「只有一个住址」。
  - V-29 的矩阵无法在一种连接方式下全部通过：内置两行的 ✓ 格要求设备内置，其余十行的 ✓ 格要求非内置。测试要么偷偷逐行换连接方式，要么这条规则被丢掉。
  - V-11 与 V-29 都没有这条规则的正反例。
  - 交互字段表没写型号候选随连接方式过滤。
- **验收判据**：
  - 型号允许的连接方式登记在 `store-terminal-rules.json`，两端都由生成物校验。
  - V-29 的每一行写明所用的连接方式。
  - 至少一个反例（内置型号配网口）和一个反例（通用型号配设备内置）被拒且没有写入。
  - 交互字段表写明联动方式。
  - 若 Dexter 不要这条耦合，删掉第 110、111、113 行和交互第 227 行的相应措辞即可，两种做法二选一。
- **需 Dexter 裁决**：否（默认按详设原意登记进 contract）。

### S-3 · seed 没有一个能写终端的操作人；DEV 里没有任何账号能新建或编辑终端

- **位置**：详设第 286 行（执行器「经 owner HTTP 建立」，但没说用谁的会话）、第 288 行（`r5-seed-plan.mjs` 与 `owner-command-seed-executor.mjs` 标为 `N/A_WITH_REASON`）、第 292 行（只给 `role-store` 加只读页）；计划第 118、120 行。
- **仓内事实**：
  - 参照页上线时，fixture 给 `role-group`、`role-project`、`role-store` 三个角色都加了桌台页与写权限（fixture 正本 `stableFixtures.workspaceIam.roles`）。
  - `scripts/dev/owner-command-seed-executor.mjs` 第 33 至 39 行的 `GROUP_SEED_CAPABILITIES` 含 `EDIT_STORE_SERVICE_POINT_QR`，第 387 至 389 行要求 `role-group` 必须具备这些能力。
  - `scripts/dev/r5-seed-plan.mjs` 第 35 至 37 行逐个断言这三个角色有桌台页与写权限。
- **影响**：
  - 按现设计，没有任何 seed 角色拥有 `EDIT_STORE_TERMINAL`。后置执行器的新建会被 403 挡住，除非它绕过 edge。
  - Dexter 在 DEV 登录后，集团、项目角色看不到这个页面，门店角色只能看。页面的主流程在 DEV 里无法体验。
  - 被标为 N/A 的两个脚本，按先例恰恰需要改。
- **验收判据**：
  - 至少 `role-group` 获得 `PG-STORE-TERMINALS` 与 `EDIT_STORE_TERMINAL`；`role-project` 是否同样给予，按参照页先例写明。
  - `role-store` 保持只读，作为只读样本。
  - 写明后置执行器使用的会话，与 owner-command 阶段一致。
  - `GROUP_SEED_CAPABILITIES` 与 `r5-seed-plan.mjs` 的角色断言同步，撤掉这两处 N/A。
  - seed 读回增加一条：`role-group` 账号能编辑、`role-store` 账号只读。
- **需 Dexter 裁决**：否。

### N-1 · seed 宣称覆盖「同场景多台无序」，但八个样本里没有一个场景有两台打印机

详设第 270 行写「同场景可两台无序绑定」，计划第 118 行写「多场景无序 printer set」。但 `term-kitchen-multi` 的两台打印机一台热敏、一台标签，纸型不同，不可能进同一场景；其余样本每个场景至多一台。D-31 的核心语义因此在 DEV 里看不到。

判据：至少一个场景绑定两台同纸型打印机，读回按集合比较。可选：让一台打印机用登记过的具体型号（例如 `EPSON_TM_T88VII`），以便在 DEV 里看到「品牌 → 型号 → 纸规格」的级联。

### N-2 · 撤回我上一轮 N-7 的修法：seed 遇到冲突直接失败，不做比对重放

完整 seed 在失败时明确要求先 reset 再重跑（`r5-complete-seed-executor.mjs` 第 399 行 `resetRequiredBeforeRerun: true`，各阶段执行器相同）。各阶段的幂等键按单次运行生成（`owner-command-seed-executor.mjs` 第 657 行 `invocationKey(runId, stage)`），本来就不支持不 reset 的重跑。

详设第 278 行与计划第 118 行的「报冲突后读本店八台详情逐项比对、确认是本次重跑」，是为一个平台不支持的场景造的分支。上一轮是我建议这样改的，方向错了。

判据：终端后置步骤遇到任何新建冲突即失败，报告写明需先 reset，不读详情比对；详情读回只用于成功后的 readback。

### N-3 · 示例打印机名「标签备机」与 D-31 相悖

交互第 75、83、176、190、274、283 行把第二台标签机命名为「标签备机」。D-31 已取消主备，示例名会误导实现与验收。判据：改为不带主备含义的名称，例如「吧台标签机 2」。

### N-4 · JSONB 形态下残留「删行重插」措辞；回执里是否有子项 ref 前后说法不一

- 详设第 119 行与计划第 92 行写「不删行重插」，但 JSONB 形态没有行。可证伪的说法应是「既有子项 ref 保持不变，只有带 `clientKey` 的新项获得新 ref」。
- 计划第 82 行写「写入/回执/详情对应同一 owner ref」，详设第 123 行写回执只存 ref、version、status。

判据：写明重放时返回终端 ref，子项 ref 通过读取详情确认不变；回执不存子项映射。

### N-5 · `ZEBRA_ZD411D × 标签 60×40` 正好卡在最大介质宽度上

详设第 102 行引 Zebra 规格，最大介质宽 60 毫米，同时承认其余尺寸仍须核对；第 315 行的 V-29 矩阵却把这一格固定为 ✓。标签底纸通常比标签面宽，60 毫米宽的标签是否能装进这台机器，我没有核实厂商资料（`UNVERIFIED`）。

判据：三个具体型号的格子随 CP-01 的厂商证据一起冻结；CP-01 若改动 contract，V-29 在同一 CP 内同步修改。

## 4 · 本轮点名的七项专项结论

1. **D-35 型号贯穿**：3 个具体型号＋9 个通用型号，在型号表、交互候选、seed 与 V-29 的 12×7 矩阵之间一致；12×7 共 84 格，与计划一致。缺口是型号与连接方式的耦合（S-2），以及 seed 没用到具体型号（N-1 可选项）。
2. **clientKey / ref / 幂等**：足以让 V-12、V-22 成立；措辞见 N-4。
3. **错误码三方对应**：领域码、HTTP、IA 恢复面在文档内部互相一致；但与生成链不符，且缺状态转换码（S-1）。
4. **seed**：计数键 `storeTerminals:8`、后置接点（第四组件校验之后、`business=PASS` 之前，即 `r5-complete-seed-executor.mjs` 第 389 至 391 行之间）、整库 reset 语义、只读角色均成立；操作人与写权限未闭合（S-3）；覆盖声称不实（N-1）。
5. **JSONB**：比较充分，owner 校验没有被削弱（见 §1）。
6. **V-26/V-27、窄屏、脱敏、改名锁、作废详情**：均一致。seed 冲突重放按 N-2 撤回。
7. **状态命令的错误码**：去掉 `RULE_INVALID` 正确；需补非法转换码（S-1）。

## 5 · 结论与授权边界

**VERDICT=NO-GO，M/S/N=0/3/5。**方向、存储形态与主要规则都已成立；三条 S 都在 Codex 的既有授权内即可修订，不需要 Dexter 裁决。修订后建议再审一轮，重点看：

- S-1 的错误集合是否等于生成器会算出的集合；
- S-2 的连接耦合是否进了 contract、V-29 是否逐行写明连接方式；
- S-3 的操作人与角色授权是否写清。

本结论只是静态设计评审，不授权实施、契约或代码改动、DEV、reset、seed、Browser L2、UAT 或部署。本会话是续接会话，由 Claude 主会话评审，不是独立子 agent；本会话同时是需求正本作者。

**评审之后 Dexter 的直接授权（2026-09-24，会话原话）**：「授权codex在完成修改后，立即进入实施阶段，无需再有任何授权，必须按照项目的实施规范，完成详设与实施计划的全部目标和动态验证，最后执行reset Dev seed 后，将实施结果给我和Claude做review。」该授权来自 Dexter，不来自本评审结论；上一段的授权边界只描述本评审自身。
