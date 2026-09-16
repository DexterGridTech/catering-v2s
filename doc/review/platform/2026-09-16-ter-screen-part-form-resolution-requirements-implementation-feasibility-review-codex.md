# TER screenPart 按机型解析需求实施可行性独立评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=MAIN_AGENT
VERDICT=NO-GO
M/S/N=5/10/3
L1_ENGINEERING=FAIL：两项待 Dexter 裁决、一个章节级互相矛盾、多个判据没有可执行 oracle
L2_USER_VISIBLE=FAIL：全屏铺满、laptop master-detail、mobile 可用性均缺少足以证明用户实际看到什么的闭合判据
L3_UNVERIFIED=release/native/Web/设备视觉证据；当前本轮未执行构建、测试或运行
SAME_ROOT_SCAN=consoleAssembly→catalog→resolvePart→ScreenContainer→ScreenReadyBoundary→LayerStack→contentActors/workspaceSlices；admin-shell→PrimitiveContainer/PrimitiveGrid→sample-console 真实装配与既有手搓 catalog 测试
DESIGN_GAPS=R-5/TR-13 待裁决；§4.1/§4.2 互相矛盾；R-4 所需 resolvePart/diagnostics 落点缺失；U-9/U-10/U-11 视觉或可用性 oracle 不完整；D-10/U-13 分母未冻结；D-13 未覆盖 U-10/U-11
EVIDENCE_TIER=当前源码与需求文档静态核验；未执行 focused、native、Android、Web、release、visual 或 cleanup
```

本文件是实施方对需求稿的独立可行性评审，不是详设，不是实施授权，也不是产品裁决。未修改源码、测试、脚本、依赖或构建产物；未执行构建、测试、Web、Metro、Android、设备或部署动作。需求稿中的作者 intake、旧结论与建议不作为源码真相，以下结论以当前字节和 owning source 为准。

## 结论

**NO-GO，5M / 10S / 3N。**

核心机制的方向基本正确：`consoleAssembly` 已经有“汇总全部 parts 后、建 catalog 前”的唯一生产收口，R-1/R-2 放在这一处比在 feature 内过滤或只靠过滤后重复键更小、更可靠。问题不在于需要再造一套 catalog 或 resolver，而在于需求仍有两个明确待 Dexter 裁决的产品/标准边界、一个会让实施方无法选择正确落点的章节矛盾，以及几个无法证明用户实际看到正确界面的判据。

在 R-5 与 TR-13 未裁决前，不应进入详设冻结。即使这两项裁决完成，U-9/U-10/U-11 的证据契约和 §4.2 的改动面仍需先修正。

## M findings

### M-01 — R-5 三态仍是未决的产品/启动语义，而不是可自行补齐的详设细节

`STATUS=DEXTER_DECISION`
`SEVERITY=M`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:207-214,375-380; apps/terminal/ui/base/render/src/components/ScreenContainer.tsx; apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:9-15`

**仓内事实：**需求正文给出了三态建议：首次就绪前主表面走启动失败页，就绪后容器内可见，非目标表面也容器内可见；同时 §8 明确这一边界仍等待 Dexter。当前 `ScreenContainer` 对主表面启动态、宿主就绪态和真实解析结果有既有分支，`ScreenReadyBoundary` 还同时承载启动失败页与独立启动失败页，并共享 `FAILURE_MESSAGE`。

**推论：**这不是仅由实现方选择组件位置就能闭合的事项。它决定开机画面何时收起、哪一个 testID/文案出现、是否允许启动失败页、是否宣告 R-S1 的主屏就绪；错误选择会造成“缺失组件被当成启动完成”或“开机画面永不收起”。

**尚缺证据/待决：**需要 Dexter 明确接受或修改 §8① 的三态边界，然后详设才能冻结 `first-ready` 锁存、失败页复用和定位码形态。当前不能把作者的“建议按此裁定”当成已授权结论。

**反例：**若实现方按“任何 not-found 都走启动失败页”处理，首次就绪后的业务页面缺件也会重新显示启动期失败页；若按“任何 not-found 都是容器错误”处理，首次就绪前主表面可能被错误页挂入 ready path 或让原生开机画面维持不变。两者都满足不了未裁决的两种可能边界。

**最小处置：**Dexter 只需裁决 R-5 的三态归属；不需要因此增加第二套错误页或扩大 catalog。裁决后将 D-2 写成可执行状态表，并在 R-S1/R-S7 的 owning source 上逐项对账。

### M-02 — TR-13 在 R-10 拆分后的合规对象未裁决，U-14 不能直接收口

