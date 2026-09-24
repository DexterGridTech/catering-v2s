# TER UI 包职责与公共导出边界详设

DOCUMENT_KIND=IMPLEMENTATION_DESIGN
STATUS=IMPLEMENTATION_AUTHORIZED_BY_DEXTER
REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923
REVIEW_TARGET=DESIGN
DESIGN_DIAGNOSTIC_REVIEW=GO
INDEPENDENT_REVIEW_ADMISSION=NOT_RESTORED
BUSINESS_SOURCE=doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md
IA_REF=NOT_APPLICABLE_WITH_REASON:本批不更改屏幕或交互形态，既有可读性需求与 IA 作为行为不变基线
AUTHORIZED=CP-0至CP-4非收窄契约补强、静态与focused验证、单机双屏及mobile动态回归
NOT_AUTHORIZED=未获Dexter逐项裁定的public export收窄；本批外的业务、登录、keyboard、power或UI形态改动
IMPLEMENTATION_AUTHORITY=DEXTER_EXPLICIT_2026-09-23
EVIDENCE_TIER=IMPLEMENTATION_IN_PROGRESS

## 1. 目标、来源与方案

真实问题不是 `export` 关键字太多，而是同一能力可能经 feature assembly 和 package root 两条路径被上层拿到，且现有 exact-set test 只能证明 root 名单与 invariant 一致，不能说明谁消费、非根子路径是否完整，也不能替代仓外消费者裁决。若只按“仓内无命中”处理，可能破坏受支持 API；若全部保留而不归因，歧义入口会继续扩散。本批目标是给五个业务包的公共面建立**逐符号、逐路径、带消费者归因**的可审阅边界，并保留现有业务与双形态行为。

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：按仓内零命中删 root 导出 | 省事，但无法证明仓外零消费者，且测试/预览与真实包入口易混 | 拒绝 |
| B：现状所有导出永久公开，仅补说明 | 避免立即回退，但重复入口和未命名契约继续存在 | 拒绝 |
| C：先冻结全量消费者与仓外 OPEN，原子补 contract/test，只有得到逐项裁定才收窄 | 保留现有可用性，令潜在收窄可证伪、可审计 | 采用 |

选择 C 而非 A/B，因为它把证据不足的删除停在正确边界，同时解决 exact-set 的 CSS 子路径盲点。四层职责保持：内部模块 `export` 服务同包组合；`assembly.ts[x]` 聚合本层贡献；`src/index.ts` 给出根 API；`package.json exports` 决定根及非根可解析路径。`terminal-invariants.json` 和 public-surface test 是后两层的契约检查，不反推所有内部 export 必须公开。

适用正本：`doc/platform/terminal-coding-standard.md` TR-01、TR-06、TR-12、TR-13、TR-R01、TR-R02、§7.1；`project-memory/operations/terminal-coding-standard.md`、`project-memory/practices/module-call-boundary-ownership.md`、`project-memory/decisions/deterministic-context-only.md`；2026-09-22 可读性需求/详设/计划与本批需求。任何实际变更前重开这些原文与对应 owning source。

## 2. 与旧计划的确定关系及未决裁决

本详设作为 `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md` 既有 CP-3/CP-5 public-surface 收口的判据澄清。Q5 与仓外消费者仍保持 `OPEN`；当前 Dexter 授权只覆盖非收窄契约补强，故两份计划均不得执行任何未获逐项裁定的 export 收窄，也不得把“不处理”记成裁定。

| 旧计划落点 | 原含义 | 本详设在五包 public surface 上的限定 |
| --- | --- | --- |
| §2 第 97 行，wallpaper ambiguous root exports“旧导出和重复常量无命中” | 无残留的完成检查 | 不作为删除前充分证据；先按 §4 逐符号归因、核仓外消费者并逐项裁定 |
| CP-3 第 231 行“重新收口每个包的 public exports” | feature 收口动作 | 只对已裁定项执行；README/index/export map/invariants/test 同一原子变更，未裁定项保持原公开状态与 OPEN |
| CP-5 第 350 行“旧 ambiguous wallpaper export 均无生产代码命中” | 整批完成检查 | 保留为已裁定清理项的负向扫描，不得由“无生产命中”推出可删；旧计划第 360–362 行原文为“如果确有外部消费者，先停止并把消费者、owner 和最小替代交 Dexter”；本详设将其**前移并收紧**为“仓外消费者未证明不存在时，该项保持 `OPEN`、不得收窄，须经 Dexter 逐项裁定” |

