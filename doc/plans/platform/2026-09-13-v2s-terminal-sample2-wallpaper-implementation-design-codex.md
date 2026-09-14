# TER sample2 壁纸终端 implementation-facing 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0. 文档状态、输入与边界

~~~text
BUSINESS_SOURCE=doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
STANDARDS_SOURCE=doc/platform/terminal-coding-standard.md
DESIGN_STATUS=IMPLEMENTATION_IN_PROGRESS
IMPLEMENTATION_AUTHORIZED=true
IMPLEMENTATION_PERFORMED=true
RUNTIME_EXECUTED=true
INDEPENDENT_SUBAGENT_REVIEW=CP-0_TO_CP-6_PARTIAL
MEMORY_ROUTE=FAIL; direct project-memory entries were reopened
~~~

本文件是 sample2 壁纸终端的 implementation-facing 详设；实际源码、测试、工具和运行证据
分别记录在对应 CP evidence。当前实施授权覆盖本详设与计划定义的 sample2 目标及动态验收，
不包含后台 DEV、seed、UAT、部署或 Git。

事实分层：

- 仓内事实只来自当前字节、源码、规范和能直接重跑的静态检查；不把需求正本的事实表当作证据。
- 设计决定是本文件为了让实施者能开工而作的技术取法；不把它回写成 Dexter 的产品裁定。
- 产品语义若仍有歧义，明确标为 DEXTER_DECISION；不能以实现方便静默选边。
- 动态行为按 CP-0 至 CP-6 已部分执行；任何 static 或 focused 结果都不提升为 Web、Android、
  native、release 或 visual PASS。每个已执行 CP 的边界以 `doc/evidence/platform/` 下的
 证据为准，未执行的后续档位继续保持 OPEN。

### 0.1 当前源码基线

已重开并作为设计输入的关键 owning source：

| 事实 | 当前来源 | 对详设的约束 |
| --- | --- | --- |
| SurfaceRoot 先渲染 children，再渲染 ScreenContainer 与 LayerStack | apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx，SurfaceRoot 组件的 content 组合 | WallpaperBackground 必须是 children 中的绝对定位背景；不能占普通流高度，也不能改 render |
| 默认 PrimitiveContainer 带不透明 bg-canvas | apps/terminal/ui/base/primitives/src/theme/tokens.ts，baseTokens.container；PrimitiveContainer | 只有显式 transparent layout 的三个壁纸相关 part 移除背景 |
| UI 图片 RN 接缝现由 primitives/vendor/slots.tsx 集中承载 | apps/terminal/ui/base/primitives/src/vendor/slots.tsx | 只在此处增加 RnrImage，不新增 render 图片接缝 |
| SurfaceHostController 的真实几何是两轴独立 scale | apps/terminal/ui/base/render/src/foundations/surfaceHost.ts，calculateSurfaceHostGeometry | 壁纸跟随画布变形；本批不偷偷建立第二个 viewport |
| content 的 persistence descriptor 是数组，当前只保存 containers | apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts，createContentDescriptor | layers 使用独立 record descriptor；containers 落盘格式不改 |
| hydration 在 state store 可见前完成 | apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts、persistenceHydration.ts | 重启首帧可直接读取恢复后的 state；不新增恢复启动命令 |
| RuntimeModuleContext 暴露 dispatchCommand，不暴露 module-level dispatchAction | apps/terminal/kernel/base/runtime/src/types/module.ts、createRuntimeLifecycle.ts | install 期 catalog 清理必须通过 ui-state 内部 command/actor，不能要求私有 context API |
| UI feature 可以有自己的 module 与 actor，且 feature 不建 state slice | apps/terminal/ui/feature/sample-staff-auth、terminal-coding-standard.md TR-09/TR-12 | picker actor 处理用户操作，持久 state 仍归 kernel feature |
| Android 主 delegate 已经经 launch options 下发 displayIndex/displayCount | apps/terminal/adapter/android/dual-screen/.../TerminalDualScreenActivityHandler.kt，PrimaryLaunchOptionsDelegate 与 ensureSecondarySurface | surfaceForm 与同一条主/副屏 Bundle 传递；不在 sample2 assembly 重复判形态 |
| sample-terminal 目前在 app.json 与 AndroidManifest.xml 都固定 landscape | apps/terminal/assembly/android/sample-terminal/app.json、android/app/src/main/AndroidManifest.xml | 删除两处方向锁，并回归既有 sample App |
| skeleton 图比较使用实际 package census 与依赖集合，assembly reachability 目前硬编码 sample-terminal | apps/terminal/skeleton-graph.ts、tools/terminal-skeleton/check-static.mjs | 新四节点、节点数、sample2 assembly reachability 必须同批同步 |
| layering 的 uiNativePackages 是硬编码 | tools/terminal-layering/check-static.mjs，uiNativePackages | 新 integration 必须显式进入该门的分母 |

### 0.2 复评处置状态

上一轮登记的 A3 产品语义与需求正本旧段落冲突，已由需求正本当前字节收口；以下是现行
实施输入，不是待裁项：

- A3 采用三条行为断言：确认后 PRIMARY 与 SECONDARY 各自的 wallpaper ROI 都发生变化；
  两屏解析出的 asset identity 相同；换选另一张并确认后两屏 ROI 再次各自变化。两屏不做
  不可能的 raw-pixel equality，也不引入未定义的比较样本。
- 需求 §3.3 的 integration placement、§3.6.1c 的 `ui-state-hydration`/membership
  校验是当前实施输入；§3.6.2 的旧叙述是沿革记录，不再另起一套 owner、诊断类别或校验
  时机。详设不再保留 `DEXTER_DECISION` 或 `REQUIREMENTS-OPEN` 作为实施前置。

以下章节中的 A3、浮层恢复和诊断描述均以这两个现行条款为准；其余 OPEN 只表示尚未实施
或尚未取得动态证据，不表示产品语义未裁。

#### DESIGN_CLARIFICATION-01：A2 的“屏幕不变”只比较壁纸 ROI

选择操作本身会改变 radio 的 selected 样式；比较全屏会把合法的控件变化误判为壁纸变化。
因此 A2 的屏幕 oracle 定义为：SurfaceHostController canvas 内，扣除 picker 控件矩形后的
wallpaper ROI。控件状态另由 focused 控件断言验证。这是对判据可测性的必要解释，不改变
“确认前壁纸不得变化”的产品语义。

#### DESIGN_CLARIFICATION-02：F-A2b 必须作用于非 none 资产

none 合法地映射为无图片，assetsById[none] 为 undefined 不能作为故障。红夹具固定为：
把 w2（或 w1/w3）映射成 undefined，然后执行选择 w2、确认、背景 source 与 wallpaper
ROI 断言。否则“让 assetsById 返回 undefined”本身不能保证把 A1/A2 弄红。

## 1. 用户目标与方案选择

### 1.1 真实目标

sample2 是一个独立的壁纸终端样板：店员登录后在主屏选择“无壁纸 + 三张内置图片”，
点击确认后才让同一张已确认壁纸在 laptop 双屏同时生效；mobile 只运行主屏。选择草稿、
已确认状态、登录恢复、浮层恢复都由现有 state/runtime 机制承载。该功能要真实通过
四层结构和生产 catalog，但不是新后台服务、不是第二套 registry、不是新的弹层系统、
不是新的持久化框架。所有 `ui/integration/*` 还必须遵守终端基线 `TR-13`：把共享
`adminShellAssembly.parts` 接入同一 catalog，并在每个生产 surface 的 content frame 使用
`AdminLauncher`；这不是 sample2 新业务需求，而是 integration 的共同工程不变量。

### 1.2 方案比较

| 方案 | 形态 | 结论 |
| --- | --- | --- |
| A：在 integration 写死四个选项和两屏 JSX | 省文件，但绕过 UiCatalog，无法证明生产注册和过滤，未来改名会出现静默分叉 | 拒绝 |
| B：把图片接缝放到 render，并给每个屏幕单独背景层 | 可控制 viewport，但超出本批已批准的 render 零改动，且为了一个图片功能改通用宿主 | 拒绝 |
| C：primitives 提供一处 Image 与透明容器；kernel 保存两个 id；picker 通过自有 actor 转发 kernel command；integration 负责 placement；adapter 负责形态 | 复用现有 owner、catalog、LayerStack、SurfaceRoot 和 launch options，只增加缺失能力 | **采用** |
| D：把 picker 与身份/设备事实合成一个 sample2 专属 state/module | 使 UI 获得不必要的跨域状态，重启、mobile、双屏和测试都更难隔离 | 拒绝 |

我选了 C 而不是 A/B/D，因为用户真正需要的是“确认后同一事实在正确屏幕可见且可恢复”，
不是增加一套业务框架。C 的新增代码只放在现有 owner 缺失的接缝处；背景、state、placement、
形态、输入和 runtime 各自留在已有 owner。

