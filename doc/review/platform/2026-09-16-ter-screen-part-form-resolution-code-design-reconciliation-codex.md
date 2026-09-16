# TER screenPart 机型解析 · 逐代码与详设对账

```text
REVIEW_TARGET=CODE_DESIGN_RECONCILIATION
REVIEW_KIND=FINAL_PRE_IMPLEMENTATION_REVIEW_HANDOFF_GATE
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
REVIEWER_KIND=MAIN_AGENT_LINE_BY_LINE_READBACK
RESULT=MATCHED
OPEN_ROWS=0
```

## 1. 对账方法与边界

本记录是实施计划 §8.3 要求的最后一道“逐代码与详设对账”，不是三维对账、focused
测试汇总，也不是 implementation review verdict。主 agent 逐一重开了本次实施实际修改的
源码、测试、README、invariant、静态基线修复文件及本批 evidence 索引，并把每个文件映射到
implementation design §12/§13/§14/§15、IA-01～IA-06 和 implementation plan A-0～A-4、
B-1～B-3、CP-6。每一行只使用 `MATCHED` 或 `OPEN`；本表没有抽样行。

对账检查维度为：owner、输入/输出类型、partKey/form、状态、文案、a11y/testID、失败/恢复、
持久化/失效、日志脱敏、禁做项，以及是否出现计划外的源码落点。临时 red mutation 的失败和
恢复记录分别保留在各 CP evidence；没有把测试名、退出码、作者自报数字或后续 review 当作
代码事实。

CP-3 的 fresh 对账工具在连续状态诊断后仍未产出 verdict，已由主 agent 按仓内规则接管并
明确记录为 `MAIN_AGENT_FALLBACK`；这不被本表改写成 fresh review。其余步骤级及 A/B 全批
对账记录仍逐一保留，最后的实现交付仍交给独立的 `REVIEW_TARGET=IMPLEMENTATION` review。