当前 `sample-wallpaper-picker/src/index.ts` 仍有 `parts` 与 `createSampleWallpaperPickerModule`；源码不能证明旧计划未执行还是实施时决定保留。本批不据历史 CP 状态给它们贴“已关闭”。

`DEXTER_DECISION=OPEN`：Q5 是否并入原 CP-3/CP-5；§4 中拟收窄项是否存在受支持的仓外消费者，以及逐项保留/收窄决定。Dexter 已授权当前批次只做非收窄契约补强；不得删 export、加兼容壳或把 `OPEN` 写成 PASS。

## 3. 分母口径与跨层机制

§4 冻结的是当前源码：五包 `src/index.ts` 共 71 个命名 root 导出，`package.json exports` 共 7 个路径（五个 `.`、两个 `./theme/global.css`）。同名符号在不同包是不同项；类型导出单列。分类只认**从包根或指向该包 `src/index.ts` 的导入**；直接导入包内实现文件不算此 root 符号的消费者。代码 `A`=Android 宿主，`P`=其他生产包，`X`=跨包测试，`T`=本包测试，`V`=本包 Expo 预览入口，`Ø`=未见仓内 root 消费。一个符号可有多个代码；`V` 不冒充 Android/跨包生产消费者。`E=OPEN` 表示仓外消费者尚未核实，**每行均为 OPEN**，包括当前有仓内消费者者。

每个 `Ø` 只是候选研究项，不是删除清单；`T`-only、`V`-only 也不是自动可删。若将测试从根入口改为包内入口，须说明仍在验证哪项受支持的 API，不得把“测试方便”倒置成生产契约。`moduleName` 五包均有上层依赖声明；`WallpaperBackground`、feature assembly、两个 integration 宿主六类接口都有真实生产消费，必须保持。

| 跨层机制 | 声明 | 传递与消费 | 实施期可证伪观察 |
| --- | --- | --- | --- |
| 根导出 | `src/index.ts` + invariant `publicExports` | `package.json exports["."]`，生产/测试根导入 | TS AST exact-set，删/增一项红；类型导出计入 |
| 非根 CSS | `package.json exports["./theme/global.css"]` + invariant `publicExportMap` | Android `App.tsx`、`metro.config.js` | key/target 映射 exact-set、目标文件存在、宿主字面路径/包解析检查；删或错指一项红 |
| 宿主装配 | integration factory、helper、type、`moduleName` | 两 Android `App.tsx`、`platformPorts.ts`、`dependencies.ts` | 宿主 typecheck 与 consumer-side 静态 contract test；删任一真实导出红 |
| feature 装配 | feature assembly 与 `moduleName` | 两 integration 的 `assembly.tsx`/`dependencies.ts` | 跨包编译与 assembly focused test；错配 module/part 红 |
| 行为边界 | 各 feature command、hook、parts；各 integration 配置 | UI renderer、actor、host | §6 不变量 focused 断言和故意变异；仅 publicSurface 绿不算行为绿 |

`publicExportMap` 是现有 invariant 的最小扩展：五包均记录 `".": "./src/index.ts"`，两个 integration 再记录 `"./theme/global.css": "./theme/global.css"`。这同时覆盖子路径**名称与目标**，避免错指另一个存在的文件仍假绿；三 feature 的 invariant 还需新增 `publicExports`，其中 wallpaper-picker 已有；两个 integration 的 invariant 已有 `publicExports`。同一项公共面若实际获准变更，`README.md`、`src/index.ts`（CSS 行为为 `N/A`，说明不在 TS 根索引）、`package.json exports`、`terminal-invariants.json`、`test/publicSurface.test.ts` 必须同一 CP 原子同步；不得先改一个入口再称完成。CSS 文件内容/主题不在本批修改范围。

## 4. 当前逐项公共面与消费者（冻结分母）

下表的包名前缀统一为 `apps/terminal/ui/feature/` 或 `apps/terminal/ui/integration/`；所有表的 `仓外` 均逐项为 `OPEN`。`现状决定` 的 `KEEP` 是仓内生产/宿主消费不可回退；`REVIEW` 仅表示需 Dexter 逐项裁定后才可考虑收窄，当前实施动作仍是**保留**。证据锚点：五包 `src/index.ts`、各自 `package.json`，两 integration `src/dependencies.ts`/`src/assembly/assembly.tsx`，两个 Android 宿主 `App.tsx`/`src/assembly/platformPorts.ts`/`src/dependencies.ts`，各包 test 对 root 的导入。§4 的消费者分类在设计 review 时须从当前字节复核；历史报告不能替代。

