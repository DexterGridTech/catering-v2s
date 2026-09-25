---
title: 受管浏览器 L2 执行标准
status: DEXTER_ACCEPTED
createdAt: 2026-08-25
decisionOwner: Dexter
implementationAuthority: true
---

# 受管浏览器 L2 执行标准

## 1. 目的、边界与唯一正本

浏览器 L2 是在真实 Chromium、真实前端、真实 HTTP、真实 owner 与每 run 隔离的远端
数据库/资产命名空间上，验证批准 Journey 的用户可见结果的受管执行能力。其 Spring/Java 后端、数据库与
对象存储均在受信远端非生产主机；本机只运行两个管理端 Vite、Playwright 及 HTTP/asset ingress。它不等于静态、focused、
Testcontainers、DEV 或 UAT；任何一种证据都不得替代另一种。

本文件是后续 **浏览器 L2 框架、数据、执行、证据与失败处置** 的唯一项目级正本。
它只补充以下既有正本，不复制其一般规则：

- 日志、资源预检、首败和 business/cleanup 分账：
  `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`；
- 前端组件、testId、用户可见语言与 UI 设计对账：
  `doc/platform/frontend-coding-standard.md`；
- 动态授权、DEV/L2/UAT 拓扑与 managed command：`AGENTS.md`、`scripts/README.md`、
  `.agents/skills/cs-managed-runtime-execution/SKILL.md`；
- 每个具体 Journey 的 case、fixture、oracle、时限和批准范围：该 Journey 的 IA、详设、串行计划和
  P1 唯一生成源。

不得新建第二个 browser runner、fixture catalogue、locator 协议、case registry、测试专用 API 或
未被批准的“通用 E2E 框架”。已有 capability 足够时，后续专题扩展其声明和生成链；能力确实缺失时，
先在详设说明为什么现有机制不能表达，再扩同一条受管链。

## 2. 执行面与授权

当前受管浏览器 L2 固定为：远端 Spring Boot、远端 PostgreSQL/对象存储，以及本机
platform-admin、operations-admin 与 Playwright；本机 tunnel 只接通远端 Java HTTP 和 asset ingress，
不转发 PostgreSQL。远端后端通过本 run 隔离的数据库、asset object prefix、diagnostic run id、remote HTTP
port 和 remote control root 绑定到同一 run；manifest 必须记录 host/fingerprint、远端 PID/PGID/boot id/start ticks/
command digest、remote readiness、日志路径与 cleanup readback。它不读取 DEV seed、不修改 DEV 数据、不使用远端浏览器，也不得描述为 UAT。

L2 的真实启动、远端 namespace 创建/清理、凭据与 session 创建都需要 Dexter 的明确动态授权。静态
检查、readiness 建设、P1 生成或 focused proof 不构成该授权，也不得以“已实现 runner”为由自行运行。
获得授权后，只从仓根经受管入口执行；不得手工启动 Spring、Vite、Playwright、SSH tunnel、数据库、
对象存储或 fixture SQL。

每次 run 先按 run-scoped manifest 进行资源预检，只识别本机 `PID + OS start token` 与远端
`host + PID + boot id + start ticks` 的精确 owned identity。不得按端口、进程名或猜测 namespace 停止
任何未知资源。历史 managed tree、超预算 RSS 或残留本 run 资源均必须 fail closed。

## 3. 单一真相与生成链

每一个事实仅有一个住址；L2 只能消费下表的来源，不能复制为手写名单、正则、选择器或第二套数据。

