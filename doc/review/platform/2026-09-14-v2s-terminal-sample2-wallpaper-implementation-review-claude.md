# sample2 壁纸终端 · 实施评审(第一轮)

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913
REVIEW_ROUND=1/2
REVIEWER=Claude
VERDICT=NO-GO
M/S/N=5/8/10
EVIDENCE_TIER=static only;未运行任何构建、测试、Metro、Web、Android、VM、adb 或部署命令
METHOD=三个 fresh 独立盲审(先读源码后读交付物)+ 作者会话对 M-1 的回源码亲验
```

## 0. 先说做对的

三个维度的盲审各自**主动否掉了若干怀疑假设**,这些是本次交付扎实的部分,逐条记:

- **picker 只产 UI intent**:`WallpaperPicker.tsx:2-5` 只 import 本包命令,`:50/:59` 派发本包 intent,组件内无任何 kernel 命令。TR-11 形态成立。
- **actor 三条判断齐**:重复选已选项(`picker/actors.ts:26`,用 `pending ?? confirmed`)、重复确认(`:33`)、无 pending 确认——kernel 侧 `sample-wallpaper/actors.ts:28-30` **真的抛错**,不是返回 payload 字段;`test/sampleWallpaper.test.ts:89-111` 四条齐(status≠completed、具名 code、前后 state 逐字、journal 零子命令)。
- **`assetsById` 的 oracle 不是自证**:`test/sampleWallpaperPicker.test.tsx:29-31` 从 `'../assets/w1.jpg'` **直接 import** 期望值,与被测映射无共享路径。盲审专门去证伪这条,失败。
- **`WallpaperBackground` 只读 confirmed**,pending 不泄漏。
- **浮层三件事真修了**:containers 保留(展开式 `applyPersistedLayerEntries` + `content.test.ts:248-281` 同一次重启联合断言)、`openedAt` 三侧同一个 `isValidOpenedAt`、四格清理显式遍历且 `content.test.ts:389-433` **两个方向都覆盖**(stale 在 BRANCH 而当前是 MAIN)。盲审评四格那条是本批最强的测试。
- **门与身份闭合**:31 个节点、三处硬编码计数(31/16/31)盲审独立数过全对;`uiNativePackages` 是目录枚举**不是硬编码**,新 integration 自动进分母;新 assembly 的五项身份标识与 sample-terminal 全部不同,`assets/` 齐全。
- **`tools/terminal-image-compare` 质量好**:self-test 覆盖同图零变化、异图有变化、尺寸不符抛错、稀疏大 delta 与密集小 delta 的 cell 口径、PNG 错误路径,**以及阈值常量变异必须翻转 oracle**。
- **TR-13 满足**:新 integration 的 admin-shell 依赖、`adminShellAssembly.parts`(`assembly.tsx:183`)、生产 `AdminLauncher`(`:302`)三点齐。
- **归因准确**:首败(picker 误加 admin-shell 边被门拦下)、误标 w2 截图已从最终 metric 排除、`screencap -d 2` 失败改用真实 SF id 且未混淆 logical display index、`power-bridge.subscription-unavailable` 正确归为既有可选端口未混入 PASS。

---

## M-1 · `PrimitiveScrollView` 的 `bg-canvas` 把刚做透明的容器又糊死了 · CONFIRMED(作者会话亲验)

**这是 C2 的失败形态本身,只是下沉了一层。**

| 事实 | 位置 |
|---|---|
| `scroll: 'w-full flex-1 bg-canvas'`,**紧邻上方注释是作者自己写的** "ScrollView's className styles the viewport on native" | `ui/base/primitives/src/theme/tokens.ts:27-30` |
| `className={baseTokens.scroll}` —— **唯一来源,无 layout 变体** | `PrimitiveScrollView.tsx:43` |
| 透明 `PrimitiveContainer` 内**紧接着**套 `PrimitiveScrollView` | `WallpaperPicker.tsx:65-67` |
| `containerTransparent: 'flex-1 p-6 gap-4'` —— 容器那层**确实做对了** | `tokens.ts:8` |

**失败场景**:laptop PRIMARY 上 picker 在屏时,能透出壁纸的只有 `p-6` 那一圈边与标题行,中间约九成面积被不透明 slate-100 覆盖。用户点确认换壁纸,主屏上看到的变化只有那圈边。

**为什么现有门抓不住**:①唯一的透明性自动化证据是 `sample2Assembly.test.tsx:204` 的 `expect(containerFor(...).props.layout).toBe('transparent')` —— 需求 `:958` 明写 A2 排除三种判法,**第②种就是"只断言组件用了哪个 layout"**;②A2 的真机 ROI 定义为"canvas 扣除 picker 控件矩形",而滚动视口既不是"控件"又覆盖绝大部分 ROI,剩下的边框环在确认后确实会变,**A2 仍可能全绿**;③红夹具 F-A2a(把容器改回默认)照样能红——**夹具有效,却测不到缺陷所在的那一层**。

**影响面**:仅 PRIMARY picker 屏。副屏 waiting/welcome 用 `PrimitiveStatus` 纯文本无 ScrollView,壁纸完整可见——所以 A3 双屏断言不受影响,**这条只能靠主屏亲验**。

**最小修复**:给 `PrimitiveScrollView` 加透明变体(`scrollTransparent: 'w-full flex-1'`),picker 用它。**不能直接从 `scroll` token 删 `bg-canvas`**——它另有三个消费者(`InputScrollArea`、admin-shell 两个 section)依赖这层不透明,改全局会波及既有 App。这与当初给容器加变体而不改 `container` 的取舍完全同构。

**连带必须改 A2 的 ROI 定义**:不得再把滚动视口当"控件矩形"扣掉,否则 ROI 只剩那圈边。新 ROI = canvas 扣除四个选项卡片矩形与确认按钮矩形;红夹具为把 picker 的 ScrollView 换回带 `bg-canvas` 的变体,该判据必须红。

**性质**:仓内事实(token 值、className 透传路径、组件组合);**视觉结果是推论**,未在设备上观察。

---

## M-2 · 设备级产物全部落在 `/tmp`,Android 与 visual 结论在评审时不可核验 · CONFIRMED

`doc/evidence/platform/` 下唯一进仓的产物是三个 ROI metadata JSON。截图、XML、metric JSON、Metro transcript 全部是 `/tmp/ter-sample2-*`(`cp7-execution-codex.md:46-53,202-216,279`),**评审时不可读**。

按仓内"evidence 判据必须可证伪"与"亲验纪律",这类结论只能记 `UNVERIFIED_REQUIRES_EVIDENCE`。受影响:A1 截图侧、A2、A2d、A3、A4、A5/A5b 真机侧、A6、A8,以及 F-A2b / F-A3a / F-A3b / F-A5b / F-A5d / F-A9_RUNTIME 的设备档位。

**最小修复**:把承重的 metric JSON 与其所引截图的**校验和**落进 `doc/evidence/platform/`(截图本身可按大小取舍),使第三方能重算 compare 结果。**这不是要求建 CI 或产物仓,是让已经跑出来的数字可被重算。**

---

## M-3 · 红夹具矩阵的分母被高估:两条不判它所命名的行为 · CONFIRMED

`tools/terminal-sample2/check-behavior.mjs` 逐条打印 `SAMPLE2_<ID>_RED=PASS`,`cp7-execution-codex.md:525-529` 以"11 个变异均以 `mutation_exit=1` 命红"收口。其中:

- **F_A5**(`check-behavior.mjs:62-65`):把 `persistIntent` 改 `'never'`,而 `defineStateRuntimeSlice.ts:57-61` 在**非 owner-only 且 persistence 非空时直接抛错** ⇒ 变异在 **slice 定义期**即被拒,**从未到达持久化路径**,红是恒真。作者在 `cp7-execution-codex.md:536` 已承认这一点,但夹具仍留在 harness 且无标注。
- **F_A9**(`:133-138`):作者自己的 `cp7-execution-codex.md:371-373` 写明"该 guard-only 变异**没有形成有效的设备红夹具**"。该条仍在 harness 中且无标注。

**F_A9_RUNTIME 不是 A9 的有效反例**(收窄,非推翻):它同时改了调用方(`displayIndex=1`)与 assembly 的两个保护,证明的是"当调用方违反入口契约时保护在挡";**不证明部署态 mobile 路径受这两个保护约束**——部署态 A9 其实由"入口只请求 `displayIndex=0`"保证,而**那一点没有任何红夹具**。且它不在仓内 harness,无法复现。

**最小修复**:harness 对这两条加注其实际判定对象,或把 F_A9 换成真正作用于 A9 禁止条件(入口只请求 displayIndex 0)的变异。

---

## M-4 · A3(c) 在当前字节无锚;"六个 directed pair"是三次比较报了两遍 · CONFIRMED

`tools/terminal-image-compare/compare.mjs:166-236` 的四项指标全部由 `|first−second|` 导出,**对调入参在数学上必然逐位相同**。证据自证了这一点:`current-a3-pair-codex.md:38-43` 的 `w1→w2` 与 `w2→w1` 的 changedFraction **16 位全同**;`cp7-execution-codex.md:207-216` 的另两对同样成对逐位相同。

**更重要的是**:需求 §9.3 的 (c)「**换选另一张再确认,两屏 ROI 再次各自改变**」要求**两次连续确认各产生一次变化**。当前字节的 fresh run 只捕获了**一次**已确认→已确认跃迁(w1 confirmed → w2 confirmed)。

⚠️ **(c) 正是我为抓"副屏被钉死在某一张图上"而加的第三条**——(a)(b) 单独都抓不住它。现在它没有当前字节的锚。

**最小修复**:同一 run、同一几何下补一次 `w2 confirmed → w3 confirmed` 的双屏对;报告里删去反向行,或明确标注为同一比较的镜像、不计入分母。

---

## M-5 · 详设 §3.3.4 最后一条承诺未交付,交付的是 substring 匹配 · CONFIRMED

详设 §3.3.4 要求"在既有 sample App 的回归中验证没有把业务 layer 或屏幕 container 清掉"。实际交付的是 `sample-console/test/sampleAssembly.test.tsx:669-672`:

```
expect(persistedValues.join('\n')).toContain('admin.console.layer')
```

**把所有写入拼成一个字符串做 substring 匹配,没有重启、没有 hydrate、没断任何 partKey/state。** 而该文件 **23 处 `persistenceKey` 全部**形如 `` `...-${Date.now()}` `` —— **没有任何测试用同一 key 二次启动**,sample-console 的冷重启覆盖为 **0**。

**失败场景**:`pruneHydratedLayersCommand` 现在在每个用 ui-state 的 App 的 install 期无条件运行并删 state。若 sample-console 的 catalog 与它实际 open 的 layer partKey 出现任何漂移,重启后该业务浮层被静默删除并 flush 到存档——**当前 23 个测试没有一个会红**。

⚠️ substring 匹配正是仓内规范明禁的"用关键词/字段匹配把语义伪装成 checker"。

**为什么不能靠 ui-state 的 `content.test.ts` 顶替**:那里用 `createTestLayerCatalog` 自造 catalog,**恰好绕开了"真实 App 的 catalog 与真实 App 实际 open 的 partKey 是否一致"这一唯一新增风险点**。

**最小修复**:sample-console 增加**一个**测试——同一 `persistenceKey` + 同一 recording storage 启动两次 assembly,第二次断言 `selectLayers(...)` 含 `admin.console.layer`、业务 container partKey 未变。不需要跑完整旅途。

---

## S 级(8 条)

| # | 内容 |
|---|---|
| S-1 | **唯一的透明性自动化证据恰是需求预先排除的判法**(`sample2Assembly.test.tsx:204`)。把 `containerTransparent` 改成含 `bg-canvas` 该测试仍全绿——M-1 就是这条的现实实例。修法:该用例降格写清它不判可见性,可见性归 A2 真机 ROI |
| S-2 | **`LayerStack` 的可用性过滤从冗余防御变成唯一防线,而 render 包 12 个测试文件对 `isUiCatalogEntryAvailable` 零引用**。本 CP 之前该状态不可达;之后 `content.test.ts:435-461` 明确断言这种 layer 会被保留。删掉整个 filter,ui-state 38 个测试与 render 全部测试都不会红 |
| S-3 | **同一可用性谓词在写入/还原/渲染三侧给出三个不同答案**(硬失败 / 保留 / 隐藏),被保留的隐藏层**永久不可见、不可关闭、无年龄或会话边界**,版本回摆时陈旧 modal 会带旧 props 弹回 |
| S-4 | **A5d 缺跨重启断言**:仓内只有同一 runtime 内的"确认清 pending";F_A5D 命红的也是同 runtime 那条 |
| S-5 | **A5c(浮层恢复)在 sample2 层零断言零夹具**,只有基座 `ui-state/test/content.test.ts`;evidence 写的是"恢复**观察**"——观察不是断言 |
| S-6 | **picker 的 `test/` 引入未声明的 workspace 边**(`sampleWallpaperPicker.test.tsx:6` import platform-ports),而 `collectStaticImportSpecifiers` **只扫 `src`**,三处声明都没有它、也没有门能抓。对照 kernel 包是规规矩矩声明的 |
| S-7 | **A2d 的"三张图两两不同"全仓无断言**。若三个 `assets/w*.jpg` 内容相同,全部 focused 测试与 F_A3b 仍全绿 |
| S-8 | **副屏顾客文案直接压在照片上,无对比度保障**。`PrimitiveStatus` 是 `text-sm` 的 slate-600,叠在用户自选的 `cover` 照片上;副屏是顾客看的唯一信息面。A4 只要求"截图上可见文本含该文案",未定义"在任意壁纸下可读" |

---

## N 级(10 条,摘要)

`clearPending` reducer 全仓无消费者(来自需求"照 member-registry 三件套"的形态复制);`WallpaperBackground` 的 testID 硬编码未进本包 testIds 正本且在四处重复;真实往返的多层顺序无覆盖而 `content.test.ts:248` 标题却写着 "with order"(单元素数组);改写后的 U-7 与 `content.test.ts:248-281` 形状逐行对应、判别力增量约等于零;非法 `openedAt` 只证伪了 `isValidOpenedAt` 四个条件中的 1 个(删掉 `Number.isInteger` 或 `typeof` 现有测试不会红);非法 props 测试绕过存储路径(合理取舍但真实路径近乎不可达);`sample-terminal` assembly 零测试文件(既有欠账,建议进 `HANDOFF.md`);两个 integration 的 `plannedKind` 字段不齐(sample-console 有、sample-wallpaper-console 无,门不设限);新 assembly `batch:1` 依赖 `batch:2` 的 integration(既有约定,非 sample2 引入);`slice.ts:31` 缩进异常(红夹具写-跑-还原循环的手改残留)。

**副屏历史 `w1→w2` 值与 fresh 值逐位相同**,说明副屏侧复用了同一批字节,作者未说明,记 `UNVERIFIED`。

---

## 已裁定,不上交

盲审提出"浮层是否本就该跨冷启动恢复"(方案方向),Dexter 已两次裁定纳入本批,**不重开**。其中"浮层恢复了而业务上下文没有"这一技术点,需求 §3.6.2 已明确归属(各 feature 自负,且须写进 `ui-state` README),属已覆盖项。

---

## 需求正本本轮同步的两处(我的错,已修)

§3.2 的形态块仍写组件派发 kernel 命令(已被 §3.2.2 推翻,实现是对的、文档没回改);§9.1 的 **F-A2c** 夹具描述与期望判据编号错配(应打 A2b,不是 A2c)。

---

## 授权边界

静态只读,零仓内写入(本文件与需求正本两处补正除外)。**本轮为实施评审第一轮(上限两轮)。** 不授权源码修复、构建、运行、Web、Android、release、部署或下一阶段工作。即便后续转 GO,也只表示当前实施材料可交后续处理,**不得写成完整 implementation acceptance GO、visual PASS 或 release PASS**。
