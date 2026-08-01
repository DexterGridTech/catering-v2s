SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

---
title: R5 合规整改 implementation-facing 详设与实施计划
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
roadmapId: R5-COMPLIANCE-REMEDIATION
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
reviewTarget: DESIGN
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
---

# R5 合规整改 implementation-facing 详设与实施计划

## 0. 状态、目标与不授权边界

本件把双审合并诊断转换为可执行但尚未获准实施的整改设计。目标不是逐条补 bug，而是同时修复：

1. 产生偏离的过程：设计约束没有在文件产生时被执行；
2. 失真的控制：多个 gate、自测与 coverage 能在错误输入下继续绿；
3. 已产生的实现偏离：契约、生成、前端、安全、owner、UI、业务能力、DEV/seed、测试证据。

本轮只授权设计、静态 source-first 核验和独立设计审查。不得修改业务源码、契约、migration、
测试、`scripts/` 或动态环境。文中的 create/update/delete 均是**未来实施 change surface**。

上游冻结：

- D-1～D-7 已由 Dexter 委托 Codex 裁决，结果见
  `doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`；
- operation `106 = 39 platform-admin + 56 operations-admin + 11 public`；
- 32 scenario、22 surface、25 pageDesignKey、7 owner schema；
- G-01～G-12、D-01～D-11、R-15、已接受 Journey 与交互工件；
- 时间瞬时事实为 `long/BIGINT epochMillis`；
- 已执行 migration 字节不可改写；
- 一个业务 deployable、一个 PostgreSQL、多 owner schema、单 Flyway history；
- 两个独立 admin app，generated wire 按 face 隔离；
- `platform-asset` 只服务公开静态展示图片与视频，禁止导入导出、报表、临时处理产物。

## 1. source-first 诊断 intake

### 1.1 复核方法

Codex 未把 Claude finding 当作既定事实，而是重开 owning source：

- accepted R5 revised manifest、carry-over inventory、required-memory inventory；
- `contracts/openapi/**` 与 bespoke generator；
- `tools/verify-gates/cli.mjs`、`scripts/check/standards-coverage`；
- 两个 app、29 个 controller、owner service、migration、DEV/seed/test runner；
- 当前 Roadmap、蓝图、项目记忆与验证治理。

由于清单 §8 明示数字是时点快照，本设计只冻结**零漂移目标与复算算法**，不把可漂移计数硬编码为
控制逻辑。

### 1.2 已确认、部分确认与更正

| 诊断簇 | 状态 | 当前字节复核 | 设计处置 |
| --- | --- | --- | --- |
| frozen forbidden 分母 | CONFIRMED_WITH_COUNT_CORRECTION | 当前 accepted manifest 有 36 条 | CR00 从 manifest 动态取数，不硬编码 36 |
| approved assertions 分母 | PARTIALLY_CONFIRMED | 当前 manifest 是 26 条，不是报告的 27 | 以当前文件 parse 结果为准；差异写 receipt |
| project-memory assertions 分母 | PARTIALLY_CONFIRMED | required inventory 有 71 次声明、69 个唯一 key，不是 62 | occurrences 与 unique 双口径记录；不复制字面数组 |
| OpenAPI false-green | CONFIRMED_WITH_EXPANDED_DENOMINATOR | bespoke gate 不递归解析；严格 JSON Pointer 复算为 1,330 refs / 880 unresolved，其中报告已识别 742+50 | CR01 完成条件只接受 unresolved=0；报告的 792 不作为最终分母 |
| security false-green | CONFIRMED | checker 只覆盖 3/106 operation、2 个 controller | CR00 由当前 catalog/controller inventory 动态生成分母 |
| frontend self-test 逃生 | CONFIRMED | frontend action 被显式跳过 clean production run | CR00 删除 action 特判；clean→mutation→red→restore→clean |
| standards coverage 替门仍绿 | CONFIRMED | 当前只验 enforcement ref 声明存在，不验可失败 receipt | CR00 增加受引用控制的 immutable red-receipt 对账 |
| database migration 硬编码 | CONFIRMED | checker 写死 15 个 migration 路径 | CR00 改从 Flyway locations/current inventory 派生 |
| typed generation 塌缩 | CONFIRMED_IN_PRINCIPLE_COUNT_REQUIRES_RESCAN | generated boundary 广泛存在 `Map<String,Object>`；报告 41/146 是快照口径 | CR01 以 generated business DTO 中未类型化边界为零 |
| operations PATCH/PUT=0 | CONFIRMED_FRONTEND_SCOPE | 后端已有 update endpoints；operations 前端无 PATCH/PUT 消费 | CR06 补冻结的编辑能力，不误称后端 operation 缺失 |
| 状态字段 0/9 与门店双向错误 | CONFIRMED | 前端发 `status/expectedVersion`，契约要求 typed target/revision；后端 store transition 缺同类分支 | CR01/02 先 typed，再在 CR05 消除业务错误 |
| password reset OTP 无限流 | CONFIRMED | service 未注入 rate-limit owner，失败计数处于 rollback 事务 | CR03 |
| audit 宿主授权缺失 | CONFIRMED | controller 只 require workspace 后按 entityType 读 owner audit | CR03 |
| extension workspace key | CONFIRMED | `extension_definition` 已删除 workspace_uuid，service 参数未参与主键/查询 | D-5 后由 CR04 执行 |
| 22 surface 完整吸收 0/22 | PARTIALLY_CONFIRMED | “完整”缺任一 route/typed endpoint/UI/write/evidence 即不闭合，当前无一满足全套；行数快照已漂移 | CR06 以 22 行逐项 closure，不使用行数百分比作门 |
| 本机缺 Docker 是阻断 | REJECTED_WITH_EVIDENCE | 仓内已是 SSH+remote Docker 设计；问题是 verify 错接本机 socket | CR08 只修接线，不要求本机安装 Docker |
| ArchUnit 与 route reverse coverage | UNVERIFIED_REQUIRES_EVIDENCE | 本轮禁止构建，不能动态复跑 | CR08 在测试前静态扫描绿后验证 |

