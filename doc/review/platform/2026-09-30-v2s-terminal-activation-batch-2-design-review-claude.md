# 终端激活与长连接·批次二详设/计划独立评审（Claude）

## 会话出处披露

- 本次是一个全新的独立 sub-agent 会话，从 v2s 仓根发起。没有此前对话的记忆，也没有沿用 Codex R1/R2 的结论。
- 12 份输入文件全部读完，没有抽样。需求正本（1954 行）、终端编码规范（1060 行）等长文件因工具单次输出被截断，改为分段逐行读完。截断的区段都按行号补读过。
- 阅读顺序按指派执行：先读 1～7 形成独立预期，再读 8～9，最后读 10～12。
- 为核实事实，另外做了几项只读核对：
  - 打开了 `tools/verify-gates/cli.mjs` 第 1026–1090 行、`TerminalConnectionContractScenarios.java` 第 850–919 行和 `tools/terminal-readability/check-static.mjs`；
  - 用 `wc`/`grep` 做了只读检索；
  - 用 WebFetch 读了 undici v8.11.2 官方 tag 下的 `package.json`、`websocket.js`、`receiver.js`、`permessage-deflate.js`、`connection.js` 和 `WebSocket.md`。
- 没有运行构建、测试、生成器、`scripts/verify`、DEV、Testcontainers、reset、seed、L2 或 UAT，也没有写任何仓库文件。

## 评审对象

1. `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`（全文）
2. `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`
3. `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`
4. `contracts/protocol/terminal-connection-protocol.json`
5. `doc/platform/third-party-library-usage-standard.md`
6. `doc/platform/terminal-coding-standard.md`
7. `doc/platform/implementation-task-template.md`
8. `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`
9. `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`
10. `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r1-codex.md`
11. `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r2-codex.md`
12. `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-r2-input-checklist-codex.md`

## 独立预期 vs 方案对照

**只读需求时我形成的预期：**

- **owner 划分**：
  - `terminal-data-client` 是终端身份的唯一持久化 owner（`persistSecure`）；它还持有非持久的连接态和延时样本，负责重连策略；
  - `server-config` 持有环境选择和按服务的覆盖（地址加可选代理，代理密码放 `persistSecure`）；
  - transport 持有机制：HTTP 多地址执行器，以及 WebSocket 的无限重试、节奏、轮转、首选和网络触发，并带自己的 command/actor；
  - DevicePort 的网络三方法只返回「不可用」。
- **state reset**：由 owner 声明保留范围，只有 server-config 声明；内存与落盘都保留；TR-09 的例外正文要改。
- **Node 客户端**：固定一个 standalone undici，由同一个包提供 fetch、WebSocket 和 ProxyAgent，不自写 CONNECT。R-16.3 要求先核实 Node 内置 undici 能否与 standalone 搭配。
- **TDS**：引入 Actuator 就绪探针，nodeId 可配置，下线按「报告未就绪 → 等待摘除 → 拒新并 drain」三步走。
- **拓扑**：受管 DEV 起 3 个 TDS 和 2 个 HAProxy 入口，运行清单记录本机端口。V-S15 在 backend-acceptance 里用单个 TDS 验证，V-E6 在 DEV 里验证。
- **生成链**：`contracts/policy` 放生成配置，产物进 `src/generated/`，需要同时改：
  - TER 目录词汇加入 `generated`；
  - 生成切片三方对账并入 TER 目标；
  - 设备形态闭集的双向类型断言。
- **批次三的内容**（Doris、跨节点取代、topic 同步）一律排除。

**方案与预期吻合的部分**：owner 划分、command→actor、专用 selector、standalone undici 加 ProxyAgent、Actuator 就绪、三步下线、3 TDS 加 2 HAProxy、批次三排除，方向都一致。

**偏离或缺口**（详见 Findings）：

- 生成链的三项配套里，TER 目录词汇、三方对账和设备形态闭集都没有进入方案；
- V-S9 的既有场景会被下线顺序的改动打破，方案没有覆盖；
- V-B15 的夹具来源用错了执行面；
- WebSocket 轮转的时机与 R-10.3 不一致；
- 代理密码的读取路径前后两种说法；
- undici 解压上界的行为依据不足；
- Journey 来源漂移的清单不全。

