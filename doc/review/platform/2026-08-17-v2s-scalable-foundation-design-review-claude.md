# 20 倍业务量的健壮底座 · DESIGN review(Claude 独立)

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `DESIGN` |
| reviewerKind | `CLAUDE_INDEPENDENT_REVIEW` |
| 会话出处 | fresh v2s-rooted;续接自同一 Dexter 会话的需求定稿阶段,**已声明,不冒充 fresh acceptance** |
| 利益冲突声明 | **需求正本 `2026-08-16-...-requirements-claude.md` 由本 reviewer 撰写**;涉及需求判据本身的缺陷单列在 S-2,不因作者是自己而豁免 |
| 动态执行 | 未运行。未授权 DEV / reset / seed / HTTP / L2 / UAT / Testcontainers |
| 亲验方式 | 全部结论重开源码亲验;`grep` 单行匹配得出的否定结论一律作废重做(见 §5) |
| 结论 | **`NO-GO` · M=2 · S=2 · N=2** |

---

## 1. 方案合理性判断(先于闭环正确)

### 1.1 问题对不对 —— 部分对

目标写的是「新增业务功能单位成本**不随功能数增长**」,这是斜率命题。
详设把它落成「手改 15 → 9」,这是**常数因子**命题。9 处手改仍然是每条命令付一次,
n 条命令仍是 O(n)。40% 的削减不是拉平。

这不是详设的错 —— 判据「< 10 处」是**需求正本(本 reviewer 撰写)写的**,详设忠实实现了它。
缺陷在判据层:一个计数阈值无法区分常数因子与斜率。详见 S-2。

### 1.2 方案优不优 —— P-2 / E-1 优,D-3 未证明必要

- **P-2 最小且正确**:逐入口具名 22 条、锁位置统一而 replay freshness 按入口保留、
  C4 作为合规正例不动、copy 单独规定。没有造跨 owner helper,没有引入 DDL。这是本文件质量最高的一节。
- **E-1 最小**:共享 resolver + wrapper,而不是到处补 wrapper。
- **D-3 是全计划最大的改动**(7 个关系族、改既有迁移、同步 5 个 Facts 类),
  但详设给的理由是「只对 owner-local **可证明关系**补 scope」——
  这是"能加"的理由,不是"现在会串"的理由。详见 S-1。

### 1.3 代价配不配 —— 除 D-3 外配

阶段前提(无业务数据、每次 reset + seed)使改既有迁移的代价接近零,这一点详设用对了。

### 1.4 UI 强制自问

`NOT_APPLICABLE`。B3 的三项(P-4 上提纯结构、S-1 testId 常量化、P-5 尺寸门)
**不新增、不改变任何用户可见操作或 Journey 步骤**,是源码形状与门的改动。
理由:P-4 只上提 antd 控件 switch;S-1 只把字面量换成常量且详设明确「常量化不得改变选择器值」;
P-5 是尺寸 ratchet。三者都不触及页面操作序列。

---

## 2. M(major)

### M-1 · P-7 的 Markdown 真相链未全部移除,且详设自己声明的负控制在当前设计下必红 —— `CONFIRMED`

**仓内事实(逐条亲验)**

- `scripts/generate/catalog-inventory-p1.mjs` 第 1713、1715 行把两份 markdown 的 `fileHash`
  作为 `designSha256` / `designReviewIntakeSha256` 写进 `implementationManifest`(第 1718 行落盘)。
- **该绑定有三个活消费者**:
  - `tools/catalog-inventory-p2/cli.mjs` 第 42-43 行:`P1_DESIGN_BINDING_MISSING`,
    并校验 `sha256(readText(source.designPath)) === source.designSha256`;
  - `tools/catalog-inventory-p1/cli.mjs` 第 476 行:`P1_DESIGN_BYTE_COVERAGE_SOURCE_HASH`;
  - 哈希已固化在 `contracts/policy/catalog-inventory-design-byte-coverage.json` 第 8 行。
- 生成器**自己**也有 markdown IA 读取与固定 89:第 1359 行 `readFileSync(abs(IA_PATH))`、
  第 1361 行 `if (iaIds.length !== 89) throw`。这与第 97 行读的**设计 markdown 不是同一份文件**。

