# 门店终端管理 · 实施结果评审（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
SESSION_PROVENANCE=续接会话（非 fresh v2s-rooted）；Claude 主会话评审，不是独立子 agent；本会话同时是需求正本作者与两轮设计评审方
EVIDENCE_TIER=静态只读：读取源码、契约、生成物、测试与 .runtime 已落盘产物；未运行任何命令，未重跑 L2、acceptance、reset 或 seed
AUTHORIZATION=本评审不授权生产部署、UAT、真实设备激活、真实打印或 TDP
```

## 1 · 这批要解决什么，解决了没有

**要解决的业务问题**：门店里每台终端承担哪些功能、管哪些桌台区或生产标签、每个打印场景打到哪几台打印机，过去无处配置。本批让运营后台可以按门店建立、编辑、停启、作废终端规则，并为每台终端签发激活码。硬约束来自一份规则合同，前后端同源校验。

**解决了**。证据与档位如下：

- **Browser L2（真实浏览器）**：2026-09-25T00:55Z 的完整运行，六个场景 business 与 cleanup 均为 PASS。当前源码与该次运行绑定的 1925 个文件逐字节一致，之后没有新的运行。
- **seed（真实 HTTP）**：2026-09-24T18:57Z 的完整 seed 为 PASS，终端后置步骤建立 8 台，详情读回 8 台，列表读回 7 台（作废的一台按设计不进列表）。与 seed 相关的 42 个源文件在此之后没有改动；当前 DEV 以 `freshDatabase=false` 沿用该库。
- **后台验收（真实 HTTP + 容器）**：2026-09-25T00:17Z 那次为 PASS。我没有逐字节核对它是否对应当前字节（见 §5）。
- **源码核对**：以下事实均在源码中成立。
  - 列表 DTO 不含激活码，详情含；
  - 手填码与自动生成两条路径都以 `ON CONFLICT DO NOTHING` 落到集团全状态唯一约束，手填撞码报冲突、不换码，自动撞码最多重试 16 次；
  - 作废终端的详情仍可读，编辑与状态写入会拒绝作废终端；
  - 型号的纸规格与允许的连接方式都登记在规则合同里；
  - owner 自有审计表与审计读取路由已接上；
  - 停用门店在网关层与 owner 层都会被拒绝。

**方案合理性**：
- 存储形态、跨 owner 只读、规则单源、并发控制都成立。
- 幂等串行化用的是「对幂等键加事务级 advisory 锁，再查回执」，与桌台使用的「先插回执占位」是两种 foundation 原语。同键并发会被串行、后到者重放，语义正确，不算缺陷。
- 本批的问题集中在三处：与全站做法不一致的前端写法、错误码声明与实际发出不符、交付对账和流程门不完整。

## 2 · 动作 1-A 与动作 2：用户可见事实对账

- **详情页右上的操作菜单**：代码提取结果是「编辑」按钮加一个只有图标的「更多终端操作」下拉。全站其他 10 个对象详情都用 foundation 的 `AdminDetailActionMenu`，触发按钮文字是「操作」。见 S-2。
- **表单与校验文案**：均为业务中文，与交互工件 `USER_VISIBLE_COPY` 的口径一致，例如「激活码（选填）」「不填写则由系统自动生成」「移除已被场景使用的打印机」。
- **异常恢复文案**：页面带有一组「操作结果待确认」「最新资料与当前草稿不一致，请取消后重新编辑」「未确认前不能继续编辑」等恢复提示，来自本页自建的恢复状态机。见 S-1。

## 3 · Findings

### S-1 · 幂等键没有按前端规范 §3-G，页面因此自建了一套恢复状态机，还在前端伪造服务端错误码（CONFIRMED）

- **位置**：
  - `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalPage.tsx`：第 104 行（`idempotencyKey: true`），第 276、560 行（`getIdempotencyKey()`），第 66 至 83 行（约 8 个恢复相关状态），第 161 至 168 行、第 222 至 230 行、第 396 至 402 行、第 466 至 472 行、第 490 至 496 行（在前端构造 `errorCode: 'PLATFORM_COMMON_VERSION_CONFLICT'` 或 `'PLATFORM_COMMON_RESULT_UNKNOWN'`，并配上 `frontend-context-change`、`frontend-readback` 这类伪关联 ID）；
  - `model/storeTerminalCommands.ts` 第 26 至 57 行。
- **仓内规则**：`doc/platform/frontend-coding-standard.md` §3-G 规定，保存、作废、状态流转这类「做两次与做一次结果相同」的操作用内容派生键 `hash(operationId + payload)`，理由是这能根除「记得轮换、记得 reset」一整类问题。参照页的全部写命令都用 `createContentIdempotencyKey`（`features/store-service-point/model/commands.ts` 第 51、73、95、200、222 行）。
- **性质**：仓内事实加推论。
  - 终端的编辑与状态变更用了生命周期发放的意图键，详设没有登记这个例外。
  - 为了弥补意图键带来的「结果未知后改了内容再提交」问题，页面自建了恢复编排，并把前端状态包装成服务端错误码。全站其他页面都没有这种写法。
- **例外成立的部分**：新建带手填激活码时，8 位码不能进入任何会被存下来的摘要，而回执会原样保存 `Idempotency-Key`。所以新建不能对整个 payload 做内容派生，这个例外是对的，但必须写明。
- **影响**：
  - 本页多出一套只有它自己有的状态机与文案，维护成本高；
  - 伪造的 `PLATFORM_COMMON_*` 与伪关联 ID 让诊断把前端状态误当成服务端失败；
  - 同类页面之间的恢复行为不一致。
- **最小根因修复**：
  - 编辑与状态变更改用 `createContentIdempotencyKey`；
  - 新建在详设中登记 §3-G 例外及原因（手填码低熵），保留意图键；
  - 删除前端构造的服务端问题对象，改用本地提示状态；
  - 按内容派生键重新评估，删掉因此不再需要的恢复状态。
  - 如果平台确实需要「结果未知后的恢复」这种交互，应沉到 foundation 的 submission lifecycle，由全站共用，而不是单页私有。
- **需 Dexter 裁决**：否。是否把「结果未知恢复」做成 foundation 能力属于工程取舍；本批只需去掉私有那一套。

### S-2 · 详情页操作菜单手写了一份，没有用 foundation 的 `AdminDetailActionMenu`（CONFIRMED）

- **位置**：`features/store-terminal/ui/StoreTerminalDetail.tsx` 第 123 至 146 行，自建 `Dropdown` 加 `MoreOutlined` 图标按钮；对照 `libraries/frontend/admin-ui-foundation/src/overlay/detailActionMenu.tsx` 第 18 至 31 行。
- **仓内事实**：`AdminDetailActionMenu` 正好负责「单个触发按钮加弹出菜单」，支持 `triggerRef` 与 `triggerTestId`。operations-admin 与 platform-admin 共 10 个详情界面都用它，触发文字是「操作」。
- **影响**：同一类「对象详情的更多操作」在本页是另一种外观（图标）和另一份实现，违背前端规范 §3-K 的交互一致性，也正是「有 foundation 却自己写一套」。
- **最小根因修复**：改用 `AdminDetailActionMenu`。交互工件线框写的「更多」如果是有意的产品选择，应改的是 foundation，让全站一起变，而不是单页分叉。
- **需 Dexter 裁决**：否。默认统一到 foundation 现有的「操作」；只有 Dexter 明确要「更多」图标时，才改 foundation。

### S-3 · 实际发出的错误码与契约声明不符，验收判据又放宽到抓不住（CONFIRMED）

- **位置与事实**：
  1. **坏游标报成规则错误**：列表读取把无效游标包成 `InvalidTerminalRequestException`（`modules/store-terminal/.../StoreTerminalOwnerService.java` 第 109 至 113 行），`ContractProblemAdvice.java` 第 723 至 731 行又把它映射为 `STORE_TERMINAL_RULE_INVALID`（422），提示「终端配置不符合当前规则」。而 `getOperationsStoreTerminals` 声明的是 `AUTHZ_READ` 加 `PLATFORM_COMMON_VALIDATION_FAILED`（边缘契约实现目录的增补），规则码未声明。
  2. **基础输入错误报成规则错误**：同一个异常也用于名称为空白、幂等键格式错等基础输入错误。详设把这类错误定为 `PLATFORM_COMMON_VALIDATION_FAILED`，只有 H 规则违反才用 `STORE_TERMINAL_RULE_INVALID`。
  3. **停用门店借用组织域码**：门店停用时，owner 层抛 `TerminalStoreUnavailableException`，被映射为 403 加组织域的 `ORGANIZATION_STORE_STATUS_TRANSITION_INVALID`（`ContractProblemAdvice.java` 第 686 至 690 行）。前端会据此显示「门店状态不可变更」，语义不对，而且终端的 operation 没有声明这个码。多数情况下网关层会先拦下，这条是潜在路径。
  4. **验收判据过松**：停用门店只断言状态码属于 {403, 404}（`StoreTerminalAcceptanceScenarios.java` 第 1315 至 1339 行）；版本冲突两个码都接受（第 1437 行）；没有坏游标用例。
- **影响**：契约不再是唯一真相：前端按声明准备的文案与定位，会在这些路径上收到未声明或语义错误的码；而现有验收抓不住这类漂移。
- **最小根因修复**：
  - 把基础输入错误拆成单独异常，映射到 `PLATFORM_COMMON_VALIDATION_FAILED`；坏游标同样处理。
  - 停用门店与参照页一致，走通用拒绝；或者登记一个终端域的码。
  - 验收改为断言精确的码，并补一个坏游标用例。
- **需 Dexter 裁决**：否。

### S-4 · P9「158 个实际文件」不是完整分母，承载本批事实的 4 个文件没有对账（CONFIRMED）

- **位置**：`doc/review/platform/2026-09-25-v2s-store-terminal-management-implementation-reconciliation-codex.md` 第 90 至 96 行。分母由一条关键词检索产生，范围只含 `contracts`、后端应用、运营后台、`scripts` 和 9 月的设计文档。
- **仓内事实**：以下 4 个文件本批改过、承载本批事实，却不在对账表中：
  - `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`：含 42 处终端条目，是 operation 与错误码的登记源；
  - `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`：10 处；
  - `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`：7 处；
  - `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts`：激活码屏蔽键，不含检索关键词。

  另外，`StoreTerminalPage.tsx` 第 327 行仍在比对已不存在的 `STORE_TERMINAL_VERSION_CONFLICT`，这是一个死分支，逐代码对账应当发现。
- **影响**：S-3 的错误码漂移正好出在漏掉的登记源上，说明这次交付门没有覆盖到这批真正的风险点。
- **最小根因修复**：
  - 以实际编辑过的文件为分母重做逐代码对账，把上述 4 个文件与共享文件纳入；
  - 对照登记源核对每个 operation「声明的码」与「实际发出的码」；
  - 删除死分支。
  - 这里不要求任何机器集合比对，只要求分母覆盖实际改动。
- **需 Dexter 裁决**：否。

### S-5 · 准入与失败族检查只对门店终端生效，下一个功能照样不设防（CONFIRMED）

- **位置**：
  - `scripts/test/browser-l2-runtime.mjs` 第 60 至 65 行，导入 `store-terminal-l2-admission.mjs`；
  - 同文件第 8301 至 8309 行，`if (suite === 'store-terminal')` 才检查失败族；
  - `scripts/test/store-terminal-l2-admission.mjs` 第 7 至 14 行，策略路径写死为门店终端。
- **仓内事实**：
  - 运行器按套件组织，另有商品库存、销售菜单两个套件，它们既不检查准入，也不检查失败族。
  - `doc/platform/browser-l2-execution-standard.md` §4.1 与 Dexter 2026-09-25「要」的裁定，指的是运行器对所有 L2 运行做这两项检查。
- **影响**：Dexter 关心的「后续写其他需求还会不会再犯」，这道门目前只挡住了门店终端。
- **最小根因修复**：
  - 准入策略改为每个套件在 `L2_SUITE_CONFIGS` 中声明自己的策略文件；
  - 运行器对所有套件执行准入与失败族检查；
  - 为现有两个套件补策略文件，它们历史上已有准入记录，例如销售菜单的实施证据。
- **需 Dexter 裁决**：否。

### N-1 · 审计摘要部分不可读

需求 R-9.9 要求「变更前后可读的摘要」。当前实现（`StoreTerminalOwnerService.java` 第 527 至 583 行）的情况是：

- 场景摘要用打印机名称，这一段可读；
- 范围摘要写的是一串 UUID；
- 功能与打印机摘要写的是内部键，例如 `KITCHEN_PRINT`、`GENERIC_THERMAL_80`。

owner 在校验时已经读到了桌台区与标签的名称，生成规则里也有中文标签，改成名称的成本很低。

### N-2 · 手写了本该来自生成规则的取值

- 前端有 3 处写死 `'KITCHEN_PRINT'`，用来判断是否给功能编号（`TerminalFunctionEditor.tsx` 第 500 行，`StoreTerminalFormDrawer.tsx` 第 80、88 行）。生成规则已经用「数量上限为空」表达「可多实例」。
- 范围类型 `'TABLE_AREA'`、`'PRODUCTION_TAG'` 在前端 18 处、后端 11 处以字面量出现，生成器没有产出可引用的常量（后端规范 §2-D）。

建议让生成器产出键常量，前端改读数量上限。

### N-3 · 两处写法脆弱

- `TerminalSceneEditor.tsx` 第 97 至 107 行：先抛出一条中文报错，再靠匹配「纸规格不匹配」这几个字决定是否改成另一条报错。
- `model/storeTerminalModel.ts` 第 126 至 348 行：自造了 `STORE_TERMINAL_SCENE_PRINTER_IDENTITY_*` 这类与服务端错误码同形的内部标识。

建议改为有类型的错误，并避开服务端码的命名空间。

### N-4 · seed 层的小问题

- `scripts/dev/store-terminal-seed-executor.mjs` 第 7 行与第 244 行，在正式执行器里使用 `invocationKeyForTest`。
- 这是 seed 层第四份各自独立的 `request` 包装（owner-command、销售菜单、商品库存各有一份），属于全仓既有的重复，不是本批独有。建议另起一次，把它们收成一个共用的 seed HTTP 客户端。

### N-5 · 过程纪律：新规则写入之后，seed 仍在动态试错

- 2026-09-24T16:37Z 至 18:57Z 之间，完整 seed 连续失败 11 次后才通过。其中「后置报告缺失」「引用候选缺失」两个失败族各连续出现两次，没有按失败族规则停下。
- 通过后 8 秒，又在没有 reset 的情况下重跑了一次，结果失败（与 `resetRequiredBeforeRerun` 相违）。该次失败是否改动了 DEV 数据，未核实。

## 4 · 同族全集扫描

- **S-1**：写命令共 3 个。编辑与状态变更应改用内容派生键；新建按例外登记。其余 2 个已核对。
- **S-2**：本页只有详情头部这一处操作菜单；列表头部的新建按钮与全站一致。
- **S-3**：7 个 operation 的「声明对实际」已逐一核对。坏游标与规则码混用只出现在列表与状态路径；分页与状态值在网关层已先拦截；停用门店这一条是潜在路径。
- **S-4**：共找到 4 个漏掉的文件，范围外的共享文件已按关键词与内容检索。
- **S-5**：全部 3 个套件中，只有门店终端受检查。

## 5 · 未验证清单

- **静态已证**：见 §1 的源码事实，以及 S-1 至 S-5 的代码位置。
- **测试已证**：L2 六个场景（当前字节）；seed 后置 8 台（相关源码未变）。
- **无人验证**：
  - 后台验收 191/191 是否对应当前字节；
  - 具体型号（例如 Epson TM-T88VII）允许蓝牙等连接方式，是否有厂商资料支撑；
  - 「结果未知」之后的各条恢复路径，L2 没有覆盖；
  - seed 通过后那次未经 reset 的失败重跑，是否改动了 DEV 数据。

## 6 · 结论

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/5/5
L1_ENGINEERING=findings：S-3（契约声明与实际不符）、S-4（交付对账分母不全）、S-5（流程门只覆盖一个套件）
L2_USER_VISIBLE=findings：S-1（本页私有的恢复状态机与伪造的服务端错误）、S-2（详情操作菜单与全站不一致）
L3_UNVERIFIED=后台验收是否对应当前字节；具体型号连接方式的厂商依据；结果未知恢复路径；seed 通过后的未 reset 重跑
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=详设未登记新建操作的 §3-G 例外（低熵手填码不能进入内容派生键）；foundation 缺「结果未知恢复」能力，若平台需要应在 foundation 建一次
EVIDENCE_TIER=静态只读 + 已落盘运行产物（L2 字节绑定已逐文件复核）
```

业务上这批已经解决了要解决的问题。NO-GO 的原因不是功能不可用，而是：前端有两处与全站做法不一致；错误码契约在几条路径上失真；交付对账与流程门不完整。五条 S 都在 Codex 的既有授权内即可修复，不需要 Dexter 裁决。修复后建议只跑相关场景做确认，再补一次完整六场景。

本评审只是静态实施评审，不授权生产部署、UAT、真实设备激活、真实打印或 TDP。本会话是续接会话，由 Claude 主会话评审，不是独立子 agent；本会话同时是需求正本作者与两轮设计评审方。
