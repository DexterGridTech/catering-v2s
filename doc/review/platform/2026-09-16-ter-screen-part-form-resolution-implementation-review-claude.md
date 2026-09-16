# TER screenPart 机型解析 · implementation 评审

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的 review
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读源码与证据文档。**本轮未执行任何命令**——没有复跑 verify:static、
  focused、typecheck、release runner、emulator 或 cleanup;按既定分工,跑验证是 Codex 的职责
被审范围:本批已实施的 TER screenPart 机型解析源码、测试、README、invariant 与随附证据
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/`、`project-memory/`、`tools/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=GO(仅针对本批已实施范围的 implementation review)
M/S/N=0/1/3
DEXTER_DECISION=无
GO 不等于 visual、Web、真实物理硬件、release 或整体 acceptance 通过;
  WEB=OPEN、VISUAL=OPEN 保持原样,不得据本结论升格
```

上一轮的 M-4、S-6、N-4 **都是真修复**,其中 M-4 修得比我要求的更完整。核心机制、Dexter 五项裁决与证据分档诚实性都经得起逐字核验。唯一的 Significant 是红夹具的证明深度,不是行为缺陷。

## 1. 我自己核过的字节(不采信对账表与 handoff 自述)

| 核验项 | 结论 | 依据 |
|---|---|---|
| R-2 冲突前移 | 成立 | `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:108-118` 逐条校验 `surfaceForm` 非空、取值合法、单条内无重复;`:134-137` 过滤**之前**按 partKey 分组查机型集合相交,错误含 partKey 与重叠 forms |
| R-1 装配期过滤 | 成立 | 同文件 `:148-155` `selectPartsForSurfaceForm` 先校验请求机型、再过滤、再 `assertUniquePartKeys`;`:337-338` `allParts` → `selectedParts` 是唯一收口 |
| 就绪的 ports 组基于真实绑定 | 成立 | `:94-95` `platformPortBindingsAreComplete` 对 `requiredPlatformPortNames` 逐个检查 `platformPorts[port]` 非 undefined/null;`:372` 消费它。这是真的绑定存在性检查,不是改了名的 descriptor 检查 |
| R-15 分类载体 | 成立 | `ui/base/render/src/components/resolvePart.ts:13-34` 从 props 引入 typed union,`fallbackTestIds` 覆盖全部八个 reason 且无 `runtime-unavailable` 兼容别名 |
| R-5 内容失败可见 | 成立 | 同文件 `:36-51` `fallbackMessage` 对 content 输出"页面找不到:containerKey/partKey(surfaceForm)",`partKey===null` 时只出 containerKey;`accessibilityRole:'alert'` 仅给 content |
| 裁决④ failureStage 漂移 | 成立 | `ScreenContainer.tsx:65` `failureStage = hasPrimarySurfaceReady ? 'runtime' : 'startup'`;`:161-165` content 分支进就绪边界并带 `contentFailure`;`:169-174` system 分支只在 `isTargetPrimarySurface` 出失败页并消费 `failureStage` |
| 裁决⑤ nullable readyPartKey | 成立 | `ScreenContainer.tsx:131,157,165` 三处分别传 `failure.reason` / `null` / `failure.reason`,有 placement 身份时用请求的 partKey |
| R-10a/R-10b | 成立,且结构上更强 | `ui/base/admin-shell/src/parts/parts.ts:28-35` 用同一 `createAdminPart` 工厂产出兄弟条目,`rendererKey` 为 `${partKey}.${surfaceForm}` 天然唯一、`surfaceForm:[surfaceForm]` 天然不相交;`:79-88` 导出八条。**`layerGuard` 由同一 spec 对象供给两个兄弟,分叉在结构上不可能发生**——这比 U-15 的测试断言更硬 |
| N-4 中性文案 | 成立 | `kernel/base/ui-state/src/features/actors/contentActors.ts:322` 的 message 是 "Hydrated UI container was removed because it is not renderable in the current catalog",对"其他机型"与"已退役/未知"都成立;`:330` reason 单一化 |
| M-1 无跨层通道 | 成立 | prune 判定在 `contentActors.ts:315-317` 只用当前 `catalog.byPartKey` 与 `isUiCatalogEntryAvailable`,没有任何装配期 declaration 快照 |
| U-12 hook 不读机型 | 成立 | `ui/base/admin-shell/src/hooks/useAdminSections.ts` 全文零 `surfaceForm` 命中;`:32` 返回设计约定的四个字段 |
| CP-3 兜底所引规则真实存在 | 成立 | `project-memory/required-inventory.json:465,509-511` 有 `MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE`,锚点为"2026-09-15 Dexter 补充裁决:重复失败后的主 agent 接管"。不是为自审临时发明的授权 |
| v1 作废源 | 成立 | `cleanup.md:14-40` 先做 consumer search 再下结论,`AdminShell`/`AdminSectionNavigation`/形态 renderer 都有 live 消费者;`DELETIONS_PERFORMED=NONE`,没有为过门盲删或留空壳 |

## 2. 上一轮三条 finding 的关闭核验

**M-4 — 真修复,且比我要求的更完整。** 详设 `:317` 已改写为"因共享 staff-auth 同样消费匿名恢复命令,wallpaper 的匿名 PRIMARY 最终并非空";`:319` 明写"没有可把 `readyPartKey=null` 归因于'当前生产匿名路径'的事实",U-6 改用 synthetic fixture 并声明"不冒充两个 integration 当前旅途",`:375` 的红夹具反向锁住("若把 synthetic 改写成现有匿名旅途,事实对账必须红")。owner 清单按要求穷举到 staff-auth、member-desk、wallpaper 本地、picker 四处。

值得单独记一笔:`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-adversarial-review-codex.md` 是真实存在的 fresh 独立审查记录(`reviewerKind=INDEPENDENT_SUBAGENT`,有 agent id 与只读边界声明),它**独立发现了同一个缺陷**,并补上了我上一轮明确标为"尚缺证据"的那一环——`assembly.tsx:79-84` 同时装入 `createSampleStaffSessionModule()`,其匿名 bootstrap 才是 `sessionRestoredAnonymousCommand` 的来源。因果链至此完整闭合。我上轮把举证责任留给设计一侧是对的,而这次的举证是充分的。

连带的产品疑问随之消解:wallpaper 匿名 PRIMARY 显示的是登录页而非"页面找不到",不存在"正常状态被画成失败"的问题,无需 Dexter 裁决。

**S-6 — 真修复(粒度已收窄)。** 详设 U-4b 与计划 `:148` 已从文件级改为具名用例级,对账第 32 行写明"具名 U-4b 既有 layer 用例实现/断言未改,其他 D-1/D-10 手搓 catalog 用例按计划改造"。⚠️ **证明边界**:"逐字不变"是 diff 级断言,静态评审无法证实——我只能确认当前文件仍含那些用例名、且口径不再自相矛盾。是否真的逐字不变,依赖对账记录。

**N-4 — 真修复。** 见 §1。

## 3. Findings

### S-1 十五条判据中七条的红夹具是 `DEFINED_NOT_APPLIED`,核心机制的那条从未被实际触发过

- **状态**:CONFIRMED(evidence 事实)
- **事实**:handoff §5 的表中,U-1、U-3、U-4b(LayerStack 变异段)、U-7b、U-13、U-14、U-15 标 `DEFINED_NOT_APPLIED`;仅 U-4a、U-5、U-5b、U-6、U-9、U-10、U-11、U-12 标 `RED_EXECUTED`。
- **先说该给的肯定**:这个区分本身是对的。把"定义了变异"和"实际红过"分栏写出来,而不是混成一句"红夹具已覆盖",正是我历轮反复要求的诚实形态;`UNENFORCEABLE_BY_MACHINE`(U-8)也没有被写成已执行。
- **问题**:U-1 是本批**核心机制**的判据。设计 CP-3 门自己写的 red mutation 是"把 `allParts` 直接传给 `createUiCatalog`,U-1 必须红";该变异从未被实际应用,于是"过滤被移除时这条判据会红"始终未被证明。
- **我自己找到的缓解**(应记入,但不能替代执行):R-10a 之后,未过滤集合含八条 admin part、四组重复 partKey,恒等过滤会在 `consoleAssembly.tsx:155` 的 `assertUniquePartKeys` 直接抛错,任何真实装配测试都会大声失败。**U-1 的红在结构上是被保证的**。同理 U-15:`parts.ts:28-35` 的共享 spec 工厂使 `layerGuard` 分叉必须先改工厂本身,漏写在结构上不可达。
- **真正的残留**:U-3、U-7b、U-13、U-14 四条既无已应用的变异,也没有给出上述那种结构性保证的论证。
- **最小修复**:二选一——对这四条实际应用一次变异并保留红/恢复记录;或在证据里补出结构性论证(像 U-1/U-15 那样说明"该缺陷在当前结构下不可达或必然被更早的断言捕获")。不需要为此新建门。
- **Dexter**:不需要。

### N-1 静态/focused 证据文件中段留有一块过时的档位声明

`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md:109-118` 写着 `NATIVE=OPEN_NOT_RUN`、`ANDROID=OPEN_NOT_RUN`、`RELEASE=OPEN_NOT_RUN`、`CLEANUP=OPEN_NOT_RUN`,而同文件 `:143-186` 与 dynamic 证据已把这些升为 PASS。该文件 `:188-189` 确实指明"当前档位汇总维护在 dynamic 文件",所以这是时序快照而非矛盾;但单独引用 `:109-118` 会误报档位。建议给该块加一句"本块为静态修复阶段的时点快照,已被 §最新 与 dynamic 文件取代"。

### N-2 `parts.ts` 的 part spec 用了 `ComponentType<any>`

`ui/base/admin-shell/src/parts/parts.ts:24` 的 `component: ComponentType<any>`。本批的主张之一是"分类与契约在类型上可判定",而这里恰好在 part 定义处放开了 props 类型。不影响本批行为,但它是后续加字段时最容易漏检的一处。建议收敛为 `definePart` 已有的 `RenderComponentProps` 约束或等价泛型。

### N-3 静态评审对本批的固有证明边界

按分工我未执行任何命令,因此以下均只能确认"记录自洽",不能确认"确实如此":`verify:static` 的 `RUN_ID=ter-local-static-52662-1789555282698` 与各包 focused 计数;四场 release 冷启动与四场冻结旅途的 PASS 与 `startup-order` 字段;cleanup 的 PID/残留核查;以及 S-6 的"逐字不变"。这不是对证据的质疑,而是本轮结论适用范围的声明。

## 4. 对几项点名核验的回答

- **startup.complete 是否基于真实绑定**:是。见 §1。旧的 `descriptorStatus==='complete'` 判据已被替换,descriptor 退回 DEV 诊断;这正是 release 首败(`StartupCompletionPrerequisitesMissing:group.ports`)的根因修复,首败被保留在独立目录而没有被重跑掩盖,处理方式正确。
- **U8 与 splash 时序**:四场结果都记 `firstContentObservedAfterReadyCandidate`、`firstContentObservedAfterReadyHidden`、`provenReadyAfterRenderOwnedContent`、`settledSplashHidden` 为 true,并保留 logcat 顺序。档位标注为"release emulator 冷启动",**没有**升格为视觉或整体 acceptance——这是正确的克制。按 N-3,我未复跑。
- **三维对账**:步骤级、A/B 全批、逐代码三者分开记录且互不替代;CP-3 为 `MAIN_AGENT_FALLBACK` 并如实登记 reviewer id、四次受控等待与最终 `shutdown`,所引规则真实存在。**没有把主 agent 结果称作 fresh independent verdict**,这一点做对了。
- **S-3 runner 升级**:旧 `run-a9-runtime.mjs` 复跑首败为 `logBytes=0`、`business=NOT_RUN`、`cleanup=FAIL`,且其能力只覆盖 Metro/单 serial/mutation 驱动的 mobile SECONDARY 观察,确实无法承担 release 双形态冷启动与 splash 时序。升级判断有事实依据。按 N-3,我未复跑。
- **Web 与视觉**:保持 `OPEN`,本结论不触碰,也不得据 GO 推导整体 acceptance。

## 5. 方案合理性与实现质量

- **问题对不对**:对。调用方仍只传 partKey,机型差异被装配吸收。
- **方案优不优**:落地形态与详设一致,且有两处实现比设计更强——admin part 工厂让兄弟字段分叉结构性不可达;`platformPortBindingsAreComplete` 把"就绪前提"从诊断元数据搬回真实能力绑定。
- **代价配不配**:配。没有第二个 catalog/ready/writer owner,没有公共兼容别名,没有为过门盲删文件。
- **诚实性**:本轮最值得肯定的是几处"不好看但真实"的记录——CP-3 兜底、release 首败保留、`DEFINED_NOT_APPLIED` 分栏、`WEB/VISUAL=OPEN`、`DELETIONS_PERFORMED=NONE`。历轮我反复强调"诚实的 OPEN 优于错误的 CONFIRMED",这批做到了。

## 6. UI 与交互强制自问

入口与动作沿用既有 admin layer、AdminLauncher 与本地口令,未新增 Journey;laptop master-detail 与 mobile 换行分区条按 IA 落地,未引入横向滚动或第二弹窗机制。M-4 澄清后,"正常匿名状态被画成失败"的疑虑不成立。像素级铺满、360×640 每入口可见可点仍属 `VISUAL=OPEN`,由 D-13 承接,不在本结论内。

## 7. 授权边界

本评审只读、只针对本批已实施范围与随附证据,未执行任何命令,未修改任何源码、测试、脚本、依赖、构建产物或证据。GO 只表示 implementation review 通过,**不代表** visual、Web、真实物理硬件、release 或整体 acceptance 通过;S-1 与三条 N 的处置、以及是否进入下一阶段,由 Dexter 决定。
