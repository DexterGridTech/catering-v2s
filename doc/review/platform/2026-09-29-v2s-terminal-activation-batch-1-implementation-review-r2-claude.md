# 终端激活与长连接 · 批次一实现静态评审 第 2 轮（Claude）

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/6/3
L1_ENGINEERING=findings：S-1～S-6、N-1～N-3；各条判据已按 Dexter 要求降低（§7）
L2_USER_VISIBLE=PASS：批次一唯一的界面改动 TER-E01（编辑态设备类型只读，apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalDeviceTypeField.tsx 第 9～17 行），与交互工件一致；本轮没有新的界面改动
L3_UNVERIFIED=见 §5
SAME_ROOT_SCAN=见各 finding 的「同族全集」
DESIGN_GAPS=见 §4
TEMPLATE_COVERAGE=NOT_APPLICABLE：本轮是实现评审，不是设计评审
TR16=NOT_APPLICABLE：批次一没有 TER 代码
EVIDENCE_TIER=STATIC_SOURCE_ONLY：只读仓内源码与文档，没有运行构建、测试、生成器或任何受管运行。三条承重的第三方行为按官方源码核实：reactor-core 3.8.7 的 BoundedElasticScheduler、pgjdbc 42.7.11 的 PGStream 与 QueryExecutorImpl、RFC 7692，原文只读下载到会话临时目录。Codex 报告里的动态结果没有独立复核
REVIEWER=Claude 主会话；续接会话，从 v2s 仓根发起，不是 fresh 会话；按 Dexter 对本批的指示「不要子agent盲审了，全都由你来审」，未派子 agent
```

## 0 · 评审方式

- Codex 经 Dexter 中转请求本轮评审，Dexter 追加的要求是：「不要紧盯证据，请对代码逐行做静态review，关注代码逻辑」。所以本轮逐行读了生产代码，对照需求与详设判断逻辑是否成立；验收计数、对账台账与运行记录只在需要时引用，没有逐项复核。
- 逐行读过的生产代码：
  - `modules/terminal-binding` 的 api、application、domain、persistence 全部 17 个文件；
  - 迁移 `V20260926_000000_000__terminal_binding_owner.sql`；
  - 终端 edge 的 5 个文件；后台取消与作废联动的两个协调器；`ContractProblemAdvice` 中与终端相关的映射；
  - 门店终端中被本批改动的方法：`lockActivationCandidate`、`resolveOperationsActivationCancellationTarget`、`replaceTerminal`、`transitionTerminalStatus`，以及相关持久层；
  - TDS 的全部生产代码，约 4,000 行；
  - 前端的设备类型字段。
- 测试代码只读了与 finding 直接相关的部分。
- 13c 逐代码与详设对账仍为 OPEN。本轮评审不替代它。

## 1 · 上一轮问题的复核

- **M-1（一批判据没有场景）**：部分解决。详设 §11 第 568～587 行已为 V-S1、V-S3、V-S4、V-S6、V-S8、V-S9、V-S11、V-B1、V-B6、V-B7、V-B13 登记了场景。本轮仍发现两处缺口，已并入 S-4、S-5：V-B5 的拒绝分支，以及 V-B10 的逐条断言。
- **S-1（凭证格式写了三份）**：已解决。
  - 凭证只在 `terminal-binding/api/TerminalCredentialParser.java` 一处解析，TDS 编解码、设备取消 edge、激活 edge 都调用它；
  - owner 不再解析 HTTP 头，`CancelTerminalActivationOperation` 接收的是 edge 解析好的 `TerminalCredentialContext`；
  - 集团空间编码统一走 `execution-context` 的 `GroupWorkspaceKey`。
- **S-2（JSON 限额架空 D-43）**：已解决。`TdsWireJsonConfiguration.java` 第 15～20 行把各项限额放宽到 65,536，嵌套深度放宽到 64。
- **S-3（日志门没有覆盖新代码）**：静态上已解决。`tools/verify-gates/cli.mjs` 第 1328～1329 行已把 `modules/*/src/main` 与 TDS 的 `src/main` 加入扫描根。红夹具没有复跑。
- **N-1（两个逐字相同的限流类）**：仍在，归入 N-3，属于交付后清理（D-46）。
- **N-2（自写异步日志与多余的调度跳转）**：注册路径的跳转已去掉；撤销通知解析处还有一次同样的跳转，并入 S-2。
- **N-3、N-5**：未变，属于交付后清理或交付后评估。
- **N-4（死代码）**：`additionalFields` 分支已删；替换审计的允许字段里仍有 `deviceType`，归入 N-3。

## 2 · 方案合理性

- **问题对不对**：对。批次一要解决的是设备凭激活码成为某台终端、后台能收回绑定、设备与 TDS 建立受控长连接。代码覆盖了这些路径。业务后端一侧的判定顺序、锁顺序与事务边界都与需求一致。
- **写得好的部分**（逐行核过）：
  - 激活的判定顺序与详设 §8 完全一致：先识别同一操作的重试，再按 R-1.4 第 1～8 项判定，然后判第 9 项，最后才是新激活（`TerminalBindingOwnerService.java` 第 52～115、286～321 行）；
  - R-4.7 的判定集中在 `TerminalCredentialDecision`，TDS 认证与设备取消共用；
  - 锁顺序统一为先终端后绑定；
  - 最新值用数据库序列排序，迟到的写入不生效；
  - 断开记录写库成功之后才释放许可；
  - 停机顺序依次是：下线、停 web 服务、写入器最后一次写库、停监听器。
- **方案优不优、代价配不配**：TDS 的并发结构比需要的复杂，本轮的 S-1、S-2、N-2 都出自这里。
  - 结构是：4 个有界线程池，actor 的每一步都跳到数据库线程池，JSON 编解码跳到编解码线程池，撤销监听器的无限循环也挂在共用的数据库线程池上。
  - 这样做的起因是详设要求 BlockHound 零放行名单，于是把所有小的 CPU 操作都挪出事件循环；每挪出一步，就多一次容量耦合和一种失败方式。
  - 作者没有列出的替代方案：
    - 只有阻塞的 JDBC 调用放进线程池；
    - 监听器用自己的单独线程；
    - 64 KiB 以内的 JSON 编解码留在事件循环上，如果 BlockHound 确实报 Jackson，就加一条经评审、精确到方法的放行；
    - 不阻塞的 actor 操作直接执行。
  - 取舍：多一条经评审的放行项，换来去掉两个线程池和三类容量耦合。按 Dexter「长期主义、职责清晰」的倾向，这个替代方案值得在修 S-1、S-2 时一并评估；最终怎么修，由 Codex 在详设里给出并说明理由。

## 3 · Findings

### S-1 · 撤销监听器的无限循环占着共用的数据库线程，排到它后面的任务永远不会执行

- **详设位置**：§10.3（第 413 行），只写了监听器用「一条专用 PostgreSQL 连接」，挂在「named bounded blocking worker」上，没有要求专用线程。
- **实现位置**：
  - `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java` 第 84 行：`databaseScheduler.schedule(this::runListener)`。第 102～122、139～175 行是循环，停机前不会返回。
  - `.../config/TdsSettingsConfiguration.java` 第 27～31 行：`tds-db-worker` 最多有 U+2 个线程（U 为未认证连接上限），每个线程的队列上限也是 U+2。
  - 同一个线程池上还跑着这些任务：
    - 认证读库（`TdsWebSocketHandler.java` 第 349 行）；
    - actor 的开始、记录、注册、拒绝与断开（`TdsTerminalSessionActors.java` 第 86、133、146、156、166 行）；
    - 状态写入器的周期任务（`TdsConnectionStateWriter.java` 第 72 行）。
  - `TdsTerminalSessionActors.java` 第 159～168 行：`connectionClosed` 投出去后不管结果，也没有错误处理。
- **第三方事实**（官方源码，reactor-core [v3.8.7 `BoundedElasticScheduler.java`](https://github.com/reactor/reactor-core/blob/v3.8.7/reactor-core/src/main/java/reactor/core/scheduler/BoundedElasticScheduler.java)）：
  - 第 303～313 行：每个任务交给选中那个后台线程自己的执行器；
  - 第 617～661 行：先用空闲线程，没有空闲线程且未到上限时新建线程，否则调用 `choseOneBusy()`；
  - 第 663～685 行：在忙碌的线程里选 `markCount` 最小的，并列时取数组里最靠前的一个。
  - 这个线程池不做工作窃取。
- **推论**：
  - 监听器最先启动，占的那个线程一直在忙，`markCount` 恒为 1，而且大概率排在数组最前面。
  - 所以线程池满载时（U+2 个线程都在忙，DEV 下 U=4 时就是 6 个），新任务可能排到监听器那个线程的队列里，而那里的任务要到停机才会执行。
- **影响**：
  - 卡住的若是 `connectionClosed`：actor 会把已经关掉的连接一直当作在线会话，断开记录永远写不进库，在线许可也不释放，直到同一终端重连到本节点才会被替换掉；
  - 卡住的若是认证读库或注册：设备在 15 秒后收到「认证超时」。
  - 满载的触发条件：成批重连或成批断开，这是推论，没有动态复现。
- **同族全集**：
  - 在 `tds-db-worker` 上长期占住线程的任务只有监听器这一个。写入器的周期任务每次跑完就返回，不算。
  - 投出去不管结果的只有 `connectionClosed` 这一处。
- **最小可验收修正**（判据，已按 Dexter 要求降低，见 §7）：
  - 监听器改用自己的线程，不再挂在 `tds-db-worker` 上；一个单元测试断言监听循环不在 `tds-db-worker` 上运行；
  - `connectionClosed` 调度失败时不能静默丢失：用会拒绝执行的调度器写一个单元测试验证；
  - 不要求满载压测。
- **需 Dexter 裁决**：否。
- **分类**：机制是 CONFIRMED（按源码核实）；触发频度是 PLAUSIBLE。

### S-2 · 编解码线程池的容量按未认证上限推导，却承担每一条 PING 与每一条撤销通知；池满时会关掉正常会话或重置监听器

- **详设位置**：
  - 第 46 行把编解码线程池的容量定为 C=max(1, min(U, CPU 核数))，排队上限约 C²，DEV 下最多排 16 个任务；
  - §10.2 要求「event loops only frame messages」，把编解码挪出事件循环。
- **实现位置**：
  - `.../config/TdsSettingsConfiguration.java` 第 45～57 行；
  - `.../websocket/TdsWebSocketHandler.java`：
    - 第 449～454 行：每条 PING 的解码与 PONG 的编码都投到编解码线程池；
    - 第 469～470 行：除 IllegalArgumentException 以外的任何错误，包括线程池拒绝执行，都以 `SERVER_ERROR` 关闭已认证的会话；
    - 第 231～236、257～258 行：认证首帧的解码被拒时，同样以 `SERVER_ERROR` 关闭。
  - `.../session/TdsBindingRevocationListener.java` 第 177～188 行：解析约 80 字节的通知时，先投到编解码线程池再 `block(1s)`。失败会抛出 SQLException，监听器随即断开重连；这期间 `ready=false`，新连接一律以 `SERVER_ERROR` 被拒（`TdsWebSocketHandler.java` 第 89 行）。
- **性质**：
  - 容量公式与出错路径是事实。
  - 这个线程池的负载随已认证会话数与 PING 频率增长，而容量只随 U 与 CPU 核数增长，这一点是按代码推导出的。
  - 同时待执行的编解码任务一旦超过 C + C²（DEV 为 20，8 核生产机为 72），多出的任务会被拒绝执行。例如一次 GC 停顿或网络抖动之后，PING 集中到达。
- **影响**：TDS 自己断开正常会话，设备 10～15 秒后重连；撤销通知解析失败会让监听器重置，重置期间节点拒绝所有新连接。丢掉的通知会在重连后的对账里补回，所以数据最终是对的。
- **同族全集**：编解码线程池的使用点只有三处：认证首帧、PING/PONG、撤销通知解析。已全部列出。
- **最小可验收修正**（判据，已降低）：
  - PING 路径不因编解码池拒绝执行而关闭已认证会话：用会拒绝执行的调度器写单元测试，断言仍返回 PONG、会话不被关闭；
  - 撤销通知的解析不经过编解码池，由单元测试覆盖；
  - 不要求满载压测。
- **需 Dexter 裁决**：否。
- **分类**：机制是 CONFIRMED；触发频度是 PLAUSIBLE。

### S-3 · R-4.4 第三点被详设改写：旧会话「被取代」同时「凭证已作废」时，收到的是「被新连接取代」

- **需求**：R-4.4 第三点：「旧会话同时满足『被取代』与『凭证已作废』时，关闭原因取『已取消激活』」。
- **详设位置**：§10.5（第 441 行）「D-29 must close the old socket as `SESSION_REPLACED`」。D-29 只规定有新连接时立即淘汰旧会话，没有规定关闭原因。
- **实现位置**：
  - `.../session/TdsTerminalSessionActors.java` 第 358～366 行：只有当撤销通知已经到达本节点（`generationRevoked`）时，才取「已取消激活」。
  - 其实新会话校验时已经读到更高的当前代次，旧代次已作废是确定的事实（R-4.7 第 2 步），代码没有用它。
- **测试**：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java` 第 2314～2360 行（`v10StaleRevocationAfterReactivation`）。场景是同一设备再次激活、撤销通知被扣住、新代次的会话建立；第 2358～2359 行断言旧会话收到 `SESSION_REPLACED`，与需求相反。
- **影响**：旧会话的设备保留身份，10～15 秒后重连才收到「已取消激活」。结果最终一致，但违反了需求的明文规则，而且测试把错误行为写成了期望。
- **同族全集**：会话被取代时决定关闭原因的只有这一处；`abandonOpenedSession` 的情形见 §4 第 4 条。
- **最小可验收修正**：
  - 新会话的已校验代次大于旧会话代次时，旧会话以 `ACTIVATION_CANCELLED` 关闭；actor 的单元测试加一例；
  - 现有场景 `v10StaleRevocationAfterReactivation` 的断言改为 `ACTIVATION_CANCELLED`（修复后原断言必然失败，本来就要改）；
  - 详设 §10.5 的相应句子同步改正。
- **需 Dexter 裁决**：否，需求原文明确。如果 Codex 认为 D-29 另有含义，再交 Dexter。
- **分类**：CONFIRMED。

### S-4 · 后台取消：「终端未激活」的 HTTP 状态码与详设不符，V-B5 的四个分支没有真实 HTTP 场景

- **详设位置**：
  - §5a 第 275 行：`TERMINAL_BINDING_NOT_ACTIVE (404), TERMINAL_BINDING_CHANGED (409)`；
  - §11 第 519、541 行：V-B5 的受管场景要覆盖「no-active、changed-generation、rejected replay recheck、disabled-store denial」。
- **实现位置**：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsTerminalActivationProblem.java` 第 24～26 行，两种拒绝都返回 409。
- **测试**：`StoreTerminalAcceptanceScenarios.java` 中后台取消只有第 143、389、397、412 行这 4 次调用，都带着当前代次（分别是成功、同键重放、只读账号 403）。「绑定已变化」「终端未激活」、首次被拒后的重放、门店停用这四个分支，只有 `TerminalBindingOwnerServiceTest.java` 第 159 行的单元测试，没有真实 HTTP 场景。
- **影响**：契约上的状态码与详设不一致；V-B5 的四个分支没有在真实入口上验证过。
- **最小可验收修正**（已降低）：
  - 状态码与详设一致；如果选 409，就回写详设并说明理由；
  - 不新增场景。在现有的后台取消场景里加两次调用：用旧代次调用，得到 `TERMINAL_BINDING_CHANGED`；取消后再调用，得到 `TERMINAL_BINDING_NOT_ACTIVE`。断言状态码与错误码，审计条数不变；
  - 「首次被拒后的重放重新判定」「门店停用」两个分支由单元测试覆盖；这项降档按 D-48 写回详设 §11。
- **需 Dexter 裁决**：否。
- **分类**：CONFIRMED。

### S-5 · 已结束的绑定再被激活时，审计原因记成「再次激活」；V-B10、V-B6 要求的逐条审计断言没有实现

- **需求与详设**：
  - R-3.6 分别列出「激活」与「同一设备再次激活」；R-1.5 定义后者为 `deviceId` 与**当前有效**绑定相同。
  - V-B10 要求「发起方与原因正确」；V-B6 要求作废的审计「原因为『终端作废』」。
  - 详设 §11 第 546 行：V-B10 要逐条核对五种变化的发起方与原因；设备发起的记录无 id、使用固定显示名。
- **实现位置**：
  - `.../terminalbinding/application/TerminalBindingOwnerService.java` 第 77～78 行：`current == null ? ACTIVATED : REACTIVATED`。只要终端有过绑定记录，即使已经被取消或作废，新的激活也记为 `REACTIVATED`。
  - 绑定行里「最近一次结束的原因」没有被改写（`TerminalBindingOwnerPersistence.java` 第 134～141 行），所以只有审计记错了。
- **测试**：只断言条数。见 `StoreTerminalAcceptanceScenarios.java` 第 417 行等处，辅助方法在第 2887～2898 行；全仓没有断言审计的发起方类型或原因。
- **影响**：审计把「绑定取消后的重新激活」归成「同一设备再次激活」，换机后由另一台设备激活的情形也在其中；本该抓住这个问题的判据没有实现。
- **同族全集**：审计原因的来源只有这一处；五种变化的其余四种（设备取消、后台取消、作废、同一设备在有效绑定下再次激活）标注都正确。
- **最小可验收修正**（已降低）：
  - 原先的绑定已结束时，新激活记为 `ACTIVATED`；只有替换**有效**绑定时才记 `REACTIVATED`；
  - owner 单元测试两例：绑定已结束后激活，记 `ACTIVATED`；有效绑定下同一设备再次激活，记 `REACTIVATED`；
  - V-B10 与 V-B6 的逐条断言降为这组单元测试，不改验收场景；这项降档按 D-48 写回详设 §11。
- **需 Dexter 裁决**：否。「激活」与「同一设备再次激活」的区分按 R-1.5 的定义判断，属于需求原文。
- **分类**：CONFIRMED。

### S-6 · 监听器重连后的对账为每个被跟踪的会话绑定两个参数，超过 32,767 个会话就会失败，监听器将永远就绪不了

- **详设位置**：第 42 行规定在线会话上限可取 1 到 2,147,483,647；没有推导单节点的实际上限。
- **实现位置**：
  - `.../state/TdsConnectionStateRepository.java` 第 156～193 行：每个 key 两个参数，全部拼进一条 `VALUES` 语句；
  - 调用方是 `TdsBindingRevocationListener.java` 第 132～135 行，每次重新 LISTEN 之后都要执行。
- **第三方事实**：pgjdbc [REL42.7.11 `PGStream.java`](https://github.com/pgjdbc/pgjdbc/blob/REL42.7.11/pgjdbc/src/main/java/org/postgresql/core/PGStream.java) 第 395～400 行，`sendInteger2` 只接受 0～65535；`QueryExecutorImpl.java` 第 1786 行用它发送 Parse 消息里的参数个数。
- **推论**：本节点被跟踪的会话与待认证的连接合计超过 32,767 时，每次对账都会失败，监听器反复重连，始终到不了就绪。后果有两个：
  - 本节点拒绝所有新连接（`SERVER_ERROR`）；
  - 撤销通知收不到，已取消激活终端的旧会话一直在线，直到它自己断开。
- **影响**：触发条件远高于当前 DEV 与验收的配置；生产的单节点规模还没有定。但一旦触发，撤销机制就失效，所以按 S 处理。
- **最小可验收修正**（判据，已降低），二选一：
  - 对账的参数个数不随会话数增长，例如改用数组参数；一个单元测试断言参数个数固定；
  - 或者在详设里给出单节点会话上限，TDS 启动时校验；`TdsRuntimeSettingsTest` 加一条超上限的红例；
  - 不要求按三万以上的规模构造测试。
- **需 Dexter 裁决**：否。
- **分类**：机制是 CONFIRMED；触发条件是 PLAUSIBLE。

### N-1 · 自写的解压器把 RFC 7692 允许的 BFINAL=1 块当作协议错误

- **实现位置**：`.../websocket/TdsBoundedPmdDecoder.java` 第 106～108 行，`inflater.finished()` 就报错；第 122 行，有剩余输入也报错。
- **外部事实**：RFC 7692 §7.2.1 写明「An endpoint MAY use both DEFLATE blocks with the "BFINAL" bit set to 0 and DEFLATE blocks with the "BFINAL" bit set to 1」，§7.2.3.4 给了示例。
- **影响**：目前的真实客户端（OkHttp、浏览器、Node）不发这种块，不会触发。这条说明手写协议层有自己的合规风险，可作为交付后评估「改用库自带压缩」的依据之一。
- **分类**：CONFIRMED。

### N-2 · 注册时持有 actor 锁写库，监听线程在撤销时要进同一把锁

- **实现位置**：
  - `.../session/TdsTerminalSessionActors.java` 第 283～376 行：`repository.open` 写库发生在 actor 的锁内（第 326 行）；
  - 第 170～176 行：撤销在 `ConcurrentHashMap.computeIfPresent` 里调用 actor，需要同一把锁；调用方是唯一的监听线程（`TdsBindingRevocationListener.java` 第 151 行）。
- **影响**：某台终端注册写库慢时（最长为语句超时 4 秒加 socket 超时 5 秒），整个监听线程被挡住，所有终端的撤销都要等，而且同一哈希桶的 map 操作也被挡住。上限有界，所以记为 N。
- **分类**：CONFIRMED。

### N-3 · 交付后清理的残留（D-46 安排单独清理）

- 两个限流类仍然逐字相同：`websocket/UnauthenticatedConnectionLimiter.java` 与 `session/TdsTrackedSessionLimiter.java`。
- `TerminalBindingOwnerPersistence.java` 第 101～124 行：`insertFirstActive` 的 `storeRef` 参数没有被使用。
- `StoreTerminalOwnerService.java` 第 67 行：替换审计的允许字段里仍有 `deviceType`。
- **分类**：CONFIRMED。

## 4 · DESIGN_GAPS

1. **R-4.4 第三点被详设改写**：见 S-3。详设 §10.5 需要改回需求的规则。
2. **线程池的容量推导与线程归属**：见 S-1、S-2。详设只按 U 推导各池容量，没有区分负载的来源：编解码的负载随在线会话增长；监听器是长期占用。也没有要求监听器使用专用线程。
3. **单节点会话上限**：见 S-6。详设允许的取值范围与对账查询的实际能力不符，需要给出上限及依据。
4. **注册在写库之后失败时，现有会话怎么处理**：
   - `TdsTerminalSessionActors.java` 第 499～520 行的做法是：以 `SERVER_ERROR` 关闭新连接，也关闭本节点上这台终端原有的会话。
   - 理由成立：库里的最新值已经指向新会话，旧会话无法再被正确记录。
   - 但这偏离了 R-4.4「认证失败的连接不影响现有会话」的字面，详设应写明这种情形、关闭原因与理由。
5. **激活后的审计原因**：见 S-5。详设没有写明「绑定已结束后的激活」记为哪个原因。
6. **沿用上一轮第 2 条**：TDS 没有配置 Hikari 的 `maximum-pool-size`，默认只有 10 个连接，而数据库线程池有 U+2 个线程；U 较大时，多出的线程要排队等连接，最多等 2 秒，超时后认证以 `SERVER_ERROR` 失败。详设仍没有这条判据。

## 5 · 未验证清单

- **静态证明**：
  - 激活与取消的判定顺序、锁顺序、事务边界；
  - 凭证与集团空间编码的唯一解析点；
  - JSON 限额；
  - 最新值的序列比较；
  - 写入器的顺序与许可释放；
  - 下线与停机的顺序；
  - 前端编辑态只读。
- **只有 Codex 的动态记录、本轮没有复核**：backend-acceptance 198/198、TDS CONTRACT 49/49、V-S14 9/9、Browser L2 6/6、seed dry-run、operation identity 296/296、RSS 读数。
- **没有人验证过**（按产品负责人能直接理解的说法写）：
  - 大批设备同时重连或同时掉线时，TDS 会不会卡住部分连接的收尾，导致在线名额越用越少（S-1）；
  - 在线设备很多、心跳集中到达时，TDS 会不会主动踢掉正常在线的设备（S-2）；
  - 单节点在线超过约三万两千台设备时，撤销还能不能生效（S-6）。
- **本轮没有深入的部分**：R-12 门的闭包与红夹具、D-41 仓内依赖边界、真实验收拓扑、日志与 cleanup 证据、13c 对账。

## 6 · Codex 核验重点逐项结论

- **激活重试、D-40、D-38**：正确。重试识别、第 9 项的判定、最近一个已结束代次的摘要，都与需求一致。
- **owner、事务、审计**：
  - owner 边界、同一事务内的通知、作废联动都正确；
  - 审计原因见 S-5，后台取消的拒绝路径见 S-4。
- **终端类型只读**：正确。后端 strictBody 拒绝 `deviceType`，前端编辑态只读。
- **终端凭证认证**：正确。解析点唯一，`Authorization` 头只接受一个值。
- **未知字段规则**：正确。TDS 忽略未知字段，已知字段照常严格校验，限额已放宽。
- **TDS 的字段、时序、压缩与消息上界**：首帧 10 秒、总时限 15 秒、心跳超时、1009、有界解压都正确；合规边角见 N-1。
- **通知与会话生命周期**：逻辑正确；并发与容量上的缺陷见 S-1、S-2、S-3、S-6、N-2。
- **V-S12、V-S14 的故障路径**：数据库不可用时，已建立的会话保持，新连接以 `SERVER_ERROR` 被拒，逻辑正确。监听器的恢复受 S-2、S-6 影响。
- **R-12 生成与验证门的闭包、D-41、真实拓扑、日志与 cleanup 证据**：本轮按 Dexter 的要求不看证据，没有复核。

## 7 · 授权边界

- 本评审只是静态 review，不授权再次运行动态验收、修改代码、部署、DEV、reset、seed、L2、UAT，也不涉及批次二、批次三。
- 结论 NO-GO。findings 交 Codex 在批次一既有的批准边界内修复，都不需要 Dexter 另行裁决；S-3 例外，如果 Codex 对 D-29 另有理解，交 Dexter。
- 本评审不替代 13c 逐代码对账。
- **验收要求已降低**（Dexter 2026-09-29，话术发出前）：
  - 各 finding 的判据以单元测试为主，不要求满载压测和大规模测试；
  - V-B5 的两个分支，以及 V-B10、V-B6 的逐条断言，降为单元测试，按 D-48 写回详设 §11；
  - 本轮修复只需要 `scripts/verify` 与 backend-acceptance（含 TDS 场景），不需要 L2、reset、seed；
  - 本轮修改影响不到的判据，可沿用最后一次通过的结果，报告中注明那次结果对应的代码版本。
- 会话出处：续接会话，由 Claude 主会话完成，没有派子 agent；第三方源码与 RFC 只读下载到会话临时目录，没有写入仓库。
