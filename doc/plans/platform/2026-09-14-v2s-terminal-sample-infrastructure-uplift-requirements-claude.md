# sample 基础设施上收 base · 需求分析(第 2 版)

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Claude
分析稿=2026-09-14-...-sample-infrastructure-uplift-analysis-claude.md(讨论过程见该文)
EVIDENCE_TIER=static;未执行任何构建/测试/安装命令
AUTHORITY=需求分析,不是实施授权
修订=v1 经三轮 fresh 盲审(方案合理性 / 证据核验 / 可实施性与门)全部 NO-GO 或"部分可实施",
    合计 10M/15S/16N。本版逐条 intake,下文用「R-xx」标注被哪条推翻后改写。
裁决=Dexter 2026-09-14 授权全权裁决,三项已裁(§7 汇总);裁决后另做一轮自审,
    修正 7 处因裁决产生的前后矛盾,其中 §3.0 的约束范围是自审新发现、非盲审所提。
```

## 0. 方向与判据

### 0.1 Dexter 的方向(2026-09-14)

> sample(不仅是 integration,还包括 kernel.feature、ui.feature、assembly 等)的目的就是**专注业务**,基础设施都应该上收到 base 中。
>
> 新建 `assembly/base/android`,增加 `expo-splash-screen`。但是要保留 `assembly/android/*` 一定的自主权,比如 app 名称、icon、开机动画内容的定制等等。
>
> 明显跟业务无关的内容,先参数化吧。
>
> 收起时机应该是主屏加载完毕后,其他的你根据最优最长远的方向定,**上收能力,下放配置项**。
>
> (批次)肯定是不同批次。

### 0.2 唯一判据

> **base 提供"怎么做",app 提供"是什么"。**
>
> 换个业务仍然一字不改的流程、时机、校验、接线 ⇒ **能力** ⇒ 上收。
> 每个 App 必然不同的名字、图片、颜色、标识、键值 ⇒ **配置** ⇒ 下放。

**这条判据的力量全部来自"跨业务"三个字**:两个 sample 的业务完全不同(会员登记/工牌登录 vs 壁纸选择),所以"两边仍然一样"才等于"与业务无关"。

⚠️ **但这条判据是单向的,不能反用。** 本轮实测抓到一次真实的假阴性(详见 §3.3 的 `requestOutcome`),据此补一条:

| 观察 | 能推出 | 不能推出 |
|---|---|---|
| 两个业务**都写了**且一字不改 | ✅ 是能力,上收 | —— |
| 第二个业务**没写** | ❌ **什么都推不出** | 不能推出"不是能力" |

**理由**:"没写"有两种成因 —— ① 它换个写法(⇒ 真的与业务相关);② **它根本没行使这个能力**(⇒ 判据从未被检验)。二者在代码里长得一模一样。
⇒ **凡用"第二个业务没有它"做否定论据,必须先证明第二个业务有机会分歧。** 做不到就退回逐个判断,不许用这条判据背书。

### 0.3 证据口径(v1 的首要死因在这里)

v1 自称"下面每一条都是逐行比对结果",而盲审实测推翻三条:

| v1 的断言 | 实测 | 差在哪 |
|---|---|---|
| `platformPorts.ts`「前 33 行逐字相同」 | **前 13 行**,第 14 行即分叉 | 数字是估的 |
| runtime facts / device identity 装配块「只差折行」 | sample2 侧**整块 42 行不存在** | 从"工厂调用两边都有"推到了"整块一样" |
| 排除清单「3 处」 | **4 处**,总计 6 处 | 漏掉 `ui/integration` 那一处,且它是第二种代码形态 |

**本版的纠正办法不是"这次数仔细点",而是换证据形态**:

1. 凡"相同/唯一/零"的断言,**必须附一条任何人可原样复跑的命令**,且断言的真假由**命令退出码或计数**决定,不由我的描述决定;
2. **"逐字相同"一律定义为**:`diff A B` 退出码 0,含缩进与行序;不满足就不许用这个词,改用"语义一致"并说明差异面;
3. 我**没有**逐行比对过的,写 `UNVERIFIED` 并说明未核范围——不再只给某一节打标(v1 只给 §1.4 打了,而真正没核的是 §1.1/§1.2)。

---

## 1. 证据基座

**cwd = `apps/terminal`,分母 = first-party 源码,不含 `node_modules`。**

### 1.1 `assembly/android` 层 (R-证据核验 M1/N1)

两文件 44 / 47 行。**前 13 行逐字相同,第 14 行起分叉。**

真正的上收标的是中间那个接线块,它才逐字相同:

```bash
diff <(sed -n '/^const platformPorts = createPlatformPorts({$/,/^})$/p' \
        assembly/android/sample-terminal/src/assembly/platformPorts.ts) \
     <(sed -n '/^const platformPorts = createPlatformPorts({$/,/^})$/p' \
        assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts)
# 退出码 0;块长 15 行
```

差异面(**5 处**,v1 写 3 处):import 目标、`persistenceKey` 字面量、导出工厂名,**外加** import 书写形态(A 单行 / B 多行)与导出函数体形态(A 块体 / B 简洁箭头体)。后两处是格式漂移,不是语义差异,但按 §0.3 口径不能算进"相同"。

⚠️ **`surfaceHostSourcesByDisplayIndex` 的两行 v1 称"逐字相同",实为缩进不同(6 空格 / 4 空格),按 §0.3 口径不成立。**

### 1.2 `ui/integration` 层 (R-证据核验 M2/S3/N2/N3)

两个 `assembly.tsx`(389 / 313 行)。逐段实测:

| 段 | 实测 | 判定 |
|---|---|---|
| `createStateSource` + `createDispatchCommand` | 逐字相同(仅末行折行),但**位置不同**:sample-console 在 `createSurfaceForDisplayIndex` 之后,wallpaper 在其之前 | 能力 |
| `createSurfaceForDisplayIndex`(两边均 16 行) | 差 2 行:类型名 + 错误消息(不只是前缀:`is not available for` → `is unavailable for`,**正文也漂了**) | 能力 |
| `SurfaceInputFrame`(81 / 75 行) | 相同行 **69/81 ≈ 85%**(v1 称"约 90%") | 能力 |
| runtime facts / device identity 装配块 | ⚠️ **不是"只差折行"** | 见 §2.3 |

```bash
# §1.2 末行的实测依据
for p in startup.runtime-facts sample.runtime-facts-resolved sample.assembly-created \
         startup.device sample.device-identity-resolved createRenderRuntimeFacts; do
  printf '%-34s console=%s wallpaper=%s\n' "$p" \
    "$(grep -c "$p" ui/integration/sample-console/src/assembly/assembly.tsx)" \
    "$(grep -c "$p" ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx)"
done
# createRenderRuntimeFacts 2/2;其余五项全部 1/0
```

**只 sample-console 有**:`sampleAdminTestPart`、`createSampleDefinedParts`、`variables`。
**只 wallpaper 有**:`module.ts`(即 §2.2 的第 4 处排除清单)、`parts`、`moduleKind` 与三个 surface helper 的公共导出。⇒ **两个 console 的公共面不对称**,B1 删 descriptor 在 sample-console 是包内编辑、在 wallpaper 是**公共面移除**,两包不会以同一种方式失败。(R-证据核验 N6)

### 1.3 `ui/feature` 层 (R-证据核验 S2/S4)

| 文件 | 实测 |
|---|---|
| `components/requestOutcome.ts` | member-desk 与 staff-auth 逐字相同(15 行);**wallpaper-picker 没有这个文件**。⚠️ 该"没有"**不是**"换个业务写得不一样" —— picker 的两处 dispatch 都是 `void`,从不分类结果,**判据从未被检验**(§0.2 的假阴性)。裁决见 §3.3 |
| `assembly/assembly.ts` | member-desk 13 行 / picker 13 行归一化后相同;**staff-auth 是 18 行**,多一个 `variables` 字段与两个 type import ⇒ 三包形状**不统一** |
| `application/module.ts` | 62 / 46 / 29 行。`Object.freeze({...})` 的 **key 集合三包完全一致**;差异有三项(v1 写两项):排除清单内容、actor 条数、**commands 条数**(8 / 3 / 2),另 member-desk 与 staff-auth 各带一段两行注释 |

### 1.4 `kernel/feature` 层 —— 本文档最强的一条证据 (R-证据核验 N4)

v1 把这节整体标了 `UNVERIFIED`。**实测后它其实是 §0.2 判据最干净的一次验证**:

```bash
diff kernel/feature/sample-member-registry/src/dependencies.ts \
     kernel/feature/sample-staff-session/src/dependencies.ts   # 退出码 0
```

三个 kernel/feature 包的 `dependencies.ts` **语义完全一致**(均为 `[contracts, runtime, state]` + devDep `[platformPorts]`,各 7 行);前两者逐字相同,`sample-wallpaper` 只差分号风格。

⚠️ **这三个包跨了业务线**(会员登记 + 工牌登录 vs 壁纸),**且三个都真的写了这个文件** —— 所以它是 §0.2 那张表里"两个业务都写了且一字不改"那一行的干净样本,**不依赖任何反向推理**。

与 §1.3 的 `requestOutcome` 形成的对照不是"一个过一个不过"(那是本文档上一版的错判),而是:**这里的证据是正向的,那里的证据是反向的,而 §0.2 只支持正向。**

`moduleName.ts` 两边各 2 行,只差模块名字面量。

---

## 2. 实测缺陷(不是重复,是复制已经造成的真实损害)

### 2.1 🔴 sample2 的 startup 诊断永远不会完成 —— 已落盘的运行期事实

**v1 把这条写成静态推论。仓内早有真实运行输出可以直接锚定:**

```bash
for f in ui/integration/sample-console/.expo/dev/logs/start.log \
         ui/integration/sample-wallpaper-console/.expo/dev/logs/start.log; do
  echo "$f  surfaces=$(grep -c 'startup.surfaces' $f)" \
       " kind=$(grep -o 'kind' $f | wc -l)" \
       " complete=$(grep -c 'startup.complete' $f)"
done
```

| 日志 | `startup.surfaces` | 出现 `kind` | `startup.complete` |
|---|---|---|---|
| sample-console | 177 | **179** | **58** |
| sample-wallpaper-console | 16 | **0** | **0** |

**sample2 跑起来了、打了 16 条 surface 日志、一条 `startup.complete` 都没有。** 这不是"将来可能出问题",是已经坏掉的。

写入端契约字段在复制中丢失:

| 字段 | sample-console | sample-wallpaper-console |
|---|---|---|
| `startup.surfaces.declared` 的 `kind` | `kind: 'declared'`(`:121`) | **无**,被 `source:` 顶替(`:97`) |
| `startup.surfaces.measured` 的 `kind` | `kind: 'measured'`(`:142`) | **无**(`:117`) |

消费者在 `kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`:`:102` `readSurfaceKind` 只认 `kind ∈ {'declared','measured'}`;`:111-121` `recordStartupSuccess` **仅当 `displayMode !== undefined && kind !== undefined`** 才写 `tracker.surfaces`;`:107-109` `allStartupGroupsCompleted` 要求 `surfaces.some(s => s.declared && s.measured)`;`:125-138` 是 `startup.complete` 的唯一写入点。

另:`sampleSource`(`sample-console:103`)全仓只出现一次、无消费者,同一次复制改歪的另一处。

⚠️ **两个 console 建立前后不到一天,复制体已丢掉一个 kernel/base 消费者依赖的契约字段,零门抓到** —— 该契约今天只存在于读取端,写入端靠人记得。

### 2.2 🔴 运行期模块依赖的排除清单是每包手工维护的 (R-证据核验 M3/S1)

**根因(v1 写错了)**:各包 `dependencies.ts` 的 `dependencyModuleNames` 同时被当作 workspace 依赖与运行期模块依赖,而**只有一部分 base 包真的注册运行期模块**(至少 `kernel.base.runtime`、`kernel.base.display-context`、`kernel.base.ui-state` 三个;v1 写"只有两个",漏了 ui-state——它 `moduleKind = 'owner'`,且出现在两个 console 的 `modules` 数组里)。`resolveModuleOrder.ts:38-43` 对找不到注册模块的**必需**依赖直接 throw。

于是每包手抄一份排除清单。**实测 4 处**(v1 写 3 处),三次独立检索、两种工具、两个 scope 一致:

| 包 | 代码形态 | 排除内容 |
|---|---|---|
| `ui/feature/sample-member-desk:35` | 链式 `&&` | render、primitives、input |
| `ui/feature/sample-staff-auth:22` | 链式 `&&` | **同上三个(集合相同,仅书写顺序不同)** |
| `ui/feature/sample-wallpaper-picker:12` | 链式 `&&` | render、primitives(其 `dependencies.ts` 本就没有 input) |
| **`ui/integration/sample-wallpaper-console:6`** | **数组 `.includes`** | render、primitives、input、**admin-shell** |

⚠️ v1 正文写"**且内容各不相同**",而 v1 自己的表格写 staff-auth"同上三个" —— **自相矛盾**。实测:前两者集合相同,只有后两者真的不同,**且已经长出了第二种代码形态**。

另有 2 处伪造 descriptor(`baseModuleDescriptors.ts`,两个 console 各一,24 / 17 行,descriptor 列表语义一致)。

⚠️ **第 4 处落在 `ui/integration`,这不是漂移,是治理轮的进度差**:`sample-console/src/application/` 下**没有 `module.ts`** —— 它不把自己注册成运行期模块;`sample-wallpaper-console` 有(带 `createWallpaperConsolePlacementActor`)。治理轮要做的正是「sample-console 要有 actor 和 slice」,而 sample2 建于治理轮设计定稿之后,**它已经是治理后的形态,sample-console 还停在治理前**。
⇒ B1 的契约修复必须同时覆盖「**integration 也可能是运行期模块**」这一形态,不能只按 `ui/feature` 设计。
⇒ 批次边界受此影响,见 §4。

⚠️ **这个缺口会自我复制**:2026-09-13 记为 3 处,新增一个 sample 后是 **4 + 2 = 6 处**(v1 写 5)。

### 2.3 🔴 sample2 缺失整块启动诊断装配 —— 与 §2.1 同类,v1 误判为"折行" (R-证据核验 M2)

§1.2 实测:`startup.runtime-facts`、`sample.runtime-facts-resolved`、`sample.assembly-created`、`startup.device`、`sample.device-identity-resolved` **五项在 sample2 侧全部为 0**。

⚠️ 按 §0.3 口径校正措辞:这**不是一个连续块**,而是 sample-console 侧**三处分散的诊断发射**(`:246` runtime-facts、`:304` assembly-created、`:318` device),sample2 侧三处全无。盲审测得合计约 42 行,**该行数我本会话未复算**,故本文档只主张「三处发射全部缺失」这一由上面 grep 计数直接支撑的事实。

**影响范围(推论,非仓内事实)**:这两个 category 都不在 `createPlatformPorts.ts:23-30` 的 `STARTUP_GROUPS` 里,所以**不**影响启动完成判定;损害是可观测性。

⚠️ **但它与 §2.1 是同一种病**(复制过程丢诊断),而 v1 一边宣称把这类缺陷找全、一边在隔壁段落把它判成折行。**这正是"骨架靠人抄"的代价——同一次复制丢了两样东西,一样是契约字段,一样是整块装配。**

---

## 3. 归属划线

### 3.0 硬约束:新 base 包不得反向依赖业务 (R-方案合理性 F-1 + 自审扩范围)

`tools/terminal-layering/check-static.mjs:135-140` 的 `isInvalidDirection` 对 `fromLayer === 'assembly'` **直接 `return false`** —— **assembly 层的出边零方向约束**。adapter 有约束(`check-static.mjs:304-305` 只许依赖 `kernel.base.platform-ports`),assembly 没有。

⇒ 若 `assembly/base/android` 为了工厂返回类型 import 两个 integration,`dependency-declaration-completeness` 会**强制**把它们写进 `package.json`,**两个 App 从此各自传递性依赖对方的全部业务树,而且全绿**。

**两个新包都有这个洞,而且成因不同**(自审补:上一版只写了 assembly):

| 新包 | 为什么没门挡 |
|---|---|
| `assembly.base.android` | `isInvalidDirection` 对 `fromLayer === 'assembly'` **恒返回 `false`**,出边零方向约束 |
| `ui.base.console-assembly` | `workspaceLayer`(`check-static.mjs:113-120`)只按包名前缀分 `kernel-`/`ui-`/`adapter-`/`assembly-` **四层**,**在 ui 层内部分不出 base 与 integration** ⇒ `ui→ui` 落到 `isInvalidDirection` 最后一行 `return false` |

⚠️ **后者风险更高**:骨架包天然想 import console 的类型,而 `ui/base → ui/integration` 今天写了不会红。

**因此本立项必须自带这条约束**:两个新包的依赖集合**均不得包含任何 `ui.integration.*`**;integration 工厂与 console 类型由调用方注入,base 侧只认结构化类型。判据见 U11。

⚠️ 现有 layering 门对这两条**一条都不保护**(P-5a 会把新包收进分母,但方向判定放行;P-5c/P-5d/P-10 的分母不含 assembly 层,也不区分 ui 层内部)。

### 3.1 `assembly` 层 (R-可实施性 M-3/S-4,R-证据核验 S5)

**为什么这个包必须存在** —— v1 的理由是"88 行重复",不成立(单论 88 行,新增永久包要付出多一个 graph 节点、census 条目、assembly 从两级变三级的代价)。**真正的理由是 splash 生命周期在本仓没有第二个合法家**:`adapter/*` 只能依赖 `platform-ports`,`ui/*` 不能依赖 `adapter/*`,而 splash 的 hide 时机必须同时知道原生 splash 句柄与 PRIMARY surface 挂载事件。**这个能力无处可放,才是建包的理由。**

| 上收 `assembly/base/android`(能力) | 留 `assembly/android/<app>`(配置) |
|---|---|
| **3 个已接线 adapter** 的接线:persist-kv(plain+protected)、device、dual-screen | `app.json` 的 `expo.name` / `slug` |
| `surfaceHostSourcesByDisplayIndex` 组装(`{0:PRIMARY, 1:SECONDARY}`) | `assets/` 图片(分母见 U7) |
| **splash 生命周期控制**(本包存在的理由) | `android/` 原生工程的身份四处(见 U6) |
| `createPlatformPorts` 的 unavailable-port 填充 | `persistenceKey` 字面量 |
| Metro / babel / NativeWind 共享 preset | 注入哪个 integration 工厂 |
| 身份一致性与 assets 存在性的静态校验 | `tailwind.config.cjs`(主题取值) |

⚠️ **v1 写"全部 adapter 接线"是错的。** 实测只接了 3 个:`appControl` 绑 `unavailableAppControlPort`、`logger` 绑 `consoleLoggerBinding`,两者都来自 platform-ports。而 `adapter-android-app-control` 与 `adapter-android-logger` **只活在 `dependencies.ts` 的账本 import 里,没有任何真实接线** —— 照 v1 搬,base 的 `source imports == declared` 对不上,只能再抄一份死账本(正是本立项要消除的形态)。**这两条死声明的去留单列为 §4 B2 的一项。**

⚠️ **`App.tsx` 与 `src/assembly/platformPorts.ts` 必须留在每个 App**(v1 写"App.tsx 骨架上收",与门直接冲突):`check-static.mjs:170-202` 硬编码要求两个 assembly 各有 `index.ts` + `App.tsx` + `src/assembly/platformPorts.ts` 三个文件,且 `index.ts` 必须运行期 import `./App`、`App.tsx` 必须运行期 import `./src/assembly/platformPorts`。**正确形态是:两个薄壳留在 App,base 出的是被薄壳调用的工厂。**
附带缺口:`assembly.base.android` 不在那个硬编码二元组里,**拿不到任何 entry 可达性校验**,将来第三个 App 也不会被自动纳入 ⇒ 见 §4 B2。

⚠️ **splash 的真实配置面不是 `app.json`**(v1 写"留 `app.json` 的 `splash` 配置",而**两个 `app.json` 都没有这个键**):
- `expo-splash-screen` 在 `yarn.lock` **零命中**,是全新 JS 依赖;
- 但**原生侧两个 App 都已预构建并提交**:`MainActivity.kt:17` 注释原文 `// This is required for expo-splash-screen.`、`AndroidManifest.xml:19` 的 `android:theme="@style/Theme.App.SplashScreen"`、`styles.xml` 的 `Theme.App.SplashScreen`(`windowBackground=@drawable/splashscreen_logo`)、5 档 `drawable-*/splashscreen_logo.png`。

⇒ 缺的只是 **JS 包 + autolinking**,原生脚手架不必重做。实施者若按 v1 去 `app.json` 加 `splash`,**原生主题照旧读 drawable,改了等于没改且不报错**。

#### splash 配置面裁决:保持 `android/` 原生资源,**不引入 config plugin**

实测两个 App 的原生 splash 资源**完全对称,且已经是按 App 定制的**:各 5 档 `drawable-*/splashscreen_logo.png` + `values/colors.xml` 的 `splashscreen_background`(现均为 `#FFFFFF`)+ `values/styles.xml` 的 `Theme.App.SplashScreen`。

