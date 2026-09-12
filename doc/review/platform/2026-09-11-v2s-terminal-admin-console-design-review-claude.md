# TER admin console 详设与实施计划 — Claude 独立评审

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO
M/S/N=7/3/3
EVIDENCE_TIER=静态源码对账 + 文档对账 + 一次离线纯函数复算；未构建、未运行任何仓内测试或门
SESSION_PROVENANCE=v2s-rooted 续接会话（上下文经摘要接续），非 fresh acceptance
WRITE_SCOPE=仅本文件
```

## 0. 利益冲突声明

需求正本 `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md` 由我撰写。
本轮被评审的五份文档（Journey、IA、交互、详设、实施计划）由 Codex 撰写。
因此：**对设计包本身我是独立的；对"需求是否合理"我不是独立的**。凡结论依赖需求条款正确性的，我单列并交 Dexter 裁决（见 `S-3`）。

## 0b. Dexter 裁决（2026-09-11,评审交付后）

两条待裁决项已当场裁定,本节是权威记录,与下文原始 finding 并存。

**裁决一 — 业务 layer 一律保留。** 原文:「所有的 UI 状态都在 state 里面,就是为了恢复。那画布切换的时候,我为什么要关闭?」
`M-5` 与 `M-4` 相关部分据此收口:画布形态动态切换时不关闭任何业务 layer,不调 `clearLayers`。
**推论(需在详设写明)**:UI 状态入 kernel state 的目的就是跨 surface 恢复,因此"保留"是默认语义,`admin.console` 的定向关闭是该默认的**唯一显式例外**,理由是 admin 认证态按 `AC-4` 必须是瞬时的。这使 `M-4` 的 layerId 缺口从"一个缺陷"升级为"唯一一处必须显式发生的清理动作",优先级最高。

**裁决二 — 取消顺序键,按 list 排序。** 原文:「不需要顺序键,按 list 排序就好了。」
`S-3` 据此收口,`A-19` 的"每条注册项带 owner 与顺序键"作废。
亲验 `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:109-122`:`createUiCatalog` 按输入数组顺序 `canonical.push` 后 `Object.freeze`,`catalog.entries` **保序**,所以"按 list 排序"零新增字段即可实现。
**读法(已向 Dexter 声明)**:`AdminSectionMetadata` **整个取消**,不只是 order 字段。section 身份已由 `containerKeys` 含 `admin.sections` 表达,`owner` 与 partKey 的命名空间重复,顺序键一去该元数据即无剩余职责。

**裁决后的计数:`6M / 2S / 2N`**(`M-5`、`S-3` 由裁决关闭;`N-1` 因顺序键取消而失效)。
`M-1` **不因裁决消失**:必填的 `surfaceForm` 仍须同时改 `approvedEntryKeys`、`assertEntryKeys` 与 `canonicalEntry`,其中 `canonicalEntry` 的静默丢字段面对 `surfaceForm` 同样成立;消失的只是"可选字段导致 key 数不等"那一条崩溃路径。

## 1. 结论

设计包 `NO-GO (7M/3S/3N)`。

设计质量比前几轮明显提升：§7 声明→传递→消费矩阵、§8 七档证据矩阵、CP-05 的九格优先级真值表、CP-04 的公式内联冻结，都是可直接执行的形状。问题集中在**三处契约与真实源码的形状不兼容**，其中两处会静默失败而不是报错。

我核了 Codex 第二轮 review 的 7 条：**5 条坐实、1 条收窄、1 条部分证伪**。另外找到 **3 条 Codex 未报的缺陷**，其中 `M-4` 与 `M-1` 的第二失败面都是静默失败。

## 2. 方案合理性判断

**问题对不对。** 对。admin console 是 Dexter 跨 32 条裁决明确定义的运维遮罩层，不是从接口反推出来的功能。Journey 的用户任务（手势唤起 → 口令 → 查四个只读节 → 关闭）与裁决一致。

**方案优不优。** 主体判断是"优"。设计一贯复用既有 owner：catalog、`contentActors`、`LayerStack`、`InputController`、`SurfaceRoot`，并在每个 CP 的 `forbid` 段明文禁止第二 registry、第二 overlay、第二键盘、第二 selector。删除整套 IME 契约（计划步骤 6）是删除而非加兼容层，符合仓内架构原则。

但有一处代价我必须点名，且它的源头是**我的需求而不是 Codex 的设计**：我的 `A-19` 要求"每条注册项带 owner 与顺序键"。为满足它，设计必须改 `UiCatalogEntry` —— 一个带 exact-key 校验且用字面量重建的 kernel 契约。更小的替代方案是：section 就是普通的 layer-only part，用固定 `containerKey='admin.sections'` 归集，排序只按 `partKey`，完全不动 catalog 的字段集。四个 section 且 Dexter 从未要求自定义排序的前提下，这个替代的代价明显更低。见 `S-3`，需 Dexter 裁决是否放宽 `A-19`。

**代价配不配。** 除 `S-3` 外配。primitives 扩充（PR-1…PR-7）看似大，但 Dexter 在 Q-17 明确要求"应该有的都要有，不然每次做业务还要回来补"，属已裁决范围。

## 3. UI 与交互强制自问

- **操作是否来自明确批准的 Journey**：是。手势唤起、口令、页签切换、关闭四个动作逐一对应 Dexter 裁决 Q-6、Q-13、Q-16、第三条"section 直接不能跳转"。
- **此时这样操作是否合逻辑**：是。遮罩不暂停、不夺焦（Dexter 第四条），与运维态"边看业务边查状态"的真实任务一致。
- **是否有更短路径**：口令六格分框输入（Dexter 第二条指定）已是最短；四节导航是投影而非独立列表 owner，无多余层级。
- **不合理之处的来源**：`M-4` 的 layerId 歧义来自既有 `closeLayer` 的键设计（历史实现惯性），不是产品语义未裁决。
- `NOT_APPLICABLE` 不适用，本包含 UI。

## 4. M findings

### M-1 — `UiCatalogEntry` 加字段与现有校验器形状不兼容，且有一条静默失败面

`STATUS=CONFIRMED`（坐实 Codex M-01，并给出比其更硬的失败模式）
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:16-25(approvedEntryKeys)、61-72(assertEntryKeys)、74-95(canonicalEntry)；doc/plans/platform/...implementation-plan-codex.md:186；...implementation-design-codex.md:361-362`
`DEXTER_DECISION_REQUIRED=否`

