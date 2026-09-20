# TER Admin console 非登录区需求 · Claude DESIGN review 处置

`REVIEW_TARGET=DESIGN`

`SOURCE_REVIEW=doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-review-claude.md`

`SOURCE_VERDICT=NO-GO`

`SOURCE_M/S/N=1/2/3`

`AUTHORITY=REQUIREMENTS_REPAIR_ONLY`

`IMPLEMENTATION_AUTHORIZED=false`

## 1. 处置边界

本记录只记录对 Claude 本轮需求与范围评审的逐条 intake，不把 Claude 的 NO-GO 改写成 GO，也不把
需求修订误称为 IA、详设、实施或动态验证。源码事实以当前仓内 owning source 为准；本轮没有运行构建、
测试、Web、Metro、Android、设备、DEV、seed、UAT 或部署命令。

Dexter 已对 M-1 的范围取舍作出决定：本批不扩展 display facts owner。由此，需求采用当前 surface
与非当前 surface 的不对称诚实下限，不复制或推导缺失数据。

## 2. 逐条处置

### M-1 · 非当前 surface 的公开事实不足

**状态：`DEXTER_DECISION / CLOSED_AT_REQUIREMENTS_LEVEL`**

**仓内事实**：

- `apps/terminal/kernel/base/platform-ports/src/types/device.ts:16-18` 的 `DisplayInfo` 只有
  `displayCount`；
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts:5-14` 公开的是当前 surface，含
  `hostLogicalSize` 与 `surfaceHostAvailability`，不提供另一块 surface 的完整事实；
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:64-66` 的物理
  副屏判断只使用 display count。

**事实精度修正**：当前 adapter 并非完全没有尺寸字段。`apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt:320-334`
的 `logDisplay` 记录 app/real 尺寸与 density，`apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt:159-172`
的 `logViewBounds` 记录 logical bounds。它们是内部日志/宿主诊断，不进入 `DevicePort.DisplayInfo` 或
`SurfaceContextValue`，所以不构成 Admin UI 可消费的公开 owner；“全量检索零命中”的宽泛说法不采纳，
但“当前公共 owner 不足”的 finding 仍确认成立。

**处置**：不扩展 display facts owner。需求稿 J-2、R-9、§5.2、P-6 与 §9.1 已写死：当前 surface
显示现有公开的逻辑尺寸与就绪/可用状态；非当前 surface 只显示存在性与主/副角色，逻辑尺寸、就绪状态
和物理尺寸均显示“该屏信息未提供”；不得复制当前 surface 的值。若详设认为必须改 kernel/Android
公开契约，必须停在 §9.3 报告 Dexter，不得静默扩大本批。

**结论**：真关闭了需求层的方向冲突；数据仍不具备不被假装为已具备，后续设计须遵守该下限。

### S-1 · topology 整页资格没有 owner read model

**状态：`CONFIRMED / CLOSED_AT_REQUIREMENTS_LEVEL_WITH_ADMISSION_BLOCKER`**

**仓内事实**：`evaluateTopologyOperation` 当前只返回单 operation 的 eligibility；
`createTopologyAdminCapability` 当前公开 `getSnapshot`、`getOperationEligibility` 和四个 command，
没有整页 availability 方法。全局条件与 operation 条件不能由 Admin shell 自己重组。

**处置**：R-12、R-16、§7 第 7 项和 §9.1 已将 topology owner 的 page-level availability/read model
列为进入 IA/详设前的 admission blocker。详设必须消费 owner 提供的整页 read model 或 page-level
reason 输出；不得选择一个代表性 operation、读取 raw facts 或在 admin-shell 维护 reason 清单来推断整页
不可用。若该 owner 需要改 topology contract/kernel，按 §9.3 停止并报告 Dexter。

**结论**：接受并收口在正确层级；没有把 owner 缺口伪装成 UI 已可实现。

### S-2 · 平台端口比例条分母不一致

**状态：`CONFIRMED / CLOSED_AT_REQUIREMENTS_LEVEL`**

**仓内事实**：`apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx:32-49`
在缺失 descriptor/空 capability 时产出一个合成行，否则按 capability 产出多行；因此不能用 port 数量与
capability 数量混成一根比例条。

**处置**：选择评审建议的方案 (a)。§5.1、R-6、J-1、§7 第 3 项和 P-3 已冻结能力单位分母：真实
capability 各占一个单位，缺失 descriptor 或空 capability 的 port 各占恰好一个合成“未声明”单位；
可用、不可用、未声明、分类和展开全部使用同一单位模型，单位总数守恒。

**反例闭合**：一个 port 有 3 个可用和 1 个不可用 capability，另一个 port 缺失 descriptor 时，
分母为 5（4 个真实 capability + 1 个未声明单位），不会把缺失 port 丢出分母，也不会把部分 capability
压扁为一个 port。

### N-1 · `switch-role` 的 allowed 不是执行授权

**状态：`CONFIRMED / CLOSED`**

`apps/terminal/kernel/base/contracts/src/types/topology.ts:7` 的 union 含 `switch-role`，但
`:109-116` 的 `TopologyAdminCapability` 没有对应 command；
`apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts:31-46` 没有
`switch-role` 专门分支，满足基础形态时可能 fall through 为 `allowed:true`。

已在 §5.3、§7 第 8 项明确记录：该值只是当前 eligibility 事实，不构成可执行授权；没有 owner command
前必须归为资格-only 或非本批，UI 不得自行添加动作。

### N-2 · 物理副屏存在与拓扑可用的用户语料混淆

**状态：`CONFIRMED / CLOSED`**

已在 §5.4 补充术语边界：运行状态 tab 可以说“检测到两块物理屏”，非当前 surface 写“该屏信息未提供”；
双机拓扑 tab 在同一 laptop 双物理屏场景必须说“当前功能不可用”并说明“双机拓扑要求本机只有一个物理屏”。
`hasTopologySecondarySurface` 不得被当作 topology operation eligibility。

### N-3 · independent review 状态陈旧

**状态：`CONFIRMED / CLOSED`**

需求稿头部已改为 `INDEPENDENT_SUBAGENT_REVIEW=ROUND_1_COMPLETE`，并指向
`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`。
§11.2 说明该记录是 round 1 fresh 独立审查，不是 Claude review，也不产生 GO；当前修订稿仍需
Claude/Dexter 的 DESIGN review。

## 3. 当前交付结论

本轮六条 finding 已进入需求稿；没有进入 IA、详设、实施或动态验证。当前仍需 Claude 对修订后的需求做
下一轮 DESIGN review，重点核对：

1. 非当前 surface 是否被任何句子重新要求逻辑/就绪/物理事实；
2. topology page-level owner blocker 是否没有被 UI 侧绕过；
3. 端口比例条、分类和展开是否都使用能力单位分母；
4. `switch-role` 的 eligibility-only 事实与两个 tab 的术语边界是否保持；
5. independent review 状态是否与留痕一致。

在该 DESIGN review 通过前，需求仍不授权 IA、详设、实施或动态验证。