## 2. IA、Journey 与交互设计

### 2.1 Surface IA

| surface | canvas | host | content | 层 |
| --- | --- | --- | --- | --- |
| laptop PRIMARY | 1280×800 | 主物理显示，displayIndex 0 | 登录页或壁纸 picker；picker 为透明容器，背景先于 ScreenContainer | staff-auth 错误提示等既有层 |
| laptop SECONDARY | 960×540 | 副物理显示，displayIndex 1 | 匿名时 waiting，认证后 welcome；同一个 confirmed wallpaper 在其背景 | 本批不放 picker |
| mobile PRIMARY | 360×640 | 主物理显示，displayIndex 0 | 登录页或壁纸 picker；四个选项纵向排列 | 只保留主屏可达层 |
| mobile SECONDARY | 不存在 | 不创建 | 不渲染、不派发 SECONDARY placement | 不适用 |

背景不是独立 Surface、不是 layer、不是第二个 catalog entry。它是 integration 将
WallpaperBackground 作为 SurfaceRoot children 传入后，由 picker/waiting/welcome 自己选择
透明 PrimitiveContainer 的组合结果。

### 2.2 Journey 状态与恢复

| 状态 | 主屏 | 副屏 laptop | 允许的动作 | 恢复 |
| --- | --- | --- | --- | --- |
| 冷启动匿名 | StaffLogin | 等待店员登录 | 填写工号/密码并登录 | session actor 决定认证态 |
| 登录完成 | WallpaperPicker | 顾客欢迎语 | 选择选项、确认、登出 | confirmed/pending 与 content 各自恢复 |
| 已选未确认 | Picker 高亮 pending，背景仍 confirmed | confirmed 背景不变 | 换选项、确认、登出 | 两个 wallpaper 字段与 picker content 都恢复 |
| 已确认 | Picker 高亮 confirmed，背景为 confirmed | 同一个 confirmed 资产 | 选择新 pending、确认、登出 | confirmed 恢复，pending 为空 |
| 登出完成 | StaffLogin | 等待店员登录 | 重新登录 | auth owner 的既有导航；不清除 wallpaper 选择 |
| host 未就绪 | 明确“正在准备显示面”加载指示 | 同等规则 | 不渲染 children | 不改门禁，不把加载当可用/不可用 |

### 2.3 控件、位置、动作与可访问性

实现必须把 testID 挂到真实动作节点，而不是外层包装。testID 文件由各自 capability owner
持有；名字不得带 Journey 编号。

| 控件 | 真实节点 | 视觉/位置 | action | 状态 |
| --- | --- | --- | --- | --- |
| 无壁纸 radio | PrimitiveRadio 或 PrimitivePressOption 的真实 Pressable | picker 选项列第一项；mobile 纵向，laptop 在可读宽度内排列 | wallpaperOptionSelectedCommand({wallpaperId:'none'}) | effective 为 none 时 selected |
| w1/w2/w3 radio | 各自真实 Pressable | 每项包含缩略图、标题和 radio | 同上，source 来自同一 assetsById | effective 与 id 相等时 selected |
| 确认按钮 | PrimitiveButton 的真实 Pressable | 共享纵向滚动区内、选项之后；滚动后可见且不被背景覆盖 | wallpaperConfirmRequestedCommand({}) | pending 存在且不同于 confirmed 时 enabled |
| 登录控件 | 复用 sample-staff-auth 原节点 | 不在 picker 自己复制 | 既有 staff-auth command/actor | loading、失败层、键盘状态沿用既有 owner |
| waiting/welcome | integration-owned part 的可见文案节点 | SECONDARY canvas 内普通流 | 由 integration placement handler 决定 | 文案只随 session 状态切换 |

picker 不新增 route、modal、overlay、native input 或 state setter。用户选择与确认先进入
picker 自己的 command/actor，再由 actor 以现有 dispatchCommand 调用 kernel wallpaper command；
这使重复点击可以在交互 owner 内被消除，同时保持 kernel command 表示真正的 state mutation。
四个选项与确认按钮共用 primitives 已有的纵向 `PrimitiveScrollView`；这是为固定逻辑画布保留
真实控件可达性的组合方式，不新增滚动机制。确认按钮不能因四个选项的内容高度而被裁成不可操作
的边缘，focused/native 验证必须用真实滚动动作后再点击该按钮。

### 2.4 交互状态机

~~~text
effective = pendingWallpaperId ?? wallpaperId

点击选项(id):
  if id == effective:
    picker actor 完成而不派发 kernel command
  else:
    picker actor dispatch selectWallpaperCommand({wallpaperId: id})
    pendingWallpaperId 更新；wallpaperId 不变；背景不变

点击确认:
  if pendingWallpaperId 不存在或等于 wallpaperId:
    UI 不应发送；若外部直接发送 confirmWallpaperCommand，kernel 返回
    ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING，零 state 写入、零子命令
  else:
    picker actor dispatch confirmWallpaperCommand({})
    wallpaperId = pendingWallpaperId；pendingWallpaperId 删除；背景更新
~~~

## 3. Owner、契约与实现形态

### 3.1 primitives：一处图片接缝与透明容器

改动 owner：

| 文件/符号 | 契约 |
| --- | --- |
| apps/terminal/ui/base/primitives/src/vendor/slots.tsx，RnrImage | 从 react-native value import Image；透传 source、resizeMode、style/className/testID；不得接收 showSoftInputOnFocus |
| apps/terminal/ui/base/primitives/src/components/PrimitiveImage.tsx，PrimitiveImage | layout 默认 thumbnail 或 background；background 只使用 imageBackground token；source 必须存在才渲染；不掌握 surface/display state |
| apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx，PrimitiveContainer | layout 新增 transparent；transparent 只从 container token 删除 bg-canvas，保留 flex/padding/gap |
| apps/terminal/ui/base/primitives/src/theme/tokens.ts，baseTokens | 增加 imageBackground = absolute inset-0 w-full h-full；增加 containerTransparent = flex-1 p-6 gap-4 |
| apps/terminal/ui/base/primitives/src/index.ts | 导出 PrimitiveImage 与其 props；同步 terminal-invariants.json publicExports |

不在 ui/base/render 增加 Image 或背景组件。background 的 absolute 是通用排版属性，不能将
WallpaperBackground 变成 render owner。

### 3.2 kernel feature：sample-wallpaper

模块名：

~~~text
kernel.feature.sample-wallpaper
~~~

类型与初始值：

~~~text
WallpaperId = 'none' | 'w1' | 'w2' | 'w3'
WallpaperState = {
  wallpaperId: WallpaperId              // default 'none'
  pendingWallpaperId?: WallpaperId
}
~~~

slice 为 sample-wallpaper.selection；两个字段都用既有 field persistence descriptor，
persistIntent 为 owner-only，protected/plain 由 assembly 的现有 persistence policy 决定；
本包不保存图片 bytes、文件路径、React component 或 surface/display/workspace。

命令与 actor：

| command | payload | actor 行为 |
| --- | --- | --- |
| selectWallpaperCommand | wallpaperId | 校验闭合 WallpaperId，写 pending；若与当前业务调用语义不符则返回 typed invalid failure |
| confirmWallpaperCommand | 空对象 | pending 不存在或等于 confirmed 时抛具名 AppError；否则把 pending 提升为 wallpaperId 并清除 pending |

错误 code 固定为 ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING。普通异常归一化成
通用 operation failure 不能代替该 code；A2c 必须把两者区分开。

导出 selectWallpaperId、selectPendingWallpaperId、createSampleWallpaperModule、命令和类型。
模块为 owner，拥有 slice、command、actor；不创建 hydration actor，不创建 wallpaperSelected
回声命令，不引入 UI 文案。

### 3.3 ui-state：浮层 descriptor 与安装期清理

#### 3.3.1 落盘格式

在 apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts 中保留 containers
descriptor 不变，并增加第二个 record descriptor：

| descriptor | storageKeyPrefix | entry key | value |
| --- | --- | --- | --- |
| screen | containers | PRIMARY/SECONDARY | Record<containerKey, ScreenPlacement> |
| layer | layers | PRIMARY/SECONDARY | 有序 LayerEntry[] |

两个 descriptor 都由 MAIN 与 BRANCH 的 createDescriptor 注册。不要把 layers 重新塞进
containers，也不要改变已有 containers 的 key 或 serializer。

LayerEntry 的还原校验：

1. row 必须是 object，layerId 与 partKey 是非空字符串；
2. `isValidOpenedAt(value)` 是唯一时间校验函数：`typeof value === 'number'`、finite、正数、
   integer；写入 serializer 与 hydrate parser 共用它。生产写入只允许 `Date.now()` 产生的
   正整数，因此合法写入不会在重启时被自己的 parser 丢弃；