| L2 事实                              | 唯一事实源                                                              | 允许的消费方式                                                   | 禁止的平行事实                                            |
| ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| scenario/case、Journey 与业务 oracle | L2 blueprint 的 `executionSuite`、fixture ref、action 与 expected facts | P1 生成 active candidate、execution profile、Playwright scenario | spec 内手写 case id 列表、删 case 降分母                  |
| 实际激活集合                         | P1 candidate exact-set + 同 run PASS held readiness manifest            | P1 原子写 execution binding，runner exact-match                  | `enabledCaseIds` 人工编辑、按文件名/glob 选 case          |
| TEST fixture 和 readback             | P1 fixture descriptor + managed owner bootstrap/readback                | 由 runner 物化、以 owner/API readback 验真                       | DEV seed、长期 DEV 数据、浏览器 DOM 充当 fixture 真相     |
| 可交互控件                           | app 的 `*TestIds.ts` 常量模块                                           | locator bindings 和 L2 touch record 从常量导出                   | raw CSS/XPath、index 选择器、testId 字符串散写            |
| operation/route                      | generated operation registry 与 blueprint 的 network declaration        | observed request 按 method/route 解析并逐 action 对账            | 手写 endpoint 表、page.evaluate/fetch 绕过 UI             |
| 允许/禁止的网络行为                  | P1 `l2NetworkFlows` 等生成声明                                          | action window 的 required/forbidden/background exact-set         | 宽泛“等待网络空闲”、未声明自动刷新                        |
| timeout                              | P1 timing report（基于已声明操作与拓扑成本）                            | runner 逐 case watchdog 使用报告值                               | 人工加大 timeout、无依据全局 timeout                      |
| 页面状态、草稿与控件级联             | 批准 IA 的 state/control 矩阵，应用真实 state owner                     | 通过用户动作和 readback 验证                                     | L2 自造状态、直接写 Redux/RTK/sessionStorage 绕过 Journey |

### 3.1 · L2 脚本开发前 UI/testId 前置复核

这是 L2 脚本开发的硬准入，不是动态运行失败后的补救。凡新增或修改 L2 spec、runner adapter、locator
binding、blueprint action 的控件声明，必须先完成本节；前置复核未通过时，L2 脚本开发保持阻断。

1. **先对 UI 设计**：重开批准的需求、IA、交互工件、implementation-facing 详设和前端规范，逐项把当前
   UI 源码与行为、形态、动作、关系、位置、可见文案、限制、state/control、失败/恢复、可访问性/焦点、
   数据来源/invalidation 对齐；同时查看同类既有模块与 `libraries/frontend/admin-ui-foundation` 的实际
   消费者，复用已有形态，不因 L2 方便另造控件或交互。
2. **列出实际控件分母**：按每个拟执行的 case/action 穷举 Playwright 将真实 `click`、`fill`、`select`、
   `upload`、`press` 或分页触发的用户控件；Modal/Drawer 的提交与取消、动态行菜单、分页按钮、AntD
   wrapper 后的 native input/file input 都分别列出。只断言文本而不操作的内容不伪装成控件分母。
3. **逐控件核对 testId**：每个控件必须由 app 的 `*TestIds.ts` 唯一源定义稳定 testId，并绑定到真正承载
   用户动作的语义节点；动态行使用稳定业务身份，不使用数组下标。wrapper 有可见触发节点且动作落在
   native input/按钮时，必须让绑定与 touch 记录能区分实际动作节点，不能只给外层容器贴 id。
   对于 AntD `Segmented` 等仓内既有、且组件 API 不暴露 option-level `data-*` 的复合控件，仅当 testId
   挂在该 option 的可见 label/option anchor、点击该 anchor 会触发同一个 option 值、并在分母中注明
   `COMPOSITE_OPTION_ANCHOR` 与 focused/static proof 时允许；这不是给外层 wrapper 或宽 locator 开例外，
   也不得把该特例推广到可直接标记的 Button、MenuItem、Checkbox、Radio 或 file input。
4. **逐项核对 L2 binding**：binding 只能从 testId 常量源导出，spec 不得用 raw CSS/XPath、index、全局
   role/label/placeholder/text 或散写 `data-testid` 补偿缺失 testId。UI 没有合理 testId、testId 不在真实
   动作节点、binding 指向父级而不是动作节点，任一情况都先修 UI 及其 focused/static proof，再回到 L2。
5. **留下准入证据**：详设/实施记录必须附 UI 设计对账、控件分母、`testId` 常量及实际绑定节点、UI
   focused/static proof 和 fresh 独立复核结果；只有 `UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`、
   `L2_SCRIPT_ADMISSION=PASS` 才能写或改 L2 脚本。

