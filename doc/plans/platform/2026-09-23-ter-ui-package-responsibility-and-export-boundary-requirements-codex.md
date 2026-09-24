# TER UI 包职责与公共导出边界再评估需求

DOCUMENT_KIND=REQUIREMENTS_REASSESSMENT
STATUS=REVISED_AFTER_CLAUDE_REQUIREMENTS_REVIEW_FOR_DESIGN_INPUT
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_20260923
REVIEW_ROUND_LIMIT=2
EVIDENCE_TIER=STATIC_SOURCE_READING
IMPLEMENTATION_AUTHORITY=false
DETAILED_DESIGN_AUTHORITY=true
IMPLEMENTATION_PLAN_AUTHORITY=true

## 1. 本轮目标与既有工作的关系

Dexter 已提出两项持续目标：双形态 UI 应按 laptop/mobile 分开实现、共用行为仍保持单一 owner；`terminal/ui/feature` 与 `terminal/ui/integration` 业务包应聚焦各自职责，可确认通用的机制复用 `ui/base`。随后对 `assembly.ts` 和多处导出提出疑问。本文件据此重新梳理包之间的关系，重点回答“哪些导出层是职责不同的边界，哪些只是同一能力的重复入口”。

仓内已有一组相关需求、IA 对账、详设和实施计划，并有已完成的 DESIGN cycle 与 CP-1/2/3 阶段 review 记录。本文件是**公共 API 与跨包职责的补充需求评估**，不修改、不撤销、不重开这些历史工件，也不把它们的阶段报告推定为当前整批完成状态。既有可读性实施计划 `2026-09-22-ter-ui-business-readability-implementation-plan-codex.md` 第 97、231、350 行已要求收口 public surface，并以旧模糊导出“无生产代码命中”作为收口检查；但这不是删除前的充分判据：仓内零命中不能证明仓外零消费者。旧计划第 360–362 行已有“确有外部消费者则停止交 Dexter”的保护，本稿将其前移成逐符号消费者归因与未知仓外消费者 OPEN 的准入条件，并覆盖旧计划第 97、231、350 行可能被误用为零命中即删的读法。当前 `sample-wallpaper-picker/src/index.ts` 仍根导出 `parts` 与 `createSampleWallpaperPickerModule`；仅凭当前字节无法判定旧计划该项尚未执行还是实施时有意保留。与原 CP-3/CP-5 合并还是另立范围，留待 Dexter 在详设 review 确认，不能让两个收口判据互相替代。

Dexter 已授权据本需求修订详设与实施计划；本轮不修改源码、测试、依赖、脚本或构建产物，不运行测试、构建、Web、Metro、Android/native/device 或动态验证。本文任何建议都不代表实施、公共兼容承诺或验收结论。

## 2. 应满足的职责关系

```text
kernel/feature
  拥有业务事实、领域命令与业务状态
          ↑ 被 UI feature 调用
ui/feature
  拥有具体交互旅途、feature actor、parts、双端 renderer 与 feature assembly
          ↑ 由应用组合
ui/integration
  选择并组合 kernel/UI feature、应用专属 parts/placement、运行身份与 surface 配置
          ↓ 复用
ui/base
  拥有跨消费者、无业务词汇的 UI/console/feature-assembly 机制
          ↑ 接入
assembly/android
  绑定平台端口并消费 integration 的应用装配接口
```

这不是“所有相似代码都要下沉”的分层图。每份事实应由唯一适合的 owner 持有；调用方向可以跨包，所有权不能因此转移。integration 是真实的可运行组合层，不是测试夹具；feature 也不是 integration 的薄文件夹。

### 2.1 各层应该回答的问题

| 层/文件边界 | 唯一主要职责 | 不应承担的职责 |
| --- | --- | --- |
| `kernel/feature` | 业务规则、持久事实、领域 command/actor | UI part、surface 形态、导航/提示意图 |
| `ui/feature` | 某个交互场景的 presentation、用户意图、feature actor、part 注册与本包组合接口 | 应用模块总表、平台端口绑定、别的 feature 的组合策略 |
| `ui/base` | 至少两个真实消费者共享的通用 UI/runtime 机制 | sample 业务词汇、app 配置、具体业务 command、partKey 或页面编排 |
| `ui/integration` | 一个应用的模块与 parts 选择、启动/布局/placement、surface/topology/sync 配置、console 组装 | kernel 业务规则副本、feature 内部实现、已存在的通用 console/render/input 机制副本 |
| `assembly/android` | Android 平台能力、native loading 与 integration 连接 | feature 组合策略或业务状态 |
| 包内 `src/index.ts` | 对包外消费者声明受支持的 package API | 充当所有内部模块的万能转发桶 |
| 包内 `src/assembly/assembly.ts[x]` | 把本层拥有的多项贡献组成一个完整、可供上层消费的装配对象/工厂 | 单纯复制 `index.ts` 导出、把下层所有内部符号重发成公共 API |