3. props 缺省合法；存在时通过 assertStateJsonValue 后 cloneAndFreeze；
4. 任一行失败，整行丢弃，保留其他合法行并产生 ui-state-hydration 诊断；
5. 同一 displayMode 内重复 layerId 保留先出现者，后续重复行丢弃并产生诊断；
6. 数组顺序就是 LayerStack 的顺序，不排序；
7. 没有 layers entry 时使用空数组，不报错，不改变旧存档；
8. serializer 只写当前合法 state，不写诊断。

#### 3.3.2 诊断传递

当前 persistence applyEntries 只有 state 与 entries，没有 logger/catalog。为避免加私有 context
或全局可变变量，改为每个 createUiStateModule 实例创建一条生命周期局部的 diagnostic sink：

1. workspaceSlices 暴露 createContentStateRegistrations(onHydrationDiagnostic)，而不是共享可变
   module-level queue；factory 为每个 workspace 建 descriptor 闭包；
2. descriptor 的 parseLayers 在结构/重复错误时向该 sink 放入
   workspace、displayMode、layerId、partKey、reason；workspace 来自 descriptor factory 的参数，
   不从当前 workspace 或全局变量推导；
3. createUiStateModule 把该 factory 产出的 registrations 装入 stateSlices，并把同一实例的 sink
   接到 install 生命周期；不保留未使用的 `_workspace` 参数；
4. module install 先 drain 当前实例的结构诊断，再以 category ui-state-hydration 通过
   platformPorts.logger.warn 写出；
5. 日志字段固定为 workspace、displayMode、layerId、partKey、reason；无法解析 identity
   的 malformed row 使用 null，而不是伪造一个真实 layerId/partKey。

此 queue 不是业务 state，不跨 runtime，不参与持久化，不替代日志。安装完毕后清空。

#### 3.3.3 catalog membership 清理

descriptor 不能校验 catalog membership；install actor 承接这一点。为遵循
RuntimeModuleContext 只有 dispatchCommand 的当前架构，新增 ui-state 内部能力命令：

~~~text
pruneHydratedLayersCommand (visibility internal)
payload = {}
~~~

其 actor：

- 只由 createUiStateModule.install 调用；
- actor 从 module 闭包取得 catalog 与 state dispatch，自己显式遍历 MAIN/BRANCH × PRIMARY/SECONDARY；
  调用方不预计算、不传入 `removals`；
- 只删除不在 catalog membership 中的 layer；四格筛选、layerId 去重与诊断均由 actor 的单一
  实现完成；
- 用 createWorkspaceActionDispatcher({routeContext:{workspace}, dispatch}) 对 owner 自己的
  contentActions.closeLayer 发 action；
- 复用 completeUiStateWrite，必要时一次 flush；
- 每一项 unknown-part 以 ui-state-hydration 记录；
- 不按 displayMode/workspace/instanceMode/surfaceForm availability 删除仍属于 catalog 的
  layer；LayerStack 的既有可用性过滤负责当下是否渲染。

这条 internal command 不是给 UI 调用的公开业务 API，不改变 RuntimeModuleContext，也不允许
直接调用 state setter。非当前 workspace 也能被清理，是因为 actor 自己显式带着四格遍历上下文，
而不是借用只路由 current workspace 的 closeLayerCommand。任何先在调用方算出 removals 再传入的
实现都违反本契约。

catalog membership 清理顺序必须在 runtime start 完成前结束，以避免第一帧显示失效层。
membership 清理成功后，若 state 有变化，flush 一次；flush 失败按既有 ui-state content
persistence failure 记录，不能假装已清理持久存档。

#### 3.3.4 对其他 App 的影响

这是 kernel/base/ui-state 的共享行为。sample-console、sample-terminal 及任何使用该模块
的 assembly 都会从“重启不恢复 layers”变为“恢复合法 layers”。因此必须：

- 反向重写 acceptance.test.ts 中带 U-7 编号的用例；
- 反向重写 content.test.ts 中 never restores layers 的用例；
- 增加四格 workspace/displayMode、旧档、重复、非法 props、非法 openedAt、unknown part
  的用例；
- 用混合 containers + layers 存档证明 applyEntries 只替换目标 descriptor 的 layers，不会把
  既有 containers 清空；对 isValidOpenedAt 同时覆盖合法写入和非法还原；
- 保留 known-but-currently-unavailable layer 的正向保留用例；
- 连续两次启动时，known-but-currently-unavailable layer 仍保留、只被渲染过滤，且没有仅因
  availability 过滤而产生的新增 flush/write；显式 close 或 membership removal 才允许改变该
  持久数据；
- 在既有 sample App 的回归中验证没有把业务 layer 或屏幕 container 清掉。

### 3.4 picker：资产、actor、part

包名：

~~~text
ui.feature.sample-wallpaper-picker
~~~

资产只住在该包：

~~~text
assets/w1.jpg w2.jpg w3.jpg
import w1Asset from './assets/w1.jpg'
import w2Asset from './assets/w2.jpg'
import w3Asset from './assets/w3.jpg'
assetsById = {
  none: undefined,
  w1: w1Asset,
  w2: w2Asset,
  w3: w3Asset,
}
~~~

实际实现以 CP-0 已完成的 Metro 首步实测结果为准：静态 `.jpg` import 可由现有 workspace
 consumer 解析，TypeScript 声明必须在 picker 自身的 `src/types/assets.d.ts` 与最终 consumer 能
看到的 program 中可达；本包的 `foundations/assets.ts` 只使用静态 import，不用动态 require。图片来源、
许可证、URL、尺寸、体积与 hash 写进本包中文 README；不得把图拷到 assembly 或 integration。

三张内置图片必须是三个独立的、有可核验来源的非占位资产。`assetsById` 的 identity 断言
与截图像素断言分开：实施/验收不得把同一份被测 map 再读作期望，也不得用三个纯色或同一
渲染内容的不同压缩文件冒充三张有意义的壁纸。

WallpaperPicker：

- 通过 useUiStateSelector 读取 confirmed/pending；
- effective = pending ?? confirmed；
- 选项渲染四个真实控件；缩略图 source 从同一 assetsById 读取；
- 选择 actor 对比 effective，相同时不向 kernel 派发；
- 选择不同项时只派发 selectWallpaperCommand，不改 confirmed；
- 确认按钮由 pending 存在且不同于 confirmed 派生 enabled；
- 确认 actor 只有在确有 pending 时才派发 kernel confirm command；
- 不持有第二份 wallpaper state，不直接 dispatchAction，不直接调用 reducer。

part：

~~~text
partKey=sample.wallpaper.picker
rendererKey=sample.wallpaper.picker
containerKeys=['main']
displayModes=['PRIMARY']
workspaces=['MAIN']
instanceModes=['MASTER']
surfaceForm=['laptop','mobile']
~~~

WallpaperBackground 是该包公开的普通组件，不是一个 part。它读取 confirmed wallpaperId，
将 source 解析为 assetsById[id]，不存在时返回 null；存在时渲染
PrimitiveImage(layout='background', source, resizeMode='cover')。不读取 pending。

### 3.5 integration：sample-wallpaper-console

包名：

~~~text
ui.integration.sample-wallpaper-console
~~~

该包是所有 placement 的 owner，沿用 sample-console 的 assembly 形态：

- 合并 sampleStaffAuthAssembly.parts、sampleWallpaperPickerAssembly.parts 和两个本包
  的副屏 parts，建立一个 UiCatalog；
- 合并 sampleStaffAuthAssembly.variables 与本包需要的变量；
- 注册 staff-session、staff-auth module、sample-wallpaper module、本包 module；
- 建立一个 RenderProvider、一个 Runtime、一个 state store；
- createSurface 仍接收 displayIndex、displayMode、surfaceForm，并按声明尺寸选画布；
- 两个 laptop surface 都传同一个 WallpaperBackground；
- PRIMARY 的 children 为 WallpaperBackground + content frame；SECONDARY 的 children 为
  WallpaperBackground + waiting/welcome content frame；
- 不在本包维护第二个 catalog 或第二套 surface selection；
- displayIndex 只用来选 host source；displayMode 只用来选画布与 catalog placement。

本批治理轮尚未落地，故 placement handler 采用正本 §3.4 冻结的六条：

| session event | displayMode | part |
| --- | --- | --- |
| loginSucceeded | PRIMARY | sample.wallpaper.picker |
| sessionRestoredAuthenticated | PRIMARY | sample.wallpaper.picker |
| loginSucceeded | SECONDARY | sample.wallpaper-console.welcome |
| sessionRestoredAuthenticated | SECONDARY | sample.wallpaper-console.welcome |
| logoutSucceeded | SECONDARY | sample.wallpaper-console.waiting |
| sessionRestoredAnonymous | SECONDARY | sample.wallpaper-console.waiting |

