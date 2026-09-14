# TER sample2（壁纸终端）需求正本与规范改动独立复评

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=CODEX_INDEPENDENT_STATIC_REVIEW
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
VERDICT=NO-GO
M=5
S=3
N=2
```

## 0. 审查边界与结论

本复评只审当前字节的：

- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`；
- `doc/platform/terminal-coding-standard.md` 的 `TR-04`、`TR-09` 与骨架阶段例外；
- 需求文档列出的 owning source、已有测试与门的静态事实。

未构建、未运行测试、未启动 Web、Android、VM、Metro、DEV、seed、UAT 或部署。A2/A3/A5b/A6/A8/A9、Metro 的 `.jpg` 解析、真实截图、许可证与动态方向锁均不能因本文通过而升级为行为 PASS。

结论是 `NO-GO，M/S/N=5/3/2`。主要阻断不是“实现还没写”，而是当前需求在几个关键处仍允许两个互相冲突的实现都声称符合，或把跨 workspace 的失效状态留在 state 中；一个未参加讨论的实施者不能据此安全开工。

## 1. 本轮独立复核使用的事实

以下是重新打开当前源码得到的事实，不采信需求文档的处置表作为质量证明。

1. `workspaceSlices.ts:217-222` 的当前 `serializeContentEntries` 只产生 `PRIMARY`、`SECONDARY` 两个 `containers` entry；`workspaceSlices.ts:270-285` 的每个 content descriptor 只有一个 `storageKeyPrefix: 'containers'` 的 record descriptor。
2. `kernel/base/state` 的 record descriptor 类型在 `types/persistence.ts:33-54` 支持多个独立 record descriptor；`persistencePrimitives.ts:138-179` 会逐 descriptor 建 entry；`keyspace.ts:116-143` 会拒绝重复 prefix。因此增加 `layers` prefix 在现有契约上可行，但需要明确的第二个 record descriptor 及其专用读写函数。
3. `toWorkspaceStateDescriptors` 在 `workspace.ts:86-112` 为 `MAIN`、`BRANCH` 各生成一个 descriptor。`selectCurrentContentState` 在 `selectContent.ts:26-44` 只选择当前 workspace；`contentActors.ts:154-220` 的 `dispatchContentAction` 也只通过当前 workspace 建立路由。
4. `resolveWorkspace` 在 `displayDerivation.ts:11-14` 会在 `SLAVE + CHIEF` 时选择 `BRANCH`，否则选择 `MAIN`。这两个 workspace 都是可到达状态，不是死字段。
5. `LayerStack.tsx:113-121` 对 catalog 不可用的 layer 只过滤渲染，不从 state 清理。恢复后若只校验当前 workspace，或只校验 `byPartKey` 存在性，失效 layer 可以留在非当前 workspace，之后因角色/实例模式变化再次成为可见状态。
6. runtime 的生命周期在 `createCommandActorDispatcher.ts:240-259` 将正常 handler 返回聚合为 `completed`，在 `:261-310` 还会产生 `timed-out`，异常会走 `normalizeRuntimeError.ts:30-58` 的普通 runtime error；`aggregateCommandStatus.ts:20-31` 将 `error`、`timed-out` 视为失败。`display-context` 的 install 先例在 `createDisplayContextModule.ts:57-63`，确实发生在 hydrate 之后、正常运行之前的 install 阶段。
7. 当前 `PrimitiveContainer` 在 `ui/base/primitives/src/components/PrimitiveContainer.tsx:8-36` 没有 `transparent` layout；需求中的新增变体是尚未落地的设计，不是现有行为。现有 `baseTokens.container` 在 `tokens.ts:1-7` 含 `bg-canvas`，而 `SurfaceRoot` 的 children 在 `ScreenContainer` 之前，透明变体是一个小而合理的可见性修复方向。
8. `tokens.ts:17-18,65-70` 把 `bg-action` 与 `text-action-foreground` 作为同一按钮的背景/前景角色；当前 sample-console 的 `global.css:12-13,20` 是深色 action、白色 action foreground、红色 error foreground。把 action foreground 也要求为红色会改变既有对比关系，不能只按“色名属于 action”推断可读。
9. `TR-09` 的 `P-5c` 分母在 `tools/terminal-layering/check-static.mjs:181-190` 覆盖所有 `ui/feature`，并禁止其导入 `createSlice`、`defineStateRuntimeSlice`（`42-55`）。当前仓内 `sample-staff-auth`、`sample-member-desk` 也是 owner 且 `slices: []`。因此移除 owner 至少一个 slice 的规则本身有真实矛盾依据。
10. 但同一规范骨架阶段例外 `terminal-coding-standard.md:390-391` 仍写“落下第一个真实 slice 时”才写 `kind`、移除 `plannedKind`；需求自己的新 picker 节点在文档 `:811-816` 明确是无 slice 但有 module/actor 的 owner 形态。
11. `grep -rn "declare module '\*" apps/terminal --include=*.d.ts` 这条文档命令在当前 zsh 中先报 `no matches found: --include=*.d.ts`；安全引用 glob 后，当前 first-party `.d.ts` 共 12 个，匹配 wildcard module declaration 的是两份 `*.css`。不排除依赖时，`apps/terminal/node_modules/vite/client.d.ts:68` 等位置确有 `*.jpg` 声明。