其余 M/S/N finding 均保留在 CR00–CR08 范围矩阵；计数漂移不得成为删项理由。

## 2. “做一点，验一点”的控制架构

### 2.1 合规核对不是测试

合规核对只读 source、frozen manifest、inventory、memory assertion 与 design mapping，目标是回答
“刚写的字节是否违反已接受规则”。它不需要 Gradle、Docker、数据库或浏览器。测试回答行为是否
运行正确，必须晚于全量合规扫描。

### 2.2 source-derived rule model

未来 CR00 实施一个共享的静态合规引擎，由 PreToolUse、PostToolUse、测试前扫描共同调用。
引擎不得内置 36/26/69/25 或具体 migration 文件名，而是每次读取：

| source | 派生内容 | 失效策略 |
| --- | --- | --- |
| accepted granularity manifest | `forbiddenPseudoFixes`、`approvedAssertions`、unit/change surface | 解析失败或无 accepted binding 即 fail-closed |
| revised carry-over execution inventory | 22 surface、25 pageDesignKey、CARRY/ADAPT/NOT_CARRIED | 重复、缺项、超集 route 即红 |
| `project-memory/required-inventory.json` | assertion occurrence、unique key、source path/anchor | source/anchor 不存在即红 |
| standards matrix | enforcement、phase、reviewChecklistRef | 不复制规则正文；source 必须 reopen |
| edge catalogs/controller tree/Flyway location | operation、controller、migration 当前分母 | 由当前字节枚举，不写死数量或文件名 |

规则 ID/文本来自这些 source；predicate registry 只把 source rule 映射到机械算法。没有一行可说清、
无需业务判断的 predicate 时，必须登记 `UNENFORCEABLE_BY_MACHINE + reviewChecklistRef`，
禁止退化成关键词“语义门”。

deterministic source-to-predicate contract 固定如下：

1. **accepted manifest resolver**：只读取 active Registry 指向的唯一 current Roadmap，再读取该
   Roadmap 的 `r5ComplianceRemediationManifestRef + reviewed sha256`；禁止目录扫描、“最新文件”
   或名称猜测。设计接受前 CR00 不可实施；接受时 Roadmap 绑定 reviewed manifest hash。
2. **稳定 rule identity**：每个 source row 的 `ruleId` 是 canonical tuple
   `sourcePath + selector(JSON Pointer/anchor) + exact rule text` 的完整 SHA-256，前缀
   `SRC-` 只用于展示。canonical bytes 固定为 UTF-8 JSON，key 顺序为
   `sourcePath,selector,exactRuleText`，无额外空白，字符串按 JSON escaping，禁止 locale/path
   normalization。任何文本、selector 或 source path 改变即成为新 rule，旧 mapping 失效。
3. **唯一 mapping artifact**：`contracts/policy/source-compliance-predicate-map.json` 每行含
   `ruleId/sourcePath/sourceSha256/selector/applicabilitySelector/enforcementKind`；机械项另含
   `predicateId/implementationPath/implementationSha256`，语义项另含 `reviewChecklistRef`。
4. **适用性**：memory occurrence 按 required-inventory route 与 unit 的 domain/face/owner/impact
   匹配；approved/forbidden 只归 manifest owning unit；surface/pageKey 按 carry-over row 的
   owning unit；standards 按 matrix phase 与本 manifest `designUnits`；设计完成判据归对应 section。
5. **完备性**：resolver 派生的 ruleId set 必须与 mapping artifact ruleId set 完全相等；
   unmapped、extra、source hash drift、predicate implementation hash drift、一个 rule 同时声明
   machine 与 human 均 fail-closed。
6. **红证明**：在真实 repository scratch copy 新增一条 source row 而不加 mapping，
   同一 production compliance entry 必须以 `SOURCE_RULE_UNMAPPED:<ruleId>` 红；改变 source 文本、
   删除 mapping、伪造 predicate hash 也分别精确红。

