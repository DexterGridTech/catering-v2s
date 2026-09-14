# TER sample2 壁纸终端实施计划

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0. 状态、输入和授权

~~~text
BUSINESS_SOURCE=doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md
STANDARDS_SOURCE=doc/platform/terminal-coding-standard.md
PLAN_STATUS=IMPLEMENTATION_COMPLETED_WITH_RUNTIME_AND_REVIEW_OPEN_ITEMS
IMPLEMENTATION_AUTHORIZED=true
IMPLEMENTATION_PERFORMED=true
BUILD_EXECUTED=true
RUNTIME_EXECUTED=true
DATA_OPERATION_EXECUTED=false
INDEPENDENT_SUBAGENT_REVIEW=CP-0_TO_CP-7_PARTIAL
MEMORY_ROUTE=/tmp/ter-sample2-memory-recall-admin-integration.json
~~~

本文件把已写入详设的设计转换成可执行的实施顺序、文件清单、门和证据要求。实施已按
Dexter 授权推进到 CP-7；每个已完成步骤的真实输出、首败、根因、修复与 cleanup 见
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp*-execution-codex.md`。
后续 CP 尚未完成的项目仍保持 OPEN，不能由计划文字替代证据；未使用后台 DEV、seed、UAT、
部署或 Git。

本计划不扩大 Dexter 的授权；当前源码实施与动态验收来自 Dexter 对详设/计划的明确授权。
CP-0 的 Metro/JPG/type declaration 实测已经作为实施首步完成，CP-7 的两台 VM 和既有
sample-terminal 回归也已执行到当前 evidence 标注的边界；后续 CP 仍必须遵守本计划的
顺序、步骤级独立对账和 cleanup 纪律。

### 0.1 不能把计划写成证据

- 设计文档中的 palette、矩阵、红夹具和 API 形态是待实施的契约，不是行为 PASS。
- focused、native 与部分 Android 证据已经存在，但不等于 release、Web 或完整 visual 证据。
- 未来每个门必须保存真实输出、运行身份、日志路径、first failure、last known good、
  broken boundary、业务结果和 cleanup 结果；exit code 或测试名称不能代替这些证据。
- 失败必须先保留并读取日志，定位根因后在授权范围内修复，再做定向复验；不能通过延长
  timeout、盲目重试或改写结论把失败变成 PASS。
- 本计划没有创建任何新的 evidence 台账控制面，也不恢复已经退役的 compliance-control。

### 0.2 详设复评处置后的当前输入

上一轮登记的 A3 与需求旧措辞已经由需求正本当前字节收口，不再作为待裁项。实现只按以下
现行语义工作：确认后两屏 wallpaper ROI 各自变化、两屏 asset identity 相同、换选另一张
确认后两屏再次各自变化；不做 raw-pixel equality，不引入未定义的比较样本；placement 由
integration 负责，结构诊断统一为 `ui-state-hydration`，membership 清理在 ui-state install
期完成。

Metro workspace JPG 解析与类型声明仍是 CP-0 的真实首步实测，不能在此提前写成 PASS。其余
动态档位仍保持 OPEN，直到有实际运行输出、日志和 cleanup 证据。

## 1. 交付目标与实施不变量

### 1.1 目标

交付一个独立的 sample2 Expo/Android 终端：

1. 店员认证后，在主屏选择无壁纸或三张内置壁纸；
2. 选择只写 pending，点击确认才把 pending 提升为 confirmed；
3. confirmed 壁纸由同一 selector 驱动主屏和 laptop 副屏；
4. mobile 为单主屏，integration 逻辑尺寸 360×640，不创建 SECONDARY；目标 mobile VM 物理屏幕为 720×1280；
5. picker、waiting、welcome 的容器透明，使背景在 ScreenContainer 后方可见；
6. 选择、确认、重启、登出、冷启动和浮层恢复符合需求的 state/command 语义；
7. sample-terminal 删除既有两处方向锁后，既有完整旅途仍可运行；
8. 四个新包进入骨架/分层门，README、资产、公共导出和依赖声明可复核。
9. 每个 `ui/integration` 包都集成共享 admin console；本批现有两个 integration 包均须满足
   `TR-13` 的 package/dependency、同一 catalog parts 与生产 `AdminLauncher` 三项形态。

### 1.2 不变量

| 不变量 | 失败表现 | 责任 owner |
| --- | --- | --- |
| confirmed 与 pending 是同一 kernel slice 的两个字段 | 业务 UI 自己维护第二份选择状态 | kernel.feature.sample-wallpaper |
| 背景只读 confirmed | 未确认的选择立即改变屏幕 | WallpaperBackground selector |
| 选择/确认经真实控件→UI actor→kernel command→owner actor | 直接 reducer/state setter 或第二条调起路径 | picker + kernel |
| Image 只有 primitives 一处 RN seam | integration 或 render 各自引入 Image | ui/base/primitives |
| 背景是 SurfaceRoot children 中的绝对定位层 | 背景占普通流高度或被不透明容器遮挡 | integration + primitives |
| placement 只有 integration owner | picker、staff-auth、assembly 重复维护 catalog/placement | ui.integration |
| surfaceForm 只由 adapter 在 delegate 创建时决定一次 | JS 从宽度断点二次派生或运行中漂移 | adapter.android.dual-screen |
| displayIndex 选 host source，displayMode 选画布/placement | 主副屏索引与逻辑模式混用 | adapter + integration |
| layers 与 containers 使用独立 descriptor | 旧 containers 落盘格式改变或 layer 丢失 | kernel.base.ui-state |
| invalid layer 的 membership 清理不等于 availability 过滤 | 合法但当前不可见的 layer 被过早删除 | ui-state install actor |
| mobile 没有 SECONDARY surface | mobile 被错误创建副屏或渲染副屏文案 | integration + adapter |
| A3 的比较 oracle 已冻结 | 两屏 raw bitmap 不同尺寸时误用逐像素相等 | 需求正本 §9.3；本计划按三条行为断言执行 |

## 2. 首步：资产入口和类型声明预检（CP-0）

这是实施授权后的第一步，必须先于四个新包的完整实现。CP-0 已执行并记录在
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp0-execution-codex.md`。

### 2.1 目的

验证 workspace 内 feature 包的 .jpg 是否能被实际 Metro 消费，以及 TypeScript 是否需要
资产模块声明；结果决定 picker 的最小文件形态，不能凭经验新增全局声明或把图片复制进
assembly。

### 2.2 实施动作

| 顺序 | 动作 | 输出 |
| --- | --- | --- |
| 0.1 | 冻结当前工作区与运行 manifest；确认没有受管历史 runtime/runner 资源冲突 | run identity、资源预检、cleanup 起点 |
| 0.2 | 在已存在且已有生产 source 的 `apps/terminal/ui/feature/sample-staff-auth` 内建立临时 `src/__metro_probe__/probe.jpg` 与静态 `probe.ts`；临时从该包根导出 probe，并由已被 sample-terminal 消费的 `sample-console/src/assembly/assembly.tsx` 以静态 import 接入。不得创建 sample-wallpaper-picker 包、不得改 skeleton graph | probe source、资产许可/来源记录 |
| 0.3 | 用现有 `apps/terminal/assembly/android/sample-terminal/metro.config.js` 与现有 sample-terminal Expo entry 消费这条跨 workspace 静态 `.jpg` import；不使用未来 sample2、不使用动态 require | Metro log、resolved asset shape、first failure/last known good |
| 0.4 | 对 `sample-staff-auth` 的实际 tsconfig 执行配置观察，确认 `.jpg` import 是否已有 declaration；只有缺失时才在该 feature 包边界补最小临时 `src/__metro_probe__/assets.d.ts` 或该包 tsconfig include | tsc --showConfig/tsc --noEmit 输出、最小落点 |
| 0.5 | 若首败，先读取 Metro/TypeScript 日志，确认是 resolver、workspace boundary、声明作用域还是文件格式问题；在本批授权内修根因后重跑同一 probe | 修复前后证据 |
| 0.6 | 删除 probe 文件、临时根导出、sample-console 临时 import 和临时声明；静态确认无 probe 残留后，将结论回写 picker README、详设/计划的实际 asset type 位置，并把最终确切文件加入逐代码对账 | CP-0 reconciliation 行、probe-cleanup output |

### 2.3 CP-0 gate

只有下列条件全部具备，CP-0 才是 MATCHED：

 - 同一 workspace package 的真实静态 JPG import 已被 Metro 解析，并有 resolved asset shape；
 - 若发现当前配置确实不能解析，CP-0 保持 OPEN，必须附硬约束证据和根因诊断，不能把失败
   当作 MATCHED；
