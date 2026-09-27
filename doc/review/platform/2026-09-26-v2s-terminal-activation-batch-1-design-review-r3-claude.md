# 终端激活与长连接 · 批次一详设与实施计划第 3 轮复评（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=1/3/3
L1_ENGINEERING=findings：R3-M1、R3-S1～R3-S3、R3-N1、R3-N2
L2_USER_VISIBLE=D-18 与 E01 只读观测已在 IA、交互工件、详设 §3a 一致（R2-N7 关闭）；残留 R3-N3（交互工件表格缺一格）
L3_UNVERIFIED=见 §8
SAME_ROOT_SCAN=每条 finding 下的「同族」
DESIGN_GAPS=R3-M1（登记竞态在真实环境下怎样确定性复现）
TEMPLATE_COVERAGE=见 §7：各节均已具备
EVIDENCE_TIER=STATIC_SOURCE：仓内源码与文档逐行核对；外部事实取上游按版本标签的源码与 Maven Central 发布物；零运行
```

**评审对象（冻结时的 SHA-256 前 16 位；完整值在会话临时目录的 SHA256SUMS 中）**

| 文件 | SHA-256 前 16 位 |
|---|---|
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`（928 行） | `ba5e0e5cf2ea0528` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`（140 行） | `6f6953bf6771c85d` |
| `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`（118 行） | `e2703b1325ad6893` |
| `contracts/protocol/terminal-connection-protocol.json`（130 行，本轮新增） | `843742a66a9085dd` |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `549ca1e7ab125cb4` |
| `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` | `605bdea0db884d73` |
| `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md` | `724965c59ae8fec2` |
| `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-r2-finding-intake-codex.md`（作者 intake，只作挑战对象） | `24a7182ee032e0dd` |

**评审方式**
- Dexter 已要求同一批次的复评不再派子 agent，本轮仍全部由 Claude 主会话完成，没有独立子 agent 的结论。
- 用第 2 轮冻结的副本与当前字节做了全文比对，逐段列出改动；上轮之后，代码目录没有任何改动。
- 先按源码与上游资料形成判断，再读 Codex 的 intake 逐条对照挑战；intake 里的「已处置」只作声称。
- 关于 R2-N2：Codex 转述「Dexter 已裁决 R2-N2：必填键，缺失或无效时在 readiness 前启动失败」。本会话没有见到原话，按转述记录。

## 1 · 结论与方案合理性

**又前进了一大步，但 R2-M2 的修法引出了一个新的 M。**
- 第 2 轮的 15 条里，12 条关闭，R2-M2 的四项也都解决了。解决方式是 TDS 改成单独受管的进程，这是对的选择。
- 余下 2 条部分关闭：R2-S1、R2-S3。
- 但这一改动让 TDS 离开了验收 JVM，原来依赖的登记栅栏在验收里不再可用。设计于是把 V-S4、V-S10 的登记竞态挪到一个既没有数据库、也没有业务后端的隔离测试 JVM，需求要求的真实环境证明因此落空（R3-M1）。
- 另有三个 S：
  - 「违规 RSV 位 → 1002」没有执行组件（R3-S1）；
  - 验收客户端 undici 产生不了 V-S14 需要的帧（R3-S2）；
  - Q15 的两处红夹具按所写方式观测不到（R3-S3）。

**问题对不对**

对。压缩现在由服务端在应答里单方面带上两个无上下文参数，RFC 7692 允许，OkHttp 与 undici 的默认报价也能拿到压缩，D-37 的实际效果保住了。验收场景规范退回只定义 HTTP，改成 decision 接受后再修，顺序也对了。

**方案优不优**

- 单独的 TDS 进程一次解决了版本、应用类型、ArchUnit、事件循环四个同源问题，优于上一版的同 JVM。
- 代价是失去了进程内栅栏。设计选的替代是「隔离 JVM 加桩」，这比失去栅栏更差：它把需求定在真实环境的竞态判据降成了模块测试，还与计划第 86 行「测试不得直接写绑定状态或手工 NOTIFY」冲突。
- 可供作者评估的方向（不是规定）：
  - 让受管 TDS 进程在验收专用配置下启用那个生产接缝，并按 R-READ-10 声明覆盖边界；
  - 在 TDS 与数据库之间放一个可扣住凭证查询应答的代理。
- 选哪条由作者比较；判据见 R3-M1。

**代价配不配**

- §3a 的 67 行已逐行对上定位绑定 JSON，§12 新增了未决项表，都是有用的补充。
- 新加入两种 verify 模式的 `r5-edge-materialize --check` 每次都会复制整个仓库，而它与 openapi-contracts 走的是同一个投影帮助函数，耗时与独有价值要一并衡量（R3-N2）。

## 2 · 第 2 轮 finding 逐条状态，并对照 Codex intake

| 编号 | 状态 | 依据（当前字节） | 对 Codex intake 的判断 |
|---|---|---|---|
| R2-M1 | CLOSED（设计层面） | 详设 §12.3 第 844、849 行、计划第 113–116 行：标定前普通静态验证预期停在 openapi-contracts；budget 无关的静态证明在 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY` 下完成；与预算有关的红夹具标为 `DEFERRED_UNTIL_CP05`；标定的进入条件写明。`tools/verify-gates/verify.mjs` 第 194–198 行以 `env: {...process.env}` 启动子命令，这个环境变量能传到 edge-codegen（`backend-performance-budget.mjs` 第 414–416 行）。Q5 改成不区分大小写后命中 `edge-codegen.mjs`（已复跑） | 同意；Q5 清单有一处路径笔误，见 R3-N1 |
| R2-M2 | CLOSED（四项均已处置） | 单独的 TDS 进程（详设第 74、421、478 行，计划第 30 行）；TDS 专用的 Reactor BOM 2025.0.7 覆盖，只作用于 TDS（第 34 行，decision 第 31 行）；显式 `WebApplicationType.REACTIVE`；业务 ArchUnit 只扫业务产物；WebSocket 客户端在单独的 Node 进程里。Maven Central 上 reactor-bom 2025.0.7 锁定 reactor-core 3.8.7、reactor-netty-http 1.3.7、reactor-pool 1.2.7，netty-codec-http 4.2.17.Final 已发布 | 同意四项已处置；但这个修法引出了 R3-M1 与 R3-S2，intake 没有看到 |
| R2-S1 | PARTIALLY_CLOSED | Q15 按原样复跑，得到同样 6 处；六处各有处置行（第 835–840 行）；终端 edge 包纳入 edge 互不依赖规则（第 64、810 行） | 部分不同意：第 836、837 行的红夹具按所写方式观测不到，见 R3-S3（intake 自己也点到了 contract-face） |
| R2-S2 | CLOSED | 原始 Netty 管线上的 `TdsPmdOfferGate` 在 HttpCodec 之后、ReactiveBridge 之前改写原始请求头，给三类 PMCE 报价加上两个无上下文参数（第 36、282 行；协议正本第 95–116 行）。Reactor Netty 1.3.7 升级时复制的正是原始 Netty 请求头（`WebsocketServerOperations.java` 第 112–117 行），加上参数后 Netty 4.2.17 握手器会同时启用两者（`PerMessageDeflateServerExtensionHandshaker.java` 第 298–358 行）；RFC 7692 §7.1.1.1、§7.1.1.2 允许 | 同意 |
| R2-S3 | PARTIALLY_CLOSED | deflate-frame 改在原始请求头上过滤（可行）；契约不再承诺 JSON PING/PONG 不压缩；协商后压缩的首帧先解压再校验；V-S14 加入 deflate-frame 单独与混合报价 | 不同意「未协商 RSV1 与控制帧 RSV1 关闭 1002」已处置：原生管线不做这件事，设计没有执行组件，见 R3-S1 |
| R2-S4 | CLOSED | 摘要冲突改为已有的 500 `PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION`，不新增码，也不扩 R-1.4（第 269、385 行） | 同意 |
| R2-S5 | CLOSED | terminal-binding 的允许依赖与禁止依赖写明（第 64 行，decision 第 31 行）；`ActivationCandidate` 归 terminal-binding；TDS `runtimeClasspath` 的排除项由依赖报告断言（第 522 行） | 同意 |
| R2-N1 | CLOSED | 4×64 KiB 加约 256 KiB deflate 状态、约 39 KiB inflate 状态，合计约 551 KiB；每连接逻辑上限 1 MiB，余量也要纳入证明（第 40、286 行） | 同意 |
| R2-N2 | DEXTER_DECISION（已落实） | 必填键、范围 1..2,147,483,647、缺失或无效在 readiness 前失败；N 按公式 `floor((RSS budget - baseline RSS)/(1 MiB + E))` 求出，再受文件描述符与入口限制约束，在第一次受管启动前记录；没有臆造数值（第 42、521 行，计划第 29 行） | 同意 |
| R2-N3 | CLOSED | AGENTS.md 改为第 44、48、56 行，第 83 行的说法改正；app-layout ADR 不再用整篇的一级标题锚点；验收场景规范退回只定义 HTTP，写明 decision 接受前不改（decision 第 91、99、108 行，规范第 80–81 行） | 同意 |
| R2-N4 | CLOSED | reset/seed 改为 D-34 的进入条件（计划第 119 行，详设第 449 行） | 同意 |
| R2-N5 | CLOSED | 计划与详设同为四个具名调度器（计划第 29 行，详设第 44 行） | 同意 |
| R2-N6 | CLOSED | §3a 改为逐行九列：66 行动作与 `contracts/policy/store-terminal-l2-scenarios.json` 六个 case 的动作键逐项一致，每行的 testId 或模板、实际节点、静态证明、交互类型与 `store-terminal-l2-locator-bindings.json` 逐项一致；E01 只读观测单列一行，不进动作绑定。§4 有不变量、FORBID、RECALL；§10b.6 写 D-34 前提；§12 有未决项表 | 同意 |
| R2-N7 | CLOSED | IA 第 82 行、交互工件第 402、411 行声明 `TERMINAL_DEVICE_TYPE_READONLY` | 同意；表格格式问题见 R3-N3 |
| R2-N8 | CLOSED | 运营面取消激活只保留 `requireStore` 先行的 403，去掉到不了的码（第 266、269 行） | 同意 |

