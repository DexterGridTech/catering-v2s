# TER UI 五包职责与公共导出边界 · DESIGN 诊断性评审（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT（设计内容）=GO
M/S/N=0/0/4
INDEPENDENT_DESIGN_REVIEW_ADMISSION=NOT_RESTORED
```

```text
EVIDENCE_TIER=STATIC_SOURCE_READBACK + 两个只读 node 脚本在 scratchpad 对当前字节做的机械计数与导入分类
SESSION=CONTINUED_SESSION；先从需求、标准与源码自建事实清单，再读两轮失效记录与作者 intake
WRITES=仅本文件
AUTHORITY=诊断性评审。不替代已失效的独立子 agent 前置门；不授权实施、public export 删除或收窄、构建、测试或设备验证。Q5 与全部仓外消费者仍 OPEN
```

## 0. 准入状态与本结论的边界

本 cycle 的两轮独立子 agent 审查都因方法失效（round 1 必读输入未读全；round 2 未在 verdict 前完成 1-B），
两轮上限已用完。**我的 GO 只是设计内容的诊断结论，不恢复独立审查准入**，也不能写作该前置门的替代。
是否新增有效审查授权由 Dexter 决定。

## 1. 自建事实：分母与宿主消费（先于阅读作者材料）

**分母与字节一致。** 我在 scratchpad 写了只读脚本，把五包 `src/index.ts` 的多行 export 块压平后逐名解析，
再读各 `package.json` 的 `exports`：根导出 6+6+16+20+23=**71**（类型单列），export-map 路径 1+1+1+2+2=**7**。
与详设 §3 第 44 行、计划 §1 第 14 行一致。补一句方法记录：我凭记忆手数 wallpaper-picker 得 17，机械计数为 16，
以脚本为准。

**root 消费者按导入说明符重建。** 第二个脚本只把"从包名或指向 `src/index` 的相对路径导入"计为 root 消费，
直连内部实现文件不计——与详设 §3 第 44 行口径相同。首次运行我为跳过原生目录把所有名为 `android` 的目录都
跳过了，导致 `apps/terminal/assembly/android/` 整个宿主被漏扫、A 类消费者为零；修正为只跳过
`assembly/android/<app>/android` 后重跑，扫描 412 个文件、其中宿主 22 个。

**两个 Android 宿主的消费集完整，且与详设一致。** 每个 integration 恰好被宿主消费 5 个 root 符号加 1 个 CSS
子路径：`moduleName`（`src/dependencies.ts`）、assembly 工厂与 `SurfaceForm`（`src/assembly/platformPorts.ts`）、
`createSurfaceForDisplayIndex`、assembly 类型与 `SurfaceForm`（`App.tsx`），以及 `./theme/global.css`
（`App.tsx` 与 `metro.config.js` 各一处）。与详设 §3 第 46 行"六类接口"、§4.4/§4.5 的 A 行、§4.6 第 166/168 行、
§9 第 241 行"5 个 root 消费符号加 CSS"、计划第 24 行"六项/包"全部吻合。

**exact-set 测试没有被当成消费者。** 三个 `publicSurface.test.ts` 用 `ts.createProgram` 与
`getTypeChecker().getExportsOfModule` 读取 index（例如 `sample-console/test/publicSurface.test.ts:5-23`），
不导入任何根符号，因此不会以循环论证的方式为导出提供"消费理由"。这也证实了详设 §5.1 第 185 行
"复用同一 TS checker 形态"有出处。

## 2. 1-B 三类事实提取

### 2.1 模板必填项缺项（对照 `doc/decisions/templates/implementation-design-template.md`）

逐节比对：模板 §0、§1、§2、§3、§3a、§7、§9、§9a、§9b、§12、§13、§13b、§13c、§14 在详设中有对应落点
（元数据头、§1、§5、§5.2、§5.2 第 202 行、§3 表、§4、§5.1、§5.1、§8、§8 第 235 行、§5 第 181 行、
§5 第 181 行与计划 §7、§9 第 241 行）；§5、§6、§8、§10、§10b、§11 由 §9 第 239 行逐项声明
`NOT_APPLICABLE_WITH_REASON`。

- **缺项 A**：模板 **§4 每个 CP 的门控**（可证伪失败条件、不变量、FORBID、比例验证、形态理由、RECALL）
  在详设中既无对应节，§9 的适用性声明也未提及它。其内容部分分散存在：逐 CP 的可失败条件在**计划** §2 表
  第 22-28 行，FORBID 在详设 §8 与计划 §5，RECALL 在详设 §1 第 26 行。**缺的是逐机制的"形态理由"**——
  最明显的是 §5.1 第 187 行把 consumer-side 静态合约放进 integration 的测试、由它按文件路径读取 Android
  宿主源码，没有写"选了 X 而不是 Y，因为 Z"。

### 2.2 文档之间的矛盾

- **矛盾 B**：详设 §5 表第 174-179 行只有 CP-0 至 CP-3，其 CP-3 同时承担"行为/目录回归与全批对账"；
  计划 §2 表第 24-28 行是 CP-0 至 CP-4，把回归（CP-3）与全批对账、cleanup、逐代码对账（CP-4）拆开。
  内容一致，编号与边界不一致。
- **矛盾 C**：计划第 58 行的键盘不变量含"只在 PRIMARY"，详设 §6 第 216 行对应行没有这一条。
  该约束符合当前字节——`sample.desk.member-form` part 在 `sample-member-desk/src/parts/parts.ts`
  注册为 `displayModes: primary`，且已被详设 §6 第 212 行的 part metadata 快照覆盖——所以不构成行为变更；
  但 §13c 的对账对象是详设，只写在计划里的不变量不会被对账。

### 2.3 无出处的具体数值与形态

逐个追溯出处：71/7 与 6/6/16/20/23（当前字节）、"六类接口"与"5 root + CSS"（宿主字节）、
五方原子组的五处（需求 R-7）、`getExportsOfModule`（既有 `publicSurface.test.ts:23`）、
TR-01"任何位置的 `dispatchCommand` → 绿"（`terminal-coding-standard.md` 第 83 行）、
base `dispatchWithRequestId` 位于 `ui/base/render/src/foundations/`（文件路径）、
`publicExportMap` 字段名（本详设自己引入的新 invariant 字段，属设计决定而非引用外部事实）。

- **无出处项 D**：详设 §2 表第 36 行称旧计划第 360-362 行的外部消费者停机条款"**前移**为 admission"。
  旧计划原文是"如果**确有**外部消费者，先停止"（第 361-362 行）；本详设实际执行的是"**未证明不存在**
  外部消费者即 OPEN、不得收窄"（§3 第 44 行 `E=OPEN` 逐行、§8 第 231 行）。这不只是时点前移，还是
  触发条件的收紧，而表中只写了"前移"。

## 3. 动作 2：逐项判定

### N-1 · 模板 §4 逐 CP 门控未成节，§5.1 的 consumer-side 合约缺形态理由（对应缺项 A）

**影响**：内容大体存在于计划，风险低；但 consumer-side 合约的放置是一个真实取舍——放在 integration 测试里，
provider 的测试就钉住了 consumer 的源码写法，Android 侧任何合法的 import 重排都会让 integration 测试变红；
放在 Android 侧（例如已经在读取两个 app 配置的 `assembly/base/android/test/`）则 ownership 更自然。两者都可行，
详设没有说为什么选前者。
**最小修复**：§9 补一句模板 §4 的处置去向；§5.1 为 consumer-side 合约的放置补一行形态理由。
**Dexter 裁决**：否。

### N-2 · 详设与计划的 CP 编号与一条不变量不一致（对应矛盾 B、C）

**最小修复**：二者对齐 CP 边界（详设按计划拆为 CP-3/CP-4，或计划合回）；把"只在 PRIMARY"写入详设 §6 第 216 行，
并注明其出处是 part 注册的 `displayModes: primary`。**Dexter 裁决**：否。

### N-3 · 与旧计划第 360-362 行的关系应写明是"前移并收紧"（对应无出处项 D）

**影响**：这正是 Q5 需要 Dexter 知道的差异——若确认并入旧计划，旧第 360-362 行的触发条件会由"确有外部消费者"
变为"未证明不存在外部消费者"。当前写法会让人以为规则只改了时点。互斥执行本身已被守住：详设 §2 第 30 行
"确认 Q5 前，实施不得依据任一计划收窄 public export"与计划 §1 第 16 行共同构成硬闸，我核过两处一致。
**最小修复**：§2 表该行改为"前移并收紧触发条件"，写出新旧两个条件原文。
**Dexter 裁决**：是，随 Q5 一并确认。

### N-4 · §4 有三处消费者细节与字节不符，不改变任何 KEEP/REVIEW 判定

- 第 113 行 `createSampleAssembly` 漏了 T：`sample-console/test/theme.test.ts` 与 V：`test-expo/App.tsx`；
- 第 138 行 `createSampleWallpaperConsoleAssembly` 漏了 V：`sample-wallpaper-console/test-expo/App.tsx`；
- 第 119-121 行把 `packageSurface.test` 记为 `getSurfaceDeclarations`、`readTerminalSurfaces`、
  `surfaceFormForOrientation` 的消费者，但 `sample-console/test/packageSurface.test.ts:2` 只命名导入
  `createSampleAssembly`、`createSurfaceForDisplayIndex`、`dependencyModuleNames`、`devDependencyModuleNames`、
  `moduleName`、`terminalSurfaces` 六项，这三项仅由 `terminalSurfaces.test` 消费。

**影响**：三处都是 KEEP 行或 T 类细节，判定不变；但详设 §4 第 60 行自己要求"消费者分类须从当前字节复核"，
这三处就是复核应当抓到的。**最小修复**：按上面三条改表。**Dexter 裁决**：否。

## 4. 对诊断问题的直接回答

**五方原子同步、key/target deep equal、行为不变与红变异是否真的可失败**：五方中四方可机械失败——index 走
TS checker exact-set，`package.json exports` 与 invariant `publicExportMap` 双向 deep equal 且核目标文件存在，
错指另一个存在的 CSS 文件也会因 target 不等而红（计划第 44 行）；**README 这一方只能人工对账**，详设 §5.2
第 200 行已如实写明，不是隐瞒。§6 七行不变量每行都给出了具体红变异，且 part metadata 用精确集合快照而非
数量——对一个"行为零变化"的批次，冻结当前状态正是正确的 oracle。

**仓外消费者是否逐项 OPEN**：是。§4 全部 71 行加 7 条路径的 `仓外` 列逐项为 `OPEN`，包括有仓内 KEEP 消费的行；
REVIEW 行的当前动作也是保留。

**MemberForm 探针与 dismissal helper 是否守住边界**：是。探针方面，详设把键盘 v2 的 fieldId、testID、
sample-only 文案与 alpha 动态入口列为硬不变量，并主动登记了一处**我上一轮与此前审查都没发现的既有差异**：
v2 第 54 行要求的区域标题"输入能力验证（仅 sample）"在当前 `sample-member-desk/src` 中零命中——详设把它记为
OPEN 交 Dexter，而不是顺手补或谎称满足。helper 方面，详设引用标准第 83 行排除了 TR-01 违规，又指出 base 的
`dispatchWithRequestId` 本身位于 `foundations/` 且同样是注入派发，因此"纯度"问题的根在 base 而不在三个 feature——
这个判断比我上一轮的 N-2 更准确；默认不处理、处理时也不上收 command，边界守得对。

**我要更正上一轮的一句话**：我在需求评审 S-1 里写"这两个探针是 alpha、financial 两种键盘布局**唯一**的真实消费者"。
对 alpha 成立，**对 financial 不成立**——`ui/base/admin-shell/src/components/sections/TopologySectionLaptop.tsx:86`
的主机地址输入也使用 `layout: 'financial'`。详设 §6 第 216 行"financial 在 admin-shell 另有主机地址消费者"是对的。
S-1 的核心判断（探针意图有正本）不受影响。

**两轮失效是否遮住了实质问题**：没有遮住任何 M 或 S 级问题。两轮在方法上失效，但它们"无实质 M/S"的内容观察
被我独立复核后成立。方法失效实际遮住的是上面四条 1-B 层面的 Note——正是 round 2 自述未做的三类提取所对应的东西。
反过来，详设自身抓到了两件此前所有审查都漏掉的事（financial 的第二消费者、v2 区域标题缺失）。

## 5. 结论

设计内容 `VERDICT=GO`，`M/S/N=0/0/4`。

这是本系列里质量最高的一份详设：分母从字节机械可复算，消费者分类按导入说明符而非字符串命中，仓外消费者一律
OPEN，与旧计划的互斥执行有硬闸，行为不变的每一条都有会失败的判据，而且它纠正了我上一轮的一处错误。四条 Note
都只需文字修订，其中 N-3 需要在 Dexter 裁定 Q5 时一并知悉。

**独立审查准入保持 `NOT_RESTORED`**：本结论不替代已失效的子 agent 前置门。Q5、全部仓外消费者、v2 区域标题
差异与 dismissal 纯度口径仍为 `OPEN`。本评审不授权实施、public export 删除或收窄、构建、测试、Web 或
Android 设备验证。
