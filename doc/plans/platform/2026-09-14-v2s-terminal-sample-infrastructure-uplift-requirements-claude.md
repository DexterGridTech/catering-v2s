# sample 基础设施上收 base · 需求分析(第 3.7 版)

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Claude
分析稿=doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-analysis-claude.md
EVIDENCE_TIER=static;作者会话未执行构建/测试/安装/设备命令;外部事实引 Expo 官方文档与 expo-splash-screen 包 README(sdk-57)
AUTHORITY=需求分析,不是实施授权;下一步是详设
修订史=v1 三轮 fresh 盲审 10M/15S/16N → v2;v2 经 Codex 独立评审 NO-GO 3M/10S/4N → v3(§9 逐条 intake)
      → v3.1:Dexter 2026-09-14 裁定 sample2 picker 丢弃派发结果的缺陷并入本批次(§3.5、B4、U13、D-14)
      → v3.2:Codex 对 v3 复评 NO-GO 2M/6S/3N,逐条处置见 §9;该复评的对象是 v3,v3.1 新增的 §3.5、U13、D-14 未经评审
      → v3.3:Codex 对 v3.2 复评 NO-GO 2M/4S/3N(§3.5 首次经评审),逐条处置见 §9
      → v3.4:Claude 对详设与 B1–B4 实施计划做独立评审(5 个 fresh 子 agent 分维度盲审),
        NO-GO 9M/22S/12N,挖出本稿事实错误 7 处(R-E1..R-E7);Dexter 2026-09-14 确认全部勘误,
        并对开机画面失败态、system notice 恢复、release 证据分档三项一并裁定,见 §8
      → v3.5:Claude 对修订后的详设/计划做第 2 轮独立复评,NO-GO 3M/6S/5N(见
        doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-round2-claude.md);
        其中 M-1 指出 R-E6 本身的处置方向仍错,本版再勘误一次(§1.5);另有 1 项待 Dexter 裁决,见 §8
      → v3.6:Dexter 2026-09-14 裁定 round2 全部 findings 交 Codex 在实施中处置,授权进入实施阶段、
        完成动态验证,交付后由 Dexter 与 Claude 做实施后静态 review;S-3 的待裁决项相应关闭,见 §8
      → v3.7:Claude 实施静态代码评审 NO-GO 2M/12S/8N;Dexter 2026-09-15 授权 Claude 代为裁定其中待决项
        (R-S7 适用阶段、失败页内容、picker 写入后文案、startup.complete 完成语义、两个空壳 adapter 包),见 §8
文档边界=Dexter 2026-09-14:需求文档写「必须成立什么」与验收要证明的性质;
        实现机制、判据执行体与取值细节列入 §7「详设必须明确」,不在本稿钉死
```

## 0. 方向、判据与本稿边界

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

### 0.2 判据

> **base 提供"怎么做",app 提供"是什么"。**

| 观察 | 能推出 | 不能推出 |
|---|---|---|
| 两个不同业务**都写了**且一字不改 | **强候选证据**:与业务无关,可上收 | 不能直接推出"原样上收"——相同代码也可能是**共同复制的错误**,上收前仍须逐项核 |
| 第二个业务**没写** | **什么都推不出** | 不能推出"不是能力":它可能换了写法,也可能根本没行使这个能力,二者在代码里长得一样 |

⇒ 用"第二个业务没有它"做否定论据前,必须先证明第二个业务有机会分歧。

### 0.3 证据口径

1. 凡"相同/唯一/零/计数"断言,附可原样复跑的命令,真假由退出码或计数决定;
2. "逐字相同" = `diff` 退出码 0(含缩进与行序);不满足只能写"语义一致"并说明差异面;
3. 以退出码 0 主张相同的比较,须同时证明输入非空(如 `wc -l`)或附**反向对照**(与确知不同的文件比须得 1)——路径写错时,`diff` 两个空输入同样返回 0;
4. 未亲核的写 `UNVERIFIED` 并说明范围;引用他人实跑结果须注明出处。

所有命令 cwd = `apps/terminal`,分母为 first-party 源码,不含 `node_modules`。

### 0.4 本稿与详设的分工

| 本稿写 | 详设写(§7) |
|---|---|
| 缺陷事实与证据 | 修复机制 |
| 能力/配置的归属与硬约束 | 包内结构、API 形状、迁移步骤 |
| 验收要证明的**性质**与已知绕过形态 | 判据的执行体、夹具、oracle 与产出批次 |
| 前置条件与批次边界 | 各批内的具体改动清单、计数与取值 |

---

## 1. 证据基座

### 1.1 `assembly/android` 层

**adapter 接线块逐字相同,整文件差异 3 个 hunk:**

```bash
diff <(sed -n '/^const platformPorts = createPlatformPorts({$/,/^})$/p' assembly/android/sample-terminal/src/assembly/platformPorts.ts) \
     <(sed -n '/^const platformPorts = createPlatformPorts({$/,/^})$/p' assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts)
# 退出码 0
sed -n '/^const platformPorts = createPlatformPorts({$/,/^})$/p' assembly/android/sample-terminal/src/assembly/platformPorts.ts | wc -l
# 15(输入非空)
diff assembly/android/sample-terminal/src/assembly/platformPorts.ts \
     assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts | grep -c '^[0-9]'
# 3:integration import、persistenceKey 字面量、导出工厂(含书写形态)
```

**真实接线只有 3 个 adapter**:persist-kv(plain + protected)、device、dual-screen。`appControl` 绑 `unavailableAppControlPort`、`logger` 绑 `consoleLoggerBinding`(均来自 platform-ports);`adapter-android-app-control` 与 `adapter-android-logger` 只出现在 `src/dependencies.ts` 的声明里,无任何接线。

```bash
grep -n "createAndroid\|unavailableAppControlPort\|consoleLoggerBinding" assembly/android/sample-terminal/src/assembly/platformPorts.ts
grep -n "adapter-android" assembly/android/sample-terminal/src/dependencies.ts
```

**`App.tsx` 两边各 58 行,差异全是配置**:integration 的 `global.css` 路径、assembly 类型名与工厂名、loading 文案、loading 背景/文字颜色、loading `testID`(仅 WP 有)。assembly 缓存与 loading 回退的**结构**两边相同。

```bash
wc -l assembly/android/sample-terminal/App.tsx assembly/android/sample-wallpaper-terminal/App.tsx
# 58 / 58
diff assembly/android/sample-terminal/App.tsx assembly/android/sample-wallpaper-terminal/App.tsx
```

**根目录文件全集**(两个 App 共有的根文件逐个比较;目录不计):

```bash
for f in $(comm -12 <(ls -1A assembly/android/sample-terminal | sort) <(ls -1A assembly/android/sample-wallpaper-terminal | sort)); do
  [ -f "assembly/android/sample-terminal/$f" ] || continue
  diff -q "assembly/android/sample-terminal/$f" "assembly/android/sample-wallpaper-terminal/$f" >/dev/null; echo "$f exit=$?"
done
# 同一路径模式下有文件得 1,即为对照
```

| 类别 | 文件 | 两边比较 |
|---|---|---|
| 薄壳 | `index.ts`、`App.tsx` | 均为 1;`index.ts` 仅格式与注释不同,`App.tsx` 见上 |
| App 配置 | `app.json`、`package.json`、`README.md` | 均为 1(按 App 不同) |
| 门元数据 | `terminal-invariants.json` | 1,仅包名不同 |
| **构建配置(6 个)** | `babel.config.cjs`、`tsconfig.json`、`global.d.ts` | **0** |
| | `metro.config.js` | 1:仅 integration `global.css` 的 resolve 路径 |
| | `tailwind.config.cjs` | 1:content glob 路径;**WP 独有 `darkMode: 'class'`** |
| | `nativewind-env.d.ts` | 1:仅 NativeWind 生成的 NOTE 注释 |

另有构建/运行产物目录只在一侧存在(`.runtime`、`.turbo` 仅 ST,`dist` 仅 WP),不属配置,不计入。

⚠️ 这些根目录文件**不进包图**——graph 的源码导入收集只覆盖 `src/` 与 `test-expo/`(两轮评审独立指出)。两个 App 即使各用一套私有 preset,graph / census / layering 门也全绿。

### 1.2 `ui/integration` 层

```bash
wc -l ui/integration/sample-console/src/assembly/assembly.tsx ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx
# 389 / 313
grep -n "not available for\|unavailable for" ui/integration/sample-console/src/assembly/assembly.tsx ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx
# sample-console:174 "is not available for" ↔ wallpaper:157 "is unavailable for" —— 同一句错误消息已漂移
for p in startup.runtime-facts sample.runtime-facts-resolved sample.assembly-created \
         startup.device sample.device-identity-resolved createRenderRuntimeFacts; do
  printf '%-34s console=%s wallpaper=%s\n' "$p" \
    "$(grep -c "$p" ui/integration/sample-console/src/assembly/assembly.tsx)" \
    "$(grep -c "$p" ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx)"
