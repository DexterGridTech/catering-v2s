# sample2（壁纸终端）需求正本独立静态复核

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取 + source-first fact reconciliation
REVIEW_CYCLE_ID=NOT_PROVIDED_BY_INPUT
REVIEW_ROUND_LIMIT=本文件不是作者自组织盲审轮次；不冒充 fresh 独立子 agent
reviewerKind=CODEX_INDEPENDENT_REVIEW
EVIDENCE_TIER=static only
VERDICT=NO-GO
M/S/N=5/6/3
```

## 1. 范围、方法与结论

评审对象只有：

- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`
- 仓内 owning source、`doc/platform/terminal-coding-standard.md`、当前骨架门和相关项目记忆。

没有运行构建、typecheck、测试、Metro、Web、Android、native、DEV、seed、UAT 或部署。下文所有已确认事实均为 static；没有把作者文档中的“已亲验”、既往盲审汇总或计划中的判据当成动态证据。

结论是 **NO-GO，M/S/N=5/6/3**。原因不是“一个 Image 接缝放错了”，而是实施者仍会在几个互相冲突的契约之间自行选边：surface placement 的最终 owner、`ui/feature` 无 actor 的合法性、Android mobile 的完整输入输出契约、治理/base 抽取的先后，以及 scope/graph 的闭合边界。

```text
L1_ENGINEERING=5M + S-04/S-05：owner、顺序、Android 契约、规范冲突和骨架闭包未闭
L2_USER_VISIBLE=S-01/S-02/S-03/S-06：壁纸可见性、选项/副屏内容、红色主题、失真接受边界未被充分证明
L3_UNVERIFIED=Metro workspace .jpg 解析；图片来源/再分发与实际 asset 交付；所有动态档位
SAME_ROOT_SCAN=见第 4 节；每个 finding 均列出同根扫描范围与已查结果
DESIGN_GAPS=见第 8 节；评审不就地替需求正本立新规则
```

## 2. source-first 事实复核