回归核对：R-1.6 与 D-38 的唯一判定点与顺序没有变（第 292、319、338 行）；decision 仍为 `status: PROPOSED`、`acceptedBy: null`、`implementationAuthority: false`，全文没有写成已接受。

## 3 · 本轮 findings

### R3-M1 登记竞态被挪到一个既无数据库、也无业务后端的隔离 JVM，需求要求的真实环境证明落空（R2-M2 修法引出）

- **位置**：详设第 79、410、418、421、453、499、505 行；计划第 30、86 行。需求 §4.2 标题（需求第 596 行「TDS（backend-acceptance，真实 WebSocket）」）、V-S4（第 618–626 行）、V-S10（第 652–657 行）。
- **性质**：仓内事实（文本比对）加推论。
- **证据**：
  - 第 418、421 行：`SessionRegistrationGate` 的栅栏实现只在 `terminal-data-server/src/test`，运行于单独的 TDS 测试 JVM，验收里不注入。第 410 行称它为「isolated focused TDS test JVM」，第 79 行把 focused 定义为「不带受管运行的模块测试」。所以这个 JVM 里既没有 PostgreSQL，也没有业务后端。
  - 第 505 行 V-S10 却要求在这个 JVM 里「扣住认证结果，同时让取消激活提交」。需求 V-S10 竞态要求设备取消激活、后台取消激活、终端作废、同一设备再次激活四种事件各发生一次，都是业务后端的命令；「真实的凭证核验」也要查数据库。计划第 86 行又禁止测试直接写绑定状态或手工 NOTIFY。
  - 第 499 行 V-S4 仍写「用 `SessionRegistrationGate` 证明客户端已关闭的连接不登记」，执行面是 focused 加 backend-acceptance。但验收里的 TDS 是生产进程，绑定的是 `ImmediateSessionRegistrationGate`，没有栅栏。
