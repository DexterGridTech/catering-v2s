# TER terminal admin console 设计独立审查第一轮处置输入

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
SOURCE_VERDICT=NO-GO
SOURCE_M/S/N=10/2/0
INTAKE_AUTHORITY=CODEX_POST_VERDICT_INTAKE_ONLY
IMPLEMENTATION_AUTHORITY=false
ROUND_2_STATUS=COMPLETED_NO-GO_FINAL
```

本文件只记录主 agent 对第一轮 fresh 独立审查输入的逐条处置，不改写 reviewer verdict，也不构成 Dexter 的产品裁决、详设批准或实施授权。第二轮必须重新打开当前字节、要求证伪，并独立判断下列修订是否真的闭合。

## 1. 逐条处置

| ID | reviewer status | 当前处置 | 证据边界 / 第二轮复核点 |
| --- | --- | --- | --- |
| M-01 | `CONFIRMED` | 已修。交互文档按模板补入逐屏 `CONSUMER_FACE`、`UI_SURFACE`、`HOST_AND_ENTRY`、`CONTAINER_LAYOUT`、低保真线框、v2 对应物盘点、L2/action roster、状态边界、face/owner 矩阵，并新增 Dexter visual/product conclusion；实现绑定仍被 `L2_USER_VISIBLE=BLOCKED` 拦住。 | `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md:1-8,36-545` 对照 `doc/decisions/templates/ui-interaction-design-template.md`；第二轮须检查字段是否逐屏且不是泛化代填。 |
| M-02 | `CONFIRMED` | 已修。详设冻结 `SurfaceHostSnapshot` 携带 `isHostPrimaryDisplay` 与 `surfaceIdentity`，物理 `displayIndex` 在 integration 保留，按 index 取 host source 并只在此处派生 bool，`SurfaceRoot` 转入 `SurfaceContext`；Web 也使用同一 index 输入。 | `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:23-35,158-167,252-276,350-380`；当前源码仍未实现，第二轮须检查设计是否遗漏 pending/中间态或重新引入 mode/instance 派生。 |
| M-03 | `CONFIRMED` | 已修。冻结 `SurfaceIdentity={surfaceKey,displayIndex,surfaceForm,displayMode}`，完整 token 变化即触发生命周期，即使 `displayMode` 不变；重算 geometry，blur 旧 surface focus，仅关闭已知 `admin.console`，清除 admin auth/selection/scroll，业务内容/业务 layer 保留仍待 Dexter 决策。 | `implementation-design-codex.md:199-209`、`ia-design-codex.md:40-43`、`ui-interaction-design-codex.md:315,493-495`；第二轮须检查 trigger、同 mode replacement 与业务 layer 决策是否一致。 |
| M-04 | `CONFIRMED` | 已修。`createUiStateModule` 向 `createOpenLayerActor` 提供不可变 catalog 与 state-derived context；actor 在 dispatch 既有 `openLayer` 前，以 `containerKey=null` 调共享 predicate，不可用时返回 typed `layer-part-unavailable` 且零 state write；LayerStack/resolvePart 仅为 render 防线。 | `implementation-plan-codex.md:184-200`、`implementation-design-codex.md:158-167`；第二轮须检查 command owner 的真实源码符号、null layer 语义和 no-write red fixture 是否足够可实施。 |
| M-05 | `CONFIRMED` | 已修。冻结 `FocusBoundaryState={surfaceSuspended,activeLayerScopeId,lastFocusTargetPerScope}`；surface suspend/restore 只在 0→1/1→0，1→2/2→1 只切 active scope；business scope=`business`，admin scope=`admin.console`，admin native-less virtual field 可在 surface suspended 时聚焦。 | `implementation-design-codex.md:146-156,199-209,211-218`、`implementation-plan-codex.md:170-184,362`；第二轮须检查 step-3 pre-probe 与 step-8 A-15 的时序和 restore 断言。 |
| M-06 | `PARTIALLY_CONFIRMED / DEXTER_DECISION` | 未擅自关闭。设计/计划明确提出 admin-only close、业务内容与业务 layer 保留的方案，并明确当前 `clearLayers` 全清不可复用；“业务内容是否包含已打开业务 layer”保留为 `DEXTER_DECISION=OPEN`，实施前必须裁决。 | `implementation-design-codex.md:31-35,199-209,246-250,437-449`、`implementation-plan-codex.md:321-337`；第二轮须确认没有任何段落把该开放决策误写为已定事实。 |
| M-07 | `CONFIRMED` | 已修。冻结 `DebugModeSource='startup'|'packaging'|'default'`，startup（包括 false）优先于 packaging，均缺省时 default/off，并列出 9 行完整真值表。 | `implementation-design-codex.md:180-188`、`implementation-plan-codex.md:242-255`；第二轮须检查 false 的覆盖语义、生产构建可表达性与 source 字段一致性。 |
| M-08 | `UNVERIFIED_REQUIRES_EVIDENCE` | 已只读重开 POC 源码并冻结公式、窗口和 vectors；未声称有运行证据。公式为本地 `YYYYMMDDHH`、UTF-16 code-unit `hash*131`、`>>>0`、`seed.length*97`、末六位补零、`[-1,0,1]` 小时窗口；vector 已写入详设与计划。 | `implementation-design-codex.md:169-178`、`implementation-plan-codex.md:208-229`；第二轮须检查引用路径、公式转义和 vectors 是否可直接驱动 focused proof；POC runtime/focused 仍未执行。 |
| M-09 | `CONFIRMED` | 已修。冻结 `visibleWindow=16`、`overscanBefore=4`、`overscanAfter=4`、`maxMounted=24`，100-record fixture 要求首尾可见且不截断、mounted 不超过 24。 | `ia-design-codex.md:69`、`implementation-design-codex.md:211-218`、`implementation-plan-codex.md:274-286`；第二轮须检查 bound 不是仅文字而有可实施观察点。 |
| M-10 | `CONFIRMED` | 已修。增加公开 `PlatformPortCapability`/`PlatformPortCapabilitySnapshot` 与 `describePlatformPortCapabilities(ports)` owner API；Android/Web/default 每构建可提供 method-level `state/source` descriptor，assembly runtime facts 与 platform section 消费。 | `implementation-design-codex.md:306-320,350-380`、`implementation-plan-codex.md:208-229,379-391`；第二轮须检查 API 名称、路径、非 DEV 来源和非 admin consumer 是否闭合，当前源码仍是旧 DEV-only 形态。 |
| S-01 | `CONFIRMED` | 已修。计划列出 render、input、Android adapter/Kotlin 的 IME 删除集合，保留 virtual keyboard metrics、`InputScrollArea`、`viewportAlreadyShrunk`，并要求 before/after `imeVisible` truth-table 集合比对。 | `implementation-design-codex.md:146-156`、`implementation-plan-codex.md:145-184`；第二轮须检查删除面是否与当前 source inventory 一致，不能用“几何一致”恒真判据替代。 |
| S-02 | `CONFIRMED` | 已修。计划冻结 dev-host `createSurface({displayIndex,displayMode,surfaceForm,...})`，index 0/1 独立创建并贯通 host/source；不得从 `displayMode` 合成 host bool。 | `implementation-design-codex.md:158-167`、`implementation-plan-codex.md:323-362`；第二轮须重新打开 `testExpoApp.tsx` 调用点并检查输入契约不是伪命名。 |

## 2. 当前收口状态

```text
ROUND_1_REPAIRS=APPLIED_TO_DESIGN_BUNDLE
ROUND_1_REVIEW=NO-GO (10M/2S/0N)
ROUND_2=COMPLETED_NO-GO_FINAL
ROUND_2_REPORT=doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-2-codex.md
DEXTER_DECISION_OPEN=business-layer retention during surface identity replacement
DEXTER_WIREFRAME_REVIEW=UNSET
IMPLEMENTATION_AUTHORITY=false
SOURCE_IMPLEMENTATION=NOT_STARTED_BY_CODEX
STATIC/FOCUSED/Web/Android/native/release/visual evidence=分别未取得；不得互相升级
```

只有第二轮 fresh reviewer 明确重新核验后，才能更新独立审查状态。即使第二轮对设计工程闭环给出 GO，仍不能越过 Dexter 对 business-layer retention 与低保真线框的产品/视觉决策，也不能把设计 review 当作源码或运行验收。