### 4.1 `sample-member-desk`（6 root）

| root 符号 | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- |
| `dependencyModuleNames` | Ø | OPEN | REVIEW |
| `devDependencyModuleNames` | Ø | OPEN | REVIEW |
| `moduleName` | P：sample-console `dependencies.ts` | OPEN | KEEP |
| `moduleKind` | Ø | OPEN | REVIEW |
| `sampleMemberDeskAssembly` | P：sample-console `assembly.tsx`；T：memberDesk.test | OPEN | KEEP |
| `MemberDeskAssembly`（type） | Ø | OPEN | REVIEW |

### 4.2 `sample-staff-auth`（6 root）

| root 符号 | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- |
| `dependencyModuleNames` | Ø | OPEN | REVIEW |
| `devDependencyModuleNames` | Ø | OPEN | REVIEW |
| `moduleName` | P：两个 integration `dependencies.ts` | OPEN | KEEP |
| `moduleKind` | Ø | OPEN | REVIEW |
| `sampleStaffAuthAssembly` | P：两个 integration `assembly.tsx`；X：wallpaper-console sample2Assembly.test；T：staffAuth.test | OPEN | KEEP |
| `StaffAuthAssembly`（type） | Ø | OPEN | REVIEW |

### 4.3 `sample-wallpaper-picker`（16 root）

| root 符号 | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- |
| `dependencyModuleNames` | Ø | OPEN | REVIEW |
| `devDependencyModuleNames` | Ø | OPEN | REVIEW |
| `moduleName` | P：wallpaper-console `dependencies.ts` | OPEN | KEEP |
| `moduleKind` | Ø | OPEN | REVIEW |
| `assetsById` | T：sampleWallpaperPicker.test | OPEN | REVIEW |
| `WallpaperBackground` | P：wallpaper-console `assembly.tsx`；T：sampleWallpaperPicker.test | OPEN | KEEP |
| `confirmWallpaperRequestedCommand` | T：sampleWallpaperPicker.test | OPEN | REVIEW |
| `wallpaperOptionSelectedCommand` | T：sampleWallpaperPicker.test | OPEN | REVIEW |
| `createSampleWallpaperPickerModule` | Ø；本包 `pickerSystemFailure.test` 直连内部实现，不算 root | OPEN | REVIEW |
| `parts` | Ø；生产走 `sampleWallpaperPickerAssembly.parts` | OPEN | REVIEW |
| `sampleWallpaperPickerAssembly` | P：wallpaper-console `assembly.tsx`；X：sample2Assembly.test；T：sampleWallpaperPicker.test | OPEN | KEEP |
| `wallpaperOptionTestId` | T：sampleWallpaperPicker.test | OPEN | REVIEW |
| `wallpaperPickerTestIds` | X：sample2Assembly.test；T：sampleWallpaperPicker.test | OPEN | REVIEW |
| `WallpaperPickerAssembly`（type） | Ø | OPEN | REVIEW |
| `WallpaperPickerCommandPayload`（type） | Ø | OPEN | REVIEW |
| `WallpaperId`（type） | Ø | OPEN | REVIEW |

### 4.4 `sample-console`（20 root）

