# BP-U05 剩余 owner projection —— Claude 第二次 POST_REMEDIATION_V1 定向复核

`VERDICT=GO`　`M=0`　`S=1`　`N=1`

上一轮的 S-01 与 N-01 **都真正关闭**，且 N-01 的关闭方式比我建议的更完整。
我上一轮请求说明的"替换还是保留 EXISTS"，设计已给出明确、不含糊的裁断——**禁止双读**。

唯一的 S 是：**设计自己承诺的四条 owner 侧红验，一条都没有落地**。
这不影响本轮任何声称（全部仍 `BLOCKED_UNMEASURED`），但它是 R5 最核心那句语义主张的判据。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
变异全部在会话专属 scratchpad 的仓库拷贝上进行，用后即弃。

**一处自我更正**：本轮第一批变异我写错了脚本（`open(path,'w')` 在读之前求值，把文件截断成空），
四条结果全是同一个 `SOURCE_METHOD_MISSING`。我识别后重做，下文引用的是重做后的结果。

---

## 1. 上一轮 N-01（禁令存活性）—— **已关闭，机制正确**

禁令已对象化为 `{pattern, prospective?}`。我独立复算了 15 条的三分：

| 类别 | 我的复算 | 声称 |
|---|---:|---:|
| LIVE（当前旧链真实命中） | **13** | 13 |
| PROSPECTIVE（前瞻，允许 0 命中） | **1** | 1 |
| 已实现行的正确空集 | **1** | 1 |
| **DEAD（写错、永不命中）** | **0** | — |
| 合计 | **15** | 15 |

13 条 LIVE 我逐条在各自 anchor 指向的真实 controller 里匹配，**每条至少 1 次命中**，零死规则。

**存活性是独立函数且 gating 方向正确**：`validateFutureReaderForbiddenEdgeLiveness`
只对 `status === "SOURCE_NOT_IMPLEMENTED_BLOCKED"` 的行生效（其余 `continue`），
并 `filter((rule) => rule.prospective !== true)` 排除前瞻条目。
这正好是 absence 断言的镜像——BLOCKED 期间要求旧链**在场**，IMPLEMENTED 之后要求旧链**缺席**，
两者不会互相打架。这比我上一轮建议的形式更严谨。

### 1.1 你点名的三个变异，逐个重放

| 变异 | 结果 |
|---|---|
| 从 edge 删掉 `workspaces.list(` 调用 | **RED　`BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE`** |
| 撤掉 `prospective` 标记 | **RED　`BP_U05_FUTURE_READER_FORBIDDEN_EDGE_SCHEMA_DRIFT`** |
| 在 typed reader 旁插 `reads.view(` | **RED　`BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ`** |

我另加两条同类：删 `assets.requireActivePublicReferences(`、删 `workspaces.accountCount(`
—— **均 RED `..._NOT_LIVE`**。五条变异、三个互不相同的错误码，方向各自正确。

`RED_FIXTURES` 由 50 增至 **52**；`BP_U05_*` 错误码总数 **80**。

---

## 2. 上一轮 S-01（manifest 漏收）—— **已关闭，且超出我要求的范围**

surface 由 **25 增至 34**（update 25 / create 9）。我逐条 stat：
**create 9 条全部 absent、update 25 条全部 present，34/34 状态准确，零错报。**

我上一轮点名要的两条已入册，另外还补了我没要求但确实需要的：

| 文件 | disposition | 说明 |
|---|---|---|
| `WorkspaceIamSummaryReadService.java` | update | 我上轮点名的遗漏 |
| `WorkspaceIamSummaryReadServiceTest.java` | create（absent） | 对应 focused test |
| `WorkspaceAdministrationService.java` | update | **EXISTS 替换的落点**，我上轮只在方案讨论里提过 |
| `WorkspaceIamSummaryLookup.java` | update | consumer-owned port |
| `GroupWorkspaceTaskQuery.java` | update | 改由 organization owner 实现 |
| `OrganizationGroupWorkspaceInitializationTaskReadService.java` + Test | create（均 absent） | 新的 organization batch |