| 文档断言 | 当前源码核对 | 判断 |
|---|---|---|
| primitives 当前没有 `Image`，现有 feature/integration 生产代码不直接 import React Native | `apps/terminal/ui/base/primitives/src/vendor/slots.tsx:10` 当前为 7 个控件且无 `Image`；现有 `ui/feature`、`ui/integration` 生产源码的 RN value import 扫描无命中 | **CONFIRMED**；只能推出需要一个合法 base 能力，不能推出 primitives 是仓内唯一 RN 接缝 |
| `ui/base` 下只有 primitives 是 RN 接缝 | `render`、`input`、`admin-shell`、`dev-host` 等共 11 个生产文件有 RN value import；例如 `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:1-2` | **REJECTED_WITH_EVIDENCE**；文档自身 §1.1 已记录纠正 |
| `SurfaceRoot` 的 children 可承载画布背景，且没有向 children 传几何 | `apps/terminal/ui/base/render/src/types/props.ts:47-54` 的 `children?: ReactNode` 无几何；`SurfaceRoot.tsx:73-84` 先渲染 children，再渲染 `ScreenContainer`/`LayerStack`；`surfaceHost.ts:105-120` 独立计算两轴 scale | **CONFIRMED**；实现仍需绝对定位与有效合成证明 |
| 默认容器会盖住底层壁纸 | `apps/terminal/ui/base/primitives/src/theme/tokens.ts:1-7` 的 `container` 含 `flex-1 bg-canvas`；`PrimitiveContainer.tsx:8-37` 默认走该 token | **CONFIRMED** |
| 当前 terminal surface 横屏可有 PRIMARY/SECONDARY，竖屏只有 PRIMARY | `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts:54-87`；package manifest 的 1280×800、960×540、360×800 在 `sample-console/package.json:11-28` | **CONFIRMED** |
| 当前 Android adapter 已经下发 `surfaceForm`，只差接线 | `TerminalDualScreenActivityHandler.kt:522-531` 和 `:770-773` 目前只下发 `displayIndex`/`displayCount`；没有 `surfaceForm` 或方向锁定契约 | **REJECTED_WITH_EVIDENCE**；正确表述是已有 launch-options 通道，不是已有形态下发 |
| mobile producer 在 assembly/adapter 全树为零 | 当前 `assembly/android`、`adapter/android/dual-screen` 没有 `'mobile'` producer；JS `sample-terminal/App.tsx:11-14,23` 接收可选 `surfaceForm`，但默认仍为 `laptop` | **PARTIALLY_CONFIRMED**；“producer 为零”成立，“整个缺口只在 native 入口”过度收窄了消费、默认、方向生命周期和回归边界 |
| sample-staff-auth 可直接复用且零改动 | actor 行为可复用，但 `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts:8-18` 的 description 写死“会员登记工作台” | **PARTIALLY_CONFIRMED**；至少需要宿主中立的 part metadata 修复 |
| display-context 已有可供 sample2 使用的统一 topology selector | `apps/terminal/kernel/base/display-context/src/index.ts:9-19` 只导出 `readDisplayInfo`、secondary availability、display role 等；现有 `sample-member-desk/src/features/actors/actors.ts:28,45-46` 仍直接读 `readDisplayInfo` | **REJECTED_WITH_EVIDENCE**；文档写的“抽 base 后再改 selector”是未来契约，不是当前能力 |
| 骨架图当前 27 个节点，新增四包后改为 31；assembly/layering 门有硬编码分母 | `apps/terminal/skeleton-graph.ts` 当前 27 节点；`tools/terminal-skeleton/check-static.mjs:170-193,197-245,278-280`；`tools/terminal-layering/check-static.mjs:171-177` | **CONFIRMED** |
| source imports 与 package dependencies 是双向集合相等 | `tools/terminal-skeleton/check-static.mjs:197-245` 确实双向检查 | **CONFIRMED**；但文档 §8.2 明确给的是设计意图，不是闭合后的集合 |
| primitives 的 `publicExports` 有机器门保护 | `apps/terminal/ui/base/primitives/terminal-invariants.json:9-24` 有该字段，但当前 skeleton 工具没有对 primitives `publicExports` 做校验 | **CONFIRMED**；漏同步不会自动变红，需 review/设计对账兜底 |
| 全仓 `.d.ts` 只有两处 CSS 声明 | 除 `sample-terminal/global.d.ts`、`sample-console/theme/global.css.d.ts` 外，多个 test 目录有 `react-test-renderer.d.ts`，例如 `ui/base/primitives/test/react-test-renderer.d.ts:1` | **PARTIALLY_CONFIRMED**；“没有图片模块声明”成立，但该全称断言不成立 |

## 3. 方案判断与七条裁决

### 3.1 方案方向

用户真正要解决的问题是：店员沿用既有登录旅程，在同一 assembly 的主/副屏上选择并看到同一张壁纸；目标形态至少覆盖 mobile；sample2 还承担第二个 integration 的真实复用样本。

当前方向总体合理：

1. 只在 primitives 增加一个 `Image` 能力，符合 feature/integration 不直接碰 RN 的现有边界；比在 render 另造 `SurfaceBackground` 更小。
2. 资源放在 UI feature，kernel 只保存 `wallpaperId`，避免 kernel 掌握 UI 资产路径。
3. integration 决定各 display 的 part placement，符合“组合决定此刻哪块屏显示什么”的边界。
4. transparent container 只影响需要露出壁纸的 part，比把全局 `bg-canvas` 改透明或重排 render 更窄。
5. adapter 统一承载设备形态/方向，避免每个 assembly 重复推导；但它是共享行为，必须把副作用和完整契约锁住。

更简单的替代确实存在：把壁纸 ID 和选择 UI 都放在一个 UI-only package；在 integration 直接使用 RN `Image`；或由每个 assembly 自己判断 mobile。它们技术上更短，但分别违反了 Dexter 已冻结的四层演示目标、现有 UI import 边界，或造成每个 assembly 重复设备逻辑。因此本评审不因“新增四层”本身判错。

不过，四个新包、primitives、通用 Android adapter、既有 sample-terminal 方向行为和两个工具门合在一个范围里，已经不是纯增量。当前收益足以支持这个范围，但前提是先闭合第 4 节的顺序与契约；否则实施者会在实现期间反向做产品/owner 决定。

### 3.2 七条 Claude 裁决逐条判断

