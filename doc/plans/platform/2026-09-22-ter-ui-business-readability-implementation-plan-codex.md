# TER UI 业务包可读性重构 · implementation plan

SKILL_USED=cs-spec-to-plan;cs-writing-plans
BUSINESS_SOURCE=doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
IA_RECONCILIATION=doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
IMPLEMENTATION_DESIGN=doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
DESIGN_REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
PLAN_STATUS=READY_FOR_IMPLEMENTATION_REVIEW
AUTHORIZED_NOW=只形成详设、实施计划与审查工件；当前不改源码、不改测试、不改依赖、不改脚本、不改构建产物、不启动任何 runtime
IMPLEMENTATION_AUTHORITY=false

## 0. 任务边界与完成条件

本计划把需求文档和 implementation-facing 详设落实为一份可执行的、可逆检查的
refactor-only 施工顺序。实际实施必须由后续明确授权开启；本轮只写文档和独立审查
工件，不执行下列任何动作：

- 不写入 apps、libraries 或 package.json；
- 不改变测试、依赖、脚本、generated output 或构建产物；
- 不启动 Web、Metro、Android、native/device、DEV、L2、UAT；
- 不做动态、视觉、设备或业务验收；
- 不执行 Git 控制动作。

实施批准后的完成条件不是“新目录能编译”，而是同时满足：

1. 14 个 feature logical part、28 个双端 renderer 和当前可复用的 3 个 common
   component 都能按明确目录读取；laptop 与 mobile 不再通过一个默认 wrapper
   暗中选择；
2. feature hook 每个文件只承载一个业务机制；member、staff-auth、wallpaper
   的业务规则仍由各自 owner 持有；
3. base 只承载至少两个消费者都需要且不含 sample 业务知识的机械能力；
4. 旧 wrapper、旧聚合 hook、旧 alias、重复 parser/startup/state-sync 代码全部
   删除或以“已明确迁移后覆盖”的方式消失，负向扫描不得命中；
5. 既有 IA、交互正本、wallpaper 需求/详设的可见字段、surface、partKey、mode、
   testID、文案、动作、失败层级、滚动边界和双端差异保持不变；
6. 每个 CP 在进入下一 CP 前完成需求、详设、项目记忆三维逐点对账；全批完成后
   再完成一次独立的逐代码与详设对账；
7. 只有 focused/typecheck/static 结果真实关闭后，才可把后续动态验证交给单独授权；
   本计划不会把静态证据升级为视觉或设备证据。

任一条件不能证明时，当前 CP 为 OPEN；不能用“新代码已可用”“测试通过”抵销旧代码
残留、业务语义漂移或 owner 边界漂移。

## 1. 实施前固定输入与正本优先级

实施者必须先重新读取以下材料，不能使用聊天摘要替代：

| 类别 | 必读路径 | 用途 |
| --- | --- | --- |
| 执行入口 | AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md | 启动顺序、权限和停止条件 |
| 记忆 | project-memory/index.md；再按六维路由读取本任务命中的全部原文 | 共享 foundation、命名、失败、review 与源码组织约束 |
| 需求 | doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md | 用户目标、负向要求、验收分母 |
| IA 对账 | doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md | 20 条保留记录、可见事实分母 |
| 详设 | doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md | owner、接口、删除清单、阶段边界 |
| 交互正本 | doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md；doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md | 可见形态、动作、双端语义 |
| wallpaper 正本 | doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md；doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md | wallpaper 语义和失败呈现 |
| 编码规范 | doc/platform/frontend-coding-standard.md、terminal coding standard | 目录、共享能力、测试和 owner 约束 |

正本优先级为：既有接受的交互工件负责可见形态/文案/surface/动作/布局；既有 IA
负责 sample member-registration 的不可见事实；wallpaper requirements/design 负责
wallpaper 的可见和失败语义；本计划和详设只负责归属、接口、删除与验证。如果计划、
详设、IA 对账工件和正本不一致，必须先标 OPEN，不能在施工中自行裁定。

## 2. 实施分母与旧代码不得残留总账

### 2.1 变更分母