## 2. 上一轮 findings 的闭合情况

| 旧结论 | 本轮判断 | 依据 |
|---|---|---|
| 治理轮未落地时 handler 为六条 | 闭合 | 需求 `:447-453` 已冻结时点，并区分治理后八条 |
| picker 无 actor | 闭合 | 需求 `:306-345` 已给 picker 自有 command/actor 与相同选择不下发规则 |
| mobile 尺寸/方向真值表不足 | 设计层闭合，动态仍未证 | 需求 `:693-705` 已给输入、方向、fallback、Bundle、生命周期；VM 未运行 |
| display topology selector 不存在且边界未冻 | 闭合 | 需求 `:430-436` 明确只依赖已有 display-context 导出 |
| A2 只查树形状挡不住不可见 | 设计层闭合 | A2 已升格为真机前后截图，静态树断言降为辅助（`:875`, `:904-910`） |
| A1/A3/A4/A8 只有计划文字 | 基本闭合，动态未证 | 判据已有控件、双屏截图、可见文案与逐步旅途（`:874-880`）；未运行 |
| 红色主题不可机械判定 | 只部分闭合 | 有 HSL predicate（`:912-924`），但 predicate 不能证明视觉区分，且 action foreground 语义未定，见 `M-05/S-02` |
| TR-04 只有倾向没有规则 | 规则层闭合 | `TR-04:151-181` 已写 reverse object、全字段持久例外及无通用门；“全字段”仍需人工核对 |
| graph 依赖只是意图 | 正确保留为实施期对账 | 需求 `:838-840` 明示不能把意图当实测；不构成本轮 finding |
| `.d.ts` 只有两处 | 事实已收窄，但检索证明不闭合 | first-party 计数可复核；文档命令不可直接复现，见 `S-03` |
| waiting/welcome 的 mobile 声明 | 闭合 | 需求 `:395-397` 已限定为 `['laptop']` 并补 A9 |
| mobile/Metro/截图等动态项 | 没有被静态复评证明 | 文档把它们放进实施实测，但当前仍是 `UNVERIFIED_REQUIRES_EVIDENCE`，见 `N-02` |

## 3. Findings

### M-01：浮层持久化的独立 prefix 没有落到可实施的 descriptor 契约

**状态：`CONFIRMED`**  
**级别：M**  
**owning source：** `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:217-285`；`apps/terminal/kernel/base/state/src/types/persistence.ts:33-54`；需求 `:493-512`。

#### 仓内事实

当前 content slice 只有 `containers` 一个 record descriptor。底层契约允许一个 slice 拥有多个 record descriptor，且每个 descriptor 有自己的 `storageKeyPrefix`、`getEntries`、`applyEntries`。因此“加独立 `layers` prefix”不是改现有两个函数的自然副作用，而是要在 `persistence` 数组中增加第二个 record descriptor。