| root 符号 | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- |
| `moduleName` | A：sample-terminal `dependencies.ts`；T：packageSurface.test | OPEN | KEEP |
| `moduleKind` | Ø | OPEN | REVIEW |
| `dependencyModuleNames` | T：packageSurface.test | OPEN | REVIEW |
| `devDependencyModuleNames` | T：packageSurface.test | OPEN | REVIEW |
| `createSampleAssembly` | A：sample-terminal `platformPorts.ts`；T：packageSurface.test/sampleAssembly.test/theme.test；V：test-expo/App.tsx | OPEN | KEEP |
| `createSampleDefinedParts` | Ø；sampleAssembly.test 直连内部 assembly | OPEN | REVIEW |
| `createSurfaceForDisplayIndex` | A：sample-terminal `App.tsx`；T：packageSurface.test/sampleAssembly.test/theme.test | OPEN | KEEP |
| `createSampleConsoleModule` | Ø | OPEN | REVIEW |
| `SampleAssembly`（type） | A：sample-terminal `App.tsx` | OPEN | KEEP |
| `terminalSurfaces` | T：packageSurface.test/terminalSurfaces.test；V：test-expo/App.tsx | OPEN | REVIEW |
| `getSurfaceDeclarations` | T：terminalSurfaces.test | OPEN | REVIEW |
| `readTerminalSurfaces` | T：terminalSurfaces.test | OPEN | REVIEW |
| `surfaceFormForOrientation` | T：terminalSurfaces.test | OPEN | REVIEW |
| `PortraitSurfaceDeclarations`（type） | Ø | OPEN | REVIEW |
| `SurfaceCreationInput`（type） | Ø | OPEN | REVIEW |
| `SurfaceDeclarations`（type） | Ø | OPEN | REVIEW |
| `SurfaceForm`（type） | A：sample-terminal `App.tsx`/`platformPorts.ts` | OPEN | KEEP |
| `SurfaceOrientation`（type） | Ø | OPEN | REVIEW |
| `SurfaceSize`（type） | Ø | OPEN | REVIEW |
| `TerminalSurfaces`（type） | Ø | OPEN | REVIEW |

### 4.5 `sample-wallpaper-console`（23 root）

| root 符号 | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- |
| `moduleName` | A：sample-wallpaper-terminal `dependencies.ts` | OPEN | KEEP |
| `moduleKind` | Ø | OPEN | REVIEW |
| `dependencyModuleNames` | Ø | OPEN | REVIEW |
| `devDependencyModuleNames` | Ø | OPEN | REVIEW |
| `createSampleWallpaperConsoleAssembly` | A：sample-wallpaper-terminal `platformPorts.ts`；T：sample2Assembly.test；V：test-expo/App.tsx | OPEN | KEEP |
| `createSurfaceForDisplayIndex` | A：sample-wallpaper-terminal `App.tsx`；T：sample2Assembly.test | OPEN | KEEP |
| `WallpaperConsoleAssembly`（type） | A：sample-wallpaper-terminal `App.tsx` | OPEN | KEEP |
| `createSampleWallpaperConsoleModule` | Ø | OPEN | REVIEW |
| `startupReadyCommand` | Ø | OPEN | REVIEW |
| `parts` | T：sample2Assembly.test | OPEN | REVIEW |
| `waitingPart` | Ø | OPEN | REVIEW |
| `welcomePart` | Ø | OPEN | REVIEW |
| `terminalSurfaces` | T：terminalSurfaces.test；V：test-expo/App.tsx | OPEN | REVIEW |
| `getSurfaceDeclarations` | T：terminalSurfaces.test | OPEN | REVIEW |
| `readTerminalSurfaces` | T：terminalSurfaces.test | OPEN | REVIEW |
| `surfaceFormForOrientation` | T：terminalSurfaces.test | OPEN | REVIEW |
| `PortraitSurfaceDeclarations`（type） | Ø | OPEN | REVIEW |
| `SurfaceCreationInput`（type） | Ø | OPEN | REVIEW |
| `SurfaceDeclarations`（type） | Ø | OPEN | REVIEW |
| `SurfaceForm`（type） | A：sample-wallpaper-terminal `App.tsx`/`platformPorts.ts` | OPEN | KEEP |
| `SurfaceOrientation`（type） | Ø | OPEN | REVIEW |
| `SurfaceSize`（type） | Ø | OPEN | REVIEW |
| `TerminalSurfaces`（type） | Ø | OPEN | REVIEW |

### 4.6 export-map 全路径（7 path）

| 包 | export-map key → target | 仓内分类/消费者 | 仓外 | 现状决定 |
| --- | --- | --- | --- | --- |
| sample-member-desk | `.` → `./src/index.ts` | P：sample-console | OPEN | KEEP |
| sample-staff-auth | `.` → `./src/index.ts` | P：两个 integration；X：wallpaper-console 测试 | OPEN | KEEP |
| sample-wallpaper-picker | `.` → `./src/index.ts` | P：wallpaper-console；X：其测试 | OPEN | KEEP |
| sample-console | `.` → `./src/index.ts` | A：sample-terminal | OPEN | KEEP |
| sample-console | `./theme/global.css` → `./theme/global.css` | A：sample-terminal `App.tsx` 与 `metro.config.js` | OPEN | KEEP |
| sample-wallpaper-console | `.` → `./src/index.ts` | A：sample-wallpaper-terminal | OPEN | KEEP |
| sample-wallpaper-console | `./theme/global.css` → `./theme/global.css` | A：sample-wallpaper-terminal `App.tsx` 与 `metro.config.js` | OPEN | KEEP |

