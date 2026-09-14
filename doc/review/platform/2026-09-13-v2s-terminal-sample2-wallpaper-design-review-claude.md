# sample2 壁纸终端 · 详设与实施计划评审

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN
REVIEWER=Claude
VERDICT=NO-GO
M/S/N=6/11/9
EVIDENCE_TIER=static only;本会话未执行任何构建、测试、Metro、Web、Android、VM、DEV 或部署
METHOD=三个 fresh 独立盲审(先读源码后读交付物)+ 作者会话对全部 M 的回源码复核
```

被审:
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`

三个盲审各自结论:NO-GO 3M/4S/4N(Android 与 ui-state 机制)、部分可实施 3M/5S/3N(包图门与计划)、NO-GO 3M/7S/5N(主题与像素判据可证伪性)。去重后如下。

---

## M-01 · Android 形态判定是自锁死结 · CONFIRMED

**位置**:详设 §3.7(`design:450-475`);`apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml:19`;`app.json:6`。

**详设声称**:读 `activity.window.decorView.resources.displayMetrics` 算 `widthDp/heightDp`,`width>height ⇒ laptop`、`width<height ⇒ mobile`,**明写"不使用 smallestWidth 阈值"**;同时删除 sample-terminal 的两处方向锁;判定在 delegate 创建期冻结。

**为什么不成立**:`displayMetrics` 的宽高是**当前 window 的姿态**,不是设备属性。

| 情形 | 后果 |
|---|---|
| 删了方向锁 | 形态 = 冷启动那一刻设备被怎么拿着。同一台机横着开判 laptop、竖着开判 mobile,而详设明令冻结不重判 ⇒ **§5 的像素判据在同一台机上不可复现** |
| 保留方向锁 | `widthDp > heightDp` 恒成立 ⇒ **`mobile` 分支永远走不到** |
| 任一路径落进 laptop 后 | 判定 laptop ⇒ `setRequestedOrientation` 锁横屏 ⇒ 下次重建读到的是**自己锁出来的横屏** ⇒ **永久 laptop,不可逆** |

**失败场景**:mobile VM 上,上一次进程残留的 landscape 锁、系统恢复任务栈、或冷启动时 window metrics 尚未按新方向稳定,任一条命中即永久判成 laptop。WP-F06 若只跑全新安装冷启动,全绿。

**最小修复方向**:形态输入换成不被本 App orientation 请求扰动的量——`Configuration.smallestScreenWidthDp`,或 `WindowManager` 的 maximum window metrics 短边;阈值由两台 VM 实测钉死。这样删不删方向锁与形态判定解耦。

**为什么不是更小的方案**:只加"重建后 decision 不变"的断言不够——它锁住的是错误结论的稳定性,不是结论的正确性。

**分类**:仓内事实(manifest 与 displayMetrics 语义)+ 推论(自锁循环)。不需 Dexter 裁决。

---

## M-02 · §5 的像素判据没有执行体,且不在分母内 · CONFIRMED

**位置**:详设 §5(`design:546-598`)、§6.1(`design:601-618`)、§9(`L2_SCRIPT_ADMISSION=BLOCKED`)。

**详设声称**:app content bounds 提取、canvas rect 映射、testID 节点 mask、逐通道 sRGB 差、`changedFraction`、P95、noise baseline、SHA-256 证据包。

**仓内事实(已亲验)**:`pixelmatch` / `changedFraction` / `noiseBaseline` / `foregroundMask` / `screencap` 在 first-party 源码**零命中**;唯一命中在 `node_modules/react-native-svg` 自己的 devDependencies 里。任何 first-party `package.json` 都没有图像比对依赖。

**失败场景**:什么也不建,全部相关场景按 §5.1 第 5 条落到 `UNVERIFIED_REQUIRES_EVIDENCE`,报告写"方法学已定义"。A2/A3/A4/A6/A8/A9 零像素证据,而**8 条红夹具里 4 条只挂在这一档**,于是"红夹具已覆盖"全程不可证伪。

