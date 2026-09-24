# TER 程序虚拟键盘优化 · 设计全套复评（Claude）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23（经 Dexter 中转的 Codex↔Claude 复评，不占 cycle 轮次）
VERDICT=NO-GO
M/S/N=0/1/4
```

```text
本 verdict 只针对下列当前字节，不沿用本人上一版 NO-GO 0/4/4，也不沿用任何独立子 agent 的 verdict。
reviewTargetSha256（前 16 位）:
  formal-requirements    b27c0922c667b661
  ui-interaction-design  8a7ae1cb57a6b107
  ia-design              c7ec6d732e3e81c6
  implementation-design  e57d1eeca80cf86d
  implementation-plan    b9badd600f65e7f7
作者处置（对照用，非评审对象）: design-review-response-codex a5e80316cd56725a
EVIDENCE_TIER=静态：设计文档 + 仓内 owning source + 仓内已安装 react-native 0.86.3 / react-native-web 0.21.2 源码 + 独立算术；未运行任何构建、测试、Web、Metro、Android 或设备
SESSION=CONTINUED_SESSION（续接会话，从 v2s 仓根发起，不是 fresh acceptance）
WRITES=仅本文件
AUTHORITY=只复评需求、交互、IA、详设与实施计划；不授权实施、源码/测试/依赖/脚本修改或任何动态验证
```

下文"需求 / 交互 / IA / 详设 / 计划 第 N 行"分别指 `doc/plans/platform/` 下同日的
`2026-09-23-ter-virtual-keyboard-optimization-{formal-requirements,ui-interaction-design,ia-design,implementation-design,implementation-plan}-codex.md`。

## 1. 上一版 finding 逐条复核

- **S-1(交接内容路径越界)：已关闭。** OFFSET_RULE(详设第 22、81 行)取 λ=(K(t)−K_A)/(K_B−K_A)。因为 K(t) 始终落在
  K_A 与 K_B 之间，λ 恰好就是 K 的归一化值，offset(t)=(1−λ)o_A+λo_B,而 K(t)=(1−λ)K_A+λK_B;端点满足 −K_i≤o_i≤0,
  所以逐帧 −K(t)≤offset(t)≤0,且路径单调、连续。我独立复算：190→246 饱和(o_A=−190、o_B=−246)时 offset(t)=−K(t),
  全程贴边不越界；246→190 饱和时同样 offset(t)=−K(t);246→246 时 K 恒定，按 progress 线性插值，全程在界内。计划第 38 行
  的"按时间而非 K 插值"红变异能证伪错误实现：246→190 饱和端点下，在 K 刚降到 190 的那一帧，按时间插值的 |offset|≈233,
  超出 190,门会判红。
- **S-2(测量契约)：已关闭。** MEASURE_RULE(详设第 23、71、73 行)与仓内安装版本的行为相符：两个平台的 `measureLayout`
  都不含 transform,所以相对未平移 `InputSurfaceFrame` 根测到的就是未平移坐标。scroll 子字段相对 scroll content 测量，测量路径
  不经过 ScrollView 本身，因此 Fabric 不加滚动偏移、RNW 减 scrollTop 两种行为都不会进入结果；再用 onScroll 回读合成，两平台
  一致。viewport 相对根测量时，当前生产路径上没有外层 ScrollView。`measureInWindow` 已禁用，canvas 缩放不再混入。第 91 行的
  样本算术核对无误：100+500−80=520,加 −100 得 420;普通字段 400,加 −150 得 250。
- **S-3(键帽拉满)：按 Dexter (a) 关闭。** 1280 宽时 floor((1280−28−72)/10)=118、floor((1280−28−16)/3)=412;360 宽时 30、110。
  交互第 24-26 行、IA 第 28 行、详设第 50 行、计划第 16 行四处一致。
- **S-4(第五行)：按 Dexter 裁定关闭。** 在五份现行文档中机械检索"302、232、十二、第五行、五行、5 行、360×400、`@ #`"等
  旧口径：只剩包名 `@catering-v2s` 与 skill 哈希里的 `@`,没有键盘规格残留。full 四行高 4×48+3×8+28+2=246、
  compact 4×38+3×5+20+2=189;360×360 示例 189>floor(360/2)=180,确为不受支持。需求 VK-R04、AC-03,IA、交互、详设、计划的
  十项符号表逐项一致。
- **N-1(交接命中与待提交目标)：命中部分已关闭，待提交部分见本轮 S-1。** 两个阶段都用 hit shield 吞掉键盘区点按
  (详设第 79、103 行)。用 `blockedFieldId=B、blockedCapacity=null` 表示待提交，与现有源码不冲突：尺寸不足提示要求
  capacity 非空(`apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:67-68`),现有代码中也没有读取
  `blockedFieldId` 自动重试提交的路径。