staff-auth 现有两条 PRIMARY login placement 继续由它自身继承；不能在本批重复增加八条。
若治理轮先于本批落地，执行必须停在时点对账，不能同时使用六条和八条；这属于范围时点
冲突，需按需求正本声明的治理轮状态重开，而不是实施者猜测。

副屏 parts：

~~~text
sample.wallpaper-console.waiting
sample.wallpaper-console.welcome
containerKeys=['main']
displayModes=['SECONDARY']
workspaces=['MAIN']
instanceModes=['MASTER']
surfaceForm=['laptop']
~~~

两者由 integration 直接拥有，不新建 customer-display feature。waiting 文案为“等待店员登录”，
welcome 使用批准的顾客欢迎语。mobile catalog 过滤不返回它们，也不派发 SECONDARY。

### 3.6 sample2 assembly 与 Android

包名：

~~~text
assembly.android.sample-wallpaper-terminal
~~~

assembly 只负责实际 platform ports、Expo 入口、Android 工程和主/副屏 launch options。
它不重做壁纸 state、catalog、placement 或 Image。

platform ports：

- persistKv 与 persistSecure 沿用现有 Android adapter 绑定和 persistenceKey；
- device、logger、appControl 沿用 sample-terminal 的现有 adapter；
- surface host source 由 dual-screen adapter 创建；
- environment/debug 值沿用 assembly 的当前批准输入，不把 Web/Android 环境混写；
- sample2 的工程身份在本批冻结为以下四个字面值：`expo.slug=sample-wallpaper-terminal`、
  `android.package/applicationId=com.catering.v2s.terminal.samplewallpaper`、Gradle
  `namespace=com.catering.v2s.terminal.samplewallpaper`、Kotlin 包路径
  `com/catering/v2s/terminal/samplewallpaper`。不得沿用 Expo 默认的 `com.anonymous.*`，也
  不得在 CP-7 临时发明另一组字面值。`settings.gradle` 的 root project name 与
  `strings.xml` 的 app_name 均为 `sample-wallpaper-terminal`。
- `app.json` 的资产清单固定为 5 张实际引用的 PNG：`icon.png`、
  `android-icon-foreground.png`、`android-icon-background.png`、
  `android-icon-monochrome.png`、`favicon.png`；每张都要有来源、许可证、尺寸和 hash，未被
  配置引用的 splash 图标不纳入本批清单。

### 3.7 Android 形态来源与生命周期

owning source：
apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt。

在 `onDidCreateReactActivityDelegate` 中读取
`activity.resources.configuration.smallestScreenWidthDp`。这是 configuration 的最短逻辑
宽度，不随同一 Activity 的横竖姿态互换；不再用当前 window 的 `displayMetrics.widthPixels`
与 `heightPixels` 做形态判定。`displayMetrics` 仍可用于日志和几何观察，但不能进入
`SurfaceFormDecision`。

阈值不凭空写入：CP-6 的首个 native preflight 在两台指定 VM 上分别记录 mobile 值 `m` 和
laptop 值 `l`，要求两者都是正整数且 `m < l`，然后将唯一运行时常量冻结为
`floor((m + l) / 2) + 1`。实现只允许以下闭合函数：

~~~text
smallestScreenWidthDp >= calibratedLaptopThreshold => laptop
smallestScreenWidthDp <  calibratedLaptopThreshold => mobile
value <= 0、未定义或读取异常                  => laptop + display-diagnostics
~~~

阈值写入 adapter 的单一 classifier 位置，并在 native test、详设/实施对账和两台 VM 证据中
重复记录；不能由 assembly、JS 宽度断点或每个 App 各自保存另一份阈值。这里的稳定设备形态
分类是对当前需求“mobile/laptop 两种终端形态”的技术实现，不把 Web 端的
`surfaceFormForOrientation` helper 误当作 Android 设备判定来源。

需求 §5.2.1 对外冻结的是“按主设备的逻辑尺寸/方向得到 laptop 或 mobile，并在两台目标 VM
上可验证”的结果；本详设把 `Configuration.smallestScreenWidthDp` 作为该逻辑尺寸的稳定读取
字段，以避免应用自己的方向锁反过来改变判定输入。若复评将需求中 `DisplayMetrics` 的类名
理解为必须调用的 API 而非逻辑尺寸描述，则这是需求与详设的字面不同，实施前应由需求 owner
同步文字；本文件不以实现方便默默改变产品结果。

判定结果在本次 ReactActivityDelegate 创建期间冻结为 SurfaceFormDecision；随后：

1. 主 Activity 根据 decision 调用 setRequestedOrientation；
2. adapter 内唯一的 `createSurfaceLaunchOptions(displayIndex, displayCount, surfaceForm)`
   helper 生成 Bundle；PrimaryLaunchOptionsDelegate 与 ensureSecondarySurface 都调用它；
3. 该 helper 产出的 Bundle 放入同一个 surfaceForm，禁止两处独立字面量；
4. secondary 不重新判定，直接继承主 Activity 的形态。

非常规设备：

- split-screen、折叠/展开若只触发 `onConfigurationChanged`，保持已冻结的 surfaceForm；不因
  当前窗口姿态或短时尺寸变化切换 catalog，也不重新下发 Bundle；
- 若系统确实重建 Activity/React delegate，则以新 delegate 创建时的
  `smallestScreenWidthDp` 重新分类，再按同一阈值锁方向；该行为必须在 native test 中区别于
  “仅收到 configuration change”；
- 值为 0、未定义或读取异常统一落 laptop 并写诊断，不制造第三种形态，也不静默重试；
- 不新增 hinge/posture API。方向只用于在 classifier 决定后调用 `setRequestedOrientation`，
  不是 classifier 的输入。
- native proof 必须覆盖 `readDisplaySnapshot` 的 primary-only/无 secondary 分支、snapshot
  缺失分支和正常双屏分支；每个分支都要有明确的返回形状与诊断断言，不能只覆盖最终
  `SurfaceFormDecision`。

sample-terminal 删除 app.json orientation 与 AndroidManifest.xml screenOrientation 两处锁；
App 仍允许缺失 launch option 时默认 laptop，但 Android 正常入口必须读 surfaceForm 并显式
传给 sample assembly。Web dev-host 仍通过 URL/显式 prop 选择 laptop/mobile，不冒充 Android。

### 3.8 red theme 的 19 个 token

sample2 integration 自有 theme/global.css 与 tailwind.config.cjs；token 名字必须与
primitives 当前消费集合一致，取值如下（RGB 空格分隔）：

| token | RGB | 用途 |
| --- | --- | --- |
| action | 159 18 57 | 红色品牌强调背景 |
| action-foreground | 255 255 255 | action 上的中性白字 |
| canvas | 241 245 249 | 中性页面底色 |
| surface | 255 255 255 | 中性卡片/控件表面 |
| foreground | 15 23 42 | 中性主文字 |
| muted-foreground | 71 85 105 | 中性次要文字 |
| border | 203 213 225 | 中性边框 |
| ok-foreground | 21 128 61 | 既有绿色成功文字 |
| ok-background | 240 253 244 | 既有绿色成功背景 |
| ok-border | 134 239 172 | 既有绿色成功边框 |
| warn-foreground | 161 98 7 | 既有黄色警告文字 |
| warn-background | 254 252 232 | 既有黄色警告背景 |
| warn-border | 253 224 71 | 既有黄色警告边框 |
| error-foreground | 185 28 28 | 既有红色错误文字 |
| error-background | 254 242 242 | 既有红色错误背景 |
| error-border | 252 165 165 | 既有红色错误边框 |
| info-foreground | 3 105 161 | 既有蓝色信息文字 |
| info-background | 240 249 255 | 既有蓝色信息背景 |
| info-border | 125 211 252 | 既有蓝色信息边框 |

action `rgb(159 18 57)` 的 HSL hue 约 343.404°、saturation 约 0.797、lightness 约
0.347，`error-foreground rgb(185 28 28)` 的 HSL hue 为 0°、lightness 约 0.418；按环形
色相距离计算二者差约 **16.596°**（不是 18°），明度差约 0.071。两者的准确 RGB 都必须
进入 palette 的逐字取值断言；白色 action-foreground 与 action 的对比度超过 4.5:1。
action 是按钮/selected option 的背景；error-foreground 是错误提示文字，仍使用既有语义
红。二者不是同一渲染上下文。不能把 action-foreground 改红；红底红字会破坏按钮可读性。

## 4. 运行顺序、状态流与失败边界

### 4.1 启动流

~~~text
Android/Web 入口取得 surfaceForm
  -> assembly 创建 ports 与 runtime
  -> state hydrate（wallpaper 两字段、content containers、content layers）
  -> ui-state install 记录结构诊断并清理未知 layer
  -> session module bootstrap
  -> integration 根据 session 安排 PRIMARY/SECONDARY placement
  -> SurfaceRoot 渲染 WallpaperBackground + screen/layer