需求表只列：修改 `serializeContentEntries` 和 `applyPersistedContentEntries`（`:495-500`），同时又要求独立 `layers` prefix（`:504-512`）。它没有写出第二个 descriptor、layer record 的 entry 形状、专用 `getEntries/applyEntries`，也没有要求 `MAIN` 与 `BRANCH` 两个 descriptor 都注册该 prefix。

#### 失败场景与影响

一个实施者有两种都看似合理的做法：

1. 把 layer 数组直接塞回现有 `serializeContentEntries`，仍写入 `containers` prefix，违反本节的独立 prefix 要求；
2. 增加 `layers` descriptor，但自行猜测它的 entry key、合并函数和 descriptor 数量。

两者都可能通过只检查“有 `layers` 字符串”和“重启后有 layer”的表面测试。错误格式会把容器与有序 layer 的演进边界耦合，之后清理、迁移或单独读取时无法确定 owner。

另外，需求说“只做结构校验”，但目前只明确了 `props` 的校验与重复 `layerId` 策略（`:508-512`）；没有正面写死 `layerId`、`partKey` 非空、`openedAt` 有限，以及缺少/错误 entry 的具体处置。只写“结构校验”不足以约束 parser。

#### 最小修复方向

在需求中明确：每个 `MAIN`/`BRANCH` content descriptor 的 persistence array 有两个 record descriptor，分别使用 `containers` 与 `layers`；`layers` record 的 entry key 仍按 `PRIMARY`/`SECONDARY` 分区，value 是保序的 `LayerEntry[]`；两侧各有明确的 layer-only `getEntries/applyEntries`，不会把两个 record 的 entry 合并到一个 prefix。另写 layer parser 的最小结构规则：对象、非空 `layerId`/`partKey`、有限 `openedAt`、可选 JSON-safe `props`；保持输入顺序，重复 id 保留第一条并诊断，非法行整条丢弃并诊断。

把旧的两条“layers 不恢复”测试改成正向测试是必要的，但不充分；至少补旧存档无 `layers` key、两 display mode、两个 workspace、顺序、重复、非法 props/字段与诊断的 focused 覆盖。

#### 为什么更小的方案不够

只把 `layers` 加到现有 serializer 返回值里，不能满足独立 prefix；只改测试标题不能定义 record 形状；只写“结构校验”会把关键字段交给实施者猜。增加一个明确的第二 record descriptor 是利用现有 state persistence 能力的最小闭环，不是新建 registry 或第二套持久化系统。

**是否需要 Dexter 裁决：** record 结构本身不需要；如果“当前 catalog 有效”还要包含 display/workspace/surface context，则见 M-02 的语义选择。

### M-02：install actor 的浮层 catalog 清理没有覆盖可到达的 workspace/context，且诊断 owner 自相矛盾

**状态：`CONFIRMED`**  
**级别：M**  
**owning source：** `apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts:26-44`；`features/actors/contentActors.ts:154-220,269-277`；`foundations/displayDerivation.ts:11-14`；`ui/base/render/src/components/LayerStack.tsx:113-121`；需求 `:515-532`。

#### 仓内事实

install 时机本身是成立的：runtime 的顺序是 hydrate → install → initialize/start，display-context 已有相同形态的 hydrate 校验 actor。因此把 catalog 检查放在 `ui-state` install 期是一个合理的简化方向。

但当前 `selectLayers`、`closeLayerCommand` 和 `dispatchContentAction` 都通过 `currentWorkspace` 工作。`MAIN` 与 `BRANCH` 都由 `toWorkspaceStateDescriptors` 注册；`resolveWorkspace` 会根据 runtime 状态在两者间切换。`LayerStack` 仅过滤不可用 entry，不删除 state。

需求一处写 actor 负责 catalog 校验并派发 `closeLayerCommand`、诊断类别为 `ui-state-hydration`（`:522-524`），另一处又写还原时逐条校验 `partKey`、诊断归 `display-diagnostics`（`:526-530`）。这不是同义改写：诊断 owner/category 不同，且 descriptor 没有 catalog/context 入参。

#### 失败场景与影响

