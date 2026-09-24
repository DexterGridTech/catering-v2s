# TER 虚拟键盘优化 DESIGN 复评：作者逐项处置

> REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；这是经 Dexter 中转的 Codex↔Claude 复评处置记录，非 fresh 子 agent 第三轮。  
> PREVIOUS_CLAUDE_VERDICT=NO-GO,M/S/N=0/4/4，仅针对评审前的五份文档字节；本记录不改写该 verdict，也不代表当前修订字节已获 GO。  
> CURRENT_BYTES=待 Claude 复评；IMPLEMENTATION_AUTHORITY=false；未改源码、测试、依赖、脚本或构建产物，未运行 Web、Metro、Android、设备或动态验证。

## 总体处置

逐条重开 Claude 原评审、当前五份设计文档、适用决策与安装依赖/源码事实。S-1、S-2 为已确认的规格缺陷，按最小公式与坐标契约修订；S-3、S-4 依 Dexter 明确裁定更新 IA 与全部设计口径；N-1 依现有 owner 状态定义收窄；N-2 按 Dexter 明确撤回；N-3、N-4 采纳 Claude 最小设计建议，但仅进入文档设计，不表示实施已执行。

## 逐项处置

| Finding | Intake / 回源与反例 | 处置与当前落点 |
| --- | --- | --- |
| S-1 · 异布局位移与可见遮挡不同步 | CONFIRMED。旧方案把 Phase 1 中 K(t)=max(K_A,v_B(t)) 的平台/上升曲线与线性时间位移混用；饱和端点 offset_A=-190、offset_B=-246 时，laptop 190→246 会从首帧越界。Phase 2 在下降型交接也不能按墙钟同进度插值。 | 改用 λ=clamp((K(t)-K_A)/(K_B-K_A),0,1)，offset=offset_A+(offset_B-offset_A)λ；等高时使用同一 progress。详设 §4.2 证明 K 变化段中 K 与 offset 使用同一 λ，平台段保持端点；饱和 190→246、246→190 路径均逐帧满足 abs(offset)=K，246→246 全程不越界。正式需求 AC-06、详设 §4.2、计划 CP-3 均纳入饱和端点与逐帧红变异；IA §1/IA-15–17 同步公式与观察边界。 |
| S-2 · 测量契约跨平台不一致 | CONFIRMED。安装字节 RN 0.86.3 Fabric DOM.cpp:554-574 使用 includeTransform=false，而 LayoutableShadowNode.cpp:176-181 仅在 includeTransform 路径加 ScrollView content offset；RNW 0.21.2 UIManager/index.js:12-47 的相对 measureLayout 使用 offsetTop/offsetLeft 并累计 ancestor scroll。measureInWindow 分别在 Fabric DOM.cpp:536-540 与 RNW UIManager/index.js:78-87 取窗口/变换后矩形；SurfaceHostController.tsx:125-139 对 canvas 做 scale。现有 InputScrollArea.tsx:66-84 已以 scroll content 为 relative node，但缺 surface viewport/scroll 的一致合成。 | 详设 §4.1、IA §1 MEASURE_RULE、计划 CP-2 统一为：普通焦点框/viewport 相对未平移 surface root 用 measureLayout；scroll 子字段仅相对 scroll-content 节点测量，再以 root-local viewport、content-local field 与真实 onScroll offset 合成；不跨 ScrollView 边界、不从 layout 结果扣 presentation offset、不用 measureInWindow；只在可见框计算时加一次 presentation offset；PIN anchor 同契约。加同一坐标样本：viewport y=100、content field y=500、scroll=80 得 surface y=520，再加 presentation=-100 得可见 y=420；普通字段 y=400、presentation=-150 得可见 y=250，未平移读数不得再扣 150。计划要求双平台、平移/滚动组合矩阵。 |
| S-3 · 键帽容量/宽屏视觉 | DEXTER_DECISION。依 Dexter 选择 (a)，全宽外框上的键帽列轨随最终外框与真实内边距、gap 拉满，不设居中限宽。 | IA §2 冻结逐控件基准：W=1280 时 full/alpha 118、numeric/financial 412；W=360 时分别 30、110。交互稿 §1、正式需求 VK-R01、详设 §4.4 与计划 CP-0/CP-1 同口径。 |
| S-4 · full 行数与 URL 字符分母 | DEXTER_DECISION。full 四行，不加第五行或额外符号行；URL Shift 数字层仅十项 : / . ? & = - _ % +。 | 五份当前设计文本均按 full 四行、laptop 246/mobile 189、十字符收敛；需求 AC-03 不再以“只实现十项”为失败；IA、交互键帽/访问表、详设与计划同步。错误容量样本由 360×400（四行 compact 高 189、容量可支持）改为 360×360（189>H/2=180，不支持）。对五份当前设计文本的残留扫描：旧 302、232、十二字符、@/# 符号键与 360×400 示例均无命中；包 scope 的 @catering-v2s 与 Markdown/代码的 # 不属于键盘符号规格。 |
| N-1 · 交接命中与 pending 目标 | CONFIRMED。若新键盘升满后即接键，仍被旧键盘盖住的可见键帽可能把点按落到屏下新键；pending B 若无 commit/cancel 生命周期会在 A→B→C 或关闭后遗留。 | 详设 §4.2、IA §1/IA-15–17、交互 VK-04 写明两阶段键盘覆盖区始终吞点，旧键盘完全退出后新键盘才接键。pending B 映射 blockedFieldId=B、blockedCapacity=null 与 preflightFocusTarget(B)；仅旧层退出、必要滚动/readback 证明全框可见、注册/scope/generation 仍有效后提交；新目标替换、关闭/失焦、scope suspend/切换、卸载或几何失效取消/替换。C 预检失败清 B pending 并保留 C 的原始预检失败分类，不一律改写为容量失败。 |
| N-2 · full 高度交接分母 | WITHDRAWN_BY_DEXTER。S-4 将 full 恢复四行，故 246→190、190→246、246→246 已覆盖 full/alpha 与同高 numeric/financial 的交接边界，不再需要原五行 full 推导的 302/232 样本。 | 不为撤回项新增帧或测试分母；AC-06、IA-15–17、CP-3 保持 246/190 交接，另加 S-1 要求的饱和端点样本。 |
| N-3 · field placement 别名 | CONFIRMED（仓内事实）；ACCEPTED_RECOMMENDATION（设计处置）。当前生产注册均为 surface，仓内 field 唯一使用处是 apps/terminal/ui/base/input/test/provider.test.tsx；新覆盖模型下 field 与 surface 的显示 host 相同。 | 正式需求 §2/§4/AC-07、IA（19 帧且无 IA-20）、详设 §2/§3/§4.4/§6、计划 CP-0/CP-2 将实施范围定为删除 type/prop/注册与渲染分支、唯一 fixture/test、README/invariant；不保留别名、不建窄宿主 harness。本轮没有删除任何源码、测试或 invariant。 |
| N-4 · 动画驱动与滚动联动 | CONFIRMED。旧文本要求每帧滚动插值但未说明驱动；RN native driver 不驱动 ScrollView offset，逐帧 JS scrollTo 会另起不同节奏。 | 详设 §4.2、IA §1 ANIMATION_RULE、计划 CP-2/CP-3 选择每 surface 一条 Animated.Value、useNativeDriver=true、分段线性插值驱动两键盘与内容 transform；确需滚动时在同一交接起点发起一次 scrollTo({animated:true})，不逐帧 JS 写入，并以真实 scroll readback 核验。运行时节奏/平台效果仍属未来动态验证，不在本次设计修订中宣称通过。 |

## 复核边界

- 当前 Claude NO-GO 仍是前一版五份文档的有效历史结论；本处置仅记录已完成的文档修改，等待 Claude 针对新字节复评。
- DESIGN cycle 的两轮 fresh 独立子 agent 已用完；本轮是 Dexter 中转的 Claude 复评，不发起第三轮独立子 agent，也不写 REVIEW_ROUND_LIMIT / SELF_DECIDED。
- 交互视觉仍待 Dexter/Claude 当前轮审阅；static 只表示文档/源码回读与 handoff 机械结构检查。focused、Web、Metro、Android/native/device、visual、cleanup 均未运行。
- 无生产代码字节变更，无实现或动态验证授权；本处置不构成实施授权。