| 裁决 | 判断 | 理由 |
|---|---|---|
| C1：只加一个接缝，render 零改动 | **PARTIALLY_CONFIRMED** | source 证明 `SurfaceRoot` 已有 children 槽位，render 零改动可行；但“primitives 是唯一正确归属”不由源码推出，且必须同步公开导出与透明/图片行为契约 |
| C2：增加 transparent container | **PARTIALLY_CONFIRMED** | 是当前结构下的最小可行方向；但去掉 `bg-canvas` 只证明一个 class 差异，不证明真实合成后用户能看到壁纸，A2/F-A2a 仍不足 |
| C3：删除 hydrationRejected 与校验 actor | **PARTIALLY_CONFIRMED** | 资产存在性确实只有 UI asset map 知道；`assetsById[id] ?? null` 可避免 kernel 伪校验。但未知/被删除的 persisted ID 是否等价于“无壁纸”、picker selected 状态和诊断语义没有写死 |
| C4：删除两个无消费者命令 | **PARTIALLY_CONFIRMED** | 当前四个固定选项使用户非法选择路径不可达，删除回声命令是 KISS 方向；但 command runtime 输入非法 ID 时是 typed rejection、程序错误还是静默 no-op，需求没有明确 |
| C5：TR-04 缺口上报，不用机制填 | **DEXTER_DECISION** | `TR-04` 明文要求正反双断言，而本文只有“倾向乙”。不能以倾向替代已冻结规范；应由 Dexter 决定豁免，或决定跨 slice 反向断言的精确定义 |
| C6：接受非等比失真，`resizeMode=cover` | **DEXTER_DECISION** | 当前 source 确实会逐轴 transform，但“壁纸失真不是缺陷”是产品接受度，不是由现有 UI 拉伸事实自动推出；目标硬件比例、允许误差、cover 与非等比 transform 的关系均未定义 |
| C7：ui/feature 无 actor 如实上报 | **DEXTER_DECISION** | 当前 `TR-12` 明文要求每个 `ui/feature` 有自己的 module 与 actor。可以选择重归属，也可以批准精确例外并同步规范/门，但不能同时保留“零 actor 不是包”和“这是新包”两句话 |

## 4. Findings

### M-01：surface placement 的最终 owner 虽已修正，但本批采用哪个治理时点的字节没有冻结

状态：**PARTIALLY_CONFIRMED**。证据档位：static。

证据：需求 `§3.3`/`§3.4` `:267-328` 的最终规则已经指向“一切 surface placement 归 integration”；`§4.2` `:371-411` 的相反边界被标题和处置文字标明为已撤回，不能把那段历史文字直接当作 active 设计。可是 `§3.4.1` `:330-337` 又明确保留了 governance 前后两种运行字节：前置完成前 sample2 继承 `staff-auth` 的两条 PRIMARY placement，完成后 sample2 要补成八条。当前 owning source `apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:50-67` 确实仍把两条动作留在 `auth-navigation`。

失败场景：实施者按“治理后”字节实现 sample2，却在治理轮尚未迁移 `staff-auth` 时无法启动；或按“治理前”字节实现后忘记补两条 handler，导致治理完成后 sample2 登出/匿名恢复时 PRIMARY 无人接管。该 finding 不是把已撤回历史段落误读为当前 owner，而是要求本批选定一个可执行快照。

影响面：登录、登出、冷启动恢复、主副屏 placement；也影响 sample 治理轮与 sample2 的先后依赖。一个不参与讨论的实施者不能从当前文本唯一推出六条还是八条 handler。

最小修复方向：保留 §3.3 的最终 owner 结论，但在 §3.4.1 明确本批 implementation-facing 输入是治理前还是治理后，并列出切换 gate 与最终六/八条 handler 清单。若本批必须在治理前实施，再明记临时继承边界和后续迁移；不需要新增架构。

是否需要 Dexter 裁决：**若批内先后尚未确定则需要；不推翻 integration owner 时，作者可按既有治理裁定补齐文档**。

### M-02：新建 `ui/feature/sample-wallpaper-picker` 与 TR-12 直接冲突

状态：**DEXTER_DECISION**（冲突事实已确认）。证据档位：static。

证据：需求 `:233-246` 明确声明 picker 包没有 actor，并把它当作规范缺口上报；`doc/platform/terminal-coding-standard.md:463-485` 的 TR-12 明确要求 `ui/feature` 有自己的 module 与 actor，并写明违反时两层应合并。