**详设覆盖情况**

- §4.3 第 2 条对生成器具名删除四项(`readFileSync`、`parseOperationRows`、ordinal partition、`routeByOrdinal`)
  —— 第 1359/1361 行的 IA 读取与固定 89 **不在这四项内**。
- §4.3 第 6 条的「删除固定 43、固定 4 command、Markdown IA 读取与固定 89」**主语是 P1 checker**(CLI),
  不是生成器。
- 第 1713/1715 的哈希绑定**全文未出现**。

**后果(两条,都可证伪)**

1. §4.4 第 193 行声明的负控制「**只改 Markdown 不改变任何生成输出**」,
   在 `designSha256` 保留的前提下**必然不成立** —— 改设计 markdown 一个字符,
   重跑生成器即产出不同 manifest,且 `catalog-inventory-p2` 校验直接失败。
   详设声明了一条自己过不了的负控制。
2. §4.1 第 3 行把 `design-byte-coverage.json` 留作 9 个手改点之一,理由写「operation 设计覆盖」。
   但该文件**同时承载 markdown 哈希**。新增 operation 若触及设计 markdown,
   就必须再改一次哈希 —— 这正是 §4.4 第 197 行成本判据禁止的
   「通过新增一份 per-operation 配置把第 10 个手改藏起来」,只是藏在既有文件里。

**适用条件与可能反例**:若实施时连同 `implementationInputs` 整块删除、
并同步删掉 `p2/cli.mjs:42-43` 与 `p1/cli.mjs:476` 两个消费者,本条自然消解。
但**详设当前没有写这个动作**,而 §3.2「动作具名到语句/文件/行号」是需求正本的硬规则。

**验收判据(可证伪)**:实施后,`fileHash` 在 `catalog-inventory-p1.mjs` 中命中数为 0;
且在临时改动设计 markdown 一个字符后,生成链全部输出逐字节不变、`catalog-inventory-p2` 仍 PASS。

### M-2 · 本轮 DESIGN 缺 fresh 独立子 agent 盲审留痕 —— `CONFIRMED`

**仓内事实**:`2026-08-17-...-high-risk-reconciliation-codex.md` 第 6 行自述
`AUTHOR_HIGH_RISK_RECONCILIATION（不是 fresh independent verdict）`,
第 70 行自述「不替代 AGENTS.md 要求的 fresh independent DESIGN verdict」。
文件内无 `REVIEW_CYCLE_ID`、`REVIEW_ROUND`、`reviewerKind=INDEPENDENT_SUBAGENT` 或输入清单/盲审声明。

**owning source**:`AGENTS.md` 第 65 行 ——「所有 `REVIEW_TARGET=DESIGN` …
必须由 fresh 独立子 agent 执行；作者会话只能在独立 verdict 后做辩证 intake…
**缺少独立子 agent 留痕的该轮不得 GO,也不得把 Claude 后续复核当作替代**」。
`CLAUDE.md` 同条要求本 reviewer「检查此边界但不允许作者自审替代」。

**后果**:即使 M-1 与两条 S 全部修完,本轮在程序上仍不具备 GO 条件。
需求定稿 → DESIGN 是新 cycle(`AGENTS.md` 第 69 行),因此本轮适用该规则。

**这不是文书要求**:作者自审的盲区正是 M-1 —— 作者反复核了 CLI 那一处,
没有独立立场的人去问「还有没有别的 markdown 绑定」。

**适用条件**:若 Dexter 认为该治理条款对本轮不适用,由 Dexter 裁定豁免;
本 reviewer 无权解除 `AGENTS.md` 硬约束。

---

## 3. S(significant)

### S-1 · D-3 是全计划最大改动,但未给出「当前可达的串 scope 路径」 —— `UNVERIFIED_REQUIRES_EVIDENCE`

**详设主张**(§B2-A3):统一 `S=(data_node_ref, brand_ref)`,7 个关系族补 scope-aware 复合 FK,
直接改 `V20260814_100000_000__catalog_p3_model.sql` 等既有迁移,同步 5 个 Facts 类与 owner SELECT/DELETE。