**最小修复方向**:二选一并写进文档——(甲)承认该档是**人工观察**,随之删掉 P95/noise baseline/阈值这套定量措辞(人工不可复现 0.001 量级);(乙)把度量执行体列为**第 12 个 touched position**,并给出它自己的最小自检(对两张已知图跑一次,验证 changed/unchanged 双向)。**不接受**保留定量阈值而不指明谁来算。

---

## M-03 · CP 序列使 CP-2..CP-7 的骨架门结构性变红 · CONFIRMED

**位置**:`tools/terminal-skeleton/check-static.mjs:211`(`assertEqualSet('active TER package census', ...)`)、`:278-279`(`!== 27`);计划 §4 表 row 10/11 把两个 tool 修改押到 CP-8。

**为什么不成立**:census 是磁盘包与 graph 投影的**双向集合相等**。CP-2 建出第一个 `package.json` 的那一刻 `graph-comparison` 即红,CP-4/CP-5/CP-7 逐步加深。

**失败场景**:计划共同规则要求"每个 CP 先写真实红夹具再最小实现"。门已因结构原因红 ⇒ **红夹具在 CP-2..CP-7 全程失去信号**,整条链上只有 CP-0/CP-1 与 CP-8 之后有可信门。

**最小修复方向**:把"建包 + 加 graph 节点 + 递增节点数硬编码"合并为**每个建包 CP 的原子动作**;CP-8 只保留 reachability、`uiNativePackages`、红测试。

---

## M-04 · CP-0 不是可执行的首步 · CONFIRMED

**位置**:计划 §2.2 动作 0.2/0.3/0.4(`plan:93-101`)。

**为什么不成立**:0.2 要在 `ui/feature/sample-wallpaper-picker` 内放图,该包在 **CP-4** 才建;0.3 要用"sample2 **未来**同一 Metro consumer",sample2 的 `metro.config.js` 在 **CP-7**。

留的"等价最小 probe"口子**没有指定 probe 落点**。实施者若真建 picker 包:同时触发 M-03 的 census 红,且 layering 的 `featurePackages()` 按目录 glob 取分母,空 `src/` 直接抛 `ui feature package has no production source`。

**最小修复方向**:probe 落在**已存在且已绿**的 feature 包内,用**已存在**的 `sample-terminal/metro.config.js` 做 consumer,用后即弃;或把 CP-0 降格为 CP-4 首个子步并声明其间门为已知红。**CP-0"不预设结论"的立场本身正确,问题只在执行位置。**

---

## M-05 · integration 包清单漏硬依赖;720×1280 无声明住址 · CONFIRMED

**位置**:详设 §6.3(`design:672-676`)、计划 CP-5(`plan:283-292`)。

对照 `apps/terminal/ui/integration/sample-console/` 的实际构成,缺:

| 缺项 | 为什么是硬依赖 |
|---|---|
| `package.json` 的 **`terminalSurfaces` 块** | `src/application/terminalSurfaces.ts:1` 直接 `import packageJson`;`assembly.tsx` 的 `createSurfaceForDisplayIndex` 用它选画布 |
| `src/application/terminalSurfaces.ts`、`baseModuleDescriptors.ts` | §6.3 只列了 `application/module.ts` |
| `package.json` 的 `main`/`react-native`/`exports`(含 `./theme/global.css`) | assembly 侧 `App.tsx` 与 `metro.config.js` 按该子路径解析 |
| `index.js`、`metro.config.js`、`babel.config.cjs`、`nativewind-env.d.ts`、`theme/global.css.d.ts` | 现有包全都有 |

**并且 720×1280 这个值没有住址**:`sample-console/package.json` 的 `orientations.portrait.PRIMARY` 是 `360×800`,这不是复制能得到的,是要新写的声明,两份文档都没说写在哪。

**失败场景**:实施者要么整包复制 sample-console(连 `admin-shell`/`member-desk`/`test-expo` 一起带进,违背详设"不维护第二套 surface selection"),要么手搓第二条 sizing 路径——正是 §7 横切表要禁的形态。

---

## M-06 · 八条红夹具中三条无效、三条依赖不存在的执行体 · CONFIRMED