两份 `test-expo` 对 CSS 的相对路径导入，以及 sample-console `theme.test.ts` 直接读另一包 CSS 文件，都是**文件消费者**而非 `./theme/global.css` 包子路径消费者，不得充当该 export-map key 的消费证据。表中 `REVIEW` 项是交 Dexter 逐项裁定的清单；全部仓外状态都仍是 OPEN，不能因表内已有 `KEEP` 就声称仓外核验通过。

## 5. 实施结构与 CP 门

| CP | 单一职责 | 主要输出 | 进入条件 |
| --- | --- | --- | --- |
| CP-0 | 重开原需求、IA/可读性基线、项目记忆、owning source；从当前字节重算 §4 全分母并逐行核对 | 71 root/7 export-map path 的实际重算、消费者分类完整；Q5/仓外消费者仍记 `OPEN`，不作逐项裁定 | Dexter 实施授权已给；计数或分类任一不匹配即 `OPEN` 并停在 CP-0 |
| CP-1 | 五包 non-shrinking public contract 原子补强 | README/index/export map/invariant/publicSurface 五方一致；member/staff 新 test；CSS 子路径入 invariant；两个 integration consumer contract | CP-0 的当前字节分母 `MATCHED` |
| CP-2 | 按本次授权记载“无获准收窄项”并保持五包所有 root export 原样 | 不改删任何 public export；Q5、71 项根符号与 7 条路径的仓外消费者保持 `OPEN` | 当前无逐项 Dexter 裁定；记录无获准项即完成，不伪造清理量 |
| CP-3 | 完成静态/focused 行为、host 与目录不变量验证及全部真实红变异 | 首次红输出、恢复后绿、host typecheck 和行为/part/config 不变量 `MATCHED` | CP-1/2 的逐 CP 独立复核 `MATCHED` |
| CP-4 | 全批三维对账先行；随后整体测试、限定设备动态回归、cleanup、逐代码与详设对账、整批独立 implementation review | 两道对账分开留痕；两个 app × 双屏/mobile 动态结果与 cleanup 单列；仅对实施差异型 `OPEN` 阻止交付 | CP-3 静态与 focused 全 `MATCHED`，且全批三维对账 `MATCHED` 后方可启动动态验证 |

每个 CP 完成后、下一 CP 之前由 fresh 只读子 agent 做“需求、详设/IA、项目记忆规范”逐项三维对账；`OPEN` 先修再复查。全部 CP 后、整体测试前再做全批三维对账，不拿阶段汇总冒充整体。完成测试与 cleanup 后、给 Dexter/Claude 做实施后 review 前，另做**每一变更代码与本详设逐条对账**；实施计划 §7 写成独立交付前置门。

### 5.1 精确落点与原子组

五包各自：`README.md`、`src/index.ts`、`package.json` 的 `exports`、`terminal-invariants.json`、`test/publicSurface.test.ts` 为同一原子组。对两个 integration 的 CSS 子路径，`src/index.ts` 不导出 CSS 是正确的 `N/A`，其余四方仍须同步：README 列明确路径/宿主用途，package map 指向现存文件，invariant `publicExportMap` 同时登记 `.` 与 `./theme/global.css` 的精确目标，test 对 `packageJson.exports` 与该对象做双向 deep equal，并核实每个目标文件存在。其余三个 feature 的 `publicExportMap` 仅含 `".": "./src/index.ts"`。`publicExports` 与 TS checker 对根模块 `getExportsOfModule` 的结果完全相等，含 type 导出；member-desk、staff-auth 的 invariant 新增名单和 `test/publicSurface.test.ts` 执行体。现有 wallpaper-picker 与两个 integration 的测试复用同一 TS checker 形态，不新造运行时 public API、测试专用 production export 或通用抽象层。

