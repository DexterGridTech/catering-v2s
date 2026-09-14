# TER sample2 壁纸终端需求正本独立复评

评审日期：2026-09-13  
评审者：Codex
评审对象：`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md` 与 `doc/platform/terminal-coding-standard.md` 的 TR-04、TR-09 当前字节  
评审范围：需求正本、规范改动、相关 owning source 的静态对账；不进入详设、实施、构建、测试、Web、Android、native、DEV、seed、UAT 或设备操作。

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=5/6/3
L1_ENGINEERING=NO-GO: M-01..M-05
L2_USER_VISIBLE=NO-GO: S-02..S-06；S-01 是持久化边界判据缺口
L3_UNVERIFIED=Metro `.jpg`、Android mobile 真值表、双屏可见结果、壁纸实际像素结果、动态重启/浮层恢复均未执行
SAME_ROOT_SCAN=已重开 TR-04/TR-09、ui-state persistence descriptor、LayerStack、runtime command aggregation、Android activity handler、现有 package/graph 门及需求全文；全称断言仍有未附可复核命中清单者
DESIGN_GAPS=持久化记录格式与旧数据边界、恢复诊断 owner、可用性校验时机、初始壁纸、当前选择语义、Android exact hook、红色主题的定义
EVIDENCE_TIER=static only；本文件不把 VM 可用性、计划文字、历史证据或作者自报数字当作行为 PASS
```

本轮没有把作者的处置表、`§10.5` 的数字或“已消解”文字当作质量证明。先重开当前源码，再回到需求条款核对。TR-09 删除 owner 必须拥有 slice 这一核心改动本身成立；TR-04 的三条澄清也不应回滚，但它们没有自动证明 `WallpaperState` 的每个持久化边界已经闭合。

## 一、阻断项

### M-01：sample2 的 mobile 逻辑尺寸仍有 360×800 残留

状态：`CONFIRMED`  
定位：需求正本 `:626`、`:637`、`:685`；同一文档 `§1.3 :134-138` 已明确 sample2 应为 `720×1280`。当前既有 `apps/terminal/ui/integration/sample-console/package.json` 的 `portrait.PRIMARY` 是历史 sample-console 基线，不等于 sample2 的新值。

仓内事实：需求在 §1.3 同时写了 sample2 `portrait: { PRIMARY: 720×1280 }`，又在 mobile 表、画布比例说明、资源尺寸说明中继续写 `360×800`。这是同一份需求正本内部的冲突，不是把当前旧 sample-console 基线误读成新代码的事实。

失败场景：实施者按 §5 或 §6 生成 `sample-wallpaper-console` 的 package/资源尺寸，或按 360×800 计算 mobile 的 surface transform；而另一个实施者按 §1.3 和 Dexter 新裁定使用 720×1280。结果会出现 mobile VM 的画布尺寸、资源比例、scale 预期不一致，A6 的“与 mobile VM 一致”也无法判定。

影响面：sample2 的 mobile surface 声明、壁纸资源选择、scale 结论、Android mobile 验收输入；属于 Dexter 已冻结的产品尺寸，不是可由实施者自行选边的细节。

最小修复：把所有指向 sample2 的 `360×800` 改为 `720×1280`；保留 `§1.3 :130-132` 对既有 sample-console 的 `360×800` 说明，并在表头明确它是“现有基线”。同步检查资源尺寸段，不需要改动 render 或引入尺寸转换层。

为什么更小不够：只改 §1.3 会让 package/资源段继续给出另一套可执行输入；只改资源建议会让 surface 声明仍然冲突。必须清掉同一需求正本内所有 sample2 的旧数值。

Dexter 裁决：不需要新增裁决；720×1280 已是本轮既定裁定。

### M-02：范围分母不但互相矛盾，且漏掉了文档自己要求修改的 `sample-staff-auth`

状态：`CONFIRMED`  
定位：需求正本头部 `:7`、`§2 :192`、`§4.2 :527-537`、`§4.3 :554-565`、`§7.0a :692-715`、`§10.5 :943`。

仓内/文档事实：

- 头部和 §2 把既有改动写成 3 个既有包 + 2 个 tool 文件，等于 5 个位置，并且漏列 `kernel/base/ui-state` 与 `ui/feature/sample-staff-auth`。
- §7.0a 的表列出 4 个新包 + 6 个既有位置 = 10，但这 6 个既有位置仍没有 `ui/feature/sample-staff-auth`。
- §4.2/§4.3 又明确要求 `sample-staff-auth/src/parts/parts.ts:17` 做一处宿主中立化修改；这不是背景建议，而是本立项“对原 sample 的调整”。
- §10.5 仍声称“新建 4 + 改动 5 = 9”。

因此，按当前文本至少有 4 个新建包 + 7 个既有改动位置 = 11 个触及位置；如果作者意图把 `sample-staff-auth` 归入前一批，文档也必须明确它不属于本批并说明本批如何保证该需求已落地。当前没有这种边界说明。

失败场景：实施者按 §7.0a 只改 6 个既有位置，漏改 `sample-staff-auth` 的宿主相关 description；或把 `kernel/base/ui-state` 当成不在范围内，漏做浮层持久化；或按 §10.5 把整个批次当成 9 个位置交付。逐代码对账的分母因此无法成立。

影响面：遗漏真实代码改动、漏掉所有 App 共享的 ui-state 变更、验收材料缺项、前后批次边界失真。它还直接削弱作者声称“范围已唯一化”的可信度。

最小修复：以一张唯一清单为准，列出 4 个新建包与至少 7 个既有位置：`ui/base/primitives`、`kernel/base/ui-state`、`ui/feature/sample-staff-auth`、`adapter/android/dual-screen`、`assembly/android/sample-terminal`、`tools/terminal-skeleton/check-static.mjs`、`tools/terminal-layering/check-static.mjs`。同步修改头部、§2、§7.0a、§10.5；若确有前置批次归属，必须从“本批动作”中移除并给出可核验的边界，而不能同时写“本批一处改动”。不需要凭空增加更多包。

为什么更小不够：只改 `4+5=9` 为 `4+6=10` 仍会漏 `sample-staff-auth`；只补表不改头部和沿革，读者仍会从不同入口得到不同分母。

Dexter 裁决：`sample-staff-auth` 是否由本批承担若是历史边界问题需要 Dexter 明确；在当前正文把它写成“本立项必须改动”的前提下，不能把它静默排除。

### M-03：浮层持久化的共享记录格式、恢复安全边界和诊断路径没有闭合

状态：`CONFIRMED`  
定位：需求正本 `§3.6 :471-504`、A5c `:849`；当前实现 `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:217-222,254-267,270-287`，`apps/terminal/kernel/base/state/src/types/persistence.ts:33-48`，`apps/terminal/kernel/base/state/src/foundations/defineStateRuntimeSlice.ts:159-165`，`apps/terminal/ui/base/render/src/components/LayerStack.tsx:113-120`。

仓内事实：

- 当前 `serializeContentEntries` 对 `PRIMARY`/`SECONDARY` 只序列化 `containers`；`applyPersistedContentEntries` 也只恢复 `containers`。
- 当前 record descriptor 的 `storageKeyPrefix` 是 `containers`，`getEntries`/`applyEntries` 只有 state 与 entries 两个参数，没有 catalog、surface context 或 logger。
- 当前 `LayerStack` 对 catalog 中存在但在当前 `displayMode/workspace/instanceMode/surfaceForm` 不可用的 layer 只做 render filter，layer 仍留在 state 中。
- 当前 `readOpenLayerPayload` 的单项结构校验并不等于未来 layer 数组的唯一 ID、重复 ID、完整 JSON、版本和旧格式策略。

需求只说“把 layers 加入序列化/恢复”，并要求用 catalog 检查 `partKey`，无效项丢弃并记 `display-diagnostics`；没有冻结：

1. 是在既有 `containers` record 中换成新 envelope，还是新增独立 `layers` record/prefix；
2. 旧的 flat `containers` 文件如何被新代码读取；
3. catalog 存在但当前 context 不可用时是丢弃、延后，还是保留但不渲染；
4. dropped layer 的诊断由谁产生。当前 `applyEntries` 没有 logger，ui-state 中也没有可直接调用的 `display-diagnostics` 设施；hydration logger 在 `persistenceHydration.ts:86-95`，但 descriptor callback 不自动拥有它；
5. 重复 `layerId`、非有限 `openedAt`、非法 `props` 的恢复行为。

失败场景：

- 直接把 `{containers,layers}` 塞进原 `containers` namespace，旧记录被当成错误的新形状而丢失；或者保留旧形状，导致 layers 根本没有独立持久化位置。
- 只验证 `partKey` 在 catalog 中，却恢复一个当前形态不可用的 part；它会留在 state、被 `LayerStack` 过滤，产生与“恢复了浮层”不同的状态/焦点/遮罩语义。
- 无效 layer 被静默丢弃，或实施者自行把日志写到不存在的通道；A5c 只检查 state 里有一条 layer，不能证明旧记录兼容、不可用项不渲染、诊断真的产生。

影响面：`kernel/base/ui-state` 是所有 App 共用的 state owner；现有 sample-console 的两条 acceptance/content 测试明确期望“不恢复 layer”，本次反向改写会影响所有 assembly 的启动恢复、render layer、焦点和遮罩。不是只给 sample2 加一个字段。

最小修复方向：优先使用现有多 record descriptor 能力新增独立的 `layers` storage prefix，保留旧 `containers` flat shape；若选择 envelope，必须显式定义旧/新 parser，不得静默重解释旧文件。为 layer 定义最小结构校验（唯一 `layerId`、非空 `partKey`、有限 `openedAt`、JSON-safe `props`），并明确 catalog 存在但 context 不可用的处理。最后选一个不引入事件总线的诊断 owner：例如由带 catalog/logger 的 descriptor factory 在 hydration 时记录 dropped reason，或由 hydration 层接收明确的 drop 结果。A5c 增加旧记录、缺失/不可用 part、重复 ID 和诊断断言。

为什么更小不够：只加 `parseLayers` 和重写两个测试，仍然没有旧记录边界、不可用 part 语义和诊断路径；只验证 catalog 中“有这个 key”也挡不住当前 context 下的不可渲染 layer。独立 prefix 是为避免破坏现有记录，属于最小安全隔离，不是第二套 state registry。

Dexter 裁决：浮层必须持久化/恢复已裁定；记录格式、无效 layer 的 context 处理和诊断 owner 属工程闭环，若产品坚持“不可用项保留还是丢弃”有不同语义，再由 Dexter 定。

### M-04：picker 两个 no-op 分支要求“非成功”，但当前 runtime 的可观察语义没有被需求写定

状态：`CONFIRMED`  
定位：需求正本 `:308-335`、A2c `:844`；规范 `doc/platform/terminal-coding-standard.md:89-109`；当前 runtime `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:240-259`、`createCommandDispatcher.ts:533-561`。

仓内事实：当前 actor handler 正常返回任意 JSON 值都会被包装成 actor `status: 'completed'`；command dispatcher 再按 actor 状态聚合。现有 `completeUiStateWrite` 的 `{changed:false}` 也仍是正常完成路径。只有抛出并被 normalize 的异常才会进入 error 结果。

需求却只写“两个不派发分支必须返回非成功”，没有说明是：顶层 `CommandDispatchResult.status` 非成功，还是 result payload 内放一个 `status:'rejected'`。后者在当前 runtime 会让 actor/command 仍然显示 completed，违反 TR-02，但可能让一个只读 payload 的测试假绿。

失败场景：实施者在 actor 中 `return {changed:false,status:'rejected'}`，A2c 若只查 payload 通过，真实 command 仍 completed；或者抛普通 Error，被通用 normalizer 变成 `ERR_TER_RUNTIME...`，失去稳定的 no-op/invalid 分辨码。另一个实施者为了让普通重复点击“成功”而返回 completed，又直接违反正文。

影响面：公开 command 的 failure contract、测试可证伪性、日志与上层是否把 no-op 当作已执行；不是 UI 文案问题。

最小修复方向：在需求中冻结可观察形状：no-op 必须使顶层 command 非成功，并使用具名稳定的 typed code；在测试中同时断言顶层 status、code、零子 command、零 state write。按当前 runtime，最小实现是抛 typed AppError 并保留稳定 code；若 Dexter 认为幂等重复点击应为成功，则那是与当前 TR-02 文本冲突的产品裁决，不能由实施者静默改写。

为什么更小不够：只补“返回非成功”四个字仍允许 payload 假失败；只在测试里查 payload 不能证明 command 的实际状态；扩展 runtime 新 outcome 类型则比使用现有 typed error 更大。

Dexter 裁决：若保留 TR-02 的“不得成功”语义，不需要新增产品裁决；需决定的是文档必须把顶层观察点和稳定 code 写死。

### M-05：TR-09 的核心修订正确，但规范正文仍有反向的现时态规则

状态：`CONFIRMED`  
定位：`doc/platform/terminal-coding-standard.md:300-322` 与同文件 `:378-380`；相关机械事实 `tools/terminal-layering/check-static.mjs:180-195`、`tools/terminal-skeleton/graph-model.mjs:130-148`。

仓内事实：TR-09 已正确删除 owner 必须至少有 slice：P-5c 覆盖全部 `ui/feature`，禁止该层创建 slice；当前 `sample-staff-auth` 与 `sample-member-desk` 也确实是 owner 且 `slices: []`。TR-03 只需要知道真实 owner，不要求 owner 一定有 slice，因此删除不会削弱 TR-03 的前提。

但同一规范 `:378-380` 仍写“owner 按本规则必须真拥有 slice”，并据此解释骨架阶段为什么不能用占位 slice。这与 `:300-310`、`:321-322` 当前规则直接矛盾。读者可能按新规则接受零 slice 的 command/actor owner，也可能按骨架段拒绝它，或者重新造一个占位 slice。

失败场景：实施者为满足旧句在 UI owner 中造无消费者 slice，正好违反本轮要消除的“造占位能力”；或者把合法的零 slice UI owner 判成不合规。

最小修复方向：保留“骨架不得用占位能力冒充真实 owner”的结论，但把 `:378-380` 改成历史规则/现行规则一致的表述：骨架没有真实能力时不声明 owner；未来拥有 command、actor 或 slice 中任一真实职责后再声明 owner。不要回滚 TR-09 的删除。

为什么更小不够：只在需求文档里解释一次，规范本身仍会给实施者两套相反指令；只删“必须拥有 slice”而不改例外 rationale，会留下同一根因的下一处复发点。

Dexter 裁决：不需要产品裁决，是规范正文一致性修复。

## 二、重要但非阻断项

### S-01：TR-04 的正向-only 合法，但 `pendingWallpaperId` 的“缺席”边界没有被证明

状态：`CONFIRMED`  
定位：需求正本 `§3.1.4 :278-290`、A5b `:848`；规范 `doc/platform/terminal-coding-standard.md:151-160`。

TR-04 的澄清本身成立：如果一个 slice 的全部字段都合法地持久化，可以只写正向断言；不得为了凑反向对象造字段。`wallpaperId` 与 `pendingWallpaperId` 都是 Dexter 明确要求恢复的真实字段，因此不是伪造字段。

但 `pendingWallpaperId?` 是可缺席字段。现有 A5b 只覆盖“w2 已确认、w3 未确认，重启后 w3 存在”，没有覆盖“确认后 pending 被清除，重启后仍缺席”。一个错误实现可以把 pending 写进去、确认时不删除；A5/A5b 仍可能通过，用户再次打开时拿到陈旧草稿。

最小修复：在同一真实重启用例或独立用例中加入 `confirm w2 → 重启`，断言 `wallpaperId === 'w2'` 且 `pendingWallpaperId === undefined`；再覆盖 `select w3` 不确认的 A5b。无需增加无消费者字段，也无需把 TR-04 改成强制跨 slice 反向断言。

为什么更小不够：只把“两个字段都持久”写进文字不能证明 optional 字段的删除语义；只测 pending 存在不能挡住 stale pending。

Dexter 裁决：不需要；这是当前需求承诺的持久化边界。

### S-02：A3、A4 仍有“part/state 正确”而非“用户确实看到正确内容”的逃逸

状态：`CONFIRMED`  
定位：A3 `:845`、A4 `:846`、动态升级说明 `:872-874`、红夹具 F-A3 `:866`。

A3 只要求两处 `WallpaperBackground` 读同一 selector 且 asset 相同；A4 只要求 SECONDARY 的 partKey 在两个值之间切换。两者都允许：

- 两块屏都读同一个 `undefined`、透明节点或占位 asset；
- SECONDARY partKey 正确但 renderer 为空、被遮挡或文字不对；
- A3 只传一个 background 时，测试恰好比较两个相同的空结果。

文档的 `:872-874` 说 A3 已升级到双屏 VM，但 A3 行本身没有“两块屏实际截图/像素或可见文本”的断言；F-A3 只覆盖 SECONDARY 节点缺失，不能覆盖错误但存在的节点。A4 甚至没有对应的真实可见结果要求。

最小修复：双屏 VM 上在确认前后分别截 PRIMARY/SECONDARY，断言两块实际屏都从无壁纸变为同一已知资产；A4 至少逐状态截图或断言真实可见文本/可寻址文本内容，而不只比 partKey。保留 selector/partKey 断言作为辅助。

为什么更小不够：增加更多 component tree 断言仍不能证明合成结果和遮挡；只保留一块屏截图无法证明副屏同步。

Dexter 裁决：证据档位是已写入的 VM 要求，不需要新增产品裁决；当前评审不能把它当作已执行。

### S-03：A2 的像素变化没有把结果绑定到用户选择的那张图

状态：`CONFIRMED`  
定位：A2 `:842`、F-A2 `:864`、A1 `:841`。

A2 只要求点击确认后“主要面积像素有差异”。一个恶意但合规的实现可以在确认后显示纯色、固定 w1、加载错误的其他 jpg 或任意占位图；只要从“无壁纸”变样，A2 就通过。A1 对缩略图 source 的断言不能证明背景 renderer 使用了同一个选择 ID。

最小修复：在真实 screenshot 前后之外，加一条可观察的资产身份断言：确认 w2/w3 后，`WallpaperBackground` 的 source 必须等于对应 `assetsById[wallpaperId]`；截图再证明该 source 实际可见。可以只选两个已知资产，不要求对每个像素做脆弱的全图 golden。

为什么更小不够：只加强像素差异阈值仍能接受错误图片；只测纯函数或 selector 又绕过了最终 renderer。

Dexter 裁决：不需要；这是 A2 现有需求“切换成所选壁纸”的可证伪化。

### S-04：Android mobile 的 exact lifecycle hook 与未知值策略没有对上当前 adapter

状态：`PARTIALLY_CONFIRMED`  
定位：需求正本 `§5.2.1 :665-673`；当前 `apps/terminal/adapter/android/dual-screen/.../TerminalDualScreenActivityHandler.kt:401-445,447-471,762-774`，以及 `apps/terminal/assembly/android/sample-terminal/App.tsx:23`。

仓内事实：当前 adapter handler 的主要扩展点是 `onDidCreateReactActivityDelegate`；`readDisplaySnapshot` 目前只读 display 数量和副屏对象，不携带逻辑尺寸或 `surfaceForm`；主屏 launch options 目前只有 `displayIndex/displayCount`。当前 sample-terminal 的 `MainActivity` 只有标准 `onCreate`，方向锁在 app.json 与 AndroidManifest 的声明层。需求却把“在 activity onCreate 判定后一次性 setRequestedOrientation”写成已冻结路径，没有说明这条逻辑如何落进现有 adapter 的 handler/Activity 生命周期。

此外，`:668`、`:673` 把“读不到时落 laptop”保留为产品默认建议，§11 又把所有待裁项写成已关闭。方向映射可以静态对照现有 JS `surfaceFormForOrientation`，但两台 VM 的实际输入、Bundle 和方向锁尚未运行。

最小修复：详设前先冻结一个真实 hook（例如明确由 adapter 的现有 Activity handler 在 primary activity 创建阶段执行，或明确新增 adapter-owned lifecycle callback），写出主屏/副屏、失败路径、只执行一次和 launch options 的完整数据流；把“未知落 laptop”单独标为 Dexter 已决/待决，不要在 §11 同时称零待裁项。不要把逻辑下放到 sample-terminal MainActivity。

为什么更小不够：只写“adapter 负责”会让实施者在 assembly、Manifest 或二级 Presentation 任意选点；只做方向 truth table 不能证明 primary activity 真拿到该值。

Dexter 裁决：exact hook 是工程设计输入；“未知/读取失败是否落 laptop”若尚未明确则需要 Dexter 决定。A6 的 VM 结果本轮未执行。

### S-05：A7 的“红色主题”只约束 action 色，不能约束其余 18 个语义色

状态：`DEXTER_DECISION`  
定位：需求正本 `§4b.1 :597-604`、A7 `:851`、`§9.2 :876-884`。

仓内事实：A7 会检查 19 个色名集合，另检查 `--color-action` 的 HSL 色相/饱和度/明度。恶意实现可以把另外 18 个值全部复制 sample-console 的蓝/灰主题，只把 action 改成红；按当前判据全绿，但普通用户看到的整体不一定是“红色主题”。

这是“红色主题”到底是品牌强调色为红，还是整套语义色需呈现红色风格的产品语义，不宜由 Codex 偷选。

最小修复有两种可选方向：

- 若产品定义就是红色 action accent：把需求文字收窄为“action accent 为红”，并承认其他语义色可沿用基线；
- 若产品定义是整套红色主题：给 19 个值一个冻结色板/每类最小约束，并用真实页面截图或对应 predicate 验证。

为什么更小不够：只扩大 action 的 HSL 区间不能证明其他 token；只检查 19 个名字只能证明没有漏名。

Dexter 裁决：需要 Dexter 选定“red theme”的语义边界；在裁决前不能把 A7 说成完整主题证明。

### S-06：picker 的“当前选择”到底是 pending 还是已确认值没有冻结

状态：`DEXTER_DECISION`  
定位：需求正本 `:308-324`。

正文要求“选中项与当前一致就不发变更命令”，但 option actor 的伪代码只把 `selectPendingWallpaperId` 当作 current：当已确认值为 w2、pending 缺席、用户再次点 w2 时，当前文字会派发 `selectWallpaperCommand(w2)`，制造一个与已确认值相同的 pending。若“当前”指用户正在编辑的有效选择，这就是冗余状态；若“当前”只指 pending，则必须把 UI 的选中态和该语义写清。

最小修复建议：冻结 `effectiveSelection = pendingWallpaperId ?? wallpaperId`，option 与 effectiveSelection 相同时不派发；确认按钮仍只在 pending 存在且不同于 confirmed 时可用。若 Dexter 有意让再次点击已确认项重新生成 draft，需要明确这是行为而不是把它留给实施者猜。

为什么更小不够：只说“比较当前”仍存在两种可合法实现；只补一个测试数字不能冻结定义。

Dexter 裁决：需要 Dexter 决定“当前”的产品语义；建议采用 effective selection。

## 三、未验证项与小缺口

### N-01：全称/唯一性声称仍没有逐项可复核的命中清单

状态：`UNVERIFIED_REQUIRES_EVIDENCE`  
定位：需求正本自认规则 `§10.3 :925`、`§10.6 :957-961`；代表性新断言 `:267`、`:577`、`:675`。

文档自己已经承认：后续任何“唯一、零命中、不存在、必然”若没有命令和命中清单，必须视为未经核实。但新段落仍以“盲审穷举过”“唯一知道资产是否存在”“四项无静态校验”“整个缺口只在 native 入口”等表述承担范围结论，却没有逐项命中集合。Codex 可以对当前若干源码点做独立抽查，但不能把作者的无清单自报提升为仓级全称证明。

最小修复：对每一个全称断言给出可复现命令、扫描根、排除规则和完整命中清单；若不想维护清单，就把措辞收窄到已打开的文件/包范围，并写 `UNVERIFIED_REQUIRES_EVIDENCE`。不需要为每条普通事实制造审计脚本。

### N-02：Metro、双屏可见结果与 mobile truth table 仍是实施证据，不是本轮已闭合事实

状态：`UNVERIFIED_REQUIRES_EVIDENCE`  
定位：需求正本 `:57-59`、`.jpg` 明确未验证 `:122`、`A2/A3/A6 :842,845,850`、`§10.5 :953`。

“实施首步实测”“机器上有两台 VM”只是执行安排/环境前提，不是 Metro 已解析 `.jpg`、双屏实际显示、mobile 方向推导或截图像素结果。当前静态评审没有运行任何命令或 VM，因此这些档位必须继续保持 OPEN；不能因为它们被挪到实施首步就写成“不再悬空”。

最小修复：保留 `UNVERIFIED_REQUIRES_EVIDENCE`，在实施计划中写清关闭条件和实际输出；动态证据取得前不要把 A2/A3/A6 或 Metro 标为 PASS。

### N-03：新安装时的初始壁纸没有定义，且与“待裁项全部关闭”不一致

状态：`DEXTER_DECISION`  
定位：需求正本 `WallpaperState` `:226-240`、A1 `:841`、§11 `:963-968`。

文档列出了“无壁纸 + 三张图”，但没有定义 fresh install 时 `wallpaperId` 的初始值，也没有定义初始 picker 选中哪一项。A1 只要求当前选中态与 selector 一致，不能替代产品默认。实现者可以合法地选择 none、w1 或任一内置图，导致首次启动截图和重启基线不一致。

最小修复：若预期是安全/最小默认，明确 `wallpaperId = none`、pending 缺席、首次 picker 选中 none；若 Dexter 要默认第一张图，则写死该选择。不要让实施者从“选项列表”推断默认。

Dexter 裁决：需要 Dexter 冻结 fresh-install 默认；这不是 Codex 代决定的视觉偏好。

## 四、两条规范改动的独立判断

### TR-09

移除“owner 必须至少拥有一个 slice”是正确的，不应回滚。P-5c 的分母覆盖全部 `ui/feature`，而该层结构上不能创建 slice；当前两个 UI owner 的 `slices: []` 也与此一致。owner 仍需拥有 command、actor 或 slice 中至少一类并承担唯一写责任，toolkit 仍不得有 slice，TR-03 的“先知道 owner 才能判断跨包读”没有被削弱。

需要修的是规范 `:378-380` 的旧现时态 rationale，而不是把已删除的门恢复。规范门本身也只检查 slice 前缀、toolkit slice 和零消费者，不应重新写入一个从未实现的 owner-zero-slice 门。

### TR-04

三条澄清方向成立：反向对象可在同一重启用例的其他 slice；全字段合法持久时允许正向-only；不得为凑反向对象增加无消费者字段。它没有给“不写反向断言”开任意口子，因为前提是“全部字段都合法地持久”，且用例必须明确说明。

本批的 `WallpaperState` 确实满足“两个字段都要求恢复”的业务前提，但 optional `pendingWallpaperId` 仍需测试缺席/删除。规范中“通用门今天不存在”的声明是诚实的，不应删掉；它不能反过来证明真实重启测试已经执行。

## 五、重点问题的非 finding 判断

### 壁纸可见性与 F-A2a

当前设计方向合理：`SurfaceRoot` 先渲染 children，默认 container 带不透明 `bg-canvas`，而 wallpaper 位于更底层；给 picker/waiting/welcome 使用透明 container 是使壁纸露出的最小结构性修复。把 `ui/base/render` 保持零改动在静态结构上可行，不需要新增第二个 render 背景系统。

F-A2a 的变异方向正确：把透明 container 改回默认，若 screenshot 真的来自同一 host、同一确认动作并覆盖壁纸区域，A2 应该因确认前后无可见变化而变红。当前仍没有执行该变异或 VM 截图，所以结论只能是“判据设计有针对性，动态结果 OPEN”，不能写可见性 PASS。

### 720×1280 与方向判定

现有 JS `surfaceFormForOrientation` 的 `landscape → laptop / portrait → mobile` 与新 truth table 语义一致；但 native 当前 handler/Bundle 尚未携带 `surfaceForm`，且当前 adapter 的实际 lifecycle hook 与需求文字没有闭合，见 S-04。移动 VM 可用不等于 truth table 已验证。

### 全量 package/graph 清单

§7.0a 的 27→31 节点改动、assembly reachability 和 layering hardcode 的提醒是有用的，且 source-import 与 dependencies 的集合相等规则确实存在。但依赖表被正文明确标成“设计意图、以实际 import 为准”，不能当作当前源码事实；新包尚未存在，也不能在本轮静态评审中把它们的实际集合判 PASS。

## 六、被推翻的作者结论清单

1. “scope 已唯一化为 4+5=9/全文不再另起计数”：被 §7.0a 的 4+6=10、§4.2 的 `sample-staff-auth` 实际改动和 §10.5 自身的 4+5=9 共同推翻；当前至少有 4+7=11 的正文触及位置，除非明确重划历史边界。
2. “sample2 mobile portrait 仍可按 360×800”：被同一正文 §1.3 的 Dexter 裁定 720×1280 推翻；360×800 只仍是既有 sample-console 基线。
3. “TR-09 规范修订已完整闭合 owner/slice 问题”：核心删除正确，但 `:378-380` 仍保留反向现时态规则，规范当前并不自洽。
4. “TR-04 正向-only 已使本 slice 的持久化边界闭合”：规则允许正向-only，不等于 optional pending 的删除/缺席边界已被 A5b 证明。
5. “A3 已升级为双屏真实可见证明”：文档说明段提到 VM，但 A3 行仍只断言 selector/asset 相等，A4 仍只断言 partKey。
6. “A7 的 HSL predicate 已证明红色主题”：它只证明 action token 落入红色区间，不能证明另外 18 个语义色不是蓝/灰基线；是否足够要 Dexter 定义。
7. “mobile 的全部缺口只在 native 入口”：当前 JS 已有 orientation→form 映射，App 仍有 laptop fallback；能确认的是 native launch options 尚未提供 form，不能把整个缺口归结为一处。
8. “Metro 等证据已不再悬空”：当前文字只是实施首步计划，`.jpg` 解析与 A2/A3/A6 动态结果仍未执行。
9. “浮层只要校验 partKey 在 catalog 中并记诊断就安全”：当前 ui-state descriptor 没有 catalog/logger/context 入参，LayerStack 对不可用 layer 是过滤而非删除，旧记录格式也未定义；这不是已证实的安全闭环。
10. “两个 no-op 分支返回非成功即可”：在当前 runtime 中普通返回仍会聚合为 completed；必须定义顶层 typed failure，否则测试可被 payload 假状态骗过。

## 七、本轮范围内文档仍漏掉的问题

1. 浮层 persistence record 的 wire shape、旧 `containers` 记录兼容策略、版本/namespace 边界。
2. catalog 存在但当前形态不可用的 layer 是丢弃、延后恢复还是保留不渲染；以及 duplicate layer ID 的恢复语义。
3. hydration 丢弃 layer 的诊断 owner、字段、日志路径和脱敏边界；当前 `applyEntries` 没有自动诊断通道。
4. `pendingWallpaperId` 被确认后必须缺席的持久化证明。
5. picker “当前选择”是 `pending ?? confirmed` 还是 pending-only，以及重复点已确认项的用户语义。
6. fresh install 的默认 `wallpaperId` 与 picker 初始选中项。
7. Android primary activity 的确切 adapter lifecycle hook、orientation lock 的调用 owner、失败/未知值产品策略，以及 launch options 到 JS 的完整数据流。
8. A3/A4 的真实可见 oracle 与所选 asset identity；A2 的像素变化与所选 asset 的绑定。
9. “red theme”是 action accent 还是 19-token palette 的产品定义。
10. §10.3 要求的全称断言命中清单；不能以“盲审穷举过”替代当前源码可复核证据。

## 八、动态证据边界

本轮未执行任何命令、构建、测试、Metro、Web、Android、native、VM、DEV、seed、UAT 或部署。因而：

- `A2/A3/A6`、`.jpg` Metro 解析、双屏壁纸同步、mobile 720×1280 与方向锁、浮层真实重启恢复均为 `UNVERIFIED_REQUIRES_EVIDENCE`；
- 设计中的 transparent container、独立方向映射和独立 persistence prefix 是静态方案判断，不是运行通过；
- 作者历史盲审、当前机器有两台 VM、实施首步安排、旧测试改写计划都不升级任何动态档位；
- 本 `NO-GO` 针对需求/规范作为 implementation-facing 输入尚未闭合，不授权进入详设或实施。