- probe 的静态 JPG module value 已被现有 sample-terminal Metro consumer 实际消费；未来
  `assetsById` 的 none/w1/w2/w3 映射留给 CP-4，并由独立 source oracle 与 focused proof 验证；
- TypeScript 的声明层是实际需要的最小 feature-package 作用域；未新增无依据的全局声明；
- 资产来源、许可证、尺寸、体积和 README 入口已确定；
- CP-0 的 business 与 cleanup 均有输出；
- 若出现硬约束，状态为 OPEN，不得进入“已通过实现”口径，并需给 Dexter 准确阻断说明。

CP-0 不实现 picker 行为，不创建 picker 包，不改变 kernel、ui-state、integration 的最终
产品行为或 Android。临时 consumer 接线只为真实 Metro 解析，完成后必须清除；首步实测也不
授权 Web/Android/DEV/release。

## 3. 分阶段实施计划

每个 CP 的共同规则：

1. 开始前逐项重读本计划对应的需求条款、详设锚点、项目记忆和 owning source；
2. 只由主 agent 修改文件；
3. 先写真实 red mutation 或红夹具，再写最小实现；
4. 执行本 CP 的 focused/static/native proof，读取日志并记录 cleanup；
5. 用同一组原文回读源码和证据，逐项核对 behavior、shape、action、relation、position、
   copy、state/control、failure/recovery、access/focus、data/invalidation；
6. 当前 CP 完成后，在进入下一 CP 前由 fresh 独立子 agent 做逐点三维对账。当前回合
   没有执行该独立审查，计划状态不能写 GO；
7. 任一 OPEN 不得被后续 CP 吸收。

### CP-1：图片度量支持、primitives 图片 seam 与透明容器

依赖：CP-0 MATCHED。

变更范围（同一 CP 内先完成证据工具，再完成 primitives；两者一起做本 CP 的 source/test
对账）：

- `tools/terminal-image-compare/compare.mjs` 与 `test/compare.test.mjs`
  - 只接受两张同尺寸 PNG、显式 ROI/mask metadata；输出 changedFraction、P95、meanAbsDiff、
    changedCellFraction；unsupported PNG、尺寸/ROI/mask 缺失一律失败关闭；
  - self-test 使用同尺寸但内容不同的仓内已知 PNG 覆盖 unchanged/changed 双向，另用不同
    尺寸 PNG 单独覆盖 fail-closed，并把阈值改坏的 mutation 弄红；已知 PNG 路径必须进入
    工具文件清单；
  - self-test 使用 `apps/terminal/assembly/android/sample-terminal/assets/`
    下的 `android-icon-background.png`、`android-icon-foreground.png` 和 `favicon.png`；
    8×8 反例 PNG 在测试内由固定字节生成，不依赖未登记的 canonical sample；
  - 工具不抓屏、不进入 TER runtime graph、不拥有设备或 Android 生命周期。

- apps/terminal/ui/base/primitives/src/vendor/slots.tsx
  - 新增 RnrImage，复用现有 RN value import/平台透传；
  - source、resizeMode、style/className、testID 的类型和传递与现有 vendor 形态一致；
  - 不恢复 showSoftInputOnFocus。
- apps/terminal/ui/base/primitives/src/components/PrimitiveImage.tsx
  - layout=thumbnail|background；
  - background 只消费 imageBackground；
  - source 缺失时返回 null，不把缺失资产伪装成 none 以外的图。
- apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx
  - 增加 layout=transparent；
  - 保留 flex/padding/gap，仅删除不透明 canvas 背景。
- apps/terminal/ui/base/primitives/src/theme/tokens.ts
  - 增加 imageBackground 与 containerTransparent；
  - 不修改默认 container 语义。
- apps/terminal/ui/base/primitives/src/index.ts
  - 导出 PrimitiveImage 与 props。
- apps/terminal/ui/base/primitives/terminal-invariants.json
  - 同步 public exports。
- 对应 focused tests、README 片段和包 typecheck。

gate：

- image-compare tool 的 known-PNG self-test 与 threshold mutation 均真实通过；
- `changedCellFraction` 的网格固定锚定 `canvasRect`，固定 `minUnmaskedFraction=0.25`；
  参与格子的 unmasked ROI 像素比例低于 0.25 时同时从分子和分母剔除，ROI/canvas 小于
  20% 或 mask 与 canvas 的交并面积超过 80% 时工具失败关闭；
- transparent token 的 seam-level mutation 会被 primitives focused test 弄红；完整的
  `F-A2a`（将 picker/waiting/welcome 改回 opaque 后以真实 wallpaper ROI 证明确认无变化）
  依赖后续 wallpaper consumer，在 CP-5/CP-9 首次 consumer 可运行后执行；CP-1 不把它
  伪装成已完成的真机证据；
- source 缺失的图片不渲染，不抛未分类异常；
- PrimitiveImage 不拥有 surface/display/workspace state；
- 既有 PrimitiveContainer default/card/centered 行为无回归；
- static export 与 invariant 集合一致。

### CP-2：kernel sample-wallpaper state 与命令

依赖：CP-1 只需通过其自身 gate；CP-2 与 CP-1 不并行。

新增包：

apps/terminal/kernel/feature/sample-wallpaper

建包与骨架同步是同一原子变更：在该 package.json 首次出现的同一批文件变更中，同时加入
`apps/terminal/skeleton-graph.ts` 的 `kernel.feature.sample-wallpaper` 节点，将
`tools/terminal-skeleton/check-static.mjs` 的期望更新为 `spec=28/batchOne=15/batchTwo=28`，
并同步 `check-static.test.mjs` 的对应断言；不得先让 package census 与 graph 长时间处于
不一致状态。CP-2 的骨架检查只在这组文件全部落地后运行。

文件/符号：

- package.json、tsconfig.json、中文 README.md、terminal-invariants.json；
- src/moduleName.ts：kernel.feature.sample-wallpaper；
- src/dependencies.ts：真实 import 集合；
- src/types/...：WallpaperId 与 WallpaperState；
- src/features/slices/...：wallpaperId 默认 none、可选 pendingWallpaperId；
- src/features/commands/...：select/confirm 命令；
- src/features/actors/...：闭合集合校验、无 pending typed failure；
- src/application/module.ts、src/index.ts；
- focused tests、red mutation 和公共 surface typecheck。

行为 gate：

- 选择不同项只写 pending；confirmed 和背景 selector 不变；
- 重复选择 effective 项不产生 kernel select；
- confirm 只在存在且不同的 pending 时改变 confirmed 并清 pending；
- 无 pending confirm 使用具名 ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING，不能被
  通用 completed 或未分类 exception 替代；
- invalid wallpaper id 在 owner 边界 typed reject，零状态写入；
- persist descriptor 的字段/默认值与现有 persistence policy 一致；
- 不引入图片 bytes、路径、React component、surface 或 placement 字段。

### CP-3：ui-state layers descriptor、还原与安装期清理

依赖：CP-2；不得与 CP-2 并行。

变更范围：

- apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts
  - 保留 containers descriptor；
  - 增加 layers record descriptor，MAIN/BRANCH × PRIMARY/SECONDARY 四格；
  - `isValidOpenedAt` 同时约束写入与还原：finite、positive、integer；
  - props 做 JSON 校验、clone、freeze；
  - applyEntries 在混合 containers/layers 存档下只替换 layers，必须保留既有 containers；
  - malformed row、duplicate layerId、非法时间分别记录 diagnostic 并按详设丢弃；
  - 缺少 layers 键还原为空数组，不破坏旧 containers。
- apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts
  - 将结构 diagnostic sink 限定在 module instance；
  - descriptor factory 显式携带 MAIN/BRANCH workspace，诊断不得丢掉该参数；
  - install 期 drain 到既有 logger；
  - catalog membership 清理由 install 期 actor/内部 command 承接，command payload 不带调用方
    预计算的 removals。
- apps/terminal/kernel/base/ui-state/src/features/contentActors.ts 与相关 command/dispatcher：
  - 非当前 workspace 的显式 payload 由内部清理路径处理；
  - UI 公开路径仍不直接 setter；
  - availability 过滤与 membership 清理分离。
- apps/terminal/kernel/base/ui-state/src/types/content.ts
  - 若当前字段类型需收紧，只按 LayerEntry 契约修改，不改变既有 public owner 边界。
- apps/terminal/kernel/base/ui-state/README.md：
  - 说明 layers prefix、兼容、诊断、known-but-unavailable 保留规则。
- 带 U-7 的 acceptance test、content test 与新增边界 focused tests。

场景 gate：