三条理由:

1. **它已经就是 Dexter 要保留的那份自主权。** "开机动画内容的定制"落地形态就是这 5 张图 + 1 个背景色,**已经按 App 分开且可改**。再加一套 plugin 配置,等于给同一件事造第二个入口。
2. **plugin 只在 `expo prebuild` 生效,而 `android/` 是已提交的。** 走 plugin 要么不生效,要么一次 prebuild 覆盖掉手维护的原生文件 —— 这正是仓内架构原则明令禁止的兼容层/fallback 形态。
3. **`expo-splash-screen` 这个 JS 包仍然要装,但只为 `hideAsync()`** —— 即"收起时机"这个真正要上收的能力。它的**配置面一概不用**。

⇒ 于是划线干净地落在 Dexter 那句"上收能力,下放配置项"上:

| 能力(上收 `assembly/base/android`) | 配置(留各 App) |
|---|---|
| `expo-splash-screen` 依赖与 autolinking | `drawable-*/splashscreen_logo.png` 5 档 |
| `hideAsync()` 的调用时机(§3.4) | `colors.xml` 的 `splashscreen_background` |
| —— | `styles.xml` 的 `Theme.App.SplashScreen` |

✅ **本裁决顺带消掉了两个连带问题**:①`app.json` 不引用任何 splash 图 ⇒ WP 的 `assets/README.md` 既有裁定("不把未被 `app.json` 引用的 splash 资产计入本清单")**原样继续有效,不必重审**;② ST 的孤儿 `assets/splash-icon.png` 应**删除** —— 真正的 splash 资产是 `android/.../drawable-*/splashscreen_logo.png`,该文件从来没被任何东西引用,删掉后两个 App 的 `assets/` 也就不再分叉。