可证伪失败条件：任一 L2 action 没有对应 `*TestIds.ts` 常量、常量未挂到真实动作节点、binding/touch 与
实际动作节点不一致，或 UI 与批准设计/既有模块形态存在未处置偏差，则该前置门 FAIL；不得以增加等待、
改用宽 locator、放宽 oracle 或动态运行结果替代修复。

repository byte binding 当前永久只覆盖 `apps/backend` 与 `apps/frontend` 两个目录内、可作为本次
后台/前端运行输入的文件；仓库其他目录不属于该 binding 分母。两个目录内的 managed runtime、build/cache/tool state、
测试产物以及 `.DS_Store`、日志、安装包等瞬态/忽略文件不得进入 binding。当前 runner 的排除策略
必须与仓内工具实际产生的 `.runtime`、`.expo`、`.turbo`、`.yarn`、`.kotlin`、`.vite`、`.next`、
`test-results`、`playwright-report` 目录及 `.DS_Store`、`*.log`、`*.apk`、`*.aab`、`*.keystore`
文件模式一致；binding 自身记录并校验该排除策略。这样运行期间瞬态日志被清理或重建不会伪装成
产品字节漂移，同时真正的源、契约、生成物和配置变更仍会使 binding fail closed。

**红线**：浏览器可见、元素存在、截图、HTTP 200 或 request 发出都不是业务 oracle。每个 case 的
oracle 必须是批准的用户结果，例如 owner readback 值、业务错误文案、失败后事实未变、草稿恢复内容或
焦点归还位置。每个写路径必须有相应负向 case，断言失败后 owner 事实不变。

## 4. 准入、调用顺序与调用方式

任何 L2 run 先完成批准设计与实现的逐项人工对账：行为、形态、动作、关系、位置、用户文案、限制、
state/control、失败/恢复、可达性/焦点、数据来源/invalidation 均与 IA 一致。任一不一致先修实现或
设计，不得用 L2 试错。

在已有 catalog 链中，受管调用顺序固定如下；其他专题复用同一模式并使用各自的 P1 生成源：

```bash
# 1. 先建立本 run 隔离资源、fixture、凭据、进程与 held readiness。
node scripts/test/browser-l2-runtime.mjs readiness

# 2. 仅把上一步输出的同 run readiness manifest 交给唯一生成源，生成并核对 active exact-set。
CATALOG_INVENTORY_L2_READINESS_MANIFEST=<readiness-manifest.json> \
  node scripts/generate/catalog-inventory-p1.mjs --write --check

# 3. 按该 Journey 已批准且遵守输入依赖的生成链继续核对；不得手写 generated output。
# operation-handler-bindings 先刷新 workspace token 与 M1 共同消费的唯一 binding 输入。
node scripts/generate/operation-handler-bindings.mjs --write --check
node scripts/generate/catalog-inventory-workspace-command-tokens.mjs --write --check
node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --emit --check
node scripts/generate/catalog-inventory-p3-frontend.mjs
node scripts/generate/catalog-inventory-p3-frontend.mjs --self-test

# 4. 生成链稳定后，在同一 held run 上由 runner 刷新受管 Vite，再最终绑定当前仓库字节。
node scripts/test/browser-l2-runtime.mjs finalize

# 5. 只由受管 runner 执行已经绑定的 active exact-set。
node scripts/test/browser-l2-runtime.mjs run
```

首败根因定位可以在同一受管链上显式执行一个生成的 case：
`node scripts/test/browser-l2-runtime.mjs run --case <generated-case-id>`。这只是
`FOCUSED_DIAGNOSTIC`，仍先校验 P1 active candidate 的完整 exact-set，并使用同一 run 的 fixture、凭据、
日志、join 与 cleanup；它只执行指定 case，manifest 的 `business` 必须为 `NOT_RUN`，不能作为 SM-05 完成证据，
也不能替代根因修复后的完整 active-set run。`<generated-case-id>` 必须来自当前 P1 生成的 case 集合，不能用文件名、
glob 或手写平行名单。