计划 186 行写"Add optional `AdminSectionMetadata` only for section entries"。亲验当前源码：`UiCatalogEntry` 八个字段**全部必填**（无一个带 `?`），`assertEntryKeys` 同时要求 `actual.length === approvedEntryKeys.length` **且**八个 key 全部存在。

**失败面一（崩溃）**：任何"可选"字段都使 section 条目有 9 个 own key、非 section 条目有 8 个。无论 `approvedEntryKeys` 取哪一种长度，另一组必然长度不等而 `throw`。落到运行时就是**每个 admin section 在 assembly 启动时抛错**，四节一个都注册不上。

**失败面二（静默，Codex 未报）**：即使放宽 key 校验，`canonicalEntry`（74-95 行）是用**显式八字段字面量**重建条目后 `Object.freeze` 返回的。未列入该字面量的字段会被**无声丢弃**。admin-shell 随后读到的每个 `entry.adminSection` 都是 `undefined`，导航渲染成空，无任何错误。`canonicalEntry` 在详设与计划的变更符号清单里**一次都没出现**（两份文档全文检索无命中），所以这条路径当前完全无人认领。

**影响面**：`A-18`、`A-19`、`A-20`、`A-21` 四条判据全部落在这里；失败面二会让 `A-19` 的红夹具（"注册面改为模块级可变绑定"）照样通过，因为它测的不是这条链。

**最小修复方向**：把 `adminSection` 与 `surfaceForm` 都定为**必填**字段（非 section 条目取冻结的 `null` 而非缺省），同步扩 `approvedEntryKeys`、`assertEntryKeys` 的类型校验分支、**以及 `canonicalEntry` 的重建字面量**；三处必须在同一原子组内改。不需要新 registry。

### M-2 — command owner 拿不到 `surfaceForm`,四维 admission 缺一维