~~`UNVERIFIED`:顶层 `expo.splash` 在当前 SDK 是否仍被读取~~ ⇒ **本裁决使该问题不再相关**:我们不使用 `app.json` 的任何 splash 键。

⚠️ **不做 `android/` 模板** —— 模板是把配置也复制一份,正是要消除的形态。撞名与缺图由**校验**兜。

### 3.2 `ui/integration` 层 (R-方案合理性 F-2/F-6)

⚠️ **目标包必须点名。** integration 骨架(~250 行 × 2,本立项最大的一块)**不能**落在 `assembly/base/android`:`isInvalidDirection` 判 `ui → assembly` 非法。它只能落在 **`ui/base/` 下的一个新包。裁决:`ui/base/console-assembly`**(moduleName `ui.base.console-assembly`,包名 `@catering-v2s/ui-base-console-assembly`) —— 本文档不再留"随实施裁定"的口子,否则 §4.1 的建包清单与 U11 的结构判据都没有确定的主语。v1 通篇未点名目标,读者接着 §0.1 的"新建 assembly/base/android"顺下来必然读错。

| 上收(能力) | 留各 console(配置/业务) |
|---|---|
| `createStateSource` / `createDispatchCommand` | placement actor(跨 service 的决定) |
| `createSurfaceForDisplayIndex`(**含错误消息文案**) | 各自的 parts / variables / kernel modules |
| runtime facts / device identity 装配(§2.3 的 42 行) | `moduleName` / `persistenceKey` |
| `SurfaceInputFrame` + **统一的诊断字段契约**(§2.1) | `surfaceChildren`(壁纸背景这类) |
| host source 解析与缓存 | 注入哪些 kernel module |
| **`hostSourceAttached` 的计算** | —— |
| 装配流程骨架 | —— |

