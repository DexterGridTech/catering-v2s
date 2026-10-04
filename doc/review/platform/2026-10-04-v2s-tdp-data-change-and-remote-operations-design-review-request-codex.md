# Claude 评审交接：TDP 数据变化通知与远程运维设计包

## 背景

《TDP 数据变化通知与远程运维》详设与实施计划已完成作者修订。内部 DESIGN cycle 的两轮独立审查已达上限，第二轮原始 verdict 为 `NO-GO`、M/S/N=1/3/1；主 agent 已按 `SELF_DECIDED` 规则完成 intake，不重开该 cycle。Dexter 已裁决：CBS 与 TDS 不直接通信，只通过数据库投递；CBS提交后唤醒TDS，TDS写入执行结果，CBS按需主动查询；失效binding的终端事实按A保留且不以新binding补报；CBS不删除已提交历史。本文档只请求对当前两份设计文档做外部独立 DESIGN review，不提交实现或运行证据。

## 评审目标

请从需求目标、业务owner、数据库事务与跨进程边界、scope/cache一致性、TDS/TDC/feature调用链、失败与容量语义、验收覆盖及实施计划依赖顺序独立判断设计是否简单、可实施、可证伪。不要把内部历史 verdict 或作者 intake 当成当前字节的独立结论。所有 TDP 生成、编译、测试、verify、DEV 与动态场景仍为 `NOT_RUN`。

## 需阅读文件

- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：当前完整详设、owner/事务/错误边界、CP与逐判据验收映射。
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`：当前实施顺序、具体路径、验证入口、运行与交付前置。

## 独立核验重点

1. 核验CBS写意图→PostgreSQL `NOTIFY` 唤醒→TDS具名SQL认领→现有WebSocket投递→TDS具名SQL写结果→CBS主动查询的完整闭环；确认不需要CBS↔TDS HTTP或直接调用，也不允许TDS绕过owner写表。
2. 核验旧binding终端事实保留、不得用新binding补报，以及CBS已提交历史不删除、不设应用层条数上限的明确后果是否与正式需求及有限资源要求相容；检查数据库容量失败和TDC本地容量拒绝是否有准确边界。
3. 核验`tdp.cache.restart.readback`、`tdp.listener.rebuild.current-cache`、`tdp.remote.cbs-history-retention`与CP-01门闭包表能否确实执行详设中的断言；静态计划不可冒充已运行。
4. 核验第三方解析版本与精确版本官方API依据被放在实施CP入口，而没有冒称当前已核验；标出会阻断实现或设计通过的缺项。
5. 核验§11a需求与场景映射、CBS/TDS/TER执行面与NOT_RUN/NOT_COVERED标签是否自洽。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 及 `M/S/N`。每条 finding 写明详设/计划位置、仓内事实或推论、证据路径与行号、影响面、最小可验收修正及是否需要Dexter产品裁决。明确区分设计缺口与尚未执行的实现/动态证据。

## 授权边界

本次只请求评审上述两份详设与实施计划；不授权TDP源码/测试实施、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署或批次外工作。Claude review 后由Dexter裁定后续步骤。谢谢。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《TDP 数据变化通知与远程运维》当前详设与实施计划。

背景：当前两份设计文档已按Dexter最新裁决更新。内部 DESIGN cycle 已完成两轮独立审查并关闭，第二轮原始结论为 NO-GO、M/S/N=1/3/1；主 agent 已按 SELF_DECIDED 完成 intake，不重开原cycle。本次只复评当前文档字节，不继承历史verdict或作者自述。TDP生成、编译、测试、verify、DEV与动态验收均未执行。

评审目标：独立判断方案能否简单、正确地闭合CBS owner数据变化→PostgreSQL唤醒→TDS/TDC→store-basic，以及数据库投递的远程command与结果查询；检查失败边界、容量、验收映射和实施依赖顺序。

请从 catering-v2s 仓库根只阅读以下两份交付文档：
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：详设与场景/判据映射。
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`：CP实施顺序与验证计划。

请重点独立核验：CBS与TDS仅通过数据库投递，CBS写意图后唤醒TDS、TDS经owner SQL command认领并写结果、CBS主动查询的路径；旧binding记录按A保留且不得由新binding补报；CBS不删除历史且没有应用层条数上限时的数据库容量失败语义；cache重启/listener重建、CP-01门闭包和逐条验收场景能否验证详设断言；未解析依赖与未运行的动态证据是否被准确留为OPEN/NOT_RUN。

请给出明确 `GO` 或 `NO-GO` 及 `M/S/N`。每条finding请列精确章节/条款、仓内事实或推论、仓库相对路径与行号、影响、最小可验收修正，以及是否需要Dexter产品裁决。

授权边界：本次只评审上述两份详设与实施计划，不授权TDP实现、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署或批次外工作。谢谢。
```
