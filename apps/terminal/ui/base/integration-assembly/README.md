# 终端应用装配壳（`ui.base.integration-assembly`）

## 定位

本包是两个 terminal integration 共用的整机装配壳。它读取设备与屏幕事实，加载各 owner module，
从已加载的 UI module 收集呈现贡献，构建 catalog、Runtime 与 surface。它不拥有业务状态，
也不手工维护 UI parts 或 State 同步资格名单。

这是 UI toolkit，由 `sample-console` 和 `sample-wallpaper-console` 使用；直接依赖为 contracts/display-context/platform-ports/runtime/state/transport/ui-state 与 admin-shell/automation-agent/feature-assembly/input/primitives/render。App-specific modules、策略和平台输入仍由这两个 integration 提供。

## 结构

- `src/application/integrationAssembly.tsx`：加载 modules、构建完整 Runtime bundle、创建各屏 surface，
  并在 retry 时替换 Runtime 与 catalog。
- `src/foundations/terminalSurfaces.ts`：surface declaration parser 与 orientation selector。
- `src/foundations/startupReady.ts`：startup-ready payload 与 actor 的共用实现。
- `src/foundations/startupDiagnosticsWriter.ts`：startup complete 的单一 writer 与 duplicate guard。
- `src/index.ts`：唯一公共入口。
- `terminal-invariants.json`：公开面与包边界不变量。

## 所有权与生命周期

UI package module 自身贡献 parts、variables 和 `partKey → dismissal`。本包逐项收集，重复 partKey
或 dismissal key 会拒绝装配；catalog、renderer、dismissals、ui-state 与 Runtime 属于同一 bundle，
失败重试会重新构建并整体替换。

State 从已注册 slice descriptor 派生同步资格，Runtime 只转交只读资格 view，Topology 在 install
时消费。integration 不再传入第二份 State 同步白名单；业务 required projections 仍由各业务 consumer
按自己的判据检查。

两套 integration 通过同一 startup diagnostics writer 提供 logger、run identity 与 surface provenance；
不得复制 `startup.complete` 写入逻辑，也不得把只读诊断 sink 当成写入端。

## 用法

通用 App composition 由本包创建 assembly；屏幕根节点按物理显示序号挂载对应 surface：

```tsx
const assembly = await createIntegrationAssembly(input)
const primarySurface = createSurfaceForDisplayIndex(assembly, 0)
```

两个函数都是本包 `src/index.ts` 当前公开导出；`input` 由 integration 提供 App 名称、平台端口、模块工厂和 surface 声明。

其余主要公共接缝包括 `getSurfaceDeclarations`、`readTerminalSurfaces`、`surfaceFormForOrientation`、`createDispatchCommand` 与 `createStateSource`；完整 export 以 `src/index.ts` 和 `terminal-invariants.json` 为准。

## 在这个包上迭代时

先核对两个 integration 的 `package.json`、`dependencies.ts`、graph edge、module 顺序及 UI owner factory。
不在本包加入第二 writer、跨客户端聚合、feature notice 或 Runtime state。改动需补 focused 测试，
并同步 README、公开面登记和适用机械门。运行 `yarn workspace @catering-v2s/ui-base-integration-assembly typecheck`、`test`、`lint`；surface/native 表现另按获批执行面验证。