| 范围 | 当前字节分母 | 实施后要求 |
| --- | --- | --- |
| sample-member-desk | 9 个 logical part、18 个 paired renderer、9 个无后缀 wrapper、MemberRow | 9 个 part 每个由 laptop/mobile 目录的显式 renderer 注册；只保留 MemberRow 等真正 common |
| sample-staff-auth | 3 个 logical part、6 个 paired renderer、3 个无后缀 wrapper、StaffLoginPasscodeInput | 3 个 part 每个由 laptop/mobile 目录的显式 renderer 注册；只保留 passcode 等真正 common |
| sample-wallpaper-picker | 2 个 logical part、4 个 paired renderer、2 个无后缀 wrapper、WallpaperBackground | 2 个 part 每个由 laptop/mobile 目录的显式 renderer 注册；WallpaperBackground 仍是 common feature component |
| 三个 feature 共计 | 14 logical、28 paired、14 wrapper、3 common | 14 logical、28 显式双端 renderer、0 兼容 wrapper、3 经过复核的 common |
| sample-console 与 sample-wallpaper-console | 各有本地 surface parser/startup/state-sync 重复机制 | generic mechanism 进入 ui-base-console-assembly；integration 只留 package-specific adapter 和业务 assembly |

### 2.2 强制删除 ledger

以下项目不是“逐步兼容”，而是实施完成时必须不存在。迁移过程中若需要先创建新文件，
也必须在同一 CP 内删除旧文件并做负向扫描；不能提交中间状态作为完成状态。