具体生成器名称可由后续获批专题替换，但五个阶段不可省略：**readiness → same-run activation →
generated-chain exact check → same-run frontend refresh and byte-binding finalize → managed browser run**。
`finalize` 在写入 binding 前只停止并重启本 run 自己拥有的两个 Vite 进程，清除生成链对旧开发服务器
留下的 HMR 队列；它不重建远端 namespace、不重跑 fixture，也不启动新的 browser run。浏览器执行结束后
runner 还会再次校验同一 binding，任何运行期间的 repository drift 都会使 business 失败。readiness 必须为 `businessStatus=PASS`、
`setupCleanupStatus=PASS`、`cleanupStatus=PENDING_HELD`、`lifecycle=HELD_FOR_BROWSER_L2_RUN`；
run binding 必须同 runId、namespace、database、asset prefix，active case set 必须与 candidate 一字不差。
任一条件不满足，runner 在浏览器 business 前失败。

### 4.1 · 运行器入口准入与重跑纪律(Dexter 2026-09-25)

上面的调用顺序只在执行者遵守时才有效。门店终端批跳过准入,L2 跑了 36 次只通过 1 次:同一「运行绑定不匹配」
3 分钟内连续 3 次,运行期间改源码造成字节漂移 5 次。以下四条从纪律改为运行器入口检查:

1. **准入**:运行器在 `readiness` 之前读取本批详设 §3a 的 `L2_SCRIPT_ADMISSION` 与独立复核记录;缺失、非 PASS,
   或准入覆盖的 L2 控制面文件与 UI 目录在准入之后有改动,拒绝启动。运行器只核对准入存在且覆盖当前字节,不做语义判定。
2. **不许无变更重跑**:上一轮同一 case 失败,且该 case 绑定的文件字节没有改动,拒绝启动,并提示先按
   `playwright-results.json` 的错误与堆栈静态定位。
3. **执行配置只在本 run 生成**:执行配置只能由运行器在同一 run 内调用唯一 P1 生成器产出;外部传入或历史留下的一律拒绝。
4. **持有期间不改字节、同时只跑一个**:held run 期间不得改动 binding 范围内的文件;同一时间只允许一个受管运行。

实现状态:以上检查由实施方在运行器中落地;落地之前,执行者按本节人工遵守,并在准入记录中写明。

## 5. 运行期进度、日志与 join 证据

runner 必须在 stdout 与 `progress.jsonl` 同时输出：队列 ready、每个 case 的 START/COMPLETE、
`INDEX/TOTAL/COMPLETED/REMAINING`、结果累计与 active case watchdog。心跳只补充 runner/资源状态，
不得替代 case 级进度。进度记录的分母必须与 active exact-set 相同；每一 case 恰一条 START 和一条
COMPLETE，顺序、累计完成数与 remaining 均受验证。

每个用户 action 形成可关联的最小闭环：

```text
caseId / actionId / testId
  → requestId / correlationId / generated operation
  → HTTP completion / backend phase
  → DB operation count / section counts
  → approved business oracle
```

action-request join artifact 只能含上述诊断键与脱敏结果；不得记录商品/人员名称、搜索词、识别码、制作说明、
草稿、query/body、SQL/bind、password、OTP、token、cookie、Authorization、原始 IP、signed URL 或
storageState 内容。未声明网络、缺 request/completion/DB row、跨 action 归属不唯一、section 不一致、
缺 testId touch 或 artifact 不可读必须 fail closed，不得用重试或等待掩盖。

## 6. fixture、secret、恢复与 cleanup

fixture 只可由 managed bootstrap 通过真实 owner/API 写入，并在运行前做 owner readback；TEST fixture 与
DEV seed 的数据、artifact、生命周期及证据严格隔离。凭据/session 每 run 新建，使用最小 child-process
allowlist 注入，文件 mode 为 0600；manifest 只保留路径、mode、存在性、key-set digest 与非 secret binding
metadata，绝不记录 raw secret 或其可逆摘要。缺失、额外、格式非法、过期、跨 run、namespace 不匹配或
泄漏分别使用明确 failure code，均在 browser business 前 fail closed，仍执行已拥有资源的 cleanup。