**缺的证据**:详设写的是「只对 owner-local **可证明关系**补 scope」——
这论证的是"哪些能加",不是"不加会怎样"。全文没有一条:
某个写入路径当前**可以**让子行指向另一 scope 的父行。

**本 reviewer 的核验边界(明确声明)**:我**没有**穷举 catalog 的全部写入路径,
因此**不主张**「不存在这种路径」—— 那正是本 reviewer 的高频错误形态。
我主张的是:**详设没有给,而它是本计划最贵的一项,理应由作者给。**

**为什么这条重要**:`AGENTS.md` 第 22 行「不要进行未经验证的架构设计」。
如果所有写入都经 owner service 且 scope 由请求携带,那么 DB 层复合 FK 是纵深防御,
价值真实但优先级低于 B1 的现存缺陷;如果确有可达路径,那它应当升级为 M 并进 B1。
**这两种判断导出的批次归属不同**,不能悬着。

**验收判据**:详设补一条 —— 具名一个当前可达的跨 scope 写入路径(文件 + 方法 + 参数来源),
或明确写「无已知可达路径,本项为纵深防御」并据此重新评估它在 B2 的位置。

### S-2 · G1 判据「手改 < 10」不能区分常数因子与斜率 —— `CONFIRMED`(需求层缺陷,非详设缺陷)

**事实**:需求正本 G1 达成判据为「新增一条业务命令的手改处 < 10」(当前 12)。
详设 §4.2 交付 9 处并逐条论证不可再压。算术与论证都成立。

**缺陷**:目标句是「单位成本**不随功能数增长**」。9 处手改 × n 条命令仍是 O(n)。
15 → 9 是常数因子改善,判据却被当作斜率达成的证明。

**归属**:该判据是**本 reviewer 在需求定稿时写的**,详设忠实实现。
按 `CLAUDE.md`「方案合理性优先于闭环正确」,判据本身写错也是 finding,不因作者是自己而豁免。

**最小处置(不扩范围)**:验收表述改为
「新增命令的**单位**成本从 12 降到 9,**斜率未改变**;斜率归 P-1/P-6 所在的未来轮次」。
⛔ 不建议为此拉回 P-1 —— 详设 §0 已诚实登记该冲突,再加范围是评审制造过度设计。

**这与 Codex 的 M-1 是同一处冲突的两个侧面**:Codex 说的是 G1 第一条判据(零 raw receipt SQL)
因 P-1 推迟而关不掉;本条说的是 G1 **第二条**判据(手改 < 10)即使关掉也不证明斜率。
两条都指向:**三批次的诚实结论是「本轮批准范围 GO」,不是「20 倍底座已建成」**。
详设 §0 第 19-24 行与 §12 第 508 行已经这样写了 —— 这一点应予确认,不是缺陷。

---

## 4. N(note)

### N-1 · extension 的锁键未具名 —— `PARTIALLY_CONFIRMED`

§3.2 只为 catalog / inventory / fulfillment-production 定义
`lockCommandReceipt(scopeKey, idempotencyKey)`;E1 行只写「改为 advisory lock → SELECT/replay → 不存在则 insert」,
**未写 extension 的 scopeKey 取什么**。

仓内事实:`extension_command_receipt` 的 PK 经迁移后是 `(workspace_uuid, idempotency_key)`
(`V20260728_090000_000` 第 141 行),不是原始的单列 `idempotency_key`。
锁键必须与该唯一键同粒度,否则两个不同 scope、同 idempotency_key 的请求会取不同锁却撞同一 PK。

**处置**:E1 行补一句锁键 = `(workspace_uuid, idempotency_key)`。一行的事。

### N-2 · D-5 四条索引已确认缺失,但未具名各自服务的查询或 FK 检查 —— `PARTIALLY_CONFIRMED`

**已亲验**:四条索引确实都不存在。`organization.store` 现有 `project_id`、`head_company_id`;
`contract.store_contract` 现有 `store_id`;`workspace_iam.role_assignment` 现有 `account_id`、
`(service_node_type, service_node_id)`。