例如错误 layer 存在于 `BRANCH/SECONDARY`，启动时当前 workspace 是 `MAIN`。若 install actor 只遍历当前 selector，它不会看到该 layer；等 displayRole/instanceMode 变化后，BRANCH 成为 current，失效 layer 可能被重新渲染。若只检查 `catalog.byPartKey[partKey]` 存在，也会保留一个 catalog 中存在但不适用于当前 displayMode、workspace、instanceMode 或 surfaceForm 的 entry。

如果 actor 尝试通过现有 `closeLayerCommand` 清理非当前 workspace，当前 command 的 owner routing 又会把动作送到 current workspace，可能清错对象或静默 no-op。这样“install 已清理失效 layer”的声称并不成立。

#### 最小修复方向

先在需求层选定并写死：

1. 还原后检查的“catalog 有效”究竟是静态 `partKey` membership，还是 `isUiCatalogEntryAvailable(entry, null, context)` 的完整上下文可用性；不能用“当前 catalog”同时表示两者；
2. install actor 必须枚举 `MAIN/BRANCH × PRIMARY/SECONDARY`，并通过明确的 owner-safe workspace route 清理，或定义一个仅供 hydrate cleanup 使用、带显式 workspace/displayMode 的既有 owner command 形态；不得调用只作用于 current workspace 的 selector 后宣称全量清理；
3. 在 `ui-state-hydration` 与 `display-diagnostics` 中二选一，统一诊断字段、次数与失败恢复规则；
4. 为非当前 workspace、context 不可用、重复 id、非法 props 各留一条可证伪测试。

#### 为什么更小的方案不够

只把“逐条”写得更大不能解决 current workspace 路由；只把 `partKey` 放进 `byPartKey` 检查不能处理 context 不可用；只修诊断字符串不能阻止失效 layer 在后续 workspace 切换时复活。明确现有 owner route 的作用域是最小必要边界，不要求新建通用 catalog registry。

**是否需要 Dexter 裁决：** “membership”还是“完整 context availability”属于产品/状态语义，若不接受由需求 owner 明确写成纯 membership，则需要 Dexter 决定；workspace 全量清理与诊断类别是设计契约缺口，不应静默选择。

### M-03：TR-09 移除 owner 至少一个 slice 是正确的，但骨架阶段例外还保留旧前提

**状态：`CONFIRMED`**  
**级别：M**  
**owning source：** `doc/platform/terminal-coding-standard.md:298-323,374-395`；`tools/terminal-layering/check-static.mjs:42-55,181-190`；需求 `:811-816`。

#### 仓内事实与判断

移除“owner 必须至少有一个 slice”不应回滚。`P-5c` 对全部 `ui/feature` 禁止建 slice，而当前两个 `ui/feature` owner 已经是 `slices: []`；TR-09 改为 command/actor/slice 至少一类且承担唯一写责，仍能区分 owner 与 toolkit，也没有削弱 TR-03 关于跨 owner 读的前提。

但 `terminal-coding-standard.md:390-391` 仍规定“落下第一个真实 slice”才写 `kind`、删除 `plannedKind`。新需求自己把 `ui.feature.sample-wallpaper-picker` 定义为无 slice 但有 module/actor 的 owner。此包可能永远没有“第一个 slice”，于是规则栏与骨架例外对何时完成 owner 声明不一致。

#### 失败场景与影响

实施者按 TR-09 正文在 picker 获得真实 actor 时写 `kind: owner`，或按骨架例外继续保留 `plannedKind` 到首次 slice；两种选择都能被不同段落解释。骨架 model 的二选一约束可能因此在包刚获得真实 owner 能力时直接红，或留下已实现能力仍被标为 planned 的陈述。

#### 最小修复方向

只改骨架例外的转移条件，不回滚 TR-09：将“第一个真实 slice”改成“第一个真实 owner capability（command、actor 或 slice）”，并明确 picker 这种无 slice owner 在产生 module/actor 时写 `kind`、移除 `plannedKind`。保留“plannedKind 是设计意图”的其他文字。

#### 为什么更小的方案不够

只在 sample2 文档中加一条例外会造成标准与单个需求漂移；回滚 TR-09 会重新制造 P-5c 与 owner 规则的结构矛盾。改一处过时的转移条件即可闭合。

