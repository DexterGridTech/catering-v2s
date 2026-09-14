# sample2(壁纸终端)· 需求分析

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Claude
SCOPE_NEW=kernel/feature, ui/feature, ui/integration, assembly/android —— 各新建一个包(Dexter 指定)
SCOPE=新建 4 个包 + 改动 7 个既有位置 = 11;唯一分母见 §7.0a,本行不再单独列举
EVIDENCE_TIER=static(本文档);⚠️ 实施侧已具备动态验证条件,见 §0.4
REVIEW=两轮对抗审查已收口,六个 fresh 独立盲审;裁决与处置见 §10
AUTHORITY=需求分析,不是实施授权
```

## 0. 立项

**Dexter 2026-09-13:**

> 我现在需要做一个新的 sample2,只涉及 `kernel/feature`、`ui/feature`、`ui/integration`、`assembly/android`。功能是,复用 sample 的登录功能,登录之后可以选择屏幕的壁纸(无壁纸或三个内置的图片,从网上下载下来放到包内)。选择后如果有副屏副屏也生效。还需要支持 mobile。请你完成需求分析,对于原 sample 里的登录功能需要调整适配两个 integration 的话,也一起优化。

### 0.1 ⚠️ 撤回一处错误论断(盲审 M-1,已亲验)

本文初稿在此处写:「今天 `kernel/feature` 两个、`ui/feature` 两个,是严格 1 : 1,『一个 service 配多套交互』从未被验证过」,并据此把"第一次验证 TR-12 的 1 : N"当作本立项的额外价值。

**这是错的,整段撤回。** 实测:

- `ui/feature/sample-member-desk/package.json` 与 `src/dependencies.ts:6` 都声明了 `kernel-feature-sample-staff-session`;
- `src/features/actors/actors.ts:14-20` 导入并接住该 service 的 **5 条命令**;
- 即 `sample-staff-session` **今天就同时服务 `sample-staff-auth` 与 `sample-member-desk` 两套 ui/feature**——1 : N 已经在跑,不是"从未被验证"。

**而且轴也搞错了。** TR-12 的 1 : N 是 **kernel/feature : ui/feature**。把**同一个** `sample-staff-auth` 装进第二个 integration,验证的是 **1 ui/feature : N integration**,是另一根轴。我自己同日写的 base 抽取文档 §6 第 3 项对此表述是正确的("1:N 的复用轴在 ui/feature 一侧"),**本文与它自相矛盾**。

**更难看的一层**(盲审 S-4,已亲验):TR-12 反例栏原文就写着——

> **不要求以「再配一套 UI」来证明** —— 1 : N 是这两层的设计前提,不是待证命题;门与 review 的职责是防止耦合发生,不是事后举证。

**规范明文说这不是待证命题,而我把"证明它"当成了立项价值。** 我读过 TR-12 好几遍,漏了这一句。

**根因**:这正是我在 `2026-09-13-v2s-base-extraction-review-failure-postmortem-claude.md` 里刚总结的 **F-1(未穷举的全称断言)**——"从未被验证过"是对整个空间的断言,而我没有遍历,尽管我在治理文档里**亲手记录过** member-desk 依赖 staff-session 这条边。

### 0.2 这个立项真实的额外价值(修正后)

仍然有,但不是上面那条:

1. **今天全仓只有一个 `ui/integration`。** sample2 是第二个,**`1 ui/feature : N integration` 这根轴第一次被真正使用**;
2. **base 抽取文档最大的方法问题是"假设存在第二个 integration"。** 三轮盲审推翻它时,反复指出依据建立在假设上。sample2 落地后,那些假设变成**可观测的事实**——尤其是 §4.3 那批装配样板,会从"我推测会重复"变成"实测重复了两份";
3. **顾客侧画面第一次脱离会员业务包存在。** `member-desk` 今天拥有 `sample.desk.customer-welcome`(`parts.ts:119-130`),任何不做会员业务的终端都用不上它;sample2 的 integration 自有一对等价 part(§3.3b),证明这类画面不依赖会员域。

   ⚠️ **但 sample2 不动 `member-desk` 一行**——它建自己的,不是把那两个 part 搬出来。真正的"归位"是治理轮/抽 base 轮的事,本立项只提供第二个用例作为证据。

### 0.4 ✅ 实施侧具备真机验证条件(Dexter 2026-09-13)

> 当前 Codex 的机器上有两个 Android 虚拟机,一台是 mobile,一台是双屏 laptop。都可以做运行验证。

**这条改变了本文档多处判据的档位,不是锦上添花:**

| 原状态 | 现在 |
|---|---|
| `Metro` 对 workspace 包内 `.jpg` 的解析 = `UNVERIFIED` | **实施首步实测,不再是悬空项** |
| 验收判据只能断言"组件树里有这个节点" | **可做真机前后截图比对**,直接证明"屏幕确实变样"(§9 已据此改写) |
| mobile 路径只能静态设计 | **mobile VM 上实测**形态推导与方向解锁 |
| 副屏同步只能断言"读同一 selector" | **双屏 VM 上实测**两屏同时变化 |
| 画布失真只能推理 | **两台机器上实测**,有真实比例可量 |

⚠️ **但它不豁免设计**:真机能证明"做对了",不能替我回答"该做什么"。下文所有待裁项仍须先裁再实施。

⚠️ **本文档自身仍是 static**——我不跑命令,以上全部由 Codex 在实施阶段执行。

## 1. ⚠️ 先说硬约束,它们决定方案形态

### 1.1 图片接缝放哪里 —— **最终:只加一个,落 `primitives`**(C1)

**成立的那一半**:`ui/base/primitives` 确实没有图片控件(`src/vendor/slots.tsx:10` 只引入 7 个 RN 控件,无 `Image`);`ui/feature/*` 与 `ui/integration/*` 全部生产源码 `from 'react-native'` **零命中**(逐包核过)。所以"壁纸要画出来,必须先有一个 ui/base 侧的图片接缝"成立。

**推翻的那一半**:初稿写"`slots.tsx:10` 是**全仓唯一**的 React Native value API 接缝",并据此推出"primitives 是该控件**唯一正确**的归属"。**这是错的。** 实测 `ui/base` 下有 **11 个文件** import RN value:

| 包 | 文件 |
|---|---|
| `render` | `SurfaceRoot.tsx:2`、`ScreenContainer.tsx:2`、`LayerStack.tsx:2`、`SurfaceHostController.tsx:2`、`resolvePart.ts:2` |
| `input` | `InputSurfaceFrame.tsx:2`、`VirtualKeyboard.tsx:2`、`InputKeyboard.tsx:2` |
| `admin-shell` | `AdminLauncher.tsx:2` |
| `dev-host` | `testExpoApp.tsx:2` |
| `primitives` | `vendor/slots.tsx:10` |

我引的 `primitives/README.md:71` 在 `## 结构` 小节下,逐项描述**本包目录职责**——"在 primitives 内部,vendor 是唯一的 RN 接缝"。**我把一句包内结构说明,提升成了仓级全称断言。**

#### 第三轮重裁(Claude;Dexter 已授权"其他都由你来裁决")

⚠️ **我此前给你的两条依据都是错的,你据此下的「甲」与「甲+丁」一并作废:**

| 我说过 | 实际(已亲验) |
|---|---|
| "primitives 是**全仓唯一** RN value 接缝" | `ui/base` 下 **11 个文件** import RN value,`render` 占 5 个 |
| "壁纸铺满画布**需要 `SurfaceHostController` 的几何知识**" | `SurfaceRoot` 向 `children` 透传的几何**是零**(`children` 全文只出现在 `:15` 声明与 `:75` 渲染);canvas View 是 `position:'relative'` + 固定宽高,一个 `absoluteFill` 子节点就铺满 |
| (隐含)"两个接缝" | `render/package.json:19` **已依赖** primitives、`SurfaceHostController.tsx:3,96` **已组合** `PrimitiveSpinner`。真正新增的 RN 接缝**只有一个** |

**最终裁定:只加一个接缝,`ui/base/render` 零改动。**

| 落点 | 内容 |
|---|---|
| `primitives/src/vendor/slots.tsx` | `Image` 加入那 7 个 RN 控件,导出 `RnrImage` |
| `primitives/src/components/PrimitiveImage.tsx` | 新增控件,`layout` 支持 `'background'` 与默认(缩略图) |
| `primitives/src/theme/tokens.ts` | 加 `imageBackground: 'absolute inset-0 w-full h-full'`,与既有 `containerCentered`/`containerCard` 同档次 |
| `ui/base/render` | **零改动**、零新导出、零 invariants 变更 |

`WallpaperBackground`(ui/feature)于是十行:读 selector → `assetsById[id] ?? null` → `<PrimitiveImage layout="background" …/>`。

**为什么这是"完整"不是"将就"**:同一个接缝既服务 picker 缩略图、又服务壁纸背景,没留下"过两天还得回 primitives"的尾巴。我上一版说"合成一个才是将就",那句的技术前提已被证伪。

### 1.2 图片不能跨包引用 —— 决定图片放哪个包

`tools/terminal-skeleton/check-static.mjs:236-243`:`src` 下任何 `@catering-v2s/...` 的**非根**导入直接红(`non-root workspace import`)。所以 `import bg from '@catering-v2s/ui-feature-xxx/assets/a.png'` 不可行。

**结论:三张图片必须住在真正渲染它们的那个包里,用相对路径引用。** 下文据此把图片放进 `ui/feature/sample-wallpaper`。

(`package.json` 的 `exports` 子路径本身有先例——`sample-console` 导出了 `./theme/global.css`。⚠️ **初稿说"那条路径只被 `.cjs` 消费"是错的**:`assembly/android/sample-terminal/App.tsx:3` 就是一个 **`.tsx`** 在 import 它。它逃过门的真实原因是——`graph-model.mjs:224,272-273` 的 `readAllSourceFiles` **只扫 `src`**(存在时加 `test-expo`),而 `App.tsx` 在**包根**。**结论不变(`src` 下不能用),但规则是"只要不在 `src/` 下就扫不到",不是"只要不是 `.ts/.tsx` 就安全"。**)

### 1.2b 图片的类型声明今天不存在,`tsc` 会红

⚠️ **初稿写"全仓 `.d.ts` 只有两处"是错的**(Codex N-01,已亲验):实测 **12 个** `.d.ts`,含 6 个 `react-test-renderer.d.ts` 与 2 个 `nativewind-env.d.ts`。**准确表述是:`declare module '*.<扩展名>'` 形式的模块声明只有两处,都是 `*.css`(`sample-console/theme/global.css.d.ts:1`、`sample-terminal/global.d.ts:1`);没有任何图片模块声明**,也没有 `import x from './y.png'` 的先例。而 `apps/terminal/tsconfig.base.json` 的 `files` 只含 `terminal-env.d.ts`(全文仅一行 `declare const __DEV__`),**不引入 expo 的全局类型**——这正是为什么 css 也得自己写一份 `.d.ts`。

所以 `import w1 from './assets/w1.jpg'` 会报 **TS2307**。图片所在包必须自带一份 `declare module '*.jpg'`,照 `global.css.d.ts` 的形态,并确认该包 `tsconfig.json` 的 `include`/`files` 覆盖得到它。

**UNVERIFIED**:Metro 对 workspace 包内 `.jpg` 的打包解析我未实测(静态 review 不跑 bundler)。`theme/global.css` 的跨包先例让我倾向可行,但这是推论,须由实施首步验证。

### 1.3 mobile 与副屏是互斥形态,不是叠加

`terminalSurfaces` 的实际形状(实测 `sample-console/package.json`):

**sample-console 现状**:
```
landscape: { PRIMARY: 1280×800, SECONDARY: 960×540 }
portrait:  { PRIMARY: 360×640 }                        ← 只有 PRIMARY
```

**✅ Dexter 2026-09-14 临时变更:所有 `ui/integration` 包的 mobile surface 逻辑尺寸统一为 360×640。** 这条变更覆盖现有 `sample-console` 与本批 `sample-wallpaper-console`，并 supersede 2026-09-13 的 sample2 `720×1280` integration 声明。Android mobile VM 的 720×1280 仍是物理屏幕尺寸，不随本次逻辑画布变更。

故当前 integration 声明为:
```
landscape: { PRIMARY: 1280×800, SECONDARY: 960×540 }
portrait:  { PRIMARY: 360×640 }
```

⚠️ **更正我上一版的两处错误**(我一度把它记成 1280×720):

1. 我据此写过"`portrait` 键名从此名不副实"——**撤回**。`360×640` 是 9:16 竖向比例,`portrait` 键名与 `surfaceFormForOrientation`(`terminalSurfaces.ts:28-29`)的 `portrait → mobile` 映射**完全自洽**;
2. 我据此给的形态判定阈值会把这台 VM 判成 laptop——**已改**,见 §5.2.1。

**这条变更后的行为:声明画布(360×640)在 mobile VM 的物理屏幕(720×1280)上按两轴相同的比例放大**,因此 `scaleX = scaleY = 2`，仍是等比缩放、无额外几何失真；不能再把 mobile 说成零缩放。

**所以"选择后如果有副屏副屏也生效"与"支持 mobile"描述的是两种形态,不会同时发生**:mobile = portrait = 结构上单屏。需求不冲突,但验收要分两条路径写,不能写成"mobile 下也要验副屏"。

### 1.4 `SurfaceRoot` 已有背景槽,今天无人使用

`ui/base/render/src/components/SurfaceRoot.tsx:73-79`:

```
<View style={styles.content}>
  {children}          ← 在 ScreenContainer/LayerStack 之前渲染
  <ScreenContainer />
  <LayerStack />
</View>
```

`sample-console` 今天**不传 `children`**(`assembly.tsx:368` 起只有 5 个 prop,已亲验)。

⚠️ **但"零新增机制"是过度断言**(盲审 S-3,已亲验),两条修正:

1. **`children` 不是"背景槽",类型上就是普通子节点**(`render/src/types/props.ts:47-54` 只写 `children?: ReactNode`)。它是 `<View style={styles.content}>` 的**第一个流式子节点**,而 `styles.content = {flex:1}` 默认 `flexDirection: column`。**壁纸组件不自行绝对定位,就会占布局高度、把 `ScreenContainer` 挤下去。** 组件至少要 `style` 透传 + `resizeMode`,§7 对接缝改动量的估算据此上调。
2. **壁纸铺的是画布,而画布被两轴独立拉伸。** ⚠️ **初稿在此写"画布会留边、露出 viewport 底色",这是错的**(第二轮盲审 M-1,已亲验):`ui/base/render/src/foundations/surfaceHost.ts:118-119` 是

   ```
   scaleX: host.width / canvas.width,
   scaleY: host.height / canvas.height,
   ```

   **两轴各算各的**。挂了 host source(真实 Android 路径)时,画布被拉伸到**精确等于**物理屏,**不留边**。留边只发生在没挂 source 时(`SurfaceHostController.tsx:33-38` 的 `staticGeometryOf` 给 scale 1,1)。

   **真实后果是几何失真**:物理屏宽高比 ≠ 声明画布时,画布内所有内容按 `scaleX/scaleY` 非等比缩放。处置见 §5.1。

## 2. 包结构

**Dexter 2026-09-13 追加指定(与本节设计一致,此处记为裁定而非提议):**

> `kernel/feature` 里新建包作为壁纸功能的 service,`ui/feature` 里新建包作为壁纸功能的交互,`ui/integration` 新建包做完登录选壁纸的完整功能,`assembly/android` 里新建包做完 Android 端的实现。

四层各新建一个包,**不复用 `sample-console` / `sample-terminal`**。

| 新建包 | 层 | 职责 |
|---|---|---|
| `kernel/feature/sample-wallpaper` | service | "当前选了哪张壁纸"这个事实:slice + 命令 + 持久化 |
| `ui/feature/sample-wallpaper-picker` | 交互 | 壁纸选择器画面、壁纸背景组件、**三张图片资产** |
| `ui/integration/sample-wallpaper-console` | 编排 | 组合两个交互包;**自有副屏两个 part**(等待店员登录 / 顾客欢迎语,见 §2.1);决定各屏什么时候显示谁 |
| `assembly/android/sample-wallpaper-terminal` | assembly | 出 APK(完整构成见 §8.3) |

⚠️ **本表只列新建包。** 本立项还要**改动**三个既有包与两个 tool 文件,完整记账见 §7.0a——那部分超出 Dexter 原指定的四层,是后续裁定的连带结果。

命名遵循仓内既有惯例——service 与交互**不同名**(`sample-staff-session` ↔ `sample-staff-auth`,`sample-member-registry` ↔ `sample-member-desk`),故 service 叫 `sample-wallpaper`、交互叫 `sample-wallpaper-picker`。

### 2.1 ⚠️ 撤回第五个包 `sample-customer-display`(盲审 M-2/S-1,已亲验)

初稿把副屏那两个画面独立成第五个 ui/feature 包。**撤回,两个 part 由 integration 直接拥有。** 于是新建包回到 Dexter 指定的**四个**。

三条独立理由,任何一条单独成立即足以撤回:

1. **给出的理由被先例证伪。** 我说"塞进壁纸包会让它监听会话命令,是跨 service 耦合"。但 `ui/feature/sample-member-desk/package.json` 同时依赖 `member-registry` 与 `staff-session`——**一个 ui/feature 消费多个 service 的领域事件,是已存在、已评审的形态**。而且拆包根本不消除它:新包照样 import staff-session、照样接同样四条命令,**耦合原样搬家,只换了个包名**。
2. **按正确归属处理后,它不够格成包。** 见 §3.3——四个 placement handler 归编排层之后,该包只剩两个零交互、零状态的文案 part 和**零 actor**,撞 TR-12 改后 3a「`ui/feature` 必须有自己的 module 与 actor」。**零 actor 的 ui/feature 不是包,是目录。**
3. **我驳回"更轻替代"的理由站不住。** 我说 `sampleAdminTestPart` 那个先例"是 admin 测试件,不是产品画面"——这只说明用途不同,**不说明机制不适用**。

**副屏两个 part 的最终归属:`ui/integration/sample-wallpaper-console` 自有。** 它们是"这台终端给顾客看什么"的产品决定,本就是编排层的事。

## 3. 壁纸功能设计

### 3.1 service:`kernel/feature/sample-wallpaper`

**定位(Dexter 2026-09-13 裁定:四层演示件)。** 存在一个零新包、零新 slice 的替代——`uiVariable{persistIntent:'owner-only'}`(先例 `sample-staff-auth/src/features/variables/variables.ts` 的 `sample.login/operator-name`)。按层含义,壁纸选择没有后台、没有业务判断,严格说不落 `kernel/feature`。

**Dexter 裁定保留 kernel 包,定位为四层演示件,不是技术必需。** 将来壁纸若由后台下发(按门店/时段推送),它升级成真 service,届时本条注记删除。**这是明写的定位,不是"先凑合"。**

**✅ Dexter 2026-09-13 追加:用户选择壁纸后要有一个确认按钮,才会切换壁纸。**

这条需求引入了"草稿态",slice 形状因此与仓内既有的 `sample-member-registry` **完全同构**(那是本仓唯一把 TR-04 写对的范例):

**✅ Dexter 2026-09-13 再追加:用户选了某张壁纸但没点确认时,App 重启后应当恢复这个界面以及那个未生效的选择。**

⚠️ **这条推翻了我上一版**——我当时把 `pendingWallpaperId` 设成 transient,并据此宣布 TR-04 的缺口已被消解。**pending 必须持久化,缺口没被关掉**,更正见 §3.1.4。

这条也与 Dexter 的长期原则一致:**所有 UI 状态都进 state,就是为了恢复。**

```
slice   sample-wallpaper.selection
        WallpaperState { wallpaperId: WallpaperId           ← 已确认
                         pendingWallpaperId?: WallpaperId }  ← 已选未确认

        persistIntent: 'owner-only'
        persistence:   [{kind: 'field', stateKey: 'wallpaperId'},
                        {kind: 'field', stateKey: 'pendingWallpaperId'}]   ← 两个都持久

reducer setPending / confirmPending / clearPending      ← 形态仍照 member-registry 三件套

命令    selectWallpaperCommand  { wallpaperId }   ← 点选项,写 pending
        confirmWallpaperCommand {}                ← 点确认,pending → wallpaperId 并清空 pending

selector selectWallpaperId / selectPendingWallpaperId
```

⚠️ **"恢复这个界面"不需要本包做任何事**:画面由 `kernel.base.ui-state` 的 content slice 持久化——`workspaceSlices.ts:277-286` 声明 `persistIntent: 'owner-only'`,`serializeContentEntries`(`:217-222`)把 PRIMARY/SECONDARY 的 `containers` 落盘。重启后 picker 画面经 `preloadedState` 自动回来,与 §3.1.1 的壁纸恢复是同一条声明式链路。

⚠️ **`WallpaperBackground` 读的是 `wallpaperId`(已确认),不是 pending。** 这是"才会切换壁纸"的直接落点——**选中不预览,确认才换**。

⚠️ **TR-02:`confirmWallpaperCommand` 在无 pending 时是 no-op,必须返回失败而非成功。** 正常路径不会走到(确认按钮在无 pending 时禁用),但命令是公开契约面,不能因为 UI 挡住了就让它假装成功。

⚠️ **slice 只存 id,不存图片本身或路径。** 图片是 UI 资产,路径是 `ui/feature` 的知识;kernel 存路径等于对 UI 形态做假设,撞 TR-12 第 1 条。

#### 3.1.1 重启恢复(Dexter 裁定:按 `wallpaperId` 恢复屏幕壁纸显示)

**恢复是声明式的,零代码。** 已亲验的链路:`kernel/base/state/src/foundations/createStateRuntime.ts:94-113` 先 `await hydrateStateRuntime(...)`,再把 `hydrated.preloadedState` 交给 `createStateStore`——**store 在 hydrate 之前根本不存在**;`createRuntime` 的 `start()` 在 install + initialize 完成后才置 `status='started'`,而 `assembly.tsx:242-243` 在 `await runtime.start()` 之后才造 surface。

⇒ **没有 initialState→更新的闪烁,异步 hydrate 全部发生在 store 可见之前,首帧就是正确的壁纸。**

**不要为恢复写 actor 或启动命令。**

#### 3.1.2 ⚠️ 撤回初稿的 `hydrationRejected` 字段与校验 actor(盲审 M-2/S-3,已亲验)

初稿给 slice 加了 `hydrationRejected` transient 字段 + 一个 install 期校验 actor,理由是"持久化的 id 可能指向已不存在的图",并引 `validateHydratedDisplayRoleActor` 为先例。**三条都不成立,整体撤回:**

1. **先例引错了。** `validateHydratedDisplayRoleActor.ts:19-51` 的处置是"改正值 → 打日志 → 把 diagnostic 放进 command 返回值",**slice 里没有留任何被拒标记**。更进一步,`tools/terminal-display-context/check-static.mjs:193` 的 `runNoDisplayIndexInSlice` 断言 `DisplayRoleState` 成员**恰好只有** `['displayRole']`——**先例包有门禁止再加成员**。先例支持的是"install 期校验 hydrate 值"这个**时机**,不支持那个**字段**;
2. **它防不住自己要防的事。** slice 只存 id(见上),kernel 只能拿 id 比一个 kernel 内的枚举。而"App 换了内置图"的真实形态是 `ui/feature/.../assets/w3.jpg` 被删、枚举里 `'w3'` 还在——**kernel 校验全绿,UI 照样拿不到图**;
3. **它与 §3.1.1 自相矛盾。** §3.1.1 说"不要为恢复写启动期写入路径",§3.1.2 随即设计了一条——只是取名叫"校验"。

**更小且唯一真正有效的解**:`WallpaperBackground` 里 `assetsById[id] ?? null`。id→资产的映射本就住在那一层(§3.2.1),**它是唯一知道"图还在不在"的地方**。零 state、零 actor、零命令,用户可见结果与"回落 none"完全一致。

**我接受盲审的这条指控**:我是先遇到 TR-04 的反向断言难题,再回头给字段补业务叙事。**为过门造对象再补叙事,与造假字段的区别只是叙事质量。**

#### 3.1.3 ⚠️ 撤回 `wallpaperSelectedCommand` 与 `wallpaperSelectionFailedCommand`

- `wallpaperSelected`:**全文没有消费者**。picker 读 selector 重渲染,编排 actor 六条 handler 无一接它。TR-12 第 2 条约束的是命令**怎么拆**,不是要求每个写操作配一条无人听的回声;
- `wallpaperSelectionFailed`:**路径不可达**。picker 只有四个写死的选项,用户操作产生不了非法 id;非法 id 只可能来自程序员写错,那该崩不该弹提示。`staff-session` 有 `loginFailed` 是因为"密码打错"是真实高频的用户输入错误,不可类比。

于是 kernel 只剩**一条命令**。

#### 3.1.4 TR-04 按修订后的规则收口

**规范已于 2026-09-13 修订**(`terminal-coding-standard.md` TR-04):反向断言的对象不必在同一 slice 内;**当一个 slice 的全部字段都合法持久时,允许只写正向断言,但须在用例里注明**;并明文禁止为凑反向断言而加无消费者字段。

本 slice 两个字段都是 Dexter 明确要求恢复的(`wallpaperId` 已确认、`pendingWallpaperId` 未确认),**全字段合法持久,无反向对象**。重启用例按修订后的规则写:

| 断言 | 内容 |
|---|---|
| 正向① | `selectWallpaperId === 'w2'` |
| 正向② | `selectPendingWallpaperId === 'w3'` |
| 正向③ | PRIMARY screen 仍是 `sample.wallpaper.picker` |
| 正向④ | 真机截图:屏幕上壁纸仍是 `w2`(pending 恢复了但未生效) |
| — | 用例注明"本 slice 全字段持久,无反向对象" |

⚠️ **TR-04 通用门今天不存在**(规范已把这条欠账写在明面上),以上靠 review 与真机验收保证。

### 3.2 交互:`ui/feature/sample-wallpaper-picker`

```
assets/w1.jpg w2.jpg w3.jpg          ← 三张内置图(§1.2:必须住这里)
parts/  wallpaperPickerPart           partKey 'sample.wallpaper.picker'
                                      containerKeys ['main'], displayModes ['PRIMARY']
                                      surfaceForm ['laptop','mobile']
components/ WallpaperPicker           四个选项 + 一个确认按钮,**只派发本包命令**
                                      (⚠️ 初稿此处写"派发 selectWallpaperCommand / confirmWallpaperCommand"
                                       即 kernel 命令,已被 §3.2.2 推翻——组件只产 UI intent,
                                       由 picker actor 决定是否转 kernel。实现照 §3.2.2,此处补正)
            WallpaperBackground       读 selectWallpaperId(已确认那个),assetsById[id] ?? null
```

#### 3.2.2 ✅ 本包的 actor(Dexter 2026-09-13 裁定,同时消解待裁项 ①)

> picker 处理所有用户交互,选择、确认,都需要 actor 呀,而且判断如果选择的内容与当前的内容一致,就不需要向 kernel 发变更的 command。

⚠️ **我此前判"本包没有 actor"是错的,而且错在模型上**:我假设组件直接把 kernel 的命令派发出去,于是 ui/feature 只剩转发、无事可做。**正确形态是——用户交互先变成本包自己的命令,由本包 actor 决定要不要转成 kernel 的变更命令。** 这正是 TR-11 的标准形态,我把它漏了。

```
命令(本包)  wallpaperOptionSelectedCommand   { wallpaperId }   ← 用户点了某个选项
            wallpaperConfirmRequestedCommand {}                ← 用户点了确认

actor wallpaper-picker
  onCommand(wallpaperOptionSelectedCommand):
      effective = selectPendingWallpaperId(state) ?? selectWallpaperId(state)   ← 见下
      若 payload.wallpaperId === effective  ⇒ 不派发
      否则 dispatch(selectWallpaperCommand, {wallpaperId})

  onCommand(wallpaperConfirmRequestedCommand):
      pending = selectPendingWallpaperId(state)
      若 pending === undefined 或 pending === selectWallpaperId(state) ⇒ 不派发(内容没变)
      否则 dispatch(confirmWallpaperCommand, {})
```

**这是真实的 actor 工作,不是为撑形状发明的:**

- **它承接"判断要不要变更"这个决定。** 选了和当前一样的东西就不该惊动 kernel——这个判断属于交互层(用户点了什么、当前呈现的是什么),不属于 service;
- **它让 kernel 的命令保持"确实要变更"的语义**,而不是"用户点了一下"。kernel 不需要知道用户点过几次;
- **它是 TR-11 的兑现**:事件(点击)变成本包命令,由关心的一方(本包)定 actor 决定后续。

⚠️ **"当前选择"取 `pending ?? confirmed`,不是只取 pending**(Codex S-06)。若只比 pending:用户重复点击**已确认**的那一项时,pending 从空变成该值,于是"确认"按钮亮起——但按下去什么都不会变。**取 effective 就没有这个无意义的 pending。**

⚠️ **全新安装的默认值**(Codex N-03):`wallpaperId` 初始为 `'none'`,`pendingWallpaperId` 初始为 `undefined`。picker 打开时按 effective(= `'none'`)高亮"无壁纸"选项,确认按钮禁用。

⚠️ **TR-02 的落点更正(Codex M-04,已亲验)。** 我此前写"两条不派发分支都是 no-op,必须返回非成功"——**机制上讲不通,而且判错了对象**:

- **机制**:`aggregateCommandStatus.ts:20-31` 按 actor result 的 `status` 判失败,失败状态有 `error` 与 `timed-out` 两种。⚠️ **收窄我原来的说法**(Codex 三轮 S-01):**在 handler 主动表达失败这个语境下**,途径是抛错(普通异常经 `normalizeRuntimeError.ts:30-58` 归一化,或直接抛 AppError);超时由 runtime 自行产生,不是 handler 的手段。**在 payload 里返回 `{status:'rejected'}` 仍聚合为 `completed`**;
- **对象**:本包那两条命令**不是 no-op**——actor 收到"用户点了一下",做了求值与决策,**契约已履行**,返回 `completed` 正确。让它们抛错会把正常交互写成命令错误,污染 journal。

**TR-02 真正管的是 kernel 那条**:`confirmWallpaperCommand` 在无 pending 时被派发确实什么都没做。正常路径走不到(actor 不会发),但它是公开契约面,**必须抛一条带稳定 code 的 AppError**,且该分支**零 state 写入、零子命令**。判据见 §9 的 A2c。

⚠️ **待裁项 ① 因此关闭**:本包有 module、有 actor、有真实决定,不撞 TR-12 3a,不需要例外,也不需要并进 integration。

#### 3.2.1 `WallpaperBackground` 的形态

⚠️ **初稿在此设计了 `SurfaceBackground`(ui/base/render)+ `WallpaperBackground`(ui/feature)两层,理由是"ui/feature 不该自己实现画布铺满——那需要 `SurfaceHostController` 的几何知识"。该前提已被证伪(§1.1),整节重写,render 侧那个组件取消。**

`WallpaperBackground` 是 ui/feature 的**公开导出组件**(不是 part)——它要被塞进 `SurfaceRoot` 的 `children`,而 `children` 不走 part 目录。全部内容约十行:

```tsx
const id = useUiStateSelector(selectWallpaperId)
const source = assetsById[id]              // 'none' 或 id 对不上 ⇒ undefined
if (source === undefined) return null
return <PrimitiveImage layout="background" source={source} resizeMode="cover" />
```

三点说明:

- **确认按钮的可用性是 selector 派生,不是本地 state**:`pendingWallpaperId !== undefined && pendingWallpaperId !== wallpaperId` 时可点。选中态高亮同理读 `selectPendingWallpaperId`;
- **`assetsById[id] ?? undefined` 就是 §3.1.2 撤回那套 hydration 校验的替代**:这一层是全仓唯一知道"图还在不在"的地方;
- **`layout="background"` 由 primitives 提供**(`imageBackground: 'absolute inset-0 w-full h-full'`,§1.1)。绝对定位是通用排版手段,不是 surface 概念——`LayerStack.tsx` 里三处 `position:'absolute'` 即先例;
- **`resizeMode="cover"` 的取舍见 §5.1**(接受画布非等比拉伸带来的失真)。

### 3.3 ⚠️ 撤回 §4.2 的判据"修正",恢复治理轮原边界(盲审 M-2,已亲验)

初稿在 §4.2 提出判据「**答案依不依赖别的 service**」,并据此(a)把 `staff-auth` 的 `showLogin` 留在交互包,(b)把副屏四个 handler 留在顾客侧交互包。**这条判据是坏的,两处结论一并撤回。**

**它区分不了自己举的两个例子**:

| | 触发 | 答案 | 我的判定 |
|---|---|---|---|
| `member-desk` · `loginSucceeded → PRIMARY = member-list` | 外部 service 一条命令 | 本包自己的 part | 判"跨 service,上交" |
| 副屏 · `loginSucceeded → SECONDARY = welcome` | 外部 service 一条命令 | 本包自己的 part | 判"不跨,留下" |

**两者结构完全同构。** 我实际用的是另一条没写出来的判据("答案依不依赖这个 console 还组合了什么"),而按那一条,副屏画面**同样依赖组合**——sample 的副屏给的是 `sample.desk.customer-welcome`,sample2 给的是 `sample.customer.welcome`。两例只能同上交或同留下。

**正确的判据是治理轮 §2 原来那条:一切 surface placement 归编排层。** 因为"这块屏此刻会不会被别的包争用"是**组合属性**,交互包结构上无法知道——`staff-auth` 不知道有没有别的包想在登出态占 PRIMARY,顾客侧画面也不知道有没有别的包想占 SECONDARY。**不知道就不能决定。**

⚠️ **连带撤回对治理文档的回写。** Dexter 已裁定"回写",但那次裁定基于我给的错误判据。正确的回写是:**治理文档 §2 的边界表不动,§4.4 对 `auth-navigation` 的拆分照原计划执行。** 我此前报给你的"staff-auth 在治理轮变零改动"是错的。

**那"两个 integration 都要写 logout→显示登录页"的重复怎么办?** 那是**重复**问题,不是**归属**问题。两行 handler 重复两份,可接受;真嫌重复,那正是 base 抽取要处理的——**但不能用"会重复"去改变归属**。

### 3.3b 副屏画面(归 integration)

```
parts   sample.wallpaper-console.waiting   containerKeys ['main']  displayModes ['SECONDARY']
                                           workspaces ['MAIN']  instanceModes ['MASTER']
                                           surfaceForm ['laptop']            文案「等待店员登录」
        sample.wallpaper-console.welcome   同上声明                          顾客欢迎语
```

命名照仓内惯例 `sample.<console 名>.<part>`——先例 `sample-console/assembly.tsx:52` 的 `sample.console.admin-test`。六个声明字段一个都不能少(`definePart` 必填,见同处 `:51-62`)。

⚠️ **`surfaceForm` 只声明 `['laptop']`,不含 `'mobile'`**(Codex N-02,已亲验):这两个 part 的 `displayModes` 是 `['SECONDARY']`,而 mobile ≡ portrait、portrait 结构上禁止 SECONDARY(§1.3)。若声明成 `['laptop','mobile']`,catalog 校验会过(`ui-state/foundations/catalog.ts:94` 只校验闭合并集),但该组合**在 mobile 下永远不可达**——一个能过门的死声明。§9 的 A6 据此补一条"mobile 下 SECONDARY 无派发"的判据。
```

### 3.4 编排:`ui/integration/sample-wallpaper-console`

```tsx
<SurfaceRoot displayMode={surface.displayMode} containerKey="main" ...>
  <WallpaperBackground />        ← §1.4 的背景槽,两块屏都传
</SurfaceRoot>
```

壁纸在**两块屏都铺**,且两块屏读同一个 selector——**"选一次、两屏同时生效"是天然结果,不需要任何同步机制。**

编排 actor 只承接**跨 service** 的那一条:

```
onCommand(loginSucceeded)               → PRIMARY = sample.wallpaper.picker
onCommand(sessionRestoredAuthenticated) → PRIMARY = sample.wallpaper.picker
```

⚠️ **初稿在此写"只有两个 handler"并附了一张 2 : 4 : 2 分布表,那是 §3.3 撤回前的旧设计,一并作废。** 按 §3.3 的结论(一切 surface placement 归编排层),编排 actor 实际承接**六条**:

| # | 触发 | 动作 |
|---|---|---|
| 1 | `loginSucceeded` | PRIMARY = `sample.wallpaper.picker` |
| 2 | `sessionRestoredAuthenticated` | PRIMARY = `sample.wallpaper.picker` |
| 3 | `loginSucceeded` | SECONDARY = `sample.wallpaper-console.welcome` |
| 4 | `sessionRestoredAuthenticated` | SECONDARY = `sample.wallpaper-console.welcome` |
| 5 | `logoutSucceeded` | SECONDARY = `sample.wallpaper-console.waiting` |
| 6 | `sessionRestoredAnonymous` | SECONDARY = `sample.wallpaper-console.waiting` |

(3-6 可与 1-2 合并进同一个 handler 体内,此处按逻辑条目列。)

⚠️ **副屏存在性判断 —— 本批依赖的唯一 API 在此冻结**(Codex M-05 要求):

> **本批调 `readDisplayInfo(context.platformPorts.device)` + `resolveSecondarySurfaceAvailable`,二者都是 `display-context` 今天的公开导出**(`display-context/src/index.ts:14,18`)。**文档此前提到的"拓扑 selector"今天不存在,本批不依赖它、也不创建它。**

**归属说明**:它落在**编排层**而不是交互包,所以不复制治理轮 G-3 判为缺陷的形态(缺陷是"**交互包**在 actor 里做设备 I/O")。

**迁移边界(不属于本批)**:抽 base 轮若把拓扑事实挪进 `display-context` 的 slice 并给出 selector,本处改读 selector。**那是那一轮的事,本批不预留接口、不写适配层。** 届时的改动面已可预估:本文一处 + `member-desk` 保留的八处(治理文档 §4.3)。

### 3.4.1 ⚠️ 与 sample 治理轮的顺序依赖(本文档新发现,两边都要记)

`staff-auth` 今天自带两条 PRIMARY placement:`logoutSucceeded → showLogin`、`sessionRestoredAnonymous → showLogin`。

- **治理轮落地前**:sample2 直接继承它们,不用自己写(sample2 也想要"登出回登录页");
- **治理轮落地后**:那两条按 §3.3 的判据会移交各自的 integration,**sample2 的编排 actor 届时要补上这两条,变成八条**。

**这不是二选一,是先后。**

⚠️ **冻结本批采用的时点(Codex M-01 要求,此处定死)**:

> **sample2 按"治理轮尚未落地"的字节实施,编排 actor 本批就是六条**(§3.4 的表)。`staff-auth` 现有的两条 PRIMARY placement 保持不动、由 sample2 直接继承。

**迁移 gate(写进治理轮的验收判据,两边文档同步)**:治理轮拆分 `auth-navigation` 的那一刻,必须在同一批内给**每一个** integration 补上 `logoutSucceeded / sessionRestoredAnonymous → PRIMARY = 登录页`。判据可机械化:拆分后全仓 `onCommand(logoutSucceededCommand` 的命中数,必须等于 integration 包的个数。**漏补的表现是登出后 PRIMARY 无人接管——黑屏或停在上一页。**

⚠️ **本批不得先按"八条"实施**:那会与未拆分的 `staff-auth` 重复派发 `showScreen(PRIMARY, auth.login)`,两条 handler 抢同一块屏,正是治理轮 G-2 判为缺陷的形态。

### 3.5 🔴 壁纸可见性(第二轮盲审 M-1 —— 不解这条整个功能是假的)

**问题(已亲验)**:`primitives/src/theme/tokens.ts:2` 的默认容器是

```
container: 'flex-1 bg-canvas p-6 gap-4'
```

**不透明、满屏**。`StaffLogin.tsx:93` 用的就是裸 `<PrimitiveContainer>`(默认 layout)。而 `SurfaceRoot.tsx:75` 把 `{children}` 渲染在 `<ScreenContainer/>` **之前**——壁纸在最底层。

⇒ **每个 part 的不透明 `bg-canvas` 会把壁纸整块盖住。按初稿设计,用户选完壁纸屏幕上什么都不会变。**

⚠️ 我写了几百行论证槽位在哪、谁绝对定位、画布会不会留边,**唯独没论证"看得见"**。Dexter 要的是"选了之后屏幕变样",而我精确地做出了"状态存对了 + 槽位选对了"。这正是 CLAUDE.md 那条"用户想要的会不会其实是 5-4,而作者在精确地做 1+1"。

**裁定(Claude)**:在 `tokens.ts` 增加一个**透明容器变体**,只有需要露出壁纸的 part 使用。

| 落点 | 内容 |
|---|---|
| `primitives/src/theme/tokens.ts` | 加 `containerTransparent: 'flex-1 p-6 gap-4'`(与 `container` 唯一差别是去掉 `bg-canvas`) |
| `PrimitiveContainer` | `layout` 增加 `'transparent'` |
| 使用者 | `sample.wallpaper.picker`、`sample.wallpaper-console.waiting`、`sample.wallpaper-console.welcome` 三个 part |

**为什么不是更小的方案**:更小的做法是让壁纸盖在 part 之上(改 `SurfaceRoot` 的 children 位置),但那会挡住 UI,且要动 render;或者让 sample2 的主题把 `--color-canvas` 设成透明,但 `bg-canvas` 是 19 个语义色之一、被全部控件共用,改它会波及所有背景。**加一个容器变体是唯一只影响需要它的那三个 part 的做法。**

⚠️ **这条与红色主题是同一个机制面**:`bg-canvas` 是主题 token,壁纸盖在不透明 canvas 下面,**换什么主题都看不见**。§4b 的红主题不能替代本条。

### 3.6 🔴 浮层必须持久化并恢复(Dexter 2026-09-13 裁定,纳入本批)

> 浮层也进 state,也需要持久化,也必须要恢复。

⚠️ **这条推翻的是仓内一个带验收编号的既定行为,不是补疏漏。** 事实(已亲验):

- `kernel/base/ui-state/test/acceptance.test.ts:290` 标题即 `U-7 restores containers but not layers after restart`,末行 `expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([])`;
- `kernel/base/ui-state/test/content.test.ts:218` 同样断言 `never restores layers`;
- 机制:`foundations/workspaceSlices.ts:217-222` 的 `serializeContentEntries` 只产出 `containers`,`:260-267` 的还原只 `parseContainers`。

⚠️ **但规范里没有任何一条支撑 U-7**(全文搜 `U-7` / 浮层 / layer 恢复,零命中)。**它是测试层的决定,无规范依据。**

#### 3.6.1 改动落点

| 落点 | 改动 |
|---|---|
| `workspaceSlices.ts` 的 `serializeContentEntries` | 除 `containers` 外,增产 `layers` |
| 同文件的 `applyPersistedContentEntries` | 增加 `parseLayers`,还原 `LayerEntry[]` |
| `acceptance.test.ts:290`(U-7) | **反向重写**:`restores containers and layers after restart` |
| `content.test.ts:218` | **反向重写** |

`LayerEntry`(`types/content.ts:12-17`)是 `{layerId, partKey, props?, openedAt}` —— 四字段全可 JSON 序列化,与 `ScreenPlacement` 同构。

#### 3.6.1b 落盘契约(Codex 三轮 M-01/M-03 要求,此处给出 descriptor 级定义)

⚠️ **初稿只写"serializer 增产 layers",不足以实施**——实施者会把 layers 塞回 containers,或自行猜第二个 descriptor 的读写语义。

**机制前提(已亲验)**:`kernel/base/state` 的 `persistence` 是**数组**,`StateRuntimePersistenceRecordDescriptor`(`types/persistence.ts:33-54`)带可选 `storageKeyPrefix`,**本来就支持一个 slice 注册多个 record descriptor**。所以这不是新能力,是用既有能力。

**契约**:`createContentDescriptor`(`workspaceSlices.ts:270-287`)的 `persistence` 由一条变两条,**MAIN / BRANCH 两侧各自注册这两条**(`toWorkspaceStateDescriptors` 对两侧调同一个 `createDescriptor`):

| descriptor | prefix | entry 键 | entry 值 |
|---|---|---|---|
| 既有 | `containers` | `PRIMARY` / `SECONDARY` | `Record<containerKey, ScreenPlacement>`(不变) |
| **新增** | `layers` | `PRIMARY` / `SECONDARY` | **有序 `LayerEntry[]`** |

⚠️ **独立 prefix 是隔离选择,不是保序的必需条件**(Codex 推翻了我原来的说法,接受):数组放进同一个 record 也能保序。选独立 prefix 的真实理由是——**两条 descriptor 的 `shouldPersistEntry`、`flushMode`、将来的 `protection` 可以各自演进**,混在一起则改一个必然牵动另一个。

**结构校验(还原侧,逐条)**:`layerId` 非空字符串;`partKey` 非空字符串;`openedAt` 为有限正整数;`props` 若存在须过 `assertStateJsonValue`(复用 `parsePlacement:228-234` 的既有做法)。**任一不过 ⇒ 整条丢弃并记诊断。**

**其余规则**:

| 项 | 取法 |
|---|---|
| 顺序 | 数组顺序即层叠顺序,**按原序还原** |
| 旧存档兼容 | 无 `layers` 键 ⇒ 还原为空数组,**不报错**。与今天行为等价,升级平滑 |
| 重复 layerId | 按 `layerId` 去重,**保留先出现的一条**,丢弃的记诊断 |
| 幂等 | 同一份存档重复还原,结果必须逐字相同 |

#### 3.6.1c catalog 校验由 install 期 actor 承接(Codex 三轮 M-02 收紧)

我此前写"还原时逐条校验 partKey 仍在 catalog 中"。**descriptor 做不到**:`applyEntries` 只拿到 `(state, entries)`,没有 catalog、logger 或任何 context 入参。所以校验交由 **ui-state 自己的 install 期 actor**,先例是 `display-context` 的 `validateHydratedDisplayRoleActor`。

⚠️ **Codex 指出该方案有三个缺口,逐条补齐:**

**一 · 校验语义取 membership,不取 availability。**

- **membership**:只查 `partKey` 是否在 catalog 中;
- **availability**:还要查该 part 在当前 `displayMode`/`workspace`/`instanceMode`/`surfaceForm` 下是否可用(`catalog.ts:155-158` 的四条硬过滤)。

**取 membership,因为 availability 会误删**:`surfaceForm` 与 `instanceMode` 运行期可变,一个 part 此刻不可用不代表永远不可用;按 availability 清理会把"换回 laptop 就该出现"的浮层永久删掉。**不可用但仍 member 的浮层,由 `LayerStack.tsx:113-121` 的既有过滤负责不渲染**——它今天就是这么做的,不清 state。

⚠️ 这是**语义裁决**,我按"宁可留着不渲染,不可误删"取。若认为失效浮层必须落地清除,改取 availability,但须同时定义"条件恢复后如何重新出现"。

**二 · 覆盖范围必须是 MAIN/BRANCH × PRIMARY/SECONDARY 全四格。**

`selectContent.ts:26-44` 与 `contentActors.ts` 只路由**当前** workspace,而 `displayDerivation.ts:11-14` 明确 MAIN/BRANCH 都可达。**失效浮层若落在 BRANCH 而启动时是 MAIN,install actor 不清理,等角色切到 BRANCH 后它会复活。**

⇒ install 期校验**必须直接遍历两个 workspace 的 content state**,不走"当前 workspace"的既有路由。非当前 workspace 不能用 `closeLayerCommand`(它按当前 workspace 路由),须由 **ui-state 作为 owner 直接 `dispatchAction` 清除**——owner 写自己的 slice,不违反 TR-09。

**三 · 诊断统一。** category 一律 **`ui-state-hydration`**(初稿两处分别写了 `ui-state-hydration` 与 `display-diagnostics`,矛盾)。字段固定 `{workspace, displayMode, layerId, partKey, reason}`,`reason` 闭合为 `unknown-part` / `duplicate-layer-id` / `invalid-entry`。

#### 3.6.2 ⚠️ 必须一并解决的风险:恢复的浮层可能指向失效上下文

写 U-7 的人多半就是为了躲这个:一个浮层恢复回来,但它引用的业务上下文已经不在(例如"确认会员 X"的弹层,而 X 的待确认记录未随之恢复)。

**处置**:⚠️ **以 §3.6.1c 为准,本段初稿的写法作废**——初稿写"还原时逐条校验 partKey 仍在**当前** catalog 中、记 `display-diagnostics` 诊断",与 §3.6.1c 的三条结论冲突(校验不在还原时而在 install 期 actor;取 **membership** 不取 current availability;诊断 category 是 **`ui-state-hydration`**)。**§3.6.1c 是现行设计,本段不再给出独立处置。**

⚠️ **即便按 §3.6.1c 做了 membership 校验,也只解决"part 还在不在",解决不了"业务上下文还在不在"。** 后者属于各 feature 自己的责任:浮层恢复后,其 props 指向的业务数据若已不存在,该 feature 的组件需自行处理。**本批不为此建通用机制**,但须在 `ui-state` 的 README 里写明这条边界,否则下一个人会以为恢复是安全的。

#### 3.6.3 范围影响

`kernel/base/ui-state` 因此进入本批(§7.0a 的 B 类)。**touched positions 的唯一口径见 §7.0a(4 + 7 = 11),本节不另起计数。** ⚠️ 它是 **kernel/base**,会影响**所有 App**——sample 的既有旅途必须一并回归(§9 的 A8)。

## 4. 复用登录:两个包各自的可复用性核查

### 4.1 service 侧:完全可复用,零改动

`kernel/feature/sample-staff-session/src/index.ts` 导出 8 条命令 + `selectSessionState` + `createSampleStaffSessionModule` + 4 个类型。**全文没有任何 partKey / containerKey / displayMode 字面量**,对 UI 形态零假设。TR-12 第 1 条在 kernel 侧**实测成立**。

### 4.2 交互侧:`sample-staff-auth` 的可复用性核查(⚠️ 本节推出的"边界修正"已于 §3.3 撤回)

逐 actor 核 `sample-staff-auth`:

| actor | 做什么 | sample2 要不要 |
|---|---|---|
| `auth-result` | 登录失败 → 开 `sample.auth.notice` 浮层 | **要**,一模一样 |
| `auth-notice` | 关闭该浮层 | **要** |
| `auth-system-notice` | 系统失败提示 | **要** |
| `auth-navigation` · `loginSucceeded → setUiVariables(operatorName)` | 写自己的变量 | **要** |
| `auth-navigation` · `logoutSucceeded → clearLayers + showLogin` | 登出回登录页 | **要**,一模一样 |
| `auth-navigation` · `sessionRestoredAnonymous → showLogin` | 冷启动匿名 → 登录页 | **要**,一模一样 |

六个 **actor 行为**全要、零差异。

⚠️ **但"零改动"不成立,初稿的核查只到 actor 层就下了结论**(盲审 S-1,已亲验)。`sample-staff-auth` 的公共面是 `sampleStaffAuthAssembly`,交出的是 **parts + variables + createModule** 三样,而 parts 我没核。打开 `src/parts/parts.ts:17`:

```
description: '店员使用工号和密码进入会员登记工作台',
```

**这条写死了 sample 的目的地。** sample2 登录后去的是壁纸选择器。该字段由 `definePart` 写进 catalog entry、被 `ui-state/src/foundations/catalog.ts` 断言非空并固化,**包内静态声明、不接受宿主参数**,第二个 App 无法在不改这个包的前提下让它说真话。

**所以真实结论是:一处改动。** 把 description 改成宿主中立的表述(如「店员使用工号和密码登录本机」)。

(三个组件的文案我逐字读过,`StaffLogin.tsx`/`AuthNotice.tsx`/`AuthSystemNotice.tsx` 全部宿主中立,**泄漏只在 parts 的 description 这一处**。)

⚠️ **这推翻了 sample 治理文档 §4.4 的一处设计。** 那里主张把 `logoutSucceeded / sessionRestoredAnonymous → showLogin` 从 staff-auth 移交 integration,理由是"PRIMARY 交给谁是编排决定"。现在有了第二个 integration,可以实测这个主张:**两个 integration 对这件事的答案完全相同**。搬上去的结果是同一段逻辑在两个 integration 各写一份。

**更准的边界(由本立项给出,建议回写治理文档)**:

| 决定 | 归属 | 为什么 |
|---|---|---|
| 未登录时 PRIMARY 显示什么 | **交互层(`staff-auth` 自己)** | 这是 auth 旅程自己的入口画面。任何组合了 staff-auth 的 console,答案都是"显示登录页"——**它不依赖别的 service** |
| 登录成功后 PRIMARY 去哪 | **编排层** | 答案取决于这个 console 还组合了什么:sample 去会员列表,sample2 去壁纸选择器。**这才是跨 service 的** |

⚠️ ~~即:判据不是"写不写 PRIMARY",而是"答案依不依赖别的 service"。~~ **该判据已于 §3.3 整体证伪并撤回,此处仅保留推导过程供追溯,不得作为结论引用。** 现行判据是治理轮 §2 原来那条:**一切 surface placement 归编排层**。

⚠️ ~~**Dexter 2026-09-13 裁定:回写 sample 治理文档。**~~ **本条已于 §3.3 整体撤回**(判据被盲审证伪)。下面两条**不执行**,保留仅为记录:
1. ~~治理文档 §4.4 取消对 `auth-navigation` 的拆分,该包在治理轮变成零改动。~~ **不执行**:按 §3.3,治理轮 §4.4 的拆分**照原计划进行**。
2. ~~治理文档 §2 的边界表判据改为"答案依不依赖别的 service"。~~ **不执行**:该判据已被证伪(§3.3),治理文档 §2 的边界表**不动**。

### 4.3 对原 sample 的调整:两处改动,外加一笔被"零改动"掩盖的成本

Dexter 问"原 sample 里的登录功能需要调整适配两个 integration 的话,也一起优化"。逐项核完(含盲审推翻初稿结论后的修正):

| 包 | 结论 |
|---|---|
| `kernel/feature/sample-staff-session` | **零改动**(§4.1,全包无 partKey/containerKey/displayMode 字面量,已亲验) |
| `ui/feature/sample-staff-auth` | **一处改动**:`parts.ts:17` 的 description 改成宿主中立(§4.2) |
| `ui/feature/sample-member-desk` | **零改动**。⚠️ 初稿写"顾客侧两个画面从本包迁出"是错的——sample2 建自己的 part(§3.3b),**不动 member-desk 一行**;真正的归位是治理轮/抽 base 轮的事 |
| `ui/integration/sample-console` | 无 sample2 引发的改动 |
| **`assembly/android/sample-terminal`** | ⚠️ **一处改动**(Dexter D10):删 `app.json:6` 与 `AndroidManifest.xml:19` 两处方向锁。**这会改变既有 App 的运行行为**(恒定横屏 → 随设备形态),须回归其现有旅途(§5.2) |

#### ⚠️ "零改动"掩盖的成本:装配义务在两个 integration 重复,且四条全无静态校验

第二个 integration 要复用这两个包,必须自己写全下列样板(对照 `sample-console/src/assembly/assembly.tsx`):

| # | 义务 | 漏了会怎样 |
|---|---|---|
| 1 | 把 `sampleStaffAuthAssembly.parts` 并进 defined parts(`:64-71`) | `showScreen` 找不到 part,登录页**静默不出现** |
| 2 | 由这些 part 造 `uiCatalog` / `rendererCatalog`(`:214-217`) | 同上 |
| 3 | 把 `sampleStaffAuthAssembly.variables` 传进 `createUiStateModule`(`:218-221`) | **运行期抛错**:`createUiStateModule.ts:106-108` 的 `variable declaration is not registered`,而 `StaffLogin.tsx:41` 无条件读该变量 → 登录页一渲染就炸 |
| 4 | 同时注册 `createSampleStaffSessionModule()` 与 `sampleStaffAuthAssembly.createModule()`(`:222-230`) | 命令无人接 |

**这四条是包对宿主的隐式契约,包的类型签名、`terminal-invariants.json`、骨架门里没有任何一处能抓到。** 第 3 条尤其危险:唯一的反馈是运行期崩溃。

#### 与我自己 base 抽取文档的矛盾,在此澄清

盲审指出:同日的 base 抽取文档把这批装配样板当作**要抽取的重复**,而本文初稿把"包不用改"称为**TR-12 的正面验证**——同一天对同一现象给出相反的价值判断。

**澄清:两者不矛盾,是我初稿只说了一半。** 完整表述是——**包侧复用成立(源码几乎不用改),而宿主侧成本真实(四项无校验的装配义务,每个 integration 重写一遍)**。前半是 TR-12 分层的兑现,后半是 base 抽取要解决的问题。**初稿只写了前半,还给它贴了"正面验证"的标签,这是选择性陈述。**

**这也让 §0.2 第 2 条更具体**:sample2 落地后,这四项装配义务会**实测重复两份**,base 抽取从此有了观测事实,不再是"假设第二个 integration 会照抄"。

## 4b. 红色主题(Dexter 2026-09-13 追加)

> sample2 的 integration 有另外一套 theme 主题,要红色主题。

**这条正好落在仓内既有裁定上,零争议**:`sample-console/README.md:19` 写「主题属于 integration app,不抽到共享包」,`:44` 写「新增应用时复制自己的 `theme/`,**不要建立共享 theme 包或 `ui/theme` 层**」。sample2 自带红色主题**就是规定的做法**。

### 4b.1 落点(照 sample-console 的现有形态复制)

| 文件 | 内容 |
|---|---|
| `sample-wallpaper-console/theme/global.css` | 19 个 `--color-*` 的**红色取值** |
| `sample-wallpaper-console/tailwind.config.cjs` | 19 个语义色名 → `rgb(var(--color-*))` 的映射 |
| `sample-wallpaper-console/package.json` 的 `exports` | 加 `"./theme/global.css"`(先例:sample-console) |
| `sample-wallpaper-terminal/metro.config.js` | `input` 指向上面那份(照 `sample-terminal/metro.config.js:14`) |
| `sample-wallpaper-terminal/tailwind.config.cjs` | 第二份映射(content glob 深度不同,见下) |
| `sample-wallpaper-console/test/theme.test.ts` | 照 sample-console 的一致性测试 |

⚠️ **19 个语义**色名**不变,变的只是取值。** 色名是 `ui/base/primitives/src/theme/tokens.ts` 消费的契约(它写的是 `bg-canvas`/`text-foreground` 这类 class 名);改名会让 primitives 在 sample2 下**静默失色**。**红色主题 = 改 `global.css` 里 19 个 RGB 值,不是改名字。**

### 4b.2 ⚠️ 这条需求给 sample 治理轮的 G-6 提供了关键证据

治理文档 §0.3 的 G-6 记的是"两份**逐字相同**的 `tailwind.config.cjs`"。sample2 落地后会变成**三份**:

| config | 色名集合 | 取值 |
|---|---|---|
| `sample-console` | 19 个 | 现有配色 |
| `sample-terminal` | 19 个,与上**逐字相同** | 同上 |
| **`sample-wallpaper-console`** | **19 个,必须相同** | **红色,必须不同** |

**这把 G-6 的性质讲清楚了**:重复的是**色名清单**(它是 primitives 的契约,必须一致),不是**取值**(它是每个 app 的主题,必须能不同)。

所以 G-6 的正确修法不是"消除重复的 config",而是**一条断言**:每份 `tailwind.config.cjs` 的色名集合,必须**双向等于** `primitives/src/theme/tokens.ts` 实际用到的那一组。而 `theme.test.ts` 今天把 19 个名字**硬编码在测试里**、不从 primitives 派生——primitives 新增一个色名而没人改这张表,三份 config 会一起静默失色。

**建议回写治理文档:G-6 的设计从"消除 config 重复"改为"色名集合从 primitives 派生并双向断言"。** 这条修正由本立项的真实需求给出,不是推测。

## 5. mobile 支持

| 项 | 做法 |
|---|---|
| `terminalSurfaces` | `sample-wallpaper-console/package.json` 声明 `portrait: {PRIMARY: 360×640}`；`sample-console` 同步为相同 mobile 逻辑尺寸(§1.3 临时变更) |
| parts | picker 的 `surfaceForm` 声明 `['laptop','mobile']` |
| 布局 | picker 在 mobile 下四个选项纵向排列;`WallpaperBackground` **铺满声明画布**(见 §5.1) |

### 5.1 壁纸失真怎么处置(Claude 裁决)

按 §1.4 修正②,画布被 `scaleX`/`scaleY` 两轴独立拉伸,物理屏比例 ≠ 声明画布时内容非等比变形。

**裁定:接受失真,`resizeMode` 用 `'cover'`,并把这条写进验收判据。** 三条理由:

1. **画布内所有内容今天都在这样被拉伸**——文字、按钮、布局无一例外。壁纸单独保真,反而会和它上面的 UI 对不齐;
2. **匹配的硬件上不失真**:sample2 的声明画布(laptop 1280×800 / 960×540、mobile **360×640**)按 integration 契约固定。mobile VM 的物理屏幕为 720×1280，因此 `scaleX = scaleY = 2`，是等比缩放、零非等比失真；laptop 侧残余多少两台 VM 实测即知;
3. **真要保真,正确修法是在 `SurfaceHostController` 的 viewport 层开槽**(让壁纸跳出 canvas 的 transform),那是 render 的结构改动——**今天多加一个组件对那个场景一点忙都帮不上**,属于为假想需求预建。

⚠️ **验收判据必须写明这一点**,否则会出现"图看起来被拉扁了"被当成 bug 报回来。若将来对保真有真实要求,重开条件是:出现一台比例与声明画布显著不符的目标机型。

### 5.2 mobile 在 Android 端怎么发生(Dexter 2026-09-13 裁定)

> 我希望在 `apps/terminal/adapter/android/dual-screen` 里面判断屏幕尺寸并锁定方向,不把这个通用逻辑下放到 assembly 里,同时 `apps/terminal/assembly/android/sample-terminal` 里面也把锁定方向的逻辑去掉。

**这条裁定同时扩大了两处范围,必须显式记账:**

| 包 | 动作 | 是否在 Dexter 原指定的四层内 |
|---|---|---|
| `adapter/android/dual-screen` | **新增**:判屏幕尺寸 → 决定 `surfaceForm` → 锁定方向 → 经 launch options 下发 | **否**,第五层 |
| `assembly/android/sample-terminal` | **修改**:删掉方向锁 | **否**,是既有 App |

**为什么这个归属是对的**:"这台设备是什么形态"是 display 知识,不是某个 App 的业务。放 assembly 则每个 App 各写一遍且会漂移;放 adapter 则**两个 App 都白得**,sample2 的 assembly 一行都不用写。

**现状(已亲验)**:
- 方向锁在 sample-terminal 的**两处**:`app.json:6` 的 `"orientation": "landscape"`、`AndroidManifest.xml:19` 的 `android:screenOrientation="landscape"`。两处都要去掉;
- adapter **本来就拥有下发通道**:`TerminalDualScreenActivityHandler.kt:770-773` 的 `PrimaryLaunchOptionsDelegate.getLaunchOptions()` 已经在 `putInt("displayIndex", 0)` / `putInt("displayCount", …)`。加一个 `putString("surfaceForm", …)` 是同一个 Bundle;
- `:528-530` 是副屏那一路,同理;
- JS 侧 `App.tsx:23` 的 `surfaceForm = 'laptop'` 默认值届时改为读该 prop。

#### 5.2.1 形态推导真值表(Codex M-03 要求,此处定死)

| 项 | 取值 |
|---|---|
| **判据输入** | ⚠️ **更正:`Configuration.smallestScreenWidthDp`,不是 `DisplayMetrics`。** 初稿写 "`DisplayMetrics` 的逻辑尺寸"是错的——`DisplayMetrics` 的宽高随当前 window 姿态变化,**会被本 App 自己下发的 `setRequestedOrientation` 反过来污染**(第一轮盲审 M-01 的自锁死结)。`smallestScreenWidthDp` 是 configuration 的最短逻辑宽度,横竖互换不变 |
| **判据** | ⚠️ **"按方向判"也作废,更正为按 `smallestScreenWidthDp` 的标定阈值判。**<br>`smallestScreenWidthDp >= 阈值 ⇒ laptop`;`< 阈值 ⇒ mobile`;`<= 0`/未定义/读取异常 ⇒ `laptop` 并写诊断。<br>**为什么"按方向"是错的**:方向就是姿态,删了方向锁则形态随冷启动时设备被怎么拿着而变;留着锁则 `mobile` 不可达;且一旦判成 laptop 并锁横屏,下次重建读到的是**自己锁出来的横屏**,永久不可逆。<br>⚠️ **阈值不得凭空写入**:由实施首步在两台目标 VM 上分别实测 mobile 值 `m` 与 laptop 值 `l`(须 `m < l`),冻结为 `floor((m+l)/2)+1`,**写在 adapter 的单一 classifier 位置**,不得由 assembly 或 JS 断点另存一份。<br>⚠️ **与 JS 侧 `surfaceFormForOrientation` 不是同一件事**:后者是 Web 预览按 orientation 键取声明的 helper,不是 Android 设备判定来源,两者不得互相冒充 |
| **Bundle key / type** | `putString("surfaceForm", …)`,值域 `laptop` / `mobile`,与既有 `putInt("displayIndex", …)` 同一个 Bundle(`TerminalDualScreenActivityHandler.kt:528-530, 770-773`) |
| **未知 / 读不到** | **落 `laptop`**,并打一条 `display-diagnostics` 诊断。理由:laptop 是既有默认值(`App.tsx:23`),落它不改变现有行为 |
| **判定与锁定的挂载点** | ⚠️ **不是 activity 的 `onCreate`,此处更正**(Codex S-04,已亲验):adapter 今天介入的实际 hook 是 `TerminalDualScreenActivityHandler.kt:401` 的 **`onDidCreateReactActivityDelegate`**(`:791` 那个 `onCreate` 属于 `TerminalPresentation` 副屏类,不是主 activity)。形态判定与 `setRequestedOrientation` 都挂在该 hook,**一次性执行,之后不随运行期旋转改变**(避免形态在会话中途翻转导致 catalog 过滤结果突变) |
| **主屏 / 副屏传播** | **副屏(presentation)不参与形态判定**,直接沿用主屏判定结果。理由:形态是"这台终端是什么",不是"这块屏是什么" |
| **JS 侧缺失值** | `App.tsx` 读不到该 prop 时仍取 `'laptop'`——与未知设备同一落点,保证旧 APK / Web dev-host 行为不变 |

⚠️ **阈值与"未知落 laptop"两条是产品裁决,我按"不改变现有行为"的原则给了默认值。Dexter 若有不同取法请覆盖。** 两台 VM 可实测(§0.4)。

⚠️ **`'mobile'` 今天在 `assembly/` 与 `adapter/` 全树零 producer**(盲审穷举过)。而 `SurfaceForm` 类型、catalog 校验、两个现有 ui/feature 的 part 声明**都已支持 mobile**——**整个缺口只在 native 入口这一处**,补上即全线打通。

⚠️ **这条改动会影响既有 sample App 的运行行为**(它从"恒定横屏"变成"随设备形态"),不是纯增量。实施时须同时回归 sample 的现有旅途。
| 验收 | **分两条路径**(§1.3):laptop/横屏验"主副屏同时生效";mobile/竖屏验"单屏生效",不验副屏 |

## 6. 关于"从网上下载图片放到包内"

我**不会**执行下载——本会话是静态分析,不跑命令,也不向外部发起请求。实施阶段需要明确:

1. **来源与授权**:**✅ Dexter 裁定由 Codex 自选**。硬要求:必须是允许再分发的许可(CC0 / Unsplash License / Pexels License 等),并在 `ui/feature/sample-wallpaper-picker/README.md` 逐张记录**来源 URL 与许可证名称**;
2. **尺寸与体积**:逻辑主屏 1280×800、副屏 960×540、mobile **360×640**；mobile VM 物理屏幕仍为 720×1280。建议按最大边 1280 压到单张 200KB 以内,否则进 APK 体积;
3. **格式**:`.jpg`(照片类壁纸,比 png 小得多)。

## 7. ⚠️ 超出 Dexter 指定范围、但本立项无法回避的项

⚠️ **初稿两次宣称过封闭性("两项""五项"),两次都不成立。现在不再给总数形容词,以 §7.0a 的分母表为唯一正本。**

### 7.0a 范围分母(唯一正本;Codex M-04 要求拆开三类)

⚠️ **初稿在这里同时写过"补齐后五项""实际触及六个位置",而表里列了十行——三个数字互相打架。此处重写为唯一分母,全文其他处不得再另起计数。**

**A 类 · 新建包(4)**:`kernel/feature/sample-wallpaper`、`ui/feature/sample-wallpaper-picker`、`ui/integration/sample-wallpaper-console`、`assembly/android/sample-wallpaper-terminal`。

**B 类 · 本批要改的既有位置(8)**:见下表后八行。⚠️ 其中 `kernel/base/ui-state` 是 **kernel/base 层**,影响所有 App。

**C 类 · 前置/并行项目,不在本批(2)**:sample 治理轮(时点已按 §3.4.1 冻结为"未落地")、抽 base 轮(拓扑迁移,按 §3.4 明确不属本批)。

**合计本批 touched positions = 4 + 8 = 12。** 逐条:

⚠️ **2026-09-14 更新**:Dexter 的 mobile 逻辑尺寸统一裁定(§1.3)把 `ui/integration/sample-console` 也拉进本批——它的 `package.json` 的 `terminalSurfaces.orientations.portrait.PRIMARY` 由 `360×800` 改为 `360×640`,连带 `test/packageSurface.test.ts` 同步。该包此前不在分母内,现补入,**既有位置由 7 增至 8**。

| 位置 | 动作 | 依据 |
|---|---|---|
| `kernel/feature/sample-wallpaper` | 新建 | Dexter 指定 |
| `ui/feature/sample-wallpaper-picker` | 新建 | Dexter 指定 |
| `ui/integration/sample-wallpaper-console` | 新建 | Dexter 指定 |
| `assembly/android/sample-wallpaper-terminal` | 新建 | Dexter 指定 |
| **`ui/base/primitives`** | 改:加 `Image` 接缝 + `PrimitiveImage` + 两个 token(`imageBackground`、`containerTransparent`)+ `PrimitiveContainer` 的 `transparent` layout | §1.1 重裁、§3.5 |
| **`ui/integration/sample-console`** | 改:`terminalSurfaces.orientations.portrait.PRIMARY` 由 `360×800` → `360×640`,同步 `test/packageSurface.test.ts` | Dexter 2026-09-14 裁定(§1.3) |
| **`ui/feature/sample-staff-auth`** | 改:`src/parts/parts.ts:17` 的 description 改成宿主中立(⚠️ Codex 第二轮抓到此项此前漏列) | §4.2 |
| **`kernel/base/ui-state`** | 改:浮层进持久化并恢复;反向重写 U-7 与 `content.test.ts:218` | Dexter §3.6 裁定 |
| **`adapter/android/dual-screen`** | 改:判屏幕尺寸 → 定 `surfaceForm` → 锁方向 → 经 launch options 下发 | Dexter §5.2 裁定 |
| **`assembly/android/sample-terminal`**(既有 App) | 改:删 `app.json:6` 与 `AndroidManifest.xml:19` 两处方向锁 | Dexter §5.2 裁定 |
| `tools/terminal-skeleton/check-static.mjs` | 改:`:278` 的 `!== 27` → `!== 31`;`:172` 的 `runAssemblyEntryReachability` 硬编码加新 assembly | §7.0 b、§7.0 g |
| `tools/terminal-layering/check-static.mjs` | 改:`:173` 的 `uiNativePackages` 硬编码加新 integration | §7.2 |

⚠️ **`ui/base/render` 零改动**(§1.1 重裁的结果)。

### 7.0 骨架门与包内正本构件

| # | 必须做 | 不做的后果 |
|---|---|---|
| a | 四个新包写进 `apps/terminal/skeleton-graph.ts` | `graph-comparison` 红:磁盘多出 package.json 而图里没有 → `active TER package census mismatch` |
| b | **`tools/terminal-skeleton/check-static.mjs:278` 的硬编码节点数 `!== 27` 改成 `!== 31`** | 直接抛 `skeleton spec must contain 27 nodes` |
| c | 每个新包补 `terminal-invariants.json`(27 个现存包无一例外) | `triple-naming` / 测试门 |
| d | 每个新包补 `src/moduleName.ts`(精确形如 `export const moduleName = '...' as const;`)与 `src/dependencies.ts` | `triple-naming` 红 |
| e | `kernel/feature/sample-wallpaper` 若按 §3.1 建真实 slice,graph 条目**不得**带 `plannedKind`,包内**必须**导出 `moduleKind = 'owner'` | `graph-model.mjs:132-138` 抛错 |
| f | `ui/base/primitives` 的新导出同步进 `terminal-invariants.json` 的 `publicExports` | ⚠️ **注意:primitives 今天没有任何门校验这个**(`tools/` 下 grep `publicExports` 的命中集不含 primitives,`tools/terminal-ui-primitives/` 只有 `check-behavior.mjs`)。漏了**不会红**,靠 review 兜 |
| g | **`tools/terminal-skeleton/check-static.mjs:172` 的 `runAssemblyEntryReachability` 把 `'assembly.android.sample-terminal'` 写死**,新 assembly 不加进去就静默逃过"`index.ts` 必须 import `./App`、`App.tsx` 必须 import `./src/assembly/platformPorts`、二者不得用动态 import"这组门 | 新 assembly 成为门外之地 |

⚠️ **`source imports` 是集合相等双向校验**(`check-static.mjs:245`):`src` 里 import 了没声明会红,**声明了而 `src` 没 import 同样会红**。新包的依赖清单必须与实际 import 精确一致。

### 7.1 `ui/base/primitives` 的改动(C1 已裁,落点定死)

图片接缝**只加这一个**,`ui/base/render` 零改动(§1.1)。四项:

| 文件 | 改动 |
|---|---|
| `src/vendor/slots.tsx` | `Image` 加入 RN import,导出 `RnrImage` |
| `src/components/PrimitiveImage.tsx` | 新建;`layout` 支持默认(缩略图)与 `'background'`;透传 `resizeMode` |
| `src/theme/tokens.ts` | 加 `imageBackground: 'absolute inset-0 w-full h-full'` 与 `containerTransparent: 'flex-1 p-6 gap-4'`(§3.5) |
| `src/components/PrimitiveContainer.tsx` | `layout` 增加 `'transparent'`(§3.5) |

连带 §7.0 的 f(同步 `terminal-invariants.json` 的 `publicExports`)。

⚠️ **`layout="background"` 必须绝对定位**,因为 `SurfaceRoot` 的 `{children}` 是 `flexDirection: column` 下的**普通流式第一子节点**(`SurfaceRoot.tsx:73-79`,`styles.content = {flex:1}`),不绝对定位就会占布局高度、挤压 `ScreenContainer`。

### 7.2 新 integration 包不会自动进门的分母

`tools/terminal-layering/check-static.mjs:171-177` 的 `uiNativePackages` **硬编码**了 `['ui/base/dev-host', 'ui/integration/sample-console']`。新建 `ui/integration/sample-wallpaper-console` 若不加进这个列表,它就**静默逃过 P-5d 门**(禁止原生 host 标签那条)。

这是 `tools/` 改动,一行。**但必须做,否则新包是门外之地。** 这也顺带说明:该列表是硬编码的,以后每加一个 integration 都要记得改——值得登记为一条欠账(改成按目录枚举)。

## 8. 新建包的构成清单与 `skeleton-graph.ts` 节点

初稿只给"层/职责",实施者据此开不了工(可实施性盲审 M-1/M-5/S-2)。以下照 `sample-staff-auth`、`sample-console`、`sample-terminal` 三个样板的实际 tracked 构成给出。

### 8.1 每个包的必备文件(四个新包通用)

`package.json`(含 `typecheck` 与 `test` 脚本,`test` 指向 `tools/terminal-shared/run-owned-tests.mjs`)、`tsconfig.json`、`vitest.config.ts`、`src/moduleName.ts`、`src/dependencies.ts`、`src/index.ts`、`terminal-invariants.json`、`test/`、`README.md`(TR-10 要求中文,写清定位/依赖谁/被谁依赖)。

⚠️ 三处易错:
- `src/moduleName.ts` 必须**精确形如** `export const moduleName = '...' as const;`(`runTripleNaming`);是否额外导出 `moduleKind` 见 §8.2;
- `terminal-invariants.json` 的 `owned.test.kind` 只能取 `ABSENT|REAL_TESTS|NO_TEST_FILES|OWNED`,`owner` 必须等于包名(`tools/terminal-shared/package-invariants.mjs:37-43`);
- `tsconfig.json` 两种写法不同:feature/integration 用 `extends: "../../../tsconfig.base.json"`,assembly 用 `extends: "expo/tsconfig.base"`。

⚠️ **`src/dependencies.ts` 与 `package.json` 是双向集合相等**(`check-static.mjs:245`)。既有做法可参考 `sample-terminal/src/dependencies.ts`——它把 7 个 workspace 依赖**全部** import 了一遍(含 `platformPorts.ts` 里没实际用到的两个),正是为了满足这条。新包在这里最容易反复红。

### 8.2 `skeleton-graph.ts` 四个节点

```
'kernel.feature.sample-wallpaper': {
  batch: 2,
  dependencies: ['kernel.base.contracts', 'kernel.base.state', 'kernel.base.runtime'],
  devDependencies: ['kernel.base.platform-ports'],
},                                   // 有真实 slice ⇒ 不写 plannedKind,包内导出 moduleKind='owner'

'ui.feature.sample-wallpaper-picker': {
  batch: 2,
  dependencies: ['kernel.base.state','kernel.base.ui-state','kernel.base.runtime',
                 'kernel.feature.sample-wallpaper','ui.base.render','ui.base.primitives'],
  devDependencies: [],
},                                   // 无 slice ⇒ 照 staff-auth,包内导出 moduleKind='owner'

'ui.integration.sample-wallpaper-console': {
  batch: 2,
  dependencies: ['kernel.base.contracts','kernel.base.platform-ports','kernel.base.runtime',
                 'kernel.base.display-context','kernel.base.ui-state',
                 'kernel.feature.sample-staff-session','kernel.feature.sample-wallpaper',
                 'ui.base.render','ui.base.input','ui.base.primitives',
                 'ui.feature.sample-staff-auth','ui.feature.sample-wallpaper-picker'],
  devDependencies: [],
},                                   // 无 slice,但有 module+actor ⇒ moduleKind='owner'

'assembly.android.sample-wallpaper-terminal': {
  batch: 1,
  plannedKind: 'toolkit',
  dependencies: ['kernel.base.platform-ports','adapter.android.persist-kv','adapter.android.device',
                 'adapter.android.app-control','adapter.android.logger','adapter.android.dual-screen',
                 'ui.integration.sample-wallpaper-console'],
  devDependencies: [],
},
```

⚠️ **`plannedKind` 与包内 `moduleKind` 恰好二选一**(`graph-model.mjs:140-145`):两个都有或都没有都抛错。有真实 slice 时**必须** `moduleKind='owner'` 且**不得**有 `plannedKind`(`:132-138`)。

⚠️ **上面的依赖清单是设计意图,不是实测结果**。落地时以 `src` 实际 import 为准,集合相等门会逼出正确答案。`ui.base.input` 是否需要取决于 picker 有无输入控件——按 §3.2 的四选项设计**不需要**,此处列出仅因 integration 要挂 `InputSurfaceFrame`(照 sample-console 的 `assembly.tsx:28`)。

### 8.3 `assembly/android/sample-wallpaper-terminal` 的额外构成(最大的空洞)

样板 `sample-terminal` 有 74 个 tracked 文件。除 8.1 的通用项外还需要:

| 类别 | 文件 |
|---|---|
| Expo/RN 入口 | `App.tsx`、`index.ts`、`app.json`、`metro.config.js`、`babel.config.cjs` |
| 类型垫片 | `global.d.ts`(`declare module '*.css'`)、`nativewind-env.d.ts` |
| 主题 | `tailwind.config.cjs`(§4b.1) |
| 资产 | `assets/` 下 5 张 app.json 实际引用的 PNG |
| Android 原生工程 | `android/settings.gradle`、`android/build.gradle`、`android/app/build.gradle`、`MainActivity.kt`、`MainApplication.kt`、`AndroidManifest.xml`、`res/values/{strings,colors,styles}.xml`、splash drawable、mipmap 图标、`gradle/wrapper/` |

**命名标识必须与 sample-terminal 区分开,否则两个 APK 互相覆盖安装:**

| 标识 | sample-terminal 现值 | sample2 取值 |
|---|---|---|
| `app.json` 的 `expo.name` / `slug` | `sample-terminal` | `sample-wallpaper-terminal` |
| `android.package` / `applicationId` / `namespace` | `com.anonymous.sampleterminal` | `com.catering.v2s.terminal.samplewallpaper` |
| Kotlin 包路径 | `com/anonymous/sampleterminal` | `com/catering/v2s/terminal/samplewallpaper` |
| `settings.gradle` 的 `rootProject.name` | `sample-terminal` | `sample-wallpaper-terminal` |
| `strings.xml` 的 `app_name` | 同上 | 同上 |

sample2 的四个工程身份字面值在本批冻结为上表值；不得沿用 Expo 默认的 `com.anonymous.*`
前缀，也不得让 `applicationId`、Gradle `namespace`、Kotlin 包路径或 `expo.slug` 在实施时
由实施者临时发明。五张 PNG 仅指 `app.json` 实际引用的 `icon`、三个 adaptive icon
（foreground/background/monochrome）和 web favicon；来源、许可证、尺寸与 hash 必须随
资产清单登记，不能把未被配置引用的 splash 图标混入本批文件分母。

⚠️ **`android/` 目录建议走 `expo prebuild` 生成后再改,而不是照抄 sample-terminal 改名**——照抄容易漏改 Kotlin 包路径与 gradle 标识。⚠️ `app/build.gradle` 引用的 `debug.keystore` 未被 tracked(在 `.gitignore` 内),新工程如何取得须在详设阶段明确。

⚠️ **`app.json` 与 `AndroidManifest.xml` 都不要写方向锁**(Dexter D10,§5.2)。

## 9. 验收判据

⚠️ 判据必须可证伪。"能跑起来"不是判据。

| # | 判据 | 怎么判 |
|---|---|---|
| A1 | 登录后主屏出现壁纸选择器,四个选项(无壁纸 + 三张缩略图) | ⚠️ **Codex S-02:只断言 partKey 挡不住空 picker、缩略图全 undefined、renderer 挂错**。补足:除 partKey 外,断言四个选项控件各自可寻址(testId)、三张缩略图的 source 均已解析、当前选中态与 `selectWallpaperId` 一致;真机截图留证 |
| A2 | **点选项时壁纸不变;点确认后才变** | ⚠️ **真机比对,两段;比较区域限定为壁纸 ROI**(Codex DESIGN_CLARIFICATION-01,接受):点选项会合法改变 radio 的选中样式,**比全屏会把控件变化误判成壁纸变化**。ROI 定义为 `SurfaceHostController` canvas 内**扣除 picker 控件矩形**后的区域。①点选项后:该 ROI 与点前**像素无差异**;②点确认后:该 ROI **确有差异**。控件选中态另由 A2b 覆盖 |
| A2d | **屏幕上那张图确实是用户选的那张**(Codex S-03) | 像素有差异只证明"变了",不证明"变对了"。同时断言:`WallpaperBackground` 实际渲染的 source **等于**独立的 `WallpaperId`→asset 期望；三张图两两不同；逐张确认 `w1`、`w2`、`w3`，每一对确认后的壁纸 ROI 都用 A2 确认侧同一组 compare 工具、metadata 与阈值互相比较并确有差异。不能从被测 `assetsById` 重新生成期望 |
| A2b | 确认按钮的可用性正确 | 无 pending 时禁用;选中与已确认相同时禁用;选中不同项时可用。断言按钮 disabled 属性随 `selectPendingWallpaperId` 变化 |
| A2c | **无 pending 时派发 confirm 不得成功**(TR-02) | ⚠️ **"非成功"太弱**(Codex S-01),四条同时断言:①顶层 command status **不是 `completed`**;②错误带**具名稳定 code**(不是裸 `Error`);③该次派发**零 state 写入**(前后 state 逐字相同);④**零子命令**(journal 里该命令无 child) |
| A3 | 有副屏时,同一选择在副屏同时生效 | ⚠️ **"两屏像素一致"作废,改判法**(见 §9.3)。三条同时断言:(a) 确认后 PRIMARY 与 SECONDARY 的壁纸 ROI **各自**都与确认前不同;(b) 两屏渲染解析出的 asset identity 相同;(c) **换选另一张再确认,两屏 ROI 再次各自改变**。另断言副屏叠加的是 `waiting`/`welcome` 的可见文案而非 picker |
| A4 | 副屏在登录前显示「等待店员登录」、登录后显示顾客欢迎语 | ⚠️ **Codex S-02:只比 partKey 挡不住 renderer 挂错、文案写反。** 除 partKey 外,断言副屏截图上**可见文本**分别含「等待店员登录」与欢迎语,且两态互不相同 |
| A5 | **重启后壁纸仍在**(D8) | TR-04 重启测试正向断言:第二个 runtime 的 `selectWallpaperId === 'w2'` |
| A5b | **未确认的选择与界面也恢复**(Dexter 追加) | runtime#1 确认 `w2` → 再选中 `w3` 但**不确认** → 重启 → 断言:`selectWallpaperId === 'w2'`、`selectPendingWallpaperId === 'w3'`、PRIMARY screen 仍是 `sample.wallpaper.picker`、**屏幕上壁纸仍是 w2**(真机截图) |
| A5d | **确认之后 pending 确实被清掉且不跨重启**(Codex S-01) | runtime#1 选 `w3` 并**确认** → 重启 → 断言 `selectWallpaperId === 'w3'` 且 `selectPendingWallpaperId` 为 `undefined`。⚠️ 缺这条,`confirmPending` 忘记清 pending 也能全绿 |
| A5c | **浮层也恢复**(Dexter 追加,§3.6) | 重启前在 PRIMARY 开一个浮层 → 重启 → 断言 `selectLayers(state,'PRIMARY')` 含该浮层,且 `layerId`/`partKey`/`props` 逐字相同 |
| A6 | mobile 形态可达 | Android:断言 `adapter` 下发的 `surfaceForm` 随屏幕尺寸变化(§5.2);**不验副屏**(§1.3 竖屏结构上单屏) |
| A7b | **红强调色不与错误色撞车,且按钮可读**(§9.2 连带) | ⚠️ **纯 HSL 阈值挡不住"刚好差 15°"的恶意实现**(Codex S-02),改为绑定真实使用上下文:①`PrimitiveButton` 实际渲染的 `bg-action` 与 `text-action-foreground` 组合,对比度须达 WCAG AA(≥4.5:1);②`--color-action` 与 `--color-error-foreground` 的取值**必须来自 §9.2 批准的 palette**,不是任意满足阈值的值;③`ok`/`warn`/`info` 三组色相**与既有取值一致**(红主题不改语义色) |
| A7 | 红色主题生效且色名齐全 | 照 `sample-console/test/theme.test.ts` 复制:19 个色名在 `tailwind.config.cjs` 与 `global.css` 双向命中。⚠️ **再加一条初稿没有的**:断言取值确为红系,否则复制过来的测试对"忘了改颜色"是全绿的 |
| A8 | 既有 sample App 未被 D10 改坏 | ⚠️ **Codex S-02 指出原判据只有"回归旅途"一句,没有动作/预期/证据档位。补足**:在 laptop VM 上跑完整旅途——冷启动落登录页 → 输工号密码登录 → 主屏出会员列表、副屏出顾客欢迎页 → 新建会员至待确认 → 副屏确认 → 回列表 → 登出回登录页。每步截图留证。失败判据:任一步的主/副屏 partKey 与治理前不一致 |
| A9 | mobile 下 SECONDARY 无派发(Codex N-02) | mobile VM 上断言:全程没有任何 `showScreen(SECONDARY, …)` 被派发,且 `waiting`/`welcome` 两个 part 因 `surfaceForm: ['laptop']` 不出现在 mobile 的 catalog 过滤结果里 |

### 9.3 A3 的跨屏判法(Claude 裁决,回应 Codex DEXTER_DECISION-01)

**Codex 指出我原来的 A3 不可能成立,他是对的**:laptop 的 PRIMARY 是 1280×800(1.60)、SECONDARY 是 960×540(1.78),宽高比不同;同一张图经 `cover` 裁切后内容本就不同,再各自按 `scaleX`/`scaleY` 独立拉伸到物理屏。**"两屏壁纸区域像素一致"在正常实现下必红**——这是我写判据时没算比例。

**裁定:不做跨屏像素比对,改用三条各自可判的断言。** 这是 Codex 候选 A 的形态,外加我补的第三条:

| 断言 | 抓的失败 |
|---|---|
| (a) 确认后两屏壁纸 ROI **各自**都与确认前不同 | 副屏完全没生效(停在旧图或空白) |
| (b) 两屏渲染解析出的 asset identity 相同 | 选源分叉(两屏读了不同的 id) |
| (c) **换选另一张再确认,两屏 ROI 再次各自改变** | 副屏被钉死在某一张图上——(a)(b) 单独都抓不住这个 |

⚠️ **为什么不取 Codex 的候选 B(反变换到共同 256×256 网格)**:它更重,而它比 (a)(b)(c) 多抓的只有"同一 id 却渲染出不同内容"——而两屏用的是同一个 `WallpaperBackground` 组件,这个失败形态要靠组件内部分支才能制造,已被 (b) 的 identity 断言覆盖。

⚠️ **为什么不取候选 C(各屏独立 baseline)**:Codex 自己写了理由——它不再证明两屏来自同一资产,**恰好掩盖选源分叉**,而那正是本判据最该抓的东西。

⚠️ **(b) 单独是"声称"不是"行为"**,所以三条必须同时成立才算通过;(a)(c) 是像素级的行为锚。

### 9.1 红夹具(判据必须能被弄红,否则等于没有)

| 夹具 | 做法 | 期望 |
|---|---|---|
| **F-A2a** | 把 picker 的容器从 `layout="transparent"` 改回默认 | **A2 必须红**。这是本设计最容易悄悄失效的一处 |
| **F-A2b** | ⚠️ **夹具须作用于非 `none` 资产**(Codex DESIGN_CLARIFICATION-02,接受):`none` 合法映射为无图,`assetsById['none']` 为 `undefined` **不是故障**,拿它做夹具弄不红。固定为:把 `w2` 映射成 `undefined`,再走"选 w2 → 确认 → 断言背景 source 与壁纸 ROI" | **A1/A2 必须红** |
| **F-A5** | 把 `sample-wallpaper.selection` 的 `persistIntent` 改成 `'never'` | **A5 必须红** |
| **F-A5b** | 把 `persistence` 里 `pendingWallpaperId` 那条去掉 | **A5b 必须红**(未确认的选择丢失) |
| **F-A2c** | 去掉 actor 里"选中项与当前一致就不派发"的判断 | ⚠️ **编号更正**:应打 **A2b**(确认按钮可用性 / 重复点同一项不派发),**不是 A2c**(A2c 是 TR-02 的 confirm-without-pending,与本夹具无关)。**A2b 必须红** |
| **F-A2** | 让 `WallpaperBackground` 读 `selectPendingWallpaperId` 而不是 `selectWallpaperId` | **A2 第①段必须红**(点选项就切了,确认按钮形同虚设) |
| **F-A7** | 把 sample2 的 `global.css` 换成 sample-console 的取值(即"忘了改成红") | **A7 必须红** |
| **F-A3a** | 只给 PRIMARY 传 `WallpaperBackground`,SECONDARY 不传 | **A3(a) 必须红** |
| **F-A3b** | 让副屏的 `WallpaperBackground` 读一个写死的 id 而非 selector | **A3(b)(c) 必须红**;⚠️ 仅 (a) 抓不住它——副屏首次仍会"变化" |

⚠️ **A2 明确排除的三种判法**(Codex S-01 逐条点破,全部接受):①只断言 `wallpaperId` 写进 state;②只断言组件用了哪个 `layout`;③只断言"树里有这个节点、父容器 className 没有 `bg-canvas`"。

**第三种为什么也不够**:`opacity:0`、宽高为 0、被不透明 sibling 覆盖、节点挂在未渲染分支——**四种合规但屏幕无变化的实现都能通过**。静态断言**原理上**判不了遮挡与合成结果。

**这正是 §0.4 那两台 VM 的用武之处**:真机截图比对是唯一能正面证明"屏幕确实变样"的手段。A2 因此从"静态断言"升格为"真机比对 + 静态辅助"。

⚠️ **同理升级的还有 A3**(双屏 VM 上同时截两块屏)与 **A6**(mobile VM 上实测形态推导)。

### 9.2 红色主题的可判定判据(Codex S-03)

⚠️ **"红色主题"四个字不可机械判定**——复制一份蓝色主题、19 个色名照样齐全,A7 会全绿。此处给出可判定 predicate:

> 从 sample2 的 `theme/global.css` 解析 `--color-action` 的 RGB,转 HSL 后断言:**色相落在 [340°,360°] ∪ [0°,20°]**,**饱和度 ≥ 0.4**,**明度在 [0.25,0.65]**。
> ⚠️ **不约束 `--color-action-foreground` 的色相**(见上,它必须中性);改为约束它与 `--color-action` 的**对比度 ≥ 4.5:1**。

**为什么选 `action` 而不是 `canvas`**:`action` 是品牌强调色,是"这个 App 是红色的"最直接的承载;`canvas`(底色)在深浅两种设计下都可能是近中性色,拿它判会误伤。

⚠️ **具体 19 个取值由 Codex 定**,只需满足上述 predicate 并通过既有的色名齐全断言。

**✅ Dexter 2026-09-13 裁定:强调色是红、其余中性。**

⚠️ **我此前把这条读成"`action` 与 `action-foreground` 都走红系",是误用**(Codex 三轮 M-05 指出):亲验现状 `--color-action: 15 23 42`(按钮底)、`--color-action-foreground: 255 255 255`(按钮**文字**),`tokens.ts:17-18,65-70` 把二者成对用于 `bg-action` + `text-action-foreground`。**两个都红 = 红底红字,按钮不可读。**

`action-foreground` 是"其余"的一部分,按裁定就该中性。正确落点:**`--color-action` 走红系(强调色的承载),`--color-action-foreground` 保持高对比中性**(白或近白)。用户看到的仍是红色按钮,文字保持可读。

其余:`canvas`/`surface`/`foreground`/`border` 等保持中性,`ok`/`warn`/`error`/`info` 四组语义色**维持各自既有色相**(绿/黄/红/蓝)不受主题影响。

⚠️ **连带一条必须写进判据**:`--color-error-*` 本来就是红系,与 `--color-action` 同为红会**削弱错误提示的辨识度**。A7 因此补一条:断言 `action` 与 `error-foreground` 的色相差 ≥ 15° 或明度差 ≥ 0.15,**二者不得视觉上难以区分**。

⚠️ **失真不算缺陷**(§5.1):物理屏比例 ≠ 声明画布时壁纸非等比拉伸,与画布内所有内容同等,不作为 A2 的否决项。

## 10. 裁决记录(累计三轮)

### 10.1 Dexter 裁定

| # | 裁定 | 状态 |
|---|---|---|
| D1 | primitives 加图片接缝(甲) | ⚠️ **前提被推翻**,见 D5 与 §1.1 |
| D2 | 副屏:登录前「等待店员登录」,登录后顾客欢迎语 | 生效,§3.3b / §3.4 |
| D3 | §4.2 边界修正回写治理文档 | ⚠️ **已撤回**(判据被证伪,§3.3) |
| D4 | 三张图由 Codex 自选 | 生效,§6 |
| D5 | 包名 `sample` 前缀,其余由 Claude 定 | 生效;四个新建包已定名 |
| D6 | 「完整完美方案,不要临时的」⇒ 两个接缝都做 | ⚠️ **前提被推翻**,重裁为**一个接缝**,见 §1.1 |
| D7 | kernel 包保留,定位四层演示件 | 生效,§3.1 |
| D8 | 重启后按 `wallpaperId` 恢复壁纸 | 生效,§3.1.1(声明式,零代码) |
| D9 | 壁纸铺画布 | 生效,但**依据的"留边"是假事实**,真实后果是失真,见 §5.1 |
| D10 | mobile:判屏与锁方向放 `adapter/android/dual-screen`,`sample-terminal` 删掉方向锁 | 生效,§5.2。**范围扩大到第五、第六个位置,已记账(§7.0a)** |

### 10.2 Claude 裁定(Dexter 授权"其他都由你来裁决")

| # | 裁定 | 落点 |
|---|---|---|
| C1 | **只加一个接缝**,`ui/base/render` 零改动 | §1.1。推翻 D1/D6 所依据的两条假前提 |
| C2 | **壁纸可见性**:primitives 加 `containerTransparent` 变体,三个 part 用它 | §3.5。**不解这条整个功能是假的** |
| C3 | **删 `hydrationRejected` 与校验 actor** | §3.1.2。先例引错,且防不住自己要防的事 |
| C4 | **删 `wallpaperSelected` 与 `wallpaperSelectionFailed`**,kernel 只剩一条命令 | §3.1.3。一个无消费者,一个路径不可达 |
| C5 | **TR-04 缺口按缺口上报,不用机制填**;倾向"允许反向断言指向同一用例里别的 slice" | §3.1.4。新查明:TR-04 **没有通用门** |
| C6 | **接受壁纸失真**,`resizeMode:'cover'`,写进验收判据 | §5.1。画布内所有内容今天都这样被拉伸 |
| C7 | ui/feature 侧**如实上报"本包没有 actor"**,不发明行为去撑 TR-12 3a | §3.2 |

### 10.3 ⚠️ 一个必须记下的模式:三次裁定建立在我给的假前提上

| Dexter 的裁定 | 我给的前提 | 实际(已亲验) |
|---|---|---|
| D1 接缝放 primitives | "primitives 是全仓唯一 RN 接缝" | `ui/base` 下 11 个文件,render 占 5 个 |
| D6 两个接缝都做 | "铺满画布需要 `SurfaceHostController` 几何" | `SurfaceRoot` 向 children 透传的几何是零 |
| D9 铺画布(留边可接受) | "画布会留边露出底色" | 不留边,是两轴独立拉伸失真 |

**三次同一个形状:断言了系统的某个属性,而没打开决定该属性的那段代码。** 这与 `2026-09-13-v2s-base-extraction-review-failure-postmortem-claude.md` 里的 F-1 同源。**本文档后续任何"唯一/零/不存在/必然"的断言,都必须附上检索命令与命中清单。**

### 10.4 两轮对抗审查汇总(六个 fresh 独立盲审)

| 轮 | 维度 | 结论 |
|---|---|---|
| 一 | 事实与可行性 / 归属分层 / 零改动证伪 | NO-GO 2M4S5N · NO-GO 2M4S4N · 部分成立 1M2S3N |
| 二 | 新增设计核验 / 过度设计 / 可实施性 | NO-GO 1M4S3N · NO-GO 3M2S3N · 部分可实施 5M7S5N |

两轮已达规范的硬上限。第二轮 findings 的处置见 §10.2 与各节的撤回段。

### 10.5 Codex 独立复核(NO-GO,5M/6S/3N)的处置

| Codex | 处置 |
|---|---|
| M-01 治理时点未冻结,handler 6 还是 8 | **已冻结**:本批按"治理轮未落地"实施,六条;并给出可机械化的迁移 gate(§3.4.1) |
| M-02 picker 无 actor,撞 TR-12 3a | **需 Dexter 裁决**,见 §11 |
| M-03 mobile 真值表未定义 | **已补**:输入/阈值/未知/Bundle key/方向锁生命周期/主副屏传播/JS 缺失值七项(§5.2.1)。阈值与"未知落 laptop"标注为产品裁决,已给默认取法 |
| M-04 scope 分母三个数字打架 | **已重写为唯一分母,见 §7.0a**。⚠️ 该处置本身在 Codex 第二轮又被抓到残留(此行曾写 9,且漏列 staff-auth 的 description 改动),**现已统一为 4 + 7 = 11**,全文以 §7.0a 为唯一正本 |
| M-05 拓扑 selector 不存在,两批边界未冻结 | **已冻结**:本批只依赖 `readDisplayInfo` + `resolveSecondarySurfaceAvailable` 两个今天就有的导出,不创建也不预留 selector(§3.4) |
| S-01 A2 挡不住 opacity/零尺寸/遮挡/未挂载 | **接受,判据升级为真机截图比对**(§0.4 的两台 VM),静态断言降为辅助(§9) |
| S-02 A1/A3/A4/A5/A8 多为计划文字 | **已细化** A1、A8,并补 A9(§9) |
| S-03 "红色"不可机械判定 | **已给 predicate**:`--color-action` 的 HSL 色相 ∈[340°,20°]、饱和度≥0.4、明度∈[0.25,0.65](§9.2) |
| S-04 TR-04 只有"倾向"不是裁定 | **需 Dexter 裁决**,见 §11 |
| S-05 graph 节点仍是设计意图 | **接受并明写**:§8.2 已标注"以 `src` 实际 import 为准";本文档是需求分析,逐包集合对账属详设/实施阶段义务,不在本文冒充 implementation-ready |
| S-06 失真接受与否是产品判断 | **在 mobile 上保持等比**:Dexter 2026-09-14 临时变更将 integration 画布定为 360×640；mobile VM 物理屏幕 720×1280，`scaleX = scaleY = 2`，不产生非等比失真。laptop 侧(画布 1280×800)残余多少,两台 VM 实测即知 |
| N-01 ".d.ts 只有两处"不成立 | **已收窄**:实测 12 个;准确表述是"`declare module '*.<扩展名>'` 形式只有两处,都是 css"(§1.2b) |
| N-02 waiting/welcome 声明 mobile 不可达 | **已改为 `['laptop']`**,并补 A9 判据(§3.3b、§9) |
| N-03 Metro/许可证/尺寸仍无证据 | **档位已变**:§0.4 的真机使这些成为实施首步的实测项,不再是悬空 UNVERIFIED |

**对 Codex 七条裁决复核的回应**:C1/C2/C3/C4 它判"方向合理但论据需收窄"——接受,相关表述已改为"这是本批的取法"而非"唯一正确";C5/C6/C7 它判需 Dexter 裁决——C6 现按 Dexter 2026-09-14 临时变更执行为 mobile 逻辑画布 360×640、物理屏幕 720×1280 的等比缩放,C5/C7 见 §11。

### 10.6 ⚠️ 全称断言的命中清单(Codex N-01 要求补齐)

§10.3 我自己立了规矩——全称断言必须附检索命令与命中清单——**然后在新写的段落里没执行**。Codex 第二轮点名了这一点。此处补齐本文档全部承重全称断言:

⚠️ **Codex 三轮 S-03 指出这张表本身不合格**:检索式没写 cwd 与分母、一条在 zsh 下直接报错、单行 grep 抓不到多行 import、而且**多数只能支撑"该表达式的命中数",支撑不了它标注的那句全称语义**。全部接受,重写如下——**结论一律收窄到"该精确表达式在该分母下的命中数"**,凡需要结构性保证的改标 UNVERIFIED。

**统一前提**:cwd = `apps/terminal`;分母 = 该 cwd 下的 first-party 源码,**不含 `node_modules`**;glob 一律加引号。

| 断言(已收窄) | 检索式 | 命中 |
|---|---|---|
| 下列表达式在 `ui/feature/*/src/` 与 `ui/integration/*/src/` 零命中:`from 'react-native'` | `grep -rn "from 'react-native'" ui/feature/*/src/ ui/integration/*/src/` | 0。⚠️ **UNVERIFIED 的部分**:多行 import 与双引号写法未覆盖,"该层完全不碰 RN"是**推论** |
| `^import {…} from 'react-native'` 在 `ui/base/*/src/` 的命中 | 同上模式 + 逐个人工排除 `import type` | 11(render 5、input 3、primitives 1、admin-shell 1、dev-host 1) |
| `'mobile'` 字面量在 `assembly/`、`adapter/` 零命中 | `grep -rn "'mobile'" assembly/ adapter/` | 0 |
| `'sample.desk.` / `'sample.auth.` 字面量在各自包外零命中 | `grep -rn "'sample\.desk\.\|'sample\.auth\." ui/integration ui/base kernel assembly adapter`(排除 test) | 0 |
| `declare module '*` 的命中 | `grep -rn "declare module '\*" . --include="*.d.ts"`(**引号必须加,否则 zsh 报 no matches found**) | first-party 2 条,均为 `*.css`;first-party `.d.ts` 共 12 个。⚠️ **不含 `node_modules`**——Vite/Expo 自带的 jpg 声明是否进入本仓 tsconfig 的 `files`/`types`,**UNVERIFIED**,须实施首步实测 |
| `actorDefinitions` 在 `tools/` 生产代码零命中 | `grep -rln "actorDefinitions" tools/` | 仅 1 个测试文件。⚠️ **"无门检查 ui/feature 是否有 actor"是推论**——门可能用别的标识符实现,未穷举 |
| `persistIntent` 在 `tools/` 的命中 | `grep -rln "persistIntent" tools/` | 5 个文件;逐个打开后确认两处实现均为包级硬编码且只判正向。**这条是打开源码核过的,不只是 grep** |