done
# createRenderRuntimeFacts 2/2;其余五项全部 1/0(§2.3)
grep -n "hostSourceAttached" ui/integration/sample-console/src/assembly/assembly.tsx
# 骨架内由 surfaceHostSourcesByDisplayIndex 计算,不由 App 传入(§3.3)
ls ui/integration/sample-console/src/application/ ui/integration/sample-wallpaper-console/src/application/
# sample-console 无 module.ts;wallpaper 有(§2.2)
```

两个 console 的公共导出面不对称:wallpaper 额外导出 `createBaseModuleDescriptors`、`moduleKind`、模块工厂与 `parts`(见两包 `src/index.ts`)。

### 1.3 `ui/feature` 层

```bash
diff ui/feature/sample-member-desk/src/components/requestOutcome.ts ui/feature/sample-staff-auth/src/components/requestOutcome.ts
# 退出码 0;wallpaper-picker 无此文件
wc -l ui/feature/sample-member-desk/src/components/requestOutcome.ts
# 15(输入非空)
grep -n "dispatchWithRequestId" ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx
# :48 与 :57 两处均为 `void dispatchWithRequestId({...})`,结果被丢弃
grep -rn "classifyRequestResult(" ui/feature --include='*.tsx'
# 消费者 4 处:member-desk 3、staff-auth 1
wc -l ui/feature/sample-member-desk/src/application/module.ts ui/feature/sample-staff-auth/src/application/module.ts ui/feature/sample-wallpaper-picker/src/application/module.ts
# 62 / 46 / 29;三者都内含一份运行期依赖排除(§2.2)
```

### 1.4 `kernel/feature` 层

三个 kernel/feature 包分属两个业务,其 `dependencies.ts` 去掉行尾分号后两两逐字相同:

```bash
diff <(sed 's/;$//' kernel/feature/sample-member-registry/src/dependencies.ts) <(sed 's/;$//' kernel/feature/sample-staff-session/src/dependencies.ts)  # 0
diff <(sed 's/;$//' kernel/feature/sample-member-registry/src/dependencies.ts) <(sed 's/;$//' kernel/feature/sample-wallpaper/src/dependencies.ts)     # 0
diff <(sed 's/;$//' kernel/feature/sample-staff-session/src/dependencies.ts) <(sed 's/;$//' kernel/feature/sample-wallpaper/src/dependencies.ts)       # 0
diff <(sed 's/;$//' kernel/feature/sample-member-registry/src/dependencies.ts) <(sed 's/;$//' kernel/feature/sample-member-registry/src/moduleName.ts) # 反向对照 1
```

这是 §0.2 第一行的正向样本:三个包都真的写了这个文件,且跨业务一致。

### 1.5 当前基线

- terminal static 首败 `graph-comparison`:`ui.feature.sample-wallpaper-picker` 的 graph 节点(`skeleton-graph.ts:163`)devDependencies 为空,而 package.json 声明了 `kernel-base-platform-ports`——该包只在 `test/` 下被导入,门只扫 `src/` 与 `test-expo/`,不扫 `test/`(`graph-model.mjs:272-274`)。

  ⚠️ **R-E6 勘误(Dexter 2026-09-14 确认;v3.5 再勘误,见下)**:上一版(及 D-4 事实行)把根因单点归为 `src/dependencies.ts` 的 `devDependencyModuleNames` 数组,不完整——即使补齐该数组,graph 节点仍空、`graph-comparison` 仍红。真实根因是"该依赖只在 `test/` 被使用而门不扫 `test/`"与"三处声明未必同步"两条叠加。

  ⚠️ **R-E6 二次勘误(第 2 轮详设/计划复评发现,见 `doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-round2-claude.md` M-1)**:上一句"B0 须同时改 graph 边与该数组"这个处置方向本身是错的。`runGraphComparison`(`check-static.mjs`)在 devDependencies 集合检查之后,还有一步 `assertEqualSet('source imports', sourceImports, declared)`——`declared` 是 package.json 的 `dependencies`+`devDependencies`+`peerDependencies`+`optionalDependencies` 四个字段合并(不分 regular/dev),`sourceImports` 只从 `src/`(及若存在的 `test-expo/`)收集,**从不含 `test/`**。若按上一句"同时改 graph 边与数组"执行,graph 与 package.json 会先一致(第③步通过),但 `declared` 里的 `platform-ports` 在 `sourceImports` 里永远缺席(它只在 `test/` 被 `import type` 引用,门看不见)——门会在第④步以另一个错误继续红。全仓检索"devDependency 声明但仅 `test/` 使用"的组合,**没有任何包能在这个门下通过**,这不是 picker 的偶然,是门本身不认这个形态。**正确的 B0 改法是从 `package.json` 的 `devDependencies` 删除这条声明,保持 graph 与 `dependencies.ts` 数组维持现状的"不声明"**;测试文件里那处 `import type` 引用能否在删除声明后继续解析、或是否本就该换个引入方式,交 D-4/B0 详设裁定。
- sample2 实施仍在复评修复中,未验收。

⇒ 两者都是 §4.0 的前置条件。

---

## 2. 实测缺陷

### 2.1 🔴 sample2 的 startup 诊断永远不会完成

```bash
for f in ui/integration/sample-console/.expo/dev/logs/start.log \
         ui/integration/sample-wallpaper-console/.expo/dev/logs/start.log; do
  echo "$f surfaces=$(grep -c 'startup.surfaces' $f) kind=$(grep -o 'kind' $f | wc -l) complete=$(grep -c 'startup.complete' $f)"
done
```

| 日志 | `startup.surfaces` 行 | 出现 `kind` | `startup.complete` 行 |
|---|---|---|---|
| sample-console | 177 | 179 | 58 |
| sample-wallpaper-console | 16 | **0** | **0** |

写入端字段在复制中丢失:

| 字段 | sample-console | sample-wallpaper-console |
|---|---|---|
| `startup.surfaces.declared` 的 `kind` | `kind: 'declared'`(`:121`) | 无,被 `source:` 顶替(`:97`) |
| `startup.surfaces.measured` 的 `kind` | `kind: 'measured'`(`:142`) | 无(`:117`) |

消费端在 `kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`:`:102` `readSurfaceKind` 只认 `declared` / `measured`;`:111-121` `recordStartupSuccess` 仅当 `displayMode` 与 `kind` 都存在才记录 surface;`:107-109` `allStartupGroupsCompleted` 要求至少一个 surface 同时 declared 且 measured;`:125-138` 是 `startup.complete` 的唯一写入点。

⚠️ **日志基线本身不干净,sample1 不能当作完整生命周期的正向基线**:sample-console 的 dev 日志里,56 个 run 各有 1 次 `startup.complete`,**1 个 run 有 2 次**,**16 个 run 有 surface 日志却无 complete**。重复的那个 run 两条 complete 的 `sequence` 同为 11、`timestamp` 相差约 51 秒——**不是日志传输重复,是同一 runId 下的两次独立写入**(成因未核)。这些形态不改变 sample2 缺 `kind` 的定性,但任何基于日志的验收 oracle 都必须先定义逐 run 语义并解释它们,见 D-7。

⚠️ **R-E7 勘误(Dexter 2026-09-14 确认)**:runId 由 `createPlatformPorts.ts:49-53` 的**毫秒时间戳 + 模块级计数器**拼成,并非全局唯一——两个 tracker(如 HMR 前后各建一个)可能撞出同一个 runId。逐 sequence 核对上述重复 run:sequence 1–11 **各出现两次**,是两个 tracker 共用了同一个 runId,不是"同一 runId 下两次独立写入"这么简单;该日志文件本身还混有 web 客户端的打包事件,是多客户端汇总流,不是单一 tracker 的纯净输出。⇒ D-7 的 oracle 不能以 runId 为唯一键,须先解决 run 身份唯一性,并只读单客户端 sink。

```bash
L=ui/integration/sample-console/.expo/dev/logs/start.log
grep 'startup.complete' $L | grep -o 'terminal-startup-[0-9]*-[0-9]*' | sort | uniq -c | awk '{print $1}' | sort | uniq -c
comm -23 <(grep 'startup.surfaces' $L | grep -o 'terminal-startup-[0-9]*-[0-9]*' | sort -u) \
         <(grep 'startup.complete' $L | grep -o 'terminal-startup-[0-9]*-[0-9]*' | sort -u) | wc -l