`WorkspaceIamSummaryLookup.java` 我打开确认是**既有文件**（`update` 正确，不是偷偷新建的生产代码），
当前只声明 `accountCount` / `roleCount` 两个方法。
`WorkspaceIamSummaryReadService` 仍是 `:21` / `:27` 两条独立 `queryForObject`，
`accountAndRoleSummary` **尚不存在**——与 `SOURCE_NOT_IMPLEMENTED_BLOCKED` 一致，诚实。

---

## 3. R5 owner replacement：**要求写对了，判据没建**

### 3.1 设计的裁断是明确的，且正面否掉了双读

设计 `:336` 我逐字读了，它把我上一轮请求说明的那件事写死了：

- 「R5 的 list **不得保留** `WorkspaceAdministrationService#list` 中
  `EXISTS (SELECT ... organization.commercial_group)` 后再调用新的 organization port；
  那会把同一 initialization 事实读取两次」——**明确选了替换，不是叠加**；
- 「该 service 必须仅返回 `platform_workspace.group_workspace` 的 base page」；
- `GroupWorkspaceTaskQuery` 改由 organization 的 `OrganizationGroupWorkspaceInitializationTaskReadService`
  实现，输入只能是已分页的 key 集合，输出不得再返回 platform workspace 名称/状态/ID；
- detail 链末端的 `accountAndRoleSummary`「必须由 `WorkspaceIamSummaryReadService` 的**一个**
  owner-local statement 产生 aggregate，**不能把现有两个 count 移入 reader 内部**」
  —— 这正是我上一轮 S-01 里预判的"后果二"，被点名禁止了；
- `PlatformWorkspaceService#initializeCommercialGroup` 的旧跨 schema path **明确 retain 且声明不属本单元**，
  没有含糊地扩大战果。

**这一段我认为写得对，取舍也对。** 上一轮的方案层疑问已消除。

### 3.2 但设计同一句话承诺的红验没有落地 —— 见 S-01

`:336` 结尾写：「红验必须覆盖 list SQL 不含 `organization.`、不允许在 reader 外保留 `EXISTS`、
summary aggregate 不能退化成两个 count、以及 initialization batch 不能返回 platform-owned columns」。

我在生成器里检索这四条的落点：**一条都没有**。
本轮新增的错误码只有 `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE` 一个。

### 3.3 你问的两个问题，诚实的回答

**「R5 不是双读」**——**当前字节无法验证**。两个 reader 都不存在，
`WorkspaceAdministrationService#list:66` 的跨 schema `EXISTS` 仍在（这在未实施阶段是正确的）。
可以确认的是：设计以明确措辞禁止了双读；**不能**确认的是：有任何机器判据会在实施时发现保留。

**「`accountAndRoleSummary` 是单 statement aggregate」**——**当前字节无法验证**，该方法不存在。
设计要求它是单语句；没有任何控制钉住这一点。

---

## 4. 分母、状态与零进入

| 项 | 复算 | 期望 |
|---|---:|---:|
| `NOT_YET_TASK_READER` | **13** | 13 |
| `TASK_READER` | **65** | 65 |
| `primaryQueryCap > 1` | **10** | 10 |
| `OPERATIONS_AUDIT_TARGET_TYPES` | **9** | 9 |

三个状态位与前两轮完全一致：`TWO_OWNER_REMAINING_STATUS=SOURCE_NOT_IMPLEMENTED_BLOCKED`、
`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`、
`TWO_OWNER_PRIMARY_PROJECTION_STATUS=SOURCE_IMPLEMENTED_UNMEASURED`。

`postRemediationDeclaration` 仍诚实：`reviewRound: 2`、
**`implementationAuthority: false`**、`claudeRecheckRequired: true`、
`currentBytesNotReviewedByAdversarialReviewer: true`。

**BP-U06 / 动态环境 / 数值优化零进入**：`DEFERRED_TO_BP_U06` 保持；
edge 中 `switch (operationId)` **0 处**；create 的 9 条全部 absent；
未启动 DEV / reset / seed / L2 / UAT；无任何 SQL 数值成功声明。

---

## 5. Findings

### S-01｜设计承诺的四条 owner 侧红验零落地，双读与 aggregate 退化没有机器判据