## 3. 源码关系核验与问题

### 3.1 多个“导出位置”不等于同一件事

目前源码中至少有四类不同边界：

1. 组件、parts、module 等定义文件的 `export` 供同包其他文件使用；
2. `src/assembly/assembly.ts[x]` 把 package 内部组合成 feature/integration assembly；
3. `src/index.ts` 决定哪些符号从 package 根路径可见；
4. `package.json` 的 `exports` 决定哪些 package path 可被外部解析；根路径与非根子路径（当前两个 integration 的 `./theme/global.css`）同属 public contract。当前 `terminal-invariants.json` 与 `publicSurface.test.ts` 只记录/核对 root API，CSS 子路径尚未进入 invariants，这是待修缺口。

所以 `parts/parts.ts`、`assembly.ts`、`index.ts` 都出现 `export` 本身不构成重复。需要问的是：**相同能力是否有多个包外入口、每个入口是否有独立消费者与独立语义**。TR-R02 允许 `index.ts` 作为显式模块边界 re-export；这不意味着 root index 应转发所有内部内容。

### 3.2 三个 feature 的职责现状

- 三个 feature 都通过 `ui-base-feature-assembly.createFeatureAssembly` 形成 assembly，且三者都在自己的 assembly 上附加 `layerDismissals`；staff-auth 另附加 `variables`。该对象把 feature parts 与 `createModule()` 聚为一份可供 integration 使用的组合契约。integration 目前消费 feature assembly，而不是分别自行寻找其全部内部实现。
- 当前双形态 renderer 已按 `components/laptop/` 与 `components/mobile/` 分区；机型无关组件放在 `components/`。例如 member 的 `MemberRow`、staff 的 `StaffLoginPasscodeInput`、wallpaper 的 `WallpaperBackground` 有明确共用/跨形态职责。此项是既有目标在当前源码中的形态，不因本文件再次发起批量搬移。
- `sample-member-desk` 与 `sample-staff-auth` 的 root `src/index.ts` 暴露 assembly 与包身份/依赖信息，未把 `parts` 数组或 module factory 另行暴露到 package root。
- `sample-wallpaper-picker/src/index.ts` 除 assembly 外，还把 `parts` 和 `createSampleWallpaperPickerModule` 单独暴露；同一 assembly 本身已经包含 `.parts` 与 `.createModule()`。其 README 指引 integration 使用 `sampleWallpaperPickerAssembly.parts` 与 `sampleWallpaperPickerAssembly.createModule()`；当前仓内 integration 生产导入也走 assembly。基于仓内可见消费者，这两项是已确认的**重复访问路径候选**；仓外消费者是否存在尚未由源码检索证明，因此现在不能把“应删除”当成已裁决事实。
- wallpaper-picker 的完整 root 符号分母是：`dependencyModuleNames`、`devDependencyModuleNames`、`moduleName`、`moduleKind`、`assetsById`、`WallpaperBackground`、`confirmWallpaperRequestedCommand`、`wallpaperOptionSelectedCommand`、`createSampleWallpaperPickerModule`、`parts`、`sampleWallpaperPickerAssembly`、`wallpaperOptionTestId`、`wallpaperPickerTestIds`、`WallpaperPickerAssembly`（type）、`WallpaperPickerCommandPayload`（type）、`WallpaperId`（type）。当前可见的跨包生产消费者有 `moduleName`、`WallpaperBackground` 与 assembly；跨包测试消费 assembly 和 `wallpaperPickerTestIds`；本包测试经**根入口**消费 `assetsById`、两项 command、`wallpaperOptionTestId` 等，但单独 factory 的本包测试是直连内部实现文件，不算根 API 消费；`WallpaperPickerCommandPayload` 当前未见仓内根入口消费者。每项的精确消费者归因须在详设补齐；上述“未见”不构成删除授权，仓外消费者均待核。