失败场景：

- 保留四层包但没有 actor，`TR-12`/相关门或 review 判红；
- 为过门伪造 `wallpaper-notice`/失败事件，重新引入文档已经正确删除的假行为；
- 把纯展示组件并入 integration，却仍按四个新包、graph 节点和资源归属验收。

影响面：包边界、graph、module kind、actor 归属以及 picker 的真实可实施性。它不是“以后补一个测试”的问题，而是包到底是否存在的问题。

最小修复方向：在需求/规范层二选一：把 picker 与 integration 合并并重写包/graph/资产归属；或批准一个精确的纯呈现型 `ui/feature` 例外，明确 module/actor/门/owner 语义。不要为满足形状发明无消费者 actor。

是否需要 Dexter 裁决：**是**。

### M-03：Android mobile 的共享 adapter 契约不完整，且会改变既有 sample 行为

状态：**CONFIRMED**（缺失契约）；涉及具体政策值时为 Dexter decision。证据档位：static。

事实：需求 `:501-523` 把“屏幕尺寸 → surfaceForm → 方向锁 → launch options”放入 `adapter/android/dual-screen`；当前 `TerminalDualScreenActivityHandler.kt:522-531,770-773` 只有 `displayIndex`/`displayCount`，没有 `surfaceForm`；`apps/terminal/assembly/android/sample-terminal/App.tsx:11-14,23` 的 prop 可选且默认 `laptop`；`app.json:6` 与 `AndroidManifest.xml:19` 当前锁 landscape。

缺口与失败场景：没有尺寸阈值、使用物理 px 还是 logical dp、主副屏优先级、缺失/未知尺寸策略、Bundle key/type、方向锁发生在启动还是重建、primary/secondary 是否都收到同一 form、JS 缺失 prop 是否 fail closed。实施者可以写出多个都“符合文字”的不同实现；移除 sample-terminal 两处方向锁还会改变既有 App 的行为。

影响面：sample2 mobile 是否真正可达，既有 sample-terminal 的横屏登录/会员旅程，双屏 secondary 创建，Activity recreation 和方向变更。

最小修复方向：补一张闭合 truth table，明确输入事实、阈值、form、orientation、launch option 的 exact key/type/default/failure，以及配置变更后的 lifecycle；同时把 sample-terminal 回归旅程列成真实步骤，而不是一句“回归”。保持逻辑在通用 adapter，不把判断复制回 assembly。

是否需要 Dexter 裁决：**部分需要**。技术字段和验收可由详设闭合；阈值、未知设备和方向变化的产品策略若尚未冻结，需要 Dexter。

### M-04：scope 分母与批内顺序没有形成单一可执行边界

状态：**CONFIRMED**。证据档位：static。

证据：需求 `:533-551` 同时出现“补齐后是五项”“实际触及六个位置”，而清单实际列出 4 个新包、primitives、dual-screen、既有 sample-terminal、两个工具，共 10 个 touched positions。`§3.4.1` `:330-337` 又说明 sample 治理先后会改变 sample2 handler 数量。D10 还把共享 adapter 与现有 App 纳入本批。

失败场景：实施者只按“四层新包”开工，漏掉既有 sample 描述、方向锁、两个工具门或 primitives public export；或者先实施 sample2，再发现治理轮改变 `staff-auth` placement，导致同一批出现两套合法但互斥的 assembly 形态。

影响面：授权边界、变更分母、实施顺序、既有 App 回归和后续 review 输入。不是把工具门当业务需求，而是当前文档没有一个唯一的批内入口。

最小修复方向：把“新建包数量”“实际触及位置数量”“前置项目”分成三张不重复的表；指定治理轮/base 抽取与本批的前置关系，或者明确本批锁定的当前字节；为 D10 的既有 sample 回归设独立 gate。不要通过扩大更多包来掩盖计数冲突。

是否需要 Dexter 裁决：**若顺序与前置关系尚未确定，则需要；仅修正文档计数不需要**。

### M-05：当前 `readDisplayInfo` 与未来 topology selector 是两套未冻结的 integration 契约

状态：**CONFIRMED**。证据档位：static。