按详设 §8.4 自己立的规矩("红夹具若不能实际弄红,不能保留'判据已覆盖'的措辞"),这一条即足以 NO-GO。

| 夹具 | 判定 | 依据 |
|---|---|---|
| **F-A2b**(`w2 → undefined`) | **无效** | A2d 的 oracle 是 `source === assetsById[confirmed]`(`design:802`),而夹具变异的**正是 `assetsById.w2`** ⇒ 两边同时变 `undefined`,`undefined === undefined` 为真,背景渲染 null 也不抛错。**自引用 oracle** |
| **F-A7**(换回 sample-console 取值) | **无效** | 仓内唯一的 theme 测试实现(`sample-console/test/theme.test.ts:35-38`)只做 `tailwind.includes(name+':')` 与 `css.includes('--color-'+name+':')`——**只查字符串存在,从不读值**。改值不改名 ⇒ 全绿 |
| **F-A3**(SECONDARY 不传 background) | **无效** | 靶心 A3 被 §0.2/§8.3 明确置为 OPEN,**没有断言可被打破** |
| F-A2a、F-A2、以及 A2/A3 相关 | **依赖 M-02 的执行体** | 机理成立,但只挂在无执行体的 Android 档 |
| **F-A5**(`persistIntent → never`) | **有效** | focused 档可跑 |
| **F-A5b**(删 pending descriptor) | **有效** | focused 档可跑 |

**附带**:`canonical sample` 这个术语在 `design:61、582、802` 出现三次、**全文无定义**,却承担着 A2d 唯一的非平凡判据。

**最小修复方向**:F-A2b 的断言不得解引用被变异的那张表(改为对枚举常量断言完整性 + "确认后确有一个 source 非 null 的 Image 节点挂载");F-A7 需解析 `global.css` 断言**精确 RGB 三元组**;F-A3 待 A3 的 oracle 定义后重写;`canonical sample` 要么定义成可执行的取色规则,要么删除。

---

## S 级(11 条,摘要)

- **S-01** `configChanges` 含 `screenSize|screenLayout|smallestScreenSize`,**进出分屏、折叠展开都不重建 Activity** ⇒ §3.7 关于 split/fold/"被重建时重新判定"的三条语义**在各自点名的场景里全部空转**。
- **S-02** §3.3.3 清理命令 payload 带 `removals`(已算好的 layerIds)又要求 actor 自己遍历查 catalog,**两者不能同时成立**。(四格清理技术上可行已被核实。)
- **S-03** layers 的 `applyEntries` **必须保留 containers**——`persistencePrimitives` 逐 key 累积调用且 `containers` 排序在前,现有实现靠展开运算符顺带保住;详设未写此反向约束,**而 §3.3.4 正要改写唯一能抓到它的两条用例**。
- **S-04** `openedAt` 写入侧只拒非有限数(0/负/小数可落盘),还原侧要求"正整数" ⇒ **合法写入的行重启后被判非法丢弃**。重复 layerId 分支是死代码(写入侧已拒)。
- **S-05** "known-but-unavailable 保留"产生**永久不可见、不可关闭、每次启动读出→过滤→写回的无上限累积行**。
- **S-06** `changedFraction >= max(0.05, 10B)` 对"整屏换壁纸"**低两个数量级**:壁纸只覆盖 ROI 一角、或退化成纯色填充,两者都通过。判据缺空间维度与内容下限。
- **S-07** A3 三候选中 B 在正确实现上必红(两屏 cover 裁切区不同);A 的"identity 相等"由 §4.2 不变量构造性保证、**永不失败**,"非空可见"未定义 ⇒ A 退化为"两屏都显示了点东西"。
- **S-08** A9 的 oracle 是复述 part 声明(同义反复),**且八条夹具无一指向 mobile/SECONDARY**。
- **S-09** ui-state 全局行为反转,但既有 App 回归判据只查单向("没被清掉"),**且 A8 整条旅途没有重启步骤** ⇒ 变更引入的真实风险方向零覆盖。
- **S-10** ROI 无面积下限,mask 若取外层包装 bounds 可把 ROI 吃到个位数百分比,阈值退化为噪声统计。
- **S-11** `check-static.test.mjs:23-25` 的三处硬编码计数(27/15/27)不在任何分母;详设给新 assembly 选 `batch=1` 会让 `batchOne` 从 15 变 16,**三条断言全要改**(选 `batch=2` 只需改两处)。