- **影响**：「已作废的凭证不会留下在线会话」是这条功能的核心安全性质，它的真实环境证明没有可执行的写法。实施时只剩三条路：自造钩子、违反计划直接写库、把判据降级。
- **验收判据**：
  - 对 V-S4 第三点与 V-S10 竞态，写明执行环境：真实 TDS 进程、真实 PostgreSQL、经 HTTP 的真实业务命令；
  - 写明在「凭证核验结果已返回」与「会话登记」之间确定性扣住的手段，不直接写绑定状态、不手工 NOTIFY；若用生产接缝，按 R-READ-10 声明覆盖边界；
  - 反例：一个在检查已观察到的作废之前就登记会话的 TDS，这两条判据都必须失败；
  - 若作者主张在更低一档的环境里证明，就是需求修正，要写明理由，标为 DEXTER_DECISION。
- **Dexter 裁决**：只在作者主张降级时需要。

### R3-S1 「违规 RSV 位 → 1002」在原生管线上不会发生，设计没有执行组件（R2-S3 的残留）

- **位置**：详设第 38、280、282、508 行；协议正本 `contracts/protocol/terminal-connection-protocol.json` 第 73–81、117–121 行；decision 第 76 行；计划第 29 行。
- **性质**：外部事实（上游按版本标签的源码）。
- **证据**：
  - Reactor Netty v1.3.7 `WebsocketServerOperations.java` 第 96 行以 `allowExtensions=true` 创建握手工厂。Netty 4.2.17 `WebSocket08FrameDecoder.java` 第 196–197 行只在 `!config.allowExtensions()` 时检查 RSV 位；控制帧的检查（同文件第 207–231 行）只查分片、载荷长度、保留操作码、close 载荷，不查 RSV。
  - `PerMessageDeflateDecoder` 只处理协商后带 RSV1 的数据帧。所以未协商时的 RSV1 数据帧（含首帧）、任何控制帧上的 RSV1、以及 RSV2/RSV3，都会原样继续往下走。
  - 设计里的 `TdsPmdOfferGate` 只处理握手请求头，没有点名在帧层执行这三类 1002 的组件。