两 integration 的 `test/publicSurface.test.ts` 还应做消费侧静态合约断言，精确读对应 Android `App.tsx`、`src/assembly/platformPorts.ts`、`src/dependencies.ts` 和 `metro.config.js`：前者根导入 `{createSurfaceForDisplayIndex, type Assembly, type SurfaceForm}` 与 CSS，platformPorts 根导入 `{create*Assembly, type SurfaceForm}`，dependencies 根导入 `{moduleName}`，metro `globalCssPath` 等于同包 CSS 子路径。使用 TS import AST 提取符号，而非正则只数字符串；若任一导入项缺失、改名、指错包或 CSS map 指向不存在文件，focused test 红。选择在 integration 的 `publicSurface.test.ts` 实现，是因为它是该 package public contract 的执行体，便于与 invariant/map 原子维护；这会把被消费方的 import contract 钉在真实宿主上，宿主改动后该测试变红是刻意的审查提示，需先重核 §4 消费矩阵再更新，而不是静默接受。AST 只比较导入的 package/export 名，不因本地 alias 改名而误红。当前 assembly/base/android 测试中没有既有执行体同时读取两个 app 配置可供直接扩展。再以 Android 两包既有 `typecheck` 命令验证真实消费可解析。该静态门只证明路径/类型/声明未退化，不能升级为 Android 运行结果。两个 `createSurfaceForDisplayIndex` 是 base 能力的宿主别名，仍保留，不能为“减少重复”移除。

若 CP-2 获准处理 `sample-wallpaper-picker` 的 `parts` 与 `createSampleWallpaperPickerModule`，先验证 integration 确从 `sampleWallpaperPickerAssembly.parts` / `.createModule()` 使用同一个 `ModuleInput` 与同一 `parts` 对象，且两 root 符号仓外消费者经 Dexter 逐项核实为无需保留；然后在该 feature 的同一原子组中收窄并让 exact-set/负向扫描红绿可见。若任一条件缺失，`CP-2=OPEN`，不得以 deprecated alias 或 test-only re-export 掩盖。其他 `REVIEW` 行同样逐项处理，不能套用该二符号结论。

### 5.2 边界机制对照（模板 §3 的本批适用集）

| 机制组 | 现成能力/规范与本批全集 | 最低证伪档与反例 |
| --- | --- | --- |
| 写授权、跨 owner 事务、HTTP/契约、集合/分页、RTK、Drawer、seed/迁移、日志新边界 | `N/A`：本批只整理五个 UI package 的公开路径，不增业务数据、请求、后端操作、管理后台页面或运行时日志点 | 静态搜变更集；若出现 owner command/合同/schema/seed/页面实现更改，即范围漂移，停机 |
| 单一事实住址与复用 | `ui-base-feature-assembly/src/index.ts` 的 `createFeatureAssembly`；`ui-base-console-assembly` 的 console 组合/解析；五包 assembly 与上层 consumer | 静态对比：base 只保留 mechanism，feature 的 dismissed command/integration 的 app 配置不迁移到 base；重复 root 不以零命中直接删 |
| 失败可见与恢复、缓存/状态失效 | 三 feature 原 actor/hook 与两 integration 原 assembly；本批不改行为 | focused 测试维持 failure/retry/dismiss、member pending/auth/wallpaper 状态；改错必须红，不能只测 export 存在 |
| 平台配置与宿主接线 | 两 integration `terminalSurfaces.ts`/`package.json`，两 Android `App.tsx`/`platformPorts.ts`/`dependencies.ts`/`metro.config.js` | §5.1 消费侧静态门 + 两 Android typecheck；错指 CSS、删 `moduleName`/`SurfaceForm` 即红 |
| UI 形态与双端注册 | 三 feature `src/components/laptop/`、`mobile/`、通用 `components/`，`definePartPair`；wallpaper integration laptop-only welcome/waiting | focused part catalog：每个双端 part 同 key 且 surfaceForm 为 laptop/mobile 两 sibling；welcome/waiting 不生 mobile 伪项 |
| 原子组 | 五包 README/index/package exports/invariants/publicSurface | 任一侧漂移 exact-set 或人工逐项对账 `OPEN`；CSS 在 index 记 `N/A` 而非伪导出 |

`UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON`：本批不设计或变更 screen；既有 IA/可读性设计只作为不变约束。`TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON`：不增/改交互控件或 L2 脚本。`L2_SCRIPT_ADMISSION=BLOCKED`：本批没有 L2 授权。

## 6. 行为不变、反例与可失败判据