⚠️ **`hostSourceAttached` 是能力不是配置(v1 放错列)**:它在 `assembly.tsx:353` / `:378` 由骨架自己算(`input.surfaceHostSourcesByDisplayIndex?.[surface.displayIndex] !== undefined`),**根本不由 App 传入**。下放成参数,调用方就能在没挂 host source 时传 `true`,**让诊断当场说谎**。

⚠️ **TR-13 与 `renderContentFrame` 的冲突**:v1 既把 `renderContentFrame`(AdminLauncher 等 chrome)放进"留各 console",又要求骨架默认接入 admin console —— 二者不能同真。**本版裁定:admin console 接入由骨架无条件负责,`renderContentFrame` 只承载业务 chrome。** 判据见 U9。

### 3.3 `ui/feature` 层 (R-证据核验 S2)

**上收**:`module.ts` 的组装骨架(§2.2 的排除清单就在里面)、`assembly.ts` 的形状、**`requestOutcome.ts` ⇒ `ui/base/render`**。
**留下**:commands、actors、parts、components —— 全是业务。

#### `requestOutcome` 裁决:上收(推翻本文档上一版的建议)

上一版据 §0.2 判它"未跨业务、不上收"。**该判断错了,错在把"第二个业务没有它"当成了否定证据** —— 正是 §0.2 新补的那条假阴性:

```bash
grep -n "dispatchWithRequestId" ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx
# :48 和 :57 —— 两处都是 `void dispatchWithRequestId({...})`
```

**picker 确实 dispatch 了 command,但用 `void` 把结果整个丢掉,从不分类。** 所以它没有 `requestOutcome.ts`,不是"换个业务会写得不一样",而是**它根本没处理失败** —— 判据从未被检验。

去掉这个伪证据后,真实理由只剩两条,且都成立:

1. **它是 kernel 契约类型上的纯函数**。`classifyRequestResult` 入参是 `CommandDispatchResult`(来自 `kernel-base-runtime`),按 `error.category` 是否属于 `{AUTHENTICATION, BUSINESS, VALIDATION}` 分四档。这些是**内核级错误类目,不是业务类目** —— 教科书式的"怎么做"。
2. **dispatch 侧早就在 base,只有分类侧留在 feature**。`ui/base/render/src/index.ts:50` 已导出 `dispatchWithRequestId`、`:58` 已导出 `useDispatchCommand`。这是个**已经收了一半的接缝**,把分类侧留在外面才是不一致。

⇒ 目标包 **`ui/base/render`**(与它的 dispatch 侧对侧同址),消费者 4 处(member-desk 3 + staff-auth 1)改 import。

⚠️ **附带发现,不在本立项范围**:picker 两处 `void` 掉 dispatch 结果 ⇒ **确认壁纸失败时用户看不到任何反馈**。这是 sample2 的实现缺陷,当前 sample2 在 Codex 手上,**单独告知,不并入本立项**。

⚠️ `moduleName.ts` / `index.ts` 这类样板不收(Dexter 2026-09-14 裁定)。

### 3.4 splash 时机(Dexter 裁定)

> **主屏加载完毕后。**

(splash 的**配置面**归属见 §3.1 的裁决;本节只管**时机**。)