每个 unit 在 manifest 中声明合法六维 `complianceRoute`（taskKinds/domains/consumerFaces/owners/
impacts/triggers），memory occurrence 的 route 使用“任一维含 all 或与 unit 该维有交集”判适用；
六维必须全部满足。route 数组排序后参与 receipt，修改任一维必须使旧 receipt
`UNIT_ROUTE_DRIFT` 红。

22 surface 与 25 pageDesignKey 的 package-exit 最终 ownership 全部归 CR06；CR05 只提供前置 UI
一致性能力，不拥有 surface closure row。manifest 必须列出 22 个 surface ID 与 25 个 pageDesignKey
到 CR06 的精确映射，并校验与 carry-over source set equality、无重叠、无未归属、无未知项。
移动、重复或删除任一 row 必须分别以 `SURFACE_OWNER_DRIFT/DUPLICATE/UNOWNED` 红。

该 mapping 是被检查的 trace，不是第二份规则正文；它不得复制或改写 source rule text。

### 2.3 hook 形状

未来 change surfaces：

- `.codex/hooks.json`：登记 `PreToolUse` 与 `PostToolUse`；
- `scripts/hooks/pre-tool-compliance`：只接收工具、目标路径和当前 package receipt；
- `scripts/hooks/post-tool-compliance`：只接收本次变更路径与 before/after hash；
- `tools/compliance-control/cli.mjs`：共享 source loader、applicability router、mechanical predicates；
- `scripts/check/remediation-compliance`：同一引擎的全仓/包级只读入口。

`.codex/hooks.json` 当前只证明既有 `SessionStart/UserPromptSubmit/Stop` 的当前客户端 parser
兼容性，**不能外推** `PreToolUse/PostToolUse` 事件也被当前 Codex client 支持。CR00 在真实
client canary 完成前必须登记
`CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED`；不得把 JSON schema 静态解析、直接调用 hook
脚本或引擎 self-test 冒充客户端触发证明。

CR00 的 invocation canary 使用与当前工作相同的 Codex client 与真实结构 scratchpad：

1. 从 scratchpad 根加载待交付 `.codex/hooks.json`；
2. 通过真实 Agent 文件写动作改变一个受保护 canary path，不直接执行 hook 命令；
3. 断言 hook receipt 出现 exact `path + beforeSha256 + afterSha256 + invocationId`；
4. 在第二份 scratch copy 删除/改错 PostToolUse 注册，重复真实写动作；
5. package admission 必须以 `HOOK_INVOCATION_RECEIPT_MISSING:<path>` 精确红；
6. 恢复注册后重复写动作并 PASS，删除 scratchpad，单独记录 cleanup。

如果当前 Codex client 不支持该事件或无法给出可绑定的事件输入，CR00 必须
`FAIL / CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED`，不得靠包尾扫描把“做一点验一点”降级为
“做完再验”。包尾独立 set equality 是兜底探测，不是 hook 的替代。

PreToolUse：

1. 目标必须在当前获准 package change surfaces；
2. 前序 package exit receipt 必须真绿；
3. 守卫本文件的控制必须为 `ACTIVE_RED_VERIFIED`；
4. 不满足即拒绝受保护写入，打印具名 code、source assertion 与 owning package。

PostToolUse：

1. 只对 changed paths 计算适用规则；
2. 重新打开 source rule 与当前文件；
3. 输出 `path + beforeHash + afterHash + ruleId + result`；
4. 任一红即阻断下一次受保护工作，直到同文件纠正后重跑；
5. 不执行 build/test，不注入 prompt，不读取聊天状态。

`PROMPT_RECOMMENDS_ONLY` 约束的是 UserPromptSubmit：它只能推荐 skill、不得查询或注入 memory/code。
Pre/PostToolUse 是 repository mutation 的合规闸口，不产生 prompt context，因此两者不冲突。
CR00 必须在 project-memory 新增 assertion
`INCREMENTAL_COMPLIANCE_HOOK_NO_CONTEXT_INJECTION`，并把 source anchor 指向接受后的本设计 §2；
本轮仅设计，不提前改 memory。

### 2.3.1 提升为所有详设的机械准入

`package-exit` 逐项对比不是只服务本轮 R5 的临时规则。CR00 必须修订既有
`scripts/check/implementation-design-granularity`，不新建门类别，使所有后续
implementation-facing design manifest 必须声明：

```json
{
  "packageExitSourceCompliancePolicy": {
    "version": "SOURCE_DISPOSITION_V1",
    "appliesToAllDeliveryUnits": true,
    "requiredDenominators": [
      "PROJECT_MEMORY_ASSERTION_OCCURRENCES",
      "APPROVED_ASSERTIONS",
      "FORBIDDEN_PSEUDO_FIXES",
      "DETAIL_DESIGN_COMPLETION_AND_INCREMENTAL_CRITERIA",
      "OWNED_SURFACE_AND_PAGE_KEYS",
      "DUE_STANDARDS_RULE_IDS"
    ],
    "missingOrUnboundEntryFails": true,
    "actualChangedPathsDerivedFromIndependentBaseline": true,
    "incrementalChecksMustEqualActualChangedPaths": true,
    "incrementalChecksMustBeNonEmpty": true,
    "hookInvocationCanaryRequired": true,
    "hookContractUnverifiedFailsCr00": true
  }
}
```

