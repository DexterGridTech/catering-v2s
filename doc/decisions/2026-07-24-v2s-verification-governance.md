---
title: catering-v2s 验证工作的通用规则
status: active
createdAt: 2026-07-24
effectiveScope: R3-R6-and-later
decisionOwner: Dexter
reviewStatus: CLAUDE_REVIEWED_DEXTER_CONFIRMED
implementationAuthority: false
---

# 验证工作的通用规则

## 1. 目标与总原则

目标是同时获得高质量与高效率：质量靠分工与独立性，不靠验证物料堆积；效率靠小批量与门的克制，不靠跳过验证。

本规则适用于 R3–R6 及以后所有步骤。它不改变当前 R3/W1 的产品入口、授权或运行边界，也不把任何设计/审查结论自动升级为实施授权。

## 2. 三层分工，不越界

### 2.1 机器门只作机械判定

机器门只负责 hash 复算、计数/分母、存在性/唯一性、交叉对账，以及编译器、类型检查、既有测试等已有判定器能做的事实。准入标准只有一句：**判定规则能一行说清，且不需要理解业务**。文档与代码同等对待，冻结输入一律 hash。

### 2.2 语义质量靠独立对抗审查

业务语义、用户任务、方案合理性、交互路径、架构取舍和 evidence 是否真的证明业务结果，必须由 fresh 会话的独立对抗审查判断。交付物要说明“发起了哪些攻击、攻击结果如何”，再交 Claude 独立评审。

禁止把语义判断编码成 checker：写门与写交付物处于同一会话时，其盲区会被原样复制，只会制造假安全感。语义规则应作为明确 review checklist，而不是关键词匹配或形式字段门。

### 2.3 意图与取舍归 Dexter

方案是否该做、产品/Journey 语义、UI 手感和 severity 是否可接受，归 Dexter 裁定；不进脚本，也不由 AI 终裁。

## 3. 建门三问

只有下列三项全部为“是”时，才可新建或扩展机器门；否则必须作为 review checklist 一条：

1. 这类错误会反复发生，属于回归类而非一次性问题；
2. 判定是纯机械的；
3. 建门与每波维护的成本，小于它未来可节省的返工。

## 4. 假绿优先治理

每个门必须实际驱动 production 本体，并至少配一个已验证会改变行为的真实变异证明其会红。做不到真实红的门不得上线；已经上线的门如被发现以关键词匹配冒充理解业务，按 finding 处理。

## 5. 小批量与独立性

返工成本正比于批量大小。质量问题优先通过切小交付单元、冻结后即送独立审查解决，其次才考虑增加验证轮次。任何一轮交付若超过评审者半小时能核完的量，必须先切小再送审。

## 6. 效率红线

`scripts/verify` 全套必须保持分钟级。若超时，先识别并砍掉最弱、最不具判别力的门，而不是接受验证持续变慢。既有过重验证不因沉没成本而追溯拆除，但不得继续扩展或仿效。

## 7. 执行落点

- 机器可判定规则：接入现有 `scripts/verify`/原生判定器，并带 production 驱动与真实 red mutation 证明；
- 语义规则：进入 Codex 对抗自审、Claude 独立评审和 standards coverage 的 review checklist，不另造伪语义 checker；
- 产品取舍：保持 `DEXTER_DECISION`，不由门或 AI 结论替代；
- 每次 R3+ 设计、实施、测试或 review 都要先应用本规则；本规则本身不要求为历史交付追溯新增验证物料。

## 8. 阶段归属与闭环顺序：后台 API → 前端 L2 → DEV seed

P4 证明了“把 API、L2、seed 放进一个长链路再逐层定位”会把真实缺陷放大成无效墙钟，并让测试层边界、证据状态和 cleanup 责任互相污染。自本节生效后，后续每个业务域都必须按以下设计约束组织：

1. **后台开发阶段闭环 API。** 后台 owner/edge/契约实现、后端单元/聚焦测试和后台 API 测试属于同一个 backend implementation package。API 测试必须有自己的 fixture/readback、business/cleanup evidence；API 未通过或未完成，不得启动前端 L2。API 失败应在共享前置 barrier 处 fail-fast，不能吞异常后跑完整分母制造噪声。
2. **前端开发阶段闭环 L2。** 前端实现先完成 IA/详设逐控件静态对账，再运行浏览器 L2，L2 只对 UI 可见性、交互、状态恢复和用户任务结果负责。L2 可以触发正常 HTTP 业务请求，但不得运行 API 测试套件、等待 API runtime report，或依赖 API run 的数据库/会话/资产状态。L2 自己创建或声明所需事实并自己回读。
3. **DEV seed 只服务体验。** API 与 L2 都闭环后，才执行 DEV reset/seed 交付可体验事实。seed 不是 API/L2 的 fixture，不进入 API/L2 业务分母；seed 保留 DEV 事实，破坏性数据库和媒体清理由 reset 负责。
4. **可共享的只有静态定义。** OpenAPI/generated contract、scenario catalog、fixture schema 和静态 fixture definition 可被 API/L2/seed 复用；运行态数据库行、资产 namespace、cookie/token、runtime report、L2 sidecar 和 seed report 禁止跨层复用。三层必须有独立 runId、报告、首败、businessStatus 和 cleanupStatus。
5. **入口与证据必须能证明边界。** L2-only runner 的 API child call 必须被位于调用点之前的 stage guard 包住，并用删除/反转 guard 的真实 red mutation 验证；阶段 metadata 必须与实际执行一致。每个 L2 case 记录 START 和终态、`completed=X/Y` 与 current case；每个 API runner 保留 firstFailure、lastKnownGood 和 broken boundary。源码/契约/runner 修改后，旧 runtime evidence 不得冒充当前字节 PASS。

因此，后续详设和 package exit 的固定顺序是：

```text
backend implementation + API closure
  → frontend implementation + IA reconciliation + L2 closure
  → DEV reset/seed + manual experience
```

若一个大 package 同时含三层，必须在 package 内显式拆成上述三个有序内部阶段；“一次联合脚本跑完”不能作为替代。完整失败模式、upsert conflict target、共享 barrier 和 evidence 约束记录在 `project-memory/operations/phase-retrospective-and-systemic-repair.md` 的阶段闭环条目中。