- **影响**：V-S14 的 1002 断言会失败；未协商的 RSV1 帧会带着压缩字节进入应用层，按协议走到 4000/UNKNOWN 或别的关闭码，与共享契约不符。批次二按契约写的客户端会被误导。
- **验收判据**：
  - 写明执行这三类 1002 的组件与管线位置，或者改写契约；
  - V-S14 用原始帧覆盖：未协商时的 RSV1 数据帧与首帧、协商前后的控制帧 RSV1、RSV2/RSV3。每种都断言以 1002 关闭，且没有到达应用层。
- **Dexter 裁决**：不需要。

### R3-S2 验收客户端 undici 产生不了 V-S14 需要的帧（R2-M2 修法引出）

- **位置**：详设第 421、453 行（验收的 WebSocket 流量来自单独的 Node/undici 进程）、第 508 行（V-S14 执行面为 focused 加受管 backend-acceptance）；计划第 30 行。
- **性质**：外部事实（上游 v8.9.0 源码）。
- **证据**：
  - undici v8.9.0 的 `lib/web/websocket/permessage-deflate.js` 只有解压：第 3 行只引入 `createInflateRaw`，第 35、53 行；
  - `lib/web/websocket/frame.js` 第 51–53 行组帧时只置 FIN 与操作码，RSV 位恒为 0，也不分片；
  - 所以它发不出客户端压缩帧（客户端到服务端的 RSV1=1）、64 倍单帧炸弹、压缩分片累计、未协商 RSV1、控制帧 RSV1。三类报价里它也只能发自己固定的那一种（`permessage-deflate; client_max_window_bits`）。
  - 需求 V-S4 第三点还要求在 TDS 前放一个转发器。
- **影响**：V-S14 的大部分断言在验收里产生不了，只能在别处证明，或者在实施时被悄悄改掉。
- **验收判据**：
  - 逐条写明 V-S14 的每个断言由哪个客户端或测试产生：focused 的原始帧测试，还是验收里能构造原始帧的客户端，并保证每条都能产生；
  - 写明 Java 场景怎样启动并驱动 Node 进程、Node 与 undici 的版本怎样固定、远端验收主机是否具备。
- **Dexter 裁决**：不需要。

### R3-S3 Q15 有两处红夹具按所写方式观测不到（R2-S1 的残留）

- **位置**：详设 §12.2 第 836、837、840 行；§12.3 第 846、857 行。
- **性质**：仓内事实（源码亲验）。
- **证据**：
  - 第 836 行要求 contract-face 的面计数红夹具「through default `scripts/verify`」以 `R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID` 失败。但同一次运行的静态段会先读到同样的输入：
    - openapi-contracts 调用 edge-codegen，其 `load()` 在第 285 行把目录和解析报告一起交给 `projectEdgeCatalog`，帮助函数（`edge-operation-projections.mjs` 第 159–163 行）校验面计数与报告；
    - 设计要加入静态段的 `r5-edge-materialize --check`（第 415–430 行）还会逐字节比对报告。
    - 所以改目录或改报告，静态段都会先失败，contract-face 的标记不会是首败。
  - 第 837 行要求 r5-edge-materialize 对「在某个已物化接口上加未知第五面」以 `R5_EDGE_MATERIALIZED_FACE_DENOMINATOR_INVALID` 失败；第 840 行又规定帮助函数先以 `R5_EDGE_OPERATION_PROJECTION_FACE_INVALID` 拒绝未知面，而 r5-edge-materialize 在第 358 行最先调用的就是这个帮助函数。同一改动两行写了两个不同的首败标记。
  - 新增的静态门插在 `staticCommands` 的哪个位置没有写，而 verify 遇首败即停，首败由位置决定。
  - 同族其余四处：`tools/verify-gates/cli.mjs` 第 636 行的改动会先在 frontend-architecture（静态段第 5 条）以同一标记失败，可观测；edge-codegen 第 334、344 行与帮助函数第 159 行的写法彼此一致。