`STATUS=DEXTER_DECISION`
`SEVERITY=M`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:243-251,330-337,375-382; doc/platform/terminal-coding-standard.md:TR-13`

**仓内事实：**R-10 要求四个 admin part 各拆为 laptop/mobile 两个条目，因而源码侧成为 8 条但有 4 组重复 `partKey`；R-1 又要求当前机型过滤后 catalog 的 `partKey` 唯一。需求同时承认旧 TR-13“唯一 catalog 含全部 admin parts”在未过滤的 8 条下不可满足，§8②仍等待 Dexter。

**推论：**不裁决时，详设无法确定机器或 focused 验收的对象是“每个当前机型 catalog”还是“未过滤源码全集”；也无法确定 U-14 是标准改写后的验收，还是需求本身与 TR-13 冲突。实施方不能安全地自行改变标准。

**反例：**若照旧 TR-13 构造 8 条唯一 catalog，会在重复 `partKey` 处抛错；若只验证一个机型，可能漏掉另一机型的 admin 条目；若直接以源码 8 条数量过门，则绕过了 R-1 的生产过滤语义。

**最小处置：**Dexter 只需裁定 §8② 的封闭措辞；裁决后 U-14 列出每种机型 catalog 分母与两种机型合并的源码分母，不需要新增 catalog 字段或全局索引。

### M-03 — §4.1 的“解析与浮层零改动”与 §4.2/R-6/R-9 的明确改动互相矛盾

`STATUS=CONFIRMED`
`SEVERITY=M`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:287-313,216-222,237-239`

**仓内事实：**§4.1 第 2 项写明 `resolvePart`、`LayerStack`、`contentActors`、持久化全部不动；同一份 §4.2 却列出 `ScreenContainer` 的 not-found/default 改动、`LayerStack` 去居中与留白、`workspaceSlices` 水合诊断、`contentActors` 容器失效恢复。R-6 明确要求容器失效记录可恢复，R-9 明确要求 `parseContainers` 增加诊断。

**推论：**实施方按 §4.1 会漏做 R-6/R-9 和 R-11；按 §4.2 又会违反“零改动”。这会产生两个合法但互斥的实现解释，详设与计划无法逐代码对账。

**反例：**保留 `parseContainers` 的静默丢弃，U-6 可能把损坏记录伪装成“无记录”并走默认；保留 `LayerStack` 的 `padding:24` 与居中，U-9 的铺满目标不成立。反过来修改它们则显然不再是 §4.1 的零改动。

**最小处置：**将 §4.1 改为“catalog 查找、partKey 身份、layer 派发/过滤语义不改；R-5/R-6/R-9/R-11 明列的呈现、恢复、诊断和版式改动允许发生”，并逐项列出保留不变量与变更文件。无需扩大到 catalog 索引或新的 layer 机制。

### M-04 — U-9 的 ROI 改前/改后差分不能证明“遮罩已被 console 内容覆盖”

`STATUS=CONFIRMED`
`SEVERITY=M`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:253-261,317-321; tools/terminal-image-compare/compare.mjs:166-234`

**仓内事实：**需求承认仓内没有布局引擎，单测不能得出像素结论；U-9 的视觉证据改用 `compare.mjs` 对遮罩区 ROI 做改前/改后差分。比较器按像素变化比例、P95、均值和变化 cell 比例报告差异，但没有断言改后 ROI 的像素/结构属于 console 内容，也没有绝对的遮罩占据率或内容占据率 oracle。

**推论：**该工具只能证明“前后变了”，不能证明“遮罩被目标 console 覆盖”。这直接击穿 R-11 的核心用户可见目标，不能仅靠将 ROI 阈值写得更严格补齐。

**反例：**保留全屏遮罩但改变遮罩颜色、透明度或动画，差分可能通过；把遮罩换成另一块非 console 的不透明矩形，也可能产生足够差异；反之 console 内容静态且改前基线不一致时也可能误报失败。

**尚缺证据：**当前没有 release/native 设备截图或能识别目标内容的绝对断言。

**最小处置：**保留 ROI 差分作为补充证据，再增加一条绝对观察：在指定 laptop 设备/分辨率下，改后通过可识别的 console 根 testID/UIAutomator 或人工按明确判定语句确认目标内容覆盖该 ROI，并把截图和观察记录落到 `doc/evidence/`。这比新建布局引擎小，也比单纯调差分阈值可靠。

### M-05 — U-10 的“同屏 master-detail”只有组件树判据，无法证明用户真的看到同屏布局

`STATUS=CONFIRMED`
`SEVERITY=M`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:112-134,278-283,317-318,332; apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx:56-103; apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx:8-32`

**仓内事实：**U-10 只要求分区列表和详情共享父节点且父容器 `flexDirection:'row'`；仓内无布局引擎，`PrimitiveContainer` 的 `bounded` 还可能施加 `maxHeight:'100%'`、`overflow:'hidden'`。当前 `AdminShell` 是 card + bounded，header、navigation、content 垂直排列，内容入口在 `layout="content" bounded`。