## 2. 机制、ready 与 render

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 1 | `apps/terminal/ui/base/render/src/types/props.ts` | typed content/system/transition failure、nullable `readyPartKey` 与 `contentFailure` 对齐；删除该字段或把 content category 当 system 的红夹具已在 CP-1 evidence 记录。 | design §12.1–§12.3、D-2/D-9；IA-03/04；plan A-1 | MATCHED |
| 2 | `apps/terminal/ui/base/render/src/index.ts` | 公共类型出口与实现一致；未增加兼容别名，render invariant 已同步。 | design §12.1/D-9；plan A-1、A-0 | MATCHED |
| 3 | `apps/terminal/ui/base/render/src/components/resolvePart.ts` | missing/incompatible/empty/invalid-props 保持 content 语义；runtime-not-started、runtime-start-failed、surface-host-unavailable 分类不靠字符串消费。category 变异在 CP-1 红。 | design §12.1/§12.2、D-2；IA-03/05；plan A-1 | MATCHED |
| 4 | `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx` | content failure 在容器内可见；有 placement identity 时 ready 使用 requested `partKey`，只有 container-empty 为 null；system 只进目标 PRIMARY，transition 保持 neutral；content-ready 后 system failure 使用运行期档位。 | design §12.2/§12.3、D-2；IA-03/04/05；plan A-1/A-2 | MATCHED |
| 5 | `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx` | 仅目标 PRIMARY 在物理 host、正布局及 resolved/可见 content failure 后上报；SECONDARY、hostless/Web proxy、transition 不上报。 | design §12.3、D-2/D-9；IA-03/04/05；plan A-1 | MATCHED |
| 6 | `apps/terminal/ui/base/render/src/components/LayerStack.tsx` | 保留层级、遮罩、decisive/dismissible、back/close owner；过滤当前 catalog 不可呈现 hydrated layer，避免 backdrop/空层残留；移除旧全局居中/内缩。 | design §12.4/§12.7、D-4/D-6；IA-06；plan A-2/A-3/B-2 | MATCHED |
| 7 | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx` | 保留 surface host/layout 观察边界，不把 form 选择或 content failure 误升成 host readiness；CP-2 readiness/surface 证据已回读。 | design §12.3；IA-03/04/05；plan A-2 | MATCHED |
| 8 | `apps/terminal/ui/base/render/src/components/RenderProvider.tsx` | `hasPrimarySurfaceReady` 是唯一 ready latch；content failure ready 后不清零，后续 system failure 只能进入运行期档位；删除 latch 的 red mutation 已在 CP-1 evidence 记录。 | design §12.3、D-2；IA-04；plan A-1 | MATCHED |
| 9 | `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts` | surface 形态/显示模式上下文继续由 render owner 提供，未新增第二个 form/ready owner；SurfaceRoot/LayerStack 使用同一上下文。 | design §12.3/§12.7、D-7；IA-01/02；plan A-2/B-2 | MATCHED |
| 10 | `apps/terminal/ui/base/render/src/foundations/diagnostics.ts` | content diagnostic 含有限 reason/key/form/container 信息；container-empty 明确 `partKey:null`；不传原始 props、错误消息或敏感数据；没有跨层 declaration metadata。 | design §12.1/§12.4、D-2/D-4；IA-03/06；plan A-1/A-2 | MATCHED |
| 11 | `apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx` | 失败页仍由 system category/owner 控制，content failure 不复用 system page；运行期/启动期 testID 与文案路径保持设计定义。 | design §12.2/§12.3；IA-03/04；plan A-1/B-2 | MATCHED |
| 12 | `apps/terminal/ui/base/render/test/renderSurface.test.tsx` | 覆盖四种 content、system/transition、PRIMARY/SECONDARY/hostless、nullable ready 与 R-16 时序；三条实际 production red mutation 均能红且源码已恢复。 | design §13 U-4a/U-5/U-5b；IA-03/04/05；plan A-1 | MATCHED |
| 13 | `apps/terminal/ui/base/render/test/layerStack.test.tsx` | 直接挂载真实 LayerStack，cross-form hydrated layer 既无 `layer-backdrop` 也无空 layer；绕过 availability filter 的反例由测试捕获。 | design §13 U-4b/U-7b；IA-06；plan A-3/B-2 | MATCHED |
| 14 | `apps/terminal/ui/base/render/terminal-invariants.json` | 与当前公共出口逐项同步，修复静态首败中缺失的六个 typed failure/export 条目；未增加未授权 API。 | design D-9；plan A-0/A-1/B-3 | MATCHED |

## 3. hydration、默认值与 startup payload

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 15 | `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts` | 结构无效记录与当前 catalog 不可呈现记录分开诊断；有效序列化形状不漂移。 | design §12.4、D-3/D-4；IA-06；plan A-2 | MATCHED |
| 16 | `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts` | `hasUiContainerDeclarations` 与 availability predicate 归 catalog owner；无 declaration 的 layer-only fixture 不被误删，真实 console catalog 仍走 membership prune。删除 guard 的 focused 反例已记录为首败。 | design §12.4、D-4；IA-06；plan A-2 | MATCHED |
| 17 | `apps/terminal/kernel/base/ui-state/src/features/commands/pruneHydratedContainers.ts` | 公开 command 只承载真实 prune owner；顺序在 surface/container render 前，默认不写入 container。 | design §12.4、D-3/D-4；IA-06；plan A-2 | MATCHED |
| 18 | `apps/terminal/kernel/base/ui-state/src/features/commands/index.ts` | prune command 的公共安装出口与 module owner 一致，无第二套恢复入口。 | design D-3/D-4；plan A-2 | MATCHED |
| 19 | `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts` | 复用 owner-only content write 持久清除失效 placement；unknown/retired/other-form 使用单一 `hydrated-container-not-renderable` 与中性文案；未引入 metadata 通道。 | design §12.4、D-3/D-4；IA-06；plan A-2/A-3 | MATCHED |
| 20 | `apps/terminal/kernel/base/ui-state/src/features/actors/index.ts` | content actor 安装与真实 module 一致，prune 顺序可追踪；没有把测试 helper 当生产 actor。 | design D-3；plan A-2 | MATCHED |
| 21 | `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts` | hydration/prune 在 surface 创建前安装并执行；默认是读取选择而不是 dispatch/persist action。 | design §12.4、D-3；IA-06；plan A-2 | MATCHED |
| 22 | `apps/terminal/kernel/base/ui-state/test/content.test.ts` | 覆盖结构无效、不可呈现、持久清除与旧 archive/layer-only 边界；先前删除 guard 的三条回归已保留为首败记录，修复后 6 files/40 tests。 | design §13 U-6/U-7b；plan A-2/A-3 | MATCHED |
| 23 | `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx` | 唯一 assembly owner 先检查未过滤输入，再按 form 过滤；writer 只在实际十个 port bindings、六组启动组、PRIMARY declared/measured/real-ready 同时成立时写 complete；content identity 原样透传。最新 `group.ports` release 首败已改为实际 binding-presence predicate，DEV descriptor 只作诊断。 | design §12.3–§12.5、D-1/D-2/D-9；IA-03/04/06；plan A-2/A-3 | MATCHED |
| 24 | `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts` | 唯一 `startup.complete` writer，缺任一组不写、重复写拒绝；不新增 production diagnostic event。 | design §12.3、D-9；IA-04；plan A-2 | MATCHED |
| 25 | `apps/terminal/ui/base/console-assembly/test/startupDiagnosticsWriter.test.ts` | 覆盖 six groups、PRIMARY facts、nullable/content payload、duplicate/缺组与 descriptor-free binding boundary；writer/port logger owner 互不替代。 | design §13 U-5b/U-8/U-14；plan A-2 | MATCHED |
| 26 | `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | ready payload 传 nullable `readyPartKey`、typed content failure 与启动 facts；现有 sample1 partKey/layerId/testID 不改。 | design §12.3/D-9；IA-01/03/04；plan A-2 | MATCHED |
| 27 | `apps/terminal/ui/integration/sample-console/src/application/module.ts` | 运行期 actor/module 接收 assembly payload，诊断/complete 不另建 owner。 | design §12.3/D-9；plan A-2 | MATCHED |
| 28 | `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx` | 与 sample-console 同一 ready contract，sample2 picker/恢复 identity 不漂移。 | design §12.3/D-9；IA-01/03/04/06；plan A-2 | MATCHED |
| 29 | `apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts` | 运行期 actor/module 保留 payload 与 startup writer 链路；无第二 complete 判定。 | design §12.3/D-9；plan A-2 | MATCHED |