证据：需求 `:328` 说本批暂时直接调用 `readDisplayInfo`，抽 base 后再改读 selector；当前 `apps/terminal/kernel/base/display-context/src/index.ts:9-19` 没有该 topology selector，现有 `sample-member-desk/src/features/actors/actors.ts:28,45-46` 仍把设备 I/O 放在 actor 中。文档没有给出本批的 selector 形状、迁移边界或谁拥有 secondary availability。

失败场景：base extraction 先落地时，实施者按未来 selector 写新 integration，当前字节无法编译；sample2 先落地时，实施者复制直接读 port 的形态，后续抽取时又需要改 owner；两种情况下都可能把 display-context 事实重复放进 integration。

影响面：副屏等待/欢迎 placement、mobile 无副屏判断、display-context owner 边界和两批之间的代码兼容性。

最小修复方向：在需求阶段冻结一个前置版本：要么把 base extraction 的 selector contract/落点列为前置并禁止用当前 API，要么明确本批只依赖 `readDisplayInfo`、由谁暂时拥有该判断以及后续迁移不属于本批。不能同时把 current 和 post-extraction 两套字节写成“最终方案”。

是否需要 Dexter 裁决：**是，若两批的执行顺序或 topology owner 尚未裁定**。

### S-01：A2/F-A2a 仍不能证明壁纸真正可见

状态：**CONFIRMED**。证据档位：static 对判据缺口的核验。

证据：需求 `:671-699` 的 A2 只断言树中存在所选 `source`，且父容器 `className` 不含 `bg-canvas`；F-A2a 只把 `layout="transparent"` 改回默认。源码基线确认默认容器确实不透明，但 `SurfaceRoot` 的 children、canvas transform 和最终合成都不是由这两个字符串断言完全决定的。

恶意但合规的实现：`PrimitiveImage` 保留正确 source 与 `absolute inset-0`，但设置 `opacity:0`、宽高为 0、位于另一个不透明 sibling 后面，或把图片节点渲染到没有挂载的 tree 分支；A2 与 F-A2a 仍可能按当前结构断言通过。反过来，父节点没有 `bg-canvas` 也不排除由其他 opaque style 覆盖。

影响面：核心用户目标“选择后屏幕确实变样”可能静默失败；static/focused tree proof 不能扩写成视觉 PASS。

最小修复方向：在需求/详设中指定最低层可复现的有效可见性 oracle：包括 source、有效几何、定位关系、compositing/遮挡，或在获批的 Web/Android 档位使用前后可比较的渲染结果。保留 F-A2a 作为结构 red mutation，但它不能单独承担行为证明。

是否需要 Dexter 裁决：**若要选择真实像素/平台档位作为验收方式则需要；补足判据逻辑本身不需要**。

### S-02：A1/A3/A4/A5/A8 多数只验 state/key/计划，没有验用户可见控件与完整 Journey

状态：**CONFIRMED**。证据档位：static。

同根扫描范围：A1、A3、A4、A5、A5r、A8 及其 F-A3/F-A5；已逐项检查。

反例：

- A1 只看 `partKey`，空 picker 或只有一个选项也能通过；
- A3 只比较两处 selector/asset 值，两个 `WallpaperBackground` 都返回 `undefined` 仍可能相等；
- A4 只看 waiting/welcome `partKey`，错误文案、空 renderer、不可见 part 都能通过；
- A5 只证明 ID 恢复，不能证明第二个 runtime 的屏幕确实渲染该图；
- A8 只有“回归旅途”一句，没有动作、预期、失败/恢复和证据档位。

此外，需求没有关闭 picker 的选中态、四个选项的用户可见标签/缩略图、无图/未知 persisted ID、无副屏时的布局、无障碍名称、testId、加载/错误状态和完整登录后回到 picker 的 Journey。它是需求分析而不是详设，这些细节可以留到详设，但因此不能声称当前正本已可直接实施验收。

最小修复方向：在正本至少列出每个用户可见不变量与对应 Journey/档位，详设再展开控件级位置、文案、动作节点、状态恢复和 testId。不要用增加更多 state key 代替 UI oracle。

是否需要 Dexter 裁决：**新增 Journey、文案和未知资产处理若未由 Dexter 定义，需要；把现有登录 Journey 映射到新 picker 则作者应先补齐**。

### S-03：A7 的“红色主题”没有客观可判定的取值边界