## N 级(9 条,摘要)

`10B` 项是死代码(`B>0.001` 即 OPEN,故 `max(0.05,10B)` 恒为 0.05);`B==0` 恰是"比了同一张图"的指纹却被当最好情况,SHA-256 存了但无断言消费;未断言两次 capture 的 canvas/host 尺寸相同;A5d 无夹具且 §2.4 状态机中不存在把 pending 清回 undefined 的转移;主副屏两个 Bundle 是两处独立字面量、漏一处无门可抓;`readDisplaySnapshot` 早退路径未覆盖;`createContentDescriptor` 的 `_workspace` 形参当前被丢弃而诊断要求该字段;`skeleton-graph.ts` 被改但不在 11 个 position 内;layering 测试夹具硬编码 sample-console、改分母时需同步。

---

## 已裁定,不再上交(2 条)

以下两项 Codex 在详设中列为待裁,**但 Dexter 均已裁过,本评审不再上交,按既有裁定执行**。

**浮层恢复 · 已裁定纳入本批。** Dexter 两次明确:「浮层也进 state,也需要持久化,也必须要恢复」;「"浮层必须恢复"不单独立项,放到本次里面」。详设列出的两个替代(只持久化 picker 自身 open 状态、给 `openLayer` 增 `persist?: boolean`)**都是绕开全局语义的局部方案,恰恰不是该裁定要的东西**,不构成新信息,不重开。

⚠️ 但由此产生的**工程缺口仍然成立且必须修**,它们不是"要不要做"的问题,是"做得对不对"的问题:S-03(`applyEntries` 必须保留 containers,而唯一能抓到它的两条用例正被同批改写)、S-05(known-but-unavailable 的无上限累积)、S-09(既有 App 回归判据只查单向且 A8 无重启步骤)。

**红色主题范围 · 已裁定。** Dexter 裁的是「强调色是红、其余中性」。详设 §3.8 的 19 个值里 18 个与 sample-console 逐字节相同、唯一变化是 `action: 15 23 42 → 159 18 57`,**这正是该裁定的精确执行,不是偏离**,不重开。

⚠️ 仍需修的是判据侧的 S-03(F-A7 无效:仓内唯一 theme 测试只查色名字符串存在、从不读值,改值不改名全绿)——**主题内容对不对与主题判据能不能证伪是两件事**。

## 应当记功的部分

- §0.2 **主动登记两个 OPEN 并拒绝替 Dexter 选边**,其中 `REQUIREMENTS_RECONCILIATION-01` 指出的两处矛盾**确实是需求正本的缺陷**(§4.2 仍把已证伪判据当结论陈述;§3.6.2 与 §3.6.1c 的诊断与校验语义冲突),已于本轮修复。
- `DESIGN_CLARIFICATION-01`(A2 只比壁纸 ROI,否则控件选中态变化会被误判)与 `-02`(`none` 合法映射 undefined,不能当夹具)**都是对需求侧判据的正确修正**,已接受并写回。
- §3.8 的配色经复算属实:白字对 `#9f1239` 的对比度 **8.02:1**(远超 AA),HSL 落在 predicate 内,ok/warn/info/error 九个值与既有主题逐字节一致。
- CP-2/CP-3/CP-4 的 gate 写法质量高(具名错误码、变异必红、零状态写入),可证伪。

---

## 授权边界

本轮为静态、只读评审,未运行任何命令,零仓内写入(本文件除外)。不授权进入实施、不授权 DEV/构建/设备/数据操作。M-01~M-06 闭合、S 级明确处置之前,这两份交付不足以让未参与讨论的实施者安全开工。**本评审无待 Dexter 裁决项**——Codex 列为待裁的两条均已裁过,见上节。