- 正常四格 layers 恢复顺序、props、openedAt；
- old archive 无 layers 键；
- duplicate layerId 保留先出现者；
- invalid props / invalid openedAt 只丢弃对应行并诊断；
- 合法 openedAt 写入后再 hydrate 不丢弃；混合存档下 containers 与 layers 同时保留；
- unknown part 在 MAIN 与 BRANCH 各一格、当前 workspace 取另一侧时均清理且 flush；
- known-but-currently-unavailable layer 保留并只在 render 过滤；连续两次启动不因 availability
  触发新增 flush/write；
- 业务 layer id/content 状态不因未知 layer 清理而改变；
- F-A5c/相关 red mutation 能使 layer persistence 断言真实变红；
- 无第二份 section list、无模块级可变注册表。

此 CP 的 catalog membership 检查必须明确发生在 hydrate 后、首帧出现前的 install 边界；
不能把它改成“当前不可见即删除”。

### CP-4：picker feature、资产和业务控件

依赖：CP-3；CP-4 为 CP-0 后的第四个源码阶段，顺序不可提前。

新增包：

apps/terminal/ui/feature/sample-wallpaper-picker

建包与骨架同步是同一原子变更：在该 package.json 首次出现的同一批文件变更中，同时加入
`apps/terminal/skeleton-graph.ts` 的 `ui.feature.sample-wallpaper-picker` 节点，将
`tools/terminal-skeleton/check-static.mjs` 的期望节点数更新为 29，并同步
`check-static.test.mjs` 的 `spec=29/batchOne=15/batchTwo=29` 断言；CP-4 只在这组文件全部
落地后运行骨架检查。

文件/符号：

- package.json、tsconfig.json、README.md、terminal-invariants.json；
- src/moduleName.ts、src/dependencies.ts、src/index.ts；
- src/foundations/assets.ts：静态 assetsById；
- assets/w1.jpg、assets/w2.jpg、assets/w3.jpg；
- `src/types/assets.d.ts`（CP-0 已实测需要 consumer-visible declaration，必须纳入 picker source
  program）；
- src/components/WallpaperPicker.tsx、WallpaperBackground.tsx；
- src/features/commands、src/features/actors；
- src/parts/parts.ts；
- src/foundations/wallpaperPickerTestIds.ts；
- focused tests。

行为 gate：

- 四个真实 radio/press 节点分别绑定稳定 testID、标题、缩略图和 selected；
- 选项来自 assetsById，没有第二份图片清单；
- effective = pending ?? confirmed；
- actor 对相同 effective 只 completed/no-op，不派 kernel select；
- 不同项只派 select；confirm button 的 enabled 由 pending 与 confirmed 派生；
- confirm actor 不绕过 kernel；
- WallpaperBackground 只读 confirmed，none 返回 null，非 none 从同一 map 解析；
- transparent container 应用于 picker/waiting/welcome；
- A2d/WP-F01 的期望资源来自独立的 `WallpaperId` 枚举与直接 fixture import，不重新读取
  被变异的 `assetsById`；
- A2d 逐张确认 w1/w2/w3，并对每个有序对 (wi,wj) 比较确认后的壁纸 ROI；比较复用 A2
  确认侧的同一工具、metadata 与四项阈值，所有有序对都必须确有差异，不能只靠 identity；
- confirm 后 pending 必须清除，WP-F08/WP-F09 的 F-A5d mutation 必须真实弄红；
- F-A2b、F-A2c、F-A2 均能让相应 focused/Android 判据变红。

### CP-5：sample2 integration placement、双屏背景和红主题

依赖：CP-4；不得与 CP-4 并行。

新增包：

apps/terminal/ui/integration/sample-wallpaper-console

建包与骨架/分层同步是同一原子变更：同时加入 `apps/terminal/skeleton-graph.ts` 的
`ui.integration.sample-wallpaper-console` 节点，将 skeleton 期望更新为
`spec=30/batchOne=15/batchTwo=30`，并同步 `check-static.test.mjs`；同时更新 layering 的
integration 分母及其独立目录 census 测试。
不得先创建 package.json 再把 graph/layering 修改拖到 CP-8。

文件/符号：

- package.json（含 main、react-native、exports、`./theme/global.css` 和完整
  `terminalSurfaces`）、tsconfig.json、README.md、terminal-invariants.json；
- `@catering-v2s/ui-base-dev-host` 仅作为 `test-expo/App.tsx` 的 `devDependency`；它不进入
  integration 的生产 `dependencyModuleNames`，但必须同时出现在 graph 与 `src/dependencies.ts`
  的开发依赖集合中；
- index.js、metro.config.js、babel.config.cjs、nativewind-env.d.ts、theme/global.css.d.ts
  （仅在实际 typecheck 证明需要时保留）；
- src/moduleName.ts、src/dependencies.ts、src/index.ts；
- src/assembly/assembly.tsx；
- src/parts/parts.ts；
- src/features/actors/actors.ts、src/application/module.ts；
- src/application/terminalSurfaces.ts、src/application/baseModuleDescriptors.ts；
- theme/global.css、tailwind.config.cjs；
- theme、assembly focused tests。

`tools/terminal-layering` 的 integration census 在本 CP 同批改为接收 integration root，运行时
枚举其中直接含 `package.json` 的目录并读取各包 moduleName/层级元数据，不再把
`sample-console` 或 sample2 名称硬编码成预期集合。其静态测试使用隔离 fixture root：加入一个
合法 package 后集合必须增加，删除/漏枚举该目录的 mutation 必须变红；fixture 在测试结束清理，
不进入产品 graph。

实现边界：

- 合并 staff-session、staff-auth、picker 和两个副屏 part 到一个 UiCatalog；
- 将 `ui.base.admin-shell` 作为工作区依赖与静态 module dependency 声明；在同一个 UiCatalog
  中装入 `...adminShellAssembly.parts`，并让每个生产 surface 的 content frame 由
  `<AdminLauncher canvas={declaredSize}>` 包住；不得在 integration 复制 admin 常量、layer
  command 或入口。
- 只由 integration 负责 placement；
- login/restored authenticated → PRIMARY picker；
- login/restored anonymous → SECONDARY waiting；
- login/restored authenticated → SECONDARY welcome；
- PRIMARY/SECONDARY 均传同一 confirmed selector 驱动的 WallpaperBackground；
- picker、waiting、welcome 的 container 为 transparent，background 在普通内容后方；
- 主屏/副屏不重复创建 catalog、background stack 或 open path；
- laptop 绑定 1280×800/960×540，所有 integration 包的 mobile 只绑定 360×640 PRIMARY；
  360×640 必须在 `sample-console` 与 `sample-wallpaper-console` 的
  `package.json.terminalSurfaces.orientations.portrait.PRIMARY` 中逐包声明；Android mobile VM
  的 720×1280 是物理屏幕尺寸，不属于 integration 逻辑画布声明；
- placement 与 A3 的三条现行行为断言按需求正本执行，不保留旧的 candidate/open 选择。

红主题 19 token 必须按详设值落地，并在实际渲染上下文测试：

- action：rgb(159 18 57)，仅用于品牌 action/selected；
- action-foreground：rgb(255 255 255)，仅用于 action 上的中性文字；
- error-foreground：rgb(185 28 28)，仅用于错误提示文字；
- canvas/surface/foreground/muted-foreground/border；
- ok、warn、error、info 各 foreground/background/border；
- action 的 HSL 及 action-foreground 对比度满足需求 predicate；
- action 与 error 保持不同语义和色相，不得把错误色当选中态；
- ok/warn/info 保留既有色相。

### CP-6：dual-screen Android 形态和 launch options

依赖：CP-5；不得与 CP-5 并行。

变更 owner：

apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt

以及对应 native tests、中文 README/诊断说明（若包已有 README）。

实施形态：

- 在 `onDidCreateReactActivityDelegate` 生命周期内读取
  `activity.resources.configuration.smallestScreenWidthDp`；当前 window 的
  `displayMetrics.widthPixels/heightPixels` 只用于诊断，不能参与形态判定；
- CP-6 首个 native preflight 先从两台 VM 记录 mobile=`m`、laptop=`l`，要求正整数且
  `m < l`，将唯一阈值冻结为 `floor((m + l) / 2) + 1`；`smallestScreenWidthDp >= threshold`
  为 laptop，否则为 mobile；值为 0/未定义/异常时 typed diagnostic + laptop fallback；
- 方向只在 decision 之后用于 `setRequestedOrientation`，不作为 classifier 输入；
- 在本次 delegate 创建周期冻结 SurfaceFormDecision；
- 主 Activity 通过已存在方向 API 锁定；
- 由 adapter 内一个 `createSurfaceLaunchOptions(displayIndex, displayCount, surfaceForm)`
  helper 生成 Bundle；PrimaryLaunchOptionsDelegate 与 secondary surface 都调用该 helper，
  不保留两处独立字面量；