**是否需要 Dexter 裁决：** 不需要；这是规范内部一致性修订。

### M-04：11 项范围分母仍不是全文唯一分母

**状态：`CONFIRMED`**  
**级别：M**  
**owning source：** 需求 `:6-7,481-536,724-750`。

#### 仓内事实

§7.0a 的表确实列出 4 个新建包 + 7 个既有位置，合计 11（`:728-748`），且七个既有位置包括 `ui/feature/sample-staff-auth` 与 `kernel/base/ui-state`。但文件头 `SCOPE_MODIFY` 仍只列五个既有位置（`:7`），浮层小节 `:536` 仍说从 9 增到 10。文件中同时存在 5、10、11 三个分母口径。

#### 失败场景与影响

一个实施者只按头部恢复范围，会漏掉 staff-auth description 和 ui-state 浮层持久化；只按 §3.6，会把 ui-state 视为第 10 项；按 §7 才得到 11。门、实施计划和最终 review 会因此得到不同的范围集合，正是上一轮 scope finding 的同根问题尚未完全消失。

#### 最小修复方向

以 §7.0a 表为唯一集合，更新文件头 `SCOPE_MODIFY` 与 §3.6.3 的 10→11；全文搜索 `5/9/10/11` 与 touched positions，凡描述本批分母的地方只保留 4+7=11。不要新增范围项。

#### 为什么更小的方案不够

只修头部仍会让正文的 10 覆盖审阅者；只修 §3.6 仍会让入口范围漏项。必须做一次全文计数对账，但不需要修改实际 scope。

**是否需要 Dexter 裁决：** 不需要；表已给出当前集合。

### M-05：红色主题把 `action-foreground` 一并定为红色，产品语义与现有 token 角色冲突

**状态：`DEXTER_DECISION`**  
**级别：M**  
**owning source：** `apps/terminal/ui/base/primitives/src/theme/tokens.ts:17-18,65-70`；`apps/terminal/ui/integration/sample-console/theme/global.css:12-13,20`；需求 `:619-636,912-924`。

#### 仓内事实

现有 primitives 把 `bg-action` 与 `text-action-foreground` 组合成按钮背景/前景；现有主题将前景设为白色，而 error foreground 是红色。需求 `:922` 写的是 `--color-action` / `--color-action-foreground` 都走红系，同时又说其余保持中性。

#### 推论与产品判断

如果实施者按字面给 action background 和 action foreground 都选相近红色，默认按钮会出现红底红字，或至少对比不足；这不是色名测试能抓到的，且会让登录、确认、取消等动作不可读。这里不是单纯的 HSL 阈值问题，而是“强调色红”是否包括语义上的 foreground token 尚未被裁定。

#### 最小修复方向

建议 Dexter 选择：`--color-action` 使用红色强调值，`--color-action-foreground` 保持能与该背景形成足够对比的中性值；A7b 同时验证 action background/foreground 的实际使用上下文，以及 action/error 的可区分性。如果 Dexter 明确要求 action foreground 也红，则必须给出批准的成对 RGB 值和渲染上下文对比要求，不能只给“走红系”。

#### 为什么更小的方案不够

只改 A7b 的色相阈值不能决定按钮前景角色；只改测试中的颜色样例不能解决规范文字冲突。需要一个产品语义选择，否则实施者无法知道应该优先遵循现有 token role 还是新主题散文。

**是否需要 Dexter 裁决：** 是。当前不建议自行把 `action-foreground` 改成中性或红色。

## 4. S findings

### S-01：TR-02 更正的核心正确，但“actor 失败唯一靠抛错”过宽，A2c 不能验证稳定失败契约

**状态：`PARTIALLY_CONFIRMED`**  
**级别：S**  
**owning source：** `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:240-310`；`aggregateCommandStatus.ts:20-31`；`normalizeRuntimeError.ts:30-58`；需求 `:338-343,878`。

picker 自己的用户意图 command 做了判断并正常完成，返回 `completed` 是正确的；无 pending 时真正不合法的是 kernel 的 `confirmWallpaperCommand`，它应抛稳定 code 的 typed failure，并保证零 state write、零子命令。这个方向闭合，不应把 picker 的“无需向 kernel 派发”误判成失败。