**推论：**共享父节点和 row 属性只能证明结构意图，不能证明两个区域在 laptop 的可见几何中同时存在、宽度非零、未重叠、未被裁剪。R-12 的“同屏”是用户可见核心，不应被结构断言冒充。

**反例：**详情子树宽度为 0、列表或详情被绝对定位到屏外、父容器因 `overflow:hidden` 裁掉第二列，组件树仍能满足 U-10 当前文字。

**尚缺证据：**需求 §7 的 D-13 只明确 U-9 视觉产出，没有为 U-10 指定设备、分辨率、观察区域、通过语句和 artifact。

**最小处置：**保留共享父节点/row 作为结构子判据，另加 laptop 设备截图或测量证据，明确逻辑分辨率、列表和详情的非零可见区域、无重叠/裁剪以及 artifact 路径。无需引入布局引擎。

## S findings

### S-01 — R-4 所需的诊断字段没有纳入 §4.2 的 owning source 改动面

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:200-205,295-313; apps/terminal/ui/base/render/src/components/resolvePart.ts:87-110; apps/terminal/ui/base/render/src/foundations/diagnostics.ts:5-25`

**仓内事实：**R-4 要求 screen 缺失 error 包含 `partKey`、当前机型和 `containerKey`。现行 `missing-catalog-entry` 只记录 `partKey` 与 `displayMode`；`incompatible-catalog-entry` 才已有 `containerKey` 与 `surfaceForm`。§4.2 列了 `ScreenContainer` 与 `ScreenReadyBoundary`，但没有列出 `resolvePart.ts` 或 `diagnostics.ts` 的类型/报告改动。

**推论：**若实施方只照 §4.2 改页面，既有解析器仍会产生不满足 R-4 的缺字段诊断；若在 ScreenContainer 另记一条 error，则会出现重复诊断或两套 owner。

**反例：**保留当前 `resolvePartWithStatus` 的缺失分支，UI 可以显示定位码但日志中的 `missing-catalog-entry` 仍没有当前机型和容器；或者在 ScreenContainer 再写一条同名错误，违反现有诊断去重边界。

**最小处置：**D-2/§4.2 明确以 `resolvePart.ts` 为 missing screen diagnostic owner，补齐 `diagnostics.ts` 数据形状、去重 identity 和调用方；不要新增平行 logger。

### S-02 — U-2 的“真实拆分件 + 不得自造 part”没有给出可运行的 red fixture

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:187-193,321-323; apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-267; apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:24-43,61-103`

**仓内事实：**生产 assembly 把 `adminShellAssembly.parts` 与 integration parts 汇总后冻结；当前 sample-console 的真实生产 parts 中没有冲突兄弟。`createSampleAssembly` 没有注入任意 parts 的参数。U-2 又禁止用自造 part，只要求真实拆分件。

**推论：**现有文字不能产生“只影响另一机型”的真实冲突，也没有说明是临时源码 mutation、测试 sandbox 还是新增测试-only assembly。实施方可能在违禁的自造夹具和无法运行的真实 mutation 之间任意选择。

**反例：**测试里直接 `definePart({partKey:'x', surfaceForm:['laptop']})` 与另一个同 key 的对象，虽然能测算法，却没有经过真实生产 parts；只在 mobile 运行一个当前不存在的冲突，也不能证明 laptop 能发现它。

**最小处置：**在 D-8/U-2 指定一个可复现的临时源码 mutation：对现有 admin 兄弟中的一个声明暂时加入重叠 form，调用真实 `createConsoleAssembly`，分别以 laptop/mobile 运行并断言 key/forms；mutation 后恢复源码。若治理不允许临时源码 mutation，则需明确允许一个 assembly-level fixture，并证明它复用真实 production assembly 组装路径。不能只留“真实拆分件”。

### S-03 — U-4b 用“既有测试文件 diff 为空且全绿”不能证明 LayerStack 行为未改变

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:204-205,324-326; apps/terminal/ui/base/render/src/components/LayerStack.tsx:107-121,148-209; apps/terminal/ui/base/render/test/renderSurface.test.tsx:650-935`

**仓内事实：**当前 `LayerStack` 对未知 entry 保留 layer，并将缺失 guard 默认当作 decisive；现有 `renderSurface.test.tsx` 覆盖排序、遮罩、decisive/dismissible、BackHandler 和焦点。U-4b 的可执行形式却主要是“点名的既有 layer 测试文件 diff 为空且仍全绿”，且没有在判据里点名文件。

**推论：**测试文件未改变是范围事实，不是行为 oracle；代码可以改变而测试仍未覆盖，或者测试保持绿色但因断言过宽而无法发现回归。R-4 明确要求 layer 路径维持派发拒绝与渲染过滤，两者都需被现有相关断言实际覆盖。

**反例：**把 `LayerStack` 的未知 entry 从过滤改为空渲染，或让 decisive backdrop 可关闭，只改生产代码、不改测试文件，U-4b 的“diff 为空”仍然成立。

**最小处置：**点名 `apps/terminal/ui/base/render/test/renderSurface.test.tsx`，要求运行其中现有排序、遮罩、guard、BackHandler、焦点和未知 entry 相关断言；“diff 为空”只保留为 scope check，不能单独作为行为证明。无需新建门。

### S-04 — U-11 的“mobile 可用”没有可判定定义，也没有对应视觉/交互证据

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:268-276,317-318,333,355-369; apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx:16-52; apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx:14-28; apps/terminal/ui/base/primitives/src/theme/tokens.ts:34-38`