- **N-2:Dexter 撤回。**
- **N-3(`field` placement)：已关闭。** 删除范围逐项列明(详设第 59 行，需求 AC-07,IA 收为 19 帧)。
- **N-4(动画驱动)：已关闭。** 一个 native-driver progress 分段插值驱动两把键盘与内容；滚动在同一起点只发起一次
  `scrollTo(animated)`(详设第 28、77 行)。λ 映射在每个阶段内是分段线性的，可以写成 `interpolate`,走 native driver 没有障碍。

**分母复核**:IA 19 帧；9 个生产字段与两套 integration 不变(上一版已核)。IA §1 与详设 §1 的九条逐字契约经机械 diff
完全一致。

## 2. 方案合理性与 UI 自问

S-3、S-4 由 Dexter 拍板后，外框、键位、高度都已定型，本轮没有新的方向性问题。交接期间键盘区吞掉约一次动画时长的
点按，换来的是不会误按到看不见的键，这个取舍合理，交互第 88、97 行也已写明。删除 `field` placement、改用单一 native 时钟，
都让实现更简单。仍需补齐的是下面这个机制缺口。

## 3. Findings

### S-1 · 交接与收起期间"键盘由什么状态渲染"没有定义：按现有渲染门，两把键盘会在交接开始和收起时直接卸载 · CONFIRMED · 需 Dexter 裁决：否

**正本**：详设第 79、83 行规定交接期间输入 owner 为 `none`,B 只记作 pending(`blockedFieldId=B`);第 81 行规定首次弹出和
退出时，可见 K 与 offset 同一个时钟从 0 进、退；第 103 行规定 overlay 内新键盘位于旧键盘下层。需求第 70 行要求收起时
"不能先卸载再把消失冒充退出动画"。