但“仓内 actor 产生失败的唯一方式是抛错”只在“handler 主动表达失败”的窄语境成立。runtime 还会产生 `timed-out`，非法 handler result 也会被 runtime 变成 error；普通异常会被归一成通用 execution code。需求 `A2c` 目前只断言返回“非成功”（`:878`），因此以下错误实现仍可通过：

- 无 pending 时抛普通 `Error`，被归一成通用码；
- 直接返回任意 rejected-like payload，runtime 仍聚合为 `completed`，若测试只看调用没有看结果也会漏；
- 先写 state 或派子命令，再抛错，仍可满足“非成功”。

最小修复是把 universal claim 收窄为“本 actor handler 的 deliberate failure 通过 throw/AppError 表达”，并把 A2c 改为断言具名稳定 code、顶层非 completed/error 状态、state snapshot 未改变、子命令数为零。只加“正确”或只保留“非成功”不能挡住半执行实现。

**是否需要 Dexter 裁决：** 不需要；稳定 code 的具体名称可由详设按已有错误命名规则确定。

### S-02：A7b 的 HSL `OR` predicate 不能证明 action 与 error 在实际 UI 中易区分

**状态：`CONFIRMED`**  
**级别：S**  
**owning source：** 需求 `:912-924`；`tokens.ts:17-22,57-70`。

当前 predicate 是 action 与 error foreground 的色相差至少 15° **或**明度差至少 0.15。它既没有固定比较的渲染上下文，也没有要求 action background 与 action foreground 的文字对比，更没有验证 `canvas/surface/foreground/border` 的中性和四组 status 色相保持不变。

恶意但合规的构造很容易存在：action 与 error 取两个相邻的红/橙红色，色相差刚好 15°；或者同色相但明度刚好差 0.15。两者都能通过 predicate，却可能在同一按钮/错误提示的实际背景上难以区分。反过来，两个 token 的 HSL 差异也不能代表它们在不同背景上的可读性。

最小修复是把判据绑定到实际角色：对 action background/foreground 与 error foreground/background 使用固定渲染 pair，至少断言批准 RGB 值和实际文字对比；再单独断言 action/error 采用批准的可区分 pair，并补 base token 中性与 status token 不漂移的集合/值域检查。无需引入通用色彩系统，使用本主题的固定值或一个很小的 RGB/对比函数即可。

本条的阈值/批准色值受 M-05 的产品选择影响；不应把 HSL 公式继续加复杂来掩盖 token 角色未决。

**是否需要 Dexter 裁决：** predicate 需要修；具体红色 palette 与 action foreground 角色需要 Dexter 决定。

### S-03：§10.6 的命中清单有一条不可执行，其他 grep 不能支撑对应的全称语义

**状态：`CONFIRMED`（命令可复现性）/ `PARTIALLY_CONFIRMED`（全称语义）**  
**级别：S**  
**owning source：** 需求 `:997-1011`；仓内 `.d.ts` 与 `node_modules` 当前文件。

本轮重跑结果：

| 行 | 当前结果 | 评价 |
|---|---|---|
| 1003 | 单引号、单行 `from 'react-native'` 的精确命中为 0 | 不能覆盖双引号、多行 import、别名或动态边界；0 是该 regex 的结果，不是所有语义 import 的证明 |
| 1004 | 现有单行 value import 精确命中 11 | 同样漏多行 import；“11 个文件”必须明确是该 parser/regex 的计数 |
| 1005 | 当前 assembly/adapter production source 没有字面量 `'mobile'` | 当前 bounded source 事实成立；“整个缺口只有 native 入口”仍是推论，命令未定义 source/generated/build 范围 |
| 1006 | 当前指定树中该单引号字面量精确命中为 0 | 不覆盖双引号、模板字符串、拼接或从常量导入；不能单独支撑“字面量不出各自包”的全称 |
| 1007 | 文档原命令在 zsh 报 `no matches found: --include=*.d.ts`；安全写法下 first-party 共 12 个 `.d.ts`，两份 wildcard declaration 都是 `*.css` | 结果可得到，但原命令不能作为证据；不排除 `node_modules` 时 Vite/Expo 有 `*.jpg` 等声明 |
| 1008 | `actorDefinitions` 精确命中一个测试文件 | 不能由一个标识符的 grep 证明没有采用其他实现方式的 actor checker |
| 1009 | `persistIntent` 精确命中五个 tools 文件 | 不能由该标识符证明没有使用其他入口的通用 TR-04 checker；当前“无通用门”主要由规范/source 对账支持 |