状态：**DEXTER_DECISION**。证据档位：static。

证据：需求 `:446-479` 和 `:684` 要求 19 个语义名保持一致且取值为红系，但没有 RGB 表、色相/明度阈值或参考 palette。当前 `sample-console/test/theme.test.ts:13-43` 只硬编码名称并检查字符串存在，不会证明颜色。

失败场景：sample2 保留 19 个名字但把所有 RGB 复制成蓝/灰；如果“红系”没有客观定义，扩展后的 A7 仍无法确定应该红。相反，凭审阅者主观目测判定也无法形成稳定门。

最小修复方向：Dexter 选择固定 RGB/色板，或授权一个简单的、可计算的红色范围 predicate；测试从该闭合表/派生集合检查名称与值。不要新建共享 theme 包，也不要为了测试再复制第三套 palette 来源。

是否需要 Dexter 裁决：**是**。

### S-04：TR-04 的单字段持久化反向断言仍是未决规范项

状态：**DEXTER_DECISION**。证据档位：static。

证据：需求 `:221-231` 明写 `persistIntent: owner-only` 必须有正反双断言，同时承认只有 `{wallpaperId}` 的 slice 没有自然反向对象，并提出甲/乙两种方案但只写“倾向乙”。`doc/platform/terminal-coding-standard.md:149-171` 没有该例外文字；它还明确说机器门只能检查用例存在，语义由 review 兜。

失败场景：实施者按甲省略反向断言，违反 TR-04；按乙断言 ui-state，却不知道必须选哪个状态、如何证明不是恰好默认值；或临时再造一个 transient 字段，只为给反向断言找承载对象，重新引入文档已经删除的过度设计。

最小修复方向：在规范正本或本批正式裁决中冻结“单字段全持久 slice”的 exact exception 与反向对象；若采用跨 slice，必须规定正向/反向各自要排除的状态。不要把“倾向”当成可实施契约。

是否需要 Dexter 裁决：**是**。

### S-05：graph、依赖集合和 assembly 可达性仍是设计意图，不是闭合的 implementation input

状态：**CONFIRMED**。证据档位：static。

证据：需求 `:590-643` 给出四个 graph 节点和依赖数组，但明确写“设计意图，不是实测”；当前 `check-static.mjs:197-245` 会要求 package manifest、`src/dependencies.ts` 与 graph 形成双向集合相等；`:170-193` 只对写死的 `assembly.android.sample-terminal` 做入口可达性检查；`terminal-layering/check-static.mjs:171-177` 只把 `sample-console` 加入 integration 的 RN 边界；当前节点数仍由 `:278-280` 写死为 27。

失败场景：新包的实际 import 与文档列出的依赖不同，门在实施末端才红；新 assembly 不加入 reachability 数组，入口约束静默失效；新 integration 不加入 layering 分母，原生 host import 静默逃门。依赖列表留到实现后“被门逼出”适合作为实现期诊断，不足以让一个陌生实施者在开工前知道唯一正确闭包。

最小修复方向：详设/实施计划开始前先做一次逐包的 import→manifest→graph reconciliation，输出唯一集合和每个工具门的更新点；需求正文不必虚构尚不存在的 import，但必须明确这项是进入实施前的硬前置，而不是把“设计意图”写成已闭合事实。

是否需要 Dexter 裁决：**不需要产品裁决**；需要作者在详设/实施入口完成闭合。若授权范围要求需求文档本身直接驱动代码，则当前应升级为 M。

### S-06：接受壁纸非等比失真缺少产品边界，`cover` 不是保真保证

状态：**DEXTER_DECISION**。证据档位：static 对现有几何的核对。

证据：`apps/terminal/ui/base/render/src/foundations/surfaceHost.ts:105-120` 确实使用 `scaleX=host.width/canvas.width` 与 `scaleY=host.height/canvas.height`；这只证明当前 canvas 会被逐轴缩放，不证明声明尺寸就是所有目标硬件比例，也不证明 `resizeMode="cover"` 能消除非等比变形。需求 `:489-499` 没有误差阈值、目标设备比例清单或图片主体安全区。

失败场景：真实设备的 logical host 比例与 1280×800、960×540 或 360×800 不一致，人物/文字壁纸明显被拉伸；实现者根据“失真不算缺陷”放行，用户却把壁纸功能理解为视觉选择功能。