**证据**。设计 `:336` 明文承诺四条红验（见 §3.2）。
我在 `scripts/generate/task-read-surface-policy.mjs` 中检索 `organization.`、`EXISTS`、
`aggregate`、statement 计数等落点：**四条均不存在**。
本轮生成器只新增 `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE` 一个错误码（总数 80）。

**为什么这不是"等实施时再说"就够了**。现有的 `forbiddenEdgeReads` 全部作用于 **edge 方法闭包**；
而这四条禁止的行为全部发生在 **owner 源码内部**。具体两条可行的绕过路径：

- **双读**：保留 `WorkspaceAdministrationService#list:66` 的
  `EXISTS (SELECT 1 FROM organization.commercial_group …)`，同时在 reader 内调新的 organization port。
  edge 只调 `reads.page(`，edge 侧禁令全部满足，admission 六项全过，门全绿；
  同一 initialization 事实被读两次，该行读取数不降反升。
- **aggregate 退化**：把 `accountAndRoleSummary` 实现成内部两条 `queryForObject`。
  `WorkspaceIamSummaryLookup` 当前仍公开 `accountCount` / `roleCount` 两个方法，
  设计没有说要移除它们；reader 直接调这两个也能满足 edge 侧全部禁令。
  声明 cap 4，实际 5 条语句，当前 `BLOCKED_UNMEASURED` 期间没有任何东西会发现。

**机制先例就在同一个文件里**。`:276` 已经在用
`count(organization.bodies.join("\n"), /\bjdbc\.query\s*\(/g) !== 1`
→ `BP_U05_TWO_OWNER_ORGANIZATION_LOGICAL_CAP_DRIFT`
对 twoOwner 那组做 owner 侧单语句断言。**"aggregate 必须是一条语句"所需要的写法，作者已经写过，
只是没有铺到 R5 的 boundary 上。** 这与我两轮前那个 M-01 是同一种形状。

**有限适用面**。`listPlatformGroupWorkspaces` 与 `getPlatformGroupWorkspaceDetail` 两行。
**不影响本轮任何声称**——三个状态位仍为 `BLOCKED_UNMEASURED`，本轮 S-01/N-01 的关闭是独立成立的。
风险在 reader 落地那一刻兑现。

**为什么是 S 不是 M**。两轮前那个 M-01 我是在**现有可编译字节上实测出 GREEN** 的；
这次两个 reader 都不存在，我**无法演示绕过**，只能指出判据缺位。
而且设计已把禁止措辞写死，manifest 也已收录全部相关文件，实施复核时源码会被打开。
按证据强度，这一条只能记 S。

**但我在此明确一点**：这是连续第三轮出现"禁令写在散文里、判据没建"。
前两次（九类型、edge 旧链）都已补上。**实施复核时，这四条控制仍然缺位将构成阻断项**，
不能再次延期。

**最小修复**（不改 cap、分母、boundary 或任何设计措辞）：
在 `remainingExceptionSourceRequirements` 的两行里增加 status-gated 的 owner 断言，
与 `forbiddenEdgeReads` 同一机制、同一时序（status 翻 `SOURCE_IMPLEMENTED_UNMEASURED` 时激活）：

1. `WorkspaceAdministrationService#list` 的方法体不得出现 `organization.`；
2. 该方法体不得出现跨 schema `EXISTS`；
3. `WorkspaceIamSummaryReadService#accountAndRoleSummary` 的 `jdbc.` 语句计数 **必须为 1**
   （直接复用 `:276` 的写法）；
4. `OrganizationGroupWorkspaceInitializationTaskReadService` 的输出类型不得含 platform-owned 字段。

外加一条更便宜、更直接的：**把 `accountCount` / `roleCount` 从 `WorkspaceIamSummaryLookup` 移除**，
让退化路径在编译期就不存在——这比任何断言都强，且成本更低。

**为什么不是更小的方案**：edge 侧禁令在信息上看不见 owner 内部的语句数与 schema 引用，
四条禁止的行为没有一条会在 edge 闭包里留下痕迹。

**是否需要 Dexter 裁决**：**不需要**。四条禁令已在设计里冻结，本条只补执行。

### N-01｜删除跨 schema `EXISTS` 的那个文件没有 focused test