- **影响**：按设计自己的规则（「前面有无关失败，不算门已接通的证明」），这两处红夹具无法按所写方式得到证明。
- **验收判据**：每个 Q15 位置写出三样：改的是哪个输入、在所写模式下第一个读到它的门、那道门的标记。被遮蔽的门改用直接入口证明（例如单独运行 `scripts/check/contract-face`），或写明由哪道静态门覆盖。
- **Dexter 裁决**：不需要。

### N 级

- **R3-N1 Q5 清单有一处路径笔误**：详设 Q5 的命中清单列了 `scripts/test/backend-performance-cp05-reclassification.test.mjs`，这个文件不存在；按原样复跑，实际命中的是 `scripts/test/backend-performance-cp05-reclassification.mjs`，其余 13 条一致。「命令可复现完整命中集」这一说法因此差一条。
- **R3-N2 `r5-edge-materialize --check` 的耗时要计入**：
  - 它的 `check()`（第 415–426 行）先把整个仓库复制到临时目录（`fs.cpSync(root, scratch, ...)`，只排除 build、dist、.git 等），而设计要把它加进两种 verify 模式（第 837、846 行）。
  - 它与 openapi-contracts 调用的是同一个投影帮助函数。按 CLAUDE.md「verify 保持分钟级，变慢先砍最弱门」，请在接入时记录耗时，并写明它相对 openapi-contracts 的独有价值（例如它才会逐字节比对报告与物化输出）。
- **R3-N3 交互工件表格缺一格**：交互工件第 406–412 行的表头有三列，第 411 行 TER-E01 只有两格，「结论」一格被删掉了。按本轮状态，应写 OPEN 或待复核。

## 4 · 对本轮请求六个重点的逐项答复

1. **CP-05 之前的静态验证**：普通 `--validate-only` 预期在 openapi-contracts 以 `BUDGET_PROJECTION_OPERATION_MISSING` 首败，已写明。`IDENTITY_ONLY` 下能证明的是与预算无关的门，这个环境变量能经 verify 传到子命令。延后的红夹具在三次标定并重新生成投影之后补证，标定的进入条件写明。Q5 已能命中 `edge-codegen.mjs` 的 `Cp05`。结论：关闭（设计层面），残留 R3-N1。
2. **独立 TDS 进程**：两套类路径的版本、REACTIVE、ArchUnit 隔离、Node 客户端隔离、双业务上下文的 sink，设计都写了，这些都没有运行期证明（列入 §8）。但 Node/undici 的能力不足以产生 V-S14 的帧（R3-S2），登记竞态的证明也因进程分离而落空（R3-M1）。
3. **Q15**：复跑得到同样 6 处。六个入口里，第 836 行（contract-face）与第 837 行（r5-edge-materialize）的首败标记按所写方式观测不到（R3-S3），其余四处可观测。终端 edge 包已纳入 edge 互不依赖规则。以上都只是设计文字，红夹具没有运行过。
4. **压缩**：
   - 三类报价的应答参数、原始 Netty 管线上的挂载点、deflate-frame 单独与混合报价、协商后压缩的首帧，这些已写清且可行，协议正本与 V-S14 一致；契约也区分了 WebSocket 控制帧与 JSON PING/PONG 数据帧。
   - 解压超限走 1009 可行，帧超长由 Netty 自己按 1009 关闭。
   - 「未协商 RSV1、控制帧 RSV1 → 1002」没有执行组件（R3-S1）。
5. **错误集与预算**：
   - R-1.4 的闭集没有扩大，摘要冲突改为已有的 500，`ActivationCandidate` 归 terminal-binding；
   - TDS 的传递依赖由依赖报告断言排除项；
   - 551 KiB 与 1 MiB 的算术成立，N 的推导公式里没有臆造数值；
   - R2-N2 按转述的裁决落实。
