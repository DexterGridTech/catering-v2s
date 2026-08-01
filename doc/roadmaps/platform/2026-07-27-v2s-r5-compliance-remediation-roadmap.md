---
title: R5 合规整改 Roadmap（候选）
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
roadmapId: R5-COMPLIANCE-REMEDIATION
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
---

# R5 合规整改 Roadmap（候选）

## 0. 状态与用途

本件是现行 R5 Roadmap 的**候选整改子 Roadmap**，尚未写入 program registry，也不改变现行
Roadmap 的历史状态。D-1～D-7 已按 Dexter 委托由 Codex 裁决；Claude recheck 与 Dexter 接受
完整设计前，它仍不授权实施。

输入分母：

- `doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md`
  的合并 NO-GO 范围；
- `doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-codex.md`
  的独立诊断；
- 当前仓库字节的 Codex source-first 复核；
- 已接受 R5 修订详设、106/32/22/25/7 冻结业务与技术边界。

## 1. 为什么必须建立新 Roadmap

这不是若干孤立 bug。现有实现同时出现三种系统性失效：

1. 冻结的禁止项、批准断言与 project-memory assertions 没有在文件产生时被核对；
2. 多个控制能在注入违规后继续 PASS，门绿不能证明其声称的命题；
3. 契约到 generated wire、generated wire 到前端、设计到 surface 的链路中断。

可观测后果包括：运营写路径缺失、状态请求形状漂移、门店启停双向错误、多任职登录死锁、
公开 OTP 无限流、审计越权、22 个 surface 无一完整吸收。继续在当前形态上逐条补 bug，
会保留同一产生机制。因此整改必须先修控制与过程，再按依赖顺序重建契约、消费面、安全、
owner、UI、业务能力、DEV/seed 与证据。

## 2. 路线命名提案

清单写“九个工作包”，但编号 `W00–W09` 实际含十个 ID。本 Roadmap 将其解释为：

- 九个实施包：`R5-CR00`～`R5-CR08`；
- 一个终验 step：`R5-CR09`，不产生新的业务实施包。

| 提案 step | 名称 | 对应范围 |
| --- | --- | --- |
| R5-CR00 | 合规控制面 | W00 |
| R5-CR01 | 可解析契约与 typed generation | W01 |
| R5-CR02 | typed 前端消费底座 | W02 |
| R5-CR03 | 安全与授权闭合 | W03 |
| R5-CR04 | owner 边界与数据完整性 | W04 |
| R5-CR05 | 写路径与 UI 一致性 | W05 |
| R5-CR06 | 业务能力与 surface 闭合 | W06 |
| R5-CR07 | 可理解 DEV 与丰富 seed | W07 |
| R5-CR08 | 测试、远端环境与证据接线 | W08 |
| R5-CR09 | R5 whole-scope implementation review | W09 |

包 ID 与 step 名称已随
`doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`
确定；这不产生实施授权。

## 3. 严格串行拓扑

```text
CR00 → CR01 → CR02 → CR03 → CR04 → CR05 → CR06 → CR07 → CR08 → CR09
```

合并清单中 W03 曾标注“可与 W01/W02 并行”，但 Dexter 后续明确要求包级串行；本 Roadmap
采用更晚、也更明确的裁决，**不保留任何包级并行例外**。包内也只允许按文件或 capability
小步串行，完成一个增量核对后才能进入下一个。

每包只有两种控制状态：

- `ACTIVE_RED_VERIFIED`：生产控制先在 scratchpad 仓库拷贝上被真实变异打红，失败原因精确；
- `OUT_OF_SCOPE_THIS_PACKAGE`：该控制不守卫本包，写明 owning package 与理由。

禁止 `PENDING <本包后续步骤>`。上一包 exit gate 不是全绿，下一包不得开始。

## 4. 四个不可绕过的过程闸口

1. **文件级增量合规 hook**：写前确认当前包和受保护范围，写后从冻结 source 动态加载适用断言，
   对本次改变的文件立即静态核对。hook 只判合规，不查询、不注入上下文。
2. **测试前全量合规扫描**：任何 typecheck、单元、集成、L2/L3、DEV 或 seed 运行前，
   先扫描当前全仓字节及前序包 closure；失败即不进入测试。
3. **红先于绿**：新增或修复控制先做 production-path red mutation，再允许生产 clean run。
   `--self-test` 不得跳过 clean production execution，也不得自己豁免被测 action。
4. **包级 exit receipt**：记录 source hash、适用断言分母、增量核对结果、全量扫描结果、
   red mutation、business 与 cleanup 的适用性；措辞不能覆盖红事实。

每个 exit receipt 必须附逐项 disposition：project-memory 当前全部 assertion occurrences、
accepted manifest 全部 approved/forbidden 项、本包详设全部完成判据与禁止项、owning
surface/pageDesignKey、到期 standards ruleId。每项都要有 source hash、适用性与 evidence；
不适用也要给理由和 owning package。任何遗漏都会使该包 FAIL。

CR00 还必须把这份逐项 disposition policy 接入现有
`implementation-design-granularity`：今后所有 implementation-facing 详设的每个 delivery unit
都要声明包尾逐项对账分母与 source；缺声明、缺 unit、悬空 source、出现 `PENDING` 均机械红。
同步更新本仓 plan skill 壳、AGENTS/CLAUDE 与 project-memory，旧已收口 cycle 不追溯。