## 独立核验重点逐项结论

1. **server-config 与凭证 owner**：成立。
   - 需求 §1.1 第 58 行把 server-config 列入批次二；详设第 33、91、181–182、359–360 行把 `terminal-data-client` 定为唯一凭证身份 owner，server-config 只持有环境、覆盖和受保护的代理配置。
   - 没有第二凭证库。但代理密码的读取路径前后矛盾（S-9）。
2. **command→actor 与专用 selector**：成立。
   - 五个生命周期 command 都经 actor：详设第 197 行，计划第 105 行；
   - 三个专用 selector 及其消费者：详设第 198、311 行；
   - 从真实 command/`SESSION_READY`/`PONG` 到读回的测试要求：详设第 319 行，计划第 106 行，§11a 的 V-T4/V-T5；
   - DEV 客户端经 selector 读取：详设第 224 行。
3. **reset 只精确保留 server-config**：基本成立。
   - 详设第 182、361 行，计划第 93、96 行，V-T8 两个反例（详设第 412 行）。
   - 瑕疵：TR-09 改写被写成「更新 server-config 的既有例外」，但规范里并没有这条例外（N-8）。没有发现扩大保留范围或形成第二凭证库的写法。
4. **undici、代理与 PMD**：部分成立。
   - 已区分：standalone 8.11.2 与 Node 内置 6.28.1 分开处理（详设第 54、109 行）；
   - 已核实：官方 tag 源码里 8.11.2 要求 Node `>=22.19.0`，握手发 `permessage-deflate; client_max_window_bits`，WebSocket 文档有 `dispatcher` 选项；
   - 不自写 CONNECT：详设第 112、199 行。
   - 不足：「PMD 按 `maxPayloadSize` 停止解压」的说法没有写清配置来源和取值。按 8.11.2 源码，这个值默认是 0（不设限），只有 dispatcher 的 `webSocketOptions` 提供时才生效。代理 CONNECT 被拒的错误形态也没有依据（S-10）。
5. **TDS readiness、nodeId、下线时序与拓扑**：时序清楚，拓扑能满足 V-E6，没有混入批次三。
   - 时序见详设第 209–213 行，HAProxy 参数与 2 秒摘除界、3 秒等待见第 110 行；
   - V-E6 的 manifest、身份控制和清理设计见详设第 221–227 行；
   - 批次三排除见详设第 25、507 行。
   - 缺口：V-S15 的「不配置时取默认值」被降成单元测试（S-3）；既有 V-S9 场景会因新时序失败（S-2）；DEV 夹具复原缺失（S-5）。
6. **V-B15、V-S9/V-S15 与通道隔离**：部分成立。
   - V-B15 明确是验收场景键，不是 HTTP operation identity（详设第 403 行，计划第 190 行）。
   - 但 V-B15 取 `r5-full` DEV seed 的夹具，而 backend-acceptance 不加载 seed，场景跑不起来（S-4）。
   - V-S9 在详设和计划里完全没有出现（S-2）。
   - V-S15 有闭集选择入口，CONTRACT、BUSINESS、TOPOLOGY_PREFLIGHT 分开输出（详设第 215 行）。不过靠运行参数给 V-S1 换通道，复杂度偏高；BUSINESS 场景与 V-S15 停掉 TDS 的先后也没写（N-6）。
7. **D-41 负例**：成立（按设计声明）。
   - 计划第 78–79 行把 root escape 与 symlink escape 列为生成器红例；详设第 492 行把它们放进 `openapi-contracts` 静态门。
8. **DR1 处置**：越权写入的风险已消除，但没有完全关闭（S-1）。
   - 当前字节下，Journey 第 48、54 行仍然冲突；
   - 方案不再把 Journey 列为写入目标，要求 CP-01 写入前由 owner 修订或交 Dexter 裁定，也没有引入第二凭证库；
   - 但漂移清单不全，而且这个前置门本质上是一项待 Dexter 的动作，却被写成「没有待 Dexter 的问题」。

## 方案合理性判断（问题对不对/方案优不优/代价配不配）

**问题对不对**

批次二要做的事——TER 两个新包、transport 机制、代理、多节点接入与入口切换——都来自 Dexter 的直接裁决：D-11、D-26、D-35、D-44、D-45、D-46、D-49。方向本身没有偏离用户意图。