最小修复是为每条命令写明 cwd、source root、是否排除 `node_modules`/build/generated，并引用带引号的 glob；对 import/模块声明等结构性断言使用 AST 或明确的 bounded file list。若保留 grep，只把断言收窄为“该精确表达式的命中数”。

**是否需要 Dexter 裁决：** 不需要；这是证据表达与检索工具修复。

## 5. N findings 与尚缺证据

### N-01：两个未附清单的负面/全称断言仍未完成证据闭环

**状态：`UNVERIFIED_REQUIRES_EVIDENCE`**  
**级别：N**  
**owning source：** 需求 `:43-45,491,1011`。

§10.6 自己承认没有附清单的两条是“当前全仓只有一个 `ui/integration`”和“规范没有任何支撑 U-7”。当前源码目录确实只有现有 `sample-console` integration，但文档没有保存目录清单；第二条只做了词语命中/未命中，无法排除用不同术语表达同一约束。它们不直接阻断方案，但不能继续写成已充分举证的承重事实。

最小处置是保存 bounded directory/package inventory，并把第二条收窄为“规范中未命中 `U-7`/layer persistence 这些明确标识”，或附人工逐节核查范围。无需新增规范。

### N-02：动态实现证据在本轮仍为空，不能把“具备条件”写成“已验证”

**状态：`UNVERIFIED_REQUIRES_EVIDENCE`**  
**级别：N**  
**owning source：** 需求 `:49-61,868-910`。

需求正确地把真实截图、双屏同时可见、mobile 方向推导、`.jpg` Metro 解析与既有 sample 旅途放到了实施侧，但本次是静态复评，没有任何 VM/Android/Metro 输出。因此 A2 的透明容器、F-A2a 红夹具、A3 双屏、A5b 未确认选择恢复、A6 方向、A8 回归、A9 mobile 无 SECONDARY 仍只能记为待证；不能因有两台 VM 或判据文字就写 PASS。

关闭条件是对应真实档位的运行记录：输入/动作、截图或日志、失败边界与 cleanup；静态树和历史结论不能替代。

## 6. 方案合理性与范围判断

1. **问题本身成立。** 第二个 integration 需要复用既有登录能力并拥有自己的壁纸选择器；壁纸状态与用户确认语义需要进入共享 ui-state；Android 形态属于 display adapter，而不是每个 assembly 的业务逻辑。把这些放在相应 owner 处是合理的。
2. **透明容器是当前最小方案。** 改 SurfaceRoot 的层级会波及 render，改全局 `canvas` 会波及全部控件；一个只供三个 part 使用的透明 layout 能解决“状态变了但画面不变”。A2 仍必须是真机前后截图，F-A2a 的方向正确。
3. **浮层持久化不应退回“不恢复”。** Dexter 已明确纳入本批；继续让它混入 containers 或只清理 current workspace 才是风险。第二个 record descriptor、全 workspace cleanup 和已有 owner routing 的明确化，比给 state 增加通用 registry 更简单。
4. **TR-04/TR-09 的规范方向总体合理。** TR-04 的 positive-only 例外在“slice 的所有字段确实都要求持久化”时可接受，且禁止造 dummy field；TR-09 的 owner zero-slice 修订应保留。问题在于它们的手工审查边界与骨架例外未同步，不是应恢复旧规则。
5. **红色主题当前过度依赖颜色几何而欠缺角色语义。** 不需要引入复杂色彩框架；先冻结 action background/foreground 与 error 的实际 token 角色和一组可读 palette，再写小 predicate，收益高于继续堆 HSL 阈值。