每个 delivery unit 还必须声明 `sourceComplianceDispositionRequired=true` 和上述分母的 owning
source/anchor。checker 只机械验证字段、source/anchor、分母声明、无 `PENDING`、每个 unit 都覆盖；
它不替代语义评审。删除 policy、删任一 unit 声明、写 `PENDING`、悬空 source 四个真实变异都必须红。

CR00 同步修订本仓 `.agents/skills/cs-spec-to-plan/SKILL.md`、
`.agents/skills/cs-writing-plans/SKILL.md`、`AGENTS.md`、`CLAUDE.md` 与 project-memory，
使设计生成、agent 入口和审查都指向同一个 existing gate。自 CR00 被 Dexter 接受并实施后，
任何缺少该 policy 的新详设不得送独立子 agent、Claude 或实施；旧已收口产物不追溯伪补。

### 2.4 测试前全量扫描

任何命令被分类为 compile/typecheck/unit/integration/L2/L3/DEV/seed 前，PreToolUse 先调用：

```text
remediation-compliance --scope repository --through <current-package>
```

扫描必须覆盖当前全仓与所有已关闭 package receipt。红则测试命令不启动。对确实只能终态验证的事项，
必须在 package 中写 `TERMINAL_ONLY`、机械原因、终态 oracle；当前设计没有默认例外。

这里的“测试前全量扫描”固定为两个顺序层，二者都绿才允许启动测试：

1. `remediation-compliance --scope repository --through <current-package>`：逐项执行本设计的
   source-derived compliance 分母；
2. 从现有 gate catalog 动态解析所有 `phase <= R5` 且标记为静态 test-admission 的独立门并执行，
   包括 `provider-free-context`，不得用 compliance aggregate 的 PASS 覆盖独立门 FAIL。

`provider-free-context` 当前因蓝图“五个 project skills”旧字面而红。该静态分母订正与
`CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` assertion 的登记都前移到 CR00；CR00 exit 前必须经
production path 真绿。它不再归 CR08，也不会把 CR01～CR07 的 typecheck/test 永久阻断。

### 2.5 red-first 协议

每个新增或修复控制按固定顺序：

1. 复制最小但结构真实的 repository slice 到 scratchpad；
2. clean production-path run 必须 PASS；
3. 注入一条已命名真实违规；
4. 同一 production-path run 必须 FAIL，且 reason 精确匹配；
5. 移除变异并再次 PASS；
6. 保存 source hash、mutation diff、三次 exit/readback 与 cleanup。

`--self-test` 只能编排上述协议，不能按 action 绕过 clean run，不能使用与生产不同的空目录结构。

## 3. 包级控制与证据契约

每包入口生成 `package-input.json`，包含：predecessor receipt hash、当前 frozen source hashes、
动态分母、已裁决 D decision 绑定，并在任何包内写入前对受治理仓库树创建独立 baseline：
`path + kind + sha256|ABSENT`。枚举器从 manifest change surfaces 与 repository governance
include/exclude contract 派生，不读取 Git 状态、不依赖 hook 自报；`.runtime/`、build cache、
dependency cache 与最终自引用 receipt path 只能按明确类别排除。每包出口先重新枚举并计算
`actualChangedPaths`，再生成 `package-exit.json`：

```json
{
  "packageId": "<accepted-id>",
  "status": "PASS|FAIL",
  "controls": [{"ruleId":"...","state":"ACTIVE_RED_VERIFIED|OUT_OF_SCOPE_THIS_PACKAGE"}],
  "actualChangedPaths": [{"path":"...","beforeSha256":"...|ABSENT","afterSha256":"...|ABSENT"}],
  "incrementalChecks": [{"path":"...","afterSha256":"...","result":"PASS"}],
  "fullComplianceScan": "PASS",
  "tests": "PASS|NOT_APPLICABLE",
  "business": "PASS|NOT_APPLICABLE",
  "cleanup": "PASS|NOT_APPLICABLE",
  "denominators": {"sourcePath":"...","sourceSha256":"...","derivedCount":0}
}
```

`status=PASS` 需要所有适用字段闭合，并满足：

- `set(paths(incrementalChecks)) == set(paths(actualChangedPaths))`；
- CR00～CR08 的集合必须非空；CR09 至少包含本轮 review/evidence 新产物；
- 缺项报 `INCREMENTAL_CHECK_MISSING:<path>`，多项报
  `INCREMENTAL_CHECK_UNKNOWN:<path>`，空集合报 `INCREMENTAL_CHECKS_EMPTY`；
- baseline 外发生变化报 `UNAUTHORIZED_CHANGED_PATH:<path>`；
- 每个 incremental check 的 `afterSha256` 必须等于 exit 枚举值。

