# TER UI 包职责与公共导出边界需求 · 独立评审（Claude）

```text
REVIEW_TARGET=DESIGN（需求）
VERDICT=NO-GO
M/S/N=0/3/2
```

```text
EVIDENCE_TIER=STATIC_SOURCE_READBACK（未运行任何构建/测试/设备命令）
SESSION=CONTINUED_SESSION（全部断言按当前字节重取，不采信需求稿自述）
WRITES=仅本文件
AUTHORITY=只评审需求稿；GO 也不授权改源码、测试、依赖、脚本、构建产物、详设、实施计划或删除任何 public export
```

## 1. 方案合理性

**问题对不对**：对。多层 `export` 被当成"重复导出"、root API 缺少消费者归因，这是真实的认知成本；§3.1 把
"内部模块 export / assembly 聚合 / 包根 index / package export map"四层分开，是正确的问题切分。

**方案优不优**：把判据从"`export` 关键字数量"换成"同一能力有几个包外入口、每个入口谁在消费"，是对的换算。
R-6 要求抽到 base 必须有至少两个真实消费者、不携带 sample 业务知识，也守住了"不为消除相似而造抽象"。

**代价配不配**：需求阶段只要求归因、不要求删除，代价低。但本稿与既有可读性实施计划高度重叠（见 S-2）。
我的推荐是：**作为既有 CP-3/CP-5 public-surface 收口的澄清并入**，并用本稿"仓内零命中不等于可删"的
原则覆盖旧计划的零命中判据；另立范围会产生两套互相冲突的收口规则。最终由 Dexter 在 §7 Q5 裁定。

**UI 强制自问**：`NOT_APPLICABLE`。本稿是包职责与导出边界，不定义用户可见界面或 Journey；唯一触及
用户可见内容的是 MemberForm 探针，已在 S-1 处理。

## 2. 核实成立的事实

- **§3.2 三个 feature 的 assembly 形态**：三者都用 `createFeatureAssembly`，都附加 `layerDismissals`；
  staff-auth 另把 `variables` 传入 `createFeatureAssembly`（`sample-staff-auth/src/assembly/assembly.ts:14-18`）。
- **member-desk 与 staff-auth 的根导出**：只有依赖名、`moduleName`/`moduleKind`、assembly 及其类型
  （两个 `src/index.ts:1-5`），不暴露 `parts` 与 module factory。
- **R-4 的"等价 module factory"前提成立**，我专门核了，因为两个符号名字不同：根导出的
  `createSampleWallpaperPickerModule` 是
  `() => createFeatureAssemblyModule(createSampleWallpaperPickerModuleInput())`
  （`sample-wallpaper-picker/src/application/module.ts:30`）；assembly 的 `createModule` 是
  `() => createFeatureAssemblyModule(input.createModule())`（`ui/base/feature-assembly/src/index.ts:109`），
  而 `input.createModule` 正是 `createSampleWallpaperPickerModuleInput`（wallpaper `assembly.ts:12`）。
  两条路径完全相同；`parts` 是同一对象引用。所以二者确是重复访问路径。
- **§3.3 integration 与宿主接线**：`createSurfaceForDisplayIndex` 在两个 integration 都是
  `ui-base-console-assembly` 同名能力的显式别名（`sample-console/src/assembly/assembly.tsx:52`、
  `sample-wallpaper-console/src/assembly/assembly.tsx:31`）；两者都调用 `createConsoleAssembly`。
  Android 宿主不消费 `create*Module`、`createSampleDefinedParts`、`startupReadyCommand`、`parts`/单项 part
  或 parser helper——我读了两个 `App.tsx` 与 `platformPorts.ts` 的**完整多行 import 块**确认。
- **§3.4 dismissal helper**：三份都接收注入的 `dispatchCommand`，调用 base 的 `dispatchWithRequestId`，
  只是绑定各自 feature 的 dismissed command；command identity 留在 feature 是对的。
- **§8 publicSurface 测试分布**：三个 feature 中只有 wallpaper-picker 有；两个 integration 都有。属实。
- **仓外消费者保持 OPEN**：R-4、§5、§6 与 §8 末段都守住了"仓内未引用不等于可删"，没有任何删除建议。

## 3. Findings

### S-1 · MemberForm 探针的产品意图已有正本记录，需求稿称"现有字节不足以判断"不成立 · CONFIRMED

