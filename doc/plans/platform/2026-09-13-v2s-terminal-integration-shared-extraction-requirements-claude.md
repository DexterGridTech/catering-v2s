# TER integration 层可复用内容抽取 — 需求分析与形态设计

```text
DOC_KIND=REQUIREMENTS_ANALYSIS + EXTRACTION_DESIGN
AUTHOR=Claude
REVISION=3（前两版经三轮 fresh 独立对抗审查后作废重做,见 §0.2）
EVIDENCE_TIER=static;未执行任何命令
AUTHORITY=分析与设计输入,不是实施授权
```

## 0.1 Dexter 的方向裁定（写死）

> **不计成本,按最优、最长远的方式改。该放哪里就放哪里,不妥协。**
> —— Dexter 2026-09-13

四条执行规则:归属由概念决定而非图的便利;允许新增包;允许改既有 kernel 契约;不接受"先凑合"(任何暂留须带可证伪的重开条件)。

⚠️ "不计成本"针对**工作量**,不针对**正确性证据**,也不豁免仓内已记录的裁定。

## 0.2 前两版为什么作废

三轮 fresh 独立对抗审查推翻了前两版的大部分内容。根因不是单点疏忽,是方法错误:**先搭论证结构、再找证据支撑,而没有先把消费者集合与既有裁定枚举完。**

四处具体失败:
- 提议把 theme 抽进 `ui/base/primitives`,而 `ui/integration/sample-console/README.md:44` 明文写着"**不要建立共享 theme 包或 `ui/theme` 层**"——我没读那个包的 README;
- 提议把 `createDeskNavigationActor` 上移 integration,而 `TR-12` 第 3 条(Dexter 定为"整个 TER 的灵魂")明文把"成功后跳哪里"指派给 `ui/feature`,并禁止 `partKey` 出包——我读了 TR-09 却没读 TR-12;
- 声称"全仓没有语义 token 一致性校验",实际 `ui/integration/sample-console/test/theme.test.ts:13-43` 就是——我按想象的文件名 `find`,而不是按行为搜;
- 全程没把 `assembly/android/sample-terminal` 当消费者,于是漏掉一整个 `SurfaceForm` 消费方、第二份 `tailwind.config.cjs`,以及「那份 config 今天零测试覆盖」这一事实。

本版把顺序倒过来:**先列证据基座(§1、§2),再谈抽取(§4)。**

## 1. 证据基座一 · 消费者全集

凡涉及抽取,先枚举今天谁在消费。三个包,不是一个:

| 包 | 层 | 消费什么 |
|---|---|---|
| `ui/integration/sample-console` | integration | 全部 |
| `ui/base/dev-host` | ui/base | surface 类型(自行重复声明)、已解析的 `terminalSurfaces` 对象 |
| `assembly/android/sample-terminal` | assembly | `SurfaceForm` 类型、`createSampleAssembly`、`theme/global.css`、自有 `tailwind.config.cjs` |

`assembly/android/sample-terminal` 是**真正出 APK 的那个包**,前两版完全遗漏。它:
- `src/assembly/platformPorts.ts:14` 与 `App.tsx:7` 从 `ui-integration-sample-console` import `SurfaceForm`,而其 `skeleton-graph.ts:212-224` 依赖清单**不含 `kernel.base.display-context`**;
- 有一份自己的 `tailwind.config.cjs`,其 `colors` 块与 sample-console 的**逐字相同**(我做过 diff);
- 没有自己的 `theme/global.css`,`metro.config.js:14` 指向 sample-console 那一份。

## 2. 证据基座二 · 已记录裁定全集

这些是本设计的硬约束,不得静默推翻:

| 出处 | 裁定 |
|---|---|
| `sample-console/README.md:19,44` | 主题属 integration app,**不抽到共享包**;新增应用复制自己的 `theme/`,**不要建立共享 theme 包或 `ui/theme` 层** |
| `sample-console/README.md:46` | 通用宿主读取传入的 `terminalSurfaces`,**不在第二处解析 `package.json`** |
| `sample-console/README.md:37` | displayMode 推导回到 `display-context` owner,**不在 assembly consumer 内复制 `PRIMARY`/`SECONDARY` 映射** |
| `sample-console/README.md:11` | 三个 base module descriptor 是"base 包尚未提供正本工厂时的**单一过渡位置**" |
| `sample-console/README.md:64` | **先在真实 feature 旅途中看见重复,再判断是否下沉到已有 base toolkit;不要预先为假设的业务形态扩展本包** |
| `primitives/README.md:73` | `src/theme/` 只含 base 展示 token 与 tone 映射,**不含应用主题** |
| `TR-12` 第 3 条 | `ui/feature` **必须有自己的 module 与 actor**;"失败了怎么呈现""成功后跳哪里"只能由 UI 侧承接;**`partKey` 自始至终不离开拥有它的 `ui/feature` 包** |
| `TR-09` | `toolkit` 不得拥有 slice;slice 名以 moduleName 为前缀。⚠️ "owner 必须有 slice"那一半**门未实现**,且 `member-desk`/`staff-auth` 今天就是 `owner` + `slices: []` |
| `TR-11` | 事件必须变成 command,由关心的一方定 actor |

**`README:64` 决定了本文的抽取门槛**:按**已观察到**的重复抽,不按假设抽。Dexter 指定的"第二个 integration 包"假设用于**校验方向**,不用于**制造依据**。

## 3. 观察到的重复 vs 未观察到的

### 3.1 观察到的(构成抽取依据)

| # | 重复事实 | 实例数 | 证据 |
|---|---|---|---|
| D-1 | `SurfaceForm` 类型声明 | **3** | `kernel/base/ui-state/src/types/catalog.ts:7`(含 `isSurfaceForm`)、`sample-console/src/application/terminalSurfaces.ts:10`、`dev-host/src/components/testExpoApp.tsx:23` |
| D-2 | `SurfaceSize` / `TerminalSurfaces` / `SurfaceCreationInput` 类型 | **2** | `terminalSurfaces.ts:4,21,12` 与 `testExpoApp.tsx:18,31,25` |
| D-3 | 19 个语义色名映射 | **2**,逐字相同 | `sample-console/tailwind.config.cjs:10-30` 与 `assembly/android/sample-terminal/tailwind.config.cjs:11-31` |
| D-4 | `displayIndex → surfaceKey` 映射 | **2** | `assembly.tsx:275` 三元派生 vs `sample-terminal/platformPorts.ts:40-41` 字面量声明 |
| D-5 | "把 workspace 依赖当成运行期模块依赖"的绕行 | **3** | `sample-console/src/application/baseModuleDescriptors.ts:20-24`(造 3 个假 descriptor)、`member-desk/src/application/module.ts:35-37`、`staff-auth/src/application/module.ts:22-24`(各自手写排除清单) |

**D-2 的重复是分层逼出来的**:`dev-host` 在 `ui/base`,结构上不能依赖 `ui/integration`,所以只能抄一份。它抄的是**形状,不含解析器**,两侧可静默漂移。

### 3.1b 观察到的归属错位(另一类抽取依据,判据独立)

E-3 与 E-4 **不是重复**——它们各只有一个实例。把它们放进 §4 需要另一条依据,不能借 §3.1 的重复论。依据是**错位**:代码待在了不拥有它的包里。

**错位判据(可证伪)**:三条同时成立才算错位——
(a) 它的全部输入与输出类型都由 base 包拥有;
(b) 它不含任何应用特有的值(字面量、文案、业务分支);
(c) 它所包装的主体已经在 base 包里。
**反例形式**:能举出该段代码里的一个应用特有值,或指出其输入/输出含 integration 自有类型,则判据不成立、不得抽。

| 段 | (a) 类型归属 | (b) 应用特有值 | (c) 主体位置 | 判定 |
|---|---|---|---|---|
| `createStateSource` / `createDispatchCommand`(`assembly.tsx:179-188`) | 入 `Runtime`(kernel.base.runtime),出 `RenderProviderProps[...]`(ui.base.render) | 无 | 包装 runtime 自身方法 | **错位** |
| `getSurfaceHostSource`(`assembly.tsx:265-299`) | 入 `SurfaceCreationInput` + `SurfaceHostMeasurementSource`,出 bound source——全是 base 概念;缓存键 `displayIndex:displayMode:surfaceForm` 亦然 | **有一个**:rejection 日志里的 `source: 'sample-console.bindSurfaceHostIdentity'` 字面量,且 logger 取自 `input.platformPorts` | `bindSurfaceHostIdentity` 已在 `ui.base.render` | **参数化后错位**(见 E-4) |