`actualChangedPaths` 在 receipt 期独立计算，所以即使 PostToolUse 完全没有触发，包尾也必然红。
最终 receipt path 因自引用不进入该集合，但其字节 hash 由上层 closure evidence 单独绑定。
文档声明、空 target、未发现测试、只跑 self-test、只验 header、只验关键词都不能生成 PASS。

每个 package exit 还必须生成 `source-compliance-disposition.json`，不能只给汇总 PASS。它逐项覆盖：

1. `project-memory/required-inventory.json` 当前派生出的**每一次 assertion occurrence**；
2. 当前 accepted granularity manifest 的每条 `approvedAssertions` 与 `forbiddenPseudoFixes`；
3. 本设计中该 package 的每条 scope、ordered chain、完成判据、增量验证点与禁止伪修复；
4. carry-over inventory 中由该 package owning 的每一行 surface/pageDesignKey；
5. standards matrix 中 phase 到期且由该 package owning 的每一个真实 ruleId。

每行固定包含 `sourcePath/sourceSha256/anchor/ruleId/applicability/disposition/evidencePath/evidenceSha256`。
`applicability` 只能是 `APPLICABLE` 或 `NOT_APPLICABLE`；后者必须给具体理由与真正 owning package。
一条缺失、悬空 source、空 evidence 或笼统“已遵守”都会使 package exit 红。因此答案是明确的：
**每个实施包不仅完成后逐项对比，文件产生时也已经先做增量对比；包尾再对项目记忆与设计全文做一次
逐项闭合复算。**

## 4. 详细实施单元

### 4.1 R5-CR00 合规控制面

顺序：

1. 冻结当前 source-derived denominator receipt；
2. 为五个假绿控制逐一补“生产 clean → 真实 mutation red → clean”；
3. 删除 frontend self-test action 豁免；code-layout fixture 使用真实两层 app tree；
4. standards-coverage 对每个 active enforcement ref 要求对应 production red receipt，替换为
   unconditional success 必须红；
5. 删除中文关键词语义门，将规则路由回 matrix checklist；
6. 升级既有 granularity checker 与两份 plan skill 壳，使 package-exit 逐项 disposition
   成为所有未来详设的准入要求；
7. 接 Pre/Post hook 与全仓 compliance entry；
8. 运行真实 Codex client invocation canary，证明受保护写动作确实触发 PostToolUse；未证明即红；
9. 由 accepted source 派生规则集重新扫描当前树，得到当前 forbidden 违反集合并逐条命中；
   诊断报告的 15 条仅作交叉核对，差异写 receipt，不作为分母或完备性声明；
10. 添加 `INCREMENTAL_COMPLIANCE_HOOK_NO_CONTEXT_INJECTION`、
    `CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` 的状态/来源与 routed source；
11. 订正蓝图 project-skill 动态分母，使 `provider-free-context` production path 真绿；
12. 完成 CR00 full static scan 与 independent static admission gates；未真绿不进入 CR01。

首批 predicate：feature API path、列表操作列、generated untyped map、前端业务时间、edge JDBC、
external-subject audit、pageDesignKey 超集、locale、分页 total、跨 owner schema registry edge。
每条 predicate 的适用 rule 文本从 source 派生，不能靠硬编码检查项列表宣称分母完整。

### 4.2 R5-CR01 可解析契约与 typed generation

顺序：

1. 标准 YAML + URI + JSON Pointer resolver 复算所有 `$ref`；
   首份 baseline receipt 记录 resolver 版本以及 `1,330 total / 880 unresolved =
   50 missing-file + 742 ProblemResponse missing-pointer + 88 other missing-pointer` 的当前快照；
   快照只用于解释，完成 oracle 始终是 unresolved=0；
2. 先修 component/root path 引用，再删除 schema-name fallback；
3. 对 inline object 建稳定命名规则：
   `<OperationId><Request|Response><PropertyPath>`，冲突时 fail，不静默覆盖；
4. generated Java/TypeScript 只允许 typed object、enum、array、scalar；
5. 重新生成 server/platform/operations/public face artifacts；
6. 对 106/39/56/11、path、operationId、errorSet 做双向闭包；
7. mutation：改错任一 ref、删 required property、引入 map fallback 均精确红。

不修改冻结 operation 语义；只修契约成为可解析 source of truth 及生成器忠实消费。

### 4.3 R5-CR02 typed 前端消费底座

顺序：

1. 以 v2 的 RTK codegen 配置作参考，但 endpoint 输入只取 v2s face OpenAPI；
2. 两 app 各自生成 API slice、store、router、session reconstruction、401 interceptor；
3. context/authorizationRevision 变化触发 tag/cache/session UI 扇出；
4. 建 typed Problem→中文 feedback mapping，禁止 `errorCode + detail` 直出；
5. 按 surface 一项一项替换手写 API 与 `as T`；
6. 每个 surface 完成后立即 hook + typecheck，不批量迁完；
7. 彻底移除 feature 通用 transport escape hatch。