## 7. 被推翻或收窄的作者结论

以下结论本轮没有照单全收：

1. “独立 `layers` prefix 是保序所必需”：**收窄**。独立 prefix 是合理的隔离选择，但数组值在同一 record 中也可以保序；真正缺的是 descriptor/entry contract，不是“不同基数必然丢顺序”。
2. “catalog 校验已由 install actor 解决”：**推翻其已闭合含义**。install 时机成立，但当前 workspace 路由、两个 workspace、context availability 与诊断类别均未闭合。
3. “仓内 actor 产生失败的唯一方式是抛错”：**收窄**为 handler 主动失败的表达方式；runtime 还会产生 timeout、invalid-result error 与归一化 error。
4. “A7b 的 HSL `OR` 就能保证 action 与 error 不难区分”：**推翻**。该 predicate 可被相邻色相/临界明度的恶意实现通过，且没有渲染上下文。
5. “浮层范围从 9 增至 10”：**推翻**。当前正文同时有 5、10、11；唯一完整表是 4+7=11。
6. “§10.6 的图片模块声明命中 2、`.d.ts` 共 12 是可直接复现的证据”：**推翻其证据强度**。12/2 的 bounded 事实可复算，但原命令在 zsh 失败且不排除依赖，不能作为当前写法的证据。
7. “TR-09 的 owner zero-slice 应恢复”：**推翻该隐含方向**。P-5c 与现有 owner 事实证明移除是正确的；应修骨架例外，不应修回 TR-09。
8. “红色主题中 action 与 action-foreground 一起走红系”目前**不能作为无需讨论的实施事实**；它与现有 token role 的可读性冲突，需要 Dexter 选择。

## 8. 本轮文档仍漏掉、但范围内必须回答的问题

1. `layers` record 的确切 entry value、两个 workspace 的 descriptor 数量、`containers`/`layers` 各自的 `getEntries/applyEntries` 与旧 key 行为。
2. “catalog 有效”是 `byPartKey` membership，还是包括 displayMode/workspace/instanceMode/surfaceForm 的 availability；两者失败时是否同样丢弃。
3. install cleanup 如何覆盖 `MAIN/BRANCH × PRIMARY/SECONDARY`，以及如何通过现有 owner routing 作用于非当前 workspace；不能只写“派 closeLayerCommand”。
4. 重复 `layerId`、非法 props、非法 `openedAt`/空 id 的诊断字段、诊断 category 与每次 hydrate 的幂等性。
5. 除改写两条旧负向测试外，新的 layer persistence 结构/顺序/旧存档/两个 workspace 的测试归属与最小场景清单。
6. 红色主题中 `action`、`action-foreground`、`error` 的 token 角色、批准值、实际渲染 pair 与对比判据；“其余中性”具体包含哪些 token。
7. §10.6 每条检索的 cwd、文件分母、排除目录与结构解析方法；两个未附清单断言的可复核 inventory。
8. Android 方向判定究竟读取 default display 的哪份 logical metrics、在 delegate hook 时是否已可用、锁方向触发的 configuration/recreate 行为；本轮只能静态提出，VM 结果仍需动态证据。
9. A2/A3/A5b/A8 的截图差异阈值、比较区域、字体/动画/时间噪声处理与证据文件格式。否则“像素有差异/无差异”仍留有测试实现自由度。

## 9. 给 Claude 的处置顺序

1. 先修 M-01/M-02 的 layer descriptor、全 workspace/context cleanup 和诊断语义；
2. 修 `terminal-coding-standard.md:390-391` 的“first slice”旧表述，保留 TR-09 zero-slice 移除；
3. 统一需求全文 4+7=11 的 scope denominator；
4. 将 A2c、A7b 与 §10.6 证据命令改成可证伪、可复现的字面；
5. 在 Dexter 对 M-05 的 token 角色作出选择后，再冻结红色 palette 与判据；
6. 需求闭合后才进入详设/实施；动态档位必须按 static、focused、Android/native、Web/VM 分开记录，不能用本轮静态 review 代替。

本文件没有修改需求正本、规范正本、源码、测试、依赖或运行环境。