即 **PRIMARY surface 首次挂载完成**时 `hideAsync()`,不是 `runtime.start()` 返回即收。双屏下**只看 PRIMARY**,副屏挂载与否不影响。

---

## 4. 范围与批次

Dexter 裁定:合成一个立项,内部按改动落点分批次。

⚠️ **B1 与 B3 在 `ui/integration/*/src/application/` 上不可避免地重叠**(v1 写「互不重叠」是错的):6 处缺口里,**第 4 处 filter 与 2 处 descriptor 全在 `ui/integration`**,即 B3 的落点。故本版明确:**B1 只改契约机制与 3 处 `ui/feature` filter;`ui/integration` 侧那 3 处随 B3 一并清除;U1 的验收点在 B3 收口,不在 B1 收口。** 否则 B1 做完跑 U1 必红,而实施者不知道残留在哪。

⚠️ **本文档用「B1…B4」指实施批次,与 `skeleton-graph.ts` 节点的 `batch` 字段无关** —— 后者 `graph-model.mjs:128` 只接受 `1 | 2`,写 3 即 throw,且错误措辞与批次无关。(R-可实施性 N-1)

⚠️ **治理轮的范围规则退役**:治理轮 §0.2 曾规定"本轮不新增、不修改任何 base 包的公共面",而 B3 的本体就是修改 base 公共面。**Dexter 已裁定合并,故该范围规则随治理轮一并并入本立项,不再生效。** (R-方案合理性 F-7)

| 批次 | 落点 | 顺序理由 |
|---|---|---|
| **B1** | 拆开 workspace 依赖与运行期模块依赖(**须同时支持 integration 自身即运行期模块**);删 `ui/feature` 的 **3 处**排除清单 | 后续每批都要声明依赖;缺口还在则新包继续复制这个形态。**U1 不在本批收口** |
| **B2** | 新建 `assembly/base/android`;两个 `assembly/android/*` 收缩到薄壳 + 配置 | 见下方建包清单 |
| **B3** | 新建 `ui/base/console-assembly`;两个 console 收缩(含 §2.1 / §2.3 修复);**清除 `ui/integration` 侧残留的 1 处 filter + 2 处 descriptor**;sample-console 补齐治理轮形态 | 最大一块;并入治理轮。**U1 在本批收口** |
| **B4** | `ui/feature` 的 `module.ts` / `assembly.ts` 骨架上收;**`requestOutcome.ts` 迁入 `ui/base/render`,4 处消费者改 import**(§3.3) | 依赖 B1(排除清单就在 `module.ts` 里);`requestOutcome` 落在既有包,不新增节点 |

⚠️ **v1 的 B1 排序理由不成立**(R-可实施性 S5):v1 说"`assembly/base/android` 本身要声明依赖,缺口还在则它成为下一处复制"。实测 `assembly/android/sample-terminal/src/` 下**没有 `application/module.ts`,也没有任何 `runtimeModuleDependencies`**(4 处命中全在 `ui/` 下)——**assembly 层从来不是运行期模块,不需要排除清单**。B1 该最前的真实理由是上表那条。

⚠️ **B1 在两个 console 上不对称**(R-证据核验 N6):删 descriptor 在 sample-console 是包内编辑,在 wallpaper 是**公共面移除**(`index.ts:6` 导出了 `createBaseModuleDescriptors`),`packageSurface` 测试会在一侧红、另一侧不红。

### 4.1 建包清单 —— 缺一即门红 (R-可实施性 M-1/M-2/M-3/M-4)

⚠️ **本清单跨 B2 与 B3**:`assembly.base.android` 在 B2 建,`ui.base.console-assembly` 在 B3 建。下列各条注明适用批次。

1. **root `package.json` 的 `workspaces` 增 `apps/terminal/assembly/base/*`** —— 该字段是**逐层枚举不是通配**,现有七条里没有 assembly/base。不补则:新包不是 workspace ⇒ 两个 App 的 `workspace:*` 解析失败;且 `verify.mjs:213` 把 turbo dry-run 实际包列表与 graph 投影的 `expectedTaskOwners` 做**集合相等**,新节点进 graph 却不在 workspaces ⇒ `missing=[...]`,**报错指向 turbo,根因在 workspaces,排错方向会被带偏**。
2. **本立项新增的是 2 个节点,不是 1 个**(`assembly.base.android` 与 §3.2 的 `ui.base.console-assembly`)。**裁决:两个都写 `batch: 1`。**

   理由:`skeleton-graph.ts` 里两个 `assembly.android.*` 节点、`ui.base.render`、`ui.integration.sample-console` **全都是 `batch: 1`**,而这两个新包是它们的**依赖**。`projectSkeletonGraph:169` 对投影外的依赖是 `.filter()` 静默丢弃、不抛错,所以写 2 不会当场炸 —— 但 batch-1 投影里会出现"消费者在、被依赖者不在"的悬空形态,`runGraphComparison` 拿它和真实 `package.json` 比会对不上。**依赖排在消费者之后,语义本身就是反的。**

   ⇒ **硬编码计数要改两次,不是一次** —— 两个包分属 B2 与 B3,每次各 +1:

   | 批次 | `check-static.mjs:285-286` | `check-static.test.mjs:23` | `:24`(batch one) | `:25` |
   |---|---|---|---|---|
   | B2 后 | 31→**32** | 31→**32** | 16→**17** | 31→**32** |
   | B3 后 | 32→**33** | 32→**33** | 17→**18** | 32→**33** |

   ⚠️ 若实施时把两个包并到同一批建,则一次改到 33/18 —— **但批次表当前是分开的,按分开算**。