最小修复方向：Dexter 明确接受“任何当前 canvas 变形”，或给出目标形态比例/可接受误差并把超出范围登记为 OPEN。若未来要求保真，才另立 viewport/render 设计；本轮不因审查而提前新增 render 层。

是否需要 Dexter 裁决：**是**。

### N-01：`.d.ts` 的全称事实表述不准确

状态：**PARTIALLY_CONFIRMED**。证据档位：static。

“没有图片模块声明”已确认；“全仓 `.d.ts` 只有两处 CSS 声明”被 `ui/base/*/test/react-test-renderer.d.ts:1` 等现有文件推翻。影响主要是事实表可靠性，不改变图片声明确实需要新增这一结论。

最小修复方向：改成“当前没有图片模块声明，现有 CSS 声明有两处；测试类型声明另有多处”，不要用全称替代已扫描的有限集合。

是否需要 Dexter 裁决：否。

### N-02：副屏 part 在 mobile 声明中是合法但不可达的状态，文档没有说明

状态：**PARTIALLY_CONFIRMED**。证据档位：static。

需求 `:286-295` 给 waiting/welcome 声明 `displayModes=['SECONDARY']` 与 `surfaceForm=['laptop','mobile']`；当前 `terminalSurfaces.ts:62-69` 明确 portrait 禁止 SECONDARY。catalog 校验 `kernel/base/ui-state/src/foundations/catalog.ts:141-159` 允许这种组合，所以不会自动报错，但 mobile 下该 part 不可达。

最小修复方向：将副屏 part 的 form 限制为 `laptop`，或显式记录“mobile 下声明保留但不派发”，并为 no-secondary path 写判据。不要让“支持 mobile”被读成 mobile 也必须显示副屏。

是否需要 Dexter 裁决：通常不需要，除非产品要在 mobile 重新定义副屏语义。

### N-03：Metro workspace `.jpg` 与资产再分发仍未验证

状态：**UNVERIFIED_REQUIRES_EVIDENCE**。证据档位：static gap。

需求 `:98-104,525-531` 对 workspace `.jpg` 的 Metro 解析保持未验证，这一点是诚实的；静态源码也不能证明网络来源的许可证、URL、图片大小、压缩结果和 APK 资源行为。

最小修复方向：实施首步做最小 Metro/asset smoke proof，并逐张记录来源与许可证；在证据产生前不得把“图片放入包内”写成已闭合。

是否需要 Dexter 裁决：无新增产品裁决；需要既有实施授权内的证据。

## 5. 作者结论中被本复核推翻或收窄的项目

1. “全仓 `.d.ts` 只有两处 CSS 声明”不成立；正确说法是“当前没有图片模块声明，CSS 声明有两处，测试声明另有多处”。
2. “mobile 的整个缺口只在 native 入口”不成立。producer 为零是真的，但消费默认、Bundle 传播、阈值、方向 lifecycle、既有 sample 回归仍未闭。
3. “primitives 是唯一正确的 RN 接缝”不成立。源码显示 `ui/base` 有 11 个 RN value import 文件；一个 primitives seam 是合理选择，不是事实必然。
4. “透明容器 + source/className 判据就能证明屏幕变化”不成立。它能拦住指定的默认 `bg-canvas` 变异，但挡不住 opacity、尺寸、遮挡或未挂载分支等 false-green 实现。
5. “一切 placement 已最终归 integration”与“showLogin 仍由 staff-auth 负责”不能同时作为最终结论；当前文档没有单一 owner policy。
6. “ui/feature 无 actor 只需如实上报”不能直接成立。它与当前 TR-12 是规范冲突，必须裁决或重归属。
7. “失真不算缺陷”不是源码事实，而是产品接受度裁决；目标设备比例和容差尚未给出。
8. “补齐后只剩工具门、图片声明、Metro 与 sample 回归”过度收口；TR-04、Android 形态契约、display-context 两批顺序、UI 可见判据和 graph 依赖闭包仍在范围内。

## 6. UI/交互与用户 Journey 判断

