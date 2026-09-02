# kernel.base.display-context

## 定位

`kernel.base.display-context` 是终端显示角色与显示派生规则的 owner 包。它只保存设备本地的
`displayRole`（`CHIEF` 或 `VICE`），不把物理屏幕事实、surface 身份或 runtime 的 instance mode
复制进自己的 state。

## 作用

- `displayIndex` 来自 surface props；`instanceMode` 来自 runtime；`displayCount` 由
  `DevicePort.getDisplayInfo` 实时取得。
- `resolveSurfaceDisplayMode` 与 `resolveWorkspace` 只做纯派生，不建立第二份缓存。
- `switchDisplayRole`、`switchInstanceMode`、电源变化和 hydrate 校验都通过 command → actor →
  `dispatchAction` 写入路径。
- runtime 在 instance mode 提交后发出 runtime-owned changed command，本包的 actor 只在此时把
  `VICE` 重置为 `CHIEF`；它不监听提交前的 set-mode command。

## 结构与用法

- `src/features/slices/displayRole.ts`：唯一 slice，字段只有 `displayRole`，owner-only、立即持久化、isolated sync。
- `src/features/commands` 与 `src/features/actors`：四条 command、五个 actor；公开 command 需要
  `requestId` 与可信的 route context。
- `src/foundations/displayDerivation.ts`：显示模式、workspace、角色/instance 准入和电源目标的纯函数。
- `src/application/createPowerStatusBridge.ts`：安装后先等待 hydrate 校验，再订阅设备电源事件；首个事件只播种，
  同值去重，跃迁按接收顺序串行派发 `power-status-changed`。
- `createDisplayContextModule()` 是装配入口；`selectDisplayRole` 是唯一公开的角色读取 selector。

目标为 `CHIEF` 的手动切换不查询设备屏数；所有会写入 `VICE` 的运行期路径都在写前实时取得并校验
`displayCount === 1`。端口非 `succeeded`、缺失或畸形的 count、以及多于一块物理屏都 fail-closed；
hydrate 恢复出的危险 `VICE` 在无法确认单屏时改回 `CHIEF` 并留下 typed 诊断。

## 失败与持久化边界

`PortResult` 的 `failed`、`timed-out`、`unavailable` 与 malformed 成功值不会被压成同一个原因。
命令结果和日志保留状态、reason/capability 等可诊断字段。状态写入后 flush 失败不会回滚内存，
而是返回 `persistenceStatus: 'failed'` 并记录诊断。这个包不提供跨 slice 原子事务。

## 在这个包上迭代时

- 不新增 `onApplicationReset`：reset 会重建 state 但不会重新运行 install；重复订阅会造成泄漏。
- 当前 `RuntimeModule` 没有生产 stop/dispose 路径，生产电源订阅依赖进程退出回收；test-only release
  只证明本地 bridge 失活及 unsubscribe 调用已发起，不证明 native unsubscribe 已完成。未来补 teardown
  时必须复用 runtime resource registry，不能另建回调或 event bus。
- batch-1 默认 device adapter 不提供真实 display info，因此持久化的 `VICE` 在重启时会按安全规则纠正为
  `CHIEF`；这不是 native/Android 能力证明。transport activation guard、真实 adapter、生产 route context
  可信性和角色留痕跨重启仍是未证明边界。
- 不要把 `displayIndex`、`displayCount`、`displayMode` 或 workspace 加入 slice；不要恢复已被 TR-11
  取代的 role effect/action-array 接缝，也不要在本包定义 runtime command。
- 记录 entry 是本地事实；本包不承诺“无后续变更时自动恢复”以外的审计或重试语义，新增公开字段、端口方法、
  依赖边或改变失败域前必须重新核对需求、详设、规范与 invariant。