**仓内事实：**`PrimitiveGrid` 已经是 `flex-row flex-wrap`，而 `PrimitiveScrollView` 只有纵向 `contentOffset.y`；admin navigation 是可换行的 row。需求只写“所选形态可用、分区可切换”，没有定义 360×640 逻辑尺寸下的可点击、可见、无裁剪、无重叠、选中态或多行导航约束。D-7 要求 IA，但没有把“可用”转成验收值。

**推论：**focused test 可以证明按钮存在并触发回调，却不能证明移动设备上第二行没有被 bounded/overflow 裁剪，也不能证明内容仍有可视高度。

**反例：**导航项全部挂载且按测试 renderer 可切换，但导航容器高度被父 card 裁掉；或 section 数量变成当前值的两倍后内容被压到不可见，U-11 仍可能只按一次 `onPress` 通过。

**最小处置：**固定当前生产分区全集与 mobile 逻辑尺寸，增加 mobile focused 操作断言和设备截图/人工观察：所有当前分区均可见或可滚达、选中态可见、点击命中、内容不被裁剪。若只承诺当前固定分母，明确把未来增长列为非目标。

### S-05 — R-13 的“零新增能力”只对当前固定分母成立，未来失效边界没有写成约束

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:121-123,268-276,348,362-367; apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx:14-28; apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx:16-52`

**仓内事实：**当前 PrimitiveGrid 已提供换行，不需要给 PrimitiveScrollView 添加横向能力；但它没有 overflow/分页/纵向导航预算，bounded 内容又可能裁剪。需求把换行作为首选，同时只说“固定小分区集”，没有冻结分母或说明增长后的重新立项条件。

**推论：**“没有新增 primitive 能力”不能被泛化成“admin 分区数可持续增长”。当前方案可以是小范围最小解，但必须明确适用条件，否则未来新增一个 section 就可能破坏 mobile IA 而仍被判符合当前判据。

**反例：**增加足够多的 admin section 后，tablist 产生多行并挤掉内容；由于没有横向或纵向滚动，用户无法到达后续 section，而源码仍满足 `flex-wrap`。

**最小处置：**把 R-13/U-11 的分母限定为当前冻结的生产条目，并声明超过该分母必须另立 IA/能力需求；只有 Dexter 要求无限增长时，才另行引入滚动或列表导航。这样比现在立即增加 PrimitiveScrollView 能力小。

### S-06 — U-12 的直接 AST 判定无法挡住“读取下沉到 helper/间接输入”的自然绕过

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:278-283,334,363-365; tools/terminal-ui-render/check-static.mjs; apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx:45-54`

**仓内事实：**U-12 要求 hook 行为一致，并以 TS AST 检查 hook 模块不出现 `surfaceForm` 读取；R-14 同时禁止 hook 或 hook 调用的共享 helper 按机型分支。现有 `check-static.mjs` 的扫描范围是 render 包，不是 admin-shell hook；需求没有冻结 hook 文件、闭包范围、允许的输入类型或跨文件调用图。

**推论：**只扫描 hook 文件本身不能证明“hook 调用的 helper 不读机型”，行为 wrapper 也可能只覆盖当前输入而没有触达隐藏分支。把一个直接字符串检查扩成全仓通用 AST 门又会超出本需求的最小机制。

**反例：**

```ts
export const useAdminState = () => {
  const context = useSurfaceContext()
  return deriveAdminState(context['surface' + 'Form'])
}
```

或者 hook 模块只调用一个外部 helper，helper 读取 `surfaceForm`；直接 AST 判定都可能为绿。也可以在 wrapper 测试使用的 fixture 中让两种 form 结果相同，隐藏分支仍未被击中。

**最小处置：**D-8 冻结 hook 的闭包范围：hook 必须只消费与机型无关的状态输入，AST 至少遍历该 hook 的本地 helper/import closure 或改为一个明确的输入契约；行为 wrapper 对固定输入做两种 form 交叉 mutation。若不愿增加局部 AST 能力，就把“禁止 helper 读取”降为 review-only，并从 U-12 的机器判据中删掉，不要声称已挡住该绕过。