**证据**：`WorkspaceAdministrationService.java` 以 `update` 入册（正确），
但 manifest 里**没有**对应的 focused test surface；
我在仓内检索也确认**不存在** `WorkspaceAdministrationServiceTest.java`。
唯一相关的是 edge 层的 `PlatformWorkspaceAdministrationControllerTest`（已入册 update），
它能断言 HTTP 输出，但断言不到 SQL 里还有没有 `organization.`。

后果：`:66` 那条跨 schema 读取的移除——R5 语义上最要紧的一次源码改动——
**既没有机器控制（S-01），也没有 focused test**。

**最小修复**：为该 service 新增一条 focused test surface，
用它断言 list 语句只触及 `platform_workspace.group_workspace`。
如果按 S-01 加了源码断言，这条可降级为可选。

**是否需要 Dexter 裁决**：不需要。

---

## 6. 方案合理性（本轮增量）

本轮修订只补 surface 与控制，不改语义：cap、分母、reader 路径、状态位、BP-U06 与运行期范围
我逐项复算，**一律未动**。N-01 的关闭方式（对象化 + `prospective` 标注 + 独立的反向 gating 函数）
比我建议的形式更严谨，不是敷衍成一个开关。

R5 的 owner 替换取舍我认同：把跨 schema `EXISTS` 换成 organization 的正规端口，
语句数在 list 行 2→3，但换来的是所有权干净、且 detail 行 5→4；
更重要的是设计**主动排除了**"保留 EXISTS 再加端口"这种既不省读取又破坏所有权的做法。
既有 command 的旧跨 schema path 明确 retain 并声明出界，没有借修复扩范围。

**UI 与交互**：`NOT_APPLICABLE`。本轮只改契约、生成器、门脚本与 manifest，
不触碰 HTTP 契约、响应形状或任何用户可见操作，两个 App 零变化。

---

## 7. 结论

**GO**（M=0，S=1，N=1）。

上一轮两条 finding 都是真关闭，且关闭方式经得起复算。
**N-01 的 15 条禁令我独立三分复算得 13 LIVE / 1 PROSPECTIVE / 1 已实现空集、零死规则**，
存活性做成了独立函数并按 `SOURCE_NOT_IMPLEMENTED_BLOCKED` 反向 gating，
与 absence 断言互为镜像。你点名的三个变异逐个重放全红，错误码三个互不相同，
我另加两条同类也红。**S-01 的 surface 从 25 补到 34，create 9 条全 absent、update 25 条全 present，
34/34 准确**，并且补进了我上一轮只在方案讨论里提过的 `WorkspaceAdministrationService.java`。
分母 13/65/10/9 与三个 `BLOCKED_UNMEASURED` 状态位零漂移，`implementationAuthority` 仍为 `false`，
BP-U06 与动态环境零进入。

我上一轮请求裁断的"替换还是保留"，设计给出了明确答案：**禁止双读**，
并且点名禁止了我预判的 aggregate 退化路径。这一段写得对。

**唯一的 S 是这句话的后半段没有兑现**：设计承诺「红验必须覆盖」的四条，
在生成器里一条都没有。edge 侧禁令看不见 owner 内部的语句数与 schema 引用，
所以"保留 EXISTS 再加端口"和"aggregate 拆成两条 count"这两条路径今天都能走到门全绿。
而"单语句断言"的写法作者在 `:276` 已经写过，只是没铺到 R5 的 boundary 上。
因为两个 reader 都不存在，我无法像两轮前那样实测出 GREEN，按证据强度只能记 S——
**但实施复核时这四条仍然缺位将构成阻断项，不能再延期一次。**
最便宜的一步是把 `accountCount` / `roleCount` 从 `WorkspaceIamSummaryLookup` 移除，
让退化路径在编译期消失。

**授权边界**：本 GO 仅覆盖 BP-U05 剩余 implementation-facing design 的本次 S-01/N-01 修订。
**不构成任何 SQL 数值优化成功声明**——三个状态位仍为 `BLOCKED_UNMEASURED`，必须保持。
不授权 BP-U06、DEV、reset/seed、L2/UAT、部署、仓库控制、生产 reader 实施，
也不替代实施完成后应有的独立实施复核。