第二行的 (b) 不满足,所以 E-4 **不能整段照搬**:必须把那段日志留在应用侧,只把解析与缓存搬走。这正是 E-4 签名里 `onIdentityRejected` 存在的理由——不是为了好看的可扩展性,是判据逼出来的。

### 3.2 既不重复也不错位(明确不抽)

| 内容 | 实例数 | 不抽的理由 |
|---|---|---|
| `readTerminalSurfaces` 解析器 | **1** | `README:46` 明文"不在第二处解析 `package.json`",dev-host 收的是已解析对象。**解析器重复今天不存在** |
| 装配编排(`createSampleAssembly` 主体) | **1** | 无第二实例。`README:64` 禁止为假设形态预先抽取 |
| `RenderProvider`/`SurfaceRoot`/`AdminLauncher` JSX 树 | **1** | 同上。且 `AdminLauncher` 是否出现在每个 App 的主屏是**产品决定**,不是零业务 |
| 启动与显示链诊断 | **1** | 同上。另注:`assembly.tsx:245-256` 的 `startup.runtime-facts` **不在 `__DEV__` 内**,与其余 `__DEV__` 段性质不同,不可混为一谈 |

前两版把这四项都列为抽取对象,依据只有"第二个包会照抄"。按 `README:64`,这是为假设扩展。**本版全部撤回。**

**预判一个必然被问到的质疑**:E-1 把 `TerminalSurfaces` 搬进 display-context 之后,解析器的出参就变成 base 类型了;它错误信息里的 `[sample-console]` 前缀(`terminalSurfaces.ts:63,65,74`)和 E-4 的日志字面量一样可参数化——凭什么一个参数化后搬走、一个不搬?

答案在判据 (c),不在 (b):`bindSurfaceHostIdentity` **已经在 render 里**,E-4 搬的是包在它外面的缓存壳,不搬就把一件事劈在两个包;而 `readTerminalSurfaces` 在 base 侧**没有任何被包装的主体**,搬过去是凭空给 base 加职责。(c) 是这两例的真正分水岭,(b) 只是次要证据。`README:46` 的独立裁定与该判定同向。

## 4. 抽取设计

E-1 / E-2 / E-5 对应 §3.1 的重复(D-1~D-5),E-3 / E-4 对应 §3.1b 的错位。两类依据不混用。

### E-1 · `SurfaceForm` 与 surface 形状类型 → `kernel.base.display-context`

**只搬类型,不搬解析器。** 解析器无重复(§3.2),留在 integration。

```
// kernel/base/display-context 新增
export type SurfaceForm = 'laptop' | 'mobile'
export const isSurfaceForm: (value: unknown) => value is SurfaceForm
export type SurfaceOrientation = 'landscape' | 'portrait'
export type SurfaceSize = Readonly<{width: number; height: number}>
export type SurfaceDeclarations = Readonly<Record<DisplayMode, SurfaceSize>>
export type PortraitSurfaceDeclarations = Readonly<Pick<SurfaceDeclarations, 'PRIMARY'>>
export type TerminalSurfaces = Readonly<{orientations: {landscape: SurfaceDeclarations; portrait?: PortraitSurfaceDeclarations}}>
export type SurfaceCreationInput = Readonly<{displayIndex: 0 | 1; displayMode: DisplayMode; surfaceForm: SurfaceForm}>
export const surfaceKeyForDisplayIndex: (index: 0 | 1) => 'PRIMARY' | 'SECONDARY'   // 解 D-4
```

**归属依据**:这些是"这台终端有哪些显示面、各是什么形状"的声明,与 display-context 已拥有的 `DisplayMode`、`resolveSurfaceDisplayMode`、`resolveSecondarySurfaceAvailable` 同族。`README:37` 已确立"映射归 display-context owner、不在 consumer 内复制"的原则,`surfaceKeyForDisplayIndex` 是同一原则的延伸。

**`SurfaceForm` 是下移不是反向引用**:`ui-state → display-context` 边已存在(`skeleton-graph.ts:52`),display-context 的依赖清单不含 ui-state,**不成环**。