### S-07 — U-13/D-10 的生产分区分母没有按 integration 冻结

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:142-148,241-251,309-310,330-337,363-367; apps/terminal/ui/base/admin-shell/src/parts/parts.ts:15-66; apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:24-43; apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:11-35`

**仓内事实：**admin-shell 目前有 console、platform、runtime、display-context 四个 source part；sample-console 还通过 `sampleAdminTestPart` 增加一个真实装配的 admin section；sample-wallpaper-console 当前没有这一 sample section。U-13 说两个 integration 都要渲染“全部生产分区”，D-10 又说补齐“三个生产分区”，§1.10 把 sample admin test 视为生产 catalog 的一部分。

**推论：**“全部”至少有 shared-only、每个 integration 的真实 catalog、是否计入 console 本体/测试 section 三种解释。若不冻结分母，测试既可能漏掉 sample-console 的第五项，也可能错误要求 wallpaper integration 提供不存在的 sample section。

**反例：**只测试 admin-shell 的三个子分区，排除 console 和 sampleAdminTestPart，仍可声称“全部生产分区”；或者把 sample-console 的测试 section 当成两个 integration 的共同要求，导致 wallpaper 侧出现非本批次的伪需求。

**最小处置：**D-10/U-13 逐 integration 列表：shared admin 四项、integration-owned admin 项、是否把 console root 计为 section；为每个分母指定 partKey/testID。测试必须从真实 `createSampleAssembly` 取得 catalog，不用名称推断。

### S-08 — R-10/U-15 的“逐字相同”与 `definePart` 的默认归一化没有定义关系

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:243-251,334-337,367-369; apps/terminal/ui/base/render/src/foundations/definePart.ts:53-88`

**仓内事实：**`definePart` 对省略的 `layerGuard` 归一化为 `dismissible`，对省略的 `layerTier` 归一化为 `standard`；`catalogEntry` 只保存字段集合，renderer binding 另保存归一化后的 tier/guard。R-10 要求兄弟 part 除 form/renderer/component 外“逐字相同”，但 U-15 没有说明比较源码字面、输入对象还是归一化后的运行语义。

**推论：**focused test 可以证明运行语义相同，却不能证明输入源码逐字相同；反过来强制源码字面相同会把默认值是否显式写出变成额外 AST/文本规则。用 generic `definePart` 强制兄弟关系还会把 admin 特例扩散到所有 part。

**反例：**laptop 兄弟显式写 `layerGuard:'dismissible'`，mobile 兄弟省略该字段；当前 binding 相同，运行测试通过，但源码不“逐字相同”。若只比较 catalogEntry，又完全看不到 layerGuard。

**最小处置：**按实现目标把“逐字”改成封闭的 normalized semantic equality：比较两条 catalogEntry 的全部列出字段，并比较 renderer binding 的 `layerTier/layerGuard`；focused test 覆盖四组兄弟。不要在 `definePart` 增加全局 sibling 机制。若 Dexter 真要源码字面一致，再另加 scoped source review/AST 判定。

### S-09 — R-11 使用不存在的 `layout="container"` 语义，实施方会在 API 层产生歧义

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:112-123,253-261,361-363; apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx:8-32; apps/terminal/ui/base/primitives/src/theme/tokens.ts:30-38`

**仓内事实：**需求的源码事实正确列出实际 API 是 `fill|content|card|centered|transparent`，但 R-11/D-6 又以 `container`、`containerContent` 作为根容器版式档位的表达。当前 `PrimitiveContainer` 没有 `layout="container"`；`container`/`containerContent` 是 token 名。

**推论：**实施方照字面使用 `layout="container"` 会 typecheck 失败，按 token 名猜测又可能把 `fill` 与 `content` 混用，无法稳定对账。

**反例：**把根节点改成 `<PrimitiveContainer layout="container">` 直接不符合 `PrimitiveContainerProps`；把它改成 `content` 又会失去 token `container` 的 `flex-1` 语义。

**最小处置：**R-11/D-6 明确写 `layout="fill"` 使用 `baseTokens.container`，`layout="content"` 使用 `baseTokens.containerContent`，以及哪些节点需要 `bounded`/RN style。无需增加新的 primitive layout。

### S-10 — “7 个 card 浮层”不是当前源码的封闭全集

`STATUS=CONFIRMED`
`SEVERITY=S`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:124-134,253-261,361-363; apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx:103; apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx:35,57; apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx:27; apps/terminal/ui/feature/sample-staff-auth/src/components/AuthNotice.tsx:25; apps/terminal/ui/feature/sample-member-desk/src/components/{DiscardConfirm,RegistryNotice,WaitingConfirm,WithdrawConfirm}.tsx`