仅 public-surface exact-set PASS 不能证明 R-7/R-8。实施需先读当前测试实际断言，再补下表缺口；旧测试若只有 `typeof factory === 'function'` 不算行为 oracle。红变异必须在隔离的实施期验证后恢复，不能留下变异字节。

| 不变量与 owning source | 观察 / 红变异 |
| --- | --- |
| command owner、module identity：三 feature `src/moduleName.ts`、`src/features/commands`/`src/application/module.ts`；两 integration `src/moduleName.ts`、`src/application/module.ts` | 固定五个 moduleName 与现有 command definition identity 的精确值及所属包；临时改一项，package/assembly focused 断言或 dependency contract 必须红。base 不导入任何 feature command |
| 业务交互：member `useMemberForm`，staff auth hook，wallpaper picker hook 与各自 actor | 复跑现有 focused 行为测试并新增不足的精确 command payload/状态/用户动作断言；探针仍不进入 Member/PendingMember/submit command；临时把 financial 值并入 payload 或取消 dirty，必须红 |
| part metadata：三 feature `src/parts/parts.ts`、两 integration `src/parts/parts.ts`/assembly | 对每个既有 part 的 `partKey`、`containerKeys`、`displayModes`、`workspaces`、`instanceModes`、`title`、layer tier/guard、`surfaceForm` 建立精确集合快照；包括 integration 自有 part 与其组合的 feature parts；删一 sibling 或改一个非 `partKey`、非 `surfaceForm` 的 metadata 值，focused test 必须红，不只检查数量。强制红变异之一：将 `sample.desk.member-form.displayModes` 从 `PRIMARY` 改为包含 `SECONDARY`，守卫必须红，恢复原字节后同门绿；不得为迎合快照修改 `src/parts/parts.ts` |
| 失败/恢复：三个 `systemFailureDismissal`、feature system notice hook、integration startup | 断言每个 failure notice 派发本 feature 的 dismissed command，失败原因与 retry/dismiss state 不改变；临时改为另 feature command 或吞失败，测试必须红 |
| 平台配置：两 integration package `terminalSurfaces`、`showAdminPassword`、surface parser/assembly，Android platformPorts/metro | 精确断言原配置矩阵、error prefix、surfaceForm 路由、app persistence key/state-sync 输入与 CSS 包路径；改错任一配置值，focused/host 门必须红。不得把 sample-console 与 wallpaper-console 配置归一成同一业务值 |
| UI 形态与双端：三 feature `components/laptop`/`components/mobile`、`parts/parts.ts`、共享 hook | AST/静态目录核：双端 renderer 为两个独立目录、文件名无 Laptop/Mobile suffix；part 登记为两个 sibling，共享行为 hook 不复制；误改一端导入为另一端实现或加机型分支单 renderer，静态/part test 红。wallpaper welcome/waiting 保持 laptop-only |
| 键盘跨批依赖：MemberForm 两端与 `useMemberForm` | 保留 v2 的 alpha/financial fieldId、testID、sample-only 文案与 alpha 动态入口；`sample.desk.member-form` part 在 `src/parts/parts.ts` 注册为 `displayModes: primary`，故该跨批探针只可从 PRIMARY 形态进入。精确 part 元数据快照必须覆盖 `displayModes`；将该 part 改为同时允许 `SECONDARY` 的真实变异必须使 focused test 变红。变更任一 ID/删探针、将值纳入业务 payload，focused test 必须红。financial 在 admin-shell 另有主机地址消费者，本批不动。v2 要求的区域标题当前字节未呈现，本批记为既有差异，不把它伪称“已满足”或擅自扩大 UI 改造 |

视觉证据如未来由已授权实施采集，须区分静态/ focused/Web/Android/device/visual/cleanup；本详设不宣称既有 UI 已验收。任何测试执行首次失败先保留日志、定位 owning boundary，不以重试或改超时掩盖。

## 7. dismissal helper 的有限处理

三份 feature `src/foundations/systemFailureDismissal.ts` 注入 `dispatchCommand` 后实际通过 `ui-base-render/src/foundations/dispatchWithRequestId.ts` 派发各自 dismissed command。TR-01 禁止 foundation 用 `dispatchAction` 写 reducer，但明确允许任意位置发 `dispatchCommand`；因此不能把三份 helper 定性为 TR-01 违规。TR-06 末段及 §7.1 要求非时间/ID 例外的 foundations 保持纯/无副作用，而现有 base helper 也是同形注入派发；**标准与先例存在一致性待裁定**。