### 3.3 两个 integration 的职责和 API

- 两个 integration 的 Android app 都通过各自的 `create*Assembly` 建立完整 console assembly，再通过导出的 `createSurfaceForDisplayIndex` 向 Android 宿主提供按显示序号创建 surface 的接口。该 helper 是对 `ui-base-console-assembly` 能力的显式别名，Android `App.tsx` 真正消费它；这属于宿主接线 API，不是复制了底层算法。两个 Android 宿主各自还消费 assembly factory、assembly type、`SurfaceForm` type、`moduleName` 与 `./theme/global.css`：`App.tsx` 用 helper/两种 type/CSS，`src/assembly/platformPorts.ts` 用 factory/`SurfaceForm`，`src/dependencies.ts` 用 `moduleName`，`metro.config.js` 的 `globalCssPath` 用 CSS 子路径。此消费集是不可回退的 public contract，不只包括 root `src/index.ts`。
- 两个 integration 都调用现有 `createConsoleAssembly`，并复用 `ui-base-console-assembly` 中的 surface parser、startup-ready actor/payload、surface-index 映射及 state-sync slice 筛选。各自 `terminalSurfaces.ts` 只绑定本包 `package.json` 配置与错误前缀；当前源码没有证据支持再复制或重做这些基础算法。
- `createSampleConsoleModule` / `createSampleWallpaperConsoleModule` 持有各自 integration 的 command identity 与 actor；壁纸应用另拥有 placement actor。`sample-console` 与 `sample-wallpaper-console` 的 app name、persistence key、业务模块集合、state-sync 输入、topology 参数、壁纸背景及 waiting/welcome placement 都有真实差异，必须留在 integration。
- integration root 目前还公开了多项组装内部可用的符号：例如 `createSampleConsoleModule`、`createSampleDefinedParts`，以及 wallpaper integration 的 `createSampleWallpaperConsoleModule`、`startupReadyCommand`、`parts`/单项 part。当前仓内 Android 生产消费者使用的完整接口包括 assembly factory、`createSurfaceForDisplayIndex`、assembly/`SurfaceForm` 类型、`moduleName` 和 `./theme/global.css` 子路径；上述内部组合符号在本仓未见 Android/其他 package 的生产根导入。它们由 `terminal-invariants.json` 记录为 public API，部分也被包内测试作为 root surface 测试对象使用。**这是需要给每项导出补上“目标消费者/公开理由”的候选清理范围，不等于已经证明可以删除。**
- 两个 integration 都公开 surface parser helper 与配置类型。integration 内部 assembly 使用这些 helper，包内测试也从 root 验证它们；Android app 则传入自己的配置并消费 `SurfaceForm`，不需要自行实现 parser。是否把 parser helper 继续视作 integration 对外 API，或仅作为 package 内部/共享 base API，需按受支持消费者裁定，而不能把两个相似 adapter 简化为新的通用工厂后就假定 API 边界更清楚。

### 3.4 形似重复但 owner 不同的包内代码