## 4. pre-filter 冲突、真实装配与集成测试

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 30 | `apps/terminal/ui/base/console-assembly/vitest.config.ts` | focused runner 可加载真实 assembly/React Native fixtures；没有把生产行为迁移到 test-only config。 | design §12.5、D-1/D-10；plan A-3 | MATCHED |
| 31 | `apps/terminal/ui/base/console-assembly/test/partSelection.test.ts` | 使用真实 `definePart`/admin sibling，overlap 在 filter 前对 laptop/mobile 都红；empty/duplicate 与 unique catalog 断言也保留。 | design §13 U-1/U-2/U-3/U-14/U-15；plan A-3/A-4 | MATCHED |
| 32 | `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` | production-path wrapper 调真实 `createSampleAssembly`，两种 form 的 production section 分母均断言；具名 U-4b 既有 layer 用例实现/断言未改，其他 D-1/D-10 手搓 catalog 用例按计划改造。 | design §13 U-1/U-4b/U-7/U-13/U-14；IA-01/02/06；plan A-3/A-4/B-2/B-3 | MATCHED |
| 33 | `apps/terminal/ui/integration/sample-console/test/support.ts` | test-only unavailable port descriptor 可显式注入；descriptor-free release-like fixture 保证 writer 不能把 DEV descriptor 当生产 prerequisite；没有生产调试面。 | design §12.3/D-9；plan A-2/A-3 | MATCHED |
| 34 | `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx` | 真实 assembly 覆盖两形态；A-3 cross-form hydration 通过真实 filtered catalog 产生并断言 prune、diagnostic 与 LayerStack 无残留。 | design §13 U-7b/U-13；IA-01/02/06；plan A-3/A-4/B-3 | MATCHED |
| 35 | `apps/terminal/ui/integration/sample-wallpaper-console/test/support.ts` | 与 sample-console 使用同一 unavailable port/measure helper 语义；测试 seam 可控且不进入 production package。 | design §12.3/D-9；plan A-2/A-3 | MATCHED |
| 36 | `apps/terminal/ui/base/admin-shell/src/parts/parts.ts` | 四个稳定 key 各有 laptop/mobile sibling；form 集合不相交，rendererKey 唯一，CP-4 先保持同组件以证明零回归。 | design §12.6、D-12；IA-01/02；plan A-4 | MATCHED |
| 37 | `apps/terminal/ui/base/admin-shell/test/parts.test.ts` | 实际八条生产 declaration、四 key、form disjoint、renderer identity、catalog 七字段及 binding 的 layerTier/layerGuard 全比较；漏 guard/缺 sibling 的红夹具边界保留。 | design §13 U-2/U-3/U-14/U-15；plan A-4/B-1 | MATCHED |