platform 与 operations 的 store/session/API 不共享实例；foundation 可共享无业务状态 primitive。

### 4.4 R5-CR03 安全与授权闭合

- password reset 与 invitation 使用同一 rate-limit capability、不同 purpose；
- invalid OTP 的计数与 rate receipt 使用 `noRollbackFor` 或独立必要事务，业务失败不能回滚安全事实；
- audit edge 必须先经 workspace-iam 的公开 task API 校验当前 assignment、page/action 与 data scope；仅以 workspace tuple 查询宿主 detail 明确禁止。经授权后才可调用 owner-local audit reader，organization/edge 不得直读 `workspace_iam.role_assignment`；
- invitation edge 映射 generated wire，HTTP 仅暴露 `maskedMobile`。`platform-admin` invitation 页面仅作 `CR02_ESCAPE` 字段名对齐（`mobileNormalized` → `maskedMobile`），不得夹带列、交互或样式变更；
- last-platform-admin guard 由 `platform-iam` owner 取得稳定 advisory transaction lock、锁定目标行并重算 enabled administrators；它是全局平台事实，不得迁入 workspace-iam；
- workspace-iam 使用既有 receipt table 保存 fingerprint/result，replay 返回原 readback 且不追加 audit；
- extension/platform-asset durable receipt 及平台空间初始化审计 writer 不在 CR03 实现：它们与新增式 migration、D-4 organization-owner move 绑定，统一在 CR04 关闭。asset staging replay 在 CR04 保存非秘密 fingerprint/asset facts，并为同一已暂存 asset 重新签发一次性 `bindGrant`；不得持久化或复显旧 grant，也不得追加第二个 audit event。

每项先保存修复前 focused red，再实施并 green。

### 4.5 R5-CR04 owner 边界与数据完整性

1. 扫描 owner Java SQL 中其他 schema table literal，与 dependency registry 对账；
2. 优先使用已注入 owner lookup/task API；缺 API 时只新增最小公开 query/command；
3. owner command 接收 edge 解析后的 `AuditActor`，不读取 `externalSubject()`；
4. 新增 migration：contract `items_json`、typed precondition、named checks/unique；
5. status/name 约束按当前 schema 动态盘点，不写死 migration 文件名单；
6. legacy audit 先验证 writer/readers 已切换，再 typed precondition 后 drop；
7. 补 organization node、group workspace 的 owner-local audit writer；
8. 完成 extension/platform-asset durable receipt 的 additive canonical shape 与 replay rule：extension receipt 以 `(group_workspace_key, entity_type)` canonical host identity 取代 legacy UUID 依赖；asset receipt 不保存 bindGrant，replay 在 asset 仍 staged 且 fingerprint 相同的条件下签发新的单次 grant；
9. 按 D-4 将商业集团初始化审计 writer 迁至 organization owner，先验证没有 retained writer/reader 后再处置 legacy platform-workspace path；
10. 执行 D-4/D-5；未裁定时本包不开始。

七个 fact-owner schema 明确为：
`platform_iam`（platform-iam）、`platform_asset`（platform-asset）、`extension`（extension）、
`workspace_iam`（workspace-iam）、`contract`（contract）、`platform_workspace`
（platform-workspace）、`organization`（organization）。`platform-access` 是 schema-less facade，
不是第八 owner schema。CR04 必须把 module registry 的 `platform_access` ownerSchema 更正为 null，
并以 module registry ↔ Flyway CREATE SCHEMA ↔ runtime datasource/search-path 三方双向对账守住七项。
不得为凑数创建空 `platform_access` schema。

任何跨 owner command 仍通过公开 API 并加入同一 REQUIRED transaction；task read 不推导写权限。

### 4.6 R5-CR05 写路径与 UI 一致性

typed endpoint 先把请求字段漂移变成编译错误，再修业务：

- status mutation 使用 contract 生成的 `targetStatus/revision`；
- capability replace 使用 contract 唯一属性；
- store transition 与其他 entity 共用 capability-level owner branch；
- v2 页面只作 CARRY/ADAPT 视觉与交互依据，不搬旧 API/后端语义；
- 列表行点击打开 Drawer/Modal，编辑动作位于 detail，不新增“操作”列；
- 优先消费 `libraries/frontend/admin-ui-foundation` 和 ProTable/Descriptions/Drawer/Modal；
- 两 app 独立 theme、shell、zhCN；
- 所有列表使用服务端 page/pageSize/total，真实 loading/error/empty；
- eslint/stylelint/architecture/typecheck 进入 build 前置。

### 4.7 R5-CR06 业务能力与 surface 闭合

按已裁决的 D-1～D-3，在冻结 22 surface / 25 pageDesignKey 内按 dependency slice 串行：