可能出现的误读是：Dexter 要的是「能工作的终端连接能力并在真实服务端上打通」，而不是一套更重的验收仪式。方案在核心能力上对齐了。但若干验收组织项在做与问题无关的精确化：

- 为 V-S15 设计了只接受单一 ID 和单一组合的 CLI 参数；
- 按运行参数给 V-S1 换输出通道；
- 把批次二文档并入门店终端 L2 的控制面文件。

这些不改变产品方向，但属于「在精确地做 1+1」的倾向（见 N-1、N-6）。我没有发现需要 Dexter 裁决的产品语义歧义。唯一需要 Dexter 动作的是 Journey 来源漂移（S-1）。
**方案优不优**

我构造的替代方案：

- **替代 A（V-S15 执行面）**：把 V-S15 放进批次一现有的 TDS CONTRACT 场景工厂，和 V-S9 并列，改写 V-S9 的第一项。通过 `TdsAcceptanceProcess` 的启动配置给出非默认 nodeId 和等待时长，默认 nodeId 断言复用默认配置的 V-S1 运行。这样不需要新增只接受单一 ID 的 CLI 参数，也不需要按参数给 V-S1 换通道。取舍：少一层入口复杂度，还顺带解决了 V-S9 回归。代价是要按现有工厂的选择方式核实一次（UNVERIFIED，我没有核对批次一的全部选择机制）。
- **替代 B（代理密码）**：代理密码只作为 server-config slice 的 `persistSecure` 字段存在，网络快照从 owner 的内存状态读取，不另设「请求时从受保护存储解密」的路径。取舍：少一条绕过 state runtime 的读路径，与 R-11.3 的持久化模型一致。
- **替代 C（Node 客户端）**：按 R-16.4 的默认偏好，用 Node 内置的 WebSocket 加 standalone ProxyAgent。方案选的 standalone 全套更简单、版本更确定，我认为这个选择更好，只需如实写明它是 R-16.3 的备选（N-4）。
- 被拒绝的方案里，「新增 `ws`」「自写 CONNECT」「源地址亲和」的理由都成立。

**代价配不配**

- 三 TDS 加两 HAProxy、注入式代理客户端都是 Dexter 裁定的范围，不算过度工程。HAProxy 用一个容器两个 listener，已经是最小形态。
- 不配的代价：
  - Node 精确到补丁版本的固定：需求只要求 engine ≥22.19.0（N-3）；
  - 把批次二详设和计划并入门店终端 L2 控制面：批次二没有任何 L2，每改一次文档都会让门店终端的 L2 准入失效（N-1）；
  - 闭集 CLI 组合（N-6）。
- 这些都能在批次内去掉，不影响验证力。

**UI 适用性**

UI 轻度适用，不是 `NOT_APPLICABLE`：TER 管理台的平台端口页会多出三行只读的「不可用」能力（V-T16、V-T17）。

- 来源：D-25，需求 §7 第 982–987 行；
- 用户此时看到这三行是合理的：这一页本来就如实列出各项能力；
- 已经是最短路径：没有新控件，页面代码不改；
- 不合理之处：无，来源于端口能力声明的既有投影。

方案 §3a 把 L2 标为 N/A 成立。

## Findings
### S-1　Journey 来源漂移没有完全关闭，而且一项待 Dexter 的前置动作被写成「无待决」（需 Dexter 裁决）

- **仓内事实**：
  - Journey 第 48、54 行把终端凭证写成保存在「server-config 管理的终端凭证状态」「按 server-config state 持久化」；
  - 第 54 行还写「取消激活只清凭证 slice」，这与需求 R-9.6 第 316 行「其余 owner 的持久化全部清空」相反；
  - 第 60 行的非目标里列着「多节点 TDS」，已被 D-44 改为批次二；
  - 第 48、54 行引用的 R-10.5 是压缩条款，引用错了；
  - Journey 的 frontmatter `status: IN_DESIGN`（第 5 行），owner 是 Dexter。
  - 详设第 33 行只登记了「凭证住址」这一项漂移；详设第 433 行和计划第 30 行都写着「没有待 Dexter 裁决的产品问题」。
