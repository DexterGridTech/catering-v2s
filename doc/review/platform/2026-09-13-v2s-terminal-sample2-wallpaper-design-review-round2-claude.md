# sample2 壁纸终端 · 详设与实施计划 第二轮复评(收口)

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN
ROUND=2/2(规范两轮硬上限,本轮 SELF_DECIDED 收口)
REVIEWER=Claude
VERDICT=NO-GO
M/S/N=3/9/11
上轮=6/11/9
EVIDENCE_TIER=static only;未执行任何构建、测试、Metro、Web、Android、VM、DEV 或部署
METHOD=三个 fresh 独立盲审(先读源码后读交付物)+ 作者会话对全部 M 的回源码复核
```

## 0. 一句话结论

**修订是实质性的,上一轮六条 M 里五条真闭合了,剩下三条都是精确的小口子,不是架构问题。** 但三条都属于"实施者会做错或开不了工",按判据仍是 NO-GO。

| 上轮 M | 本轮判定 |
|---|---|
| M-01 Android 形态自锁死结 | **已闭合**(盲审构造反例失败) |
| M-02 像素判据无执行体 | **诚实性闭合 / 规格未闭合**——登记为第 12 个非产品位置且状态 OPEN,未冒充已有证据;但 self-test 规格自相矛盾 |
| M-03 CP 序列结构性红 | **已闭合** |
| M-04 CP-0 不可执行 | **已闭合** |
| M-05 integration 清单缺项 + 720×1280 无住址 | **已闭合** |
| M-06 三条红夹具无效 | **全部闭合**;`canonical sample` 术语已消失且被反向明禁 |

上轮 S 级:S-02/S-03/S-07/S-10/S-11 已闭合;S-04 部分闭合;S-05 **原指控被证伪**(`createOpenLayerActor` 打开时即拒不可用 part,累积有界,是我上轮判重);S-06 半闭合。

---

## M-1 · A2d 的像素腿被静默删除 · CONFIRMED

**需求正本 A2d(`:903`)是两条腿**:`WallpaperBackground` 渲染的 source 等于期望 **外加** "三张图两两不同,逐张选一轮,**每轮截图互不相同**"。

**详设两处复述只剩 identity 腿**:`design:605`("w1/w2/w3 的独立期望资源身份必须两两不同")与 `design:865`(同义)。全文检索 `两两|互不相同|distinct` 只有这两处——**像素腿不在详设任何位置,也未登记为撤回**。

**失败场景**:把三张图做成字节不同、渲染内容相同(或同一张图三次不同压缩)。`design:313-334` 对资产的唯一约束是"来源/许可证/URL/尺寸/体积",**无任何像素内容约束**。于是 identity 逐张等于期望 ✓、三 id 两两不同 ✓、确认时 ROI 满四项阈值 ✓、A3 三条全过 ✓。**用户选 w1/w2/w3 看到同一张图,全绿。** A2d 存在的唯一理由("像素有差异只证明变了,不证明变对了")被完全绕开。

**最小修复**:恢复冻结腿——对每个有序对 (wi,wj),"确认 wi 后的 ROI"与"确认 wj 后的 ROI"须满足与 A2 确认侧同一组阈值。复用同一 compare 工具与同一组 metadata,零新机制。

---

## M-2 · `changedCellFraction` 的网格坐标系与被 mask 格子的计入规则未定义 · CONFIRMED

`design:589-593` 定义 `changedCellFraction = 8×8 等面积网格中平均 max-channel 差 > 4 的格子比例`,阈值 `>= 0.75`(`:602`)。但 `:571` 把 ROI 定义为 **canvas rect 减 foreground mask**——集合相减,一般非矩形。详设未声明:(i) 网格铺在**哪个矩形**上;(ii) 完全落在 mask 内、无有效像素的 cell 算 changed / unchanged / 剔除。

**失败场景**:壁纸只铺 ROI 左上角 25%。若网格铺在**变化像素的外接矩形**上(字面允许的读法之一),该框内 64 格几乎全 changed ⇒ `changedCellFraction ≈ 1.0 ≥ 0.75` ✓,其余三项同时满足 ⇒ **通过**。上一轮 S-06 的"只覆盖一角"在**意图**上被覆盖,在**执行**上可绕开。

**反向风险(同一缺口)**:`:573` 允许 mask 占 canvas 80%。若全 mask 的 cell 计为 unchanged,**正确**实现在 picker 较大时可能跌破 0.75 而假红,而 `:598-600` 明禁"放宽阈值收口",届时无出口。

**最小修复**:网格钉死在 canvas rect(或 ROI 外接矩形,二选一写明);cell 只在未被 mask 覆盖的像素占比 ≥ 某下限时参与评估,低于下限的 cell **同时**从分子与分母剔除。

---

## M-3 · 新 assembly 的 Android 身份与 `assets/` 来源未冻结,CP-7 首步即失败 · CONFIRMED

`design:432` 只写"独立 applicationId/namespace/slug";`plan:436-437` 只写"隔离"与"prebuild 后按精确 census 纳入对账"。**全文无任何字面值。** 现有 sample-terminal 的 Kotlin 包是 `com/anonymous/sampleterminal`,即 Expo 默认脚手架残留。

同时 `sample-terminal/app.json` 引用 5 个 `./assets/*.png`,而两份文档的 assembly 文件清单(`design §6.3`、`plan CP-7`)**都没有 `assets/`**。

**失败场景**:CP-7 第一步写 `app.json` 必须自己发明四个字面值,而"精确 census"是事后记录不是事前判据;随后 `expo prebuild` 因 app.json 引用的图标不存在**直接失败**,实施者被迫临时复制或删字段,两种做法都不在任何 CP 的对账行里。

⚠️ **这条是我第一轮 S-03 提过、本轮仍未闭合的项。**

**最小修复**:`design §3.6` 冻结四个字面值(`android.package` / Gradle `namespace` / `expo.slug` / Kotlin 目录),明禁沿用 `com.anonymous.*`;`CP-7` 文件清单为 `assets/` 声明来源(复用既有 5 个 PNG 或新制,许可与尺寸同 CP-0 口径)。

---

## S 级(9 条)

| # | 内容 |
|---|---|
| S-1 | **退化成纯色仍通过全部四项阈值**——四个指标全是内容无关的幅值/覆盖度。JPG 解析没接通、`PrimitiveImage` 渲染占位色块即可全绿。**不被 M-1 的修复覆盖**(三个不同纯色仍两两满阈)。修法:确认后 ROI 补一个**自身**空间变化下限,同一工具多输出一个数 |
| S-2 | **`terminal-image-compare` 的 self-test 不可执行且自相矛盾**:`:755` 要求用**不同宽高**的已知 PNG 验 changed/unchanged 两向,而 `:611-612` 规定"尺寸不一致即 fail-closed"——只能触发失败路径。且"两组仓内已知 PNG"不在任何文件清单里,是 `canonical sample` 的同形状未定义项 |
| S-3 | **A7b 只剩 1.6° 余量,且 `error-foreground` 不在取值断言清单**。实算:`action` H=343.4°、`error-fg` H=0.0°,环形差 **16.6°**(详设写 18°);明度差 **0.071**,远低于 0.15 阈值 ⇒ 整条判据只靠色相腿。把 error-fg 微调到 `rgb(185,28,45)`(H≈354°)即降到约 10°,其余全绿 |
| S-4 | **分屏冷启动仍会误判**:`smallestScreenWidthDp` 免疫方向锁但**不免疫 multi-window**。详设只覆盖"运行后进入分屏",**直接以分屏冷启动**的平板读到窄窗口值判成 mobile 并冻结。修法:改读 display-scoped configuration,配料已在 `readDisplaySnapshot` 内 |
| S-5 | **classifier 挂在三条 `return null` 早退之下**(`handler:405/406-410/411-414`)。任一命中 ⇒ 用默认 delegate ⇒ `getLaunchOptions()` 完全不被覆写 ⇒ **JS 侧静默按 laptop 起**。详设"读到坏值 ⇒ laptop + 诊断"覆盖不到"classifier 压根没跑" |
| S-6 | **新 assembly 取 `batch: 1` 无任何理由**,而它是 `batchOne=16` 的唯一来源。实施者按语义写 `batch: 2`(完全站得住)会让 `check-static.test.mjs:24` 红,而无依据分辨是自己写错还是计划写错 |
| S-7 | **`WallpaperId` 闭合联合字段缺席不会红**:`closedUnionDefinitions`/`closedUnionConsumers`/`closedUnionConsumerCount` 在 checker 里**全是可选,不写就整段跳过**。实施者写出不带这些字段的 invariant,全门绿,再在 CP-9 宣称"闭合联合门已覆盖新包"——**存在性判据冒充语义判据,红夹具也抓不到** |
| S-8 | **CP-0 的 probe 会弄红 sample-console 自有 focused test**(`test/sampleAssembly.test.tsx`、`test/hostShape.test.ts` 直接断言被接入的文件),而 CP-0 六条 gate 无一说明 probe 窗口内这些测试的预期状态 |
| S-9 | **CP-7 的 Web dev-host gate 与 `devDependencies=[]` 冲突**:加 dev-host 依赖会让 `assertEqualSet(devDependencies)` 红,不加则 gate 无法满足。二选一须写死 |

---

## N 级(11 条,摘要)

`readDisplaySnapshot` 的失败出口实为两条(`display-manager-unavailable` / `display-snapshot-failed`)加 handler 自身两条,"逐分支可测"的分母写少了;阈值取数路径未写,而 `logConfiguration`(`handler:54-63`)**今天就已打印 `smallestWidthDp=`**,跑现有 sample-terminal 即可取数、零新增代码;`setRequestedOrientation` 的 laptop→? / mobile→? 映射全文未指定;"仅 config change 不重算"的成立前提是 manifest 保留那四项 `configChanges`,而本批恰好要编辑同一行,未登记为不变量;`openedAt` 的统一 validator 覆盖 serializer 与 parser 但**未包括 reducer**,三侧仍不一致;§4.2 不变量 8(mobile 无 SECONDARY)在详设四条实施形态里无落点,只存在于 plan;A2 未确认侧上限 `<=0.001` 与噪声基线否决线 `>0.001` **重合,零余量**;确认侧 `>=0.75` 对 image→image 无资产内容约束,两张主色调接近的照片可能使正确实现假红;CP-8 对 layering 用"变更"、对 skeleton 用"复核",措辞不一致;CP-8"只负责最终运行门"略强于其 gate 清单实际内容;形态翻转后陈旧模态弹回是 Dexter 既有裁定的**已知后果**,应写进 `ui-state` README,不另行上交。

---

## 已裁定,不上交

浮层恢复与红色主题范围两项,Dexter 均已裁过,本轮不重开。由此衍生的工程缺口(S-1/S-3 等)属"做得对不对",仍须修。

---

## 授权边界

静态只读,零仓内写入(本文件除外)。不授权实施、构建、Metro、Web、Android、VM、DEV、部署或数据操作。**本轮为两轮硬上限的第二轮,SELF_DECIDED 收口**:M-1/M-2/M-3 修完即可交 Dexter 判断是否放行实施,不再另开对抗审查轮次。
