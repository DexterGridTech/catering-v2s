# 终端激活与长连接 · 批次二详设与实施计划评审 · 合并结论（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 设计文档
VERDICT=NO-GO
M/S/N=0/11/6
DEXTER_DECISION=1 项（S-1，Journey 来源漂移）
TEMPLATE_COVERAGE=implementation-design 模板：§0～§14、§3a、§10b、§11a、§13b、§13c 在场，按章节核对；IA 与 UI 交互模板为 NOT_APPLICABLE（没有新页面、控件或 L2 动作）；Journey 沿用 2026-09-26 已接受的 Journey
L2_USER_VISIBLE=轻度适用：TER 管理台平台端口页多出三行只读的「不可用」（V-T16、V-T17），没有新控件，合理
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION：只读仓内文档与源码；用 curl 核对 undici v8.11.2 官方 tag 的 WebSocket.md、package.json、permessage-deflate.js；没有运行任何命令
REVIEWER=Claude 主会话；续接会话，不是 fresh；按 Dexter 对本批的指示，没有派子 agent
BASELINE_NOTE=Dexter 说明：被审详设写于批次一清理批执行之前
```

## 0 · 与同名评审文件的关系

- `2026-09-30-v2s-terminal-activation-batch-2-design-review-claude.md` 是另一个 fresh 独立子 agent 会话写的评审，**没有写完**：
  - 正文止于 S-9，文末留着 `<!--APPEND_MARKER-->`；
  - 正文引用的 S-10、N-1～N-8 没有正文，也没有结论块。
- 本会话写评审时误用了同一文件名，覆盖了那份文件；随后已按其已提交的版本逐字恢复，没有改动它的内容。
- 本文件是合并结论：
  - 那份评审的 S-1～S-9，本会话逐条回到详设、计划与仓内源码核对过，均成立，在此收录；
  - 它只提到标题、没有正文的 S-10、N-1、N-3、N-4、N-6、N-8，本会话核实后补写；
  - 另加本会话独立发现的 S-11 与 N-2、N-5。
- 以本文件的结论为准。

## 1 · 方案合理性

- **问题对不对**：对。批次二要让 TER 第一次拥有配置 owner、终端激活生命周期、可靠的传输，并让 TDS 能多实例部署，都来自 Dexter 的裁决（D-11、D-26、D-35、D-44、D-45、D-46、D-49）。批次三的内容排除正确。
- **主要取舍成立**：
  - `server-config`、transport、terminal-data-client 三个 owner 单向依赖；凭证只由 terminal-data-client/state 持有；
  - 两个 HAProxy 入口按轮询分配；
  - 就绪检查不含数据库，理由写明了；
  - R-4.5 的三步下线正确：等待期间照常接受新连接，等待 3 秒，不短于 HAProxy 最坏 2 秒的发现时间；
  - 用 undici 包自带的 fetch、WebSocket 与 ProxyAgent，是 R-16.3、R-16.4「不能搭配时」的做法，理由成立：Node 22 自带的 undici 是 6.x，与 8.x 的 dispatcher 不同代。
- **代价偏高**：
  - V-S15 另造了一套只接受单一 ID 的命令行选择机制，还要按运行参数给 V-S1 换输出通道；
  - §3a 为没有 L2 的批次加了 L2 控制面与准入手续；
  - Node 版本精确钉到补丁号。
  - 这些都可以在批次内去掉，不影响验证能力。

## 2 · Findings

### S-1 · Journey 来源漂移清单不全，而且它的前置门实际上是一项待 Dexter 的事，却被写成「无待决」（需 Dexter 裁决）

- **事实**：
  - Journey 第 48、54 行写凭证保存在 server-config 管理的状态中；第 54 行还写「取消激活只清凭证 slice」，与 R-9.6「其余 owner 的持久化全部清空」相反；
  - 第 60 行的非目标仍列「多节点 TDS」，已被 D-44 改入批次二；第 48、54 行引用的 R-10.5 是压缩条款，引用错了。
  - 详设 §0（第 33 行）只登记了凭证住址一项；详设 §12 与计划 §0.2 写「没有待 Dexter 裁决的问题」，同时又把 Journey 修订或 Dexter 裁定设为 CP-01 写入前的阻断条件。
- **影响**：实施一开工就会停在门外；漏登记的「只清凭证 slice」可能误导 reset 的实现。
- **修正**：
  - 漂移清单补全上述四处；
  - 把这一项列为 `DEXTER_DECISION`。
- **建议 Dexter 的裁定**：需求优先；凭证只由 terminal-data-client/state 持久化；授权把这几行作为勘误改正。

### S-2 · 下线顺序改了，批次一的 V-S9 场景没有处理

- **事实**：
  - 需求 V-S9 的标注写明批次二起第一项随之改写；
  - `TerminalConnectionContractScenarios.java` 第 888～918 行断言「下线开始即拒新连接」；
  - 新时序是等 3 秒之后才拒新；详设与计划里 V-S9 零命中。
- **影响**：批次一的回归在新代码上必然变红，会被当成失败族排查，白耗一轮受管运行。
- **修正**：
  - CP-04 改写 V-S9，§11a 加一行 V-S9。
  - 建议直接把 V-S15 的断言并进改写后的 V-S9，照旧放在完整验收最后运行，这样就不需要 `--tds-contract-scenario` 这套新执行面，也不需要给 V-S1 换通道；
  - 如保留独立执行面，写明它比这个方案好在哪里。

### S-3 · V-S15 的「不配置时取默认值」被降为单元测试

- **事实**：需求 V-S15 第一项在后台验收的执行面上，详设 §11a 的 V-S15 行没有这一子项；D-48 规定受管判据降档要经 Dexter 裁决并写回详设。
- **修正**：在某个默认配置的 TDS 场景（例如 V-S1）里断言 `SESSION_READY.nodeId` 与最新状态的节点都等于默认值；或交 Dexter 裁决降档。

### S-4 · V-B15 的夹具取自 DEV 种子，但后台验收不加载种子

- **事实**：计划第 191 行写「从现有 `r5-full` 8 条终端 fixture 中选一个」；需求 V-B1 写明后台验收在场景内新建终端；现有场景用 `createConnectionContractFixture` 在场景内造数。
- **修正**：改为在场景内新建终端，删掉对 `r5-full` 的引用。

### S-5 · 双端脚本没有写「用过的终端恢复为未激活」，也没有写设备形态匹配

- **事实**：
  - 需求 §8 第 17 条要求每个脚本结束时把用过的终端恢复为未激活；
  - R-1.4 第 7 项要求设备形态与终端的设备类型一致，种子里的终端有 laptop，也有 mobile；
  - 详设 CP-05 与计划 CP-05 都没有写这两点。
- **影响**：V-E5 结束后终端 B 仍然绑定，V-E6 结束后仍有三台绑定，重跑会得到「终端已绑定另一台设备」。
- **修正**：CP-05 写明每个场景结束后经真实接口复原，并加入清理判据；选夹具时按设备形态匹配。

### S-6 · R-1.2 设备形态闭集的双向一致性完全缺失

- **事实**：需求 §1.1 把这一项列入批次二；R-1.2 要求 terminal-data-client 对 `SurfaceForm` 与生成的设备形态类型做双向相等的类型断言；V-G1 要求任一侧加值时 `scripts/verify` 失败。详设与计划里「R-1.2」「SurfaceForm」「设备形态」零命中。
- **修正**：CP-03 加这条类型断言和红夹具，§11a 的 V-G1 行列出。

### S-7 · R-12 门台账漏了生成切片三方对账和 `generated` 目录词汇

- **事实**：
  - R-12 要求批次二把 TER 生成目标并入 `R5_FRONTEND_GENERATED_FACE_DRIFT` 的对账；
  - R-12 还要求 `tools/terminal-readability` 的词汇表加入 `generated`；
  - 详设与计划里 `terminal-readability`、`GENERATED_FACE_DRIFT`、`generatedSlices`、「三方对账」都是零命中。
- **影响**：新文件 `src/generated/terminalApi.ts` 会让可读性门变红；三方对账不含 TER。
- **修正**：§12.2 增加这两行（入口、verify 模式、红夹具），CP-01 的修改全集加入对应文件与终端编码规范 §7.1。

### S-8 · WebSocket「未就绪的拒绝在同一周期继续下一个入口」与 R-10.3 不一致

- **事实**：
  - 详设 CP-03（第 81 行）写的是：一个 entry 没就绪就被拒，在同一连接周期里继续试下一个 entry。
  - R-10.3 分两段：
    - 建立阶段的失败（超时、拒连、DNS 失败、握手被拒）在同一次尝试里改试下一个地址；
    - 没有收到就绪就结束的尝试（包括业务拒绝、「请改连其他节点」「节点繁忙」）结束本次，下一次按节奏从下一个地址开始。
- **影响**：握手后被拒时会连续打两个入口，违反 V-T7「尝试间隔服从重连节奏」；「凭证无效」时每个周期多一次认证读库。
- **修正**：按 R-10.3 原文改写，V-T7 场景加断言。

### S-9 · 代理密码的读取路径前后两种说法

- **事实**：
  - CP-02 写的是由 owner 的 `ServerNetworkSnapshot` 取得；
  - CP-03（第 86 行）写的是「只在 request/socket 创建时从 protected persistence 解密」；
  - §10.2 与计划写的是密码作为 slice 的受保护字段，hydrate 进内存。
  - 第二种说法等于另有一条绕过 state runtime 的读取路径。
- **修正**：只保留一种写法：密码是 server-config slice 的 `persistSecure` 字段，快照从 owner 状态读取。补一句诊断面不导出受保护字段，并配一条负向检索。

### S-10 · undici 的解压上界默认不生效，详设却默认它有上界

- **外部事实**：undici v8.11.2 `lib/web/websocket/permessage-deflate.js`：
  - 第 17 行 `#maxPayloadSize = 0`；
  - 第 26 行由构造参数 `options.maxPayloadSize` 赋值；
  - 第 64 行只在 `this.#maxPayloadSize > 0` 时才检查。
  - 也就是说，不显式配置就没有上界。