- **推论**：CP-01 前置门的成立依赖 Journey owner（即 Dexter）的动作，按当前字节它一定会触发。把它写成「无待决」，会让实施一启动就停在门外。
- **影响**：实施被卡住，而且漂移清单遗漏的「只清凭证 slice」这一条可能误导 reset 的实现。
- **最小修正**：
  - 详设 §0 的漂移清单补全第 54 行的「只清凭证 slice」、第 60 行的「多节点 TDS」和 R-10.5 误引；
  - §12 和计划 §0.2 把这一项列为 `DEXTER_DECISION`：请 Dexter 让 Journey owner 修订这几行，或明确裁定需求优先；
  - 不改 Journey 本身。

### S-2　下线三步化会打破批次一既有的 V-S9 验收场景，方案没有覆盖

- **仓内事实**：
  - 需求 V-S9（第 683 行）写明「批次二起……以 V-S15 为准，本条第一项随之改写」；
  - 现有 `TerminalConnectionContractScenarios.java` 第 888–918 行断言：下线开始即出现 `readiness=REFUSING_TRAFFIC admission=REFUSED`，新连接立即以 `REDIRECT_TO_NEXT_NODE` 被拒，从下线请求到关闭不超过 10 秒；
  - 详设第 211 行的新时序是先等 3 秒、之后才拒新，再用最多 10 秒 drain；
  - 详设和计划里 V-S9 零命中，§11a 也没有 V-S9 这一行。
- **推论**：这个场景在新字节上必然失败。它会作为失败族出现，而不是被有计划地改写。
- **影响**：批次一的回归变红，还可能被误当作实现缺陷。
- **最小修正**：
  - CP-04 明确改写 V-S9：第一项改为按 V-S15 的顺序，10 秒的计时起点改到等待结束之后；
  - §11a 增加 V-S9 行；
  - CP-04 修改全集写入这个文件。
### S-3　V-S15「不配置时取默认值」被私自降为单元测试

- **仓内事实**：需求 V-S15 第 706 行在 backend-acceptance 执行面上；计划第 123 行写「配置默认……用 unit/runner tests」；详设 §11a 第 404 行没有默认值这一子项。
- **规则依据**：实施任务模板第 72 行和需求 §4 第 560 行（D-48）写明，受管判据不得私自降档。
- **影响**：违反 D-48，§11a 不完整。
- **最小修正**：在某个默认配置的 TDS 验收场景（例如 V-S1）里断言 `SESSION_READY.nodeId` 和最新状态的节点都等于默认值，并写进 §11a；或者交 Dexter 裁决降档。

### S-4　V-B15 的夹具取自 DEV seed，但 backend-acceptance 不加载 seed

- **仓内事实**：
  - 计划第 191 行写「从现有 `r5-full` 8 条终端 fixture 中选一个」；
  - 需求 V-B1 第 564 行写明「后台验收不加载 DEV 种子，所以在场景内手填激活码新建终端」；
  - 既有场景用 `business.createConnectionContractFixture(context)` 在场景内造数（`TerminalConnectionContractScenarios.java` 第 860–863 行）。
- **影响**：按计划实施，V-B15 在 Testcontainers 上找不到夹具；实施者还可能因此去加载 seed。
- **最小修正**：V-B15 改为在场景内新建终端，复用既有的 fixture helper；删掉对 `r5-full` 的引用。

### S-5　DEV 双端脚本缺少「用过的终端恢复为未激活」，也没有写设备形态匹配

- **仓内事实**：
  - 需求 §8 第 17 条（第 1063 行）要求「每个脚本结束时把用过的终端恢复为未激活」，并指明 `store-operating` 下启用的终端有五台；
  - 详设第 225 行和计划第 135 行只写了「8 条 fixture、内存选 1 或 4 条」；
  - R-1.4 第 7 项要求设备形态与终端的设备类型一致，方案没有写选夹具时怎样保证形态匹配。
