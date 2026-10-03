# `kernel.feature.sample-member-registry`

## 定位

这是 sample 顾客登记的业务 owner 包，`kind=owner`。它依赖 contracts、runtime 和
state，被 sample-member-desk 等 UI feature 通过公开 command 使用；它不是 UI、surface、
display 或 presentation 包。

## 作用

凡是“待登记顾客、已登记顾客以及登记命令结果”这一组业务事实都必须由本包持有；凡是
part、container、display mode、用户可见文案或渲染组件都不得放入本包。确认只在公开
`confirmMemberCommand` 到达后提交 pending；reject 保留 pending 供重试，withdraw 清除
pending；已清除 pending 后再次收到同一竞争动作必须是幂等 no-op。

## 结构

- `src/types/types.ts`：Member、pending 和登记状态类型。
- `src/features/commands/commands.ts`：提交、确认、拒绝、撤回及结果事件 command。
- `src/features/actors/actors.ts`：登记业务命令的唯一处理者。
- `src/features/slices/slice.ts`：owner state slice 与持久化字段声明。
- `src/selectors/selectors.ts`：公开状态读取器。
- `src/foundations/errors.ts`：本包的 typed error 定义。
- `src/application/module.ts`：真实 RuntimeModule 工厂；`src/index.ts`：公开面。

MASTER→SLAVE 的同步 payload 只包含已确认 `members`。SLAVE apply 保留本机 `pending`，不发送、覆盖或清理分支登记草稿；双机 LMS 的主机 pending 另由 CP-05 明确的 operationId 投影承载。

## 用法

```ts
import {
  confirmMemberCommand,
  createSampleMemberRegistryModule,
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'

const module = createSampleMemberRegistryModule()
const pending = selectPendingMember(runtime.getState())
await runtime.dispatchCommand(submitMemberCommand, {name: '张三', phone: '13800000000'})
await runtime.dispatchCommand(confirmMemberCommand, {})
void module
void pending
```

## 在这个包上迭代时

先同步 sample1 冻结旅途、详设 D-4/D-13A 与计划 B1/B4，再检查 package.json、
`src/dependencies.ts`、graph、module kind、command definition、slice persistence 和
README。新增业务事实必须仍由 owner actor/slice 写入；改动后至少运行本包 typecheck/test、
相关 runtime acceptance 和 terminal skeleton static checker。不要把 UI identity、display
事实、presentation copy 或 platform adapter 依赖搬进来，也不要把完整
`dependencyModuleNames` 数组冒充 runtime subset。