- **位置**：详设 §3.1（第 109 行）写「PMD 解压按 `maxPayloadSize` 上限停止」，但没有写从哪里配置、取什么值。
- **修正**：
  - 写明配置路径（dispatcher 的 WebSocket 选项）与取值（与共享协议一致的 65,536）；
  - 加一条 focused 测试：服务端发来解压后超过上界的消息时，客户端拒绝。
  - 代理 CONNECT 被拒时 undici 给出的错误形态，按官方源码写明，用来支撑 R-11.9「按确定未送达处理」的分类。

### S-11 · 双端脚本怎样在 Node 里装配 TER 包，没有设计

- **事实**：TER 各包的 `exports` 指向 TS 源码，例如 `apps/terminal/kernel/base/transport/package.json` 第 5～7 行；现有包测试经 vitest 运行。详设 CP-05 规定联调入口是一个普通的 `.mjs` 脚本，还要在同一进程里维持 4 套独立的包组合，但没有写 TS 源码怎样加载，也没有写 state 与 runtime 是否支持同进程多实例。
- **影响**：V-E1、V-E2、V-E5、V-E6 都依赖这个入口，这些决定会被推到实施时临时做出，绕过设计评审。
- **修正**：写明加载方式及依据；写明四个逻辑客户端是同进程多实例还是多进程。判据：CP-05 的 focused 测试起两套组合，状态互不串扰。