- 三个 `foundations/systemFailureDismissal.ts` 都调用 base 的 `dispatchWithRequestId`，形状相近；但分别绑定 desk/auth/wallpaper 各自的 dismissed command。这是 feature 行为意图，不是缺少一个通用 dispatcher。base 已经承担相同的通用派发机制，command identity 必须留在其 feature owner。
- 这三份 helper 需要评估的是**目录职责**：它们调用 base `dispatchWithRequestId` 派发各自 feature command，本身是进入 ledger 的 command。`terminal-coding-standard.md` TR-01 的同形反例是 foundation 接收 `dispatchAction` 形参再内部调用；该例的 ledger 理由不能直接套用到这三个 helper，且 TR-01 明确允许任意位置发 `dispatchCommand`。但 TR-06 末段规定 `foundations/` 其余导出仍须为纯函数，§7.1 目录表也禁止有副作用的东西；现有 `ui/base/render/src/foundations/dispatchWithRequestId.ts` 同样接受注入并执行 command 派发，是必须一并核对的反例。问题因此收窄为：注入 dispatcher 后实际执行派发的函数能否留在 `foundations/`，以及此口径如何一致适用于现有 base helper？可评估让 foundation 只返回纯命令绑定、由 feature hook/renderer 调用点执行派发；command identity 仍属各 feature，不能上收到 base。本轮不凭相似文件名直接裁定搬移。
- 六个 laptop/mobile system-failure renderer 已消费 base `SystemFailureNotice`；呈现 profile 不等于业务 copy、dismiss command 或失败阶段。类似参数值可在后续评估，但不能因为数值相似便推出 base 应拥有全部视觉策略。
- `MemberForm` 的 laptop/mobile renderer 和 `useMemberForm` 中的 alpha/financial 键盘探针已有产品来由：键盘需求 v2 `2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md` §2.1 将它们列为“本需求新增的 sample 能力验证点”，目标是给四种键盘布局提供可操作、可寻址的真实消费者，文案及 fieldId/testID 亦已冻结；键盘详设 `2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md` §6.2 的 Web/Android 动态入口依赖 MemberForm alpha probe。它们不是会员资料字段；financial 还被 admin-shell 主机地址输入使用，不能称两个探针为布局的“唯一消费者”。当前双端 MemberForm 未呈现 v2 要求的“输入能力验证（仅 sample）”区域标题，属于另一个待核的既有呈现差异，本批不据此扩成键盘/UI 改造。本批保留探针、不移动、不删除，且不改 keyboard 行为；仅“职责重整后 v2 的 sample 验证意图是否继续成立”保留为跨批产品问题，若拟改变须先由 Dexter 另行裁定。

### 3.5 当前问题归纳

1. **入口语义混淆**：开发者容易把内部模块 export、assembly 聚合、package root API 当作重复的“多份导出责任”，也可能因此只按文件数量做删除，而不判断职责与消费者。
2. **package root API 不一致**：两个 feature 以 assembly 为组合入口，wallpaper-picker 还额外根导出与 assembly 重叠的原始 `parts` 和 module factory；两个 integration 也各自公开不同数量的内部组成符号。
3. **API 清单缺少消费理由与子路径**：`terminal-invariants` 与 exact-set 测试目前只证明 root 导出和清单相符，未覆盖两个 integration 的 CSS 子路径；也不能证明每个导出都应该是公共契约，尚未明确区分宿主/其他包/测试/外部使用者。
4. **收口判据过于概括**：既有计划要求删除“模糊/重复 export”，但针对当前包关系，尚缺一个逐符号的责任与消费者分类，使 review 能区分“组装接口所需”“宿主真正消费”“业务契约公开”“仅内部可用”“仓外消费者未知”。
5. **包内路径也可能掩盖职责**：三个 feature-specific dispatch binding 放在 `foundations/`，与该目录无副作用职责约束存在待审查张力。重复调用本身已被 base dispatcher 收敛，剩下是 feature owner 的副作用位置问题。

## 4. 需求

### R-1：每个层级保有唯一的职责 owner

功能或事实只能在一个适当层定义。跨包通过 owner 暴露的契约消费，不因另一个层需要接线就复制实现。package 依赖方向遵循 kernel 业务事实 → UI feature 场景呈现 → integration 应用组合 → platform assembly 接线；通用机制留在现有合适的 `ui/base` owner。

### R-2：保留有意义的 assembly 聚合边界

feature assembly 的目标是把本 feature 对外承诺的 UI parts、运行模块及确有需要的本 feature metadata 聚成一致接口；integration assembly 的目标是把应用专属 feature/kernel 模块和配置交给共享 console assembly 并形成宿主可运行的对象。两类 assembly 不因都叫 `assembly` 就合并，也不把所有输入重新拆成 package root 多个平行入口。

### R-3：区分内部 export、assembly API 与 package root API

内部文件可为同包组合显式导出；assembly 模块可消费这些符号并形成层级契约；root `src/index.ts` 只发布有明确包外消费者或经 Dexter 接受的受支持 API。`package.json` export map 中的根路径及每个非根子路径、root index、`terminal-invariants` 和 exact-set test 必须表达同一 public contract；CSS 子路径也要进入 invariants 与执行体，不把测试能访问到内部文件误算成它必须是公共 API。

### R-4：相同能力不得无理由地提供平行 package-root 入口