`STATUS=CONFIRMED`（坐实 Codex M-02，并定位到精确机制）
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:99-116(normalizeOpenLayerPayload)、138-145(currentWorkspace)；foundations/catalog.ts:124-138(selectAvailableParts)；plan:186 步骤 2/3/5`
`DEXTER_DECISION_REQUIRED=否`

计划步骤 2 要求"All four dimensions must match"，步骤 3 说 actor 拿到"its immutable catalog and **state-derived context**"，步骤 5 却把 `surfaceForm` 沿 `SurfaceRootProps`/`SurfaceContext`/`SurfaceHostSnapshot` 传递 —— 也就是走 **React 树**。

亲验四维的可达性：

| 维度 | 当前来源 | actor 能否读到 |
| --- | --- | --- |
| `displayMode` | `openLayer` payload | 能 |
| `workspace` | `currentWorkspace(context)` 由 state 推导 | 能 |
| `instanceMode` | `selectRuntimeInstanceMode(state)` | 能 |
| `surfaceForm` | 仅存在于 React context | **不能** |

`grep -rn "surfaceForm\|SurfaceForm" kernel/base/ui-state/src/` 当前**零命中**：form 在 ui-state 里根本不存在。kernel actor 读不到 React context。

**失败场景**：mobile-only 的 section 在 laptop 上发起 `openLayer`。actor 只能比三维，或给 form 塞一个默认值放行，state 里就写进了一个非法 layer。`LayerStack` 的渲染期过滤只能让它不显示，**清不掉已写入的 state**，于是 `A-20` 的红夹具（"mobile-only part renders on laptop"）可以照样绿，因为它看的是渲染结果。

**最小修复方向**：两条路，任选其一并在详设里冻结。(甲) 把 `surfaceForm` 加进 `openLayer` payload，与 `displayMode` 同构 —— 改动最小，但同 `displayMode` 一样属调用方自述，不是权威值。(乙) 在 surface 创建时把 form 写入 runtime state（我的 `CT-4` 原意），actor 从 state 读 —— 更权威，但多一处 state owner。需在详设中明确选哪条并写明取舍，不要两处各留一半。

### M-3 — identity 契约内部自相矛盾,且详设与计划给的是两套机制

`STATUS=CONFIRMED`（Codex M-03 标 PARTIALLY，我把其核心升为 CONFIRMED：这是同一段落内的平铺矛盾，与 `M-5` 的 Dexter 裁决无关）
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/...implementation-design-codex.md:203(identity contract) vs :206(invariant)；vs ...implementation-plan-codex.md:304-305`
`DEXTER_DECISION_REQUIRED=否`

详设同一个 CP-07 块里：

- 203 行：``SurfaceRoot`/the source lookup is keyed/remounted by this token`
- 206 行：`surface replacement preserves business content while discarding admin-local state`

`SurfaceRoot` 按 token 做 key 就会整棵重挂载，其下所有业务组件的本地 state 一并销毁。这两句不可能同时成立，且**与业务 layer 去留无关** —— 即使 Dexter 裁决关闭业务 layer，"保留业务内容"这句仍然被 remount 推翻。

同时，计划 304-305 行描述的是完全另一套机制：重算 geometry + 定向清 `admin.console` + blur + 清 admin 本地态，**全文没有 remount**。所以详设与计划对同一动作给了两种实现，实施者按哪份都能自称合规。

**影响面**：`A-57` 的红夹具是"cached canvas/auth/focus/scroll"。两种机制都能让这条判据变绿，但对业务状态的后果相反。判据无法区分，等于这条判据当前不可证伪。

**最小修复方向**：删掉 203 行的 `remounted` 表述，只保留"identity 变化触发替换 effect"；在详设中写明比较发生在哪个 effect 或 owner 边界，并冻结先后顺序：snapshot/geometry 更新 → blur 旧 field → 定向关 admin layer → 清 admin 本地态 → 渲染新 surface。详设与计划取同一套措辞。