⚠️ **但"零新增边"不成立,前两版写错了。** `assembly/android/sample-terminal` 是第三个消费包,且**依赖清单里没有 display-context**(`skeleton-graph.ts:212-224`)。它使用 `surfaceKeyForDisplayIndex` 就必须新增 `assembly.android.sample-terminal → kernel.base.display-context` 边。替代是让 sample-console 继续 re-export,但那会让一个 integration 包成为 kernel 概念的转发站,与 §0.1 规则 1 冲突。**本文选新增边,并把它显式记在 §5。**

⚠️ **一处必须一并裁定的不一致**:`SurfaceForm` 的**类型**移到 display-context 后,承载它的 slice 仍是 `kernel.base.ui-state.surface-form`(`ui-state/src/features/slices/surfaceForm.ts:13`),`selectSurfaceForm` 也仍在 ui-state。概念 owner 与状态 owner 分离。见 §6 第 1 项。

**被 `sample-console` 再导出的影响**:`src/index.ts:6-14` 以 type 形式再导出这批类型,而 `assembly/android/sample-terminal/App.tsx:7` 正从这里 import `SurfaceForm`。E-1 要同步改这三处的公共面与 `terminal-invariants.json`。

### E-2 · 拆开"workspace 依赖"与"运行期模块依赖"两个被混同的概念

**根因(已亲验)**:各包的 `dependencies.ts` 导出 `dependencyModuleNames`(workspace 依赖,骨架门用),module 工厂又把同一个数组直接喂给 `RuntimeModule.dependencies`(运行期模块依赖)。但全仓**只有两个 base 包真的注册运行期模块**——`kernel.base.runtime` 与 `kernel.base.display-context`;`contracts`/`platform-ports`/`state`/`ui-state`/`render`/`primitives`/`input`/`admin-shell` 都没有 RuntimeModule 工厂。

`resolveModuleOrder:39-43` 对任何找不到注册模块的必需依赖直接 `throw Missing required runtime module dependency`。于是三处各自绕行:

- `baseModuleDescriptors.ts:20-24` 给 contracts/platform-ports/state **伪造** 三个 `kind: 'toolkit'` 的空 descriptor,骗过查找;
- `member-desk/module.ts:35-37` 与 `staff-auth/module.ts:22-24` **手写排除** `ui.base.render`/`primitives`/`input`。

⚠️ 前版把这归因为"toolkit 包"是错的:`ui.base.input` 的 `plannedKind` 是 **`owner`**(`skeleton-graph.ts:85-87`),照样被排除。真正的判据不是 kind,是**该包有没有注册运行期模块**。

**前版解法(给三个 kernel 包各加 descriptor 工厂)是错的方向**:它把 24 行绕行升格为三个 kernel 包的公开面,而且完全不消除另外两处排除清单。我当时把"造假 descriptor"当成了唯一表现。

**本版解法**:在 `dependencies.ts` 把两个概念显式分开——

```
export const dependencyModuleNames = [...] as const            // workspace,骨架门用,不变
export const runtimeModuleDependencyNames = [...] as const     // 真正注册运行期模块的子集
```

module 工厂改用后者。三处绕行(1 处伪造 + 2 份排除清单)一起删。

**必须配门,否则只是把绕行换了个位置。** 在 `tools/terminal-skeleton/check-static.mjs` 加两条断言:
1. `runtimeModuleDependencyNames ⊆ dependencyModuleNames`;
2. 其中每个名字对应的包**确实导出 RuntimeModule 工厂**。

第 2 条是真行为门(打开目标包源码判存在性),不是关键词匹配。缺了它,清单会像今天的排除清单一样悄悄漂移。

**不选 `optional: true`**:`resolveModuleOrder:40` 已支持把依赖标成 optional 从而跳过。它零改动,但会让**真正缺失**的必需模块也静默通过——用失去检查能力换省事,与 §0.1 规则 4 冲突。记在这里是因为它是最省事的替代,必须说清为什么不选。

这也兑现了 `README:11` 登记的"等 base 包提供正本工厂":答案是**不需要正本工厂,contracts/platform-ports/state 本就不是运行期模块**。该 README 条目届时应删除而非更新。

