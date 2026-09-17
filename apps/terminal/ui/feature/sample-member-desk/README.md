# `ui.feature.sample-member-desk`

## 定位

这是 sample 顾客登记的 UI feature 包，负责业务表单、确认流程和失败恢复的呈现与 actor；
它不是 kernel 业务事实 owner、integration 装配或 App 壳。

## 作用

本 UI feature 拥有店员会员列表/表单、等待确认、顾客欢迎/确认、登记提示、撤回确认、
草稿放弃确认与系统失败提示的呈现。组装描述提供九个 parts，以及负责呈现、单双屏路由
和失败恢复的 actor 模块。表单编辑值由 `ui/base/input` 的字段 registry 持有，提交时才
同步 capture 快照；登记失败重试时只从 member-registry owner 的 `PendingMember` 回填，
不再注册或清理 member-desk 的 transient uiVariable。顾客拒绝只保留 owner 的
`PendingMember` 供“修改后重试”回填；登记提示的放弃/撤回清理 pending，本地编辑 draft 不跨卸载
保留，晚到命令按幂等 no-op 处理。

店员会话和会员登记状态仍由两个 `kernel/feature` 包分别持有。本包消费它们的命令、
领域结果事件与 owner selector，不复制业务状态或 selector。撤回是 member-registry
owner 的业务命令：本包只派 `memberSubmissionWithdrawnCommand` 这一 UI 意图，由 desk
actor 转交 owner 的 `withdrawMemberCommand`；owner 负责清 pending；本地编辑 draft 不跨卸载保留，
只有 reject retry 通过 owner 的 `PendingMember` 回填已提交的 name/phone；owner 还负责
处理 confirm/reject/withdraw 的先到者竞态。desk actor 在处理相关命令时读取 topology 的公开
事实 selector，按“本机物理双屏，或 MASTER 已配对 SLAVE”判断是否有副屏；旧的
display-context 物理屏 helper 仍保持原语义。runtime 组装与平台启动由 integration 负责。

## 结构

- `src/components`：会员列表、表单、确认层和系统失败提示等业务部件。
- `src/features`：本 feature 的 UI 意图命令与 actor；业务事实仍调用 kernel owner。
- `src/parts/parts.ts`：本 feature 的 part、layer identity 与呈现声明。
- `src/assembly/assembly.ts`：feature assembly 与运行期模块接线；`src/application/module.ts`：模块工厂。
- `src/foundations/systemFailureDismissal.ts`：系统失败层关闭动作的 feature-owned 转接。

部件只通过 `ui/base/primitives` 的 typed React Native 控件以 JSX 构建。`MemberRow` 因为
承载姓名、电话等业务词汇留在本包的 `components` 目录，由 `MemberList` 传入并透传
`sample.desk.member-list:row` 根 testID；它不进入 primitives 公共面。

`MemberForm` 的姓名字段使用系统键盘，电话字段使用虚拟纯数字键盘；`CustomerMember` 的
年龄字段使用虚拟纯数字键盘并在确认边界读取本地快照。双屏年龄输入位于 SECONDARY，
单屏 `handheld-confirm` 位于 PRIMARY，但这些差异由 actor 的 placement/mode 提供，部件
不读取屏数，也不把编辑值写入 runtime/store。

本 CP 的 parts 是九个，layer partKey 是五个（waiting-confirm、registry-notice、
discard-confirm、withdraw-confirm、system-notice）；全专题的 layer semantic type 分母
仍为六，layer partKey 分母仍为七，不能把本包的五个 partKey 当成全专题 type 分母。

## 用法

通过公开 assembly 取得本 feature 的 parts，并在 integration 装配时取得它的真实运行期模块：

```ts
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'

const module = sampleMemberDeskAssembly.createModule()
const memberDeskParts = sampleMemberDeskAssembly.parts
void module
void memberDeskParts
```

系统失败观察命令与撤回 UI 意图由本包拥有，system-notice 的关闭仍经本包 actor 调用
ui-state 的通用 closeLayer；业务 partKey、容器准入与呈现文案只在本包声明，不能下沉到 kernel。

## 在这个包上迭代时

先同步 sample1 冻结旅途、详设 D-13A/D-14 与计划 B4，再检查 package.json、
`src/dependencies.ts`、graph、parts、actor 和 README。新增业务事实必须仍由 kernel owner
持有；新增失败路径必须同时说明写入阶段、state、提示和恢复动作，并运行本包 typecheck/test、
相关 render/runtime focused test 与 terminal skeleton static checker。不要把 UI identity、
display 事实、presentation copy 或 platform adapter 依赖搬进 kernel，也不要把完整
`dependencyModuleNames` 数组冒充 runtime subset。
