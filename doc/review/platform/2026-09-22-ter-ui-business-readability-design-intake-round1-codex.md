# TER UI 业务包可读性重构 · Round 1 finding intake

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_ROUND=1
reviewerKind=AUTHOR_INTAKE
SOURCE_REVIEW=doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round1-codex.md
INTAKE_STATUS=REPAIRED_FOR_ROUND_2
IMPLEMENTATION_AUTHORITY=false

## 1. Intake 边界

Round 1 是 fresh 独立 reviewer 的输入，不是作者 verdict。主 agent 重新打开 reviewer
指出的 owning source、需求、IA 对账、详设、计划和相关规范后，逐条判断为
CONFIRMED、PARTIALLY_CONFIRMED 或 REJECTED_WITH_EVIDENCE，再只修文档，不改源码/
测试/依赖/脚本/构建产物，不启动 runtime。

## 2. Finding 1：tracked command API

分类：CONFIRMED；严重度 M；处置：REPAIRED。

回源材料：

- apps/terminal/kernel/base/runtime/src/types/command.ts
- apps/terminal/ui/base/render/src/hooks/useRequest.ts
- apps/terminal/ui/base/render/src/foundations/dispatchWithRequestId.ts
- apps/terminal/ui/base/render/src/foundations/requestOutcome.ts
- apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts
- apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberDesk.ts
- apps/terminal/ui/feature/sample-wallpaper-picker/src/hooks/useWallpaperPicker.ts
- implementation-design §5.2
- implementation-plan CP-2

事实核验：

当前 CommandDefinition 只有 moduleName、commandName、visibility、timeoutMs、
allowNoActor、allowReentry、defaultTarget 和不可伪造 brand；没有 execute 或
requestLabel。三个 feature 现有 action 直接把真实 command definition、payload、requestId
交给 dispatchWithRequestId，再用 classifyRequestResult、useTrackedRequest 和
useRequestInFlight 处理状态。reviewer 对“计划文字会诱导实现者发明第二种 definition”
的判断成立。

最小修复：

- 详设 §5.2 将 run 精确冻结为
  run({definition: CommandDefinition<TPayload>, payload: TPayload, routeIntent?,
  onOutcome?, onRejected?, rejectionPolicy})；
- 明确 definition 复用 kernel runtime 的现有类型，不加 execute/requestLabel；
- 如需诊断标签，只允许独立中性的 diagnosticsLabel，不得伪装成 command definition；
- 计划 CP-2 同步采用同一精确 API；
- 保留 auth/member/wallpaper 各自的 operation、phase、route、clear-password、
  rethrow/consume 业务语义，不把这些移入 runner。

修复落点：

- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md §5.2
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md §3 CP-2

状态：MATCHED。源码没有被修改；Round 2 需要验证两份文档的 API 文字完全一致，且
diagnosticsLabel 不会变成隐式业务字段。

## 3. Finding 2：SystemFailureNotice presentation shape

分类：PARTIALLY_CONFIRMED；严重度 S；处置：REPAIRED。

回源材料：

- apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx
- apps/terminal/ui/base/primitives/src/types/types.ts
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeMobile.tsx
- apps/terminal/ui/feature/sample-staff-auth/src/components/AuthSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-staff-auth/src/components/AuthSystemNoticeMobile.tsx
- apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNoticeMobile.tsx
- implementation-design §5.3、§13
- implementation-plan CP-2

事实核验：

reviewer 指出的“当前 default notice 不足以直接表达六个 renderer 的 root/card/
actions/button 差异”成立；当前字节的 laptop profile 是 root padding 24、card width 100%
且 maxWidth 720、actions row、button 无额外 style，mobile profile 是 root padding 16
并 alignItems stretch、card width 100%、actions column、dismiss button width 100%。
因此原“中性 props”方向对，但未冻结形状的缺口确实存在。

最小修复选择 A：

SystemFailureNoticePresentation 只允许四项：

- rootStyle?: StyleProp<ViewStyle>
- cardStyle?: StyleProp<ViewStyle>
- actionsOrientation?: 'row' | 'column'
- dismissButtonStyle?: StyleProp<ViewStyle>

base 不提供任意 props spread、actionsStyle、token override、children-owned layout、
feature/laptop/mobile/operation/phase 字段。StyleProp/ViewStyle 复用既有 primitive/
react-native 类型。六个 renderer 的 profile 已在详设 §5.3 和计划 CP-2 表中逐组冻结。

修复落点：

- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md §5.3、§13
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md §3 CP-2

状态：MATCHED。源码没有被修改；Round 2 需要验证这四项不会扩大为 feature 业务 API，
且六个 renderer 的 copy、testID、dismiss action、role 和 layout profile 仍逐项保留。

## 4. Finding 3：分母真实性

分类：REJECTED_WITH_EVIDENCE；严重度 N；处置：不改。

回源核验：

- sample-member-desk 为 9 logical part、18 paired renderer、9 wrapper、MemberRow；
- sample-staff-auth 为 3 logical part、6 paired renderer、3 wrapper、
  StaffLoginPasscodeInput；
- sample-wallpaper-picker 为 2 logical part、4 paired renderer、2 wrapper、
  WallpaperBackground；
- 两个 integration 各有 terminal surface parser、startup-ready actor 和
  state-sync reduce 重复实现。

因此 14/28/14/3 分母是当前源码事实，不是只继承需求文档。历史 review 文案不作为
实施事实来源。

状态：MATCHED。

## 5. Intake 结论

Round 1 的 NO-GO 原因已逐条回源并完成最小文档修复。未发现需要改需求、IA、产品
Journey、登录、keyboard、power、admin-shell 或 runtime 语义的理由。Round 2 仅做
fresh 定向复核，不增加第三轮；若 Round 2 仍发现设计问题，按 review governance 如实
记录 NO-GO 或交 Dexter 决策，不把未决项写成 GO。