## 5. admin 组件、hook、版式与可访问性

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 38 | `apps/terminal/ui/base/admin-shell/src/types/adminShell.ts` | 两形态 renderer 的输入/输出和 section 选择类型保持 finite、partKey-only；没有把 form 读入 hook contract。 | design §12.7、D-7/D-8；IA-01/02；plan B-1 | MATCHED |
| 39 | `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts` | hook 只保存 raw requested key、sections 与 selection；不读/分支 `surfaceForm`。AST red mutation 已真实失败并恢复。 | design §12.7、D-8；IA-01/02；plan B-1 | MATCHED |
| 40 | `apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx` | 仍是认证、close command、focus scope 与卸载 owner；form-specific wrapper 不复制这些生命周期。 | design §12.7、D-7/D-8；IA-01/02/06；plan B-1/B-3 | MATCHED |
| 41 | `apps/terminal/ui/base/admin-shell/src/components/AdminLayerLaptop.tsx` | laptop 选择/renderer 绑定只在 form-specific layer wrapper；未把 form 语义下沉到共享 hook。 | design §12.7、D-7/D-8；IA-01；plan B-1 | MATCHED |
| 42 | `apps/terminal/ui/base/admin-shell/src/components/AdminLayerMobile.tsx` | mobile 与 laptop 同一生命周期 owner；fallback 在 component 层处理。 | design §12.7、D-7/D-8；IA-02；plan B-1 | MATCHED |
| 43 | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx` | 保持单一 content frame/section content owner，切换不新增 scroll 或 HTTP owner。 | design §12.7、D-6/D-7；IA-01/02；plan B-2 | MATCHED |
| 44 | `apps/terminal/ui/base/admin-shell/src/components/AdminShell.tsx` | 保留既有公共兼容 wrapper；私有 laptop/mobile orchestration 未泄漏为新公共 API。 | design §12.7、D-8/D-9；IA-01/02；plan B-1/B-3 | MATCHED |
| 45 | `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx` | root 使用 fill canvas；不再将 admin 根限制为 card/maxWidth；layout mutation 已在 focused test 红。 | design §12.7、D-6/D-7；IA-01/02；plan B-2 | MATCHED |
| 46 | `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx` | 在共享 workspace 内提供 master-detail row，本机信息作为 section；不引入第二 catalog/scroll owner。 | design §12.7、D-7；IA-01；plan B-1/B-2 | MATCHED |
| 47 | `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx` | 复用 wrap navigation 与单一 bounded content frame；固定 360×640 入口仍由 device evidence 验证，未偷加横向 scroll。 | design §12.7、D-7/D-14；IA-02；plan B-2/B-3 | MATCHED |
| 48 | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx` | 共享导航保留现有 section identity/testID 与 selection owner，不承担 form 解析。 | design §12.7、D-7/D-8；IA-01/02；plan B-1/B-3 | MATCHED |
| 49 | `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx` | 真实 Pressable 动作节点有 button role、label、selected state；role/selected 两条 red mutation 均能红。 | design §12.7、D-7/D-14；IA-01；plan B-3 | MATCHED |
| 50 | `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx` | login card 是独立 bounded floating card，保留原登录 owner/identity；不把 admin root 的 fill 语义误套为 card。 | design §12.7、D-6/D-7；IA-01/02；plan B-2 | MATCHED |
| 51 | `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx` | shared section 保留 bounded content owner；形态选择留给 sibling renderer。 | design §12.7、D-6/D-7/D-15；IA-01/02；plan B-2 | MATCHED |
| 52 | `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionLaptop.tsx` | laptop section 在 master-detail content 内渲染，本机信息 section identity 不改。 | design §12.7、D-7；IA-01；plan B-2 | MATCHED |
| 53 | `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionMobile.tsx` | mobile section 在单一 bounded frame 内渲染；无第二 scroll owner。 | design §12.7、D-7/D-14；IA-02；plan B-2 | MATCHED |
| 54 | `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx` | shared platform section 的内容/状态 owner 不变，版式由形态 renderer 承担。 | design §12.7、D-6/D-15；IA-01/02；plan B-2 | MATCHED |
| 55 | `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSectionLaptop.tsx` | laptop bounded section 与 detail column 对齐；未改 platform port 事实来源。 | design §12.7、D-6/D-7；IA-01；plan B-2 | MATCHED |
| 56 | `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSectionMobile.tsx` | mobile bounded section 与 wrap navigation 共用 content frame；未引入横向能力。 | design §12.7、D-6/D-14；IA-02；plan B-2 | MATCHED |
| 57 | `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx` | shared runtime section 保留数据/状态 owner。 | design §12.7、D-6/D-15；IA-01/02；plan B-2 | MATCHED |
| 58 | `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionLaptop.tsx` | laptop 版式只改变视图，不改变 runtime identity/state。 | design §12.7、D-7；IA-01；plan B-2 | MATCHED |
| 59 | `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionMobile.tsx` | mobile 版式只改变视图，不改变 runtime identity/state。 | design §12.7、D-14；IA-02；plan B-2 | MATCHED |
| 60 | `apps/terminal/ui/base/admin-shell/src/components/sections/SampleSection.tsx` | sample section 仍是 production section owner，未把测试 section 当成生产 catalog。 | design §12.7、D-10/D-15；IA-01；plan B-2/B-3 | MATCHED |
| 61 | `apps/terminal/ui/base/admin-shell/test/adminSections.test.tsx` | hook/section wrapper 行为、raw selection 与 fallback 关系被真实组件测试覆盖；未知 key 不改变 hook 语义。 | design §13 U-8/U-12/U-13；IA-01/02；plan B-1 | MATCHED |
| 62 | `apps/terminal/ui/base/admin-shell/test/adminSectionsStructure.test.ts` | AST 遍历 hook 及本包相对导入闭包，拒绝 surfaceForm read/branch；真实 production mutation 已红。 | design §13 U-12、D-8；plan B-1 | MATCHED |
| 63 | `apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts` | root fill、LayerStack/card/bounded denominator 与 card owning center 的结构属性被锁；不把结构断言冒充像素证据。 | design §13 U-9/U-10/U-11、D-6/D-13；IA-01/02；plan B-2 | MATCHED |
| 64 | `apps/terminal/ui/base/admin-shell/test/parts.test.ts` | 见第 37 行；当前同一实现文件只有一份 sibling 语义比较，未加通用 definePart 机制。 | design §13 U-15/D-12；plan A-4/B-1 | MATCHED |
| 65 | `apps/terminal/ui/base/admin-shell/test/react-test-renderer.d.ts` | focused host/composite 测试的最小类型边界；不改变 production runtime。 | design §13 U-9/U-11；plan B-2/B-3 | MATCHED |
| 66 | `apps/terminal/ui/base/admin-shell/package.json` | 为本包既有 focused/AST 执行体提供现有测试依赖入口；未新增跨包 checker 或运行期能力。 | design D-8/D-12；plan B-1 | MATCHED |