**两条负面断言的处置**(Codex N-01):

| 断言 | 处置 |
|---|---|
| "今天全仓只有一个 `ui/integration`" | 分母可枚举:`ls apps/terminal/ui/integration` ⇒ 仅 `sample-console` 一个目录。**这条可闭合**,因为分母是一个有限目录,不是全文检索 |
| "规范里没有任何一条支撑 U-7" | ⚠️ **保持 UNVERIFIED**。这是负面结论,只靠词语未命中证明不了;我检索的是 `U-7` / 浮层 / layer 恢复三组词,**不排除规范用别的措辞表达了同一意图**。文档据此推进的部分(§3.6 说"U-7 无规范依据")应读作"我未找到",不是"不存在" |

### 10.7 错误模式累计

同一形状在本立项出现过多次,分两类:

**(a) 全称断言未穷举**:语义 token 校验、1:N 是否已验证、唯一 RN 接缝、`.d.ts` 计数。
**(b) 信息不全时抢跑下结论**:把 Dexter 给的 720×1280 记反成 1280×720;在确认按钮需求还没说完时宣布 TR-04 缺口"已消解";把"需要 SurfaceHostController 几何"和"画布会留边"当成既定事实,而两者都可由源码直接证伪。

**(a) 靠 §10.6 的命中清单防;(b) 靠两条:引用 Dexter 原话时逐字回读;任何"已消解/已闭合"的结论,必须等对应需求完整说完再下。**