**仓内事实：**当前 `rg -n 'layout="card"' apps/terminal --glob '*.tsx'` 得到 9 个调用点，其中去重后的 production component call site 是 8 个：AdminLogin、AdminShell、SystemFailureNotice、AuthNotice、DiscardConfirm、RegistryNotice、WaitingConfirm、WithdrawConfirm。需求把 card float 记为 7 个，却没有说明是否排除 AdminLogin、AdminShell 的内层、通用 SystemFailureNotice 或按 runtime part 展开。

**推论：**实施方无法知道“全部 card 浮层”的分母；更新七处会留下一个旧留白路径，或把通用 SystemFailureNotice 的多个 part 重复计算/漏算。去掉 LayerStack wrapper 的留白后，遗漏者可能改变垂直轴。

**反例：**只按七个业务确认组件修改，AdminLogin 仍保留旧 card；或者修改 generic `SystemFailureNotice` 时只验证一个调用者，其他 system notice 沿旧路径回归。

**最小处置：**用精确文件/组件路径替代数量，并说明 AdminShell 外壳、AdminLogin、通用 SystemFailureNotice 是否属于 R-11；对通用组件按调用路径/partKey 列出验证全集。无需扩大改动范围，只需把分母写完整。

## N findings

### N-01 — R-7 文件扩展名建议尚未完成 Metro/打包器核验

`STATUS=UNVERIFIED_REQUIRES_EVIDENCE`
`SEVERITY=N`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:224-229,355-362; apps/terminal/assembly/android/sample-terminal/metro.config.js; apps/terminal/assembly/android/sample-wallpaper-terminal/metro.config.js`

需求把 `.laptop.tsx`/`.mobile.tsx` 作为建议，同时承认扩展名冲突交详设核实。当前可见 Metro 配置使用 Expo/默认 resolver 组合，没有本轮静态证据证明这两个后缀会自动参与解析，也没有证明不会被当作普通文件。R-7 已裁定 review-only，因此这不会单独阻塞机制，但 D-5 必须在定名之前给出实际 resolver 核验或改用不依赖扩展名的命名规则。

**反例：**若 import 侧显式改路径则 typecheck 绿，但 Metro 生产 resolver 不把 `.laptop.tsx` 当平台扩展；若同时留下同名普通文件，开发与 release 解析顺序可能不同。

### N-02 — U-1 的 red mutation 过于抽象，不能保证真的击穿 central filter

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=N`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:179-185,319-323; apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-267`

“把过滤从 consoleAssembly 挪进任一 feature”不是一个可复跑 mutation。只移动一个当前未被 U-1 覆盖的 feature，中心过滤仍在，测试可能继续绿；若把所有 feature 一次性改掉，又不再是最小 red mutation。D-8 需要指定 mutation 文件、保留/移除的中心逻辑、两种 form 和断言结果。

**最小处置：**在验收计划中指定一个固定 feature 的单点 mutation，并让真实 assembly 同时包含一个只在 laptop、一个只在 mobile 的 part；用两种 form 断言 catalog 缺席/存在，证明中心过滤确实是必要 owner。

### N-03 — R-2 的“任一机型都发现”需要限定 assembly 范围并补输入边界

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=N`
`OWNING_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md:187-193,357-358; apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-267`

在单个 `createConsoleAssembly` 的完整 `allParts` 上，预过滤分组确实能使 laptop 发现只影响 mobile 的冲突，反例也支持这一点。但“任一机型”不应理解为未装配该条目的其他 integration 也能发现；同时需求没有写一个 part 内重复 form、空 form、多于两条兄弟时的封闭输入规则。

**最小处置：**将范围写为“每个实际汇总该 parts 集合的 production assembly，任意合法 `SurfaceForm` 启动均执行全集合冲突检查”，并在 D-1/D-8 明确空/重复 form 是类型或 focused 输入校验问题。无需做跨 integration 的全局注册表。

## 对独立核验重点的直接回答

### R-1/R-2 落点与更小替代

当前生产边界确实是 `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-267`：先汇总 `adminShellAssembly.parts` 与 input parts，再调用唯一性断言、建立 UI catalog 和 renderer catalog。把 R-2 的未过滤冲突扫描放在 `allParts` 后、R-1 的过滤前，再把过滤结果传给既有 `assertUniquePartKeys`/catalog，是最小的单 owner 方案。

更简单的“先过滤、再用重复 partKey 报错”不能满足 R-2：只影响 mobile 的 overlap 在 laptop 启动不会经过冲突项，原已知边界仍存在。把冲突规则放进各 feature 会重新引入漏接风险；改 catalog key 或把所有 form 条目同时放入运行 catalog 则扩大了索引、渲染和持久化改动。需要修正的只是“同一函数内的一次分组遍历”措辞：实现上通常是一次分组扫描加一次过滤扫描，虽然仍是同一边界、线性成本，不应把“单函数”说成“单遍历”。

`createUiCatalog` 的公开直调仍可绕过 assembly，这是需求 §1.10 已识别的非生产构造路径；最小做法是把生产验收改为真实 `createSampleAssembly`，而不是为公开 helper 再造一套 form 表或门。