## 6. feature、primitive 与 README

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 67 | `apps/terminal/ui/base/primitives/src/components/PrimitiveHeading.tsx` | heading host 保留 header role，增加 polite live announcement；未用 imperative focus 另建 owner。 | design §12.7、D-7；IA-01/02；plan B-3 | MATCHED |
| 68 | `apps/terminal/ui/base/primitives/test/primitives.test.tsx` | 删除 live-region 的真实 mutation 已红；测试观察 host node，不把 composite props 误当可访问性证据。 | design §13 U-10/U-11；plan B-3 | MATCHED |
| 69 | `apps/terminal/ui/feature/sample-staff-auth/src/components/AuthNotice.tsx` | 失败/提示 card 的 bounded frame 与既有登录语义保持；不改变 auth owner/part identity。 | design §12.7、D-6/D-7；IA-03；plan B-2 | MATCHED |
| 70 | `apps/terminal/ui/feature/sample-member-desk/src/components/DiscardConfirm.tsx` | floating card 自持 bounded frame，close/confirm 交回既有 layer owner。 | design §12.7、D-6/D-7；IA-06；plan B-2 | MATCHED |
| 71 | `apps/terminal/ui/feature/sample-member-desk/src/components/RegistryNotice.tsx` | floating notice 版式调整不改 partKey/layer/testID、业务文案或 action owner。 | design §12.7、D-6/D-7；IA-03/06；plan B-2 | MATCHED |
| 72 | `apps/terminal/ui/feature/sample-member-desk/src/components/WaitingConfirm.tsx` | floating confirm 自持 bounded frame，未新增第二个 scroll/back owner。 | design §12.7、D-6/D-7；IA-06；plan B-2 | MATCHED |
| 73 | `apps/terminal/ui/feature/sample-member-desk/src/components/WithdrawConfirm.tsx` | floating confirm 自持 bounded frame，保留原 action/close 语义。 | design §12.7、D-6/D-7；IA-06；plan B-2 | MATCHED |
| 74 | `apps/terminal/ui/base/primitives/README.md` | 说明 PrimitiveHeading 的 header/polite announcement 与证据边界；示例回源码存在。 | design §12.7/§14；plan B-3 | MATCHED |
| 75 | `apps/terminal/ui/base/admin-shell/README.md` | 说明 partKey-only、双形态、layout、focus/close 与 private renderer；没有虚构 API。 | design §12.7/§14；IA-01/02/06；plan B-3 | MATCHED |
| 76 | `apps/terminal/ui/integration/sample-console/README.md` | 说明真实 assembly input、form filter、production section 分母与 ready boundary。 | design D-9/D-15；plan B-3 | MATCHED |
| 77 | `apps/terminal/ui/integration/sample-wallpaper-console/README.md` | 说明 sample2 assembly、失效恢复/partKey identity 与双形态 section 约束。 | design D-9/D-15；plan B-3 | MATCHED |
| 78 | `apps/terminal/assembly/android/sample-terminal/README.md` | 说明 Android assembly 读取的 terminal render/ready 语义、basename/focus 与证据边界。 | design §12.7/§14；plan B-3 | MATCHED |
| 79 | `apps/terminal/assembly/android/sample-wallpaper-terminal/README.md` | 与 sample-terminal 同步说明，未宣称 Web/visual/release acceptance。 | design §12.7/§14；plan B-3 | MATCHED |

