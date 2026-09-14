# sample2 壁纸终端 · 实施评审(第二轮 · 收口)

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913
REVIEW_ROUND=2(⚠️ Dexter 2026-09-14 裁定:本 cycle 不设两轮上限,本轮不收口)
REVIEWER=Claude
VERDICT=NO-GO
M/S/N=6/8/11
上轮=5/8/10
EVIDENCE_TIER=static only;未运行任何构建、测试、Metro、Web、Android、VM、adb 或部署命令
METHOD=三个 fresh 独立盲审(先读源码后读交付物)+ 作者会话对三条 M 的回源码亲验
```

⚠️ **轮次说明**:本轮交接标注 `REVIEW_ROUND=1`,但同一 `REVIEW_CYCLE_ID` 的第一轮已于 2026-09-14 交付(NO-GO 5M/8S/10N),故本轮记为第 2 轮。**Dexter 2026-09-14 裁定本 cycle 不设两轮上限**,因此本轮**不收口**,修订后继续复评。

---

## 0. 上轮五条 M 的闭合判定

| # | 判定 | 依据 |
|---|---|---|
| M-1 ScrollView 糊死壁纸 | **部分闭合** | 源码是最小修法且正确:`tokens.ts:33` 新增 `scrollTransparent`、**原 `scroll` token 一字未动**(三个既有消费者不受影响)、`PrimitiveScrollView.tsx:17,43-45` 加 layout 分支、picker `:67` 显式传入。ROI 也核对了:遮罩只盖 3 张卡片 + 确认键,`roiPixelCount` 与 metric 逐位相符。**残留见 S-1** |
| M-2 产物全在 `/tmp` | **部分闭合** | `cp7-android/` 现有 33 个归档 + `SHA256SUMS.txt`。**但被 handoff 冻结引用的 a3-pair 证据仍全在 `/tmp`**,见 M-4/M-5 |
| M-3 F_A5 恒真 / F_A9 不判 A9 | **部分闭合** | F_A5 这半条**真闭合**:改走 `runAdmissionMutation` 并诚实标注准入层,另新增真正到达持久化路径的 `F_A5_RUNTIME`。F_A9 仍是 guard-only,见 M-6 |
| M-4 A3(c) 无锚 / 六 pair 报两遍 | **未闭合** | 见 M-5 |
| M-5 既有 App 回归 | **✅ 已闭合** | `sampleAssembly.test.tsx:679-733`:固定 `persistenceKey`、同一 storage、二次启动、断 `selectLayers` 含 `admin.console.layer` 与业务 partKey。盲审构造反例推翻失败 |

---

## M-1 · responder 修复把"点空白收键盘"在真机上整条删除了 · CONFIRMED(作者亲验)

**这是本轮最重的发现:修复不是修好了,是让那条路径死了。**

| 事实 | 位置 |
|---|---|
| `surface-content` 样式 `{flex:1, width:'100%'}` | `InputSurfaceFrame.tsx:187-190` |
| 其**唯一子节点**(AdminLauncher observer)也是 `{flex:1, width:'100%'}` | `AdminLauncher.tsx:124-127` |
| 判定式 `event.target === event.currentTarget` | `InputSurfaceFrame.tsx:149` |

Android 的 `TouchTargetHelper` 返回**最深命中节点**,子节点满铺不留像素 ⇒ `event.target` 永远是子节点 ⇒ **判定式恒为 false** ⇒ `onStartShouldSetResponder` 恒 false ⇒ `onResponderRelease` 永不触发 ⇒ `dismissActiveField` 永不被调用(全仓唯一调用点)。

**"ScrollView 滑动恢复"与"点空白收键盘死亡"是同一个恒假谓词的一体两面。**

⚠️ `dynamic-evidence-codex.md:24-26` 明确声称"在该节点的 `onResponderRelease` 上**保留**直接表面点按收键盘"——**该声称不成立**。

**影响面**:改动落在 `ui-base-input` 共享边界,**两个 console 同时受影响**。修复前的 `Pressable` 版本这条路径是通的(Pressability 在 bubble 阶段兜底),所以是**真实功能回归**,不是"原本就没有"。

⚠️ **根因判断本身 CONFIRMED**:RN 0.86 的 `Pressable.js:336-337` 是 `{...restPropsWithDefaults}` 后再 `{...eventHandlers}`,Pressability 生成的全部 responder handler **无条件覆盖**外部同名 prop。所以"保留 Pressable 只换一个不冲突的 prop"确实不可行。

**验收判据(必须可证伪)**:mobile 上 focus 任一虚拟键盘字段后,点击屏幕上任意非输入、非按钮区域,虚拟键盘消失,并给出 Android hierarchy/截图前后对比。仅 `provider.test.tsx` 绿不构成通过。

---

## M-2 · 修复违反了仓内**早已立过并加了守门断言**的同一条规矩 · CONFIRMED(作者亲验)

`AdminLauncher.tsx:44-48` 的注释原文:

> This node is **deliberately a plain View**: it has **no responder negotiation** or press handling of its own, **so descendants keep their normal touch behavior**.

而 `sample-console/test/sampleAssembly.test.tsx:312` 有守门断言 `expect(launcher.props.onStartShouldSetResponder).toBeUndefined()`。

**本次把 `onStartShouldSetResponder` 加到了 AdminLauncher 的直接父节点上**——对业务内容而言是同一层祖先、同一个危害。**而守门断言按节点写死,照不到回归的那个节点。**

**最小修复方向**:要么让 `surface-content` 遵循同一约定(无 responder 协商),要么把约定改写成"业务内容祖先链上不得出现 responder 协商"并让守门断言覆盖整条链。

---

## M-3 · A7b 的"红不撞错误色"判据在数学上不可能变红 · CONFIRMED(作者亲验)

`theme.test.ts:75` 写的是 `Math.abs(hue(action) - hue(error))` —— **非环形距离**。

| 量 | 值 |
|---|---|
| action hue | 343.4° |
| error-foreground hue | 0.0° |
| `Math.abs(a-e)` —— 测试用的 | **343.4**,轻松过 `>= 16` |
| 真实环形距离 | **16.6°**,离阈值只剩 0.6° |

**反例(已算)**:把 action 改成 `[220,20,30]`(hue 357°,与 error 真实相距 **3°**,正是"红得分不清"的样子),`|357-0| = 357`,**断言照过**。

⚠️ **§9.2 那条判据是我写的,写它的全部理由就是"纯 HSL 阈值挡不住刚好差 15° 的恶意实现"。当前实现比我担心的那个还弱。** 另外我原文是"色相差 ≥15° **或** 明度差 ≥0.15",实现写成"色相差 ≥16 **且** `luminance(action) !== luminance(error)`"——后半条对任意两个不同颜色近乎恒真,**不是那个 0.15 的门**。

**最小修复**:环形距离 `min(d, 360-d)`,阈值回 15;明度分支实现为真正的 `|L_action − L_error| ≥ 0.15` 并按 **OR** 组合;新增一条把 action 设为 357° 系的红夹具证明它能变红。

---

## M-4 · Android 档结论不可重算,且"当前字节"对 laptop 不成立 · CONFIRMED

仓内标为"当前字节"的 laptop 产物**不含任何壁纸确认循环**;带壁纸的 `laptop-w2/w3-confirmed-*.png` 时间戳 **11:21**,早于 `dynamic-evidence-codex.md` 自述的最终 responder 重建(**11:57–12:03**)。

A4 双态文案、A8 完整旅途、A2①、当前字节 A3 pair、以及全部 7 个 Android 红夹具的产物仍只在 `/tmp` 或 `/sdcard`。

⚠️ **待 Codex 解释的字节恒等**:`SHA256SUMS.txt` 里 `laptop-w3-confirmed-secondary.png` 与 `laptop-post-build-secondary-clean.png` **哈希完全相同**;另三张 mobile 截图同为一个哈希。"确认后"与"构建基线"逐字节相同——**可能是重启恢复导致同态(合理),也可能是同一文件改名充数**,evidence 未给区分说明。

---

## M-5 · A3(c) 仍未闭合;交接材料仍把镜像行当双向证据 · CONFIRMED

`compare.mjs:196-230` 四项指标全由 `|first−second|` 导出,**对调入参数学上必然逐位相同**。证据自证:`current-a3-pair-codex.md` 的 `w1→w2` 与 `w2→w1` **16 位全同**。

**三处叠加**:①交接材料 `:21` 仍原样写"主屏六个与副屏六个 directed ordered-pair",一字未改、未标注镜像;②把 w1↔w2 称为"fresh **双向** ROI 对",正文"All four outputs..."把 2 个独立观测当 4 个;③**该 a3-pair run 的 `EXECUTED_AT` 是 07:54–07:58,取自 responder 修复前的源码**。

⚠️ §9.3 的 (c)「换选另一张再确认,两屏再次各自改变」在当前字节仍只捕获**一次**跃迁。**(c) 正是我为抓"副屏被钉死在某张图上"而加的第三条**,(a)(b) 单独都抓不住它。

**盲审的判词值得引**:整改动作发生在 evidence 正文,**却没回改交付材料的分母措辞,等于"修了事实、没修主张"**。

---

## M-6 · 唯一真正判 A9 的红夹具既不可复跑也不可核验 · CONFIRMED

`F-A9_RUNTIME` 方向做对了——它改 `App.tsx` 固定 `displayIndex=1`,正面击穿"入口只请求 displayIndex 0"这个 A9 禁止条件。但:

- **不在 `check-behavior.mjs` 里**(`grep -c F_A9_RUNTIME` = 0),一次性手工 run,不可复跑、不防回归;
- 全部 readback 在 `/tmp`,未进仓;
- 承重的两条事件是**文内转录文本**,在仓的 `mobile-log-filtered.txt` 中 `SECONDARY` 出现 **0 次**(该日志来自另一次 run)。

仓内可复跑的那条 F_A9 按作者自己的标注只到 admission 层。**M-2 的缺陷在 M-3 所依赖的唯一一项上原样复现。**

---

## S 级(8 条)

| # | 内容 |
|---|---|
| S-1 | **透明变体的 token 值无字面锚,可一行改回不透明而全绿**。`primitives.test.tsx:135` 是 `toBe(baseTokens.scrollTransparent)`——**与被改的同一常量比较,循环断言**;`sampleWallpaperPicker.test.tsx:136` 只断 `layout === 'transparent'`(需求排除的判法);12 条变异**无一落在 `tokens.ts`**。对照:同文件 `:77` 对不透明默认值用的是**字面串** |
| S-2 | **现有测试只能证伪谓词,不能证伪接线**。`provider.test.tsx:476-492` 手工构造 `{target, currentTarget}`,react-test-renderer 不做命中测试。盲审给了三个能全绿但行为错的实现,**第三个就是仓内代码本身** |
| S-3 | **A2① 的唯一 device 证据是 `/tmp` 里一个完美 0,且无 positive control**。ROI 已遮住控件,所以"0 变化"既可能是正确行为,**也可能是两张图是同一份文件**,当前记录不可区分(文件名带 `-v2` 暗示重试) |
| S-4 | **mobile ROI 遮罩与同一份 evidence 记录的真实控件几何错位 28px**;picker 可滚动,固定像素遮罩只在某一滚动位移下成立,而 mobile 为够到确认键必须 swipe |
| S-5 | **A5c 的"逐字相同"降级为"layerId 存在"**(`sample2Assembly.test.tsx:267-268`),`partKey`/`props` 被丢弃或改写测试仍绿 |
| S-6 | **A7b① 断的是 CSS token,不是 `PrimitiveButton` 实际渲染的组合**——从未 mount 任何按钮 |
| S-7 | **A3(b) 与 A9 后半句在 device 档无执行位置**。§9.3 明写 (b) 单独是声称不是行为、三条须同时成立,而 (b) 只有 focused |
| S-8 | **a3-pair 证据被列为冻结输入,全部产物却在 `/tmp`**;M-2 的整改只覆盖了 11:57 那次 run |

---

## N 级(11 条,摘要)

`onStartShouldSetResponderCapture={() => false}` 是死代码(返回 false 即 RN 默认,不影响任何后代协商),其测试断言的是恒真命题;Android 复验只覆盖了 responder 修复的一半(只走滚动路径,零条验证"点击表面仍收键盘");自报"11 个反向变异"而实际 12 条;两个冷启动测试的 `partKey` 断言不具区分力(该值就是 boot 默认);`check-behavior.mjs` 不被任何门引用,是手工脚本;`compare.mjs` 只产指标不产 verdict,阈值在散文里人工比对;A7 的"取值确为红系"退化为"必须是这个值"(改蓝并同步期望表即可全绿);`ok/warn/info` 的"与既有取值一致"对照表是本文件自写副本而非读取 `sample-console` 的 `global.css`;`cp7-execution-codex.md:29-38` 的 responder 旧修法仍以肯定语气留存、未标注已被后段推翻;`cp7-execution-codex.md` 内 F-A2b 状态自相矛盾(`:348` 写 OPEN、`:390` 又描述已执行);上轮点名的 "ROI metadata 生成首败"在当前 evidence 中找不到对应记录。

---

## 需 Dexter 裁决(1 条)

**表面级"点空白收键盘"这个交互本身还成不成立。** 在当前架构下,`surface-content` 之上**不存在空白像素**——每个像素都属于某个 Screen。三个候选:(甲)恢复旧语义(点任意非输入/非按钮区域收键盘,代价是会掐手势);(乙)表面级不做 dismiss,收键盘只由 complete 键、焦点切换、返回键负责;(丙)只在特定 Screen 的留白区域做,由业务层自己声明。

⚠️ **无论选哪个,M-1 都必须修**——要么恢复功能,要么明确删除并改掉 evidence 里"已保留"的声称。**当前是"功能已死而文档声称还活着"。**

---

## 应当记功的部分

M-5(既有 App 回归)**真闭合了**,盲审构造反例推翻失败:固定 `persistenceKey` + 同一 storage + 二次启动 + 断 `selectLayers` 与业务 partKey,用的是真实 assembly 不是自造 catalog。

M-1 的源码修法是三个候选里最小的一个,**原 `scroll` token 一字未动**,取舍正确。M-3 的 `runAdmissionMutation` 把"变异在准入层被拒"与"变异到达行为"分开打印,是诚实分层而非改名掩盖。

Pressable 的根因判断 CONFIRMED(RN 0.86 的 Pressability 确实无条件覆盖同名 prop),换成普通 View **没有丢无障碍语义、反而是净改善**(旧实现等于给整个业务表面套了个无 role 无 label 的巨型 accessible 元素)。

A2c 的四条断言(status≠completed、具名 code、state 逐字、journal 零子命令)是本批质量最高的一条判据。六处首败的归因基本准确,其中 responder 那处**自我纠正**(先记旧修法、后回读 RN 源码发现 Pressability 覆盖、改为普通 View)是最好的一处处置。

---

## 授权边界

静态只读,零仓内写入(本文件除外)。**Dexter 已裁定本 cycle 不设两轮上限**,故本轮不收口:六条 M 修订后继续复评,直至 M 级清零或 Dexter 另行裁定。

Web / release / native 真机本轮维持 **NOT_RUN**,未被隐性当作通过。**不得把 focused、Android partial、静态门或 cleanup PASS 写成完整 implementation acceptance GO、visual PASS 或 release PASS。**
