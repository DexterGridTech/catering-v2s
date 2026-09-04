# `@catering-v2s/adapter-android-dual-screen`

TER 在 Android 上的**"第二块屏"适配器**。

它的存在意义只有一条:**让上层不必知道副屏在哪。** 副屏可能是本机的第二个物理显示器,
也可能是另一台设备;这两种物理形态的差异由本包吸收,对 kernel 与 integration 呈现同一件事。

## 承载机制状态

单 VM 多 Root Surface 在当前 Expo SDK 57／RN 0.86.3 组合下的具体 carrier
仍由 `OPEN-DUALSCREEN-SINGLE-VM-CARRIER` 决定。本包当前只有模块声明，不能把
`Presentation`、独立 Activity、独立 React 实例、独立进程或第二 VM 写成已选实现。
`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 是必须验证的不变量，不是本 README 对
承载形态的选择。必须先经单独授权的真机 spike 证明后，才能开始 native carrier 接线。

双机与 `local web server` 形态本轮押后，不属于当前实现；不得用它替代单 VM carrier，
也不得在本包提前实现 `TopologyHostPort` 或协议。

未来双机形态若获单独裁定，才可能实现 `platform-ports` 的 **`TopologyHostPort`** —— 该 port 的类型形状即是一台本地服务端:
`TopologyHostConfig` 带 `port`/`basePath`/心跳间隔与超时,`TopologyHostAddress` 给出
`httpBaseUrl`/`wsUrl`,`TopologyHostStats` 统计 `sessionCount`/`peerCount`/`stalePeerCount`,
生命周期为 `stopped｜starting｜running｜stopping｜error` 五态。

⚠️ 待确认:接入侧(SLAVE)使用 `ConnectorPort` 还是另设通道,尚未裁决。

## 与 `adapter-android-device` 的分界

分界是**观测 vs 控制**,不是"和屏幕有关就归这里":

- `device` 实现 `DevicePort`,全部是只读观测:`getDisplayInfo`(`displayCount`)、`getPowerStatus`、
  `subscribePowerStatus` 等。**副屏的存在与插拔属于观测,归 `device`。**
- 本包未来只承载经裁定的 surface 控制动作；当前不实现 `Presentation`、RN surface
  挂载/卸载或 local web server。

一个 port 不得跨两个 adapter 实现 —— 这是上面这条分界的硬理由。

## 本包吸收什么、不吸收什么

**目标边界（未实现）。** 上层不应被迫区分副屏是本机的还是联网的。这一点在 kernel 里已有印证:
`display-context` 的 `resolveSurfaceDisplayMode` 用一个公式两个子句让两条物理路径汇流到同一结论 ——
单机走 `displayIndex === 1`,双机走 `displayRole === 'VICE' && instanceMode === 'SLAVE'`,
结果都是 `SECONDARY`。

**当前不声明实例拓扑。** 下表是待裁决形态的约束说明，不是当前实现事实：

| | 单机双屏 | 双机双屏 |
| --- | --- | --- |
| JS VM / store | 各 1 个 | 各 2 个 |
| 副屏是什么 | 同一 runtime 上的一个 `SurfaceRoot` | 另一台设备上的**完整实例** |
| workspace | 都是 `MAIN` | `SLAVE` + `CHIEF` → `BRANCH` |

`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 只能在真机验证证明时成立。任何第二 VM、独立
进程、独立 React 实例或独立 store 的结果都必须停止并交 Dexter，不能由本包自行接受为降级。

## 边界判据(可证伪)

本包的公共 TS 接口与 Kotlin 实现中,不得出现下列任何一个词:

```
displayMode  workspace  PRIMARY  SECONDARY  CHIEF  VICE  MASTER  SLAVE  BRANCH  MAIN
```

出现即为分层错误。本包只上报"有没有第二个 surface 可挂 / 有没有 peer 接入",
**谁是主谁是从、副屏该显示什么,一律由 `kernel/base/display-context` 认定。**

决策链沿用 TR-11 的既有形态(参照 `display-context` 的 `powerStatusChangedCommand`
→ `powerStatusActor` → `resolvePowerRoleTarget`):本包只发出事件,由 command 与 actor 承接。

## 状态

骨架。Kotlin 侧目前只有 `TerminalDualScreenModule` 的模块声明,无任何方法。

⚠️ 前置未决:双机形态的状态同步语义(协议、重连、冲突)按现有分工应落在 `kernel/base/transport`,
而该包当前明确押后。本包的双机路径不应先于该裁决动工。