### E-3 · Runtime ↔ Render 适配 → `ui.base.render`

```
export const createRuntimeStateSource: (runtime: Runtime) => RenderProviderProps['stateSource']
export const createRuntimeDispatchCommand: (runtime: Runtime) => RenderProviderProps['dispatchCommand']
```

两端 owner 分别是 runtime 与 render,render 已依赖 runtime。**三轮审查无人反对此项。**

### E-4 · host source 解析与缓存 → `ui.base.render`

```
export const createSurfaceHostSourceResolver: (input: Readonly<{
  sourcesByDisplayIndex?: Readonly<Partial<Record<0 | 1, SurfaceHostMeasurementSource>>>
  onIdentityRejected?: (rejection: SurfaceHostIdentityRejection, surface: SurfaceCreationInput) => void
}>) => (surface: SurfaceCreationInput) => SurfaceHostSource | undefined
```

`bindSurfaceHostIdentity`(`render/src/index.ts:22`)与 `SurfaceHostMeasurementSource`/`SurfaceHostIdentityRejection`/`SurfaceHostSource`(`:27-32`)本就是 render 的公开导出。rejection 以纯数据回调给调用方,不携带写能力,与 `TR-11` 不冲突。

⚠️ **与 E-1 重叠,须一并处置**:D-4 的那处三元映射就写在本段内部(`assembly.tsx:275`)。解析器搬进 render 后,它应改用 E-1 的 `surfaceKeyForDisplayIndex`,而不是在 render 里再写一次三元。两项分开做会留下第三个映射点。

### E-5 · 语义色名一致性 → 强化既有 `theme.test.ts`,不建共享 theme 包

`README:44` 与 `primitives/README.md:73` 禁止在 base 包建共享 theme 机制。**前两版的 E-6 直接违反该裁定,已撤回。**

真实缺口不是"没有校验",而是**既有校验是单向且硬编码的**:`sample-console/test/theme.test.ts:13-33` 把 19 个名字写死在测试里;它虽然读了 `primitives/src/theme/tokens.ts`(`:12`),却只对其抽查 5 个 class 名(`:39-43`),不从中派生名字集合。primitives 新增一个色名而没人改这张表 → 全绿,渲染静默出错。而且 `assembly/android/sample-terminal` 那份 config **今天零覆盖**(其 `terminal-invariants.json` 的 test 是 `ABSENT`)。

**设计**:提升为仓级 checker `tools/terminal-theme/check-static.mjs`,枚举 `apps/terminal/**/tailwind.config.cjs`,对每份断言——
1. `colors` 键集合 **双向等于** 其 content glob 覆盖源码中实际出现的语义色名集合;
2. 每条 content glob 至少匹配一个文件(抓路径写错导致的静默 purge);
3. 对应的 CSS input 为每个色名提供 `--color-*` 定义。

零新增导出、零新增包边、不触碰 primitives 的公共面,并**顺带覆盖今天零覆盖的 android assembly**。

## 5. 包图影响

| 变更 | 边影响 | 成环 |
|---|---|---|
| E-1 类型下移 | ui-state / render / dev-host:**无**(均已依赖 display-context)。**`assembly.android.sample-terminal → kernel.base.display-context`:新增一条** | 无(display-context 不依赖 ui-state) |
| E-2 拆分依赖声明 | 包图**无变化**——`dependencyModuleNames`(骨架门读的那份)一个字不动,只是新增一份运行期子集 | 无 |
| E-3 / E-4 | 无 | 无 |
| E-5 仓级 checker | 无(`tools/` 不入包图) | 无 |

⚠️ **全部为静态判断,未运行 `check-static.mjs`。** E-1 的新边与 E-2 的新增门**落地前必须各实测一次 `check-static.mjs`**。

## 6. 待 Dexter 裁决