1. organization：实体编辑、总公司品牌授权、组织节点编辑/reparent/phase、门店编辑；
2. contract：编辑、失效、货号/扩展字段；
3. workspace-IAM：邀请创建/取消/重发、任职撤销、角色 capability；
4. authentication：R-15 outcome/candidates，登录前选择、shell 常驻切换、零任职态；
5. platform/password/home/store-profile 等缺失 surface；
6. 22/25 双向 closure 与 106 operation trace。

一个 capability 的完成单位是：typed endpoint + owner behavior + v2 carry/adapt UI + focused test +
L2 locator/evidence + hook receipt；禁止只建静态壳后算 surface 完成。

`操作历史` 未命中 confirmed corpus 时，owning source 是
`doc/decisions/2026-07-26-v2s-r5-operation-history-journey-decision.md` 与
`doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md`；
`扩展字段` 未命中 corpus 时，owning source 是
`doc/review/platform/2026-07-26-v2s-extension-and-role-storage-alignment-design-claude.md`
及 accepted R5 revised design §5。corpus miss 不解除这些 decision，也不授权重命名或重塑交互。

### 4.8 R5-CR07 可理解 DEV 与丰富 seed

reset 后 SQL bootstrap 只产生 `root/root`。其余事实通过受管 seed executor 调 owner command/API：

- 品牌、tenant、head company 各至少 25；
- 门店、运营合同各至少 30；
- 平台管理员、运营账号、集团空间、合同总览、组织总览各至少 55；
- 至少两个集团空间；每个有完整大区→项目→门店关系；
- 正常、停用、筹备、过期、无合同等边界通过业务字段表达，名称仍是自然中文；
- 角色、任职、邀请、扩展字段、合同货号、图片与视频形成可理解关系；
- fixture `key/purpose` 承载测试意图，业务名称不写“测试/无合同店”等机械标签；
- start/restart 只 additive migrate，不 seed；reset/seed 明确破坏性并有 readback/cleanup。

### 4.9 R5-CR08 测试、远端环境与证据接线

1. 测试前先跑 full compliance scan；
2. 补 wrapper，所有 Gradle 调用为 `./gradlew`；
3. verify 调用现有 remote Testcontainers runner，通过 SSH/docker exec/端口隧道；
4. 删除本机 colima socket 与用户名绝对路径；
5. remote host fingerprint 环境变量缺失即具名拒绝；
6. L2 registry target 与 `playwright test --list` 双向一致；
7. locator/testId 模块按 v2 有价值做法迁入；
8. sensitive candidates 在 persistence/readback/modal 三处均不出现；
9. 更新 106/39/56/11 evidence、kernel 与 Roadmap 状态；蓝图 project-skill 分母已在 CR00 订正，
   CR08 只核验无回退；
10. business 与 cleanup 分开，cleanup 红不得完成。

远端 Testcontainers 的被绑定入口是
`scripts/test/r5-remote-testcontainers.mjs@a0aa5028f9c8b8a9b1109fc7f880db242ed1505f46baec4fad4657e503ec7739`；
如用 named successor，必须先在设计/evidence 中给旧新行为对照与新 hash，不能静默换 runner。
verify adapter 只允许调用受版本控制 task registry 中的单个 `:<project>:test` task；禁止自由参数。
verification 必须显式提供 `V2S_DEV_REMOTE_HOST` 与 `V2S_DEV_REMOTE_HOST_SHA256`，无默认 host；
先以 BatchMode 读取 host identity 并匹配 hash，再上传 source snapshot。
runner receipt 固定包含 `runId/sourceSha256/task/remoteHostSha256/testResult/evidencePaths/
businessResult/cleanupResult/uncollectedContainerIds/remoteScratchRemoved`。真实红夹具覆盖：
缺 host/hash、hash 不符、task 未登记、source hash 漂移、测试失败、残留容器、scratch cleanup 失败。

### 4.10 R5-CR09 whole-scope review

CR00–CR08 全部 closure 后创建新的 `REVIEW_TARGET=IMPLEMENTATION` cycle，fresh 独立子 agent
两轮上限、Claude review、Dexter acceptance。中间包只产 receipt，不分拆 review。

## 5. Dexter 委托后的七项确定裁决

Dexter 已明确把本件所有待决项委托给 Codex。权威记录为
`doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`；
以下结果是本设计冻结输入，不再是默认推荐：

| ID | 方案 A | 方案 B | 已裁决 | 实施约束 |
| --- | --- | --- | --- | --- |
| D-1 通用 registry | 保留一个通用 `OperationsPageRegistry` | 按 v2 五类及七个 capability 建独立 feature surface | **B** | 不新增第 23 个 surface；在 U06 的 22/25 分母内归位 |
| D-2 七个编辑能力 | R5 内一次闭合，包内小切片串行 | 分批后置 | **A** | U06 全部闭合，仍只做一次 whole-scope review |
| D-3 四类缺失 surface | 全部纳入本轮 | 指定项进 HANDOFF | **A** | HOME 只做业务 bootstrap，不发明 dashboard |
| D-4 集团初始化审计 owner | organization | platform-workspace | **A** | organization 拥有审计事实；platform-workspace 仅任务型读取 |
| D-5 extension workspace identity | additive 恢复 `workspace_uuid` 并建 workspace/key/entityType 复合完整性 | 保持 key/entityType，完全依赖 owner API 校验 | **A** | 只新增 migration，不改已执行字节，不恢复 external-sync |
| D-6 二级索引 | 本轮基于真实 query/EXPLAIN 增加 | 不做猜测性索引 | **B** | 只接纳真实 query/EXPLAIN 证明必需的索引；其余不是 R5 欠账 |
| D-7 历史顺序偏离 | 接受 P1 未闭即进入后包 | 记为历史不合规，从 CR00 重启顺序 | **B** | 不回滚正确字节；CR00 真实 baseline 后才继续 |