~~~

任何 hydrate 失败都不能用 initialState 写回伪成功。结构非法层只丢该行；未知 part 只丢
该层；已知但当前不可用的 layer 保留在 state。host 尚未准备好时只显示 render 自有 loading
indicator，不影响 catalog gate 或 persistence。

### 4.2 关键不变量

1. confirmed wallpaperId 是唯一背景读取来源；pending 只能控制 picker 高亮与 confirm enabled。
2. 两屏读取同一个 state selector；不为副屏复制 wallpaper state。
3. selection actor 是唯一把 picker 操作转成 select command 的地方；confirmed 不在 selection。
4. confirm actor 是唯一把 confirm UI 操作转成 confirm command 的地方；kernel 无 pending 是
   typed failure，不是 completed no-op。
5. layer persistence 与 container persistence 两个 prefix 分离；旧档无 layers 仍能启动。
6. catalog membership 只在 ui-state install 清除；availability 不在 hydrate 时永久删除。
7. Android 只有 dual-screen adapter 判定形态；assembly 只消费 launch option。
8. mobile 没有 SECONDARY surface，也没有 SECONDARY placement command。
9. ui/base/render 不增加任何图片或壁纸 owner。
10. 所有新增用户动作都经真实 Primitive 控件；不直接调用内部 reducer/state setter。
11. A3 的 asset identity 与两屏变化必须从实际 `WallpaperBackground` 的 render-ready/readback
    观察得到；不能从同一个 selector 或被测 `assetsById` 反向生成 oracle。每次确认都必须
    记录 `displayIndex`、`displayMode`、`assetId` 和 loaded 状态。

## 5. 真机截图与像素判据方法学

### 5.1 截图区域

每个场景同时保存 raw full-display screenshot 与处理元数据。比较区域按以下顺序得到：

1. 通过 Android UI/window diagnostics 取得 app content bounds，排除状态栏、导航栏、系统
   手势区域和显示器外框；这些边界作为 capture metadata 保存，不能只凭截图肉眼裁；
2. 用 SurfaceHostController canvas bounds 得到该 surface 的 canvas rect；
3. 用 testID 的真实动作节点 bounds 建 foreground mask：四个 wallpaper option、
   thumbnail、confirm button、可能的 loading/诊断提示；
4. wallpaper ROI 是 canvas rect 减 foreground mask，并排除系统光标、键盘、状态栏；
5. ROI 的 `roiRect` 面积必须至少占 `canvasRect` 面积的 20%，foreground mask 与
   `canvasRect` 的并集交面积不得超过 canvas 面积的 80%；比较工具对这两项做失败关闭校验，
   否则该捕获无效，不得通过调阈值收口。mask 只覆盖实际 option、thumbnail、confirm、loading
   与诊断节点，不得用整个外层 wrapper 吞掉背景；
6. 若 mask 不可取得或 canvas bounds 与截图不能建立唯一映射，该场景不是 PASS，而是
   UNVERIFIED_REQUIRES_EVIDENCE。

A2 选择前后使用同一个 surface、同一 form、同一设备、同一窗口大小与同一登录状态；每一对
截图的 canvas width/height、host width/height、displayIndex、surfaceForm 必须逐字段相同，
否则不得归因于壁纸。只在操作完成、无 loading 后截图。A3 两屏分别建立 ROI，不把不同尺寸
的 raw bitmap 直接逐字节比较；每屏都必须单独满足 ROI 面积与几何约束。

### 5.2 差异指标与阈值

对 ROI 的每个 sRGB 8-bit channel 计算绝对差：

~~~text
pixelChanged(p) = max(abs(R1-R2), abs(G1-G2), abs(B1-B2)) > 4
changedFraction = changed pixel count / ROI pixel count
P95 = ROI 内 max-channel absolute difference 的 95th percentile
meanAbsDiff = ROI 内三通道绝对差的平均值
changedCellFraction = 以 canvasRect 为唯一坐标锚点铺设的 8×8 等面积网格中，参与评估且
cell 平均 max-channel absolute difference > 4 的格子比例。每个 cell 的参与资格是：该
cell 内同时位于 roiRect 且未被 foreground mask 覆盖的像素数 / 该 cell 的完整像素面积
≥ 0.25；不满足 0.25 的 cell 同时从分子和分母剔除。网格不得以变化像素外接矩形、非空
ROI 外接矩形或 mask 后剩余像素外接矩形为锚点。`minUnmaskedFraction` metadata 必须
精确为 `0.25`，工具拒绝其他值。
~~~

同一状态连续抓两张作为 noise baseline B。B 只证明捕获稳定性，不是壁纸变化的证据；若
`B.changedFraction > 0.001`、`B.P95 > 2` 或 `B.changedCellFraction > 0.01`，设备/动画
噪声不可接受，该场景 OPEN，不通过放宽阈值或把 B 带入业务阈值解决。另保存两张 baseline
的 canvas/host 几何，几何不同也必须 OPEN。业务阈值固定为：

- 选择但不确认：`changedFraction <= 0.001`、`P95 <= 2`、`meanAbsDiff <= 1`，且
  `changedCellFraction <= 0.01`；
- 确认后确有变化：`changedFraction >= 0.20`、`P95 >= 8`、`meanAbsDiff >= 4`，且
  `changedCellFraction >= 0.75`；四项须同时满足；
- 多图 A2d：每次实际 source identity 必须等于独立的枚举期望，不能从被测 `assetsById`
  重新读取作 oracle；w1/w2/w3 的独立期望资源身份必须两两不同。逐张确认 w1、w2、w3，
  对每个有序对 (wi,wj) 使用 A2 确认侧同一 compare 工具、同一 canvas/ROI/mask metadata
  与同一阈值，确认 wi 与确认 wj 的壁纸 ROI 必须满足四项变化阈值；不得只断言 state 或
  source identity；
- A3：按需求正本已冻结的 (a)(b)(c) 判法执行，不做 raw-pixel equality，也不引入未定义的
  source sampling 术语。

上述阈值只用于判断当前 ROI 的显著变化，不用于颜色主题的对比度判定。由
`tools/terminal-image-compare/compare.mjs` 计算并输出上述四项指标；该工具只接受两张 PNG、
显式 ROI/mask metadata，遇到不支持的 PNG 编码、尺寸不一致或 metadata 缺失即失败关闭。
它不抓屏、不拥有 Android 生命周期，抓屏由受管运行步骤提供。工具自检必须用两组仓内
已知 PNG 覆盖 unchanged 与 changed 双向结果，并对 threshold mutation 命红。

raw screenshot、cropped ROI、mask JSON、metric JSON、设备 serial、displayIndex、surfaceForm、
canvas/host 尺寸、timestamp 与 SHA-256 一并保存；日志不得包含密码、token、原始设备标识或
raw payload。

### 5.3 证据档位

| 档位 | 可证明 | 不能外推 |
| --- | --- | --- |
| static | 文件/依赖/图字段/命令形状/色值/graph | 屏幕可见、Android 方向、Metro 实际解析 |
| focused | actor、reducer、descriptor、真实 RN 控件动作与纯函数 | 真机屏幕合成、双屏窗口、系统配置 |
| native | Kotlin unit 与 adapter launch option 行为 | Android VM 的完整窗口/IME/图像合成 |
| Android | 两台 VM 的实际 surface、方向、截图、重启 | 未覆盖的真机型号、release 包 |
| release | 目标 release 包的资产与启动行为 | 视觉等同于其他档位 |

## 6. 包、文件与骨架图详设

### 6.1 十一个产品 touched positions与一个证据支持位置

需求 §7.0a 的产品分母仍是四个新包加七个既有位置。为使 §5 的定量方法拥有真实执行体，
本详设另外登记一个不承载产品运行时能力的证据支持位置；它不改变产品范围分母，也不改变
任何 package owner。`apps/terminal/skeleton-graph.ts` 是 tools/terminal-skeleton 位置
所拥有的跨文件图源，单独列在其 source-level inventory 中，不再漏列。