3. **建包五件套**,**两个新包各做一遍**,缺一门红:`src/moduleName.ts` 导出字面量(`'assembly.base.android'` / `'ui.base.console-assembly'`);`package.json.name` 对应(`@catering-v2s/assembly-base-android` / `@catering-v2s/ui-base-console-assembly`)且**不得**带 `plannedKind`/`kind` 字段;`terminal-invariants.json`;`typecheck` script(`verify.mjs` 对 typecheck 恒定 OWNED,缺 script 即报 `invariant owns typecheck but package script is missing`);`src/dependencies.ts` 的 import 集合与 `package.json` workspace 依赖集合**逐项相等**。

   ⚠️ `ui/base/*` **已在 root `workspaces` 里**,所以第 1 条只对 `assembly/base/*` 适用;但第 2、3 条两个包都要做。`ui.base.console-assembly` 的建包落在 **B3**,不是 B2。
4. **把 `runAssemblyEntryReachability` 的硬编码二元组改成 `assembly/android/*` 全量枚举** —— 否则新 App 永远不进这个门。
5. **新建 assembly 身份/资产校验器并接进 `verify-static`,自带红夹具** —— 现有全部 terminal 门**没有任何一个**读 `app.json` / `build.gradle` / `assets/*.png`。
6. **身份权威源裁决:`app.json` 的 `expo.android.package` 为唯一 source**,`build.gradle` 的 `namespace` / `applicationId`、Kotlin 包目录三处由校验器比对一致性,不一致即红。
   理由:`app.json` 是四处里唯一**不由 prebuild 生成**的那个 —— 另外三处都是 `expo prebuild` 的产物,以产物为权威会在下次 prebuild 时被推翻。
   ⚠️ 顺带:`sample-terminal` 四处身份**全是 `com.anonymous.sampleterminal`**,即 Expo 脚手架原样未改的默认值。是否随本立项改名 **不在本立项范围**(会动 Kotlin 包目录与已提交原生工程),单独登记。
7. **处置 `adapter-android-app-control` / `adapter-android-logger` 两条死声明**(§3.1)。
8. **删除 ST 的孤儿 `assets/splash-icon.png`** —— 依 §3.1 的 splash 裁决,`app.json` 不引用任何 splash 图,该文件无任何引用方;删后两个 App 的 `assets/` 不再分叉,WP 的 `assets/README.md` 既有裁定原样有效。

⚠️ **判据的执行体必须随批次产出,不能只写在 §5 里。** 实测:`tools/` 下对 `runtimeModuleDependencies` / `baseModuleDescriptors` **零命中**,也没有任何门读 `app.json` / `build.gradle` / `assets/*.png`。本版判据的执行载体:

| 判据 | 载体 | 产出批次 |
|---|---|---|
| U1 / U2 / U3 / U4 / U8 / U9(行为半) / U10 | **真实冷启动 + 焦点测试**,不需要新门 | 各自批次 |
| U5 / U11 | 结构断言,复用 `check-static` 已有的依赖集合 | B2 / B3 |
| **U6 / U7** | **必须新建 assembly 身份/资产校验器并接进 `verify-static`,自带红夹具** | **B2** |
| U9(结构半:`AdminLauncher` 构造点为 1) | 结构断言 | B3 |

---

## 5. 验收判据

⚠️ **判据必须可证伪,且必须扛得住"恶意但合规"的实现。** v1 十条里六条可被绕过(R-证据核验 M4),本版把标识符计数、文件名计数、行数计数**全部换成行为或结构判据**。

| # | 判据 | 怎么判 |
|---|---|---|
| U1 | 契约缺口消失(**B3 收口**) | **行为**:把全部 4 处 filter 与 2 处 descriptor 删光,**两个 App 均冷启动成功**。<br>⚠️ v1 用「全仓 `grep` 命中数为 0」—— 改个标识符名就全绿,是 CLAUDE.md 明令禁止的关键词伪 checker;且 `tools/` 下**今天没有任何门在数这两个符号**,该判据连执行体都不存在 |
| U2 | 加依赖不再需要手工同步 | **红夹具(三文件同步变异)**:给 picker 的 `dependencies.ts` + `package.json` + `skeleton-graph.ts` 同步加 `ui.base.input`,**真实冷启动**不得抛 `Missing required runtime module dependency`。**反作弊**:同一夹具下把依赖改指一个**不存在**的模块名,启动**必须**抛 —— 证明门还活着。<br>⚠️ 不得通过把依赖标 `optional: true` 达成:`resolveModuleOrder.ts:40` 会直接 `continue`,**判据绿了而整个缺失依赖门被静默关掉** |
| U3 | 诊断契约只有一处写入端 | **行为**:两个 App 冷启动日志中,`declared` 与 `measured` 齐备的 surface 数 **> 0**(今天 sample2 是 0)。**红夹具**:在骨架的写入点删掉 `kind`,**两个 App 都必须红**(证明是同一个写入端) |
| U4 | §2.1 的缺陷已修 | **行为**:sample2 冷启动日志中 `startup.complete` 出现次数 **> 0**(今天 0,sample1 是 58)。<br>⚠️ v1 要求断言 `allStartupGroupsCompleted` —— 它在 `createPlatformPorts.ts:107` 是**模块私有 const**,全文件只导出 `describePlatformPortCapabilities` 与 `createPlatformPorts`,**按公有面写不出这个测试** |
| U5 | assembly 收缩到配置 | **结构**:两个 `assembly/android/*` 的 `package.json` 依赖集合**与** `skeleton-graph.ts` 节点依赖集合均不含任何 `adapter.*`。(v1 用"`platformPorts.ts` 不超过 10 行" —— 把接线搬到同目录 `adapters.ts` 再 import 即可绕过) |
| U6 | 身份撞名可被抓住 | **红夹具 ×2**:① 把新 App 的 `applicationId` 改成与既有 App 相同 ⇒ 必须红;② 只改四处身份中的**一处**使之互不一致 ⇒ 必须红 |
| U7 | assets 缺失可被抓住 | **红夹具 ×2**:① 删掉 `app.json` 引用的一个 PNG ⇒ 必须红;② `app.json` 引用一个不存在的 PNG ⇒ 必须红。<br>⚠️ **分母必须与既有裁定对齐**:`sample-wallpaper-terminal/assets/README.md` 白纸黑字"不把未被 `app.json` 引用的 splash 资产计入本清单",且逐文件登记了尺寸与 SHA-256。依 §3.1 的 splash 裁决(`app.json` 不引用任何 splash 图),**这条裁定原样继续有效**,分母就是"`app.json` 引用的 PNG";ST 的孤儿 `splash-icon.png` 随 §4.1 第 8 条删除,分叉一并消掉 |
| U8 | splash 时机正确 | **行为**:PRIMARY 首帧挂载前 splash 在、挂载后消失。**红夹具**:把 `hideAsync` 提前到 `runtime.start()` 返回处 ⇒ 判据必须红 |
| U9 | TR-13 不可漏配 | **行为**:新建一个**不传任何 admin 相关参数**的 console,冷启动后 admin 入口可达(可点击进入)。**结构**:全仓 `AdminLauncher` 构造点为 **1**。<br>⚠️ v1 写"骨架必须仍接入(**或校验红**)" —— 括号是逃逸口,允许用关键词 checker 顶替真实接入;且 TR-13 明写"不新增独立 skeleton/layering 机器门,也不把包名硬编码进工具",v1 的 U9 正在新增一个 |
| U10 | 既有两个 App 行为不变 | 两个 App 的完整旅途回归,**含冷重启**;每步断言 partKey 与 state,不接受成功文本 |
| **U11** | **新 base 包不反向依赖业务**(§3.0) | **结构**:`assembly.base.android` 与 `ui/base/console-assembly` 的依赖集合均不含任何 `ui.integration.*`。**红夹具**:让 base 包 import 一个 integration ⇒ 必须红(**今天不会红**,需随本立项新增该约束) |

