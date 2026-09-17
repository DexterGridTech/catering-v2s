# 门店桌台与二维码管理 implementation-facing 设计第 2 轮评审处置

```text
DATE=2026-09-17
REVIEW_TARGET=DESIGN
REVIEW_SCOPE=implementation-facing 详设与实施计划
INPUT=Claude 经 Dexter 转交的第 2 轮静态 review 文本；仅作 finding 输入，不作事实正本
ORIGINAL_VERDICT=NO-GO
ORIGINAL_M_S_N=1/2/2
DISPOSITION=REPAIRED_READY_FOR_NEXT_STATIC_REVIEW
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

## 1. 处置边界

本记录不是新的 reviewer verdict。主 agent 重新打开当前需求正本、Journey、IA/交互、implementation-facing 详设、实施计划、上一轮处置记录和 owning source，逐条核验 Claude 的 finding，修复确认的设计矛盾，并保留产品裁决与运行边界。Claude 本轮明确说明其评审来自续接主 agent，不是 fresh 独立子 agent；该事实不被包装成独立盲审证据。评审文本中转述的“Dexter 实施授权”属于 handoff 内容，本记录不把它当作当前授权；当前仍不进入实施或运行。

## 2. Finding 逐条处置

| finding | 核验状态 | 当前字节事实与处置 | 最小修复与防再犯落点 |
| --- | --- | --- | --- |
| M-01 “52 条 command token”错误分母 | `CONFIRMED` | `CatalogInventoryWorkspaceCommandTokens.java` 当前闭集为 36 条，其中 gate=true 为 33 条、preflight=false 为 3 条；`catalog-inventory-workspace-command-tokens.mjs` 不包含 sales-menu；sales-menu 的 19 个写入口由 owner 直接调用 catalog gate。详设与计划已统一为：上一批 52 条 gate 分母=33 条 token gate + 19 条 sales-menu 直调；token 泛化只作用于 36 条 token，sales-menu 不新造 token 链。 | 修正文档中的分母、调用链和 R-5.9 落点，而不是只把 52 改成 36；同时保留 52 作为 gate 分母，防止把 sales-menu 19 条遗漏或错误拉入 token/resolver。 |
| S-01 资产 entry 缺 gate 拒绝归属 | `CONFIRMED` | 详设 §11.1 原先只把 `stageStoreServicePointImage`、`releaseStagedStoreServicePointImage` 绑定到资产生命周期场景，而 V-2 要求 11 个 gate entry 全部拒绝。当前两行已同时绑定 `storeServicePointGateAndRoles`；该场景的 direct all mutations rejected 覆盖资产两个 entry，资产场景继续覆盖成功、失败和无孤儿。 | 只补矩阵的 owning scenario，不复制一套资产 gate 测试；用一处角色/gate 场景覆盖全部 11 个 entry，资产 owner 场景继续负责事务和孤儿语义。 |
| S-02 审计场景文件集不一致 | `CONFIRMED` | `AuditAcceptanceScenarios.java` 在仓内存在；计划已列出该文件，详设 §11 场景落点已补齐该文件，`storeServicePointAudit` 继续归属 Audit/Organization。 | 补齐详设文件集合，保持审计断言落在审计场景文件，不把共享审计回归塞进 Organization 场景。 |
| N-01 HTTP oracle 混入前端观察 | `CONFIRMED` | `storeServicePointGateAndRoles` 的 HTTP `businessOracle` 原含“disabled page sends no list request (frontend focused)”；当前已移除，并在矩阵后明确该观察属于 V-1 前端 focused proof。 | 只调整断言归属，不删除前端行为要求；HTTP oracle 保持业务 owner 断言纯度，V-1 单独验证页面请求行为。 |
| N-02 两个 seed 长度 guard 未逐一列出 | `CONFIRMED` | `scripts/dev/r5-seed-plan.mjs` 与 `scripts/dev/owner-command-seed-executor.mjs` 当前都存在 `definitions.length !== 8`；详设 §10b.4 与计划 P8 已逐一列出两处 guard，并要求实施后分别改为 9、加入 host-set/length red mutation。 | 将两个字面量纳入同步清单，避免只核对集合却漏掉独立长度校验。 |

## 3. 追加的硬约束

- L2 前新增独立 `IA_CONTROL_REVIEW`：逐个 IA-ID 比对真实控件所在 surface/container、位置、层级、样式和行为；创建/编辑 Drawer、选中、排序、边界禁用和失败恢复必须逐项一致。`testId` 存在不能替代该比对，任一不一致先修复。
- 该 IA 对照与 UI focused/static proof、fresh 独立复核全部通过后，才可解除 L2 阻断；本次不执行 L2。
- 实施完成后仍须完成步骤级三维对账、全批整体三维对账和交付前逐代码与详设对账，结果只能为 `MATCHED` 或 `OPEN`；backend business 与 cleanup 分开判读。

## 4. 交叉一致性复核

- 上一批 52 条是 gate 分母，不是 token 数；token 闭集 36 条（33 gate + 3 preflight），sales-menu 19 条为 owner 直调。
- 本域 HTTP gate 分母仍为 11；HTTP operation→scenario 矩阵仍为 20 行且内部 claim 不计 HTTP。
- SERVICE_POINT 实施后 host=9、flat=5；两个 `definitions.length` guard、Java 声明、seed executor 和 fixture 必须同步。
- IA/交互已确认的列表、排序、二维码摘要/编辑 Drawer、扫码点无图片和统一 dirty guard 不变。

## 5. 动态与授权状态

本轮只做静态源码/文档核查和文档修订，未执行契约生成、迁移、构建、测试、reset、DEV、seed、Browser L2、UAT 或部署。Claude 文本中关于“修复后进入实施阶段”的授权转述不作为本记录的授权来源；当前回合没有开始实施或任何运行，`IMPLEMENTATION_AUTHORITY=false`、`RUNTIME_AUTHORITY=NOT_AUTHORIZED` 保持不变。后续是否进入实施，以 Dexter 的直接指派为准。