- secondary 不重新判定；
- 后续 onConfigurationChanged 仍可转发给宿主，但不得重算/重发；
- 真的 activity/delegate 重建才重新读取。

需求 §5.2.1 冻结的是主设备逻辑尺寸/方向到 laptop 或 mobile 的外部结果；本计划采用
`Configuration.smallestScreenWidthDp` 作为不受本应用方向锁反馈影响的稳定读取字段。若复评
把需求中的 `DisplayMetrics` 类名视为强制 API，而非逻辑尺寸描述，必须在实施前回报需求文字
与计划字面不一致；不得在代码中静默改成另一种产品判定。

非常规形态按详设：

- split-screen、fold/unfold 若只有 `onConfigurationChanged`，保持已冻结的 surfaceForm，不重算
  或重发 Bundle；
- 真正 Activity/React delegate 重建时才重新读取 smallestScreenWidthDp；
- 不额外接入 hinge/posture API；
- mobile 不创建副屏。

gate：

- native unit 覆盖 mobile/laptop 两个 calibrated smallestScreenWidthDp 值、阈值边界、
  0/未定义/异常 fallback，以及仅 configuration change 不重算；
- native unit 还必须逐分支覆盖 `readDisplaySnapshot` 的 primary-only/无 secondary 返回、
  snapshot 缺失诊断和正常双屏返回；不能用最终 surfaceForm 断言替代这些早退路径；
- laptop VM 真实 display/window/surfaceForm/orientation/双屏 Bundle；
- mobile VM 真实 720×1280、single surface、无 SECONDARY；
- configuration change 不改变已冻结形态；
- adapter 不在 sample2 assembly 再判一次；
- 既有 secondary surface creation 仍使用主形态传播。

### CP-7：sample2 assembly、Expo 入口与既有 sample-terminal 回归

依赖：CP-6；不得与 CP-6 并行。

新建：

apps/terminal/assembly/android/sample-wallpaper-terminal

新 package.json、assembly 入口与 graph 节点是同一原子变更：同时加入
`assembly.android.sample-wallpaper-terminal`，把 skeleton 节点期望更新为 31，并同步
`check-static.test.mjs` 的 spec=31、batchOne=16、batchTwo=31 断言；同时把该 assembly 加入
reachability 的实际入口集合。CP-8 不能再承担这些基础集合修补，只负责最终运行门与 mutation。

计划文件：

- package.json、tsconfig.json、README.md；
- App.tsx、index.ts；
- src/assembly/platformPorts.ts、assembly entry/module；
- app.json、metro.config.js、babel.config.cjs；
- nativewind-env.d.ts 与 CP-0 实测需要的最小类型声明；
- theme import、启动诊断和 platform port wiring；
- Expo 生成的 Android project 文件只在实际 prebuild 后按精确 census 纳入对账。

同时修改：

apps/terminal/assembly/android/sample-terminal/app.json 的 orientation 与
apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
的 screenOrientation 两处方向锁，并补既有 sample App 回归。

assembly 不拥有 wallpaper state、asset registry、placement 或第二 Image seam。
它只负责 port 绑定、入口、Android 工程、launch options 连接、application id/namespace/slug
隔离和显式 surfaceForm/displayIndex 参数传递。

gate：

- sample2 entry 可达、创建一个 React host/一个 store/一个 runtime；
- laptop/mobile 的 surfaceForm 由 launch option 显式传到 assembly；
- Web dev-host 可用显式 URL/prop 选 laptop/mobile，但不冒充 Android 形态；
- sample-terminal 既有完整旅途、两个屏幕方向行为和业务状态没有回归；
- Expo/Android 生成物的实际文件集合进入计划 reconciliation；
- 不把配置失败吞成默认 laptop，只有缺失正常 launch option 的批准 fallback 才可用。

### CP-8：骨架、分层、公共导出和静态门

依赖：CP-7；不得与 CP-7 并行。

变更范围：

- 复核 CP-2/CP-4/CP-5/CP-7 已随建包原子同步的
  `apps/terminal/skeleton-graph.ts`、`tools/terminal-skeleton/check-static.mjs`、
  `tools/terminal-skeleton/check-static.test.mjs`；本步不再延后基础 node/count 修补；
- tools/terminal-skeleton/check-static.mjs：最终节点字段、sample2 entry reachability 与无环；
- tools/terminal-layering/check-static.mjs：真实 integration 目录 census、P-5c/P-5d 及
  independent add/delete directory mutation；mutation 直接改变隔离 fixture root 的目录集合，
  不以修改预期数组自证；
- 相关静态/red tests、README/export/invariant 对账。

gate：

- graph 实际节点集合与四个新 package 的 moduleName 集合相等；
- package.json dependencies、src/dependencies.ts 和实际 import 的差集为空；
- assembly entry reachability 真能从 sample2 入口到达 integration；
- uiNativePackages 与实际 integration package 集合相等；
- census 从实际 integration root 枚举 package.json 目录，加入或删除一个隔离 fixture package
  会分别改变结果，硬编码 `sample-console` 的实现必须被 mutation 弄红；
- 31 节点不是硬编码自证，测试必须在 mutation 删除 package 或漏声明 graph 时变红；
- 不新增第二 registry、toolkit/owner 误标或 journey 命名目录。

### CP-9：整批证据、逐代码对账和交付收口

依赖：CP-0 至 CP-8 每一阶段 gate、三维独立对账和 cleanup 均 MATCHED。

顺序：

1. static：source/export/package/graph/asset/license/README/descriptor 结构；
2. focused：真实控件动作、actor/command、selector、状态机、persistence parser 和
   red mutations；
3. native：Android Kotlin unit、launch option 与 configuration freeze；
4. Android：先 laptop 双屏，再 mobile 单屏；每个业务 run 后独立 cleanup；
5. release：只有取得 release 授权后执行；不能用 debug/Android 证据替代；
6. visual：按需求正本已冻结的 A3 三条 oracle 和 §5 截图方法，不把文本完整或 focused
   结果扩写成视觉 PASS。