---

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| `moduleName.ts` / `index.ts` 等样板上收 | Dexter 2026-09-14 裁定;收益低于每包多一层间接的代价 |
| `android/` 原生工程模板 | 模板复制配置,与本立项方向相反;撞名与缺图由校验兜 |
| theme 取值上收 | `sample-console/README.md:19,44` 既有裁定:主题属 integration,不建共享 theme 包 |
| splash 的 `app.json` / config plugin 配置面 | §3.1 裁决:配置面就是 `android/` 原生资源;再造一个入口违背本立项方向 |
| `sample-terminal` 的身份改名(`com.anonymous.*`) | 会动 Kotlin 包目录与已提交原生工程,与本立项无因果;单独登记(§4.1 第 6 条) |
| 修 picker `void` 掉 dispatch 结果这个缺陷 | sample2 实现缺陷,当前在 Codex 手上;单独告知(§3.3) |
| 为"未来更多 sample"预建扩展点 | 按 §0.2,上收标的必须有**正向**证据(真实存在且一字不改),不接受"将来大概会一样"这类推测 |
| 修 §2.3 的 42 行诊断缺失**之外**的可观测性建设 | 本立项只把 sample2 拉齐到 sample1,不新增诊断面 |

---

## 7. 授权边界与未核范围

需求分析,**不是实施授权**。本会话未执行任何构建/测试/安装命令,未修改任何源码(本文件除外)。

**`UNVERIFIED` 清单**(按 §0.3,只列真正没核的):

| 项 | 未核内容 |
|---|---|
| `App.tsx` 内容比对 | 两边各 58 行,**只数了行数,未逐行比对**;§3.1 判"薄壳留在 App"依据的是门的硬约束,不是这个比对 |
| Metro / babel / NativeWind preset 的实际差异 | §3.1 列入上收,但 §1 无比对。⚠️ 另需注意:这类根目录文件**天然不进包图**(`graph-model.mjs:270-279` 只走 `src/` 与 `test-expo/` 的 `.ts/.tsx`),门看不见它们的 `require()` 接线 |
| §1.2 的 `SurfaceInputFrame` 85% 相同 | 相同行 69/81 为盲审实测,我本会话未复算 |
| §2.3 缺失诊断的**行数** | 「约 42 行」为盲审实测;我复核的是三处发射的**存在性**(grep 计数 1/0),未复算行数 |

**待裁决项:无。** Dexter 2026-09-14 授权"全部由你根据最优最长远的方向来裁决",三项已裁并写入正文:

| # | 裁决 | 落点 |
|---|---|---|
| ① | `requestOutcome` **上收**至 `ui/base/render`(推翻本文档上一版建议,原建议建立在 §0.2 的一次假阴性上) | §3.3 |
| ② | splash 配置面 = **`android/` 原生资源**,不引 config plugin;JS 包只为 `hideAsync()` 时机 | §3.1 |
| ③ | 两个新节点**都写 `batch: 1`**;硬编码计数**分两次改**(B2、B3 各 +1),终值 **33 / 18** | §4.1 第 2 条 |

附带裁决:身份权威源 = `app.json` 的 `expo.android.package`(§4.1 第 6 条);ST 孤儿 `assets/splash-icon.png` 删除(§4.1 第 8 条)。

⚠️ 三项裁决均由我做出,**不是 Dexter 的原始意图陈述**。若与他的判断不合,改动面均为局部:① 改 §3.3 一节 + §6 一行;② 改 §3.1 一节 + U7 一行;③ 改 §4.1 第 2 条四个数字。