- 既有“登录”来自 `sample-staff-auth` 的现有旅程；“登录后选择壁纸”来自 Dexter 本次目标，但本文没有给它一个明确 Journey/IA 工件。
- 主屏 picker、主副屏同壁纸、登录前等待、登录后欢迎语这四类操作在产品意图上合逻辑；但当前判据没有逐控件说明选项标签、选中态、缩略图、无壁纸态、可访问名称、testId、加载/恢复和失败路径。
- 副屏 placement 属组合事实，放 integration 比放纯 UI feature 更自然；真正的问题是文档同时保留两种 owner 方案，不是“integration 一定不合理”。
- mobile 竖屏单屏是现有 `terminalSurfaces` 的结构结果；不能把“有副屏副屏生效”与 mobile 路径混成同一 Journey。
- transparent container 是最短的 UI 结构修复；把全局 `bg-canvas` 设透明、修改 render 层或新增第二套 background stack 都会扩大影响面。
- Android adapter 归属符合设备事实 owner，但它改变既有 App 行为，必须把 adapter contract 与 sample 回归当成同一变更的硬边界。

接口限制、owner 边界和历史惯性分别解释了部分现象：RN import 边界解释了图片接缝落在 base；display placement 的组合属性解释了 integration；现有 surface API 解释了 children 槽位。但“无 actor”“失真可接受”“两批先后”属于产品/规范语义，不能用技术方便替 Dexter 选边。

## 7. 文档漏掉但本轮范围内必须回答的问题

1. sample governance、base extraction 与 sample2 的严格先后；每个前置完成的可观察条件。
2. logout/anonymous 的 `showLogin` 最终 owner，以及 sample2 最终是 6 条还是 8 条 placement handler。
3. `sample-wallpaper-picker` 是合法纯呈现 UI feature 还是应并入 integration；对应 TR-12、graph 和 gate 如何一致。
4. Android mobile 的尺寸输入单位、阈值、unknown/missing policy、方向锁 lifecycle、primary/secondary launch-options key/type 和 JS 默认策略。
5. `display-context` 的 topology selector 是否本批存在；`readDisplayInfo` 的临时 owner 与迁移 owner。
6. scope 的唯一分母：四个新包、实际 touched positions、工具门、既有 sample 和回归 proof 如何分组计数。
7. picker 的真实 IA：四个选项的标签、选中态、缩略图/背景关系、无壁纸、未知 persisted ID、加载/错误/恢复、无障碍和 testId。
8. A2 的有效可见性/compositing oracle，以及 Web/Android/静态三档各自能证明到什么程度。
9. 19 个红色 token 的确切 RGB 或可机械判定的红色范围。
10. 壁纸非等比失真的目标硬件范围和容忍度；`cover` 是否只是资源裁剪而非比例保证。
11. 四个 graph 节点的实际 import/dependency 集合、assembly entry reachability、layering 分母和 primitives `publicExports` 对账顺序。
12. `.jpg` 的 Metro 解析、类型声明覆盖、许可证/URL/大小/压缩与 APK 资源交付证据。
13. D10 移除方向锁后 sample-terminal 现有登录→会员列表→登出旅程的明确回归边界。

## 8. 最终转交口径

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取 + source-first fact reconciliation
VERDICT=NO-GO
M/S/N=5/6/3
L1_ENGINEERING=NO-GO：M-01 placement owner 冲突；M-02 TR-12 actor 冲突；M-03 Android mobile contract 未闭；M-04 scope/顺序分母冲突；M-05 current/post-extraction display-context contract 未闭；S-04/S-05 仍有规范/graph 入口缺口
L2_USER_VISIBLE=NO-GO：S-01 A2 不是有效可见性证明；S-02 UI/Journey 判据不足；S-03 红色 token 无客观边界；S-06 失真接受缺产品边界
L3_UNVERIFIED=Metro workspace .jpg；实际图片来源/许可证/资源交付；所有 Web/Android/native/release/visual 动态证据
EVIDENCE_TIER=本复核只使用 static；未把 focused、文本完整、历史盲审、计划或源码存在性提升为运行/视觉 PASS
```

在 M-01/M-02/M-03/M-04/M-05 未闭、C5/C6/C7 未获明确裁决、以及 S-01/S-02 的 UI 判据未补足前，一个未参与讨论的实施者不能安全地直接进入实施。当前最多能开始“补齐详设输入与裁决”，不能把本需求正本作为可直接开工且可验收的 implementation contract。