CP-9 已启动：CP-7 的两台 VM、既有 sample-terminal 回归及部分 ROI 证据已取得并写入
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-execution-codex.md`；本回合又补充
了 laptop 认证态冷启动 A4、F-A9_RUNTIME 的真实 mobile red fixture，以及各自的独立 cleanup
证据 `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-a4-cleanup-codex.md` 与
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a9-runtime-cleanup-codex.md`；另补充
了同一滚动与几何下当前字节的 laptop 主/副屏 fresh w1↔w2 ROI 对，见
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-current-a3-pair-codex.md`。
完整 A/F 矩阵、Web/release 和最终逐代码收口仍保持 OPEN，不能把本段执行结果写成完整验收。

## 4. 十一个产品 touched positions、一个证据支持位置的顺序与依赖

CP-0 是无最终源码变更的资产预检，不计入需求的 11 个产品 touched positions。图片度量
工具是第 12 个、仅服务于证据的支持位置，不进入 TER runtime graph，也不改变产品分母。
`apps/terminal/skeleton-graph.ts` 属于 tools/terminal-skeleton 位置的跨文件图源，不再
从源文件清单中漏列。源码 positions 的产品顺序保持需求正本 §7 的语义；跨文件 gate 更新
随对应建包 CP 原子发生：

| 执行序 | touched position | 进入 CP | 前置 | 不能反转的理由 |
| --- | --- | --- | --- | --- |
| 1 | kernel/feature/sample-wallpaper | CP-2 | CP-0、CP-1 | picker 的 command 入参和 persistence 字段必须先冻结 |
| 2 | ui/feature/sample-wallpaper-picker | CP-4 | CP-3 | picker 要消费真实 kernel slice、Image seam 和资产解析结论 |
| 3 | ui/integration/sample-wallpaper-console | CP-5 | CP-4 | placement/catalog 只能在所有 parts 与 picker public surface 已存在后接线；同一 catalog 必须接入共享 admin parts，surface 必须使用 AdminLauncher |
| 4 | assembly/android/sample-wallpaper-terminal | CP-7 | CP-6 | 入口必须消费 adapter 的冻结 surfaceForm |
| 5 | ui/base/primitives | CP-1 | CP-0 | picker/transparent container 不能先产生第二套图片或容器实现 |
| 6 | ui/feature/sample-staff-auth | CP-5 | 既有 parts + integration owner | 只改宿主中立描述，不能先改既有业务行为 |
| 7 | kernel/base/ui-state | CP-3 | kernel content/state 当前契约 | layers 还原必须先于 integration 的 layer/placement 使用 |
| 8 | adapter/android/dual-screen | CP-6 | integration 需要明确 display form contract | 形态决定不能下沉给 App 或在多个入口重复判定 |
| 9 | assembly/android/sample-terminal | CP-7 | adapter 新形态路径可回归 | 删除方向锁后必须马上接既有旅途回归 |
| 10 | tools/terminal-skeleton（含 `apps/terminal/skeleton-graph.ts`） | CP-2/4/5/7 同步，CP-8 收口 | 各建包 CP | package census、graph 节点/count 与 entry reachability 必须由真实集合校验 |
| 11 | tools/terminal-layering | CP-5 同步，CP-8 收口 | integration package 已落地 | 分层分母必须按真实目录枚举，不能靠 fixture 硬编码 |
| 12 | tools/terminal-image-compare（证据支持） | CP-1 | CP-0 的截图方法契约 | 定量 ROI 指标必须有可运行实现与 known-PNG self-test |

同一 CP 内不得按文件并行造成中间态。每个 position 的实际变更文件、唯一符号和证据
在 §5 对账表中逐项登记；新增文件不能因为不在需求的旧清单中而不登记。

## 5. 逐代码与详设对账硬闸

以下表从实施前的设计对账清单演化为当前逐代码对账表；每行状态均按实际源码与证据更新。
未关闭项保持 OPEN，不是“按计划等价于通过”，任一 OPEN 都禁止交付 implementation acceptance。
实施时必须把每个实际改动文件拆成独立行；不得以 count、package 已覆盖或未运行替代。

允许的状态只有 MATCHED 和 OPEN。

| 对账域 | source/test/package/README/evidence 实际对象 | 需求 ID | 详设锚点 | 三维行为对照 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| primitives source | slots.tsx:RnrImage、PrimitiveImage.tsx:PrimitiveImage、PrimitiveContainer.tsx:transparent、tokens.ts:imageBackground/containerTransparent | A1,A2,F-A2a | 详设 §3.1、CP-1 | 结构、可见背景、动作节点、透明层关系；F-A2a mobile 真机 ROI 变异已命红 | MATCHED（CP-1/CP-9） |
| primitives public | src/index.ts、terminal-invariants.json | A1,A7 | 详设 §3.1、§6.3 | export 集合与实际 import 一致 | MATCHED（CP-1） |
| primitives tests | CP-1 focused/red tests | A2,F-A2a | 详设 §8.4 | 默认 opaque 变异必红，source 缺失不误渲染；mobile 真机 F-A2a ROI 与 F-A2b UI/XML 变异均已命红 | MATCHED（CP-1/CP-7/CP-9；完整 A/F 矩阵仍 OPEN） |
| input event boundary | `ui/base/input/src/components/InputSurfaceFrame.tsx` 的 `InputSurfaceFrameContents`、`test/provider.test.tsx` | A1,A2,A4,A8 | 详设 §2.3、§2.4；CP-7 physical scroll diagnosis | 普通 `View` 只做 native touch start/end 的被动短点按观察与 Web click 观察，不参与 responder 竞争；确认按钮可经真实滚动进入操作区；没有第二套滚动机制 | MATCHED（CP-7 focused + 当前 Android supporting） |
| input keyboard descendant boundary | `ui/base/input/src/components/VirtualKeyboard.tsx`、`test/provider.test.tsx` | A1,A8 | 详设 §2.3、§2.4；CP-7 keyboard event diagnosis | 虚拟键盘根节点在 native `onTouchEnd`、Web `onClick` 阻断向 surface observer 冒泡；真实数字键保持键盘与输入状态，非输入 surface 点按仍收键盘 | MATCHED（focused + 当前 Android supporting） |
| kernel package | sample-wallpaper package.json/tsconfig/moduleName/dependencies/index/README | A2c,A5,A5b | 详设 §3.2、CP-2 | owner、命令、依赖、文案和失败边界一致 | MATCHED（CP-2） |
| kernel state | slice、field descriptors、selectors | A2d,A5b,A5d | 详设 §3.2 | confirmed/pending 单源、默认 none、持久字段一致 | MATCHED（CP-2） |
| kernel commands | select/confirm command 与 actor | A2c,F-A2c | 详设 §2.4、CP-2 | 控件→command→actor→state，typed code 零写入 | MATCHED（CP-2） |
| kernel tests | focused/red tests | A2c,A5b,F-A5,F-A5b | 详设 §8.3/8.4 | 反向变异真实弄红 | MATCHED（CP-2） |
| ui-state source | workspaceSlices.ts descriptors/parser/diagnostic sink | A5c,F-A5b | 详设 §3.3、CP-3 | 旧档、顺序、重复、非法行、四格恢复；applyEntries 保留 containers；openedAt 读写同一 validator | MATCHED（CP-3） |
| ui-state install | createUiStateModule.ts install actor/internal command | A5c | 详设 §3.3.2/3.3.3 | hydrate→membership prune→首帧，非当前 workspace 也正确；payload 不带预计算 removals | MATCHED（CP-3） |
| integration admin baseline | sample-wallpaper-console/package.json、src/dependencies.ts、assembly/assembly.tsx、sample2Assembly.test.tsx；同仓 sample-console 对照 | TR-13 | 详设 §1.1、§6.1/6.2 | 声明、单 catalog 的 adminShellAssembly.parts、生产 AdminLauncher、laptop/mobile primary 可渲染 | MATCHED（CP-5/CP-7 static+Android supporting） |
| ui-state tests | U-7 acceptance、content tests、boundary tests | A5c,F-A5b | 详设 §3.3.4、§8.1 | 业务层/containers 保留、unknown 清理、known unavailable 只过滤不反复 flush | MATCHED（CP-3） |
| picker package | package.json/tsconfig/moduleName/dependencies/index/README | A1,A2d,A7 | 详设 §3.4、CP-4 | feature owner、不建 slice、公开 API 与 README 一致 | MATCHED（CP-4） |
| picker assets | foundations/assets.ts、三张 JPG、CP-0 结论与 types/assets.d.ts | A1,A2d,F-A2b | 详设 §3.4、CP-0 | 静态 map、许可、type scope、undefined 变异必红；真实 mobile XML 缺失 thumbnail | MATCHED（CP-0/CP-4/CP-7；完整 A/F 矩阵仍 OPEN） |
| picker UI | WallpaperPicker.tsx、testIDs、WallpaperBackground.tsx | A1,A2,A2b,A2d | 详设 §2.3/3.4 | 四项、位置、selected/enabled、confirmed-only background | MATCHED（CP-4/CP-7） |
| picker actor/tests | commands、actors、focused tests | A2b,A2c,F-A2c,F-A2 | 详设 §2.4、§8.4 | no-op 不派发 kernel change command、不同项只 pending、背景不先变 | MATCHED（CP-4/CP-7；sample2 focused red 已由 `tools/terminal-sample2/check-behavior.mjs` 复跑） |
| integration package | package.json（含 terminalSurfaces/main/react-native/exports）、index.js、tsconfig/moduleName/dependencies/index、src/application/terminalSurfaces.ts、baseModuleDescriptors.ts、metro/babel/nativewind、README | A3,A4,A7,A9 | 详设 §3.5、§6.3、CP-5 | 单 catalog、owner、surface placement、360×640 portrait 声明、README | MATCHED（CP-5/CP-7；full A/F OPEN） |
| integration parts | assembly/parts/actors/module、waiting/welcome | A3,A4,A9,F-A3a,F-A3b | 详设 §2.1/3.5 | PRIMARY picker、SECONDARY waiting/welcome、同一 selector、mobile 无副屏 | MATCHED（CP-5/CP-7/CP-9；F-A3a/F-A3b 真实 secondary ROI 变异已命红） |
| integration theme | global.css/tailwind/theme tests | A7,A7b,F-A7 | 详设 §3.8、CP-5 | 19 token、红强调色、error 语义分离、AA | MATCHED（CP-5/CP-7；focused red 已由 `tools/terminal-sample2/check-behavior.mjs` 复跑，设备数值证据 OPEN） |
| staff-auth source | ui/feature/sample-staff-auth/src/parts/parts.ts login description | A4,A8 | 详设 §3.5 | 宿主中立文字，不偷移 owner/placement | MATCHED（CP-5） |
| Android adapter source | TerminalDualScreenActivityHandler.kt delegate/form/Bundle/config | A6,A9 | 详设 §3.7、CP-6 | smallestScreenWidthDp classifier、阈值、一次冻结、主→副屏同一 helper、无二次判定 | MATCHED（CP-6 evidence） |
| Android adapter tests | Kotlin native tests 与 red config mutation、display snapshot branch tests | A6 | 详设 §3.7、CP-6 | calibrated values/boundary/invalid fallback/config-change 不重算、Bundle helper 一致、primary-only/dual/missing/failure 分支 | MATCHED（CP-6 evidence） |
| sample2 assembly | Expo entry/ports/app.json/metro/babel/README/diagnostics | A1-A9 | 详设 §3.6、CP-7 | 入口可达、单 runtime/store、显式 surfaceForm；focused red 已由 sample2 runner 复跑；全量 A/F 仍按 evidence | MATCHED（CP-7 static+Android partial） |
| sample2 Android generated set | CP-7 实测 prebuild 后的精确文件 census；与 sample-terminal 生成源集合做 package path 归一化对账 | A6,A8 | 详设 §6.3、CP-7 | 生成物与 package/entry/manifest 对账，56/56 文件差集为空 | MATCHED（CP-7 reconciliation；不外推 release） |
| sample-terminal source | app.json、AndroidManifest、既有 App 回归 tests | A8 | 详设 §3.6、CP-7 | 删除方向锁且既有完整旅途不回归 | MATCHED（CP-7 Android A8） |
| skeleton source/tool | apps/terminal/skeleton-graph.ts、check-static.mjs、static/red tests | A9 | 详设 §6.2、CP-2/4/5/7/8 | 28→29→30→31 节点与各 batch 计数随建包 CP 原子更新；fields、entry reachability、无环 | MATCHED（CP-8 static/red） |
| layering tool | check-static.mjs、static/red tests | A9 | 详设 §6.2、CP-5/8 | uiNativePackages 与真实 integration 目录集合一致；删除目录 mutation 必红 | MATCHED（CP-8 static/red） |
| screenshot measurement support | tools/terminal-image-compare/compare.mjs、test/compare.test.mjs | A2,A3,A4,A6,A8,A9 | 详设 §5、CP-1、CP-9 | ROI/mask/geometry 校验、四指标、known-PNG 双向 self-test 与 mutation | MATCHED（CP-1/CP-7；完整 A/F ROI OPEN） |
| sample2 red mutation support | `tools/terminal-sample2/check-behavior.mjs`；F-A9_RUNTIME 另由 CP-7 受控 runtime mutation 记录 | F-A2,F-A2a,F-A2c,F-A3a,F-A3b,F-A5,F-A5_RUNTIME（补充变异）,F-A5b,F-A5d,F-A7,F-A9,F-A9_RUNTIME（补充变异） | 详设 §8.4、CP-7/CP-9 | 三个 package baseline、sample2 focused red mutation、恢复后 baseline 与精确 cleanup；F-A2a/F-A3a/F-A3b/F-A5d/F-A5_RUNTIME/F-A9_RUNTIME 真实 Android 变异 | MATCHED（focused red + F-A2a/F-A3a/F-A3b/F-A5b/F-A5d/F-A5_RUNTIME/F-A9_RUNTIME Android red；原 F-A5 非法 descriptor 变异仅 runtime rejection，完整动态矩阵仍 OPEN） |
| package/Gradle | sample2 assembly `package.json`、`app.json`、Android `build.gradle`、Manifest、Kotlin package、`settings.gradle`、`strings.xml` 与 5 张资产 | A6,A8,A9 | 详设 §3.6、§6.3、CP-7 | identity、资产 hash、Manifest 入口和生成集合均已实际 reconciliation | MATCHED（CP-7；release 未执行） |
| README/evidence | 四新包 README、adapter/sample-terminal README（若实际有变更）、CP evidence | TR-10,A1-A9 | 详设 §6.4、§5.3 | 示例回源码、失败/恢复/迭代指引、证据档位真实 | MATCHED（CP-0～CP-7 docs；full evidence OPEN） |
| cleanup evidence | `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5d-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-a4-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5-runtime-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a9-runtime-cleanup-codex.md`、`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-current-a3-pair-cleanup-codex.md` | A1-A9 | 详设 §7.4、计划 §8.3 | 各 run owned Android package 与 Metro session 精确停止、absence readback；不触碰未知进程 | MATCHED（CP-7 cleanup） |

实施者不得将本表的 OPEN 改成 MATCHED 而不附实际源码符号和证据路径。任何实际新增的
source/test/package/Gradle/README/evidence 文件若不在本表，必须先补行再继续；这只是
对账表的完整性要求，不是扩大产品范围。

## 6. 全场景测试计划与交叉矩阵

### 6.1 测试用例索引

实现后用例编号沿用详设，避免用 Journey 编号命名 runtime 文件：

| 用例 | 档位 | 必须完成的场景与 oracle |
| --- | --- | --- |
| WP-F01 | focused | none/w1/w2/w3 四个真实选择控件；source、selected、effective、testID |
| WP-F02 | focused | 重复点击已选项与已确认项；picker actor 无 kernel select |
| WP-F03 | focused | 选择只改 pending；confirmed/background 不变；确认后才派 command |
| WP-F04 | Android | laptop 主屏选择四种壁纸；确认前/后真实 ROI 差异 |
| WP-F05 | Android | laptop 双屏同一 confirmed source；副屏 waiting/welcome；两屏 ROI 各自变化、identity 相同、换图后二次各自变化 |
| WP-F06 | Android/native | mobile integration 逻辑画布 360×640、VM 物理屏幕 720×1280、单主屏、无 SECONDARY、可选/确认；读取 surface count 与 dispatch journal，SECONDARY mutation 必红 |
| WP-F07 | focused/native | 无 pending confirm 的具名 typed failure、零写入、零子命令 |
| WP-F08 | focused+Android | confirmed 后重启，confirmed/pending/background/picker 恢复；覆盖已认证启动、确认后登出再冷启动 |
| WP-F09 | focused+Android | confirmed w2 后选择 w3 不确认重启，pending 与未生效背景恢复；覆盖未确认启动与界面恢复 |
| WP-F10 | focused | 四格 layer descriptor 顺序/props/openedAt 重启恢复 |
| WP-F11 | focused | old no layers、duplicate layerId、invalid props、invalid openedAt |
| WP-F12 | focused | MAIN/BRANCH unknown layer，当前 workspace 在另一侧，清理+flush |
| WP-F13 | focused | known-but-currently-unavailable layer 保留，只被 render 过滤；连续重启无 availability-only flush |
| WP-F14 | Android | anonymous/authenticated/login/logout/cold startup placement |
| WP-F15 | focused+Android | 19 token 精确值、实际渲染 action/error、AA、ok/warn/info 色相；蓝色取值 mutation 必红 |
| WP-F16 | Android | sample-terminal 既有完整登录、会员、新建/确认、logout；在已认证、存在 pending、登出后三个边界分别冷重启并核对既有业务状态与 placement |
| WP-F17 | static+focused+native | package/import/graph/layering/README/asset type 集合对账；image-compare known-PNG self-test 与 mutation |

### 6.2 壁纸维度

| 壁纸值/动作 | WP-F01 | WP-F02 | WP-F03 | WP-F04 | WP-F08 | WP-F09 |
| --- | --- | --- | --- | --- | --- | --- |
| none | 初始/选择/确认 disabled | 已选重复点击 | pending/confirm no-op | 从图片切回 none | confirmed none 重启 | pending none 重启 |
| w1 | source/selected | 已选重复点击 | pending→confirm | unchanged/changed | confirmed w1 重启 | w1→w3 未确认 |
| w2 | source/selected | 已选重复点击 | pending→confirm | unchanged/changed | confirmed w2 重启 | confirmed w2→pending w3 |
| w3 | source/selected | 已选重复点击 | pending→confirm | unchanged/changed | confirmed w3 重启 | pending/confirmed |
| 选择、确认、重复已选、重复已确认 | — | 主要证明 | 主要证明 | 真实画面 | 重启对账 | 未确认恢复 |

### 6.3 形态、会话、重启和回归

| 维度 | 覆盖用例 | 预期/不覆盖理由 |
| --- | --- | --- |
| laptop 双屏 | WP-F04、F05、F08-F14、F16 | 真实主副屏、相同 confirmed source、副屏文案 |
| mobile 单屏 | WP-F01、F03、F06、F08、F09、F14 | 只验证 PRIMARY；需求明确不验副屏 |
| 未登录 | WP-F01、F05 waiting、F14 | 主屏登录/副屏 waiting |
| 登录成功 | WP-F03-F06、F14 | picker/welcome |
| 登出 | WP-F14、F16 | 主屏回登录、副屏回 waiting，壁纸策略按需求 |
| 冷启动匿名 | WP-F14 | 认证前状态和副屏 waiting |
| 冷启动已认证 | WP-F08、F09、F14 | persisted session/content |
| 已确认后重启 | WP-F08 | confirmed/background/picker |
| 未确认后重启 | WP-F09 | pending 与界面恢复，background 不提前切换 |
| 浮层恢复 | WP-F10-F12 | 合法恢复、异常诊断、workspace 清理 |
| 既有 sample App 完整旅途 | WP-F16 | 方向锁/ui-state 改动不得破坏既有业务 |

### 6.4 边界、workspace 与红夹具

| 边界 | 用例 | 必须断言 |
| --- | --- | --- |
| 无 pending 直接确认 | WP-F07 | typed code、非 completed、零 state write、零 child command |
| 未知 wallpaper id | WP-F11/WP-F17 | command/parse typed reject，不渲染伪造 source |
| 旧存档无 layers | WP-F11 | layers=[]，containers 正常，无无依据 error |
| duplicate layerId | WP-F11 | 保留先出现者、后者丢弃、diagnostic |
| invalid props | WP-F11 | 仅该行丢弃，其他合法行恢复、diagnostic |
| invalid openedAt | WP-F11 | 非正整数/非 finite 丢弃、diagnostic |
| legal openedAt round-trip | WP-F10 | `Date.now()` 正整数写入后 hydrate 保留，不被 restore validator 误丢弃 |
| mixed containers + layers archive | WP-F10/WP-F11 | layers apply 后既有 containers、顺序与内容仍逐字保留 |
| invalid MAIN layer、当前 BRANCH | WP-F12 | MAIN 清理，切回不复活 |
| invalid BRANCH layer、当前 MAIN | WP-F12 | BRANCH 清理，切换不复活 |
| F-A2a opaque container | WP-F04 | wallpaper ROI confirmed 后应变而不变的断言必红 |
| F-A2b w2 source undefined | WP-F01/WP-F04 | 独立 w2 期望资源与 render-ready 断言必红，不得重新读取被变异的 assetsById |
| F-A5 persistIntent never | WP-F08 | confirmed restart 丢失必红；当前字节该非法变异先被 runtime descriptor 不变量拒绝 |
| F-A5_RUNTIME confirmed field persistence loss | WP-F08 | confirmed restart 丢失必红；已在 `emulator-5556` 真实 Android 上执行并命红 |
| F-A5b remove pending descriptor | WP-F09 | 未确认选择/界面恢复必红 |
| F-A2c remove equality guard | WP-F02 | 重复选择 command count 必红 |
| F-A2 background reads pending | WP-F04 | 未确认阶段 ROI 先变必红 |
| F-A7 blue theme | WP-F15 | 解析 global.css 的精确 RGB/HSL 与实际 action/error 上下文断言必红 |
| F-A3a omit secondary background | WP-F05 | SECONDARY ROI 不变化或无 render-ready identity，A3(a) 必红 |
| F-A3b hardcode secondary asset id | WP-F05 | 换另一张确认后 secondary ROI/identity 不再与 PRIMARY 一致，A3(b)(c) 必红 |
| F-A5d keep pending after confirm | WP-F08/WP-F09 | 确认后重启 pending 仍存在，A5d 必红；真实 Android MMKV storage mutation 已命红 |
| F-A9 create secondary on mobile | WP-F06 | mobile surface count/dispatch journal 出现 SECONDARY，A9 必红；原 guard-only 变异未到达入口，补充 F-A9_RUNTIME 已在真实 `emulator-5556` 日志出现 SECONDARY surface/root |

### 6.5 A 判据逐条落点

| 判据 | 实际用例 | 证据档位 |
| --- | --- | --- |
| A1 | WP-F01、F03、F04 | focused、Android |
| A2 | WP-F04 | Android screenshot ROI |
| A2d | WP-F01、F04 | focused 独立 source identity；同一运行内 w1→w2、w2→w3 的 Android render-ready/ROI
  compare 使用 A2 确认侧同一工具、metadata 与四项变化阈值，且连续确认均确有差异 |
| A2b | WP-F03 | focused real button enabled/disabled |
| A2c | WP-F07 | focused/native typed failure and zero write |
| A3 | WP-F05 | Android；三条已冻结 oracle：两屏各自变化、identity 相同、换图后二次各自变化 |
| A4 | WP-F05、F14 | Android secondary content |
| A5 | WP-F08 | focused + Android restart |
| A5b | WP-F09 | focused + Android unconfirmed restart |
| A5d | WP-F08 | focused + Android pending clear |
| A5c | WP-F10-F12 | focused layers |
| A6 | WP-F06 | native + Android mobile |
| A7b | WP-F15 | focused/Android rendered contrast |
| A7 | WP-F15 | focused static token set + render |
| A8 | WP-F16 | Android existing journey |
| A9 | WP-F06 | Android mobile surface/dispatch readback 无 SECONDARY，waiting/welcome filter 正确 |

每个 F 夹具必须在实际代码上执行一次“故意引入的单点变异→命红→恢复正确字节→重跑”。
不能只检查新实现的绿色结果。变异代码只能在受控工作区中进行，并在证据中记录准确
file/symbol，不进入交付源码。

## 7. 两台 Android 虚拟机与证据保留

本节原为执行方案，当前已在 CP-7 按真实设备身份、serial、安装包和实际 Android build
执行到部分边界；具体截图、XML、ROI 指标、日志、first failure 与 cleanup 见 CP-7 evidence。
未执行的场景仍保持 OPEN，不能用计划文字替代证据。

### 7.1 laptop 双屏 VM

执行顺序：

1. 记录 VM identity、主/副 display id、window metrics、orientation 和 launch options；
2. 启动 sample2，取得匿名主屏 login 与副屏 waiting 的冷启动截图；
3. 登录，截主屏 picker 与副屏 welcome；确认 none/w1/w2/w3 各至少一条；
4. 对 w1/w2/w3 执行选择未确认截图、确认后截图、ROI 比对和 source identity 记录；
5. confirmed 后重启，重取主副屏截图与 persisted state readback；
6. confirmed w2、选择 w3 不确认，重启，证明 pending w3、confirmed/background w2 和 picker
   高亮均恢复；
7. 切换/观察合法业务 layer、失效 MAIN/BRANCH layer 的安装期清理；
8. 执行 sample-terminal 完整既有旅途回归；
9. 每个 run 读取结构化日志并单独 cleanup，保留 cleanup PASS/FAIL。

### 7.2 mobile VM

执行顺序：

1. 记录 integration 逻辑画布 360×640，以及 VM 物理 width/height 720×1280、density、orientation、
   `smallestScreenWidthDp`、calibrated threshold、launch option；
2. 冷启动匿名，证明只有 PRIMARY login、没有 SECONDARY surface；
3. 登录，选择 none/w1/w2/w3 并确认，截屏验证主屏背景；
4. confirmed 后重启和未确认 w2→w3 重启各一次；
5. 发送/观察 configuration change，证明冻结的 surfaceForm 不漂移；
6. 记录 no-secondary、single-surface、orientation 和状态恢复；
7. 读取日志并 cleanup。

### 7.3 截图方法

以详设 §5 为唯一方法基础，由 CP-1 的 `tools/terminal-image-compare/compare.mjs` 实际
计算，不允许把“方法学已定义”当作动态证据：

- primary/secondary ROI 是各自 SurfaceRoot 实际 host 内容框内的 wallpaper background
  area，去掉状态栏、导航栏、设备装饰和系统手势区；
- 用真实 testID 节点 bounds 建 foreground mask，只覆盖四个 option、thumbnail、confirm、
  loading/diagnostic；mask 不得使用整个外层 wrapper；ROI 至少占 canvas 的 20%，mask 不得
  超过 canvas 的 80%；
- 每对截图必须有相同的 canvas width/height、host width/height、displayIndex、surfaceForm、
  登录状态和 loaded 状态；任一几何不等即 OPEN；
- 先连续抓相同状态 baseline。`changedFraction <= 0.001`、`P95 <= 2`、
  `changedCellFraction <= 0.01` 才算 capture 稳定；baseline 只是噪声门，不参与放宽业务阈值；
- 网格唯一锚点是 `canvasRect`，固定为 8×8；`minUnmaskedFraction` 固定为 `0.25`。某格
  内位于 ROI 且未被 mask 的像素 / 该格完整面积低于 0.25 时，该格同时从
  `changedCellFraction` 的分子和分母剔除；不得把变化像素外接矩形当网格。`roiRect` 面积
  必须至少为 canvas 的 20%，mask 与 canvas 的交并面积不得超过 canvas 的 80%，否则工具
  失败关闭；
- 未确认选择：changedFraction <= 0.001、P95 <= 2、meanAbsDiff <= 1、changedCellFraction
  <= 0.01；确认后变化：changedFraction >= 0.20、P95 >= 8、meanAbsDiff >= 4、
  changedCellFraction >= 0.75，四项同时满足；
- A3 不做未定义的比较样本或 raw-pixel equality；按已冻结的三条 oracle：两屏各自 ROI 变化、
  两屏 asset identity 相同、换另一张确认后两屏再各自变化；
- 图片异步加载期间不截图，必须等 `wallpaper-render-ready` 并记录 assetId/displayMode；
- 截图文件、cropped ROI、mask、metric JSON、原图 hash、设备 identity、timestamp 和命令
  输出一起保留；截图不替代 state/log readback。工具遇到 unsupported PNG、尺寸不一致、
  ROI/mask metadata 缺失即失败关闭。

### 7.4 档位边界

| 档位 | 本计划可证明 | 不能外推 |
| --- | --- | --- |
| static | 文件、字段、依赖、graph、token、README | 可见、真实方向、Metro asset runtime |
| focused | actor/command/reducer/parser/真实控件 | 双屏合成、系统配置、真实 persistence backend |
| native | Kotlin logic/launch options unit | Android VM 窗口合成 |
| Android | 两台指定 VM 的当前 build 行为 | 其他真机型号、release |
| release | 获授权 release 包的资产/启动 | debug 或 focused 的等价证明 |
| visual | 仅冻结 oracle、区域和阈值范围内的比较 | 全屏任意状态的“看起来一样” |

## 8. 失败、恢复与 cleanup 纪律

### 8.1 允许的根因修复

- Metro workspace JPG 失败：先区分 resolver、workspace package boundary、asset declaration
  和文件格式；修最小 owning package，不复制资产、不添加第二 bundler；
- TypeScript 失败：只在实际消费 feature 包补声明，不修改全仓全局类型以掩盖错误；
- image 不可见：先核 children 顺序、transparent token 和 source resolution，不在 render
  再造 Image seam；
- Android 形态错误：先核 `Configuration.smallestScreenWidthDp`、校准阈值、方向锁与 Bundle
  数据流，不在 JS 二次猜测；`onConfigurationChanged` 不重算，真实 delegate 重建才重读；
- layer 恢复错误：先核 descriptor/parser/install actor 的 owner 边界，不直接清空全部存档；
- test 红：先保留日志和 mutation，确定是实现错、判据错、测试逃逸还是环境硬约束。

### 8.2 硬约束与需要 Dexter 的情形

只有以下情况可以结束当前实施回合并向 Dexter 报告 OPEN：

- 受管网络不可达、必要 VM/设备启动不了或资源身份不满足安全预检；
- 当前需求正本已冻结 A3 的三条行为 oracle；只有后续证据显示实施会改变这三条既定语义，才需要向 Dexter 报告设计偏差；
- 需求正本保留互相冲突的 owner/diagnostic 规范且无法在实现层同时成立；
- 修复方向会改变用户 Journey、范围、owner 或设计初衷。

普通失败、编译失败、测试失败、Metro 失败、图片不可见、持久化恢复失败、方向判定失败
都不是停止理由；必须完成日志诊断、根因修复和定向复验，或把已定位的硬约束证据交回。

### 8.3 cleanup

- 只停止本 run manifest 明确拥有且 identity 匹配的 process tree；
- 不按端口、命令名、模糊 AVD 名称杀进程；
- Android/Metro/测试各自记录 business 与 cleanup；
- cleanup 失败时即使业务 PASS，也不能报该 run 完成。

## 9. 交付前复核闸门

必须按顺序全部满足：

1. CP-0 的 asset/type 结论已实测并写回；
2. 已重新阅读需求正本的现行 operative clauses 与 A3 三条行为 oracle，并确认详设、计划和实现路径仍与其一致；
3. CP-1 至 CP-8 的每个 gate 有实际输出；
4. 每个阶段都有 fresh 独立子 agent 的逐点三维对账；当前未执行，不得虚写；
5. 全批范围独立三维对账完成，且所有实际变更文件逐行 MATCHED；
6. A1-A9 与所有 F 红夹具都有实际证据，红夹具变异曾真实弄红；
7. 未来动态档位按 static/focused/native/Android/release/visual 分开；
8. 两台 VM 的 business 与 cleanup 都关闭；
9. 没有把历史 clean debug、focused、欢迎语完整、计划、静态门或 review GO 升级为
   visual/complete implementation acceptance；
10. 取得 Dexter/Claude 对 implementation-facing 详设与计划的复评后，另有实施授权。

在上述条件满足前，交付状态只能是 OPEN_FOR_REVIEW，不能写 GO 或
COMPLETE_IMPLEMENTATION_ACCEPTANCE。

## 10. 设计/计划自检结果

已对齐：

- CP-0 已作为首个实施动作真实执行：workspace 内 JPG 已由现有 sample-terminal Metro consumer
  消费，声明落在 consumer 可见的 feature-package 作用域，临时 probe 已清理；详见 CP-0 evidence；
- CP-1→CP-2→CP-3→CP-4→CP-5→CP-6→CP-7→CP-8 的单向顺序与前置关系明确；
- 需求的 11 个产品 touched positions 全列出，另登记 1 个不进入 runtime graph 的 image-compare
  证据支持位置；`skeleton-graph.ts` 已归入 terminal-skeleton 的 source-level inventory，
  ui/base/render 明确零改；
- 19 个 palette token 已在详设给出具体值；
- Android API、字段、校准阈值、异常 fallback、一次冻结和由单一 helper 生成的 Bundle 传播已明确；
- 浮层持久化四格、旧档、重复、非法行、workspace 反向场景已枚举；
- 壁纸、形态、会话、重启、边界、workspace、回归维度均有非空用例；
- A/F 映射和红夹具目标已逐条登记；
- dynamic evidence 的区域、指标、mask、几何一致性、image-compare 执行体、设备和 cleanup
  边界已明确。

仍 OPEN：

- CP-7 的 sample2-specific 尚未执行的 F 反向变异与完整 A/F 动态矩阵；F-A2a/F-A3a/F-A3b/F-A5b/F-A5d
  已有真实 Android ROI 变异证据，F-A5_RUNTIME 的 confirmed-field storage-loss 变异也已在
  `emulator-5556` 真实命红；原 F-A5 的非法 descriptor 变异仅得到 runtime invariant rejection；原 F-A9 guard-only 变异未到达
  SECONDARY，但补充 F-A9_RUNTIME 已在真实 mobile 运行日志命红；A2d 当前证据为同一运行内
  的 w1→w2 与 w2→w3 两次连续确认，主副屏各有一份 metric，不把对调参数的镜像比较计为独立证据；
- Web、release、完整 visual/quantified ROI；
- CP-0 至 CP-7 每一步的 fresh 独立三维复核并未全部具备；Plato 的独立复核只覆盖当前 CP-7
  中间状态，不能替代整批复核；
- 全批 `A1-A9` 与全部红夹具尚未全部取得实际证据，因此不得写 `GO` 或
  `COMPLETE_IMPLEMENTATION_ACCEPTANCE`。

CP-7 已取得部分 Android 与 ROI 真实证据，具体边界见
`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-execution-codex.md` 与
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-current-a3-pair-codex.md`；本计划状态仍为
`IMPLEMENTATION_COMPLETED_WITH_RUNTIME_AND_REVIEW_OPEN_ITEMS` 表示源码实施范围已完成，
不是完整动态验收或独立 review 已通过。

## 2026-09-14 当前字节输入事件边界对账

本轮真实 swipe 首先暴露出共享输入父级仍由 React Native `Pressable` 的内部 Pressability
handler 接管 responder；仅修改同名 prop 不改变运行行为。主 agent 将共享边界改为普通
`View` 的被动 native touch start/end 与 Web click 观察，保留现有 `PrimitiveScrollView` 与
业务后代的 responder 协商。随后真实 Android 又暴露出虚拟键盘根节点的 touch end 会冒泡到
该观察者，主 agent 在 `VirtualKeyboard` 根节点增加 native touch/Web click propagation stop，
没有新增输入管线或第二套 tracker。

当前 focused 结果为 `ui-base-input` 10 files/51 tests、primitives 16、
sample-wallpaper-console 4 files/13 tests；当前 Android mobile readback 证明键盘按键后
键盘仍在且首位已填写，非输入标题点按后键盘消失但 login/输入状态仍在，关闭 admin 后真实
swipe 使 w1/w2 内容 bounds 上移。证据见
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md`。

该对账只关闭当前输入事件修复的 focused/Android supporting 边界；Web、release、完整
visual、完整 A/F 与 implementation acceptance 仍保持 OPEN，不得由本节的 MATCHED 文字升级。