1. **`SurfaceForm` 的状态 owner 是否随类型一起动。** E-1 把类型移到 display-context,但 slice(`surfaceForm.ts:13` 的 `kernel.base.ui-state.surface-form`)与 `selectSurfaceForm`(`ui-state/src/selectors/selectSurfaceForm.ts:5`)仍在 ui-state。

   - **(甲)保持现状**:概念 owner 与状态 owner 分离,并写明重开条件。
   - **(乙)slice 一并移到 display-context**:它已有 `displayRole` slice(`displayRole.ts:9`),再加一个同族的不违反 TR-09。

   **我倾向乙**——"这个显示面是什么形态"与"这个显示面是什么角色"是同一个问题的两半,分在两个包里长期都要靠人记住。

   但必须说清乙的真实代价,不能只说"改动面大":`selectSurfaceForm` **不只是被外部读**,它被 ui-state 自己的 `currentCatalogContext` 当作目录过滤输入用(`contentActors.ts:165,173,234,239`),并经 `createUiStateModule.ts:78,128` 注入。移走后 ui-state 变成读 display-context 的 selector——`ui-state → display-context` 边已存在,按 TR-03 合法且不成环,但 `createUiStateModule` 的入参与 ui-state 的公共面都要改。请你定。

2. **`sample-console` 拥有自有 slice 这条裁定,在 TR-12 下没有合法落点。** 你此前裁定"`sample-console` 与 `sample-console-2` 定位一致,要有自己的 actor 与 slice"。三轮审查证明:跨 feature 的画面编排被 `TR-12` 第 3 条明文指派给 `ui/feature`(且 `partKey` 不得出包),所以 sample-console 今天**没有属于它的业务逻辑**;硬造一个 phase slice 会是 `TR-09` 明文禁止的占位。补充事实:`member-desk` 与 `staff-auth` 今天就是 `kind: 'owner'` 加 `slices: []` 且全门绿,**"owner 必须有 slice"在本仓既无门强制也无先例**。

   **但"integration 永远不该有 slice"也不成立**,我把话说满了就是错的。TR-12 给 integration 的职责是"按交互场景挑选组合",确实存在**没有任何单个 ui/feature 能拥有**的状态。我能具体举出三个候选:

   | 候选 | 为什么 member-desk / staff-auth 都拥有不了 | 今天有没有业务事实 |
   |---|---|---|
   | 控制台生命周期(`boot` → `ready` → `degraded`) | 它描述的是整个 console 的装配结果,不属于任何一个域 | **无**。今天 `createSampleAssembly` 命令式跑完就结束,没人读这个状态 |
   | 跨 feature 的画面仲裁(同一 surface 上谁当前占据主屏) | 两个 feature 互不知道对方存在,谁也无权裁决 | **无**。今天只有一条主路径,不存在竞争 |
   | 应用级 overlay 互斥(AdminLauncher 与业务弹层同时想开) | 同上 | **无**。今天 AdminLauncher 是唯一 overlay |

   三个都成立于概念,**三个今天都没有对应的业务事实**。现在建任一个,就是 `TR-09` 明文禁止的"造一个占位 slice 去满足门"。

   所以请在三者中选一:
   - **(甲)撤回该裁定**,sample-console 保持 `owner` + `slices: []`,与 member-desk/staff-auth 一致;
   - **(乙)保留裁定并指定上表某一项**(或你心里的第四项),我按它设计——但这等于同时决定**现在就把那块业务做出来**,否则 slice 是空的;
   - **(丙)改写成条件式裁定**:"integration 出现真实跨域仲裁时必须自己拥有该 slice,在此之前不得预建"——把你的意图记进规范,又不逼出占位。

   **我推荐丙**:它保住了你原裁定的实质(该归 integration 的不许塞进 feature),又不违反 TR-09。甲会丢掉你的意图,乙会把范围扩到做新业务。最终仍由你定。

3. **`ui/feature/sample-member-desk` 与 `kernel.feature.sample-staff-session` 的依赖是否要处理。** 前两版主张移除,已撤回——按 `TR-12` 第 2 条,"领域事件命令是 kernel 对外的公开契约面",member-desk 监听 staff-session 的会话命令**是该架构的正常用法**,不是缺陷。1:N 的复用轴在 ui/feature 一侧:`member-desk-2` 会是同一 kernel 域下的另一个 ui/feature,自带它自己的"跳哪里"答案。**建议不动**,但因为前一版已获你批准扩大范围,此处显式请你确认撤回。

## 7. 授权边界

本文是分析与设计输入,**不是实施授权**。未执行任何命令,未修改任何源码。§5 的两处实测须在实施前完成;§6 三项裁决未决前不动手。
