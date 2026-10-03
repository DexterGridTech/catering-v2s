# `kernel.feature.sample-staff-session`

## 定位

这是 sample 店员会话的业务 owner 包，`kind=owner`。它依赖 contracts、runtime 和
state，被 sample-staff-auth 等 UI feature 通过公开 command 使用；它不是登录页、UI part、
surface 或 Android/App 壳。

## 作用

凡是“匿名/已认证会话、店员身份和登录/登出结果”这一组业务事实都必须由本包持有；MASTER
持有本机资格，SLAVE 只读取不具登录资格的 `hostQualification` 投影；凡是
输入控件、错误文案、layer、display mode 或渲染行为都不得放入本包。登录命令只验证本
包定义的 sample credentials 并发布 typed result；logout 清理本包会话；install hook 只
负责以 request id 派发内部 bootstrap command，不承担 UI 初始化。

## 结构

- `src/types/types.ts`：SessionStatus、SessionState、登录 payload 类型。
- `src/features/commands/commands.ts`：bootstrap、login、logout 及会话结果 command。
- `src/features/actors/actors.ts`：会话验证、恢复、登录和登出处理者。
- `src/features/slices/slice.ts`：owner session state、MASTER→SLAVE 的 status/operatorName 投影与本机持久化声明。
- `src/selectors/selectors.ts`：公开本机会话和主机资格读取器。
- `src/foundations/errors.ts`：本包的 typed error 定义。
- `src/application/module.ts`：真实 RuntimeModule 工厂；`src/index.ts`：公开面。

## 用法

```ts
import {
  createSampleStaffSessionModule,
  loginCommand,
  selectHostStaffQualification,
  selectSessionState,
} from '@catering-v2s/kernel-feature-sample-staff-session'

const module = createSampleStaffSessionModule()
await runtime.dispatchCommand(loginCommand, {operatorName: 'A001', passcode: '1111'})
const session = selectSessionState(runtime.getState())
const hostQualification = selectHostStaffQualification(runtime.getState())
void module
void session
void hostQualification
```

SLAVE 的本机会话仍由 `selectSessionState` 读取；配对 LMS/LSP 的主机资格只经
`selectHostStaffQualification` 读取。同步内容仅为 `status` 和 `operatorName`，登录口令不进入
state、持久化或网络投影；收到主机投影不会改变 SLAVE 本地 session。

## 在这个包上迭代时

先同步 sample1 冻结登录旅途、详设 D-4/D-12/D-13A 与计划 B1/B4，再检查 package.json、
`src/dependencies.ts`、graph、module kind、command visibility、session slice 和
README。新增会话事实必须经 owner actor 与 selector 暴露；改动后至少运行本包
typecheck/test、sample1 focused journey 与 terminal skeleton static checker。不要把登录页
part、system notice、display/surface 事实或原生能力搬进来，也不要用 test-only platform
ports import 改写生产依赖声明。