**事实(仓内源码)**:
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx:193-196` 中，`visible = owner === 'virtual' && activeFieldId !== null
  && surfaceMetrics.visible`。
- `keyboardState` 只有一个 `layout`(同文件第 179 行);`shift`、`hasNextField` 都从 `activeFieldId` 派生(第 188-203 行)。
- `apps/terminal/ui/base/input/src/components/InputKeyboard.tsx:18` 中 `if (!state.visible …) return null`。
- 详设 §3 对 `InputProvider`、`InputKeyboard` 的改动(第 53、55 行)没有触及这道门，也没有定义别的渲染来源。

**推论与反例**:
- numeric→alpha 交接一开始，owner 变为 `none`,`visible` 随之为 false,`InputKeyboard` 返回 null,旧、新两把键盘同时消失，
  方案 (b) 的两个阶段根本无从渲染。
- 按"完成"收起时同理：键盘立即卸载，没有退出动画。
- pending 期间有三件事没有来源：新键盘显示哪套键位(B 的 layout 只存在它的注册里)；完成键按 B 的 `hasNextField` 显示，还是
  按 `activeFieldId=null` 得到的 false;旧键盘显示什么标签(A 的 Shift 已随会话结束被清)。
- 首次弹出要求"先在不可见底侧完成 onLayout 回读"，同样需要一个"已渲染但不在屏上"的阶段，现有门控也表达不了。

**影响**:CP-3 的交接和退出动画无法照文档实施，实现者只能自造状态机。而这个状态恰好夹在输入 owner(VK-R08 要保留的
互斥与首击不丢)和几何时钟之间，自造最容易出错。

**最小修复**:
- 在详设 §4.2/§4.5 和 §3 表中增加一个与输入 owner 分离的"键盘呈现状态"，由 `InputSurfaceFrame` 的几何 owner 持有。
  例如：phase(idle / measuring / entering / shown / handoff / exiting);outgoing(layout、K、冻结的键帽标签);incoming
  (layout、K、hasNextField)。覆盖层只按它渲染，动画结束后才卸载。
- `keyboardState.visible` 保持"可编辑"的含义，只用来门控按键分发，不再决定键盘是否在屏上。
- CP-3 补一条红变异：交接或收起过程中 owner 变为 `none` 时，覆盖层若在动画结束前卸载即判红。

更小的方案——直接放宽 `visible`,让 owner=none 时也显示——不可取：它会把"可编辑"和"在屏上"混成一个布尔值，破坏
"旧键盘完全退出前新键盘不接键"。

### N-1 · 两处严格相等比较需要写明容差

**正本**:详设第 77 行"若测量与预检不一致，重新容量预检再开始";OFFSET_RULE(第 22、81 行)按 K_A≠K_B / K_A=K_B 分支，
且 λ 以 (K_B−K_A) 为分母。

**事实**:Fabric 把设备密度设为 Yoga 的 pointScaleFactor
(`apps/terminal/node_modules/react-native/ReactCommon/react/renderer/components/view/YogaLayoutableShadowNode.cpp:476`),布局
结果按物理像素网格取整(`apps/terminal/node_modules/react-native/ReactCommon/yoga/yoga/algorithm/PixelGrid.cpp`)。

**推论**:非整数密度下，onLayout 得到的逻辑高度通常带小数，与公式得出的整数(246 等)不相等。按字面精确比较，Android 上
几乎每次都会判"不一致"而重新预检，可能反复重来。full、numeric、financial 现在都是 246/189,两次测量一旦有取整差，就会
落进 K_A≠K_B 分支；λ 的分母极小，整段位移会被压进一两帧，等于跳变。

**修法**:写明容差(例如一个物理像素，或 0.5 个逻辑单位)。"不一致"改为"超出容差，或导致容量判定变化";|K_B−K_A| 在
容差内时走等高分支。

### N-2 · presentation 桥现在走两条通道，真正承载它的 context 却没进 API 表

**正本**:详设第 99-101 行、第 109-113 行。progress 由 `SurfaceRoot` 创建，经 `SurfaceRootContentFrame` 与
`ConsoleSurfaceInputFrame` 传到 `InputSurfaceFrame`;后者再生成派生 offset,经"render 声明的 presentation context"交回
render 消费。

**推论**:派生 offset 只能由 input 生成并经 context 回传，render 自己用不到 progress。progress 从 render 下传这一段是多余的，
却要改 render 和 console-assembly 两个包的公开类型。反过来，真正承载这座桥的 context 不在第 107-113 行的 API 表里；而它
必须从 `ui-base-render` 的公共入口导出(现有惯例见 `apps/terminal/ui/base/render/src/index.ts:52-55` 的
`useSurfaceContext`),还要和第 154 行"不预先扩大 public export"的说法对齐。

**修法**:
- progress 改由 `InputSurfaceFrame` 自建；
- render 只声明并导出 presentation context(provider 类型加读取 hook,没有 provider 时 offset 恒为 0);
- 删掉 `SurfaceRootContentFrame` 与 `ConsoleSurfaceInputFrame` 的 progress 透传；
- API 表改列这个 context,写明它是本批必要的新增导出。

### N-3 · "滚动区内的字段必须用 InputScrollArea"应写成显式约束

**正本**:MEASURE_RULE(详设第 23 行)要求"不跨 ScrollView 边界测量"，但只给 `InputScrollArea` 规定了替代测法。

**事实**:Fabric 的 `measureLayout` 不含 ScrollView 偏移，RNW 的含。当前 9 个生产字段中，凡在滚动区内的都在 `InputScrollArea`
里(MemberForm、CustomerMember、StaffLogin、TopologySection);admin 的 `PrimitiveScrollView` 只包"面板状态"页
(`apps/terminal/ui/base/admin-shell/src/components/AdminSectionContentLaptop.tsx:18-33`),暂无违例。

**推论**:将来如果有人把 virtual 字段放进普通 ScrollView 或 `PrimitiveScrollView`,几何 owner 无从得知，会跨边界测量，Web 与
Android 的结果就会分叉。

**修法**:在 `ui/base/input` README 与详设中写一句约束：滚动区内的 virtual 字段必须放在 `InputScrollArea` 中。CP-0 顺带确认
9 个字段都满足。

### N-4 · 两处文档小项

1. 交接时长 T 与缓动没有给值(详设第 77 行只写 `duration:T`),primitives 也没有现成的 motion token,动态对账时没有目标值。
   建议给一个值(例如 250ms 加一条标准缓动)并写进 IA。
2. 详设第 183 行、计划第 48 行仍写"六条契约",实际逐字契约已是九条(IA 第 13-21 行，详设第 20-28 行，机械比对一致),
   改成"九条"。

## 4. 结论

`VERDICT=NO-GO`,`M/S/N=0/1/4`,只针对上列当前字节。

上一版的四个 S 都已关闭：S-1、S-2 我独立复算和回源确认成立,S-3、S-4 按 Dexter 裁定在五份文档中同步到位，旧口径已清。
挡住 GO 的只剩一处机制缺口：待提交期间 owner 为 `none`,而键盘的渲染仍由"可编辑"门控，交接和收起动画无从实现(S-1)。
四个 N 由 Codex 顺手处理。

本结论不授权实施，不授权源码、测试、依赖或脚本修改，也不授权 Web、Metro、Android、设备或动态视觉验证；静态设计结论
不等于动态或视觉通过。