6. **decision 与其他**：
   - decision 的锚点范围准确，仍为 PROPOSED；
   - 验收场景规范只定义 HTTP，接受前不改；
   - D-34 下 reset/seed 写成进入条件；
   - 四个具名调度器；模板各节具备；
   - E01 只读 testId 在三份工件里一致；
   - 运营面取消激活由 requireStore 先给 403；
   - R-1.6 与 D-38 的顺序回归无误。

## 5 · D-18 的 UI 强制自问

与上一轮相同：来自 D-18 的明确要求；编辑时只读展示合逻辑；只读文本已是最短路径；没有新增附加解释物。只读观测键在三份工件里已一致。

## 6 · 已核实的事实

- **检索复跑**：Q15 与 Q5 按原样复跑（ripgrep 15.2.0），Q15 为 6 处；Q5 为 14 个文件，与清单只差 R3-N1 那一条。
- **§3a**：67 行，其中 66 行与 L2 场景文件的动作键、定位绑定文件逐项一致。
- **上游版本与 API**：
  - Reactor Netty v1.3.7：握手工厂 `allowExtensions=true`（第 96 行）；升级时复制原始请求头（第 112–117 行）；同时注册 permessage-deflate 与 deflate-frame 两个握手器（第 123–130 行）；解码异常只交给接收流，应用可按 1009 关闭。
  - Netty 4.2.17：握手器只在报价带参数时启用无上下文接管；解码器按帧限解压输出；帧解码器在 `allowExtensions=true` 时不查 RSV。
  - Maven Central：reactor-bom 2025.0.7、netty-codec-http 4.2.17.Final 已发布，版本与设计一致。
  - undici v8.9.0：只解压，组帧不置 RSV、不分片。
- **verify 的环境变量**：`tools/verify-gates/verify.mjs` 以 `env: {...process.env}` 启动子命令。
- **decision**：仍为 PROPOSED；R-1.6 与 D-38 的判定顺序未变。

## 7 · TEMPLATE_COVERAGE

- **实施详设模板**：§0～§14 各节均已具备；§3a 为逐行九列；§4 有不变量、FORBID、RECALL；§10b.6 写了 D-34 前提；§12 有未决项表；§14 按节标注。执行与复核仍为 OPEN，作者也这样写了。
- **IA 模板、交互工件模板**：D-18 与只读观测键已具备；交互工件表格缺一格（R3-N3）。
- **Journey 模板**：本轮未改，上轮已具备。
- **实施任务模板**：三答、步骤级对账、6b、6c、四项准入、运行纪律、两行状态、13c 都有；标定与静态验证的顺序已闭合。

## 8 · 未能核实（L3_UNVERIFIED）

- 所有运行期证明：两套类路径的实际解析结果、TDS 进程的应用类型、握手应答、分配上限证明、红夹具的实际首败、harness 的起停与清理。设计与计划都明确写了尚未运行。
- 远端验收主机上是否具备 Node，以及 Java 场景怎样驱动 Node 进程（R3-S2 的一部分）。
- `NettyServerCustomizer` 在 Spring Boot 4.1.0 上挂载原始处理器的具体写法：按 Reactor Netty 的通道初始化顺序推断可行，未逐行取证。

## 9 · 需要 Dexter 裁决或知悉

1. **R3-M1**：只在作者主张把登记竞态降到更低一档环境时需要裁决（那是需求修正）。
2. **R2-N2**：已按 Codex 转述的裁决落实，本会话未见原话。
3. decision 修订后由 Dexter 确认从 PROPOSED 转为已接受，这一步尚未发生；接受之后，实施批次内还要修订验收场景规范，才能登记 WebSocket 场景。

## 10 · 会话出处与授权边界

- 续接会话；按 Dexter 对复评的要求，全部由 Claude 主会话审查，没有独立子 agent 的结论。
- Claude 是需求正本的作者。本轮没有修改需求或其他文件，只新写了这一份评审文件（CLAUDE.md 允许的评审交付物）。
- 全程只做只读检索与解析；外部事实用 curl 取上游按版本标签的源码与 Maven Central 发布物，下载到会话临时目录。没有运行构建、测试、生成器、`scripts/verify`、DEV、Testcontainers、reset、seed、L2、UAT 或任何数据操作。
- 本结论只是评审结论，不授权实施或运行，也不把 PROPOSED 的 decision 视为已接受；各条 finding 是交 Codex 复核的输入，不自动成为权威。
