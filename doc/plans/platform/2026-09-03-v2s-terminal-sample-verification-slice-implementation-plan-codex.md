SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# TER sample 验证切片实施计划（v13 重做与 D-6 修订）

## 0. 计划元数据与边界

~~~text
BUSINESS_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
IA_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-implementation-design-codex.md
AUTHORIZED_NOW=已被 2026-09-04 修订计划替代；第一段 CP-6＋CP-9 已获实施授权
IMPLEMENTATION_AUTHORITY=true（仅以修订版两段执行计划的第一段范围为准）
NOT_AUTHORIZED=adapter/assembly；CP-7、CP-8、CP-10、CP-11；D-6 真机 spike；浏览器自动化/L2；DEV、seed、UAT、部署、Git
REVIEW_CYCLE_ID=2026-09-04-TER-SAMPLE-VERIFICATION-SLICE-DESIGN-03
REVIEW_TARGET=DESIGN
AUTHORING_REVIEW_STATUS=SUPERSEDED_BY_TWO_SEGMENT_PLAN_FIRST_SEGMENT_AUTHORIZED
~~~

本计划已被 `doc/plans/platform/2026-09-04-v2s-terminal-sample-two-segment-execution-plan-claude.md`
替代。当前有效执行顺序、第一段范围与停止条件以修订版计划为准；本文件保留作为 v13 的原子 CP 设计记录，
不得再用其中的旧阶段状态或旧 CP 顺序推断当前授权。

## 1. 执行总原则

### 1.1 不可拆的原子组

下列事实必须在同一批内同步完成：两个 rename 的活动面、feature workspace globs、layering checker 与 sample 接线、render/display-context 公共面与门、九项 runtime module assembly、两类 UI feature descriptor、三个真实 Android adapter、Web 两 Provider、Web 真持久化、native 入口/initialProps。任何只改 owner 不改消费者、只改目录不改工具、只接 Web 不接真机 adapter 的中间状态都不得交付。

### 1.2 执行分段

先完成所有静态/类型/focused 证据与 Web 第一段；Web 适用场景和机械门全绿后，才进入真机第二段。真机专属 S-27、S-28、S-29 不能以 Web 证据替代。localWebServer、双机 pair、workspace/instanceMode/displayRole 切换留到后续刀。

### 1.3 每 CP 的共同动作

每个 CP 开始前，重开 v13 对应章节、IA/交互条目、详设条款、六维路由记忆和 owning source。完成 focused proof 后，用同一组原文逐点回读需求、详设/IA、记忆规范、源码与证据；再由 fresh 独立子 agent 做步骤级三维对账，主 agent 修复所有 OPEN 后才进入下一 CP。**主 agent 是本计划唯一编码与文件写入者；fresh 子 agent 只做只读静态 review/三维对账，不得修改任何代码、测试、依赖、脚本、文档或其他文件。**全部 CP 后再做一次全批三维对账；D-6 spike 不在本计划授权内。

## 2. CP-0：v13 基线与影响面

### 目标

固定新的 26 节点图、9 个交付角色、31 条 S、14 条 active P、Web/真机两段边界和所有取消/不阻塞事项。

### 执行

1. 重读 requirements §2.1-§2.5、§3-§8、§9-§11，特别记录 D-6、七条 `sample-terminal` 依赖和 S-27 第六项。
2. 读取 IA、交互工件、implementation design，确认无 v11 六包、旧白名单、旧 pre-mount 协议和单 Provider 残留。
3. 用 rg 枚举两 rename 的活动 source/tool/test/config/package/app/graph/skeletonBootstrap/invariants 引用；历史 docs/evidence 只读。
4. 固定待改 facts 表：workspace globs、公共面 render 16→21 与 display-context 17→20、sample-console 测试从零、三 adapter、terminalSurfaces、descriptor 清单、D-6 对 CP-7/CP-8 的阻断。

### 失败条件与不变量

- 失败条件：任何 v11 机制仍作为当前形态、或 rename 分母不能列出全部活动命中。
- 不变量：不存在未决产品语义被主 agent 偷选；flex/absolute 与 Android 单 VM feasibility 保持 stop condition。

### evidence

静态源清单与设计对账；不运行应用。

## 3. CP-1：workspace 与 layering checker

### 改动面