## 11. 待裁项:已全部关闭

| # | 原待裁项 | 关闭方式 |
|---|---|---|
| 11.1 | picker 没有 actor,撞 TR-12 3a | **Dexter 2026-09-13 裁定**:picker 处理所有用户交互,选择与确认都要 actor,且"选中项与当前一致就不发变更命令"。⇒ 本包有真实 actor 工作(§3.2.2)。**规则无需改动——是我的模型错了,不是 TR-12 3a 有问题** |
| 11.2 | TR-04 反向断言无对象 | **规范已修订**(`terminal-coding-standard.md` TR-04,2026-09-13):反向对象不必同 slice;全字段合法持久时允许只写正向断言并注明;明文禁止为凑断言加无消费者字段。⇒ 本包按新规则收口(§3.1.4) |

### 11.1 本批连带的规范改动(已落地)

两条,均已写入 `doc/platform/terminal-coding-standard.md`:

1. **TR-09 移除"owner 必须至少拥有一个 slice"**。根据:它与 `P-5c` 互斥——`tools/terminal-layering/check-static.mjs:42,55` 禁止 `ui/feature` import `createSlice` 与 `defineStateRuntimeSlice`,分母是全部 `ui/feature`(`:181`),**该层结构上不可能拥有 slice**;而 `sample-staff-auth`/`sample-member-desk` 今天就是 owner + 零 slice 且全门绿。owner 判据改为"拥有 command / actor / slice 中至少一类,并对其负唯一写责"。门那栏同步删掉从未实现的"owner 却零 slice → 红"。
2. **TR-04 澄清 + 欠账上表**。除上表那三条澄清外,把"通用门今天不存在"写在明面上(两处实现都是包级硬编码且只判正向),并加了一句约束:**在通用门建立之前,本规则是 review 判据,不得被当作"不这么写会红"来驱动设计。**

⚠️ **第二条那句是针对我自己的病写的**:本立项里 `hydrationRejected` 字段、`wallpaper-notice` actor 两处发明,都是我拿"不这么写会红"驱动设计的产物,而那两条规则**根本没有门**。