| # | position | 主要文件/符号 | 是否改 render |
| --- | --- | --- | --- |
| 1 | kernel/feature/sample-wallpaper | package.json、tsconfig、README、moduleName、dependencies、index、slice、commands、actors、tests、terminal-invariants | 否 |
| 2 | ui/feature/sample-wallpaper-picker | package.json、tsconfig、README、moduleName、dependencies、index、assets、asset type、parts、picker actor/commands/components/tests | 否 |
| 3 | ui/integration/sample-wallpaper-console | package.json（含 ui.base.admin-shell、main/react-native/exports/terminalSurfaces）、tsconfig、README、moduleName、dependencies、index.js、src/index.ts、src/application/terminalSurfaces.ts、src/application/baseModuleDescriptors.ts、metro.config.js、babel.config.cjs、nativewind-env.d.ts、theme/global.css(.d.ts)、tailwind.config.cjs、assembly/parts/actors/tests、adminShellAssembly/AdminLauncher 接线 | 否 |
| 4 | assembly/android/sample-wallpaper-terminal | Expo入口、Android工程、ports、app.json、metro、babel、theme、README、tests/typecheck | 否 |
| 5 | ui/base/primitives | vendor/slots、PrimitiveImage、PrimitiveContainer、tokens、index、terminal-invariants、focused tests | 否 |
| 6 | ui/feature/sample-staff-auth | src/parts/parts.ts 的 login description 改为宿主中立 | 否 |
| 7 | kernel/base/ui-state | workspaceSlices、createUiStateModule、contentActors/commands、README、U-7/content tests | 否 |
| 8 | adapter/android/dual-screen | TerminalDualScreenActivityHandler 的形态决策、方向锁、primary/secondary launch options、native tests | 否 |
| 9 | assembly/android/sample-terminal | 删除 app.json 与 AndroidManifest.xml 的两处方向锁，回归测试 | 否 |
| 10 | tools/terminal-skeleton | `apps/terminal/skeleton-graph.ts`、check-static.mjs、static/red tests；每个新包 CP 同批维护节点与计数，CP-8 收口 reachability | 否 |
| 11 | tools/terminal-layering | uiNativePackages 的真实 integration 目录枚举与 static/red tests | 否 |
| 12 | tools/terminal-image-compare（证据支持） | compare.mjs、known-PNG self-test、ROI/mask/metric schema；不进入运行时 package graph | 否 |

`uiNativePackages` 的预期集合不得继续写成 `sample-console` 等源码内硬编码列表。检查器应从
传入的 integration root 枚举直接包含 `package.json` 的目录，并从每个 package.json 读取
moduleName/层级元数据；测试用隔离临时 fixture root 加入或删除一个 integration package，
确认集合随目录真实变化，且删除/漏枚举 mutation 会红。该 fixture 只服务工具测试，不进入
TER runtime graph 或产品 package。

ui/base/render 是明确的零改动位置，不应因实现方便加入背景或图片 seam。

`sample-wallpaper-console/package.json` 与现有 `sample-console/package.json` 的
`terminalSurfaces.orientations.portrait.PRIMARY` 必须统一写为 `360×640`。该值是 integration
的逻辑画布声明；Android mobile VM 的物理屏幕仍为 `720×1280`，adapter 只下发 surfaceForm，
不在 adapter 重复维护画布尺寸。

### 6.2 四个新 graph node与跨文件同步

~~~text
kernel.feature.sample-wallpaper
  batch=2
  dependencies=[kernel.base.contracts,kernel.base.state,kernel.base.runtime]
  devDependencies=[kernel.base.platform-ports]
  plannedKind absent; package exports moduleKind='owner'

ui.feature.sample-wallpaper-picker
  batch=2
  dependencies=[kernel.base.state,kernel.base.ui-state,kernel.base.runtime,
                kernel.feature.sample-wallpaper,ui.base.render,ui.base.primitives]
  devDependencies=[]
  plannedKind absent; package exports moduleKind='owner'

`ui.base.dev-host` 只由 integration 包的 `test-expo/App.tsx` 与开发期依赖清单使用，不进入
该包生产 `dependencyModuleNames`；因此它属于 integration 的 `devDependencies`，不得被误写进
picker 依赖或从 integration graph 中删除。

ui.integration.sample-wallpaper-console
  batch=2
  dependencies=[kernel.base.contracts,kernel.base.platform-ports,kernel.base.runtime,
                kernel.base.display-context,kernel.base.ui-state,
                kernel.feature.sample-staff-session,kernel.feature.sample-wallpaper,
                ui.base.admin-shell,ui.base.render,ui.base.input,ui.base.primitives,
                ui.feature.sample-staff-auth,ui.feature.sample-wallpaper-picker]
  devDependencies=[ui.base.dev-host]
  plannedKind absent; package exports moduleKind='owner'; assembly must include the shared admin
  parts in its only catalog and wrap each production content frame with AdminLauncher (TR-13)

assembly.android.sample-wallpaper-terminal
  batch=1
  plannedKind='toolkit'
  dependencies=[kernel.base.platform-ports,adapter.android.persist-kv,
                adapter.android.device,adapter.android.app-control,
                adapter.android.logger,adapter.android.dual-screen,
                ui.integration.sample-wallpaper-console]
  devDependencies=[]
~~~

上表是 implementation-facing 设计意图，不是假装已经与未来 src import 相等。实施时必须
先完成源码 import census，再同步 package.json 与 src/dependencies.ts；声明了但未 import
或 import 但未声明都不能交付。真实 module 的 package.json 不携带 plannedKind/kind；
assembly 作为 no-runtime-slice 的骨架 toolkit 使用 plannedKind。

四个新包的 graph 节点与 package census 必须跟随建包 CP 同批更新，不能拖到 CP-8：
当前基线为 `spec=27/batchOne=15/batchTwo=27`；CP-2 后为
`28/15/28`，CP-4 后为 `29/15/29`，CP-5 后为 `30/15/30`，CP-7 后为
`31/16/31`。每次同时更新 `apps/terminal/skeleton-graph.ts`、
`tools/terminal-skeleton/check-static.mjs` 的期望值及 `check-static.test.mjs` 的对应
断言。新 assembly 在 CP-7 同批加入 reachability 集合；CP-8 只执行最终 reachability、
无环、分层和红夹具收口。中间文件集合不得在已运行的静态 gate 中被故意留成不匹配状态。

### 6.3 包内文件清单

四个新包通用：

~~~text
package.json
tsconfig.json
vitest.config.ts（有 focused tests 时）
README.md（中文，定位/作用/结构/用法/迭代指引）
terminal-invariants.json
src/moduleName.ts
src/dependencies.ts
src/index.ts
test/
~~~

kernel feature 还需要 src/types、src/features/slices、src/features/commands、
src/features/actors、src/application/module.ts 和 public-surface typecheck。

picker 还需要 src/foundations/assets.ts、src/components/WallpaperPicker.tsx、
src/components/WallpaperBackground.tsx、src/features/commands、src/features/actors、
src/parts/parts.ts、src/foundations/wallpaperPickerTestIds.ts、assets/w1.jpg/w2.jpg/w3.jpg 及
`src/types/assets.d.ts`。CP-0 已实测 workspace JPG 需要 consumer-visible module declaration；
声明必须随 picker 的 source program 一起被 TypeScript 纳入，不能只放在一个未被 consumer
看到的包里。

integration 还需要 `package.json` 的 `main`、`react-native`、`exports`（含
`./theme/global.css`）和 `terminalSurfaces`，`index.js`、`metro.config.js`、
`babel.config.cjs`、`nativewind-env.d.ts`、`theme/global.css.d.ts`（按实际需要），以及
开发期的 `test-expo/App.tsx`（只接通用 dev-host，不进入生产 assembly）；
`src/assembly/assembly.tsx`、`src/parts/parts.ts`、`src/features/actors/actors.ts`、
`src/application/module.ts`、`src/application/terminalSurfaces.ts`、
`src/application/baseModuleDescriptors.ts`、`theme/global.css`、tailwind.config.cjs、
`test/theme.test.ts`、`test/sample2Assembly.test.tsx`。`terminalSurfaces.orientations.portrait`
只声明 `PRIMARY: {width: 360, height: 640}`，不得沿用旧的 `720×1280` 或其他 integration
包的历史尺寸。

assembly 还需要 App.tsx、index.ts、src/assembly/platformPorts.ts、app.json、
metro.config.js、babel.config.cjs、nativewind-env.d.ts、必要的 global.d.ts、Android
工程文件、中文 README 与不泄露敏感值的启动诊断。
`app.json` 的 `expo.slug`、Android `package/applicationId`、Gradle `namespace` 与 Kotlin
目录必须使用 §3.6 冻结的四个字面值，并包含该节列出的 5 张 PNG；不得以 `com.anonymous.*`
或未登记的占位图标代替。

证据支持位置 `tools/terminal-image-compare` 只包含 `compare.mjs`、显式的 ROI/mask/metric
输入输出约定和 `test/compare.test.mjs`。self-test 复用已存在的
`apps/terminal/assembly/android/sample-terminal/assets/android-icon-background.png`、
`android-icon-foreground.png`、`favicon.png`；8×8 差值反例在测试中由固定字节生成，不依赖
未定义的 canonical sample。它不加入 TER runtime graph、不依赖产品包、不抓屏，
只消费受管 runner 交给它的 PNG 与几何 metadata；PNG 编码、尺寸、ROI、mask 任一不合法都
失败关闭。其 self-test 必须用同尺寸但内容不同的已知 PNG 验证 changed 与 unchanged 两个
方向，另用不同尺寸 PNG 单独验证 fail-closed；已知 PNG 的仓内路径必须列入该工具的文件
清单，并通过改坏阈值的 mutation 证明测试会红。