grep 'startup.complete' $L | grep 'terminal-startup-1789204021803-8' | grep -oE 'sequence[^0-9]*[0-9]+|timestamp[^0-9]*[0-9]+'
# 重复 run 的两条:sequence 均为 11;timestamp 为 1789204052335 与 1789204103344
```

### 2.2 🔴 运行期模块依赖的排除清单每包手抄

**根因**:各包 `dependencies.ts` 的 `dependencyModuleNames` 同时充当 workspace 依赖与运行期模块依赖,而只有部分 base 包注册运行期模块(至少 `kernel.base.runtime`、`kernel.base.display-context`、`kernel.base.ui-state`)。`resolveModuleOrder` 对找不到注册模块的必需依赖直接抛错,于是每包手抄排除清单。

```bash
grep -rn "runtimeModuleDependencies = " ui kernel assembly adapter --include='*.ts' --include='*.tsx' | grep -v node_modules
# 4 处
find ui kernel assembly -name 'baseModuleDescriptors.ts' -not -path '*/node_modules/*'
# 2 个
```

| 包 | 代码形态 | 排除内容 |
|---|---|---|
| `ui/feature/sample-member-desk` | 链式 `&&` | render、primitives、input |
| `ui/feature/sample-staff-auth` | 链式 `&&` | 同上(集合相同) |
| `ui/feature/sample-wallpaper-picker` | 链式 `&&` | render、primitives |
| `ui/integration/sample-wallpaper-console` | 数组 `.includes` | render、primitives、input、admin-shell |

另有 2 份伪造 descriptor(`baseModuleDescriptors.ts`,两个 console 各一)。合计 **6 处**;2026-09-13 记为 3 处——**缺口随 sample 增加自我复制,且已长出第二种代码形态**。

第 4 处落在 `ui/integration`,是治理轮进度差:sample-console 未注册为运行期模块,wallpaper 已注册(带 placement actor)——sample2 建于治理轮设计定稿之后,已是治理后形态。⇒ 修复须同时覆盖"integration 自身即运行期模块"。

⚠️ **R-E5 勘误(Dexter 2026-09-14 确认)**:上面 6 处只是手抄排除清单与伪造 descriptor 这一种形态,缺口家族还有另一种——以下 5 个 module 工厂直接对整个 `dependencyModuleNames` 建立依赖,其中含不注册运行期模块的包(contracts、platform-ports、state),**全靠那两份伪造 descriptor 把这些名字注册进 runtime 才能启动**:

  - `kernel/base/display-context/src/application/createDisplayContextModule.ts:28`
  - `kernel/base/ui-state/src/application/createUiStateModule.ts:128`
  - `kernel/feature/sample-member-registry/src/application/module.ts:38`
  - `kernel/feature/sample-staff-session/src/application/module.ts:39`
  - `kernel/feature/sample-wallpaper/src/application/module.ts:16`

  删除 2 份伪造 descriptor 时,若不把这 5 个工厂一并切到 D-4 定义的"运行期依赖集合",两个 console 启动会抛 `Missing required runtime module dependency`。D-4 的契约须覆盖这 5 处,不只是 4 处排除清单。

### 2.3 🔴 sample2 缺失三处启动诊断发射

§1.2 实测:`startup.runtime-facts`、`sample.runtime-facts-resolved`、`sample.assembly-created`、`startup.device`、`sample.device-identity-resolved` 在 sample2 侧全部为 0——对应 sample-console 的三处诊断发射(runtime facts、assembly created、device identity)全部缺失。

这两类 category 不在 `STARTUP_GROUPS` 里,**不**影响启动完成判定(推论),损害是可观测性。与 §2.1 同一种病:**同一次复制丢了两样东西,一样是契约字段,一样是整段装配。**

---

## 3. 需求:归属与硬约束

### 3.0 硬约束:base 层级不得依赖非 base 层级(通则)

**需求**:任何 `*/base/*` 包——含本立项新建的 `assembly/base/android` 与 `ui/base/console-assembly`——不得依赖 feature、integration 层级的包,也不得依赖 `assembly/android/*` 下的 App 包。

⚠️ **R-E1 勘误(Dexter 2026-09-14 确认;原表述与 §3.1、U5 字面冲突,已阻断 B2)**:上一句禁止的是 feature / integration 层级与 App 包,**不含 adapter 层**——`assembly.base.<平台>` 依赖 `adapter.<平台>.*` 是 §3.1 要求的接线本体,属本条**放行**的方向,不是例外。判定用通用谓词:源层 = assembly、目标层 = adapter、目标的平台段(moduleName 第二段)与源一致,不写死包名。

**"依赖"在本条中穷举为**:`package.json` 的 `dependencies` / `devDependencies`;graph 声明;以及任何源码引用——值导入、`import type`、`export … from`(含 `export type`)、动态 `import()`、`require()`、跨包相对路径。**type-only 同样算依赖**:它形成编译期与架构耦合,而且是绕过本条最自然的形态。检查器怎么实现交 D-1;是否计入由本条定,不交详设。

**扫描全集**:base 包内的全部源文件——`src/`、`test/`、`test-expo/` 与根目录的脚本和配置——加上 `package.json` 与 tsconfig 的 `references` / `paths`;构建产物与 `node_modules` 除外。**测试夹具同样计入**:base 包的测试若需要 feature 专属夹具,应移到更高层的测试包,而不是给 base 开例外。

**为什么写成通则**:

```bash
node -e "
const src=require('fs').readFileSync('skeleton-graph.ts','utf8');
const re=/'([a-z0-9.-]+)':\s*\{[\s\S]*?dependencies:\s*\[([^\]]*)\][\s\S]*?devDependencies:\s*\[([^\]]*)\]/g;let m;const g={};
while((m=re.exec(src))){const l=s=>(s.match(/'[^']+'/g)||[]).map(x=>x.slice(1,-1));g[m[1]]={d:l(m[2]),dd:l(m[3])}}
const tier=n=>n.split('.')[1];let hits=0;
for(const[k,v]of Object.entries(g)){if(tier(k)!=='base')continue;for(const t of[...v.d,...v.dd])if(tier(t)!=='base')hits++}
console.log('节点',Object.keys(g).length,'base→非base 边',hits)"
# 节点 31  base→非base 边 0
```

⚠️ 该脚本按 `tier(n)=n.split('.')[1]`(即 moduleName 第二段)判层级,对 `adapter.android.*` 同样判"非 base",**不代表它被本条禁止**——按 R-E1,assembly → adapter 是放行方向。脚本只用于证明现有图里没有 base → feature/integration/App 的边;D-1 的检查器须按 R-E1 的谓词实现,不得照抄这段脚本的判断。

- 现有图**零违反** ⇒ 通则无迁移成本;Codex 复评对当前 base 包源码做 AST 扫描,跨包相对路径与 type-only 导入同样零违反(作者会话未复跑);作者对 base 包的 `test/`、根目录文件与 tsconfig 做字符串检索,真实违反也为 0(唯一命中是 `kernel/base/runtime/terminal-invariants.json:23` 路径中的 `features` 子串,属误报);
- 只给两个新包打补丁,其余 `kernel/base`、`ui/base` 包仍无保护。

**今天没有任何门挡这条:**

| 形态 | 为什么放行 |
|---|---|
| `assembly/*` 的出边 | layering `isInvalidDirection`(`tools/terminal-layering/check-static.mjs:135-140`)对 assembly 恒返回 false;skeleton `runDependencyDirection` 对 `assembly.*` 只查自环(`tools/terminal-skeleton/check-static.mjs:306-308`) |
| `ui/base → ui/integration` | layering `workspaceLayer`(`:113-120`)只按包名前缀分四层,ui 层内部分不出 base 与 integration |
| 跨包相对路径导入 | 仓内唯一同类规则在 `tools/terminal-platform-ports/check-static.mjs:209`,作用域只是 platform-ports 的 `src/defaults` |
| `import type`、`export type … from`、动态 `import()` / `require()` | 现有门的导入收集对这些形态的覆盖未核,交 D-1 |

Codex 隔离副本实测:令两个新包分别依赖 `ui.integration.sample-console` 并同步 package.json / dependencies.ts / graph,skeleton 与 layering 门**均通过**。

执行体见 D-1。

### 3.1 `assembly` 层

**建包是 Dexter 裁定**(§0.1)。

⚠️ **撤回 v2 的建包论证**:v2 称"splash 生命周期在本仓没有第二个合法家"。不成立——仓内原生能力的既有通道就是 **platform-ports 定义 port → `adapter/android/*` 实现 → assembly 绑定 → 运行期模块经 port 调用**;`AppControlPort` 已定义 `showNativeLoading` / `hideNativeLoading`。splash 的原生能力经向下注入到达 `ui/base/render`(R-S6),具体走 platform port 还是能力注入由 D-5 判定。

| 能力(上收 `assembly/base/android`) | 配置(留 `assembly/android/<app>`) |
|---|---|
| adapter 接线(今天真实接线的 3 个,及本立项决定接线的) | `app.json` 的 name / slug |
| `surfaceHostSourcesByDisplayIndex` 组装 | icon / adaptive icon 资产 |
| platform-ports 默认 port 填充 | 开机画面内容(图、背景色等) |
| App 壳结构:assembly 缓存、loading 回退 | loading 文案、颜色、testID |
| 根构建配置的共享部分(Metro / Babel / NativeWind) | integration `global.css` 路径;tailwind content 与主题取值(含 `darkMode`) |
| 身份一致性与资产引用校验 | App 身份(唯一权威源,见 D-6) |
| splash:引入 `expo-splash-screen`(Dexter 裁定引入于本包)、全局作用域的 `preventAutoHideAsync` 与收起能力的原生 binding;"主屏已就绪"由 `ui/base/render` 观察(R-S6),见 D-5 | `persistenceKey`;注入哪个 integration 工厂 |

**硬约束:**

1. 每个 App 保留门要求的薄壳:`index.ts`、`App.tsx`、`src/assembly/platformPorts.ts`;`index.ts` 运行期 import `./App`,`App.tsx` 运行期 import `./src/assembly/platformPorts`;`App.tsx` 不得含 bootstrap 接线,`App.tsx` 与 `src/assembly/platformPorts.ts` 不得含 `require(` / `import(`(`tools/terminal-skeleton/check-static.mjs:170-202`)。base 出的是被薄壳调用的能力,不是替换薄壳;
2. 上收后 assembly 包**不得有只声明、不使用的依赖**(今天 app-control / logger 两条即此形态,去留见 D-10);
3. 不做 `android/` 原生工程模板——模板是把配置也复制一份。

### 3.2 splash 需求

- **R-S1 时机**(Dexter 裁定"主屏加载完毕后"):开机画面自原生启动起显示,**在"主屏已就绪"之前不得收起——包括不得被默认的自动收起收掉**;就绪后收起。

  ⚠️ **R-E3 勘误(Dexter 2026-09-14 确认)**——"主屏已就绪"重定义为:**开机画面覆盖的那块主 Activity 物理表面**首次渲染出真实 screen part 并完成首次布局。

  原定义用逻辑 `displayMode === 'PRIMARY'` 判定,但 `resolveSurfaceDisplayMode`(`kernel/base/display-context/src/foundations/displayDerivation.ts:5-9`)在 `displayRole === 'VICE' && instanceMode === 'SLAVE'` 时把物理 0 号屏(即开机画面所在的那块屏)判为逻辑 SECONDARY,单屏 SLAVE 设备按旧定义会永远等不到就绪。新定义按**物理表面**判定,渲染实现须能取得"当前进程渲染的是不是被开机画面覆盖的那块物理表面"这一事实,不经 `displayMode`。

  `ScreenContainer` 的真实 part 分支要求排除**全部** `RenderFallbackReason`(`ui/base/render/src/components/resolvePart.ts:13-19`),不止 `runtime-unavailable`、`container-empty` 两种——另有 `missing-catalog-entry`、`incompatible-catalog-entry`、`missing-renderer`、`invalid-props` 四种,均不算就绪。此时 `SurfaceHostController` 也已过 geometry pending(不再渲染 `ui-base-render:surface-host-pending`)。App loading 回退、host pending、任一 `RenderFallbackReason`、外层 root 的布局**都不算**就绪。双屏只看开机画面覆盖的那块物理表面。**在 release 构建上成立才算成立。**
- **R-S7 就绪永远不可达时的处置**(Dexter 2026-09-14 裁定):assembly 创建被拒绝、runtime 启动失败、host 快照长期不到、真实 part 持续落在上述任一 fallback 等终态失败场景,**收起开机画面并显示失败页**;不得让开机画面无限期停留(用户会以为设备卡死),也不得因已调用 `preventAutoHideAsync` 就放任默认自动收起(会绕过 R-S1)。失败页的最小内容由详设定,须能让用户或运维判断"启动失败",不是简单转黑屏或转空白。**v3.7 补充**:R-S7 只适用于首次就绪前;就绪后的处理、失败页文案与错误代码见 §8 v3.7 第 1、2 项。
- **R-S2 能力归属**:收起时机的控制是 base 能力,各 App 不写收起逻辑。
- **R-S3 配置归属**:开机画面内容按 App 定制,且**只有一个配置入口**。
- **R-S4 一致性**:两个 App 采用同一种原生集成方式。
- **R-S5 边界**:
  - 收起动作是**纯基础设施副作用**——不写 runtime state、不派发 command、没有业务方消费。三条同时满足时,TR-11 的"事件变 command"不适用:TR-11 管的是事件"到达业务逻辑"的路径;
  - 一旦"主屏已就绪"需要写 runtime state、派发 command 或被业务方消费,则**完整适用 TR-11**(command、actor、桥的播种与去重);
  - 任何情况下都不得:引入 `ui → assembly` 或 `ui → adapter` 依赖;导出携带写能力的回调注册接缝(TR-11 的禁止形态);以 `__DEV__` 诊断日志作为触发信号。
- **R-S6 owner 与桥**(Dexter §0.1 授权"其他的你根据最优最长远的方向定"):
  - **就绪事实的 owner 是 `ui/base/render`**:只有它同时掌握 host geometry(`SurfaceHostController`)与 screen placement(`ScreenContainer`),能证明 R-S1 的定义;
  - **原生能力由 `assembly/base/android` 提供**:`expo-splash-screen` 依赖、全局作用域的 `preventAutoHideAsync`、收起能力的 binding 都在该包;
  - **桥向下注入**:收起能力经 platform port 或能力注入到达 `ui/base/render`。能力注入有现成先例——`surfaceHostSource` 就是在 assembly 用 Android adapter 创建(`assembly/android/sample-terminal/src/assembly/platformPorts.ts`)、经 integration 传给 `SurfaceRoot` 的(`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:295`)。`ui/base/render` 在 PRIMARY 首次就绪时调用一次,重复调用须无害。具体走哪条由 D-5 定;
  - **撤回 v3.2 的默认桥**("App 壳在 PRIMARY 渲染树首次完成布局时收起"):`assembly/android/sample-wallpaper-terminal/App.tsx:36-44` 只区分 assembly 是否就绪,就绪后返回的树内仍可能是 `ui/base/render/src/components/SurfaceHostController.tsx:88-100` 的 spinner 或 `ScreenContainer.tsx:40-53` 的 fallback——App 壳从结构上看不到这两种状态,证明不了 R-S1;它唯一的优势是改动面小,不足以成为理由。

**事实:**

| 事实 | 出处 |
|---|---|
| 默认会自动收起:"By default, the splash screen will automatically hide when your app is ready." | [Expo SDK 57 SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/) |
| `preventAutoHideAsync` 建议在全局作用域调用;放在组件或 hook 内"might be called too late, when the splash screen is already hidden" | [Expo SplashScreen(latest)](https://docs.expo.dev/versions/latest/sdk/splash-screen/) |
| "From SDK 52 … Expo Go and development builds cannot fully replicate the splash screen experience your users will see in your standalone app";官方建议在 release 构建上测试 | 同上 |
| `SplashScreenManager.registerOnActivity` 调用 `mainActivity.installSplashScreen()`;收到 `ReactMarkerConstants.CONTENT_APPEARED` 时,仅当未调用过 `preventAutoHideAsync` 才自动收起 | `expo/expo` 仓 `sdk-57` 分支 `packages/expo-splash-screen/android/src/main/java/expo/modules/splashscreen/SplashScreenManager.kt` |
| **R-E2 勘误(Dexter 2026-09-14 确认)**:官方 config plugin 把 `setTheme(R.style.AppTheme)` 注释掉,并在 `super.onCreate(null)` **之前**插入 `SplashScreenManager.registerOnActivity(this)`(上一版写"之后"有误,源自 WebFetch 转述——`@expo/config-plugins` 的 `mergeContents`/`addLines` 以 `offset:0` 调用 `lines.splice(lineIndex, 0, newLine)`,插入点在锚点行之前);主题须以 `Theme.SplashScreen` 为父,并设置 `postSplashScreenTheme` 指回 App 自身主题 | `@expo/config-plugins` 的 `src/utils/generateCode.ts`;Android 官方迁移文档"Call `installSplashScreen` in the starting activity before calling `super.onCreate()`"、"Create a theme with a parent of `Theme.SplashScreen`"(`developer.android.com/develop/ui/views/launch/splash-screen/migrate`) |
| 包的 Android 依赖含 `androidx.core:core-splashscreen:1.2.0`;该目录只有 `SplashScreenManager.kt` 与 `SplashScreenModule.kt`,**没有自动注册的生命周期监听器**,须由 App 的 Activity 注册 | 同仓 `packages/expo-splash-screen/android/build.gradle` 与上述目录 |
| 包 README 的 bare Android 段落只写了 `windowBackground` 主题一套,与上述源码不一致;**以源码为准** | 同仓 `packages/expo-splash-screen/README.md` |
| 本仓 `expo` 为 `~57.0.18`;`expo-splash-screen` 在两个 App 的 `package.json` 与 `yarn.lock` 中零命中 | `grep` |
| 两个 App 的 `MainActivity.kt` 均在 `:18` 调 `setTheme(R.style.AppTheme)`、`:19` 调 `super.onCreate(null)`,对 `SplashScreenManager` / `registerOnActivity` / `installSplashScreen` 均 0 引用 | 下方命令 |
| 两个 App 的 `styles.xml` 对 `Theme.SplashScreen` / `windowSplashScreen` / `postSplashScreenTheme` 均 0 命中(两份逐字相同);`app/build.gradle` 对 `splashscreen` 均 0 命中;`settings.gradle` 均已启用 Expo autolinking | 下方命令 |
| `ui/base/render/src/components/SurfaceRoot.tsx` 仅有的挂载与布局观察,两处都以 `if (!__DEV__) return` 开头(`:37`、`:60`)——**release 构建中没有现成的就绪信号**;render 上下文今天只携带 `LoggerPort` 这一个 port | 下方命令、`ui/base/render/src/types/props.ts` |
| `AppControlPort.showNativeLoading` / `hideNativeLoading` 入参带 `containerKey`(及 `message`),形状上是**按容器的加载层**而非开机画面;`adapter-android-app-control` 无其实现,全仓无调用方,无文档定义语义 | `kernel/base/platform-ports/src/types/appControl.ts`、`grep` |

```bash
for app in sample-terminal sample-wallpaper-terminal; do
  d=assembly/android/$app/android
  echo "$app API=$(grep -c 'Theme.SplashScreen\|windowSplashScreen\|postSplashScreenTheme' $d/app/src/main/res/values/styles.xml) gradle=$(grep -c splashscreen $d/app/build.gradle) autolink=$(grep -c useExpoModules $d/settings.gradle) manager=$(grep -rn 'SplashScreenManager\|registerOnActivity\|installSplashScreen' $d/app/src/main/java | wc -l | tr -d ' ')"
  grep -n "setTheme(R.style.AppTheme)\|super.onCreate" $(find $d/app/src/main/java -name MainActivity.kt)
done
# 两个 App 均为 API=0 gradle=0 autolink=1 manager=0;均为 :18 setTheme、:19 super.onCreate
diff assembly/android/sample-terminal/android/app/src/main/res/values/styles.xml assembly/android/sample-wallpaper-terminal/android/app/src/main/res/values/styles.xml  # 0
diff assembly/android/sample-terminal/android/app/src/main/res/values/styles.xml assembly/android/sample-terminal/android/app/src/main/res/values/colors.xml             # 反向对照 1
grep -n "__DEV__" ui/base/render/src/components/SurfaceRoot.tsx
# :37 与 :60
```

⚠️ **当前未集成 SDK 57 的 `expo-splash-screen`(确定)**:包未安装,原生控制链(`SplashScreenManager`)不在工程内;两个 App 的 Activity 既没有 `registerOnActivity`,还在 `super.onCreate` 之前切回 `AppTheme`——官方 plugin 恰好要把这一行注释掉。现有的只是开机主题与资源的一部分。**更正 v3.2**:它据"包 README 与文档页说法不一"把此事判为"未证实";应以包源码为准,源码足以定论。

⚠️ **撤回 v2 裁决 ②**("保持 `android/` 原生资源、不引 config plugin"):它建立在"原生侧已就绪"上,该前提**已确认不成立**。R-S3 / R-S4 作为需求保留;集成方式(CNG + 官方 config plugin,或已提交原生工程 + 与 plugin 等价的手工接入)由 D-5 决定。

### 3.3 `ui/integration` 层

**目标包**:`ui/base/console-assembly`(moduleName `ui.base.console-assembly`)。integration 骨架不能进 `assembly/base/android`——`ui → assembly` 非法。

| 上收(能力) | 留各 console(配置/业务) |
|---|---|
| `createStateSource` / `createDispatchCommand` | placement actor(跨 service 的决定) |
| `createSurfaceForDisplayIndex`,**含错误消息文案**(§1.2 已漂移) | 各自的 parts / variables / kernel modules |
| runtime facts / device identity 诊断装配(§2.3) | `moduleName` / `persistenceKey` |
| `SurfaceInputFrame` 与 surfaces 诊断字段契约(§2.1) | `surfaceChildren`(如壁纸背景) |
| host source 解析与缓存,**含 `hostSourceAttached` 的计算** | 注入哪些 kernel module |
| 装配流程骨架;TR-13 的 admin 接入 | 业务 chrome(`renderContentFrame` 只承载业务 chrome) |

**`hostSourceAttached` 是能力**:骨架由 `surfaceHostSourcesByDisplayIndex` 自行算出,不由 App 传入;若下放成参数,调用方可在未挂 host source 时传 `true`,诊断当场失真。

**TR-13**:骨架须**构造性地**满足 TR-13 的四个形态——声明 `ui.base.admin-shell`;唯一 catalog 含 `...adminShellAssembly.parts`;生产 surface 的 content frame 由 `AdminLauncher` 包住并使用该 surface 的 `canvas`;不自定义 `ADMIN_CONSOLE_*` 常量、第二条 `openLayer` 路径、覆盖层或输入管线。一个完全不写 admin 相关代码的 console 也须满足。验证沿用 TR-13 自己的边界,见 U9。

### 3.4 `ui/feature` 层

- **上收**:`module.ts` 的组装骨架(含 §2.2 的修复)、`assembly.ts` 的形状、`requestOutcome.ts` → `ui/base/render`。
- **留下**:commands、actors、parts、components。
- **不收**:`moduleName.ts` / `index.ts` 样板(Dexter 2026-09-14 裁定)。

**`requestOutcome` 上收的依据**(v2 裁决 ① 保留,Codex 评审认可):

1. 它是 kernel 契约类型上的纯函数:入参 `CommandDispatchResult`(`kernel-base-runtime`),按 `error.category` 是否属于 `{AUTHENTICATION, BUSINESS, VALIDATION}` 分四档——内核级错误类目,不是业务类目;
2. dispatch 侧已在 base:`ui/base/render` 已导出 `dispatchWithRequestId` 与 `useDispatchCommand`,分类侧留在 feature 才不一致;
3. wallpaper-picker "没有它"**不构成**反证:其两处 dispatch 都是 `void`,从不处理结果(§0.2 第二行)。修复后 picker 成为第三个消费方(§3.5)。

⚠️ 按 §0.2 第一行,"两处逐字相同"只是强候选证据;分类表是否完备、是否共同复制了错误,上收前须核,见 D-12。

⚠️ **上收位置不决定 owner**:`ui/base/render` 承载分类函数,不因此成为任何业务事件的 owner,也不因此引入运行期模块依赖。

### 3.5 并入缺陷:picker 丢弃派发结果(Dexter 2026-09-14 裁定并入本批次)

**缺陷**:`ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx` 的选择(`:48`)与确认(`:57`)两处都是 `void dispatchWithRequestId(...)`,派发结果被整个丢弃;而 `ui/base/render/src/foundations/dispatchWithRequestId.ts` 直接返回 dispatch 的 Promise,既可能以系统失败 resolve,也可能 reject——两种情况用户都看不到任何反馈。

- **R-P1 在入口处理**:两处派发的结果都必须在 picker **自己的两个生产入口**处理,覆盖 resolved 的系统失败与 rejected 的派发。**不得**保留 `void`、改由 integration 包装 dispatch 或全局 observer 统一兜底——那样缺陷本体(入口丢弃结果)仍在。
- **R-P2 业务裁定不变,且与系统失败区分**:sample2 需求的既有业务裁定不变——选择的**业务**失败路径不可达、不弹提示(`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md:276`);无 pending 时确认必须以 typed failure 失败(TR-02,`:249`;判据 A2c `:918`)。⚠️ "选择的业务失败不可达"**不等于**"选择派发的系统失败不需处理"——两者不得再共用"选择失败"这个简称。
- **R-P3 分类走 base**:结果分类使用上收后 `ui/base/render` 的分类能力(§3.4),不在 picker 复制一份。
- **R-P4 system notice 的 owner 与触发路径**:
  - **实现上收为 base 能力**:sample1 现有的两份 system notice(`ui/feature/sample-member-desk/src/components/DeskSystemNotice.tsx` 与 `ui/feature/sample-staff-auth/src/components/AuthSystemNotice.tsx`)各 42 行,diff 只差命名、类型、命令名与 testID 前缀,标题"系统提示"与文案"操作没有完成，请重试"完全相同——这是业务无关的基础设施,picker 不再复制第三份;
  - **身份与触发归各 feature**:partKey、layerId、testID、operation 类型,以及 system-failure 的 observed / dismissed 命令和打开、关闭该层的 actor,归各自 feature;
  - **合法触发路径**:feature 入口分类出系统失败 → dispatch **本 feature** 的 system-failure-observed command → **本 feature** 的 actor 以 `openLayerCommand` 打开以 base 能力建立的**本 feature** notice part;
  - **禁止**:picker 依赖 `sample-staff-auth` 或 `sample-member-desk`(picker 当前的 workspace 依赖里两者都没有);复用 `sample.auth.system-notice`——它的 `AuthSystemOperation` 只有 `'login' | 'logout'`(`ui/feature/sample-staff-auth/src/features/commands/commands.ts:11`),是认证域的;
  - **sample1 不回归**:两个既有 notice 的 partKey、layerId、testID 与可见行为保持不变(U10)。
- **R-P5 失败后的生命周期与 state**(两个入口都适用):
  - 同一入口在途时不得重复派发;
  - 任何非 `running` 结果与 rejection 都必须结束该次请求,不得永久在途;
  - **确认**遇系统失败:已确认的壁纸不变,pending 保留,可重试——与 sample2"未确认的选择应被保留、重启后恢复"的既有裁定一致;
  - **选择**遇系统失败:界面仍显示尝试前的有效选择,不出现未写入的 pending。

  ⚠️ **R-E4 勘误(Dexter 2026-09-14 确认)**——picker 是**两跳派发**:入口 dispatch picker 自己的 command,picker actor(`ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:27,34`)再 `await context.dispatchCommand(...)` 派发 kernel 子命令,但把子命令的 `CommandDispatchResult` **丢弃**、直接 `return null`。R-P1"入口处理结果"目前只够到第一跳,子命令的写入前失败与写入后失败要分开处理:

  - **写入前失败**(kernel 子命令在开始执行前即失败):picker actor 须能观察到并向入口传播,上面四条按原样成立;
  - **写入后失败**(kernel 子命令已完成写入、仅终态记账失败):上面"已确认壁纸不变"**不成立**——壁纸已经换了。此时须呈现"已完成但确认失败"或等价的不误导用户的提示,不得沿用"操作没有完成"这句写入前失败的文案。

  两者的可达性与 picker actor 具体怎么处理子命令结果,交 D-14 详设裁定;若详设发现"写入后失败"路径不可达,须给出证据,不得默认假设。

**参照形态**(sample1):`ui/feature/sample-staff-auth/src/components/StaffLogin.tsx:56-91`、`ui/feature/sample-member-desk/src/components/MemberForm.tsx:63-97`——在途守卫 → `request.start()` → `classifyRequestResult` → 非 `running` 即 `request.finish(requestId)` → `system-failure` 调 `observeSystemFailure()`;`catch` 分支同样 `finish` 并提示。`observeSystemFailure` 派发本 feature 的 system-failure-observed command,自身的 rejection 被吞掉,因为 `useDispatchCommand` 已发出结构化诊断。

```bash
diff ui/feature/sample-member-desk/src/components/DeskSystemNotice.tsx ui/feature/sample-staff-auth/src/components/AuthSystemNotice.tsx
# 各 42 行;差异只在命名、类型、命令名、testID 前缀与一处 import 顺序
grep -rln "SystemNotice\|system-notice" ui --include='*.ts' --include='*.tsx' | grep -v node_modules
# 只出现在 sample-member-desk 与 sample-staff-auth;picker 为 0
```

具体的 base 能力形状、包归属、可达失败类型与提示文案,见 D-14。

---

## 4. 范围、前置条件与批次

### 4.0 前置条件

1. **sample2 实施验收通过**——否则 U10 的回归基线仍在移动。§3.5 的 picker 缺陷已由 Dexter 裁定并入本批次,**不计入**这里所说的 sample2 验收内容;
2. **terminal static 基线全绿**——当前 `graph-comparison` 红于 sample2 picker 的 devDependencies(§1.5);
3. 治理轮的范围规则("本轮不新增、不修改任何 base 包的公共面")随合并**退役**——B3 的本体就是修改 base 公共面(Dexter 已裁定合并)。

### 4.1 批次

| 批次 | 落点 | 边界 |
|---|---|---|
| **B1** | 运行期模块依赖契约;清除 `ui/feature` 的 3 处排除清单 | 契约须同时覆盖"integration 自身即运行期模块";**U1 不在本批收口** |
| **B2** | 新建 `assembly/base/android`;两个 App 收缩为薄壳 + 配置;splash;身份/资产校验 | —— |
| **B3** | 新建 `ui/base/console-assembly`;两个 console 收缩(含 §2.1 / §2.3 修复);清除 `ui/integration` 侧 1 处排除清单与 2 处伪造 descriptor;sample-console 补齐治理轮形态 | 并入治理轮;**U1 在本批收口** |
| **B4** | `ui/feature` 的 `module.ts` / `assembly.ts` 骨架上收;`requestOutcome` 迁入 `ui/base/render`;**system-failure notice 实现上收**,sample1 两份迁移且标识不变;**修 picker 丢弃派发结果**(§3.5) | 依赖 B1;picker 修复消费本批上收的分类与 notice 能力 |

- B1 与 B3 在 `ui/integration/*/src/application/` 上**必然重叠**:6 处缺口中 3 处在 `ui/integration`。
- 两个 console 公共面不对称:删 descriptor 在 sample-console 是包内编辑,在 wallpaper 是公共面移除。
- 本稿的 B1–B4 与 `skeleton-graph.ts` 节点的 `batch` 字段无关。
- 若 D-5 否决 R-S6 的默认桥、改走 platform port,B2 与 B3 之间会产生依赖,批次顺序由详设据此调整。

### 4.2 新包必须是现有体系的一等公民

**需求**:两个新包须像既有包一样被 workspace 枚举、census、skeleton graph、turbo 任务与 package invariants 识别;不得为接纳新包而削弱任何既有门;assembly entry 可达性检查不得继续硬编码 App 名单(否则新 App 永远不进该门)。

**事实(纠正 v2 的"缺一即门红"):**

- root `package.json` 的 `workspaces` 逐层枚举,没有 `apps/terminal/assembly/base/*`;
- `runStaticChecks`(`tools/terminal-skeleton/check-static.mjs:701`)只有 6 条规则与 hygiene,不读 root workspaces、`app.json`、`build.gradle`、Kotlin 源码或 assets;
- Codex 隔离副本实测:新增节点只补 package / graph / moduleName / invariant / typecheck / 计数,故意不加 root workspace、不扩 entry 可达性、不建身份/资产校验、不删孤儿资产——skeleton 与 layering 门**全部通过**;root workspace 缺失只在 Turbo dry-run 中暴露。

⇒ v2 的"缺一即门红"是过度断言:部分遗漏今天**没有任何红路径**。逐项"哪个门抓、抓不到的由谁兜"见 D-2。

**不做元门**:不新建"校验新 validator 与红夹具确实存在"的门——那是已退役的台账/交叉对账控制形态。validator 的存在由验收评审一次性核实,此后由它自带的红夹具测试随 verify 持续运行。

**不做元门的前提**:实施验收必须**实际执行**每个新检查器,并用真实 red mutation 证明缺包、错声明、非法依赖会失败;只核源码存在不算(`project-memory/operations/verification-governance.md` 的 `PRODUCTION_RED_MUTATION_REQUIRED`)。

**以默认门路径为准**:`skeleton-graph.ts:1` 为 `activeSkeletonBatch = 2`,`runStaticChecks`(`tools/terminal-skeleton/check-static.mjs:703`)与 verify 默认按它投影,即全图,默认路径不会丢边。但显式传 `batch=1` 时,`projectSkeletonGraph`(`tools/terminal-skeleton/graph-model.mjs:169`)会静默过滤投影外的边——**不得以 batch=1 投影的通过作为新节点依赖正确的证据**。

---

## 5. 验收判据

**设计门槛**:判据须挡住**自然捷径与无意回归**;"复制代码并复用标识符"这类蓄意伪造由实施评审兜底——实施评审是验收的组成部分。每条判据写明要证明的**性质**与**已知绕过形态**;执行体、夹具与 oracle 由详设给出(D-8),且须逐条说明如何闭合所列绕过。

| # | 要证明的性质 | 已知绕过形态(验证设计必须闭合) |
|---|---|---|
| U1 | **没有手抄的运行期依赖排除**(B3 收口):"是否为运行期模块"由该包自己声明一次;依赖一个**新的**非运行期 base 包,除依赖方既有的门控声明与注册点外无需改任何文件 | 按标识符名检索(改名即绿);把排除表集中到 resolver(对已知包成立、对新包失效)⇒ 验证须使用实现方事先不知道的包;标 `optional: true` |
| U2 | **缺失注册仍会失败**:声明依赖一个**真实存在的运行期模块包**却未注册,启动必须以缺失依赖错误失败 | 标 `optional: true`(`resolveModuleOrder` 直接跳过);resolver 跳过未知依赖;夹具用不存在的模块名(可能经别的路径失败,测不到真实失效形态);运行期依赖数组与 `package.json` 漂移而无红(今天无门约束,见 D-4) |
| U3 | **surfaces 诊断字段契约只有一个写入端**:两个 App 都产出消费端所读字段齐备的 declared 与 measured;**每个生产写入入口都被真实触发**;在该写入端破坏字段,两个 App **都**失去完整性;**证据只能取自开发构建**(`createStartupTracker` 仅 `__DEV__` 下创建,release 零事件),oracle 须读单客户端 sink 而非 Metro 汇总日志(R-E7) | 保留多个写入端(其一正确)——破坏骨架写入端后若任一 App 仍完整,即证明存在第二写入端,判据**不通过**;第二写入端保留但本次从不触发(休眠);测试调用共享 helper 而非生产写入入口;按字符串出现次数计数;把多客户端汇总日志当单一 tracker 的输出 |
| U4 | **sample2 达成启动完成,完成由各启动组真实完成所致,且每个 run 恰好一次**;run 身份须先唯一(R-E7),否则本判据不可执行 | 启动开头无条件写一次 complete;以"出现次数 > 0"为 oracle;重复或缺失 complete 未判失败;只测成功路径,不测失败与 finally;旧 run 的 surface 或 complete 串入本 run;以不唯一的 runId 为键判"恰好一次" |
| U5 | **App 不接线 adapter**:adapter 接线只在 base | 跨包相对路径导入(今天无门挡);把接线代码复制进 App;挪到 App 内另一个文件 |
| U6 | **身份一致且不撞名**:每个 App 一个权威身份源,其余身份位置与之一致;两个 App 互不相同 | 只查 Kotlin 包目录、不查源文件 `package` 声明;只查一个 App |
| U7 | **资产引用双向闭合**:配置引用的资产都存在;`assets/` 下每个文件都被引用或登记;两个 App 同一规则 | 只查"引用 → 存在",孤儿文件照过;两个 App 用不同规则 |
| U8 | **R-S1 在 release 构建冷启动时成立**(就绪按 R-E3 重定义的物理表面 + 全部 `RenderFallbackReason` 排除),手机形态与双屏形态都成立;R-S7 的失败页在终态失败场景可见;development build 只作辅助证据。**证据分档裁定(Dexter 2026-09-14)**:复用 `tools/terminal-sample2/run-a9-runtime.mjs` 先例,做一次记录式 release 观察即可,不新建受管 runner——除非该先例经详设核实无法驱动本判据所需的双形态冷启动观察,才升级为新建 | 把 App 壳或外层 root 的布局、host pending、任一 `RenderFallbackReason` 当作就绪;未阻止默认自动收起(开机画面在就绪前已消失);`preventAutoHideAsync` 调用过晚;只在 development build 或 Expo Go 上验证;只凭 JS 调用顺序日志而无设备观察;以 `__DEV__` 诊断为信号(release 中不存在);只验一种形态;终态失败时开机画面无限期停留而非收起显示失败页 |
| U9 | **TR-13 四形态对每个 console 构造性成立**:不写任何 admin 相关代码的 console 仍满足 | 另建 admin 路由、第二条 `openLayer`、自定义 `ADMIN_CONSOLE_*`(TR-13 第 4 形态);只渲染 launcher 而 admin parts 不在 catalog(TR-13 反例栏)。**验证沿用 TR-13 边界**:focused test 与实施评审,不新增 skeleton/layering 机器门,不在工具里硬编码包名 |
| U10 | **两个 App 的冻结旅途与场景矩阵全部回归通过**,含冷重启、手机与双屏形态;每步断言 partKey 与 state,不接受成功文本 | 只跑一个平凡的挂载/点击流程;漏登录、确认、持久化或双屏;system notice 上收后 partKey、layerId、testID 被改名,回归矩阵跟着改名掩盖回归 |
| U11 | **§3.0 通则成立**(按 R-E1 的放行方向,assembly → adapter 不算违反),依赖形态与扫描全集按 §3.0 | 经 `devDependencies`;`import type` 或 `export type … from`;动态 `import()` / `require()`;跨包相对路径;只扫 `src/` 漏掉 `test/` 或根目录配置;经另一个 base 包间接依赖(通则覆盖全部 base 包即闭合);**误将 assembly → adapter 判红**(该方向本条放行,判红即检查器本身有 bug) |
| U12 | **两个 App 的 6 个根构建配置文件只在声明的配置项上不同**(`babel.config.cjs`、`tsconfig.json`、`global.d.ts`、`metro.config.js`、`tailwind.config.cjs`、`nativewind-env.d.ts`),共享部分来自 base | 只覆盖其中 3 个;保留私有 `tsconfig.json` 或私有生成声明;各 App 保留私有 preset(根配置文件不进包图,现有门看不见) |
| U13 | **picker 两个生产入口不再丢弃派发结果**:resolved 系统失败与 rejected 派发都经本 feature 的 notice(以 base 能力建立)对用户可见;请求生命周期结束;确认失败后已确认壁纸不变、pending 保留;选择失败后界面保持尝试前的有效选择;分类与 notice 实现走 base 能力 | 保留 `void`,由 integration 包装 dispatch 或全局 observer 兜底;只处理 resolved 失败、不处理 rejection;请求停留在途;确认先改了 state 再提示错误;只修确认、漏掉选择;复用 `sample.auth.system-notice` 或依赖其他 feature;在 picker 内复制分类表或 notice 实现;夹具只测业务失败或无 pending 路径,没有真实注入系统失败 |

**U10 的冻结旅途权威:**

- sample1:`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` 的 §4(旅途、双屏/单屏场景矩阵)与该文 §9.2;`doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`;
- sample2:`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md` 的 §9;`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md` 的 §2.2、§8——**以 sample2 实施验收通过时的版本为准**。

---

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| `moduleName.ts` / `index.ts` 等样板上收 | Dexter 2026-09-14 裁定 |
| `android/` 原生工程模板 | 模板复制配置,与本立项方向相反 |
| theme 取值上收 | `sample-console/README.md` 既有裁定:主题属 integration |
| `dependencies.ts` / `package.json` / graph 三处声明合一 | **范围选择,不是"已被覆盖"**:graph 与 `package.json` 由 `tools/terminal-skeleton/check-static.mjs:223-237` 强制集合相等,`package.json` 与 `src/` 静态导入集合由 `:252` 强制相等;但 `src/dependencies.ts` 导出的 `dependencyModuleNames` **数组的值**不受任何门约束(Codex 复评实测:只改 `src/dependencies.ts`,门仍全过)。该数组是运行期依赖的来源,其漂移检测**属本立项**,见 D-4;三处合一的整体改造另立 |
| 校验"validator 存在"的元门 | 已退役的台账/交叉对账控制形态(§4.2) |
| `sample-terminal` 身份改名(`com.anonymous.*`) | 与本立项无因果,单独登记 |
| graph `batch` 字段的语义清理 | 观察:无 owning 说明,现有 3 个 batch-1 节点依赖 batch-2 节点,投影静默过滤——疑似残留机制,单独登记 |
| 为未来 sample 预建扩展点 | 上收标的须有正向证据 |
| 把 sample2 拉齐到 sample1 之外的可观测性建设 | 不新增诊断面 |

---

## 7. 详设必须明确

每项写:要回答的问题、来自本稿的约束、已知事实。

**D-1 分层通则的执行体**(§3.0、U11)
- 问题:检查器如何覆盖 §3.0 穷举的全部依赖形态(package 声明、graph、值导入、`import type`、`export … from` 含 `export type`、动态 `import()`、`require()`、跨包相对路径)与扫描全集(`src/`、`test/`、`test-expo/`、根目录脚本与配置、tsconfig `references` / `paths`)。**是否计入已由 §3.0 定,不在此裁定。**
- 约束:通则化,不在工具里硬编码包名;红夹具至少覆盖两个新包各一例、一个既有 base 包一例,type-only、跨包相对路径与 `test/` 内引用各至少一例。
- 事实:layering 只分四层且放行 assembly 出边;跨包相对导入今天仅 platform-ports `src/defaults` 有规则;graph 源码导入收集覆盖 `src/` 与 `test-expo/`(两轮评审独立指出),对 type-only、动态导入与 `test/` 的覆盖未核。

**D-2 新包接入清单**(§4.2)
- 问题:两个新包各需被哪些既有登记与门识别;每项遗漏由哪个门抓;抓不到的由哪个新执行体或验收步骤兜。
- 约束:entry 可达性不再硬编码 App 名单;不削弱既有门;新检查器须经真实 red mutation(§4.2)。
- 事实:root workspaces 逐层枚举,`yarn workspaces list` 不会发现未接入 root 的新包(Codex 复评实测);Codex 实测部分遗漏无红路径;节点计数硬编码在 `tools/terminal-skeleton/check-static.mjs:285-286` 与 `check-static.test.mjs:23-25`。

**D-3 graph `batch` 取值**
- 问题:两个新节点的 `batch` 写几,相应计数怎么改。
- 约束:新节点依赖正确性以默认门路径(`activeSkeletonBatch` 投影,当前即全图)为准;**不得以显式 batch=1 投影的通过作为证据**;若本立项新增跨 batch 依赖,须在详设中显式列出。
- 事实:`batch` 无 owning 语义说明;`projectSkeletonGraph`(`tools/terminal-skeleton/graph-model.mjs:161-174`)对投影外依赖静默过滤;`activeSkeletonBatch = 2`(`skeleton-graph.ts:1`);现有 `ui.integration.sample-console` 与两个 `assembly.android.*` 为 batch 1,却依赖 batch-2 节点;`batch` 只接受 1 / 2;显式 `runStaticChecks({batch:1})` 当前先因 census 中存在 batch-2 包而失败,仓内不存在 batch=1 通过的证据(Codex 复评实测)。
- ⚠️ v2 裁决 ③("都写 1,依赖排在消费者之后语义反")**撤回**——其理由被上述事实证伪。

**D-4 运行期模块依赖契约**(§2.2、U1、U2)
- 问题:"是否为运行期模块"如何由包自己声明一次;integration 自身即运行期模块时如何覆盖;4 处排除清单与 2 处 descriptor 如何按 B1 / B3 迁移;`dependencyModuleNames` 的漂移如何被发现。
- **独立期望集合**(需求层定义,详设不得改):
  - `dependencyModuleNames` 的集合 = `package.json` 的 `dependencies` 中 workspace 包归一化后的 moduleName 集合;`devDependencyModuleNames` 同理对应 `devDependencies`。期望来源是 `package.json`——它与 graph 的相等已由 `tools/terminal-skeleton/check-static.mjs:223-237` 强制,独立于数组本身;
  - 集合语义:不得重复,只含 workspace moduleName,顺序不计;
  - **运行期依赖集合** = 上述 regular 集合中"被依赖包自己声明为运行期模块"的子集——判定来源是被依赖包自己的声明,不是依赖方的清单;
  - 不得以数组自身或手抄清单作期望来源。
- 约束:U1 验证须使用实现方事先不知道的包;U2 夹具须用真实但未注册的运行期模块包;不得引入 `optional: true`;漂移检测须有真实 red mutation(删数组一项而不改 `package.json` / graph 须红)。
- 事实:31 个 `src/dependencies.ts` 中 30 个今天已满足上述集合相等且无重复;唯一不一致是 `ui/feature/sample-wallpaper-picker` 的 `devDependencyModuleNames` 为空而 `package.json` 有 `kernel-base-platform-ports`——**正是当前静态检查首败**(§1.5,根因见 R-E6 及其二次勘误),属 §4.0 前置条件 2 须先清除的基线。**清除方式是删除 package.json 的该条声明,不是补齐三处**(§1.5 R-E6 二次勘误)。运行期依赖集合的判定须覆盖 §2.2(R-E5)新增的 5 个工厂,否则删除 2 份伪造 descriptor 后两个 console 会启动失败。

```bash
node -e "
const fs=require('fs'),path=require('path'),cp=require('child_process');
const files=cp.execSync(\"find . -path '*/node_modules' -prune -o -path '*/src/dependencies.ts' -print\").toString().trim().split('\n');
let bad=0;for(const f of files){const s=fs.readFileSync(f,'utf8'),dir=path.dirname(path.dirname(f));
const al={};for(const m of s.matchAll(/import\s*\{\s*moduleName\s+as\s+(\w+)\s*\}\s*from\s*'([^']+)'/g))al[m[1]]=m[2];
const arr=n=>(s.match(new RegExp('export const '+n+'\\\\s*=\\\\s*\\\\[([\\\\s\\\\S]*?)\\\\]'))||[,''])[1].split(',').map(x=>x.trim()).filter(Boolean).map(a=>al[a]);
const pj=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')),ws=o=>Object.keys(o||{}).filter(k=>k.startsWith('@catering-v2s/'));
const eq=(a,b)=>a.length===new Set(a).size&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
if(!eq(arr('dependencyModuleNames'),ws(pj.dependencies))||!eq(arr('devDependencyModuleNames'),ws(pj.devDependencies))){bad++;console.log('MISMATCH',dir)}}
console.log('文件',files.length,'不一致',bad)"
# MISMATCH ./ui/feature/sample-wallpaper-picker;文件 31 不一致 1
```

**D-5 splash 原生集成与收起**(§3.2、U8)
- 集成方式:CNG(prebuild + 官方 config plugin),还是已提交原生工程 + 与 plugin 等价的手工接入(依赖、Activity 注册、主题);若选 CNG,须先盘点 prebuild 会覆盖的现有手改原生文件。两个 App 同改。
- 原生要求:以 §3.2 所列 SDK 57 包源码为准——Activity 须调用 `SplashScreenManager.registerOnActivity`,须处理 `super.onCreate` 之前的 `setTheme(R.style.AppTheme)`;主题与 `core-splashscreen` 的要求按源码与官方 plugin(含 `withAndroidSplashStyles.ts`)核定;不得只凭包 README。
- 阻止自动收起:`preventAutoHideAsync` 在 `assembly/base/android` 的模块作用域、首个 RN 视图出现之前调用,且不违反薄壳的 `require(` / `import(` / bootstrap 禁令。
- 就绪信号:在 `ui/base/render` 内按 R-S1 的定义观察 PRIMARY 首次就绪;不得依赖 `__DEV__`,须在 release 构建中存在;只触发一次,重复调用无害。
- 桥:收起能力经 platform port(复用 `AppControlPort.hideNativeLoading`、扩展或新增方法),还是按 `surfaceHostSource` 先例做能力注入,到达 `ui/base/render`;render 上下文今天只携带 `LoggerPort`,须说明如何扩展;无论哪条都须满足 R-S5。
- 依赖落点:`expo-splash-screen` 默认按 Dexter 方向在 `assembly/base/android`;若详设主张放在别处,须给出理由。
- 证据边界:**最终证据是 release 构建**在手机与双屏两种形态上的冷启动设备观察;development build 与 Expo Go 只作辅助。原生接入(静态)、JS 调用时序(日志)、设备可见行为(观察)三类证据分开记录,不得互相替代;须能区分"就绪前已被自动收起"与"就绪后收起"。**执行方式按 Dexter 2026-09-14 裁定**:复用 `tools/terminal-sample2/run-a9-runtime.mjs` 先例做一次记录式观察,不新建受管 runner(见 U8)。
- 约束:R-S1–R-S7。

**D-6 身份权威源与资产规则**(U6、U7)
- 问题:`app.json` / gradle / Kotlin 中谁是权威源。与 D-5 耦合:CNG 下原生工程由 `app.json` 生成;已提交原生工程下 gradle 与 Kotlin 是手工维护的一手源。一致性须覆盖 Kotlin 源文件的 `package` 声明;资产引用双向规则。
- 一并处置:ST 孤儿 `assets/splash-icon.png`;WP `assets/README.md` 的既有裁定("不把未被 `app.json` 引用的 splash 资产计入本清单")——二者如何处置取决于 D-5 是否让配置引用开机图;原生 splash drawable 是否已由 Android 资源编译兜底。

**D-7 启动诊断 oracle**(§2.1、U3、U4)
- 问题:逐 `startupRunId` 的判定语义;先查明 sample1 基线中"1 个 run 两次 complete"(日志 `:13509` 与 `:15166`,sequence 1–11 各出现两次)与"16 个 run 有 surfaces 无 complete"的成因,再用作验收。
- **R-E7 已确认的事实,详设须据此设计,不得重新假设**:runId = 毫秒时间戳 + 模块级计数器,并非全局唯一;上述"重复"是两个 tracker 共用了同一个 runId,不是一个 tracker 写了两次;`.expo/dev/logs/start.log` 是多客户端(含 web 打包)汇总流,不是单一 tracker 的纯净输出。
- 约束:
  - **先解决 run 身份唯一性**(如在 runId 里带入进程/客户端区分符),再谈"每个 run 恰好一次";
  - oracle 只读单客户端 sink,不读 Metro 汇总日志;
  - 每个生产写入入口都必须被真实触发;共享 helper 不能替代写入入口级证据;单一写入端另需结构证据(生产源码中写该字段契约的位置清单,由实施评审核对);
  - oracle 须按 run 身份关联 surface、写入端、complete、失败与 finally;
  - 重复 complete、缺失 complete、旧 run 串入都必须判失败;sample1 的重复若查明为真实重复写入,属 B3 须修的缺陷,不得以去重掩盖;
  - 因果红夹具:缺一个必需启动组则无 complete;破坏骨架写入端则两个 App 都失去完整性。

**D-8 判据执行体总表**(§5)
- 问题:U1–U13 各自的执行体(既有测试 / 新 validator / focused test / 设备检查 / 实施评审)、产出批次、红夹具;哪些常驻 verify,哪些是一次性验收证据。
- 约束:逐条说明如何闭合 §5 所列绕过形态;不得以关键词或字段匹配冒充语义判定。

**D-9 回归矩阵**(U10、U13)
- 问题:从 §5 所列冻结旅途权威推导逐步矩阵——入口、控件、输入、partKey、state、冷重启点、失败恢复,覆盖手机与双屏两种形态。
- 约束:U10 的正常冻结旅途与 U13 的系统失败注入场景**分栏列出**,避免正常验收、B4 focused proof 与系统失败 proof 之间重复或遗漏;system notice 上收后,sample1 的 partKey、layerId、testID 不得在矩阵里被同步改名以掩盖回归。

**D-10 assembly 的只声明依赖**(§3.1 硬约束 2)
- 问题:`adapter-android-app-control`、`adapter-android-logger` 接线还是移除。与 D-5 耦合:若 D-5 选择经 app-control port 传递收起能力,app-control 即转为待接线项。

**D-11 根构建配置的共享机制**(§1.1、U12)
- 问题:6 个根构建配置文件(`babel.config.cjs`、`tsconfig.json`、`global.d.ts`、`metro.config.js`、`tailwind.config.cjs`、`nativewind-env.d.ts`)各自的共享部分如何由 `assembly/base/android` 提供(包 `exports` 映射、调用方传参、生成文件的处理),每个 App 剩下哪些配置项。
- 事实:`metro.config.js` 用 `path.resolve(__dirname, '../../../node_modules')` 与 `Module._initPaths()`,对目录深度敏感,preset 须由调用方传入自己的 `__dirname`;`nativewind-env.d.ts` 由 NativeWind 生成;`darkMode` 属主题取值,留 App 侧。

**D-12 `requestOutcome` 分类表完备性**(§3.4)
- 问题:`{AUTHENTICATION, BUSINESS, VALIDATION}` 与 kernel 错误类目定义是否一致、完备;上收后在 `ui/base/render` 的导出形状。

**D-13 App 壳结构的上收形态**(§3.1、R-S6)
- 问题:assembly 缓存与 loading 回退如何由 base 提供,App 传哪些配置;`preventAutoHideAsync` 与收起能力 binding 如何随 `assembly/base/android` 在模块作用域就位。
- 约束:§3.1 硬约束 1 的薄壳规则;App 壳**不承担**就绪判定(R-S6)。
- 事实:loading `testID` 今天只有 WP 有——上收后两个 App 行为一致。

**D-14 picker 派发结果处理与 system notice 上收**(§3.5、U13)
- base 能力形状:system-failure notice 的组件与 part 建立能力放在哪个 ui/base 包(约束:feature 向下依赖;不放进 `ui/base/console-assembly`,也不放进任何 feature);observed / dismissed 命令与 actor 是否也提供工厂——前提是 sample1 既有 partKey、layerId、testID 与可见行为不变。
- sample1 迁移:`DeskSystemNotice` 与 `AuthSystemNotice` 改用 base 能力后删除原实现,不留两套。
- picker:本 feature 的 notice part、layerId、testID 与 operation 类型取值;选择与确认的提示文案。
- 可达失败:选择与确认各自可达的系统失败形态(resolved 系统失败、rejection、超时);在途守卫与请求生命周期如何实现(对照 §3.5 的 sample1 参照);R-P5 各条 state 性质的验证方式。
- **与 sample2 既有规则的例外(Dexter 2026-09-14 裁定)**:sample2 裁定"浮层进 state、持久化、重启恢复"针对的是用户尚未提交的输入与选择;system-failure notice **不属于这条**——它呈现的是一次已经结束的请求失败,冷重启后该请求已不存在,恢复出来只是过期信息,反而误导用户以为刚才的操作又失败了一次。⇒ **system notice 层不进冷重启恢复范围**,重启后按 R-P5"请求已结束"处理,不重新打开;多个 feature 同时失败时,notice 各自独立呈现,不合并、不覆盖。
- 对齐:sample2 需求与详设对"确认的系统失败如何呈现"是否已有定义——有则对齐,冲突则上报 Dexter。
- 事实:Codex sample2 详设 `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md:834` 的"失败可见"验证行覆盖无 pending 确认、资产缺失、hydrate 丢弃与 host 不可用,不含派发结果被丢弃;全仓 system notice 恰为两份(member-desk、staff-auth),picker 为 0。

---

## 8. 授权边界、未核范围与裁决状态

需求分析,**不是实施授权**;下一步是详设。作者会话只做静态核验与官方资料查阅,未修改任何源码(本文件除外)。标注"Codex 实测"的结论来自 Codex 评审与复评的隔离副本实跑;标注"独立子 agent 实测"的来自 Claude 详设/计划评审(§9)。作者会话均未复跑。

**UNVERIFIED:**

| 项 | 范围 |
|---|---|
| SDK 57 主题层面的原生要求 | 作者读了 `SplashScreenManager.kt`、包 `build.gradle`、`withAndroidSplashMainActivity.ts`、`generateCode.ts` 与 Android 官方迁移文档,未读 `withAndroidSplashStyles.ts` |
| sample1 日志中"16 个 run 有 surfaces 无 complete"的成因 | 重复 complete 的成因已由 R-E7 查明(两个 tracker 共用不唯一 runId);"有 surfaces 无 complete"的成因仍未查 |
| graph 源码导入收集的覆盖面 | 只覆盖 `src/` 与 `test-expo/` 由三轮评审独立指出,作者未复核行号;对 type-only、动态导入与 `test/` 的覆盖未核 |
| R-S1 就绪定义在 release 构建中的可观察方式 | 未核,交 D-5 |
| picker 子命令写入后失败是否可达 | 未核,交 D-14(R-E4) |

**v3.3 及更早的裁决状态(保留):**

| # | 事项 | 本版 |
|---|---|---|
| ① | `requestOutcome` 上收至 `ui/base/render` | **保留**;§0.2 第一行为"强候选证据";新增 D-12;明确上收位置不决定 owner |
| ② | splash 保持原生资源、不引 config plugin | **撤回**:前提"原生侧已就绪"**已确认不成立**(包未安装、Activity 未注册);R-S3 / R-S4 保留,集成方式交 D-5 |
| ③ | 两个新节点 `batch: 1` | **撤回**:理由被仓内事实证伪;取值交 D-3 |
| 附 | 包名 `ui/base/console-assembly` | 保留 |
| 附 | 身份权威源 = `app.json`;删除 ST 孤儿资产 | **撤回为待详设**:与 D-5 耦合,交 D-6 |
| 新 | 开机画面收起的 owner 与桥(R-S6) | 就绪事实归 `ui/base/render`,原生能力归 `assembly/base/android`,向下注入;撤回 v3.2 的 App 壳默认桥;依据 Dexter §0.1 授权 |
| 新 | system-failure notice 的 owner 与触发路径(R-P4) | 实现上收 base,身份与触发归各 feature;依据 §0.1"上收能力,下放配置项" |
| Dexter | picker 丢弃派发结果并入本批次(2026-09-14) | 已写入 §3.5、§4.0、B4、U13、D-14 |

**v3.4:Claude 详设/计划评审后,Dexter 2026-09-14 一次性裁定以下四项(均按评审建议):**

| # | 事项 | 裁定 |
|---|---|---|
| 1 | **R-E1 至 R-E7 需求侧事实勘误**(评审 `doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-claude.md` §9) | **全部确认**,已写入本版对应章节:R-E1(§3.0 base↛adapter 的范围)、R-E2(splash 注册顺序)、R-E3(R-S1 就绪重定义)、R-E4(picker 两跳派发)、R-E5(§2.2 补 5 个工厂)、R-E6(§1.5 首败根因)、R-E7(§2.1/D-7 runId 不唯一)。不改变批准范围与产品语义,只纠正事实 |
| 2 | **R-S7:开机画面永远等不到就绪时怎么办**(评审 S-03) | **终态失败时收起开机画面、显示失败页**(评审推荐选项 ②),不选"永远不收起"或"设超时";已写入 R-S1 后新增的 R-S7,U8 与 D-5 同步更新 |
| 3 | **system notice 冷重启是否恢复**(评审 S-16) | **不恢复**;它呈现的是已结束请求的失败,与 sample2"未提交输入需恢复"的浮层规则不是同一类,恢复反而误导用户;已写入 D-14 |
| 4 | **release / 双屏时序证据怎么产出**(评审 M-09) | **复用 `tools/terminal-sample2/run-a9-runtime.mjs` 先例做一次记录式观察,不新建受管 runner**;除非详设核实该先例驱动不了双形态冷启动观察,才升级为新建;已写入 U8、D-5 |

**v3.6:S-3 待裁决项已关闭**——Dexter 2026-09-14 裁定不预先选边,交 Codex 在实施阶段自行核实:`run-a9-runtime.mjs` 先例能否驱动 release 双屏冷启动观察,由 Codex 实际跑一次拿第一手证据判定;能扩展则扩展,扩展成本已逼近重写(见评审文件 S-3 的能力缺口清单)则按裁定④原文"升级为新建",两种结果都需要在交付时给出证据链,不需要再回头请示。

**v3.6:round2 复评(3M/6S/5N)全部 findings 一并交 Codex 实施阶段处置**,不再逐条要求 Dexter 先过目;Codex 完成修订与实施后,交 Dexter 与 Claude 做实施后静态 review。

**v3.7:Dexter 2026-09-15 授权 Claude 按最优、最长远、用户体验最好的方向,代为裁定实施静态代码评审(`doc/review/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation-review-claude.md`)中的待决项;细节与理由见该文件 §2.1:**

| # | 事项 | 裁定 |
|---|---|---|
| 1 | R-S7 的适用阶段(评审 S-1) | R-S7 只管首次就绪前,且只由终态事实触发;可恢复的原生移除保持开机画面,等下一次有效快照。首次就绪后永不显示"终端启动失败":可恢复的宿主不可用保留当前画面并自动恢复;runtime 失败或 PRIMARY 主屏终态 fallback 显示同一失败页的运行期变体;SECONDARY 任何阶段都不显示全屏失败页 |
| 2 | 失败页内容 | 启动期"终端启动失败"、运行期"终端运行异常",说明均为"请重启终端，如仍失败请联系管理员",附错误代码(仅内部 reason 与错误名);两个变体用不同 testID;本批不做页内"重新启动"按钮 |
| 3 | picker 写入后与未知相位(评审 S-7) | 保留写入后分支;夹具由真实 kernel actor 先写、后置 actor 抛错;相位以 actor 回读为准;文案:写入前"操作没有完成，请重试",选择写入后"已选中该壁纸，但系统未能确认，可继续操作",确认写入后"壁纸已更换，但系统未能确认，无需重复操作",未知相位"操作结果未能确认，请以当前画面为准" |
| 4 | startup.complete 完成语义(评审 M-1) | 六个必需启动组全部完成、PRIMARY declared 与 measured 都已发生、PRIMARY 真实 part 首次就绪,三者缺一不写;唯一 owner 为 console-assembly writer,DEV 与 release 同一判定;platform-ports logger 只做 sink,不覆盖 startupRunId;不新增生产诊断事件 |
| 5 | 两个零消费 adapter 包(评审 N-7) | 删除 `adapter/android/app-control` 与 `adapter/android/logger`,同步 graph、计数、workspaces、invariants 与 README;将来连同真实实现与消费者一起重建 |

---

## 9. 评审 intake

### Claude 详设/计划评审(2026-09-14,NO-GO 9M/22S/12N)

评审对象是 Codex 的详设与 B1–B4 实施计划,不是本需求稿本身;但评审过程中独立子 agent 挖出本稿 7 处事实错误(R-E1..R-E7),已按 Dexter 裁定的处置方式(§8)逐条写入对应章节,不在此重复列表。完整 finding 列表、同族扫描与方案合理性分析见评审文件:

`doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-claude.md`

该文件 §9(需求侧勘误)与本稿的对应关系:R-E1→§3.0、R-E2→§3.2 事实表、R-E3→R-S1/R-S7、R-E4→§3.5 R-P5、R-E5→§2.2、R-E6→§1.5、R-E7→§2.1/D-7。三项设计冲突(开机画面永不就绪、system notice 恢复、release 证据分档)的裁定见 §8。

### Codex 复评(对象 v3.2,2026-09-14,NO-GO 2M/4S/3N)

| Finding | 处置 | 落点 |
|---|---|---|
| M1 R-S6 的首次布局证明不了 R-S1 的首次挂载 | 接受。作者另核 `App.tsx:36-44`、`SurfaceHostController.tsx:88-100`、`ScreenContainer.tsx:40-53`:App 壳从结构上看不到 host pending 与 screen fallback。R-S1 给出可证伪的"主屏已就绪"定义;R-S6 改为就绪事实归 `ui/base/render`、原生能力归 `assembly/base/android`、向下注入,撤回 App 壳默认桥 | §3.2、U8、D-5、D-13 |
| M2 system notice 的 owner 与触发路径未定 | 接受。作者另核:全仓 system notice 恰两份,结构与文案相同;picker 不依赖它们;认证 notice 的 operation 只有 login / logout。原 R-P1 的"复用既有形态、不新造覆盖层"自相矛盾,已改。新增 R-P4:实现上收 base,身份与触发归各 feature,禁止 integration 兜底与跨 feature 复用;依据 §0.1 方向由作者裁决,不另行上报 | §3.5、B4、U13、D-14 |
| S1 SDK 57 原生事实过时 | 接受。作者读 SDK 57 源码(`SplashScreenManager.kt`、包 `build.gradle`、`withAndroidSplashMainActivity.ts`)与目录确认:无自动注册监听器,须由 Activity 注册;两个 App 的 Activity 均未注册,且在 `super.onCreate` 前 `setTheme(AppTheme)`。v3.2 的"未证实"改为"确定未集成";上一轮对 N1 的"不接受"撤回 | §3.2、§8、D-5 |
| S2 U13 / D-14 缺生命周期与 state 性质 | 接受。新增 R-P5;U13 补全绕过形态;R-P1 明确在入口处理 resolved 失败与 rejection | §3.5、U13、D-14 |
| S3 D-4 没有独立期望集合 | 接受。需求层定义期望集合(以 `package.json` 为来源,它与 graph 的相等由门强制)与运行期子集的判定来源。作者逐包比对:31 个中 30 个已满足,唯一不一致即当前静态首败 | D-4 |
| S4 §3.0 扫描全集未定 | 接受。明确含 `test/`、`test-expo/`、根目录与 tsconfig,测试夹具计入;作者检索 base 包测试与根文件,真实违反为 0 | §3.0、U11、D-1 |
| N 选择的业务失败与系统失败须区分 | 接受 | §3.5 R-P2 |
| N D-9 须分栏正常旅途与失败注入 | 接受 | D-9 |
| N S5 处置成立,batch 残余语义记入 D-3 | 接受;补 Codex 实测"显式 batch=1 当前先因 census 失败" | D-3 |
| 确认成立、无需处置 | R-S5 条件适用、裁决 ① 与 ③、不建元门、sample1 脏日志不推翻 §2.1 | —— |

### Codex 复评(对象 v3,2026-09-14,NO-GO 2M/6S/3N)

⚠️ 该复评的对象是 v3;v3.1 新增的 §3.5、U13、D-14 未经评审,下一轮须一并审。

| Finding | 处置 | 落点 |
|---|---|---|
| M1 R-S5 无条件适用 TR-11 | 接受;R-S5 改为条件适用加边界不变量,新增 R-S6 定默认 owner 与桥。作者另核:`SurfaceRoot.tsx` 的挂载观察全被 `__DEV__` 挡住,release 构建中没有现成信号。owner 与桥在 Dexter §0.1 授权范围内,不另行上报 | §3.2、D-5、D-13 |
| M2 type-only 不能推给详设 | 接受;§3.0 穷举依赖形态并明确 type-only 算依赖,D-1 只管执行 | §3.0、U11、D-1 |
| S1 三处声明一致性断言错误 | 接受并收窄:两对已由门强制相等(`check-static.mjs:223-237`、`:252`),`dependencyModuleNames` 数组值不受约束;该数组是运行期依赖来源,其漂移检测纳入本立项 | §6、U2、D-4 |
| S2 U3/U4 可被自然捷径绕过 | 接受;作者另核:重复 complete 的两条 `sequence` 相同、`timestamp` 相差约 51 秒,是同一 run 两次独立写入,不是日志重复 | §2.1、U3、U4、D-7 |
| S3 U8/D-5 未锁定 release 证据 | 接受;外部事实已亲核 | §3.2、U8、D-5 |
| S4 根配置清单不完整 | 接受并扩大:根构建配置是 6 个不是 5 个(漏 `global.d.ts`),补根目录文件全集分类 | §1.1、U12、D-11 |
| S5 batch 投影静默丢边 | 部分接受:丢边属实;但 `activeSkeletonBatch = 2`,默认门路径是全图,不会假绿。约束改为"不得以显式 batch=1 投影作为证据" | §4.2、D-3 |
| S6 App.tsx 行数缺命令 | 接受 | §1.1 |
| N1 撤回裁决 ② 合理 | 接受结论;当时不接受"原生工程确实没有完成原生接入",判为未证实。**v3.3 撤回这一"不接受"**:SDK 57 包源码证实当前未集成(见上一小节 S1) | §3.2、§8 |
| N2 无元门须有实施期 red mutation | 接受 | §4.2 |
| N3 sample1 脏日志不推翻 §2.1 | 接受 | §2.1 |
| 对裁决 ① 的补充 | 接受:上收位置不决定 owner 与运行期依赖 | §3.4 |

### Codex 评审(对象 v2,2026-09-14,NO-GO 3M/10S/4N)

| Finding | 处置 | 落点 |
|---|---|---|
| M1 U11 保护不了反向依赖 | 接受;约束升级为 base 通则 | §3.0、U11、D-1 |
| M2 "缺一即门红"不成立 | 接受;改为一等公民需求,逐项清单交详设。**不接受**"须有门验证 validator 存在"的延伸 | §4.2、D-2 |
| M3 U3/U4 日志 oracle 无因果 | U4 接受;U3 部分接受——破坏骨架写入端后任一 App 仍完整,本身就是不通过信号,已改写措辞防误读;补日志基线形态事实 | §2.1、U3、U4、D-7 |
| S1 §1 命令覆盖不全 | 接受;全部改为可复跑命令,新增反向对照规则 | §0.3、§1 |
| S2 U1 可集中白名单绕过 | 接受 | U1、D-4 |
| S3 U2 三文件同步 | 部分接受:采用"真实但未注册的运行期模块包"夹具;三处声明合一不在本立项(既有门已强制一致) | U2、§6、D-4 |
| S4 U5 相对导入/复制绕过 | 接受;已核相对导入今天无门挡 | U5、§3.0、D-1 |
| S5 U6/U7 覆盖面 | 接受 | U6、U7、D-6 |
| S6 U8 无 splash 时序 oracle | 接受;并引出作者自审更正(原生侧未就绪,v3.3 以源码定论) | §3.2、U8、D-5 |
| S7 U9 | 接受;删除"构造点为 1",沿用 TR-13 验证边界 | U9 |
| S8 U10 无冻结旅途 | 接受;引用冻结权威 | U10、D-9 |
| S9 batch 投影非闭包 | 接受;撤回裁决 ③ | D-3、§6 |
| S10 Metro/Babel/NativeWind | 接受;补 diff 证据与判据 | §1.1、U12、D-11 |
| UNVERIFIED:App.tsx、根构建配置 | 已核,移出 UNVERIFIED | §1.1 |
| UNVERIFIED:`SurfaceInputFrame` 比例、"约 42 行" | 删除这两个数字,只保留有命令支撑的存在性事实 | §1.2、§2.3 |

**作者自审新增**(非评审所提):v2"原生侧已预构建好 expo-splash-screen"不成立(v3.2 曾改判"未证实",v3.3 以 SDK 57 源码定论;§3.2);v2"splash 没有第二个合法家"不成立(§3.1);收起动作受 TR-11 约束(R-S5);base 通则现有图零违反,可直接通则化(§3.0);sample1 日志基线含逐 run 异常形态(§2.1);比较命令须附反向对照(§0.3)。