## 6. 诊断清单八档覆盖矩阵

| 总册问题档/范围 | owning package | 完成 oracle |
| --- | --- | --- |
| 控制假绿、self-test、coverage、hook | CR00 | production red mutation + source-derived full scan |
| 契约悬空、generator map、106 closure | CR01 | strict resolver 0；untyped boundary 0 |
| generated 前端零消费、手写 path/Problem | CR02 | typed endpoint 全覆盖已实现 surface |
| OTP、audit 越权、手机号、last admin、receipt | CR03 | 六类 focused negative/rollback/replay |
| owner 直读、Actor、JSONB、约束、audit writer | CR04 | registry/source/schema 双向 closure |
| 字段漂移、store 状态、ProComponents/theme/paging | CR05 | typed compile + page-level behavior |
| 编辑能力、R-15、扩展、22/25 | CR06 | surface closure table 22/22 |
| seed、DEV、root、业务可读数据 | CR07 | 阈值/readback/business/cleanup |
| L2、wrapper、远端 Testcontainers、evidence/memory | CR08 | discovered tests + managed full verification |
| 一次性实施复核 | CR09 | independent review + Claude + Dexter |

清单内每条 M/S/N 必须在 package execution ledger 有 findingId、source evidence、owner package、
resolution/evidence；`NOT_APPLICABLE` 必须给 owning source 与理由，不能只写“不涉及”。

## 7. 增量验证点

| package | 最小增量单位 | 每单位立即执行 |
| --- | --- | --- |
| CR00 | 一条控制 | clean/red/clean + hook |
| CR01 | 一组 ref / 一个 schema family | strict resolver + generation diff |
| CR02 | 一个 surface endpoint | hook + typecheck |
| CR03 | 一条安全 invariant | focused red→green |
| CR04 | 一条 owner edge / 一个 migration concern | registry scan + precondition |
| CR05 | 一个页面 | hook + typecheck + focused L2 |
| CR06 | 一个业务 capability | typed/owner/UI/focused/L2 receipt |
| CR07 | 一个 seed owner family | command readback + threshold |
| CR08 | 一个 runner/evidence family | discovery + exact negative fixture |

这些增量验证不建立独立 review，不产生中途 GO。

## 8. 失败、重试与恢复

- 首次失败保留 run-scoped logs/manifest，不立即重跑；
- 同一 signal 第二次尝试前定位 source、process、remote runner、container 与 cleanup 边界；
- 不延长 timeout、不轮询、不用空 fixture 掩盖失败；
- hook 失败只阻断后续受保护写，不改变业务数据；
- migration precondition 失败具名停止并列违规 row id；
- remote run 的 business/cleanup 分开；cleanup 失败保留 namespace/object/process 清单；
- 已执行 migration 永不改写；修复只新增版本。

## 9. 方案合理性与替代比较

最小替代是按 M/S/N 逐条修补并在末尾再跑现有 verify。它改动较少，但不修“实施时无人执行设计”
和“门不会红”的根因，下一波仍会复发，因此拒绝。

更重替代是重写整个 R5。当前 controller capability 布局、owner libraries、106 contract catalog、
部分 audit/asset/extension 形状仍可保留；全量重写会增加迁移与回归风险，因此拒绝。

本方案选择“先建立真实控制面，再按依赖修当前字节”，保留正确资产，同时让每次偏离在产生文件时
被发现。成本集中在 CR00/CR01，但能显著缩小后续返工面，符合阶段成本。

从用户任务看，最终目标是 Dexter 能在完整 DEV 中使用两个独立后台完成冻结的 v2 已实现业务，
而不是看到静态壳、技术字符串或无法编辑的列表。本方案把 typed contract、owner readback、
v2 carry/adapt UI、丰富 seed 和 L2 绑为同一 capability closure，符合该目标。

## 10. 评审与接受后的实施入口

评审顺序：

1. fresh 独立子 agent 以证伪立场审本设计与 manifest；
2. 作者只做 finding intake，不代写 verdict；
3. 最多第二轮 fresh 独立盲审；
4. Claude review/recheck；
5. Dexter 接受已含委托裁决的完整设计；
6. 另行给出 implementation exact authorization 后，只从 CR00 开始。

没有第 5、6 步，不得执行本计划中的任何 implementation change surface。