- root package.json workspaces 增加 apps/terminal/kernel/feature/* 与 apps/terminal/ui/feature/*。
- 新建 tools/terminal-layering/check-static.mjs 与 check-static.test.mjs。
- tools/terminal-skeleton/verify-static.mjs 接入真实 checker。

### checker 范围

只实现 P-5a 五类反向依赖、P-5c 基于 TypeScript AST import 来源的能力边界、P-5d ui/feature 原生组件边界、P-10 kernel UI literals。P-5b、P-8、P-9、P-11 不塞进机械 checker。

### 可证伪门

- 空 checker 或只扫空目录必须失败；
- 以真实 import/use 注入一个 kernel→ui 反向 import、一个 UI feature 的 `StateRoot`（含别名与无限定符 type import）、一个 UI feature 的完整 `Runtime`、`createSlice` 或 `react-redux`，以及一个 kernel feature 的 partKey，目标规则必须红且 control 绿；UI feature 从 runtime 导入 `defineCommand`/`RuntimeModule` 的 owner 形态必须作为正控制通过；P-5d 以一次性临时夹具分别注入命名别名、namespace、模板串 `createElement` 与 JSX host tag，目标规则必须红，当前生产树清洁另行判定；
- 合法 kernel←ui、kernel←adapter、kernel←assembly、ui←assembly、adapter←assembly 不得误红。

### 依赖与 readback

完成后确认 sample feature 目录已被 workspace、runner、checker 同时发现；由 fresh 独立审查者对照 P-5a/P-5c/P-10。

## 4. CP-2：全量 rename

### 执行顺序

1. 按 CP-0 清单锁定旧名的活动文件与唯一锚点；
2. 同批更新 workspaces、package name、package exports、app.json、moduleName、dependencies、graph、skeletonBootstrap、invariants、工具脚本、test entry；
3. 更新新包 README 与依赖方向说明；
4. 静态扫描旧名仅允许历史 docs/evidence 留存；新名每处活动引用必须可解析。

### 约束

不是目录 rename；不能添加旧名兼容 package、旧名 fallback 或双入口。sample-console 必须从零具备 test script/config/invariants；sample-terminal 仍只有端口表，不接业务。

### 可证伪门

删除一个活动 rename 引用或保留一处旧 package import，静态/类型门必须红；只改目录而不改 graph/tool 的 mutation 必须红。

## 5. CP-3：TER framework 三处

### 5.1 render W-11

在 render owning source 增加 `useDispatchCommand`、`useUiVariable` 与三项 request helpers（`dispatchWithRequestId`、`useRequestInFlight`、`useTrackedRequest`），公共 exact set 16→21、README/invariants 同步。dispatch 只以窄函数注入，不暴露 store；import-capability 门禁止 `getStore`、`dispatchAction`、`useDispatch`、完整 `Runtime`／`createRuntime` 来源及 render 不应拥有的构造能力，不以局部变量拼写代替边界。

### 5.2 render W-9

useUiStateSelector 的 memo key 必须包含 root 引用和 selector identity；root 不变而 selector 变时重新计算，稳定 selector 保持结果引用。selector 是 root 纯函数。

### 5.3 display-context W-7

公开 readDisplayInfo、DisplayInfoRead、resolveSecondarySurfaceAvailable，公共 exact set 17→20。只保留 valid/unavailable/malformed 分类和 unknown-to-single；不公开当前 private 1000ms 数值约束。adapter/device 和 test-expo 都经同一三态契约。

### 5.4 proof

每个公共面改动同时更新 index、README、invariants、静态门与 focused red vector。对 render：非 started getState 计数必须为零、双 Provider 独立；对 display-context：纯函数四分支和未知降级各有 red vector。

### 停止条件

若 W-11 或 W-8 实际签名不能由窄函数闭合，不能把完整 Runtime/module/store 传到 UI；停在 CP-3 交 Dexter。

## 6. CP-4：kernel features

### 6.1 sample-staff-session

创建 owner module、slice、command creators、actors 和 descriptor。覆盖 bootstrap、login、logout、五个独立结果事件。bootstrap 为 internal，但若会派 public 子命令，根派发显式 createRequestId。登录失败不写 authenticated，request 失败。

### 6.2 sample-member-registry

创建 owner module、slice、commands、actors、selectMembers/selectPendingMember 和 descriptor。submit 只写 pending；confirm 无 pending 抛错，actor 生成 memberId/registeredAt、写 members、清 pending；reject 清 pending。所有 PersistIntent owner-only、syncIntent isolated。

### 静态和 focused 门

- kernel feature 源码零 partKey/containerKey/displayMode 字面量；
- 两个 kernel 不依赖 UI feature、ui-state 或彼此；
- public command 缺 requestId 的 red vector 命中 Runtime 错误；
- owner selector 由 CP-4 导出并以 owner focused test 校验；真实跨包消费者测试使用真实 root，随 CP-5 的 `sample-member-desk` 消费者一并交付；
- events 与 commands 的 visibility、requestId（结果 event 必须继承根 requestId）、失败副作用均有 focused proof。
- UI action handler 不得以 `void <Promise>` 或空 `catch` 静默吞掉 `dispatchWithRequestId` 的拒绝；handler 返回/传播 typed Promise，交互句柄只在 `finally` 中释放。`useDispatchCommand` 对窄派发的 rejection 通过注入 logger 记录 `command-dispatch-rejected`（仅 commandName/requestId 与失败分类，不记录 raw error）后 rethrow；不新增业务错误层。

### 对账

每个 kernel CP 后先对需求 §6.3/§6.4、IA 不可见维度、TR-01/TR-02/TR-03/TR-11/TR-12 和当前 Runtime command creator 做三维对账。

## 7. CP-5：UI features

### 7.1 common contract

两个 ui/feature 各导出 parts、variables、createModule 三项组装描述。两者的依赖必须逐项落到真实包名：`ui-state`、`render`、`runtime`、`state`，以及各自实际消费的 sample kernel 包；`sample-member-desk` 另直接消费 `display-context`；不得写成无法核对的 `kernel` 泛称。requestId 与 request 观察由 render 的 request helpers 收口，feature 不直接 import `contracts`；`state.StateJsonValue` 用于组装描述与 props 类型连接；两个 sample kernel 的命令、事件与 selector 只从各自 owner 包消费。kernel 不声明变量。变量通过 ui-state module-bound reader 注入，不自造 key 校验。

### 7.2 staff-auth

`sample-staff-auth` 明确声明并实现依赖：`ui-state`、`render`、`runtime`、`state`、`kernel/feature/sample-staff-session`。使用 `state.StateJsonValue` 完成 descriptor/props 类型连接，requestId 与 request 状态通过 render request helpers 接入，并只从 `sample-staff-session` 消费 session 命令与结果。实现 login、notice parts；operator-name owner-only、passcode never；auth actor 只监听领域结果与自有呈现命令，reasonCode 显式传递，login button 走 useDispatchCommand。

### 7.3 member-desk

`sample-member-desk` 明确声明并实现依赖：`ui-state`、`render`、`runtime`、`display-context`、`state`、`kernel/feature/sample-staff-session`、`kernel/feature/sample-member-registry`。使用 `state.StateJsonValue` 完成 descriptor/props 类型连接，requestId 与 request 状态通过 render request helpers 接入；session 结果来自 `sample-staff-session`，会员命令、事件与 selectors 来自 `sample-member-registry`。实现 list、form、waiting-confirm、registry-notice、customer-welcome、customer-member parts；四个变量/层级/容器按 v13。customer-member props 只有 preview/confirm。屏数差异只在 actor：每次相关命令 await readDisplayInfo，再调用 resolveSecondarySurfaceAvailable。部件不分支屏数、不决定 screen。

### 可证伪门

- 部件直接 dispatch、按屏数 if、裸读别包 slice、使用平台判断、把业务值放 useState 的生产 mutation 必须使对应 P 红；
- layer-only 三个空 containerKeys 的实际 definePart 进入真实 catalog；空数组不被统一成非空；
- 领域事件监听与请求命令监听错误互换时，P-12 或 S-3 focused test 必须红；
- testID 落在实际 input/button/action node，非 wrapper。
- `sample-member-desk` 的真实 selector 消费者必须在 CP-5 测试中使用 CP-4 导出的 selector 与真实 root；CP-4 不以 owner 自读测试冒充跨包消费证明。

## 8. CP-6：sample-console 与 Web

### 8.1 assembly

实现唯一 createSampleAssembly。按详设顺序真实创建两 UI 描述、catalog、renderer catalog、ui-state module、display-context、九项 input.modules、Runtime；await start 后 resolve。闭包持有同一 runtime/catalog/reader。

### 8.2 base descriptors

在 sample-console 内只建一份 createBaseModuleDescriptors，供 contracts/platform-ports/state 参与真实组合。不能让两个 feature 或 assembly 各抄一份；此项作为 D-3 技术欠账记录。

### 8.3 test-expo

从同一 shell surfaceMode 推导 DevicePort displayCount 和一/两棵树；一个 React root 下挂两个独立 Provider。外壳的可见切换按钮使用 `sample-console:test-expo:surface-toggle`，但它不是 catalog part 或业务命令。读 sample-console typed terminalSurfaces 常量，固定逻辑尺寸、row/column、scaleToFit。Web persistence 使用真实可跨 refresh 的 StateStoragePort，不用 processMemoryStorage。

### 8.4 测试接线

sample-console 从零增加 test script、vitest config（含 ts/tsx）、tsconfig include、devDependencies、invariants REAL_TESTS、runner 收集路径。只有实际收集到 focused .test.tsx 才允许判 green。

### 8.5 可证伪门

- 两 Provider 共享 reader/reporter、一次 store change 只更新一侧、卸载后订阅数不回落，S-24 必红；
- 重建 runtime 或用一个 Provider 包两 Surface，S-24/S-25 结构测试必红；
- 对业务行为与生产源码约束，不能只改 fixture 不改 production；P-5d 是纯静态模型门的例外，临时 fixture red vector 只证明 AST detector，不能替代当前生产树清洁证明；
- 真实 assembly 缺任一 descriptor 或 catalog 链路断开，S-10/S-11/S-19 必红。

## 9. CP-7：Android adapters

### 9.1 dual-screen：D-6 阻塞

本计划不选择双屏 carrier。`OPEN-DUALSCREEN-SINGLE-VM-CARRIER` 必须由 Dexter 另行授权一次真机 spike；在其收口前，CP-7 只能登记接口与周边不变量，不能实现 dual-screen carrier，CP-8 native 接线不得开始。

carrier 无论最终形态如何，都必须满足六项周边规格：主 Activity 创建时调用启动器且少于两块屏直接 return；选取非 default display；已有实例幂等、失败回滚已请求标记；Kotlin 同步传 `displayIndex` 与实际 `displayCount`；主/副屏使用同一已注册组件且注册同步、一行不改；不引入 `localWebServer` 或其他 port。POC 的独立 secondary process 与自建 React 实例均不可照抄；同进程 Presentation 只有在复用同一 ReactHost／ReactSurface 且实证单 VM／单 store 时才可作为候选。若 spike 只能形成第二 VM、独立进程、独立 store 或独立 React 实例，停止交 Dexter，不得自行降级继续。

### 9.2 device

真实实现 getDisplayInfo，成功分类 valid，坏响应/超时分类由 display-context 处理。业务 actor 只通过 readDisplayInfo。

### 9.3 persist-kv

Kotlin 使用 `com.tencent:mmkv` 的 MMKV、按 persistenceKey 隔离、字符串 StateStoragePort 边界、版本化类型 envelope。v13 未冻结具体版本；CP-7 实施前从当前 Android Gradle/version catalog 与官方兼容性资料解析并记录实际版本，无法证明兼容时停止交 Dexter，不得预先硬编码或另钉未经批准的版本。五类值、null 与字符串 null、kill/reopen 都要验证；不得引入 JS MMKV，不使用 String(value)。

### 可证伪门

S-27 只能在 D-6 收口且获真机授权后，分别证明单屏 no launch、双屏 displayId、props、幂等、同步 registration，以及主/副屏同一 JS VM／同一 store（主屏 dispatch 后副屏读到同一 store 新值）；S-28 分别证明 device business path；S-29 生产 mutation 去掉 envelope 必红。三条不合并。

## 10. CP-8：sample-terminal

### 前置收口：v13 已解决的依赖形态与 D-6 未决 carrier

v13 已将 D-B 与 §2.5.4／§6.8 对齐：`sample-terminal` 只接五个 adapter、`platform-ports`、`sample-console`，共七条依赖，不加 `display-context`。屏身份由 dual-screen adapter 经 Kotlin launch options／JS 启动 props 送达，assembly 不判断屏数；这不是暂定选择，也不需要通过添加无消费者边来消除历史数字矛盾。

CP-8 的 native 双屏接线子项受 D-6 `OPEN-DUALSCREEN-SINGLE-VM-CARRIER` 阻塞：必须先由 Dexter 另行授权真机 spike，证明单 VM／单 store／多 Root Surface 的具体 carrier；不得由本计划自行选择独立进程、独立 React 实例或第二 VM 替代。若候选是 Presentation，必须证明它复用同一 ReactHost／ReactSurface，而不是自建独立 React 实例。非 native 的 `sample-terminal` rename、端口表与入口准备不替代该阻塞项，也不提前写入任何 carrier 选择。

### 执行

先完成 pos-desktop→sample-terminal 的活动面 rename；assembly 只接五个 adapter、platform-ports、sample-console，并填满十个必填 PlatformPortBindings。persistKv/device 使用 CP-7 已实现部分，其余按 v13 unavailable。native 双屏 adapter 的 carrier 绑定、启动接线与相关入口接入必须等 D-6 收口后再做；不能以端口表已完成为 native 接线完成。

### 不允许

不在 assembly 判断屏数、读取 terminalSurfaces、写宿主 bootstrap、引入 display-context、构造业务命令或模块。native host 启动、Activity 与 launch options 均由 adapter 所属实现。

## 11. CP-9：Web 第一段验收

### 顺序

1. 先运行静态门、类型、各 package focused tests；
2. 确认 S/P focused 测试实际收集，baseline 全绿；
3. 运行场景 1–9、S-1 至 S-26 中适用于 Web 的判据及 active mechanical P；
4. 验证 Web refresh 持久化；
5. 对每条 red mutation 运行 baseline/control 与 negative；
6. 产出 Web business 与 cleanup 分开的结果；本阶段不启动真机、不把 Web 双屏称为 native PASS。

### Web 第一段的 S-7b 显式落点

S-7b 必须在 Web 第一段分别走双屏与单屏路径，不以“取消后回表单”一个断言代替两种语义：

1. 双屏路径：先由真实 assembly 与双屏 binding 进入 `waiting-confirm`，再制造被拒结果；断言 `waiting-confirm` standard layer 与 `registry-notice` alert layer 同时在场、alert 排在 standard 之后，并断言 SECONDARY 回到 `customer-member.preview`，而非 `customer-welcome` 或无内容；
2. 单屏路径：由全 unavailable binding 进入单屏 confirm，再制造被拒结果；断言 PRIMARY 回到 `member-form`、无 SECONDARY 树/内容，且不存在双屏 waiting/preview 的残留；
3. 两条路径各自保留 production red vector：双屏分别以 production 的拒绝路由改回 `customer-welcome`、或把 `registry-notice` 排到 `waiting-confirm` 前的变更证明副屏回预览与 alert-after-standard；单屏以 production 的拒绝回退改成 `customer-member.preview`／保留 SECONDARY 内容的变更证明回表单与无副屏。每个 mutation 都必须让对应 focused proof 变红，夹具固定，mutation 只改 production。

### Web 不代证

S-27、S-28、S-29 只能在 CP-10 且 S-27 另需 D-6 收口；S-16 的真实 device 路径、S-12 的 native MMKV、场景 4–8 的 native 双屏路径不能用 Web 替代。S-25 仅 Web。

## 12. CP-10：真机第二段验收

仅在 CP-9 Web 适用项全绿、D-6 已由单独授权的真机 spike 收口、CP-8 的 native 双屏接线已完成、且具备本段受管真机授权后执行：

1. 记录并检查受管运行资源与日志；
2. 启动 Android 真机双屏；
3. 分别运行 S-27、S-28、S-29，保留 first failure、last known good、broken boundary；
4. 复验 S-12、S-16、S-17、S-24 和场景 4–8 中涉及真实 adapter 的路径；
5. cleanup 必须独立 PASS；不把真机结果包装成 DEV/L2/UAT。

如果发现第二 VM/进程、屏数值不一致、launch rollback 失败、MMKV 读取类型变化或 cleanup 失败，停止并保留日志，不延长 timeout 或盲目重试。

## 13. CP-11：全批对账与交付

### 全量对账

用 v13 requirements、IA、interaction、implementation design、project-memory 命中规范、当前 owning source 和所有 evidence，逐项重读行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界。重新核对九项 module、六 sample package、三个 adapter、两个公共面、31 S、14 active P，并确认 D-6、S-27 第六项与七条依赖没有被旧形态覆盖。

### 设计/实现后回答

实施后才回答 W-1：一次业务动作的三跳/四跳是否过重；W-2：clearLayers 单 displayMode 是否造成真实负担。不能在本计划中预先报结论。

### 交付条件

- Web 与真机段按适用范围分别证据化；
- 每条 active S 与机械 P 有 control green、negative red；业务行为与生产源码约束使用 production mutation，纯静态 AST 的 P-5d 使用一次性临时 fixture mutation 并另证当前生产树清洁；
- P-5b/P-7/P-8/P-9 有逐条人工 review，不被机械门替代；
- 五种 fallback、双 Provider、selector identity、module-bound variable reader、true catalog chain 有实际 focused output；
- Android feasibility、真实 device、MMKV、cleanup 边界明确；
- 只有满足全部批准条件后才可把设计/实施结果交 Dexter 和 Claude；本计划本身仍不是实施授权。

## 14. 计划状态

~~~text
PLAN_STATUS=SUPERSEDED_BY_TWO_SEGMENT_PLAN_FIRST_SEGMENT_IN_PROGRESS
IMPLEMENTATION_AUTHORITY=true（范围由 2026-09-04 两段执行计划限定）
L2_SCRIPT_ADMISSION=BLOCKED
~~~