## 7. A-0 静态基线与诊断边界修复

这些文件是计划 A-0 明确允许的既有静态基线/运行边界修复，不是新增 screenPart 产品机制；逐
文件对账确认它们只把 DEV descriptor 限定为诊断，并没有让 release 依赖 descriptor。`group.ports`
首败与最小修复记录在 `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md`，
后续 focused、static、release-like U8 均已重验。

| # | 实际变更文件 | 当前实现与反例核对 | 详设/IA/计划落点 | 状态 |
|---:|---|---|---|---|
| 80 | `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` | descriptor/status 作为 DEV 诊断读取；实际 startup readiness 不从 descriptor 推导。 | plan A-0；design §12.3/D-9 | MATCHED |
| 81 | `apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts` | unavailable logger descriptor 仅 DEV 注册；logger 不覆盖 caller startupRunId。 | plan A-0/A-2；design §12.3 | MATCHED |
| 82 | `apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts` | DEV descriptor 附件不进入 production behavior。 | plan A-0 | MATCHED |
| 83 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts` | 同上，未以 descriptor 代替真实 capability binding。 | plan A-0 | MATCHED |
| 84 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableConnector.ts` | 同上，保持 unavailable port owner。 | plan A-0 | MATCHED |
| 85 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts` | 同上，保持 device port owner。 | plan A-0 | MATCHED |
| 86 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableHotUpdate.ts` | 同上，保持 hot-update port owner。 | plan A-0 | MATCHED |
| 87 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableLogUpload.ts` | 同上，保持 log-upload port owner。 | plan A-0 | MATCHED |
| 88 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts` | 同上，保持 secure-persistence port owner。 | plan A-0 | MATCHED |
| 89 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableScript.ts` | 同上，保持 script port owner。 | plan A-0 | MATCHED |
| 90 | `apps/terminal/kernel/base/platform-ports/src/defaults/unavailableTopologyHost.ts` | 同上，保持 topology-host port owner。 | plan A-0 | MATCHED |
| 91 | `apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts` | Web/dev host descriptor 只作 DEV 诊断；hostless focused fixture 不写 native ready。 | plan A-0/A-1 | MATCHED |
| 92 | `apps/terminal/ui/base/dev-host/src/implementations/webStorage.ts` | Web storage descriptor 只作 DEV 诊断，不改变 Web preview storage contract。 | plan A-0 | MATCHED |
| 93 | `apps/terminal/adapter/android/device/src/implementations/androidDevice.ts` | Android device descriptor 仅 `__DEV__` 附件；release physical device 行为不依赖它。 | plan A-0 | MATCHED |
| 94 | `apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts` | Android persistence descriptor 仅 `__DEV__` 附件；不新增运行期 seam。 | plan A-0 | MATCHED |
| 95 | `apps/terminal/ui/base/test-support/src/index.ts` | 只导出 test-support 类型目录的现有 public type，保持生产/测试边界。 | plan A-0；design D-9 | MATCHED |
| 96 | `apps/terminal/ui/base/test-support/src/types/platformTypes.ts` | 从 source root 移到规范允许的 types 目录，语义不变；静态门 red 后已 focused 重验。 | plan A-0 | MATCHED |

## 8. 证据与权威同步文件

### 8.1 已核对但未在实施阶段改写的权威输入

以下文件是对账输入，不冒充本次实现修改；当前字节已逐项核对其与实现一致：

- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md`
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md`
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md`
- `doc/platform/terminal-coding-standard.md`
- `doc/platform/claude-review-handoff-template.md`