当 aggregate assembly 已提供某项能力时，root 不再无理由另发同一 parts 集合或等价 module factory。例外必须指出独立的包外消费者、不同语义或明确支持的扩展点。当前 wallpaper-picker 的单独 `parts` 与 `createSampleWallpaperPickerModule` 按仓内消费者视角列为待裁定候选；不得用“目前仓内没搜到”证明外部 API 可直接删除。

### R-5：integration root 暴露宿主需要的应用契约，不外泄内部装配步骤

每个导出必须可归类为 Android/另一个生产 package 的真实需要、受支持业务契约、测试专门验证的公共 API，或无已知消费者但仍需产品裁定。integration 自己的 assembly 中间函数、单个业务 part 和 startup module/command 默认属于 package 内部组合，不因已在 root 导出就自动成为永久公共 API。保留/收窄决定必须同步公开清单与说明。

### R-6：复用以同一机制与明确消费者为准

抽到 base 的候选需证明至少两个当前实际消费者共享同一机制，且不携带 sample 业务知识；已存在的 feature/console assembly、renderer、admin-shell、input 等能力优先复用。仅因两个 package 有类似文件名、短映射、app 配置绑定或 assembly 外壳，不新增抽象，也不改变 app-specific owner。

### R-7：公开 API 的理由可审阅、非业务变化可验证

每个目标 package 的每项 root export 与非根 export-map 子路径应能回答：由谁消费、为何必须跨包、该能力的 owner 是谁、是否已包含于更高层 assembly、仓外消费者是否已知。README、`src/index.ts`、`package.json` export map、`terminal-invariants.json` 和 public-surface test 要作为同一原子变更保持一致；三 feature 中当前仅 wallpaper-picker 有 public-surface test，另外两包也须有会失败的执行体。整理只能减少歧义入口，不得改变命令 owner、module identity、业务交互、part metadata、失败/恢复语义、平台配置或 UI 形态。Android 宿主上述全部根符号及 CSS 子路径须有解析失败即红的判据。

### R-8：双形态与业务目录目标作为保留约束

三个目标 feature 保持 laptop/mobile 分开的 renderer 目录、通用组件归 `components/`、行为由 feature 自己拥有；双端共享的是实际相同的业务行为 hook，而非单 renderer 的机型分支。wallpaper integration 的真实 laptop-only welcome/waiting 仍不需要虚构 mobile sibling。职责/出口整理不能让这项结构倒退。

### R-9：源文件目录语义与副作用职责一致

共享机制已经存在时，不再为消除重复调用重复造公共能力；feature command identity 与 dismissal 意图仍由 feature 拥有。代码目录的“纯基础能力”与“行为/派发”必须可辨认。对当前 dismissal helper，后续评审应明确 TR-06 的注入依赖是否允许这种作用；若不允许，再确定由哪个 feature 行为单元承接。需求阶段不先冻结具体文件移动方案或更改标准。

## 5. 优化方向与反例

| 候选问题 | 需求级方向 | 不接受的做法 |
| --- | --- | --- |
| feature raw parts/module factory 与 aggregate assembly 并列暴露 | 以 assembly 作为 integration 默认消费契约；只有独立且真实的消费者才保留平行根入口 | 为了“少导出”删除仍由受支持包外消费者依赖的契约；或保留旧别名/兼容壳来掩盖双入口 |
| integration root 暴露内部创建步骤 | 按 Android host、其他生产包、跨包测试、本包测试、仓内无消费者五类清点，仓外使用另列 OPEN；任何收窄须有逐项消费者证据 | 将所有内部 export 一次性降级；仅凭仓内零命中删除；或把测试访问便利当成生产 API 理由 |
| 两 integration 都有相似的配置 adapter/module assembly | 保留现有 base owner与 app-specific adapter；仅当确认还有重复机制且新增抽象降低总体认知成本再提案 | 让 base 导入 integration package.json/命令/名称；合并 app-specific module/placement/sync 规则 |
| 多层都使用 `export` | 文档明确各层目的与可见范围，按“同能力入口数”而非 `export` 关键字数量评审 | 机械追求全仓只出现一个 `export` 文件，破坏模块内部封装或 package 边界 |

本文不冻结哪几个 integration export 最终删除；详设可以提出最小方案、CP 顺序和将来实施期的验证判据，但仓外消费者未知的删除/收窄仍须 Dexter 逐项裁定。本轮不执行方案。

## 6. 验收条件（需求级）