### R-5 三态与 R-S1/R-S7

从现有渲染结构看，三态在机制上可以闭合：真实 resolved part 才能进入 `ScreenReadyBoundary`，not-found 可以在 ready 前后分流，非目标表面可以保留容器内 fallback。通过入参传入 not-found 文案也可以不改变 `ScreenReadyBoundary.tsx` 中供真正启动失败页使用的 `FAILURE_MESSAGE`；前提是保持 standalone/true startup failure 的默认文案和 testID。

但这只能说明“技术上可实现”，不代表产品边界已成立。§8① 未裁决前，不能决定哪一分支收起 splash、哪一分支使用启动失败页，也不能自行把 not-found 错误码加入现有启动失败页的可访问性文案。M-01 仍是阻断。

### R-6 容器失效记录的取舍

我倾向 **not-found 时读时回落默认 partKey**，原因是它遵守 R-6 的“默认值读时派生、不得写入容器表”，不删除用户持久化选择，不需要新增一个异步 state mutation 或 persistence write owner，改动面小且可恢复。应记录一次可区分“跨机型条目/已下线条目”的诊断，并避免每次 render 重复刷日志。

容器裁剪的代价是新增水合/状态清理时机、写回或状态替换语义，以及“用户选择被删除”的可恢复边界；优点是坏记录一次清除后不再重复触发。若 Dexter 更重视持久化卫生而接受清除记录，可选裁剪，但详设必须明确 owner 和不把默认值写回的边界。按当前 KISS 与 R-6 文字，读时回落是更小的实现；无论选哪种，都必须与 R-1 同批。

### R-10/U-15：focused test 还是 definePart 约束

选 **admin-shell 范围内 focused test**，不在通用 `definePart` 增加 sibling-aware 机制。`definePart` 只知道一条 part，不知道同 `partKey` 的兄弟全集；把关系约束放进去会新增全局机制并可能误伤非 admin 的合法 part。focused test 应比较四组 sibling 的 normalized catalog 字段和 renderer binding 的 tier/guard，并断言 rendererKey 互异。当前“逐字相同”必须先改成上述可观察的语义相等，或者明确另需 AST/人工源码核验。

### R-11 铺满、样式来源与垂直轴

“样式只能来自 primitives 既有 token 或 RN style”的判断成立：两个 Android App 的 tailwind scan 范围包含 App、自有 integration 和 primitives，但不包含 admin-shell/render；admin-shell 当前也没有 `className`。`LayerStack` 的 wrapper 当前确实有全屏绝对定位、居中和 24 padding，移除这三项的方向与 U-9 一致。

但七个 card 的数字不成立，且去掉统一 wrapper 留白后，不能假设七/八个 card 都自动保持可用高度。`PrimitiveContainer` 的 card/bounded 规则和各组件自身的 stack/input/button 间距必须按精确路径盘点；这一点需要 U-9 结构断言加 U-10/U-11 视觉/交互证据，不能仅靠 JSX 树。

### R-13 mobile 形态

对**当前小而固定的分区集合**，换行分区条是“新增 primitive 能力为零”的真实判断：已有 `PrimitiveGrid` flex-wrap，不需要横向 ScrollView；它不是对任意未来分区数都成立的容量承诺。需求应把当前分母和增长边界写清，否则“最佳实践”会随着分区增长失效。

### §1.10 两处手搓 catalog 测试

生产语义应走真实 `createSampleAssembly`。`sampleAssembly.test.tsx:348-385` 已有真实 assembly mount，但 `:364-368` 又手搓 catalog，且测试名把它称为 production admin test section；这一段应删除或改为明确的非装配 selector 专项，并从 U-1/U-13 的生产证据中排除。` :332-346` 若保留，应改名为“直接 catalog selector 的非装配路径”，说明它只覆盖 public helper 的兼容性，不代表生产装配。

### 是否分批

我会分成两批：

1. **机制批 R-1 至 R-9**：装配冲突检查与过滤、screen not-found 三态、容器默认/恢复、诊断语义和既有 layer 行为对账。R-5 与 TR-13 裁决先闭合；R-6 恢复必须和 R-1 同批。
2. **admin 批 R-10 至 R-14**：兄弟条目拆分、layout/root/LayerStack/card 垂直轴、laptop master-detail、mobile IA、共享 hook 与全部 admin 生产分区证据。

机制批进入 admin 批的最小门槛是：