其中 R-S1/R-S7/U8/§8 v3.7 与 TR-13/TR-14 的同步是 A-0 的入口约束；本表不把“计划中要
同步”写成“实现阶段刚刚改过”。

### 8.2 本次实施 evidence / 对账产物

以下文件的存在、命令/first-failure/broken-boundary/证据档位记录与本表相互校验；它们的
`OPEN` 档位（Web、独立 visual、总体 acceptance）是有意保留，不是本表的未关闭实现行：

- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp1-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp2-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp3-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp4-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-execution-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/dynamic-release-and-frozen-journeys-codex.md`
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/cleanup.md`

步骤级与全批对账：

- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp1-three-dimensional-reconciliation-beauvoir.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp2-three-dimensional-reconciliation-euler.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-hooke.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-three-dimensional-reconciliation-planck.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5c-three-dimensional-reconciliation-pascal.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution/mechanism-batch-reconciliation-gibbs.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-b-batch-reconciliation-jason.md`
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-post-fix-startup-readiness-ports-reconciliation-codex.md`

历史 `OPEN`/失败记录继续保留，不能覆盖当前 MATCHED 记录；它们用于证明首败被发现、根因
被修复、最小重验完成，而不是把历史状态抹掉。

## 9. 结果与交付门

```text
IMPLEMENTATION_SOURCE_ROWS=96
IMPLEMENTATION_SOURCE_ROWS_MATCHED=96
IMPLEMENTATION_SOURCE_ROWS_OPEN=0
README_ROWS_MATCHED=6
INVARIANT_ROWS_MATCHED=1
STATIC_BASELINE_ROWS_MATCHED=17
SYNC_DOCS=READ_BACK_MATCHED
V1_OBSOLETE_SOURCE_CLEANUP=NOT_NEEDED
```

本对账确认实施没有出现计划外生产落点、公共 API 兼容层、第二个 catalog/scroll/ready/
startup.complete owner、production failure-injection seam 或 v1 作废文件删除。真实动态证据
另按档位记录：`STATIC=PASS`、`FOCUSED=PASS`、受授权 emulator 的 `NATIVE/ANDROID=PASS`、
release U8 与冻结旅途 `PASS`、`CLEANUP=PASS`；`WEB=OPEN`，独立 visual/pixel 结论为 `OPEN`，
总体 implementation/acceptance 仍等待 Dexter 与 Claude 的 implementation review。

因此本门结果为 `MATCHED`，允许准备 `REVIEW_TARGET=IMPLEMENTATION` handoff，但不允许把本门
改写成 implementation review GO、visual PASS、Web PASS、release acceptance PASS 或整体
acceptance PASS。