本批默认 `NOT_APPLICABLE_WITH_REASON`：需求只要求包职责/公开 API 分界，三个 helper 非 root export，未证明移动它们能收窄公共面；不改目录、不改 command identity、不新增 base dispatcher。若 Dexter 在 review 另行授权处理，先对 base helper 与三 feature 同根核查，再选最小纯化：foundation 只构造 feature 命令绑定/数据，实际 `dispatchCommand` 留给 feature hook/renderer 或 feature 行为调用点；维持 requestId、routeIntent、ledger、失败/恢复语义。不得仅搬文件而留同形副作用，也不得把 feature command 上收到 base。该选择不随本详设自动进入实施范围。

## 8. 未决项与停机条件

本轮独立实施对账中的 `OPEN` 若表示已授权范围内的实现偏差，必须修复并经新鲜 reviewer 复查后才能继续；Q5、仓外消费者、v2 区域标题、dismissal helper 纯度等明确留在范围外的 `OPEN` 继续原样保留，不当作实现偏差，也不写成已关闭。

| 未决项 | 当前状态 | 允许 | 禁止 |
| --- | --- | --- | --- |
| Q5 并入旧 CP-3/CP-5 还是另立 | `DEXTER_DECISION=OPEN` | 在 review 明确选择后只执行一套收口规则 | 两份计划各自对同一导出并行下令 |
| §4 全部 root/路径的仓外消费者 | `OPEN`；其中 `REVIEW` 行需要逐项决定 | 继续静态收集证据；保留原公开面 | 以仓内 Ø 或 test-only 直接删/降级 |
| v2 MemberForm 区域标题现状差异 | `OPEN`，跨批 UI 差异 | 独立告知 Dexter，保持本批探针 | 把缺标题写成 PASS，或借公共面重整擅改 UI |
| dismissal 目录纯度口径 | `OPEN`，与 base helper 同根 | 提出裁定选项 | 本批默认移动/删除或改 feature command |

CP-0 如果无法确认某项仓外消费者边界，则该项收窄不可进入 CP-2；但 CP-1 的非收窄 exact-set/CSS 合同补强可以独立设计，不借此称整个需求完成。若用户目标被解释为“必须删除全部 REVIEW 项”，需先请 Dexter 逐项裁定，不得猜测。任一真实 Android 宿主 root/CSS 导入解析失败、业务事实/part/配置变化、双端结构倒退或测试红变异不红，当前 CP 停下，记录 first failure、last known good、broken boundary 与最小替代。

## 9. 模板其余机制的适用性与交付前自查

模板的 operation/path/consumer-face、跨 owner 写、业务规则 owner API、迁移、seed、backend acceptance、L2 case/action 在本批均 `NOT_APPLICABLE_WITH_REASON`：本批是既有 TER UI 包公共面及目录职责整理，不新增 HTTP/DB/业务事实/UI 控件。不能借此改变 command owner、feature identity、surface/keyboard/power 语义。模板 §4“每个 CP 的门控”不另复制成平行章节：逐 CP 的可失败条件以实施计划 §2 表为唯一门表，详设 §5 定义 CP 职责与顺序，§5.1/§6 规定执行体与反例；缺少任何 CP 条件均按计划表复核。模板的“声明—传递—消费”在 §3 已覆盖 root、CSS、宿主、feature assembly 与行为；“实施前同步分母”在 §5.1 五方原子组及 §6 owning sources 给出；“未决与停机”在 §8。

交付前复核：71 个 root、7 个 export-map path 实际计数仍一致；每项消费者只按真实根导入分类；`E=OPEN` 没被误读成可删；两个 CSS path 的 key/target 在 map/invariant/test 三处设计均有精确值；Android 两宿主 5 个 root 消费符号加 CSS 保留；member/staff 的 `publicExports` 与执行体不能漏；旧计划第 97、231、350、360–362 行关系没有两套并行判据；§6 每条行为约束都有至少一个改错会红的判据；需求修订后重读与本详设逐项一致。模板 §4 的逐 CP 门控由实施计划 §2 的可失败条件表承接；设计诊断复评仅是设计侧证据，实施期测试/动态结果仍须分别运行并记录，不沿用历史状态。