恢复场景是用户 Journey 的独立 flow：它必须在新的 BrowserContext 中使用同 run generated headers、正确
scope 的真实登录、真实 UI whole-save 与 response/readback；不得直接改 lifecycle/state/version 来伪造冲突。
正常成功/失败 flow 不得为恢复 retry 获得额外未声明网络预算。

cleanup 固定按 session/storageState → run asset prefix/database/role → owned tunnel/process tree →
credential/session files → local absent 与 remote namespace zero-residue readback 执行。business、local cleanup、
remote DB cleanup、remote asset cleanup 必须分别写 manifest 与 stdout；任一 cleanup 非 PASS，整次 L2
不得完成。

readiness 在 held run 建立前失败时，也必须为本 run 持久化精确的 cleanup recovery state；若 cleanup 失败，
该 state 保持 `CLEANUP_REQUIRED`，不得写成可继续业务运行或不可恢复的终态。受管 cleanup 允许接收同一
run 的 `readiness-manifest.json`（仅限 `status=FAIL` 且 `cleanupStatus=FAIL`），按其已验证的 run binding、
process identity、remote host 与凭据文件路径重建 cleanup state；不得接受其他 run、手工拼接的 namespace、
端口或进程名推断。直到 cleanup PASS 前，不得创建新的同类 managed run。

readiness、P1 finalize、browser run 与 recovery cleanup 共用 run-root lifecycle admission；任何阶段都不得
与另一阶段或另一 run 并发持有远端 HTTP 端口或本机 Vite。新 readiness 不只读取共享 current-state 指针，
还必须扫描 runtime root 下所有 run-scoped state，发现 `READY` 或 `CLEANUP_REQUIRED` 即 fail closed。cleanup
除 state 中的 processIdentities 外，还必须读取该 run 目录由 managed spawn 写出的 identity 文件，并按
`PID + start token + process group` 逐一核验后停止，覆盖刷新进程尚未回写 state 的失败窗口；不得按端口或
进程名补偿清理。

## 7. 通过条件、失败纪律与可复用检查

一次 L2 仅在下列条件全部成立时为 PASS：

1. discovered = selected = results = 同一 active exact-set；
2. 每 case 业务 oracle PASS，所有 required controls 已被真实 touch，声明 testId 集合与 L2 touch 差集为空；
3. action join 完整、operation/network declaration exact、无未归类/跨 action 事件；
4. `firstFailure=null`，`lastKnownGood`、`brokenBoundary`、timing、run-scoped logs 与 artifact 均可读；
5. business 与四项 cleanup 都为 PASS，并有本机/远端 readback。

运行中首败必须立即保留：`firstFailure`、`lastKnownGood`、`brokenBoundary`、活跃 case、对应日志/manifest。
同一 signal 再次尝试前必须完成日志、owned PID/namespace、runner state 与 join 边界诊断；不得延长 timeout、
盲目轮询、删 case、降 oracle、改为 focused proof、fallback 或兼容分支止血。根因修复后必须 fresh run，
不复用旧 namespace、session、readiness 或动态结果。

每个 L2 扩展还必须保留真实 red mutation：candidate/exact set、testId binding、fixture/readback、request join、
completion/DB section、progress、secret binding 和 cleanup 的各自违反均应使对应 gate 变红；一个泛化
`throws` 不得冒充多项证明。机器门只承载可机械判定的形态；Journey、文案、用户任务与交互合理性仍由
批准 IA 的逐项对账和独立 review 判断。

## 8. 后续 agent 的工作清单

1. 先读取本标准、`AGENTS.md`、`scripts/README.md`、适用 IA/详设、P1 和现有 runner；
2. 先确认授权与拓扑，再检查是否可在现有 L2 capability 中表达，禁止平行基建；
3. 在写 case/fixture/runner 前，声明其唯一来源、用户 oracle、负向不变事实、network exact-set、
   testId、timeout 和 cleanup readback；
4. 执行时仅用受管入口，持续报告每 case 的可观测进度，并分开报告 business/cleanup；
5. 结束前以本标准第 7 节和批准 IA 逐项回读；静态、focused、Testcontainers、DEV、L2、UAT 的证据边界逐项写明。