- 两种 `SurfaceForm` 经真实 integration assembly 成功装配，当前 catalog 只含本机条目；不依赖手搓 catalog。
- 任一合法机型都能发现另一机型的 overlap，错误包含 key/forms；U-2 的真实 red mutation 可复跑。
- R-5 三态已按 Dexter 裁决实现并证明 not-found 不进入 ready path；R-S1/R-S7 的 splash/ready 关系闭合。
- R-6 选定的恢复路径已证明跨机型冷启动不永久停在 stale not-found，默认值未写入容器表；R-9 水合诊断能区分损坏/跨机型/下线记录。
- sample1/sample2 既有 part 的 layer dispatch rejection、render filtering、层级、遮罩、焦点和持久化身份 focused 回归通过；`renderSurface.test.tsx` 相关既有 oracle 被实际运行。

这道门只证明机制不会阻断或改变既有可渲染行为，不提前宣称 admin 的“铺满”“同屏”或 mobile 可用性；后者应在第二批用真实设备/视觉证据收口。

## U-1 至 U-15 可执行性盘点

| 判据 | 当前判断 | 主要问题/条件 |
|---|---|---|
| U-1 | 可执行但需补 mutation | 必须指定 feature 单点 mutation、两种 form、真实 assembly 与负对照；见 N-02 |
| U-2 | 当前不可直接执行 | 没有真实冲突 fixture 产生方式；见 S-02 |
| U-3 | 可执行 | 用真实 assembly、区分组件输出且断言另一 form 缺席；不要用组件名/rendererKey冒充 |
| U-4a | 条件可执行 | R-5 裁决后，补 `resolvePart.ts`/`diagnostics.ts` owner；见 M-01、S-01 |
| U-4b | 当前不足 | “测试文件不变且绿”不是行为 oracle；见 S-03 |
| U-5 | 条件可执行 | 三态技术路径可做，但产品边界仍待 Dexter；见 M-01 |
| U-6 | 可执行但需 D-3 取舍 | 推荐读时回落默认；需断言反序列化容器键集合和 stale recovery |
| U-7 | 可执行 | 需按现有 wallpaper 单机型行为与 layer 行为全集验证，不要求 catalog 等价 |
| U-7b | 可执行但依赖 U-6 | 同时观察 layer/container 渲染树，不能只看 state |
| U-8 | 可人工/review 执行 | 不应声称存在机器门；Metro 扩展名仍需核实，见 N-01 |
| U-9 | 当前不可闭合 | ROI 差分不是绝对覆盖 oracle；见 M-04 |
| U-10 | 当前不可闭合 | row/共享父节点不等于同屏；需设备视觉/测量证据，见 M-05 |
| U-11 | 条件可执行 | “可用”需定义固定分母、360×640 约束和交互/视觉证据，见 S-04/S-05 |
| U-12 | 部分可执行 | 行为 wrapper 可做；直接 AST 不能覆盖 helper closure，见 S-06 |
| U-13 | 当前分母未闭合 | 两个 integration 的 production sections 需逐项列出，见 S-07 |
| U-14 | 等待 TR-13 裁决 | 依赖 §8② 的 catalog 对象定义，见 M-02 |
| U-15 | 可执行但语义未闭合 | 采用 normalized semantic equality + 四组 focused test；见 S-08 |

## §4.2 与 §7 需要补的设计缺口

除 M-03 的章节矛盾外，进入详设前至少应补以下正本内容：

- D-2 明确 `resolvePart.ts`/`diagnostics.ts` 是 R-4 缺失 screen 诊断的 owner，并定义 not-found 的 code/testID/data shape、去重和 `FAILURE_MESSAGE` 保持范围。
- D-3 明确选择“读时回落默认”或“容器裁剪”，以及跨机型 stale、下线、损坏三类记录的日志与状态边界。
- D-6 用实际 `PrimitiveContainer` layout 值替代 token 名，列出完整 card call-site/partKey 分母和每个组件的垂直轴处置。
- D-7 把“mobile 最佳实践/可用”变成固定分区集合、逻辑尺寸、可达性、裁剪/重叠、选中态、返回与 a11y 的可观察条件。
- D-8 明确 U-2/U-12 的 mutation、negative control、AST closure scope；不能只写“真实”或“复用惯用法”。
- D-10/U-13 逐 integration 列出 production section denominator，并处置两处手搓 catalog 测试的命名/证据归属。
- D-13 不只覆盖 U-9；U-10 laptop master-detail 与 U-11 mobile usable 也需要设备、分辨率、观察内容、通过语句和产物落点。

## 未验证清单与边界

- 未执行任何构建、focused test、native、Android、Web、release、设备冷启动、截图或 cleanup；因此不把静态判断升级为行为 PASS。
- R-5 与 TR-13 是 §8 明确的 Dexter 待裁决项，不能在本评审中替 Dexter 预设。
- R-6 是详设选择项；本评审给出“读时回落默认”的实施倾向，但不把它当作已授权产品裁决。
- R-7 的 Metro 扩展名、U-9/U-10/U-11 的真实视觉与设备行为仍需后续详设/实施证据。
- 本报告没有修改任何仓内文件，除本评审记录本身外没有新增实现或测试产物。