**需求稿**：§3.4 第 87 行称两个键盘探针"可能是 sample 应用的能力，也可能与会员登记职责混杂；
现有字节不足以判断产品意图"。

**正本已有记录**：`doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
第 8 行的 SCOPE 写明"alpha/financial 由 sample 会员资料中的受控能力验证字段消费"；第 44-45 行的
消费者表把 alpha 映射到"MemberForm 内受控的 sample-only 英文字符测试字段"、financial 映射到
"金额格式测试字段"，并注明"本需求新增的 sample 能力验证点；字段不进入 Member、PendingMember
或 submitMemberCommand"；第 48-49 行说明目的是"让四种布局都有可操作、可寻址的真实消费者"；
第 54-55 行冻结区域标题与字段文案；第 62 行冻结 fieldId/testID。

**代码与之逐字一致**：`sample-member-desk/src/components/laptop/MemberForm.tsx:25-30` 与
`components/mobile/MemberForm.tsx:25-30` 的文案就是"英文字符测试（仅 sample）""金额格式测试
（仅 sample）"和"不保存到会员资料"。

**影响**：这两个探针是 alpha、financial 两种键盘布局**唯一**的真实消费者。若 Dexter 基于"意图不明"
裁定迁移或删除，会让键盘批的动态验证入口失效——键盘详设 §6.2 规定 Web 与 Android 都从 MemberForm
alpha probe 进入。这是跨批回归，而触发它的是一个不成立的前提。

**最小修订**：§3.4 改写为引用键盘需求 v2 的既定来由，把开放问题从"意图不明"收窄为"v2 的既定意图
在包职责重整后是否仍然成立"，并写明跨批依赖。**需 Dexter 裁决**：仅当要改变 v2 已定意图时。

### S-2 · 与既有可读性实施计划对同一批 wallpaper 导出给出冲突的删除判据 · CONFIRMED

**既有计划**（`doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md`）：
第 97 行"wallpaper ambiguous root exports 与重复 label 常量｜只保留明确 feature public surface｜
**旧导出和重复常量无命中**"；第 231 行 CP-3"重新收口每个包的 public exports：只导出 assembly 真实
需要的 part…"；第 350 行"旧 ambiguous wallpaper export 均**无生产代码命中**"。

**本稿**：R-4 第 113 行"不得用'目前仓内没搜到'证明外部 API 可直接删除"；§5 与 §6 第 148 行要求
未查清的仓外消费者保持明确 OPEN。

**冲突**：两份文档对同一批符号给出互斥规则——旧计划以"仓内零命中"为完成判据，本稿明确禁止以零命中
作为删除依据。本稿 §1 第 17 行只概括提到"既有实施计划已要求收口 public surface"，§7 Q5 只问"并入
CP-5 还是另立范围"，都没有把这条具体冲突摆出来。

**当前字节的旁证**：`parts` 与 `createSampleWallpaperPickerModule` 仍在 wallpaper-picker 根导出。
说明旧计划第 97 行要么尚未执行、要么执行时决定保留；无论哪种，本稿都应说明它与该项的关系。

**最小修订**：在 §1 或 §7 Q5 明确写出"本稿收窄旧计划第 97、231、350 行的零命中删除判据"，由 Dexter
在 Q5 中一并裁定哪条规则生效。**需 Dexter 裁决**：是（Q5 本就交给他，只需把冲突点摆上桌）。

### S-3 · package export map 的唯一子路径未入清单，且当前已与 invariants 不一致 · CONFIRMED

**事实**：五个目标包的 `package.json` exports 中，只有两个 integration 有非根条目：
`{".": "./src/index.ts", "./theme/global.css": "./theme/global.css"}`。Android 宿主实际消费它——
`assembly/android/sample-terminal/App.tsx:1` 与 `sample-wallpaper-terminal/App.tsx:1` 都
`import '…/theme/global.css'`，Android `metro.config.js` 的 `globalCssPath` 也指向它。而两个
integration 的 `terminal-invariants.json` 中 `global.css`/`theme/` 的出现次数均为 **0**。

**与需求稿的关系**：§3.1 第 63 行正确定义了 export map 这一层；R-3 第 109 行要求"`package.json`
export map、root index、`terminal-invariants` 和 exact-set test 表达同一 public contract"。但 §3.3 的
integration 盘点只覆盖 `src/index.ts`，没有这个子路径——所以 R-3 按当前字节**已经不成立**，而本稿没有
发现。

**同族**：Android 宿主还从 integration 消费 `moduleName`（两个 `src/dependencies.ts:3`），§3.3 第 79 行
"核心接口是 assembly factory、`createSurfaceForDisplayIndex` 与相应类型"也漏了它。

**影响**：若按 R-5 只看 root index 去收窄 integration 公共面，CSS 子路径完全不在视野里——而它恰恰是
Android 主题接线的载体。

**最小修订**：§3.3 写全 Android 宿主从每个 integration 的完整消费集（含 CSS 子路径与 `moduleName`）；
R-3 明确"非根 export-map 子路径与 root index 同属 public contract，须同样有消费者归因并进 invariants"。

### N-1 · wallpaper-picker 根导出只归因了 2 项

`sample-wallpaper-picker/src/index.ts:1-15` 共十余项根导出。我在 `apps/terminal/ui` 与 `assembly` 下
（排除本包 src）扫描仓内消费者：
- 跨包**生产**消费者只有 `WallpaperBackground`（wallpaper integration `assembly.tsx`）；
- `wallpaperPickerTestIds` 有跨包**测试**消费者（integration `test/sample2Assembly.test.tsx`）；
- `assetsById`、`confirmWallpaperRequestedCommand`、`wallpaperOptionSelectedCommand`、
  `wallpaperOptionTestId`、`createSampleWallpaperPickerModule` 只有本包测试消费；
- `WallpaperPickerCommandPayload` 仓内没有任何消费者。

本稿对 integration 用了 R-5 的四类归因（§3.3 第 79 行），对 wallpaper-picker 只做了"与 assembly 重叠"
的两项，分母不对称。这**不**意味着其余应删——仓外消费者未知的限定语同样适用，其中两个 command 也可能
属于受支持的业务契约。**最小修订**：§3.2 补一张 wallpaper-picker 全量根导出的消费者分类，口径与 §3.3 一致。

### N-2 · dismissal helper 的 TR-06 问题，标准里已有同形先例，可以把开放问题收窄

`doc/platform/terminal-coding-standard.md` 的 TR-01 反例正是"`reduceServerMessage.ts` —— foundation
接收 `dispatchAction` 形参并在内部调用"，判为违规，理由是"写入点散到 foundation，ledger 里看不到这次
写入对应哪条命令"。三份 dismissal helper 是同一形状：接收注入的 dispatcher 并在内部调用。

但有一处实质差异：helper 派发的是 **command**，`dispatchWithRequestId` 本身就带 requestId 进 ledger，
所以 TR-01 的 ledger 理由不直接适用。适用的是 TR-06 末段"`foundations/` 下其余导出仍必须是纯函数"与
§7.1 目录表对 foundations"禁止有副作用的东西"——调用 helper 就会产生一次派发。TR-06 反例栏也写明
"需 review 判注入的依赖是否真抽象"，即标准把这一点明确交给评审。

所以 §3.4 与 R-9 的"待审查"是对的，只是可以写窄：问题不是"TR-06 允不允许注入"，而是"一个接收注入
dispatcher 并在内部触发派发的函数，是否属于 TR-06 所说的非纯导出"。一个纯的替代形态是 foundation 只
返回命令绑定，由 hook 或 renderer 调用点执行派发。**最小修订**：§3.4 引用这两处先例。需求阶段不冻结
移动方案，这一点本稿的处理是对的。

## 4. 结论

`VERDICT=NO-GO`，`M/S/N=0/3/2`。

本稿的判据方向正确、边界意识很好：四层导出分清了，仓外消费者一律保持 OPEN，没有任何"零命中即删"的
建议，也没有越权冻结详设。挡住 GO 的是三处会让 Dexter 在**不完整或错误的前提上**做裁定的问题：探针
意图其实有正本（S-1）；与既有计划对同一批导出的删除判据相冲突却未点明（S-2）；export map 这一层定义了
却没盘点，R-3 的一致性要求按当前字节已经不成立（S-3）。三处都只需修订文字，不需要新的产品决策——
S-2 的规则选择本来就在 Q5 里交给 Dexter。

本结论只覆盖需求稿；不授权改源码、测试、依赖、脚本、构建产物、详设、实施计划，也不授权删除任何
public export。是否进入下一阶段由 Dexter 决定。