### 6.4 README 交付要求

每个新包 README 必须说明：

- 包在 TER 四层中的定位和明确不负责的事项；
- 依赖哪些现有 owner、哪些包依赖它；
- 公开入口/命令/组件/part 的实际符号名；
- 典型调用示例必须能回读到当前源码导出；
- 失败、loading、资产缺失、重启和兼容边界；
- 如何添加一张图片、如何添加一个 section、如何迭代 Android 形态；
- 明确禁止第二 registry、第二 Image seam、第二背景 stack、直接 state setter。

示例不能写尚未存在的符号，实施后 README 必须与 index.ts 和 package exports 再读对账。

## 7. 横切机制对照表

| 机制 | 现成能力/规范 | 最低可证伪观察 | 无现成时的形态 | 本批全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | ui/base/render RenderContext、useUiStateSelector、catalog | static 看 import；focused 操作只读 selector | 复用 context，不把 state owner 放进 UI | picker、background、waiting、welcome、显示诊断 |
| 写授权与 grant 复核 | ui-state actor/command、TR-11 | focused 断言控件→picker actor→kernel actor | 不直接 reducer，不给 UI dispatchAction | select、confirm、placement、layer close |
| 跨 owner 写与事务 | 本批无业务跨 owner 写 | static 无 HTTP/DB；focused 只看 command 链 | N/A：UI state 各归既有 owner | 全部本地操作 |
| 集合形态与分页 | UiCatalog.entries、selectAvailableParts | focused 四个选项各一次、没有第二数组 | 四项有界集合，不做分页/截断 | 四个 wallpaper option、三个新 part、既有 auth parts |
| 缓存失效/改完刷新 | hydration 前置、completeUiStateWrite | restart 与 layer prune 后读取真实持久结果 | 不增加 cache；恢复依赖现有 state | wallpaper、content、layers |
| RTK currentData/isFetching | 前端规范 §3-B | static 无 RTK import | N/A：host loading 由 SurfaceHostController | host loading |
| 同一事实只有一个住址 | catalog、wallpaper selector、Android adapter | static/focused 同一 ID/source 在两屏 | 不复制 state/registry | wallpaper ids、assets map、surfaceForm |
| 失败可见且原因不得改写 | runtime typed error、render loading、logger | focused 分别验证 invalid、loading、unknown | 复用现有 error/logger 形态 | confirm 无 pending、asset missing、hydrate discard、host unavailable |
| owner 错误到 HTTP | backend standards | static 无 HTTP | N/A：本批无 backend | 全批 |
| 幂等键与重放 | frontend §3-G | static 无远端 mutation | N/A：本地 command 无 idempotency key | 全批 |
| 生成物不得手搓字符串 | package exports、现有 testID/source exports | static export/import census | 资产、testID、moduleName 单源 | public exports、test IDs、catalog keys |
| 日志与脱敏 | AGENTS observability/privacy | static 检索敏感字段；动态读取 structured log | 沿用 platform logger，记录 boolean/枚举/尺寸 | startup、hydrate、command failure、Android shape |
| 迁移回填与可逆性 | 无 DB migration | static 无 migration | N/A：清库/本地代码形状 | 全批 |
| 前端共享行为 | terminal LayerStack/InputController/vendor slots | focused 真实控件、restart、layer restore | 不接 web foundation，不新建 overlay | picker、login、background、layers |
| 候选/下拉数据源 | UiCatalog entries/filter | static/focused 只从 catalog 产生 section | 不建 admin/壁纸第二清单 | parts 与四个选项 |
| 编码与名称 | definePart/单一 catalog | static exact keys、focused 可见标题 | 照 definePart frozen 形态 | all new parts/assets labels |
| 同时坏的东西原子组 | foundation charter §5-C | static CP-01/CP-02 list；中间状态应红 | primitives seam + transparent token 同批 | image seam、overlay persistence、orientation launch |

## 8. 验收与场景设计

### 8.1 场景索引

| scenario | 档位 | 场景与业务 oracle |
| --- | --- | --- |
| WP-F01 | focused | 四项控件真实 Press；none/w1/w2/w3 source 与 selected/effective 一致 |
| WP-F02 | focused | 重复点击已选项、重复点击已确认项；picker actor 不派 kernel select |
| WP-F03 | focused | 选择不同项只改 pending，confirmed 与 background source 不变；确认后才派 confirm |
| WP-F04 | Android | laptop 主屏选择并确认 w1/w2/w3；A2 ROI unchanged/changed 阈值与 source identity |
| WP-F05 | Android | laptop 双屏同时截屏；waiting/welcome 真实文案；A3 三条冻结 oracle：两屏 ROI 各自变化、asset identity 相同、换另一张确认后两屏再次各自变化 |
| WP-F06 | Android/native | mobile 逻辑画布 360×640（VM 物理屏幕 720×1280），主屏可选与确认，不创建 SECONDARY |
| WP-F07 | focused/native | 无 pending 直接 kernel confirm；具名 code、非 completed、零 state 写入、零子命令 |
| WP-F08 | focused/Android | confirmed 后重启；wallpaperId、pending 空、background 与 picker 恢复 |
| WP-F09 | focused/Android | confirmed w2 后选 w3 不确认重启；两个 id、picker content、背景 w2 恢复 |
| WP-F10 | focused | layers 四格持久化、顺序、props；重启恢复 |
| WP-F11 | focused | old no layers、duplicate layerId、invalid props、invalid openedAt；诊断与其余行 |
| WP-F12 | focused | unknown layer 分别在 MAIN/BRANCH；启动当前另一 workspace；四格清理与 flush |
| WP-F13 | focused | known but unavailable layer 保留，切 form/context 后仍可再次满足可用性 |
| WP-F14 | Android | login/logout/cold anonymous/cold authenticated 的 PRIMARY/SECONDARY placement |
| WP-F15 | static/focused | red 19-token set、HSL/contrast、ok/warn/info 既有色相、A7 mutation |
| WP-F16 | Android | sample-terminal 完整既有登录、会员、新建/确认、logout journey；在已认证、存在 pending、登出后三个边界分别冷重启并核对既有业务状态与 placement |
| WP-F17 | static/focused/native | package/graph/layering/README/asset type 与源码集合对账；image-compare known-PNG 双向 self-test 与 mutation |

### 8.2 交叉覆盖矩阵

#### 壁纸维度

| value/operation | WP-F01 | WP-F02 | WP-F03 | WP-F04 | WP-F08 | WP-F09 |
| --- | --- | --- | --- | --- | --- | --- |
| none | 初始 selected；选中/确认 disabled | 重复点击 | no-op confirm | 从 image 回 none | confirmed none | pending none |
| w1 | source/selected | 重复点击 | pending→confirm | unchanged/changed | confirmed restart | w1→w3 pending |
| w2 | source/selected | 重复点击 | pending→confirm | unchanged/changed | confirmed restart | confirmed w2→pending w3 |
| w3 | source/selected | 重复点击 | pending→confirm | unchanged/changed | confirmed restart | pending/confirmed |
| 选择、确认、重复已选、重复已确认 | WP-F01 | WP-F02 | WP-F03 | WP-F04 | — | — |

#### 形态、会话、重启维度

| dimension cell | 覆盖 scenario | 不覆盖/理由 |
| --- | --- | --- |
| laptop + dual | WP-F04、WP-F05、WP-F08~F14、WP-F16 | — |
| mobile + single | WP-F01、WP-F03、WP-F06、WP-F08、WP-F09、WP-F14 | mobile 不验副屏，正本明确 single |
| 未登录 | WP-F01、WP-F05 waiting、WP-F14 | — |
| 登录成功 | WP-F03~F06、WP-F14 | — |
| 登出 | WP-F14、WP-F16 | — |
| 冷启动匿名 | WP-F14 waiting + PRIMARY login | — |
| 冷启动已认证 | WP-F08/F09/F14 | — |
| 已确认后重启 | WP-F08 | — |
| 未确认后重启 | WP-F09 | — |
| 未确认且界面恢复 | WP-F09 | — |
| 浮层恢复 | WP-F10~F12 | — |

#### 边界、workspace 与回归

