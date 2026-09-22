Dexter

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
M/S/N=1/1/1

盲审声明：我先按“目录/计数不实、base 抽取抹平业务差异、旧代码残留判据不可执行、IA 可见事实漂移、测试映射虚写”形成证伪假设，再逐项对照作者材料、规范、project-memory 与当前源码字节核验。未运行任何 runtime，未修改文件。

输入清单：已读 AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、Roadmap registry/current Roadmap、project-memory index 与命中原文、review standard、frontend/terminal coding standard、cs-spec-to-plan、cs-writing-plans、requirements、IA reconciliation、implementation-design、implementation-plan、既有 IA/interaction/wallpaper 正本关键段，以及列出的 feature/integration/base 源码和测试路径。

Finding 1

classification=CONFIRMED
severity=M
status=blocks GO
路径/章节/符号：
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md:159-170
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md:180-182
- apps/terminal/kernel/base/runtime/src/types/command.ts:52-62
- apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts:54-64
- apps/terminal/ui/feature/sample-wallpaper-picker/src/hooks/useWallpaperPicker.ts:78-86

证据：详设把 useTrackedCommand 的 run 输入写成现有 CommandDefinition + payload + routeIntent + callbacks；但实施计划又说 runner 的 definition 提供 execute、requestLabel、rejectionPolicy。当前 CommandDefinition 真实字段是 moduleName、commandName、visibility、timeoutMs、allowNoActor、allowReentry、defaultTarget 和 brand，没有 execute/requestLabel。现有 hook 也直接把 loginCommand / wallpaper command definition 传给 dispatchWithRequestId。

影响面：auth/member/wallpaper 五处 action runner。若按 plan 实施，执行者要么发明一层不存在的 command-like definition，要么忽略计划文字，都会让 requestId/busy/rejection policy 的设计边界不再可审。

最小修法：把 plan CP-2 的“definition 提供 execute、requestLabel”删除，改成精确 API：run({definition: CommandDefinition<TPayload>, payload: TPayload, routeIntent?, onOutcome?, onRejected?, rejectionPolicy})。如需要 request label，必须另列为中性 diagnosticsLabel，不得混入 CommandDefinition。

Finding 2

classification=PARTIALLY_CONFIRMED
severity=S
status=must fix before implementation
路径/章节/符号：
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md:195-207
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md:521-524
- apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx:11-18
- apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx:28-43
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeLaptop.tsx:10-15
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeMobile.tsx:9-14

证据：当前 base notice 只支持 title/message/dismissLabel/children；真实 laptop/mobile 差异至少包括 root padding、alignItems、card width/maxWidth、actions orientation、button width。详设只写“纯 presentation props”“root/card/actions/button 的中性 style/布局参数”，又在未决项中把最终 TS 类型留到实施前确定。方向正确，但 implementation-facing 详设没有冻结最小 props 形状，执行者仍需现场猜“允许哪些 style”。

影响面：六个 system notice renderer。若 props 过宽，会把 base 变成任意样式通道；若过窄，又无法保持 mobile/laptop 当前差异。

最小修法：二选一写死：A) 明确 presentation 的 exact 类型和允许字段，例如 rootStyle/cardStyle/actionsOrientation/dismissButtonStyle；B) 不扩 base props，保留 feature thin shell，只用 SystemFailureNotice 默认能力覆盖能覆盖的部分。无论选哪种，都把六个当前 renderer 的静态呈现值列成对照表。

Finding 3

classification=REJECTED_WITH_EVIDENCE
severity=N
status=not blocking
路径/章节/符号：
- doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md:55-60
- 当前源码 apps/terminal/ui/feature/*/src/components
- 当前源码 apps/terminal/ui/integration/*/src/application/terminalSurfaces.ts

证据：我怀疑 14 logical / 28 renderer / 14 wrapper / 3 common 计数可能继承自文档，但当前源码逐文件核验后对得上：member 9/18/9/MemberRow，auth 3/6/3/StaffLoginPasscodeInput，wallpaper 2/4/2/WallpaperBackground。两个 integration 也确有重复 terminalSurfaces parser、startup-ready actor 和 state-sync reduce。

影响面：无阻断；分母真实。

Summary：
- Clarity：总体清楚，但 useTrackedCommand API 在详设和计划之间自相矛盾。
- Verifiability：负向扫描、focused/typecheck、三维对账和证据分档都可执行；SystemFailureNotice props 还不够可执行。
- Completeness：路径、计数、测试文件和 integration 分母基本真实；动态/视觉仍按 NOT_AUTHORIZED/NOT_RUN 处理正确。
- Big Picture：方案符合 Dexter 的目录分离、业务包减负和不造大工厂意图。
- Principle/Option Consistency：N/A，非 ralplan；方案比较没有发现反向依赖型大抽象。
- Alternatives Depth：N/A。
- Risk/Verification Rigor：N/A；普通 review 下风险/验证总体充分，但上述两处需修。
- Deliberate Additions：N/A。

总体结论：Round 1 为 NO-GO。修正 tracked command API 矛盾，并冻结 SystemFailureNotice presentation 形状后，再进入作者 intake/必要的 Round 2 定向复核。