### M-4 — 定向清理 admin layer 没有 layerId,清理可能静默落空（Codex 未报）

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/types/content.ts:12-17(LayerEntry)；features/actors/contentActors.ts:118-128(normalizeCloseLayerPayload)、181；design:204、217；plan:305、344`
`DEXTER_DECISION_REQUIRED=否`

亲验：`LayerEntry` 的 `layerId` 与 `partKey` 是**两个独立字段**，`closeLayer` 的 payload 只接受 `{displayMode, layerId}`，`contentActors.ts:181` 按 `layerId` 判重。

而 `admin.console` 这个字符串在设计包里被当成三种东西用：
- plan:344 —— **partKey**（"Define one layer-only `admin.console` part"）
- design:217 —— **focusScopeId**
- design:204 / plan:305 —— 要 `closeLayer` 关掉的那个 **layer**

设计从未指定 admin layer 的 layerId。两种实现都合规：

- 若唤起时传 `layerId='admin.console'`，清理能命中 —— 但这个约定文档里没有，纯靠实施者巧合。
- 若唤起时按惯例生成唯一 layerId（既有 `layerId` 判重逻辑正暗示它该唯一），清理**找不到目标、静默关闭零个 layer**，一个已通过口令认证的 admin 遮罩就跨 surface 替换存活下来。

**影响面**：这正是 `AC-5` / `A-57` 要防的缺陷，而失败是静默的：`closeLayer` 对不存在的 layerId 不报错。同时它与 `M-5` 的 Dexter 裁决独立 —— 无论业务 layer 留不留，admin layer 都必须被关掉。

**最小修复方向**：在详设里给 admin layer 一个冻结的常量 layerId，并明确它与 partKey、focusScopeId 三者是否同值；`A-57` 的断言面补一条"替换后 admin layer 数为 0"，而不是只断言 auth 态被清。

### M-5 — 业务 layer 去留仍是未裁决项,与需求 §11.1「无待裁决」冲突

`STATUS=RESOLVED_BY_RULING`（原坐实 Codex M-04;Dexter 已裁决保留业务 layer,见 §0b 裁决一）
`SEVERITY=M`
`PATH_OR_SYMBOL=requirements-claude.md:610-619(§11.1)；design:204；plan:305；journey-proposal-codex.md:117-126`
`DEXTER_DECISION_REQUIRED=是`

需求 §11.1 写"无"待裁决，但详设 204 行与计划 305 行都明文标 `DEXTER_DECISION=OPEN`。**这一条是我的需求错了，不是设计错了**：动态 surface 替换在需求定稿后才被拉进本轮（Dexter"动态切换本轮要做"），替换时业务 layer 的去留是新暴露的产品语义，需求没有覆盖它却仍声称零待裁决。

**待 Dexter 裁决的具体问题**：单机上画布形态发生动态切换时（例如竖屏单屏 ↔ 横屏双屏），已打开的**业务** layer 应该保留还是关闭？

- 保留：用户切回来时业务上下文还在；代价是业务 layer 要能适配新 form，否则可能渲染在错误尺寸下。
- 关闭：形态一致性有保证；代价是用户丢失未完成的业务操作。

设计当前的提议是"保留"。我倾向保留，理由是形态切换在真实运维里是插拔电源线这类外部事件，不是用户主动放弃业务操作；但这属产品语义，我不代裁。

**最小修复方向**：Dexter 一句裁决后，同步改需求 §11.1、Journey、IA、交互、详设、计划与 `A-57` 的断言面。

### M-6 — native-less focus 的字段级形状与 null-ref 分支未冻结

`STATUS=CONFIRMED（收窄）`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts:122-127(focusField)、130-146(completeField)；src/types/types.ts:56-99；plan:150`
`DEXTER_DECISION_REQUIRED=否`

先说 Codex M-05 被我收窄的部分：详设 CP-08（design:217）其实**已经冻结了行为规则** —— `focusScopeId='admin.console'`、`LayerStack` 在顶层变化时切 scope、`preflightFocusTarget` 拒绝非顶层 scope 但放行 suspended 下的 admin scope、1→2 / 2→1 / 1→0 三种转移各自的动作。Codex 说"谁保存/恢复目标"未定义，这一点已在 design:205 的 `FocusBoundaryState`（含 `last focus target per scope`）解决。这部分我**不采信 Codex 的原判**。

仍然成立的是**类型与分支层**。亲验当前实现：

```
focusField = (fieldId) => { if (!preflightFocusTarget(fieldId)) return
                            fieldsRef.current.get(fieldId)?.inputRef.current?.focus() }
```