| boundary | 覆盖 scenario | 预期 |
| --- | --- | --- |
| 无 pending 直接 confirm | WP-F07 | typed invalid-mode-like failure code，非 completed，零写入 |
| 未知 wallpaper id | WP-F11/WP-F17 | 结构校验或 command typed rejection；不得渲染未解析 source |
| old archive 没 layers 键 | WP-F11 | 空数组、无 error、既有 containers 正常 |
| duplicate layerId | WP-F11 | 保留先出现，丢弃后者，hydra 诊断 |
| invalid props | WP-F11 | 丢弃该 row，其他合法 row 保留，诊断 |
| invalid openedAt | WP-F11 | 非正整数/非 finite 丢弃，诊断 |
| invalid layer in MAIN，当前 BRANCH | WP-F12 | MAIN 的未知层在启动时被清理，切回不复活 |
| invalid layer in BRANCH，当前 MAIN | WP-F12 | BRANCH 的未知层在启动时被清理，切换不复活 |
| 既有 sample App 完整旅途 | WP-F16 | 与治理前主/副屏 part 与业务状态一致 |

### 8.3 A 判据到用例

| requirement criterion | scenario | 档位与 oracle |
| --- | --- | --- |
| A1 | WP-F01、WP-F03、WP-F04 | focused 真控件/source/selected；Android 截图辅助 |
| A2 | WP-F04 | Android wallpaper ROI；选择前后 threshold 内，确认后 threshold 外 |
| A2d | WP-F01、WP-F04 | renderer 的 asset identity 等于独立的 wallpaper id→asset 期望；w1/w2/w3 的独立期望资源两两不同 |
| A2b | WP-F03 | disabled/enabled 真实属性随 pending 派生 |
| A2c | WP-F07 | kernel typed error、journal 无 child、state 字节相同 |
| A3 | WP-F05 | Android laptop 双屏；(a) 两屏 wallpaper ROI 各自变化，(b) 两屏 asset identity 相同，(c) 换另一张确认后两屏 ROI 再次各自变化；不做 raw-pixel equality |
| A4 | WP-F05、WP-F14 | 副屏 screenshot 真实可见等待/欢迎文案 |
| A5 | WP-F08 | restart runtime 后 confirmed id 与可见背景 |
| A5b | WP-F09 | restart 后 confirmed/pending/content/background 四项 |
| A5d | WP-F08 | confirm 后 pending 缺省且重启不复活 |
| A5c | WP-F10 | layerId/partKey/props/openedAt/order 恢复 |
| A6 | WP-F06 | 两台 VM 中 mobile VM 的 width/height、Bundle、orientation、single surface |
| A7b | WP-F15 | 实际 button bg/text contrast、action/error 区分、semantic hues |
| A7 | WP-F15 | 19 token 双向集合与实际 red palette |
| A8 | WP-F16 | sample-terminal 完整旅途每步截图与 part/state oracle |
| A9 | WP-F06 | mobile 真实运行/readback 中无 SECONDARY dispatch、无 SECONDARY surface；waiting/welcome 不在 mobile filter；加入“变异创建 SECONDARY 必红” |

### 8.4 红夹具与可证伪性

| fixture | target mutation | test | 必红原因 |
| --- | --- | --- | --- |
| F-A2a | picker/waiting/welcome transparent 改回默认 opaque container | WP-F04 | confirm 后 wallpaper ROI 不变化，changed threshold 失败 |
| F-A2b | 非 none 的 w2 asset 映射为 undefined | WP-F01/WP-F04 | 测试用独立的 w2 期望资源/枚举与渲染 ready 结果，不能重新读取被变异的 assetsById；source completeness 必红 |
| F-A5 | selection persistIntent 改 never | WP-F08 | confirmed restart 丢失 |
| F-A5b | 删除 pending field descriptor | WP-F09 | unconfirmed choice/UI/background state 断言失败 |
| F-A2c | 删除 picker actor 的 effective equality guard | WP-F02 | 重复点击产生 kernel select command，dispatch count 失败 |
| F-A2 | background selector 改读 pending | WP-F04 | 选择未确认即改变 ROI，unchanged threshold 失败 |
| F-A7 | sample2 theme 换回 sample-console 蓝/中性 action 值 | WP-F15 | exact approved palette/HSL/red predicate 失败 |
| F-A3a | PRIMARY 传 WallpaperBackground、SECONDARY 不传 | WP-F05 | SECONDARY ROI 在确认后不变化或无 ready identity，A3(a) 必红 |
| F-A3b | SECONDARY 使用写死 asset id、不再读 selector | WP-F05 | 首次变更可能侥幸通过，但换另一张后 SECONDARY ROI/asset identity 与 PRIMARY 不再一致，A3(b)(c) 必红 |
| F-A5d | confirm reducer/actor 清除 pending 的转移被删除 | WP-F08/WP-F09 | 确认后重启仍有 pending，A5d 必红 |
| F-A9 | mobile 路径额外创建 SECONDARY surface 或 dispatch | WP-F06 | mobile run/readback 的 surface count、dispatch journal 与无 SECONDARY 断言必红 |

任何红夹具若不能实际弄红，不能保留“判据已覆盖”的措辞；应修判据或把它标为
UNVERIFIED_REQUIRES_EVIDENCE。

## 9. UI/testId 前置复核

当前 task 不授权 L2，故：

~~~text
UI_DESIGN_REVIEW=OPEN
TESTID_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
~~~

未来允许 L2 前，必须以真实动作节点核验以下 source：

| action | TestIds owner | 节点 |
| --- | --- | --- |
| none/w1/w2/w3 选择 | sample-wallpaper-picker/foundations/wallpaperPickerTestIds.ts | 各自 PrimitiveRadio/Pressable |
| confirm | sample-wallpaper-picker/foundations/wallpaperPickerTestIds.ts | PrimitiveButton Pressable |
| login/logout | sample-staff-auth 既有 testID source | 既有输入/按钮节点 |
| waiting/welcome 观察 | sample-wallpaper-console TestIds | 真实文案节点 |
| host loading/canvas | ui-base-render 既有 test IDs | 真实 SurfaceHostController nodes |

不能用 text、role、index、CSS、XPath、外层 wrapper 或散写 data-testid 替代这些常量。

## 10. 需求、详设、实现与证据对账规则

实施前后必须用以下维度逐点双读：

| 维度 | 要核的具体事实 |
| --- | --- |
| behavior | 选择/确认/重复/恢复/清理是否按状态机 |
| shape | state、catalog、descriptor、Bundle、graph 字段是否精确 |
| action | 每个用户操作是否真实控件→command→actor |
| relation | 四层依赖方向、单 catalog、同一 selector、主副屏 propagation |
| position | 透明背景在 children 第一层，控件位置与 mobile/laptop layout |
| copy | 登录、waiting、welcome、loading、错误和 README 文字 |
| state/control | selected、pending、disabled、loading、unknown、old archive |
| failure/recovery | typed error、hydrate discard、restart、config change |
| access/focus | native virtual input、可寻址 testID、无隐藏遮挡 |
| data/invalidation | asset map、catalog membership、display form、workspace 四格 |

每个实际变更文件以 unique symbol 与需求 ID、design anchor、行为对照、证据档位列入计划
§5；只有 MATCHED 或 OPEN。计划不是实现证据；实现完成前的 reconciliation 不能写 PASS。

## 11. 设计阶段自检与待复评项

已自检：

- 方案没有新增第二 registry、第二 overlay stack、第二 Image seam、第二输入管线或第二
  display 判定；
- kernel 不依赖 UI asset，picker 不拥有持久 slice，integration 拥有 placement；
- layers 独立 prefix、旧档兼容、四格 workspace/displayMode、membership 与 availability
  分离；
- Android 形态来源、Bundle key、方向锁和 config change 已给出字段级形态；
- 19 token 有具体值，action 与 error 的渲染上下文和对比度已说明；
- A1-A9、红夹具、壁纸/形态/会话/重启/边界/回归矩阵均有场景索引；A3 按需求正本三条
  已冻结行为断言，不保留未定义的比较样本；
- §5 的定量截图方法已指定唯一的未来 owning execution body：`tools/terminal-image-compare`，
  并登记为第 12 个非 runtime 证据支持位置；当前工具尚未创建，也没有动态证据；
- Metro/JPG/type declaration 没有提前执行，明确放在实施首步。

仍需在复评中明确：

1. 实施首步实测 Metro workspace JPG 解析与资产类型声明的最小落点；
2. 新增 diagnostics queue 与 internal prune command 是否符合 review 对“install 期 actor”
   的接受边界；这是为遵循当前 RuntimeModuleContext 的技术实现，不是新增产品能力；
3. 两台 VM 的 raw screenshot 与 A3 结果，当前完全未执行；
4. 所有实际 source/test/package/graph/tool 文件在实施后逐行与本设计对账，当前尚未发生。

这些 OPEN 是实施或动态证据项，不是待 Dexter 选边的产品语义；设计状态保持 OPEN_FOR_REVIEW，
可进入 Dexter/Claude 设计复评，但不授权源码实施。
