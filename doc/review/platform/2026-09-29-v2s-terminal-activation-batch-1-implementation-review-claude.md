# 终端激活与长连接 · 批次一实现静态评审（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=1/3/5
L1_ENGINEERING=findings：M-1、S-1、S-2、S-3、N-1～N-5
L2_USER_VISIBLE=PASS：批次一唯一的界面改动 TER-E01（编辑态设备类型只读）与交互工件覆盖段一致；动作 1-A 抽出的其余事实属门店终端批既有内容，不在本批
L3_UNVERIFIED=见 §5
SAME_ROOT_SCAN=见各 finding 的「同族全集」
DESIGN_GAPS=见 §4
TEMPLATE_COVERAGE=NOT_APPLICABLE：本轮是实现评审，不是设计评审
EVIDENCE_TIER=STATIC_SOURCE_ONLY：本会话只读源码与文档，没有运行构建、测试、生成器或任何受管运行；文中引用的动态结果全部来自 Codex 的记录，未独立复核
REVIEWER=Claude 主会话；续接会话，从 v2s 仓根发起，不是 fresh 会话；按 Dexter 对本批的指示「不要子agent盲审了，全都由你来审」，未派子 agent
```

## 1 · 这项工作解决什么问题，解决了没有

**问题**：门店终端此前只是一条规则，没有 owner 把物理设备绑定到这条规则上，也没有服务认证设备的长期凭证、维持长连接，或者在取消激活时把设备踢下线。批次一要在服务端把这条链路建起来：激活、设备主动取消、后台取消、绑定读回与审计、单节点 TDS 认证与会话、撤销通知，以及设备类型创建后不可改（D-18）。

**服务端的逻辑基本解决了**。静态核对的结论如下：

- 激活拒绝顺序与 R-1.4 的 1～9 项一一对应，见 `TerminalBindingOwnerService.java` 第 286～308 行。
- 同一次操作的重试按 R-1.6 直接应答首次结果，不重新校验，见第 60 行与第 316～321 行。
- 最近一个已结束代次的摘要只用于判「本次激活已失效」（D-38），见第 304～306 行。
- 凭证判定与 R-4.7 及 D-40 一致：绑定已结束时不比较 `deviceId`，见 `TerminalCredentialDecision.java` 第 12～34 行。
- 迁移用检查约束保证绑定结束时 `bound_device_id` 必为空，与 D-40 的「不必保留」一致，见 `V20260926_000000_000__terminal_binding_owner.sql` 第 32～35 行。
- 激活、作废、停用之间靠终端行锁串行，逻辑上满足 R-1.9。
- 后台取消只在成功时写回执；被拒请求重放时按当时状态重新判定，符合 R-3.2。
- 作废导致的解绑记在执行作废的运营人员名下，符合 R-3.6。
- D-18 的实现：后端 `ReplaceCommand` 不含设备类型，edge 的 `strictBody` 把多余字段当未知字段拒绝，前端编辑态只读展示。
- D-41：`contracts`、`scripts`、`tools` 里已找不到 catering-all-v2 的引用，两个读取器都有越界守卫（抽查）。
- D-42 与 D-43 的契约改动已落进 `contracts/protocol/terminal-connection-protocol.json`。

**没有证明解决的**：需求与详设把 TDS 的一批核心行为定为「真实 WebSocket 受管验收」，包括未认证上限、心跳超时、会话取代、状态写入、写库节拍、优雅下线和日志不泄密。实现里这些没有对应的验收场景，见 M-1。交接材料写的「TDS CONTRACT 39/39、backend-acceptance 195/195」只统计已实现的场景，不能证明这部分。

**业务上的可用程度**：设备侧客户端属于批次二，运营后台本期也不展示激活状态、不提供取消按钮（R-3.2、R-3.7 写明本期只做接口）。所以批次一交付后，真实设备还不能走完激活到连线的全程，这是计划内的安排，不算缺陷。

## 2 · 方案合理性

- **问题对不对**：对。批次一只做服务端与门店终端，边界与需求 §1.1 一致。
- **方案优不优**：
  - owner 划分合理：terminal-binding 与 store-terminal 分开，TDS 只依赖窄的核验 API。
  - 复用做得对的地方：回执序列化、咨询锁、审计写入与读取都用了 foundation 与 audit SPI。
  - 过度的地方：
    - 这批的测试投入明显偏向边角与竞态控制：手写 Node 线路客户端、两个 Unix socket 计时闸门、V-S14 线路场景。基础行为反而缺了验收场景（M-1）。
    - 同一条凭证格式在三处各写一份解析（S-1）。
    - 两个一模一样的限流类（N-1）。
    - 自写的异步日志层（N-2）。
- **代价配不配**：TDS 生产代码约 4,000 行，另有约 2,100 行 TDS 验收执行器和 1,100 行手写客户端，承载的是单节点认证、心跳与撤销。Dexter 已裁定保留 WebFlux 与 Reactor Netty 底座（D-42 之前的讨论），本评审不再质疑底座。
  - D-42 之后，协议层里有一部分代码只服务已删除的判据（N-5）。按 Dexter 的安排，这部分放到交付后清理。

## 3 · Findings

### M-1 · 详设声明为受管验收的一批 V 判据没有实现

- **详设位置**：
  - 详设 §11 判据映射第 547～557 行：V-S1、V-S3、V-S4、V-S6、V-S8、V-S9、V-S11 的档位都写作 `backend-acceptance / B1`。
  - 第 533、538、539、545 行：V-B1 的留痕搜索、V-B6、V-B7、V-B13。
  - 计划 §5 第 99、100、102、105、107 行：丢失响应后的重试、两实例并发、客户端先断、心跳超时与 N/N+1、泄密搜索，都指定为验收夹具。
- **实现与测试位置**：
  - `BackendAcceptanceTest.java` 第 759～853 行只驱动这几组 TDS 场景：拓扑预检、V-S2 认证拒绝、V-S10 撤销竞态、V-S14、D-43 未知字段、V-S12。
  - `scripts/test/terminal-ws-wire-client.mjs` 第 158～215 行的场景集合里，没有 NODE_BUSY、心跳超时、会话取代、优雅下线的场景。`NODE_BUSY`、`HEARTBEAT_TIMEOUT`、`REDIRECT_TO_NEXT_NODE` 只出现在允许的关闭原因清单里，见该文件第 24～33 行，以及 `TerminalConnectionContractScenarios.java` 第 91～95 行。
  - `StoreTerminalAcceptanceScenarios.java` 里没有任何锁存器、屏障或第二实例端口的用法（`secondBusinessPort` 在该文件出现 0 次）。第二业务实例只在拓扑探测里读了一次公开接口，见 `BackendAcceptanceTest.java` 第 766 行。
  - V-B13 只做了「门店停用后同一秘密重试」这一种，见第 466～473 行。没有做「丢失成功响应后重试」「换地址重发」，也没有做「终端停用、集团空间停用后各重试一次」。
  - 没有任何对日志、审计、回执、数据库的「先写标记、证明可搜、再断言秘密不可搜」扫描。现有只检查 HTTP 应答里不回显秘密，见第 316～325 行与第 411～422 行。
  - TDS 模块测试里没有启动真实服务器的测试，全部是单元测试。
- **性质**：事实。依据是以上源码中的场景清单、入口和检索结果。
- **同族全集**：这 13 项判据均已逐一核对（均为批次一，均声明为受管验收）：
  - 缺失：V-S1（未知字段一例除外）、V-S3（未知字段一例除外）、V-S4（旧凭证已作废的那一例除外）、V-S6、V-S8、V-S9、V-S11、V-B1 的留痕搜索、V-B6、V-B7；
  - 部分缺失：V-B13；
  - 已有场景：V-S2、V-S5（在 V-S10 的只改状态探测里）、V-S10、V-S12、V-S14。
- **影响**：
  - 以下行为只有单元测试或完全没有测试，交付结论不能覆盖它们：
    - 未认证上限；
    - 心跳超时关闭的时间窗；
    - 同终端第二条会话取代第一条；
    - 失败的第二次认证不影响现有会话；
    - 客户端先断时不登记会话；
    - 最新状态的时间字段；
    - 写库节拍的上界；
    - 优雅下线的顺序；
    - 秘密不进日志；
    - R-1.9 的多实例并发保证。
  - 整批 6b 对账记为 MATCHED，却没有发现这一缺口。
- **最小可验收修正**：按详设 §11 与计划 §5 补齐这些场景，每条判据至少一个真实 HTTP 或 WebSocket 场景，结果进 CONTRACT/BUSINESS。
  - 如果某条要降档为单元测试，必须由 Dexter 裁决并写回详设。
  - 验收判据：每条判据都能指到一个场景 id，而且该场景在受管运行里通过。
- **需 Dexter 裁决**：照详设补齐，不需要。要删减或降档，需要。
- **分类**：CONFIRMED。

### S-1 · 设计要求的「唯一终端凭证解析器／凭证上下文」没有落地，同一格式在三处各写一份

- **详设位置**：
  - 详设 §2 CP-03（第 74 行）的产出含 `TerminalCredentialContext`；
  - §9b「Operation context」行（第 385 行）要求「distinct terminal credential context with exactly one resolver」；
  - §5 规定了 `<generation>.<secret>` 的解析规则。
- **实现位置**：
  - `terminal-data-server/.../protocol/TerminalConnectionFrameCodec.java` 第 24 行与第 130～154 行；
  - `terminal-binding/.../application/CancelTerminalActivationOperation.java` 第 40～81 行：这里在 owner 模块的 application 层解析 HTTP `Authorization` 头；
  - `app/edge/terminal/ActivateTerminalOperation.java` 第 71～87 行：秘密解码。
  - 仓里已有生成的 `TerminalCredentialCommandContext`，在 `contracts/registry/generated/operation-handler-bindings/.../TerminalBindingOperationBindings.java` 中，但没有任何代码使用它。
  - 集团空间编码的格式在本批新写了 4 份：
    - `TdsWebSocketHandler.java` 第 42 行；
    - `TerminalBindingOwnerApi.java` 第 241～246 行；
    - `TerminalCredentialVerificationApi.java` 第 94～99 行；
    - `ActivateTerminalOperation.java` 第 94～97 行。
    - 它的 owner 是 `modules/workspace/.../WorkspaceAdministrationService.java` 第 362 行。
- **性质**：
  - 三处重复是事实。
  - 当前三份的行为是否一致：静态看等价（都拒绝前导零、都做 canonical 回编码比较）。
  - 以后是否会漂移是推论。
- **同族全集**：凭证格式 3 处、秘密解码 2 处、集团空间编码 4 处，已全部列出；仓内没有第四个凭证解析点。
- **影响**：
  - 安全相关的格式有三个住址，违反后台规范 §2-E 与详设的「唯一 resolver」。
  - owner 模块解析 HTTP 头，违反 §2-0 对 `application` 段的职责定义。
- **最小可验收修正**：凭证格式只保留一个纯 Java 解析点，TDS、设备取消、激活都调用它；`Authorization` 头按详设在 edge 解析为终端凭证上下文。
  - 验收判据：`rg` 检索凭证正则与 Base64URL 解码，只剩一处定义。
- **需 Dexter 裁决**：否。
- **分类**：CONFIRMED。

### S-2 · D-43「接收方忽略未知字段」被 TDS 的 JSON 解析限额架空

- **需求与详设位置**：
  - R-4.9 的目的是「以后给某种消息加字段，不需要先升级另一端」；
  - 同一条又写了「JSON 解析的限额不变」。
- **实现位置**：`TdsWireJsonConfiguration.java` 第 15～20 行：整条消息最多 32 个 token、嵌套深度 2、字符串 128 字符、字段名 64 字符。
  - 现有 AUTHENTICATE 约 12 个 token，PING 约 10 个，剩余余量约 10 个简单字段。
- **性质**：
  - 限额数值是事实。
  - 后果是推论：以后给认证或心跳加一个十来项的数组、一个超过一层的对象，或一个超过 128 字符的字符串，未升级的 TDS 就会以 4000/UNKNOWN 关连接，设备随之无限重连。这正是 D-43 要避免的情况。
- **根因**：R-4.9 那句「限额不变」是 Claude 写的，与同条的目的冲突。实现照字面执行，没有错。
- **最小可验收修正**：
  - 需求侧由 Claude 改为「解析限额从消息大小上界推导，为后续字段留出余量」；
  - 实现侧相应调整限额，并加一例：在 64 KiB 以内新增数组、嵌套对象和长字符串字段，仍然照常处理。
- **需 Dexter 裁决**：否。这属于 D-43 已批准的意图。
- **分类**：CONFIRMED。

### S-3 · 日志泄密门没有扩到 terminal-binding 与 TDS

- **详设位置**：
  - §3「Logging and secrets」行（第 97 行）：检查根要扩到 `catering-business-server/modules/*/src/main` 与 `terminal-data-server/src/main`；在 terminal-binding 与 TDS 各放一个红夹具，`scripts/verify --validate-only` 必须失败；
  - §12 的门台账有同样要求。
- **实现位置**：`tools/verify-gates/cli.mjs` 第 1326～1331 行，`logging()` 仍只扫 `apps/backend/catering-business-server/src/main`、两个前端和 `libraries`。
- **性质**：事实。
- **同族全集**：处理凭证的新代码在 terminal-binding 与 TDS 两处，都不在扫描根里。
- **影响**：凭证只在这两处被处理，而它们既没有被静态门覆盖，也没有 M-1 所说的动态留痕扫描。
- **最小可验收修正**：按详设扩根并补两个红夹具。
  - 验收判据：两个红夹具在两种 verify 模式下都以指定标记失败。
- **需 Dexter 裁决**：否。
- **分类**：CONFIRMED。

### N-1 · 两个逐字相同的限流类

- **位置**：`session/TdsTrackedSessionLimiter.java` 与 `websocket/UnauthenticatedConnectionLimiter.java`。两个文件除类名和异常文字外逐字相同。
- **判断**：JDK 的 `Semaphore.tryAcquire`/`release` 能直接满足；按后台规范 §2-E，「逐字节相同 ⇒ 抽」。
- **分类**：CONFIRMED。

### N-2 · 自写异步日志层；注册路径里有一次多余的调度跳转

- **异步日志**：`observability/TdsAsyncLog.java` 与专用的 `tds-log-worker` 调度器，把 TDS 全部日志调用包成 lambda 投递，并自己计数丢弃条数。
  - 这与仓内其他模块直接用 SLF4J 的写法不同。
  - Logback 自带的 AsyncAppender 有有界队列、不阻塞选项和丢弃策略。
  - 自写的起因是需求 V-S8「事件循环上一出现阻塞即判失败」配合零放行名单。
  - 建议交付后评估：改用 AsyncAppender，加一条经评审的放行项。
- **注册路径**：`TdsTerminalSessionActors.java` 第 340～347 行，在持有终端监视器、刚写完库之后，把一次简单的 JSON 序列化投到 codec 调度器，再 `block(1s)` 等它回来。这多一次线程切换，也多一种超时失败；在当前线程直接序列化即可。
- **分类**：CONFIRMED。

### N-3 · 后台取消的授权凭据被复制一份，需求号与能力键硬编码进 owner

- **位置**：
  - `TerminalBindingOwnerApi.java` 第 151～181 行的 `OperationsCancelGrant`，复制了 `organization.api.OperationsOwnerScopeGrant` 的匹配逻辑；
  - 同样的字符串也写在 `OperationsStoreTerminalActivationCancellation.java` 第 20～21 行，以及 `StoreTerminalOwnerService.java` 第 923～936 行。
- **根因**：授权凭据这个平台类型放在 organization 模块，而详设不允许 terminal-binding 依赖 organization。
- **判断**：需要设计侧决定把它移到允许依赖的平台模块（例如 execution-context），或接受这份复制；见 §4 第 4 条。
- **分类**：CONFIRMED。

### N-4 · 死代码

- `TerminalConnectionProtocol.java` 第 44～52 行把 `additionalFieldsAllowed` 恒设为 true（契约只允许写 `ignore`），所以 `TerminalConnectionFrameCodec.java` 第 123 行那个分支永远走不到。
- `StoreTerminalOwnerService.java` 第 69～71 行，替换审计的允许字段里仍有 `deviceType`；D-18 之后这个字段已不可能变化。
- **分类**：CONFIRMED。

### N-5 · D-42 之后只服务已删除判据的代码（交付后清理）

- 这些代码现在只服务已删除的判据：
  - `TdsPmdOfferGate` 对格式不对或重复提议的逐条处理；
  - `TdsWebSocketPipelineInstaller` 里的 1009 原因改写；
  - `TdsReservedBitsGate` 的原因文字映射；
  - 手写 Node 客户端里构造违规帧的能力。
- 它们仍然满足放宽后的要求，不阻断交付。Dexter 已安排交付后评估改用 Reactor Netty 自带的压缩开关。
- **分类**：CONFIRMED。

## 4 · DESIGN_GAPS

1. **R-4.9 的解析限额与向前兼容冲突**：见 S-2，需求 owner 是 Claude。
2. **TDS 数据库并发没有判据**：
   - 未认证准入上限 N 按内存推导；
   - 数据库工作线程是 N+2（`TdsSettingsConfiguration.java` 第 27～31 行）；
   - 连接池没有配置，用的是默认值（`application.yml` 只配了超时），监听还独占其中一条连接；
   - 详设没有把 N 与连接池、断线重连潮时的认证排队联系起来。
3. **面向设备的 HTTP 接口是否也要宽容未知字段**：激活与设备取消由生成的反序列化器拒绝未知字段（`TerminalActivationRequest` 的 `unknown property` 分支）。D-43 只覆盖 WebSocket 帧。设备升级不同步时，HTTP 接口会遇到同样问题。需 Dexter 裁决。
4. **授权凭据类型的位置**：见 N-3。

## 5 · 未验证清单

- **静态已证**：
  - 激活拒绝顺序与重试语义；
  - R-4.7 与 D-40 的判定；
  - 事务与锁顺序；
  - 审计的五种原因与操作者；
  - 迁移约束；
  - D-18 的前后端实现；
  - D-43 的解析逻辑；
  - D-42 的契约改动。
- **测试已证（仅引用 Codex 记录，本评审未复跑）**：
  - backend-acceptance 195/195、TDS 39/39、V-S14 9/9；
  - Browser L2 6/6；
  - reset、DEV readiness 与完整 seed 通过。
  - 仓库默认 `scripts/verify` 的最近一次记录停在 THCL-04，失败在批次外的 TER Android 测试；当前字节未复跑。本评审不把它归因给批次一。
- **无人验证**：
  - 设备多时，TDS 能否把第 N+1 个连接拒为「节点繁忙」；
  - 设备停止心跳后，会不会在规定时间窗内被断开；
  - 同一终端再连一次时，旧连接会不会被替换；
  - 节点下线时，现有设备会不会被有序地请去连其他节点；
  - 凭证和激活码会不会出现在日志、审计或回执里；
  - 两台业务实例同时收到激活请求时，是否只成功一个；
  - 本批 §12 门台账的其余项，本评审只抽查了日志门与 D-41。

## 6 · Codex 核验重点逐项结论

1. **激活重试、D-40、D-38、owner、事务、审计**：逻辑正确；验收只覆盖了一部分（M-1 中的 V-B6、V-B7、V-B13）。
2. **owner 边界与迁移**：正确。TDS 只依赖 terminal-binding 的窄 API，但运行时类路径含整个模块，与详设「only terminal-binding API」的措辞不完全一致，不影响行为。
3. **首帧认证、未知字段、大小上界、压缩、会话取代、监听重连、停库、下线、状态写入**：代码层面符合；解析限额见 S-2；会话取代、下线、状态写入缺验收（M-1）。
4. **终端类型只读、R-12 生成与验证门**：终端类型只读已实现；日志门未扩（S-3）；其余门未逐项核完。
5. **D-41**：抽查通过。
6. **真实验收拓扑**：两个业务上下文和独立 TDS 进程都在，但终端场景从未使用第二个实例（M-1）。
7. **判据缺失或冲突**：见 §4。
8. **默认 verify 残留**：已按批次外处理，不归因。

## 7 · 与项目记忆、规范、foundation 的符合性

- **重复造轮子**：
  - 凭证解析 3 份，集团空间编码 4 份（S-1）；
  - 限流类 2 份（N-1）；
  - 异步日志层（N-2）；
  - 授权凭据复制（N-3）。
- **各写一套、与其他模块写法不同**：
  - owner 模块解析 HTTP 头（S-1）；
  - TDS 的日志写法（N-2）；
  - 两个新的设备操作类都没有放在既有的 `<owner>/application/operations` 位置：一个在 edge 的 `terminal` 包，一个在 terminal-binding 模块内。
  - 其余与既有模式一致：模块目录四段、审计 SPI、回执、手写 controller 与 problem 映射。problem 码仍用字符串，这是全仓既有做法，不算本批问题。
- **前端与 foundation**：本批前端只改了 TER-E01；使用了 foundation 的 `testId` 与 `createContentIdempotencyKey`，没有自写 primitive。

## 8 · 授权边界

本评审只做静态审查：不授权再次运行动态验收、修改代码、部署、DEV、reset、seed、L2、UAT，也不涉及批次二与批次三。M-1 若选择删减或降档，需 Dexter 裁决。S-2 的需求改动由 Claude 在获得 Dexter 同意后执行。