**同时声明**:本 reviewer 一次单行 `grep` 曾得出「三列无 FK 无查询」的否定结论,
复核后**作废** —— 该仓 FK 与 SQL 均多行拼接。重做后:`brand_id` / `tenant_id` / `role_id`
在 Java 中分别出现 41 / 46 / 41 次,`brand_id`、`tenant_id` 确有多行 FOREIGN KEY 命中。
因此**不主张**这四条索引无消费者。

**仍缺的**:详设没写每条索引服务的是哪个查询或哪个父表 DELETE 的 RI 检查。
按需求正本「门必须是可判定的不变量」,结构测试查 exact leading column 是对的,
但**为什么需要这四条**应有一句归因。

---

## 5. 已亲验且未形成 finding 的高风险点

| 项 | 亲验结论 |
|---|---|
| P-2 分母 22 | 抽验 10 个入口方法均真实存在;`catalog 8 + inventory 8 + production 5 + extension 1 = 22` 算术成立 |
| P-2 replay freshness 三态 | C4 保留 lock→replay、普通写保留 owner recheck、copy 锁后重算 fingerprint,§3.1 逐行区分,**Codex 自审 S-2 的处置已正确落入详设** |
| 删 catalog `saveReceipt` 的 `ON CONFLICT` | 前提成立。第 6321-6335 行 `jdbc.update(...)` **丢弃返回值**,是"尽力存"不是"抢占",确为静默双执行 |
| BusinessEntity 不入分母 | **正确**。第 89-98 行 `int claimed = ...; if (claimed == 1) return null;` 是**真正的 insert-as-claim**,与 catalog 形态不同,已安全 |
| O-3 capture resolver | 方向正确。`EdgeWebConfiguration` 第 24 行确 implements `WebMvcConfigurer`;`RequestCompletionDiagnosticInterceptor` 第 41 行确有 `afterCompletion`。写 request state + return null + 在 completion 按 status 记一次,能避开抢 Spring 400/404/405/406 |
| O-3 日志级别 | §B2-B1 第 363 行已写「成功 INFO、已分类 4xx WARN/INFO、未知或 5xx ERROR」,Codex 自审 S-5 已落 |
| E-1 事实 | **确认**:仓根**无** `gradlew`、**无** `gradle/wrapper`;`tools/verify-gates/verify.mjs` 第 26、32 行仍是裸 `"gradle"`;`scripts/test/r5-remote-testcontainers.mjs` 第 78 行 `command -v gradle`;`scripts/check/backend-formatting-bytecode.mjs` 第 13-15 行第三处分叉。详设共享 resolver 的方案覆盖全部三处 |
| D-6 | 已在需求定稿轮修至逐文件具名,含 V27 第 190-208 行空表守卫。本轮未复跑回放,维持静态结论 |
| 批次顺序 | 未发现必须新增第四批的写入冲突。B1 删无消费者产物 → B2 改生成/契约 → B3 冻结 testId/尺寸门,方向一致 |

---

## 6. 结论与授权边界

**`NO-GO` · M=2 · S=2 · N=2**

阻断项两条:
- **M-1** 是实质缺陷:P-7 声称的「contract JSON 是唯一真相」在 `designSha256` 绑定存在时不成立,
  且详设自己声明的负控制会红。修法是一段具名删除 + 两个消费者同步下线,不改方案骨架。
- **M-2** 是程序缺陷:本轮无 fresh 独立子 agent 盲审留痕,按 `AGENTS.md` 第 65 行**该轮不得 GO**,
  且本 reviewer 的复核不得作为替代。

S-1 需要作者补一条可达路径或明确降级;S-2 只需改验收表述,不需扩范围;两条 N 各一行修法。

**授权边界**:本文件只是 DESIGN 静态 review。
**不授权**实施、DEV、start/restart、reset、seed、HTTP、浏览器 L2、UAT、Testcontainers、
下一 Roadmap step 或任何范围扩展。
本轮**未运行**任何迁移回放、编译或测试,所有结论均为源码静态亲验;
凡标 `UNVERIFIED_REQUIRES_EVIDENCE` 者不得以静态通过替代。

本文件的 findings 是供 Codex 与 Dexter 复核的独立输入,不自动成为新权威。
