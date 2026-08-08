# P4 acceptance-spec recheck handoff (Codex → Claude)

## 背景

Claude 对 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-judgment-spec-codex.md` 的首轮结论为 `NO-GO — M=0 / S=2 / N=1`，finding 记录在 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-spec-review-claude.md`。Codex 已按 S-01、S-02、N-01 逐条修正。

## 请复核

1. §2.1 是否已改为真实存在的 `(operationId, problemCode)` 外键，并且不再要求不存在的 `conditionId`；
2. §2.2/§2.3 是否明确要求 API case-level polarity，而不是从 fixture `purpose` 推断；
3. 31 条 fixture-candidate caseId、6 条 `STRUCTURAL_BLOCK`、`CI-API-022-01` 正向 replay、`CI-API-022-02` 负向 owner failure 是否构成 38/62 exact-set；
4. 是否明确禁止不存在的 `OWNER_COMMAND_FAILED` problemCode，并要求绑定现有 assertion matrix problemCode；
5. seed DAG 是否以 fixture `entities.relations` 为唯一真相，manifest 仅为派生计划，且删除 Dinner Set → Latte 关系的红变异会失败；
6. §3/§4 原有 HTTP-only、readback、重跑漂移、profile 隔离、B→A+F 排期与 runtime boundary 是否保持不变。

## 边界

本轮仅复核 P4 验收判定设计与静态输入，不执行 P4 runtime、seed、API、L2、数据库、migration、部署或 cleanup，不把设计 PASS 写成业务 PASS。

## 可直接复制的话术

```text
您好 Claude，

P4 验收判定规格首轮为 NO-GO — M=0 / S=2 / N=1。Codex 已完成整改，详见：
doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-spec-disposition-codex.md

请独立复核：
1. conditionToProblemRef 是否使用真实的 (operationId, problemCode)，不再引用不存在的 conditionId；
2. polarity 是否落在 API case 级别，不从 fixture purpose 中文散文推断；
3. 31 条 fixture-candidate、6 条 STRUCTURAL_BLOCK、CI-API-022-01 正向 replay、CI-API-022-02 负向 owner failure 是否形成 38/62 exact-set；
4. 是否禁止不存在的 OWNER_COMMAND_FAILED，并要求选择 assertion matrix 中实际存在的 problemCode；
5. seed DAG 是否由 fixture entities.relations 派生，manifest 仅保存派生计划，并有删除 Dinner Set→Latte 关系的红变异；
6. §3/§4 的 seed HTTP-only、readback、幂等漂移、profile 隔离、B→A+F 顺序和非 runtime 边界是否保持。

请给出 GO 或 NO-GO，以及 M=<数量> / S=<数量> / N=<数量>。

授权边界：仅 P4 验收判定设计与静态输入复核；不授权 runtime、seed、API、L2、数据库/migration、部署、cleanup 或 Git。
```
