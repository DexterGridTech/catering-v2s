---
title: catering-v2s implementation-design-granularity checker Codex 实施自审
status: GO
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
implementationAuthority: control-plane-only
businessImplementationAuthority: false
---

# catering-v2s implementation-design-granularity checker Codex 实施自审

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=IMPLEMENTATION-DESIGN-GRANULARITY-CHECKER
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

## 用户任务

业务用户不是要一个“存在即可绿”的脚本，而是要 R3 implementation-facing design 在交给 Claude 前能够机械证明：设计 hash/source anchor 未漂移、每个 delivery unit 具备实际实施粒度、review finding 与 unit verdict 闭合、两轮上限真实生效。

## Dexter 立场

Dexter 已明确 Codex 对完成交付所必需的仓内控制面拥有直接维护权，不需要逐文件授权；同时仍要求拒绝过度设计、拒绝假绿，且不得借 checker 名义进入业务 implementation、runtime、数据库或 Git。

## 替代方案

- 只做 shell `test -f` 最短，但不选：它不能发现 hash 漂移、空 evidence、漏 unit verdict 或伪造 severity count；
- 为 manifest 引入 JSON Schema/Ajv 更标准，但不选：当前仓没有该依赖，会引入下载与第二套错误语义；
- 在现有 Node 标准库 checker 内使用同一 production validator 驱动 clean/self-test/red fixture，零依赖且错误原因精确，因此采用。

## 方案合理性

问题与方案匹配。一个 Bash 入口加一个 Node 标准库 validator 足以覆盖当前控制面，不建立框架、插件或通用 policy engine。收益是正式 handoff 不再依赖文档自报；代价限制在两个小文件与临时目录 self-test，复杂度与 R3 design 风险匹配。

## UI 与交互

NOT_APPLICABLE。理由：该实现是仓内静态控制面，不涉及业务 UI 或用户交互；用户可见结果只有确定性的 PASS/FAIL 与精确 reason。

## 审查意见复核

`CONFIRMED`：实施自审重开源码后发现初版只验证 unit verdict 中列出的 finding 是否有效，反向没有证明 finding 声明影响的每个 unit 都确实回列该 finding；另有 `allSixUnitsReviewed` 把当前数量误写成通用语义。反例是从某 unit verdict 删除真实 finding，旧实现仍可能绿。

更小修复不是引入图框架或增加过度设计成本，而是在同一 validator 建立 `verdictsByUnit`，反向遍历 `finding.unitIds` 并要求双向链接，同时改为 `allDeliveryUnitsReviewed`。新增 `MISSING_FINDING_UNIT_LINK` red fixture 证明旧假绿已被拒绝；不扩展到业务 semantics 或未来 R4 全量门。

## 实施代码核验

- 源码：重开 `scripts/check/implementation-design-granularity` 与 `tools/implementation-design-granularity/cli.mjs`，确认 wrapper 只解析仓根并 exec 唯一 Node validator；
- 生产路径：复算 design/authorization/两轮 review/source/checker hash，唯一 anchor，delivery unit change/evidence/UI/data/serial/discriminator，以及 finding↔unit verdict、severity、review round；
- 编译/语法：`node --check` 与 `bash -n`；
- 测试 evidence：production 当前 packet PASS；self-test clean PASS；design hash drift、missing business evidence、severity mismatch、round three、missing finding-unit link 五类 red fixture PASS；
- 真实消费：`scripts/check/claude-review-handoff` 已实际调用该 checker并 PASS，不是独立命令代证；
- 业务用户行为：checker 只决定 design packet 结构/引用是否可交接，不接受 `R3-J01`，不授予业务实现，也不把 review `NO_GO` 改写成 `GO`。

## 闭环核验

- source/hash：manifest 绑定 checker wrapper/tool exact SHA-256，production validator 自验；
- failure：所有失败输出 `IMPLEMENTATION_DESIGN_GRANULARITY=FAIL` 与单一精确 reason，非零退出；
- cleanup：self-test 只用 `mkdtemp` scratch，`finally` 删除；无 runtime、数据库、容器或后台进程；
- integration：formal Claude handoff gate PASS；
- scope：未创建 `apps/**`、business contract、migration、runtime 或 test environment，未执行 Git 写操作。

## 结论

```text
VERDICT=GO
M=0
S=0
N=0
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
SECOND_ROUND_REQUIRED=false
BUSINESS_IMPLEMENTATION_AUTHORITY=false
```

一轮实施自审已获得足够源码、red fixture 与真实 handoff 消费证据，无实质不确定性需要第二轮；按“最多两轮而非必须两轮”自行收口。
