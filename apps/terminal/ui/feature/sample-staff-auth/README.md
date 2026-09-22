# `ui.feature.sample-staff-auth`

## 定位

这是 sample 店员认证的 UI feature 包，负责登录表单、认证结果呈现和失败恢复的 UI/actor；
它不是店员会话 kernel owner、integration 装配或 App 壳。

## 作用

本 UI feature 拥有店员登录、认证业务失败提示和认证基础设施失败提示的呈现。组装
描述提供登录 screen、两个 alert layer、记住工号的 `operator-name` uiVariable，以及
负责呈现、导航和失败恢复的 actor 模块。工号和密码都是拉丁/数字凭据，均通过
`ui/base/input` 的 `useInputField` 使用虚拟全键盘；编辑值留在 input registry，登录提交时
通过同步快照读取。密码草稿不进入 runtime/store，认证业务失败时由登录部件清空。

店员会话状态和领域结果命令仍由 `kernel/feature/sample-staff-session` 持有。本包
只消费该 owner 协议。带 loading 生命周期的登录动作显式沿 tracked requestId 派发；
其他 feature-owned public action 统一经 render 的 `dispatchWithRequestId` 生成 requestId。
resolved 的 `SYSTEM`/timeout/partial failure 与 Promise rejection 统一观察为
`auth.system-notice`，而已知认证业务失败仍走 `auth.notice`。本包不拥有业务 slice，
不负责平台启动或 runtime 安装。

## 结构

- `src/components/laptop` 与 `src/components/mobile`：登录 screen、业务失败层和系统失败层
  的两套机型 renderer；`src/components/StaffLoginPasscodeInput.tsx` 是真正共用的输入部件。
- `src/hooks`：按职责拆分的共享认证行为；`src/types` 与 `src/foundations` 保存纯类型和提示映射。
- `src/features/commands`：feature-owned UI 意图命令；`src/features/actors`：登录与失败观察 actor。
- `src/features/variables`：记住工号等 UI variable 声明。
- `src/parts/parts.ts`：part、layer identity 与呈现声明。
- `src/assembly/assembly.ts`：feature assembly 与运行期模块接线；`src/application/module.ts`：模块工厂。
- `src/foundations/systemFailureDismissal.ts`：系统失败层关闭动作的 feature-owned 转接。

## 用法

部件只通过 `ui/base/primitives` 的 typed React Native 控件和 `ui/base/input` 的输入接缝以 JSX
构建；本包不使用字符串 host tag 或 `createElement` 构造控件。登录表单使用
`InputScrollArea` 作为唯一滚动祖先，保证虚拟键盘收缩内容区时输入仍可滚入可见区域。

通过公开 assembly 取得 parts，并在 integration 装配时取得真实运行期模块：

```ts
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'

const module = sampleStaffAuthAssembly.createModule()
const authParts = sampleStaffAuthAssembly.parts
void module
void authParts
```

## 在这个包上迭代时

迭代时应先扩展 owner 的命令/结果协议，再在本包增加对应部件或 actor；partKey 与
呈现文案只由本包声明，不能下沉到 kernel。

改动后检查 package.json、`src/dependencies.ts`、graph、parts、actor、运行期模块和 README，
并运行本包 typecheck/test、相关 render/runtime focused test 与 terminal skeleton static checker。
认证业务失败仍必须与 SYSTEM/timeout/partial failure 分流；不得把密码草稿放进 runtime/store，
也不得新增第二套输入、导航或平台启动能力。
