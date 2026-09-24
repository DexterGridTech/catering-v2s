# TER UI 五包职责与公共导出边界 · IMPLEMENTATION 独立复核（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A（适配：本批无 UI 变更，"代码事实"取公共面产物——index、exports、invariants、测试——与运行证据）
VERDICT=NO-GO
M/S/N=0/2/1
```

```text
EVIDENCE_TIER=STATIC_SOURCE_READBACK + 我在 scratchpad 用只读 node 脚本对当前字节做的计数、五方比对与 jsonl 解析；
             focused、红变异、host typecheck、设备运行均读取 Codex 的原始证据，我未重跑
SESSION=CONTINUED_SESSION；不继承 Codex 两轮 implementation review 的结论
WRITES=仅本文件
```

## 动作 1-A：事实提取

本批**没有用户可见变更**，所以动作 1-A 的对象不是渲染事实，而是公共面产物与运行证据。以下均为我从当前字节独立取得：

- **生产代码零变更**：相对 HEAD,五包与两个 Android 宿主下被修改的只有 `README.md`、`terminal-invariants.json`
  与 `test/` 文件，外加两个新增的 `publicSurface.test.ts`;五包 `src/` 与 `package.json` 均无改动。
- **分母**：五包根导出 6+6+16+20+23=71,export-map 路径 7;逐名列表与我昨天设计评审时记录的完全相同；
  五个 `src/index.ts` 与 HEAD 一致。
- **五方契约**：五包 `publicExports` 与 index 集合相等(6/6/16/20/23);`publicExportMap` 与 `package.json exports`
  深相等，两个 integration 含 `./theme/global.css` 的精确 key 与 target;全部 target 文件存在；五包均有
  `publicSurface.test.ts`;五份 README 提及了全部根导出，两个 integration 的 README 提及了 CSS 子路径。
- **part 元数据守护**：`sample-member-desk/test/memberDesk.test.tsx:208-228` 断言 partKey 集合、总数 18、每个
  key 的 surfaceForm 为 `[['laptop'],['mobile']]`。四个 part 测试文件中，`displayModes`/`instanceModes`/
  `workspaces`/`layerTier`/`layerGuard` 的出现次数为：memberDesk 0/0/0/0/0,sampleWallpaperPicker 0/0/0/0/0,
  staffAuth 3/0/0/2/0,sample2Assembly 1/1/0/0/0。
- **运行证据**：四份 `command-actions.jsonl` 各有且仅有一条 status=1,都是 `package PID readback`,都紧跟在
  `final package force-stop` 之后（行号依次为 279、290、230、208）。

## 动作 2-3：逐项对账与判定

### 核实成立

1. **71/7 完整，无任何导出被删除或收窄**。见上；`AUTHORIZED_SHRINK_ITEMS=0` 属实。
2. **五方契约一致，CSS 子路径覆盖准确**。见上。README 是五方中唯一不能被机器判红的一方，我按字符串逐项核过，
   不缺根符号。
3. **CSS target 错指会红**。`sample-console/test/publicSurface.test.ts:106` 是
   `expect(packageJson.exports).toEqual(invariant.publicExportMap)`,对键与值做深相等，所以无论改哪一侧的 target
   都会红，不依赖文件是否存在。红变异第 1 行把 target 改成了 `./src/index.ts`——计划写的是"另一个存在的 CSS
   文件",但该 oracle 按字符串比较，二者等价。宿主消费合约（`:112-131`）用 TS AST 逐项比对含 `typeOnly` 的
   导入集合，并用 AST 读 metro 的 `globalCssPath`,不是字符串匹配。
4. **8 项红变异都有首次红与恢复后同门绿的记录**（CP-3 证据第 34-41 行），与计划第 66 行要求的 8 项一一对应。
   但第 7 项的首次红来自计数断言，见 S-1。
5. **四组动态结果与 cleanup 时序与 README 一致，N1 修正准确**。README 第 22 行"每个 jsonl 有且仅有一条 status=1、
   紧跟 force-stop"与原始字节逐条吻合。
6. **没有把 UI 树或设备旅途提升为视觉结论**。README 第 28 行写明未启动 Metro、未重建 APK、不声称颜色/尺寸/
   像素或整体视觉通过；`visual=NOT_APPLICABLE_WITH_REASON`,`Web=NOT_RUN`,其他机型按授权未运行。
7. **范围外项仍如实 OPEN**：71 个根导出与 7 条路径的仓外消费者、Q5、MemberForm v2 区域标题差异、dismissal
   helper 纯度，在 CP-3 证据第 76 行与 Codex review L3 中均保持 OPEN。

### S-1 · part 元数据快照只守了 partKey 与 surfaceForm;详设要求的其余字段无守护，"只在 PRIMARY"无任何测试 · CONFIRMED

**正本判据**：
- 详设 §6 第 212 行："对每个既有 part 的 `partKey`、container/display/workspace/instance、title、layer
  tier/guard、surfaceForm 建立精确集合快照；删一 sibling 或改一个 metadata 值，focused test 必须红，不只检查数量"。
- 计划 §4 第 60 行同一约束，并写明"仅 `parts.length` 不算通过"。
- 详设 §6 第 219 行（我上一轮 N-2 要求补入）："`sample.desk.member-form` part 在 `src/parts/parts.ts` 注册为
  `displayModes: primary`,故该跨批探针只可从 PRIMARY 形态进入"。

**实现**：见动作 1-A。member-desk 与 wallpaper-picker 对五个非 partKey/surfaceForm 元数据字段的断言数均为 0;
staff-auth 与 wallpaper integration 只有零星覆盖。

**反例**：把 `sample-member-desk/src/parts/parts.ts` 中 member-form 的 `displayModes: primary` 改为同时包含 SECONDARY,
当前没有任何测试会红——键盘探针随之可从副屏进入，直接违反详设第 219 行，而且无人察觉。wallpaper-picker 任一
part 的 displayModes、workspace 或 layer 配置被改，同样不会红。

**红变异第 7 项为何没暴露它**：该项删除了 `memberFormPair.mobile`,首次红为"预期 18 个 parts,实际 17 个"——
来自第 221 行的计数断言。删除 sibling 恰好是计数能抓到的那一种（第 222-226 行的 surfaceForm 检查也能抓到，所以
该变异不是假的），但它没有触碰任何未受守护的字段。

**影响**：本批没有修改任何 `parts.ts`,所以**没有现存回归**;缺的是详设明确要求作为交付物的那道守护。
**最小修复**：三个 feature 与 wallpaper integration 的 part 测试对每个 part 快照完整元数据元组；再实跑一次改动
非 partKey、非 surfaceForm 字段的变异（例如 member-form 的 `displayModes`）并记录其首次红。
**Dexter 裁决**：否。

### S-2 · 计划 §7 要求的逐代码与详设对账记录缺失 · CONFIRMED

**正本判据**：计划 §7 规定该门在交 Dexter/Claude 实施后 review 之前执行，逐项记录"详设位置、代码位置、证据路径、
判定人、差异",并写明"对账记录必须随最终实施交付一同提供，**缺记录即交付不成立**"。详设 §5 第 181 行同一要求。

**实现/证据**：在 `doc/evidence/platform/` 与动态证据目录中都找不到该记录；Codex implementation review 第 52 行
只有一句"CP-4:完成…逐代码对账"的概括。

**影响**：这正是本该抓住 S-1 的那道门——逐条拿详设 §6 第 212 行去对 `memberDesk.test.tsx`,缺失的五个字段会直接
显示为 `OPEN`。它的缺席也解释了为什么两轮 implementation review 都给出 0/0/0。按计划自己的规则，本次交付不成立。
**最小修复**：按计划 §7 的格式补出记录，详设 §3 至 §8 逐条 `MATCHED`/`OPEN`,S-1 应在其中如实显示为 `OPEN`。
**Dexter 裁决**：否。

### N-1 · 四组设备运行应写明是"基线观察",不是本批变更的运行时回归

本批没有改动任何会打进 APK 的字节（见动作 1-A),新契约全部在测试期生效。因此四组设备运行观察的是未变的生产代码，
证明"现状在双屏与 mobile 上正常",但不覆盖本批的任何改动。README 第 28 行已如实说明未重建 APK、未启动 Metro,
这一点是诚实的；只是 Codex review 的"两种虚拟机 × 两 app 均 PASS"容易被读成"本批改动已在设备上验证"。
**最小修复**：在动态 README 或 review 加一句"本批零运行时字节变更；设备运行为基线观察"。

## 动作 4：SAME_ROOT_SCAN

- **S-1 同根**：扫描了三个 feature 与 wallpaper integration 的全部 part 测试文件（计数见动作 1-A)。缺口集中在
  member-desk 与 wallpaper-picker;staff-auth 与 wallpaper integration 部分覆盖，同样未达到详设第 212 行的完整元组。
  sample-console integration 自身的 parts 本轮未逐一计数，修复时一并纳入。
- **S-2 同根**：核查了计划 §7 与详设 §5 第 181 行定义的全部交付物；唯独该对账记录缺失，其余（CP-3 证据、动态
  README、四组原始产物、implementation review)均存在。
- **N-1 同根**：只涉及动态证据的定性表述，无其他同类。

## 动作 5：DESIGN_GAPS

- **详设第 219 行陈述了"只在 PRIMARY"这一事实，但同一行"必须红"的变异里没有"改 displayModes"**——判据写出了
  事实，却逮不住它自己。
- **计划第 66 行"必须实跑"的 part 变异只要求"删除一个 mobile sibling part"**,而这恰好是单靠计数就能抓到的
  变异，无法证明第 60 行要求的完整元数据快照存在。应改为要求改动一个非 partKey、非 surfaceForm 的字段。

这两处缺口正是 S-1 能通过的原因：执行者按"必须实跑"清单做对了每一项，清单本身却没有要求去证明快照的完整性。

## L1 / L2 / L3

- `L1_ENGINEERING`:S-1、S-2。
- `L2_USER_VISIBLE`:PASS——本批无用户可见变更；设备证据中提取的旅途、屏幕归属、alpha 探针与 wallpaper 状态
  事实与 README 一致。v2 区域标题差异为既有 OPEN,非本批引入。
- `L3_UNVERIFIED`:像素/视觉（本批不适用）;Web 与 Metro 未运行；APK 未重建（本批零运行时字节变更，影响有限）;
  两台单机单屏等其他机型按授权未运行；71 个根导出与 7 条路径的仓外消费者、Q5、v2 区域标题、dismissal helper
  纯度仍为 OPEN;本评审未重跑任何测试或设备。

## 结论

`VERDICT=NO-GO`,`M/S/N=0/2/1`。

这批的公共面工作本身做得扎实：分母完整、一个导出都没删、五方契约五包全部一致、CSS target 的错指真能变红、宿主
消费合约用 AST 而非字符串、N1 修正与原始字节逐条吻合、范围外项全部如实 OPEN。

挡住 GO 的是两件连在一起的事：详设要求的 part 元数据完整快照只落实了两个字段，"只在 PRIMARY"没有任何守护
(S-1);而本该逐条比对出这个缺口的逐代码对账记录没有产出(S-2),按计划自己的规则交付不成立。两处都不涉及
生产代码，修复是补测试断言、跑一次针对性变异、补出对账记录。

本结论只覆盖本批已授权的非收窄实施与双屏/mobile 动态回归；不授权任何 public export 收窄，不关闭 Q5 与仓外消费者，
不代表视觉、Web、Metro 或其他机型通过。