| 旧结构 | 预期处置 | 完成判据 |
| --- | --- | --- |
| 三个 feature 下 14 个无后缀 wrapper | 删除 | find 只剩目录 renderer；无 wrapper export/import |
| member 的 18 个 *Laptop.tsx/*Mobile.tsx | 移入 components/laptop 或 components/mobile 并去掉后缀 | 旧 suffix 路径不存在；新路径各有一份实现 |
| staff-auth 的 6 个 *Laptop.tsx/*Mobile.tsx | 同上 | 旧 suffix 路径不存在 |
| wallpaper-picker 的 4 个 *Laptop.tsx/*Mobile.tsx | 同上 | 旧 suffix 路径不存在 |
| hooks/useMemberDesk.ts 聚合 9 hooks/types/copy | 拆为单职责 hook/types/foundation；旧聚合文件删除 | 文件不存在且旧符号无 import/export |
| hooks/useAuthNotices.ts 聚合 auth notice hooks/types/copy | 拆为单职责 hook/types/foundation；旧聚合文件删除 | 文件不存在且旧符号无 import/export |
| wallpaper 原聚合 hook 及重复 labels/phase/copy | hooks/useWallpaperPicker.ts 改写为只含 picker hook；system notice、catalog、copy 分离 | 旧聚合内容不再存在；同一事实只有一个 owner |
| createFormPart/createPart 等 feature-local part helper | definePartPair 迁移后删除 | 全仓不再引用旧 helper 名 |
| ComponentType<any> 兼容 part alias | typed pair registration 替换 | 目标 feature 下搜索不再命中 |
| sample-console 本地 parse/actor/reduce 重复实现 | 迁移为 base generic + 当前包 adapter | 本地只剩 adapter，旧 helper 定义不存在 |
| sample-wallpaper-console 同类 parser/startup/state-sync 重复实现 | 同上 | 本地只剩 adapter，旧 helper 定义不存在 |
| sample-wallpaper-console 的 WaitingLaptop/WelcomeLaptop 命名 | 移至 components/laptop/Waiting.tsx 与 Welcome.tsx | 旧 suffix 文件和旧 import 不存在；不新增 mobile 伪实现 |
| wallpaper ambiguous root exports 与重复 label 常量 | 只保留明确 feature public surface | 旧导出和重复常量无命中 |

“旧代码不得有残留”包含文件、符号、import/export、别名、重复常量、重复逻辑和
注释中指向旧入口的迁移残留；只删除旧文件而保留等价复制体不算关闭。若旧结构在
另一个包仍被引用，CP 必须保持 OPEN，不能把残留归因给“历史兼容”。

## 3. 实施顺序与每步动作

### CP-0：冻结字节分母与三维基线

目的：在任何写入前锁定当前文件、符号、可见记录和共享机制，避免“边改边数”。

动作：

1. 读取第 1 节全部输入，并用 exact source symbol 重新打开三个 feature、两个
   integration、ui-base-render、ui-base-console-assembly 及其测试；
2. 生成 CP-0 working ledger：每一行包含旧路径、旧导出/符号、消费者、目标路径、
   owner、可见 IA/interaction 记录和删除判据；
3. 对 20 条 IA/preservation 记录逐条标记 control、copy、action、surface、
   failure、scroll ancestor、accessibility/testID 的 baseline；
4. 对 14 logical part 逐一建立 partKey 到 laptop/mobile renderer 的 mapping；
5. 对重复 parser/startup/state-sync 记录 function body、consumer 和必须留在
   integration 的 package-specific 参数；
6. 确认不需要新增依赖；若实现前检查发现现有依赖不足，不自行扩大范围，先标 OPEN
   并向 Dexter 请求决策。

CP-0 gate：

- MATCHED：每个分母项均有唯一旧路径、唯一目标路径和删除/保留判据；
- OPEN：存在未识别消费者、未决定 owner 或 IA/源码事实冲突；
- 必须由 fresh 独立子 agent 按需求、详设、项目记忆做逐项三维审查后才能进入 CP-1。

### CP-1：feature 目录归位与 hook 拆分

目的：先消除最直接的阅读歧义，但不改变业务逻辑。

目标目录与文件：

| 包 | laptop 目录 | mobile 目录 | common 保留/新增 |
| --- | --- | --- | --- |
| sample-member-desk | components/laptop/MemberList.tsx、MemberForm.tsx、WaitingConfirm.tsx、RegistryNotice.tsx、DiscardConfirm.tsx、WithdrawConfirm.tsx、CustomerWelcome.tsx、CustomerMember.tsx、DeskSystemNotice.tsx | components/mobile/ 同名九文件 | components/MemberRow.tsx；hooks/useMemberList.ts、useMemberForm.ts、useWaitingConfirm.ts、useRegistryNotice.ts、useDiscardConfirm.ts、useWithdrawConfirm.ts、useCustomerWelcome.ts、useCustomerMember.ts、useDeskSystemNotice.ts；types/customerMember.ts；foundations/registryNoticeCopy.ts |
| sample-staff-auth | components/laptop/StaffLogin.tsx、AuthNotice.tsx、AuthSystemNotice.tsx | components/mobile/ 同名三文件 | components/StaffLoginPasscodeInput.tsx；hooks/useStaffLogin.ts、useAuthNotice.ts、useAuthSystemNotice.ts；types/authNotice.ts、types/authSystemNotice.ts；foundations/authNoticeCopy.ts |
| sample-wallpaper-picker | components/laptop/WallpaperPicker.tsx、WallpaperSystemNotice.tsx | components/mobile/ 同名二文件 | components/WallpaperBackground.tsx；hooks/useWallpaperPicker.ts、useWallpaperSystemNotice.ts；foundations/wallpaperSystemCopy.ts、wallpaperCatalog.ts |

执行规则：

- 同一个 logical part 的 laptop/mobile renderer 可以共享 hook 和 typed props，但不能
  合成一个运行时根据 surface 自动切换的 UI 文件；
- 旧 renderer 文件移动后必须去掉 Laptop/Mobile 后缀；不是复制后保留旧文件；
- 无后缀 wrapper 直接删除，assembly/registry 改为明确导入 laptop/mobile；
- member 的 CustomerMember 三种 mode 仍是一个 part，mode 由 existing props
  传入，不新增 partKey；
- wallpaper 的 hooks/useWallpaperPicker.ts 路径可以保留，但必须原地重写为只含单一
  picker hook；这不是保留旧聚合实现。system notice、catalog、copy 不得继续混在其中；
- hook 只处理本来属于该业务的 selector、command、request outcome 和 failure
  policy，不把 JSX 或跨业务文案塞入 hook；
- 每完成一个 package，先运行该包的静态 import/路径审查和 focused tests，再进入
  下一个 package；当前计划阶段不执行这些命令。

CP-1 gate：

- old ledger 中 feature 旧文件、wrapper、聚合 hook 和 alias 全部达到删除判据；
- renderer 目录和 import 没有 suffix/默认 laptop 入口；
- hook 的 selector、command、rejection policy 与 baseline 逐项一致；
- fresh 独立子 agent 完成三维对账；任何 OPEN 先修复再进入 CP-2。

### CP-2：ui-base-render 机械能力与 notice 呈现归位

目的：抽取双端 part 注册和请求生命周期的机械重复，保留业务 owner。

新增或修改：

| 路径 | 动作 | owner 边界 |
| --- | --- | --- |
| apps/terminal/ui/base/render/src/foundations/definePart.ts | 增加 typed definePartPair；保留原 definePart 直到所有消费者迁移后删除未用旧 helper | 只负责 laptop/mobile sibling 形态和 part metadata，不选择业务 surface |
| apps/terminal/ui/base/render/src/hooks/useTrackedCommand.ts | 基于既有 useTrackedRequest/useRequestInFlight/dispatchWithRequestId/classifyRequestResult 组合单一 runner | 只负责 requestId、busy、outcome/rejection policy；不拥有业务事实、文案或 command |
| apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx | 扩展中性的 presentation/layout props | 只负责通用 notice 壳；不接 feature name、laptop/mobile 分支或业务 copy |
| apps/terminal/ui/base/render/test/* | 为 definePartPair、runner 和 presentation contract 增 focused tests | 测试机械契约，不替代 feature business assertions |

SystemFailureNotice 的 presentation public type 在实施前不得临场设计，固定为
SystemFailureNoticePresentation：

- rootStyle?: StyleProp<ViewStyle>
- cardStyle?: StyleProp<ViewStyle>
- actionsOrientation?: 'row' | 'column'
- dismissButtonStyle?: StyleProp<ViewStyle>

StyleProp/ViewStyle 直接复用现有 primitive/react-native 类型；不增加任意 props spread、
actionsStyle、token override、children-owned layout 或可变 presentation map。六个 feature
system notice renderer 的 profile 必须逐行保持：

| renderer | root padding/align | card | actions | dismiss button |
| --- | --- | --- | --- | --- |
| member DeskSystemNoticeLaptop、auth AuthSystemNoticeLaptop、wallpaper WallpaperSystemNoticeLaptop | flex:1、minHeight:0、padding:24 | width:100%、maxWidth:720 | row | 不传 style |
| member DeskSystemNoticeMobile、auth AuthSystemNoticeMobile、wallpaper WallpaperSystemNoticeMobile | flex:1、minHeight:0、padding:16、alignItems:stretch | width:100% | column | width:100% |

实现细则：

1. definePartPair 的输出必须显式包含 partKey、laptop renderer、mobile renderer
   和原有 metadata；不得提供“自动从一个 component 生成另一端”的 fallback；
2. runner 的精确调用形态固定为
   run({definition: CommandDefinition<TPayload>, payload: TPayload, routeIntent?,
   onOutcome?, onRejected?, rejectionPolicy})；definition 直接是现有 runtime
   CommandDefinition，不新增 execute 或 requestLabel 字段。若诊断需要标签，只能另
   作为中性的 diagnosticsLabel 传入，不能伪装成 command definition；feature hook
   仍决定 command、payload、success transition、业务错误和 dismiss/close 语义；
3. runner 对 RETHROW 与 CONSUME 的处理必须保持 auth/member/wallpaper 当前差异；
   wallpaper 的 actionInFlight 也必须由 feature hook 保持，不由 base 猜测；
4. SystemFailureNotice 只增加中性尺寸、布局、container、testID 连接所需的 props；
   不改已有默认视觉 token、role、copy 或 focus 语义；
5. 若现有 base primitive 的 props 不能表达两个实际消费者的布局差异，保留 feature
   renderer 的薄壳，不把业务 layout 塞进 base。

CP-2 gate：

- base 包没有 import 三个 feature；
- typed pair、runner、notice 的 focused tests 能在故意删掉关键契约时失败；
- base public export 和 terminal-invariants 只增加已批准能力，不残留旧 helper；
- fresh 独立三维审查通过后才能让 feature 使用新 API。

### CP-3：feature parts、业务行为和 public surface 收口

目的：让新目录真正成为唯一生产入口，而不是只改文件位置。

动作：

1. 用 definePartPair 为 14 个 logical part 建立显式 sibling registration；
2. 删除 ComponentType<any>、旧 part aliases、createFormPart、createPart
   等兼容路径；使用已有 typed props 和 part metadata；
3. 将 member registry notice copy 与 customer member mode 类型放在 feature foundations/types；
4. 将 staff auth notice copy/types 分开，保留 login hook 的 auth-specific
   clear-password、success/failed transition 和 notice policy；
5. 将 wallpaper catalog、system notice copy、picker hook、system notice hook 分开；
   WallpaperBackground 和 Picker 不得各自维护一份 wallpaper option/label；
6. 重新收口每个包的 public exports：只导出 assembly 真实需要的 part、common
   component、hook contract 和 types；不暴露旧路径、旧 wrapper 或重复常量；
7. 删除和修正所有 imports，确保 tests、adminLayout、assembly 和 package entry
   指向新目录。

CP-3 gate：

- 14 个 part 都有唯一的 partKey 和两个显式 renderer；
- no-residual ledger 的 feature 项全部达到删除判据；
- business facts remain in feature owner，base 只有 mechanics；
- focused tests 对 auth/member/wallpaper 的失败与恢复边界仍然独立断言；
- fresh 独立三维审查完成后才能进入 integration。

### CP-4：integration 机制归位

目的：减少业务 integration 的样板，但不把 package-specific 事实抽走。

新增或修改：

| 路径 | 动作 | 必须留在 integration 的内容 |
| --- | --- | --- |
| apps/terminal/ui/base/console-assembly/src/foundations/terminalSurfaces.ts | 提供 generic display/surface parser 和 typed result | package.json 的字段名、errorPrefix、实际 fallback copy |
| apps/terminal/ui/base/console-assembly/src/foundations/startupReady.ts | 提供 startup payload/ready actor 的机械构造 | 当前 assembly 的启动时机、actor owner、package-specific logging |
| apps/terminal/ui/base/console-assembly/src/foundations/stateSyncSlices.ts | 提供显式 slice/filter 的通用组合 | integration 的具体 slice 集合和业务 state source |
| apps/terminal/ui/integration/sample-console/* | 删除三类重复实现，保留 adapter、assembly、业务 part/import | sample-console 主题/配置、part wiring、业务 command |
| apps/terminal/ui/integration/sample-wallpaper-console/* | 同上，并把 Waiting/Welcome 改为 laptop 目录命名 | wallpaper asset、SECONDARY owner、laptop-only surface |

执行规则：

- generic base 不读取任意 package.json，不扫描文件系统，不自行决定 fallback，不读取
  sample state；
- adapter 是 package-specific 的唯一边界：它把包配置和业务 assembly 转成 base
  输入，但不复制 parser/startup/reducer 的实现；
- sample-wallpaper-console 不增加 mobile Waiting/Welcome，因为其 IA preservation
  记录明确是 laptop-only SECONDARY；
- 对照当前字节发现的两个 parser、两个 startup actor、两个 state-sync reduce
  不能接受历史文档“只有一处 parser”的说法；以源码当前重复为分母，迁移后二者均
  只剩一个 base 机制加两个 adapter。

CP-4 gate：

- 两个 integration 的 duplicate helper 定义全部消失；
- package-specific config、theme、asset、owner 和 placement 仍在原包；
- assembly startup 和 sync focused tests 覆盖既有 ready/fallback/error 结果；
- fresh 独立三维审查完成后才能进入 CP-5。

### CP-5：收口、全批对账和交付前证据

目的：把删除残留、公开 surface、文档和测试一起收口。

动作顺序：

1. 同步 README、package exports、terminal-invariants、import path 和测试 fixture；
2. 对 20 条 IA/preservation record 重新逐条回源；
3. 对 14 logical part、28 renderer、3 common component、两个 integration adapter
   做完整 mapping；
4. 执行旧代码不得残留的全局 negative scan；
5. 执行 focused/typecheck/static verification；
6. 执行本计划第 4 节的逐代码与详设对账；
7. 最后由 fresh 独立子 agent 做整批三维审查，确认没有把阶段性迁移残留留到后续；
8. 只在本地静态/focused 结果关闭后，另行申请后续 Web/Android/native/device/
   visual 验证；本计划交付不把这些结果填成 PASS。

## 4. 逐代码与详设对账闸门（必须执行，不得省略）

这是 CP-5 的硬闸门，也是实施计划的完成定义之一。对每一个实际变更点，主 agent
必须重新打开：

- 对应需求条目；
- IA 对账工件和它指向的视觉/交互正本；
- implementation-facing 详设对应章节；
- 六维路由命中的项目记忆与前端编码规范；
- 变更点的 owning source 和当前可复用 API。

然后按以下字段记录，每行只能是 MATCHED 或 OPEN：

| 维度 | 必查内容 |
| --- | --- |
| 语义 | partKey、journey task、actor、状态是否存在、文案、动作、不可见项是否误显示 |
| 视觉 | 位置、尺寸、形状、颜色 token、图标、字体、背景、层级、gap、双端差异 |
| 实现 | owner、数据来源、shared props、订阅边界、requestId、failure/rejection policy |
| 业务 | current/non-current surface、mode、失败/恢复、拓扑/端口等既有规则未被改写 |

额外必须逐控件核对：testID 存在不能代替形态核对；busy、error、empty、disabled、
close/dismiss、clear-password 和 wallpaper write failure 必须独立成行。发现旧代码残留、
第二份事实、默认 laptop 入口或 base 反向依赖 feature，立即标 OPEN 并回到对应 CP。

## 5. 测试与静态验证映射

本节是未来实施步骤，不是当前回合执行授权。

| 目标 | 现有验证位置/计划动作 | 必须证明 |
| --- | --- | --- |
| definePartPair | apps/terminal/ui/base/render/test/catalog.test.ts 或新增同 owner focused test | laptop/mobile sibling 显式注册；无自动 fallback |
| tracked command | apps/terminal/ui/base/render/test/requestSupport.test.ts 或新增同 owner focused test | requestId、busy、success、RETHROW/CONSUME、finally 语义 |
| notice presentation | apps/terminal/ui/base/render/test/renderProps.test.tsx 或新增同 owner focused test | props 只改变中性呈现，role/copy/action 不漂移 |
| member | apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx | 9 part、列表/表单/等待/registry/discard/withdraw/customer mode 和失败边界 |
| staff auth | apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts | login、notice、system notice、clear-password 和双端 registry |
| wallpaper | apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts；sampleWallpaperPicker.test.tsx；publicSurface.test.ts | catalog 单一 owner、write phase/rejection、background/picker public surface |
| sample console | apps/terminal/ui/integration/sample-console/test/terminalSurfaces.test.ts；packageSurface.test.ts；sampleAssembly.test.tsx | adapter、ready、fallback、state sync、assembly wiring |
| wallpaper console | apps/terminal/ui/integration/sample-wallpaper-console/test/terminalSurfaces.test.ts；sample2Assembly.test.tsx | laptop-only Waiting/Welcome、surface config、startup/sync |
| admin layout imports | apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts | 新 part entry 可解析，旧路径不再存在 |
| invariant/public surface | 各包 terminal-invariants 及 package entry tests | export/partKey/renderer denominator 没有缩水 |

未来实施命令必须遵循仓库现有 workspace 入口和脚本 README，先 focused，再包级
typecheck，再需要时静态全量；不因本计划直接启动 runtime。任何失败保留 first
failure、last known good、broken boundary、business 与 cleanup 分栏；不能用延长
timeout 或重复等待掩盖。

## 6. 旧代码残留的机械判据

实施完成后必须针对当前 worktree 执行以下等价检查；具体命令须按仓库脚本约定运行，
但判据不可降低：

1. 旧 wrapper 文件清单为空：三个 feature 根 components 下无 14 个无后缀 wrapper；
2. 旧 suffix 文件清单为空：member 18、staff 6、wallpaper 4 的旧 Laptop/Mobile
   文件路径均不存在；
3. 聚合 hook 清单为空：旧 member desk、auth notices、wallpaper 聚合内容均不存在；
4. 旧 helper 符号清单为空：createFormPart、createPart、ComponentType<any>、旧
   alias、旧 ambiguous wallpaper export 均无生产代码命中；
5. integration duplicate 定义清单为空：两个 package 不得各自定义 parser、
   startup-ready actor 或 state-sync reducer；
6. 旧命名清单为空：sample-wallpaper-console 的 WaitingLaptop、WelcomeLaptop
   文件/import 不存在；新命名只能位于 laptop 目录；
7. 重复事实清单为空：wallpaper labels/catalog、notice copy、request lifecycle
   mechanical code 不得有第二份等价定义；
8. import closure 清单为空：任何生产代码、测试、README、package entry 都不得
   引用旧路径；找不到旧文件不是唯一判据，旧字符串/别名也必须没有命中。

任何一项命中即 CP-5 OPEN。不能通过新增注释说明、deprecated export、fallback
wrapper、re-export 或 test-only alias 来掩盖残留；如果确有外部消费者，先停止并
把消费者、owner 和最小替代交 Dexter。

## 7. 失败、停止和恢复规则

- IA/需求/源码事实冲突：停止当前 CP，记录 first failure、冲突字节、last known
  good、broken boundary，交 Dexter，不在 admin-shell 或 base 侧猜测。
- owner 不清或 base 需要了解 sample 业务：停止抽取，保留 feature-local 实现。
- 删除旧入口后仍有消费者：不加兼容层；标 OPEN，查全量引用并重新决定迁移顺序。
- focused 测试失败：先读日志和失败边界；同一 signal 第二次尝试前完成根因诊断。
- typecheck 失败：保留失败，不以 as any、旧 alias 或 fallback 绕过。
- 发现行为/视觉改变：回滚当前 CP 的未收口迁移或修复最小 owner，不继续进入下一 CP。
- 资源/构建产物增长：本计划不执行清理命令；后续运行必须按受管 manifest 验证所有权，
 只清理当前 run 明确拥有的产物，不能删除用户或历史未知产物。
- 当前回合没有动态授权，因此所有 dynamic/Web/Android/native/device/visual/cleanup
  均为 NOT_AUTHORIZED，不得写成未测试后 PASS。

## 8. 三维对账与独立审查排程

### CP 内审查

CP-0、CP-1、CP-2、CP-3、CP-4 各自结束后，由 fresh 独立只读子 agent 对当前步骤
逐点比较需求、详设、项目记忆三维；主 agent 只接收 findings，主 agent 自己改文件。
该步骤审查不产生整批 GO/NO-GO，但所有 OPEN 必须在进入下一 CP 前关闭或按停止规则
交 Dexter。

### 全批审查

CP-5 结束后，先完成一次主 agent 全批三维对账，再执行未来的 implementation
REVIEW_TARGET=IMPLEMENTATION。该实现复核必须重新读取真实源码和真实 evidence，不能
以“按本详设实施”替代。当前文档任务只执行下面的两轮 DESIGN review；不把它们
冒充实施复核。

### 本轮两次 DESIGN review

| 轮次 | reviewer | 输入 | 限制 |
| --- | --- | --- | --- |
| Round 1 | fresh 独立只读子 agent | 需求、IA、详设、计划、正本、源码和项目记忆 | 先证伪后对照；输出 finding、分类和 M/S/N |
| Round 2 | 另一 fresh 独立只读子 agent | Round 1 report/intake、当前全部文档、关键源码和项目记忆 | 定向核验修订点；声明 ROUND_FINAL_DECISION=SELF_DECIDED |

REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922 的 DESIGN review 最多两轮。
不得用换文件名、换 reviewer 或局部重写重置轮次；第二轮后若仍有 design finding，
只能记录 NO-GO 或交 Dexter 产品决策，不能召集第三轮。

## 9. 本轮交付工件

本轮完成后应存在：

- doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-inputs-round1-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round1-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-intake-round1-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-inputs-round2-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round2-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-closure-codex.md

交付状态必须分别报告：

| 类别 | 当前本轮状态 |
| --- | --- |
| 详设与计划 | 本轮文档完成后才可声明 READY_FOR_IMPLEMENTATION_REVIEW |
| 源码 | NOT_CHANGED |
| 测试/依赖/脚本/构建产物 | NOT_CHANGED |
| static/focused/typecheck | NOT_RUN；计划中有映射 |
| Web/Android/native/device/visual/DEV/L2/UAT | NOT_AUTHORIZED、NOT_RUN |
| cleanup | NOT_AUTHORIZED、NOT_RUN |
| 旧代码残留 | 本轮只审查计划和判据，不能宣称关闭；实施后必须以 negative scan 关闭 |

两轮 DESIGN review 的 verdict、M/S/N、finding disposition 必须写入对应 review
工件；如果第二轮结束后作者仍有未验证修订，closure 必须如实写明 OPEN，不得将
设计 review 结果写成 implementation PASS。