`inputRef.current` 为 null 时，这是一个**静默 no-op**：不抛错、不返回失败、不改 keyboard state。`completeField` 同理（130-146 行走 `next.inputRef.current?.focus()` 与 `current?.inputRef.current?.blur()`）。计划 150 行只说"nullable native ref plus `focusScopeId` (default `business`)"，没有写 null 分支该做什么。

**失败场景**：admin 口令字段无原生 `TextInput`，`focusField` 静默什么都不做，虚拟键按键无处可写。`A-15` 断言的是"admin 虚拟输入能聚焦并收到按键"，实施者若把"聚焦"实现成"设置 activeFieldId"就能绿，但真实按键路径未被覆盖。

**最小修复方向**：逐字段冻结 `InputFieldOptions` / `InputFieldRegistration` / `InputFieldResult` 的新增与保留字段；明确 null-ref 时 `focusField` 改为提交 keyboard state（`activeFieldId` + `owner='virtual'`）而不依赖 ref；`completeField` 同步；`activateFocusScope` 给出签名。计划步骤 3 的 pre-probe 与步骤 8 的 `A-15` 必须调同一接口。

### M-7 — 三个内建 section 的生产注册 owner 未定义

`STATUS=CONFIRMED`（坐实 Codex M-06）
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:148-152(definedParts)；design:216；plan:344、349、351`
`DEXTER_DECISION_REQUIRED=否`

亲验当前生产 assembly：

```
const definedParts = [ ...sampleStaffAuthAssembly.parts, ...sampleMemberDeskAssembly.parts ] as const
const uiCatalog = createUiCatalog(definedParts.map(({catalogEntry}) => catalogEntry))
```

只有两个 sample feature assembly 贡献 part。设计对 **sample section** 的生产注入写得很到位（design:216、plan:349，含"先观察真实条目、再重建不含它的同一 assembly 观察其消失"的注入/移除证明）。但 `PlatformPortsSection` / `RuntimeSection` / `DisplayContextSection` 三个内建节（plan:335-337 只列了组件文件）**没有任何 part/renderer 的生产导出与合并入口**。

**失败场景**：测试 catalog 里凑齐四项，真实 assembly 里只有 sample 一项；或 admin-shell 自己维护一个内建三节的本地数组。后者恰是 `A-21` 红夹具"某节渲染硬编码文案"之外的另一种硬编码，判据抓不到。

**最小修复方向**：在详设里明确三个内建节的生产 part/renderer 导出符号、各自的 admin metadata、由谁合并进 `definedParts`、以及合并顺序；四项必须形成同一个不可变 catalog projection。admin-shell 仍不得 import `ui/feature`。

## 5. S findings

### S-1 — 口令测试向量不可复现:缺日期（Codex 未报）

`STATUS=CONFIRMED`
`SEVERITY=S`
`PATH_OR_SYMBOL=doc/plans/platform/...implementation-design-codex.md:175；...implementation-plan-codex.md:221`
`DEXTER_DECISION_REQUIRED=否`

详设 175 行把公式完整内联冻结（`seed = deviceId + YYYYMMDDHH`、`hash = (hash*131 + charCodeAt) >>> 0`、`numeric = hash + seed.length*97`、`slice(-6).padStart(6,'0')`），这部分做得好，实施者不需要打开仓外文件就能实现。

问题在同一行给出的"read-only vectors"：`DEVICE-001` 在 09/10/11/12 时 → `211940/431940/441940/451940`；`DEVICE-002` 在 10 时 → `201940`。**公式含 `YYYYMMDD`，但向量只给了小时，没给日期。**

我按该公式离线复算（scratchpad，未写仓内），在 2024-01-01 至 2027-12-31 全窗口穷举：

- 能同时满足全部五个向量的日期有 **10 个**：2024-09-23、2025-01-26、2025-02-07、2025-10-20、2025-11-01、2025-12-19、2026-04-15、**2026-09-10**、2027-06-23、2027-07-04。
- 文档自己的日期 2026-09-11 算出的是 `041940` / `811940`，与向量**不符**。

所以向量是真实算出来的（大概率在 2026-09-10 那天），但文档没记日期，实施者无法复现。

**影响面**：向量的唯一作用是给出**非同义反复**的 POC 等价性 oracle —— 测试若用同一份公式算期望值，等于自己验自己。丢了向量，`AC-2`"口令与 POC 一致"就没有独立校验物。`A-7`（"arbitrary hour accepted"）的红夹具仍然有效，所以不是 M。

**最小修复方向**：在 175 行补上向量对应的具体日期（按我的复算是 `2026-09-10`，请 Codex 用自己的原始运行确认，不要采信我的反推），或改为给出一组含完整 `YYYYMMDDHH` 的向量。

### S-2 — 两条新包边未接 `skeleton-graph.ts` 的机器强制（扩展 Codex S-01）

`STATUS=CONFIRMED；并部分证伪 Codex 的 cycle 论述`
`SEVERITY=S`
`PATH_OR_SYMBOL=apps/terminal/skeleton-graph.ts:67-83（render/primitives 节点）；tools/terminal-skeleton/check-static.mjs:74(cycle)、200-229(set equality)；plan:303、351`
`DEXTER_DECISION_REQUIRED=否`

先纠正 Codex S-01 的一个事实：**render → primitives 不可能成环**。亲验 `skeleton-graph.ts`，`ui.base.primitives` 的 dependencies 只有 `ui.base.automation`，而 automation 只依赖三个 kernel 包 —— primitives 是叶子。同批次依赖也是允许的（primitives 与 automation 同为 batch 1）。所以 Codex 的"如何避免 package cycle"这半句不成立。

但真实约束比 Codex 说的更硬。`tools/terminal-skeleton/check-static.mjs` 在 200-229 行对每个模块做 `skeleton-graph.ts` 与 `package.json` 的 `dependencies` / `plannedDependencies` / `devDependencies` **集合相等**校验。因此本轮要新增的两条边：

1. `render → primitives`（计划 303 行的 loading Spinner 所需）
2. `sample-console → admin-shell`（计划 351 行明写）

都必须**同时**改 `skeleton-graph.ts` 与对应 `package.json`，否则 `check-static` 直接失败。五份设计文档全文检索 `skeleton-graph` / `check-static` / `terminal-skeleton`：**零命中**。计划 351 行只说"Update admin-shell package dependencies/invariants/public exports"，漏了图本身。

**影响面**：不是静默失败 —— 门会红，所以危害有限，定 S。但它会在实施到一半时才暴露，且 `plannedDependencies` 与 `dependencies` 的分流规则（219 行按 `plannedWorkspaceDependencies` 分派）不写清楚容易反复。

**最小修复方向**：计划里把 `apps/terminal/skeleton-graph.ts` 列入变更文件清单，明确两条新边各自落 `dependencies` 还是 `plannedDependencies`。

### S-3 — `A-19` 要求的 owner/order 键把 kernel 契约的爆炸半径放大（源头是我的需求）

`STATUS=RESOLVED_BY_RULING`（Dexter 已裁决取消顺序键,见 §0b 裁决二）
`SEVERITY=S`
`PATH_OR_SYMBOL=requirements-claude.md:523(A-19)；对应代价见本文 M-1`
`DEXTER_DECISION_REQUIRED=是`

我的 `A-19` 写"每条注册项带 owner 与顺序键"。正是这一条逼出了 `UiCatalogEntry.adminSection`，进而逼出 `M-1` 描述的三处 kernel 校验器改动（`approvedEntryKeys` + `assertEntryKeys` + `canonicalEntry`）。

Codex 没有列出、我替它构造的更小替代：**section 就是普通 layer-only part，用固定 `containerKey='admin.sections'` 归集，排序只按 `partKey` 字典序**。这样 catalog 一个字段都不用加，`M-1` 的两条失败面同时消失。代价是失去显式 `order` 控制 —— 但当前只有四节，且 Dexter 从未要求自定义排序。

**待 Dexter 裁决**：`A-19` 的 owner/order 键是否放宽为"按 `partKey` 排序、不引入新元数据"？

- 放宽：kernel 契约零改动，`M-1` 自动消解，`surfaceForm` 那个字段仍需单独处理。
- 维持：按 `M-1` 的最小修复方向改三处校验器，代价是每个既有 part 声明都要动。

我倾向放宽，理由是长期可维护性在这里不站 owner/order 这边 —— 未来真需要自定义排序时再加，比现在就撑开一个带 exact-key 校验的 kernel 契约更省。但这与我"长期主义"的一贯取向有张力，所以交 Dexter 判。

## 6. N findings

### N-1 — Codex M-01 的"缺 tie-break"子论断已被满足,不必重做

`STATUS=REJECTED_WITH_EVIDENCE;SUPERSEDED`（顺序键已取消,tie-break 议题失效）
`PATH_OR_SYMBOL=ia-design-codex.md:107；implementation-design-codex.md:28`

Codex M-01 称"没有排序 tie-break"。实际 IA 107 行写明 `first available section by order, then partKey`，详设 28 行重复同一规则。这条子论断不成立，`M-1` 的修复不需要再补 tie-break。记此条是为避免 Codex 按自己的 review 重复造一遍。

### N-2 — `PrimitiveList` 的 `maxMounted` 与窗口参数恰好相等,无余量

`STATUS=UNVERIFIED_REQUIRES_EVIDENCE`
`PATH_OR_SYMBOL=implementation-design-codex.md:218`

`visibleWindow=16`、`overscanBefore=4`、`overscanAfter=4`、`maxMounted=24`。16+4+4 恰好等于 24，稳态下上限被打满，没有留给"滚动中新行已挂载、旧行尚未卸载"的瞬态余量，也没有留给顶/底部分行。若 `maxMounted` 是硬上限，`A-37`（"full render/truncation instead of virtualization"）的 100 条夹具可能在滚动瞬间截断或抛错。

我无法静态证明它会红 —— 取决于挂载/卸载的先后实现。建议在详设里说明 `maxMounted` 是硬上限还是软目标，若是硬上限则给 1–2 行余量。

### N-3 — 两处仓外绝对路径

`STATUS=CONFIRMED`
`PATH_OR_SYMBOL=implementation-design-codex.md:175；implementation-plan-codex.md:221`

两份文档都写了 `/Users/dexter/Documents/workspace/idea/newPOSv1/...`。因为公式已内联冻结（见 `S-1`），这不影响可实施性，只是可移植性缺陷：换机器或 POC 移动后该引用即失效。建议标注为"仅供人工回溯、非实施依赖"，或直接删除。

## 7. 对 Codex 第二轮 review 的逐条核验

| Codex 条目 | 我的核验 | 处置 |
| --- | --- | --- |
| M-01 `AdminSectionMetadata` 未冻结 | 坐实，且失败模式比其描述更硬（崩溃 + 静默丢字段） | 收进本文 `M-1`，补 `canonicalEntry` |
| M-02 admission 缺 `surfaceForm` | 坐实，定位到"四维中三维可达、form 零命中" | 收进本文 `M-2` |
| M-03 `SurfaceIdentity` 生命周期不可执行 | 核心坐实并升为 CONFIRMED（同段落平铺矛盾，与 M-04 无关）；另发现详设与计划给了两套机制 | 收进本文 `M-3` |
| M-04 业务 layer 去留 | 坐实；并指出根因是我的需求 §11.1 而非设计 | 收进本文 `M-5` |
| M-05 native-less focus 未闭合 | **收窄**：行为规则已在 design:205/217 冻结；仍缺类型字段与 null-ref 分支 | 收进本文 `M-6` |
| M-06 内建 section 注册 owner | 坐实 | 收进本文 `M-7` |
| S-01 render→primitives 边界 | 边界缺失坐实；**cycle 论述证伪**（primitives 是叶子）；真实约束是 `check-static` 的集合相等，且还漏了第二条边 | 收进本文 `S-2` |

Codex 未报而本轮新增：`M-4`（admin layer 无 layerId，静默落空）、`S-1`（口令向量缺日期）、`N-1`/`N-2`/`N-3`。

## 8. 十个关注点逐项回答

1. **`AdminSectionMetadata` 完整性 / exact-key / owner-order / 冻结** — 不通过。见 `M-1`、`N-1`、`S-3`。
2. **`createOpenLayerActor` 能否在 state write 前拿到含 `surfaceForm` 的完整 admission context** — 不能。见 `M-2`。
3. **`SurfaceIdentity` 比较点、effect 顺序、同 `displayMode` 替换、admin-only 清理边界** — 同 mode 替换**已正确处理**（design:203 明写 identity 变化即触发，不只看 displayMode）；比较点与 effect 顺序**未冻结**且详设自相矛盾（`M-3`）；admin-only 清理边界**有致命缺口**（`M-4`）。
4. **业务 layer 去留是否必须交 Dexter** — 必须。需求 §11.1 声称零待裁决是我的错误，见 `M-5`。
5. **native-less focus 契约冻结** — 行为层已冻结（收窄 Codex 判断），类型层与 null-ref 分支未冻结。见 `M-6`。
6. **四个 section 是否都走同一生产 `UiCatalog`** — sample 那一个走了且证明设计到位；三个内建节没有生产注册入口。见 `M-7`。
7. **render→primitives 的包/导入/环边界** — 无环（Codex 该论述证伪），但两条新边都没接机器强制。见 `S-2`。
8. **A-1…A-59 与 §9.2 独立复核** — **通过**。计划 423-481 行的判据矩阵 59 行齐全，每行含测试文件、证据档位、红夹具三列，无占位。§9.2 的 10 项停放条目（`AC-2.1`、`AC-3.6`、`AC-3A.3`、`AC-6.6`、`ID-2.2`、`PR-4.1`、`PR-6.3`、`§3.1.3`、`§3.1.8`、`DBG-4.1`）与计划 §7.1 的枚举**逐项一致，无漂移**。其中三项属"详设交付义务"、本轮即是其门：`DBG-4.1` 已交付（CP-05 给出 `DebugModeSource` 三值与九格完整优先级矩阵）；`ID-2.2` 已交付（CP-04 明确 assembly 单次 await → 冻结 runtime fact → 纯函数）；`AC-3.6` 由交互设计承接。三项均通过。
9. **证据档位分离** — **通过**。计划 §8 七档（static / focused / Web / Android / native / release / visual）各自独立成行，状态分别为 `NOT_RUN` / `NOT_AUTHORIZED` / `UNSET`，并明写"No row below is executed or PASS in this task"。visual 档标 Dexter 决定且"never inferred from text/focused"，符合要求。
10. **是否仍是最小方案** — 主体是。唯一的过度代价是 `A-19` 逼出的 kernel 契约改动，而**源头是我的需求不是 Codex 的设计**，见 `S-3`。

## 9. 证据档位与边界

- **static**：本轮只做静态源码与文档对账。我打开并逐行核过 `catalog.ts`、`contentActors.ts`、`content.ts`、`useInputFocusController.ts`、`InputScrollArea.tsx`、`assembly.tsx`、`skeleton-graph.ts`、`check-static.mjs`、`render/package.json`、`primitives/package.json`，以及五份设计文档。**未运行任何仓内门、测试或构建。**
- **离线复算**：`S-1` 的十个候选日期由我在 scratchpad 中按详设 175 行内联的公式独立复算得出，不读取仓内任何文件，不写入仓内任何位置。该复算只证明"向量与文档日期不符且不唯一"，不证明 POC 行为。
- **focused / Web / Android / native / release / visual**：**全部未执行**，我也无权执行。计划 §8 的自述状态我只核了其分档与措辞，未核其未来可执行性。
- **会话出处**：v2s-rooted，但属**续接会话**（上下文经摘要接续），不是 fresh acceptance。需求正本是我在同一条会话线中撰写的。

## 10. 授权边界

本评审是独立输入，不是 Dexter 的产品裁决，也不构成新权威。

- 本文**不授权**进入源码实施。
- 本文**不授权**任何 Roadmap step 推进、DEV、seed、UAT、部署或数据操作。
- `M-1`、`M-2`、`M-3`、`M-4`、`M-6`、`M-7`、`S-1`、`S-2` 属既有批准边界内的修复，可直接交 Codex 自主处置，不需要 Dexter 再授权。
- `M-5`（业务 layer 去留）与 `S-3`（`A-19` 是否放宽）**需 Dexter 裁决**，裁决前不得实施相关部分。
- `N-2` 标 `UNVERIFIED`：我无法静态判定，需实施期的 focused 夹具给出证据。