### N-1 · §3a 把批次二文档加进门店终端的 L2 控制面，并为空动作分母要求 L2 准入 PASS

门店终端的 L2 与批次二文档没有依赖关系。加进控制面之后，批次二文档每改一字，门店终端的 L2 准入就会失效。建议不加入；空分母准入不作为必做手续。

### N-2 · 用户侧入口不转发 `/actuator/**` 只写了原则

就绪接口与 WebSocket 共用一个端口。HAProxy 前端要写明拒绝这个路径，并配一条验证：经入口请求 `/actuator/health`，应被拒绝。

### N-3 · Node 版本精确钉到 22.23.3

undici 8.11.2 要求 Node 不低于 22.19.0，双端脚本在本机运行。建议运行时校验「不低于 22.19.0」，并把实际版本记进运行清单。

### N-4 · 用 undici 包自带的 WebSocket，应写明是 R-16.3、R-16.4 的备选路径

现在的理由成立，只需在详设里写明，这是需求规定的「不能搭配时」的做法，依据是 Node 自带 undici 6.x 与 8.x 的 dispatcher 不同代。

### N-5 · 清理批改动了 TDS，开工前要重新对齐

清理批会改 TDS 的压缩实现（改用 Reactor Netty 自带压缩）、actor 锁和限流类，与 CP-04、CP-05 的锚点有重叠。CP-04 开工前按清理后的代码重读相关锚点；§3.1 补上 Reactor Netty 压缩一行；V-E1 的压缩协商按新实现核对。

### N-6 · TR-09 的改写被写成「更新 server-config 的既有例外」

需求 R-12 要求改写的是 TR-09 例外正文里 state 重置的「保留范围」。详设写成「更新既有例外」，容易让人以为规范里已经有这条。建议写成「在 TR-09 例外正文中新增保留范围」，并给出改写后的原文。

## 3 · 重点核验项的结论

- **server-config 只存配置、凭证只在 terminal-data-client/state**：成立；代理密码的读取路径见 S-9。
- **command→actor 与三个 selector**：成立，每个 selector 都要求从真实动作读回。
- **undici、ProxyAgent、PMD、系统代理边界**：选型成立；解压上界见 S-10。
- **TDS 就绪、节点号、先摘除再下线**：时序成立；V-S9 见 S-2，默认节点号见 S-3。
- **受管 DEV 拓扑**：成立；夹具复原见 S-5，Node 装配见 S-11。
- **V-B15**：场景设计成立，夹具来源见 S-4。
- **V-S9、V-S15 的执行面**：见 S-2。
- **D-41**：成立，生成配置只含仓内路径，越界即失败。
- **Round 1 DR1 的处理**：不改 Journey、登记为漂移是对的；清单不全，且应列为待 Dexter 裁决，见 S-1。
- **批次三排除**：正确。
- **Codex 第 2 轮的 GO 0/0/0**：没有抓到上面 11 条 S；其中 S-2、S-6、S-7 是对照需求逐条检索就能发现的遗漏。
- **动态验证**：全部未执行，以上都是静态结论。

## 4 · 授权边界

本评审只是对批次二详设与实施计划的静态评审，不授权实施、依赖或锁文件修改、构建、测试、生成、DEV、Testcontainers、reset、seed、L2、UAT、部署，也不涉及批次三。

所有 findings 都是文档层面的修改，Codex 可以在设计授权内修订。S-1 需要 Dexter 先裁决。