- **推论**：V-E5 结束后 B 仍然绑定，V-E6 结束后三台仍然绑定。双端脚本的例行运行不做 reset（V-E3），重跑时会得到「终端已绑定另一台设备」。
- **影响**：V-E 系列不可重跑，会误触失败族。
- **最小修正**：CP-05 写明每个脚本结束后通过真实的后台取消激活复原，并加入清理判据；选夹具时按 `surfaceForm` 与设备类型匹配，并核实启用的终端数量。
### S-6　R-1.2 设备形态闭集的双向一致性（批次二）完全缺失

- **仓内事实**：
  - 需求 §1.1 第 58 行把「R-1.2 中设备形态闭集的一致性」列入批次二；
  - R-1.2 第 91 行要求 terminal-data-client 对 `SurfaceForm` 与生成的设备形态类型做双向相等的类型断言；
  - V-G1 第 899 行要求任一侧新增取值时 `scripts/verify` 默认模式失败；
  - 在详设和计划里检索「R-1.2」「SurfaceForm」「设备形态」，零命中。
- **影响**：批次二的一条判据没有场景，违反 D-48。
- **最小修正**：CP-03 的 terminal-data-client 增加双向类型断言和红夹具（任一侧加值即编译红），§11a 的 V-G1 行列出这一项。

### S-7　R-12 门台账在 GO 之前不完整：漏了生成切片三方对账和 `generated` 目录词汇

- **仓内事实**：
  - 需求 R-12 第 483 行要求批次二把 TER 生成目标并入 `R5_FRONTEND_GENERATED_FACE_DRIFT` 对账；service-shape 第 91 行写「Batch 2 adds the TER client projection」；现在的 `tools/verify-gates/cli.mjs` 第 1067–1074 行只对三个前端暴露面做对账；
  - R-12 第 476 行要求 `tools/terminal-readability` 的词汇表加入 `generated`；现在的 `check-static.mjs` 词表和终端编码规范 §7.1（第 956–977 行）都没有 `generated`；
  - 第 484 行要求「在 GO 之前」列出有限的门清单；详设第 437、498 行把检索全集推迟到 CP-01。
- **推论**：`src/generated/terminalApi.ts` 会让 TR-R06 门变红；三方对账不含 TER。
- **最小修正**：§12.2 增加这两行（入口、verify 模式、红夹具）；CP-01 修改全集加入 `tools/verify-gates/cli.mjs`、`tools/terminal-readability` 和终端编码规范 §7.1。
### S-8　WebSocket「未就绪的拒绝在同一周期继续下一个入口」与 R-10.3 的两段式不一致

- **仓内事实**：
  - 需求 R-10.3 第 362–364 行分两段：建立阶段的失败（超时、拒连、DNS 失败、握手被拒）在同一次尝试里改试下一个地址；没有收到就绪就结束的尝试（包括业务拒绝、`REDIRECT_TO_NEXT_NODE`、`NODE_BUSY`）结束本次，下一次按节奏从下一个地址开始；
  - V-T7 第 760 行要求「尝试间隔服从重连节奏」；
  - 详设第 194 行写的是「一个 entry 上没就绪的拒绝在同一连接周期继续下一个 entry」。
- **影响**：握手后被拒会连续打两个入口；与 V-T7 的节奏判据冲突；「凭证无效」时每个周期多一次认证读库。
- **最小修正**：把第 194 行改为 R-10.3 的两段式原文，并在 V-T7 场景里断言就绪前被拒后，下一次尝试的起点晚于一次重连等待。

### S-9　代理密码的存放与读取路径前后两种说法

- **仓内事实**：
  - 详设第 180 行：由 owner 的 `ServerNetworkSnapshot` 取得；
  - 详设第 199 行：「只在 request/socket 创建时从 protected persistence 解密，内存对象只沿 adapter call stack」；
  - 详设第 359 行和计划第 92 行：密码是 slice 的受保护字段，按 state 模型 hydrate 后在内存里。
- **推论**：第 199 行意味着另有一条直接读安全存储的路径，绕过 state runtime。这与「hydrate 进 slice」互斥。另外，密码进了 Redux 根状态后，是否会被开发态的诊断面读出，没有论证（UNVERIFIED）。
- **最小修正**：只保留一种写法（建议采用替代 B）：密码只在 server-config slice 的 `persistSecure` 字段里，快照从 owner 状态读；删掉「请求时解密」；补一句诊断面不导出受保护字段及对应的负向检索。
<!--APPEND_MARKER-->