未来获准处理该范围时，须能从真实包外导入路径说明五包每一项 root export 与非根 export-map 子路径的消费者与理由；assembly 作为层级契约易于被其直接上层消费；无已裁定冗余的平行 package-root 访问路径；任何未查清的仓外消费者保持明确 OPEN，不得以仓内零命中删除；两个 Android 宿主的实际 root 符号/CSS 子路径全部仍可解析；base 不包含业务/app 词汇；integration 继续保留 app-specific owner；文件职责和 package API 文档相符；原业务与双形态约束不变。

这些是成功条件，不是本轮已完成的测试或 review 结论。除静态源码阅读外，本轮没有运行任何测试、构建或动态验证。

## 7. 评审需要裁定的问题

1. `assembly` 是否应成为 feature 与 integration 面向上层的首选、唯一组合入口；若是，哪些独立业务契约仍应另行 root export？
2. package public surface 的“消费者”是否限于当前仓内生产包，还是包含未在仓库可见的未来/外部消费者？未知消费者是否应由 Dexter 在逐项证据上明确接受，而不是以隐式兼容为准？
3. wallpaper-picker 的 `parts` 与 `createSampleWallpaperPickerModule` 这两项同 assembly 重叠的 root export，是否属于仅为旧/测试入口保留的歧义面？当前证据支持“仓内生产消费走 assembly”，但不证明仓外 API 结论。
4. 两个 integration 的 `create*Module`、单项 parts、`createSampleDefinedParts`、startup command 和 parser helper 哪些是受支持的跨包合同，哪些只是实现暴露？需按符号有归因，不以整个 index 统一裁决。
5. 现有可读性实施计划第 97 行“旧导出和重复常量无命中”、第 231 行 CP-3“重新收口 public exports”、第 350 行“旧 ambiguous wallpaper export 均无生产代码命中”，对同一批符号不能单独充当删除前判据；该计划第 360–362 行已有外部消费者停机条件。建议本稿作为既有 CP-3/CP-5 public-surface 收口的澄清，用逐符号消费者证据与仓外未知 OPEN 前置补强该停机条件，并以此限定第 97、231、350 行的适用；还是另立后续范围？请 Dexter 在详设 review 确认。确认前不得按仓内零命中删除，也不得让两个计划并行实施互斥规则。

## 8. 回源与证据边界

本轮已静态重开：

- `doc/platform/terminal-coding-standard.md`：TR-06、TR-12、TR-13、TR-R01、TR-R02 与 §7.1 目录职责表；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/practices/module-call-boundary-ownership.md`、`project-memory/decisions/deterministic-context-only.md`；
- 三个 feature 的 `src/index.ts`、`src/assembly/assembly.ts`、`src/parts/parts.ts`、package/README 与 `terminal-invariants.json`；当前 package `test/publicSurface.test.ts` 仅在 wallpaper-picker 存在，member-desk 和 staff-auth 未发现同名测试；
- 两个 integration 的 `src/index.ts`、`src/application/terminalSurfaces.ts`、`src/application/module.ts`、`src/assembly/assembly.tsx`、`terminal-invariants.json` 与 public-surface tests；
- 当前 package-to-package 与 Android host imports；`ui-base-feature-assembly`、`ui-base-console-assembly` 的 public contract；
- 既有需求 `2026-09-22-ter-ui-business-readability-requirements-codex.md`，以及同日 implementation design/plan 和 DESIGN closure；CP-1/2/3 review 只作为时间有界的历史证据，不代替当前 bytes。
- 键盘需求 v2 §2.1 与键盘详设 §6.2，确认 MemberForm 探针的既定 sample 验证意图与跨批动态入口；Android 两个宿主 `App.tsx`、`src/assembly/platformPorts.ts`、`src/dependencies.ts`、`metro.config.js`，确认完整 integration 消费集；两 integration 的 `package.json` 与 `terminal-invariants.json`，确认 CSS 子路径清单缺口。

静态消费者检索只覆盖本仓可见 import。无法从源码证明外部消费者不存在；对这类推断必须保留限定语。当前没有源码/测试/依赖/脚本/build 产物更改，也没有运行验证。任何未来逐项修改前，仍须按 AGENTS.md 对应要求重新读取原业务、项目 memory、设计约束和 owning source；本文件不是对该双读要求的豁免。