合规核对与测试执行严格分开：前者是亚秒级静态 source-to-rule 对账，后者才使用 Gradle、
远端容器或浏览器。

## 5. 包级完成条件

### R5-CR00 合规控制面

- 修复 code-layout、security、logging、database、affected-L2 五类假绿；
- 修复 frontend/code-layout self-test 逃生分支；
- standards-coverage 能识别引用门被替换成无条件成功；
- 接入 PreToolUse/PostToolUse 文件级增量核对；
- 首批规则从 accepted manifest、carry-over inventory、project-memory required inventory
  动态读取，不复制 36/26/69 或 25 的字面清单；
- 真实 Codex client invocation canary 证明受保护文件写入确实触发 PostToolUse，删除/改错注册
  必须以缺 invocation receipt 精确红；
- package receipt 独立枚举实际变更文件集，必须与非空 `incrementalChecks` set equality；
- 从派生规则集重扫当前树得到 forbidden 违反集合并逐条命中，诊断件的 15 仅作差异交叉核对；
- `provider-free-context` 的旧 skill 分母在 CR00 订正并经 production path 真绿。

### R5-CR01 可解析契约与 typed generation

- 独立、标准 JSON Pointer 递归解析器给出全仓 unresolved `$ref = 0`；
- bespoke generator 不再按 schema 名兜底；
- generated boundary 不含 `Map<String,Object>` 或等价未类型化业务 DTO；
- 106/39/56/11、HTTP path、operationId、error code 均不漂移。

### R5-CR02 typed 前端消费底座

- 两 app 从 face-specific generated endpoint 消费契约；
- feature 内手写 API path、通用 request escape hatch、业务 `any/Record<string,unknown>` 为零；
- router/store/session/API facade/401/context invalidation/Problem feedback 接线完成；
- 每迁移一个 surface 的 endpoint 就立即执行 hook 与 typecheck。

### R5-CR03 安全与授权闭合

- password reset OTP send/verify 限流与失败计数不回滚；
- audit read 继承宿主 detail read 权限；
- 手机号仅返回/展示 masked readback；
- 最后管理员并发守卫、三 owner 幂等 receipt、replay 不重复审计均有 focused red→green。

### R5-CR04 owner 边界与数据完整性

- 未声明跨 owner schema 直读为零，代码事实与 dependency registry 双向对账；
- AuditActor 从 edge 传入，不由 owner 取 external subject；
- 合同货号 JSONB、状态/名称约束、legacy audit cutover、缺失 audit writer 完成；
- 已执行 migration 字节不改，只允许新增式演进。

### R5-CR05 写路径与 UI 一致性

- typed model 编译期消除状态、revision、capability request 漂移；
- 门店状态后端方向与契约一致；
- 列表不新增操作列，优先使用 admin-ui-foundation 与 ProComponents；
- 两 app 独立 theme、zhCN、服务端分页、真实 loading/empty/rowKey、lint/stylelint 闭合。

### R5-CR06 业务能力与 surface 闭合

- 按已裁决 D-1～D-3 闭合七个 operations 编辑能力与全部冻结缺失 surface；
- R-15 outcome/candidates/常驻角色切换器完整；
- 动态扩展字段、可见数据节点候选、actionSummary 中文映射完成；
- 22 surface / 25 pageDesignKey 双向对账，无第 23 个 surface。

### R5-CR07 可理解 DEV 与丰富 seed

- reset 后只有 `root/root` bootstrap；其余业务事实通过 owner command/API seed；
- 有列表实体达到 Dexter 已裁定阈值且可翻页；
- 两集团空间、完整组织关系、中文业务名、图片/视频、角色任职与边界样例真实可理解；
- start 不 seed，reset/seed 显式分离，business/cleanup 独立。

### R5-CR08 测试、远端环境与证据接线

- 声明的 L2/L3 target 全部存在并被 runner `--list` 发现；
- Gradle wrapper 与 `./gradlew` 接线完成；
- Testcontainers 通过仓内既有远端 runner，不使用本机 Docker socket；
- remote host fingerprint 缺失时 fail-closed；
- 106/39/56/11、memory/kernel、蓝图、Roadmap/evidence 状态一致。

### R5-CR09 whole-scope implementation review

仅在 CR00–CR08 全部 exit receipt 真绿后进入。只进行一次
`REVIEW_TARGET=IMPLEMENTATION` 全范围复核；中途 receipt 不是 GO，也不建立独立 review cycle。

## 6. 已解决的委托裁决

D-1～D-7 已由 Dexter 委托 Codex 裁定，权威记录见
`doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`：
`D1=B / D2=A / D3=A / D4=A / D5=A / D6=B / D7=B`。所有包仍保持
`BLOCKED_BY_IMPLEMENTATION_EXACT_AUTHORIZATION`；裁决解决产品与结构选择，不替代设计接受或实施授权。

## 7. Roadmap 完成定义

本 Roadmap 只有在以下事实同时成立时完成：

1. CR00–CR08 每包 exit receipt 真绿且顺序无跨越；
2. 106/32/22/25/7 与获批审计增量不漂移；
3. whole-scope implementation 独立对抗审查、Claude review、Dexter acceptance 完成；
4. DEV business 与 cleanup 均 PASS；
5. HANDOFF 仅承载 Dexter 明确裁掉或后置的事项，不承载本轮漏做。
