---
title: 终端激活与长连接批次一 CP-05 当前操作基线
status: IMPLEMENTATION_ACCEPTED
createdAt: 2026-09-29
decisionOwner: Dexter
decisionRef: DEXTER-2026-09-29-V2S-TERMINAL-ACTIVATION-CP05-BASELINE-296
implementationAuthority: true
---

# 终端激活与长连接批次一 CP-05 当前操作基线

## 1. 决策

Dexter 对批次一的明确实施授权要求：当前实现完成后，以三次全目录标定重建预算投影；每份报告必须包含当前全部 296 个 operation 身份与实测最大值。按 backend-acceptance 的线性预算闭集，三份运行分别覆盖批量请求基数 `1`、`20`、`100`，且取每个 operation 三次中的最大值，不取平均值。

本决定将此前的 293-operation 基线替换为批次一当前字节上的 296-operation 基线。它只选择有完整受管来源的测量输入，不授权移除或弱化业务事实，也不改变线性预算公式。单一 `postOperationsStoreTerminalStatus` 的固定上限 18→23 由 D-39 的独立 operation-scoped 例外记录提供，不由本基线决定裸放宽。

## 2. 证据

报告的三次输入及摘要如下：

| runId | batchCardinality | manifestDigest | eventsDigest |
| --- | ---: | --- | --- |
| `r5-tc-1790614725367-95783` | 1 | `941ea58c352f84be4b4bb3496884356139d07d229446b2e014fbbc45bfb9bcb2` | `29951c6a55e99ba4e18189cc933e1ed51e145da9ec488b0903e1d55d96dd4a20` |
| `r5-tc-1790613050325-89420` | 20 | `0a02028e7d537907823b39845f9ca762e38ada0f9fa22da9d310dee5b3d5c0e0` | `a37773eb57dd42856713bb138aff9ee09f31f0babc1b2933c32a7fef9b514294` |
| `r5-tc-1790615209406-96578` | 100 | `d92c33164d8a4d36dcac1d75323197c61f1345ea81ff823af58275f80f7f8824` | `5c2a4deec3619d0aff179f76616aef77583238bd5add3635c16b881386fd4794` |

三份报告均为 `CALIBRATION`，使用相同 workload fingerprint `a709f6516ce8f83eb94b74c25b317b2dc0ceefd8aafb3e124b8f9200169a42d6`；每份都为 `296/296` exact-set、缺失/额外/漂移为空，业务、TDS contract、测量归档与 cleanup 均 `PASS`，未分类 SQL 为 0。CP-05 唯一报告住址为 `contracts/policy/backend-performance-cp05-calibration-report.json`，其 `replayIdentity.contentDigest` 为 `3e95e6026271a50d22b206e0669223ddf136fe92e3167e5a1e791d1bfc02d53e`。

线性 operation `batchTransitionOperationsCatalogItemStatus` 在三个基数上的实测为 `1→20`、`20→113`、`100→513`，均低于原 `15 + 5 × cardinality` 闭集上限。D-39 operation `postOperationsStoreTerminalStatus` 三次最大值分别为 `23`、`23`、`23`；其 `authority=IMPLEMENTATION_AGENT`、双重准入证据与未授权时阻断红测位于 `scripts/generate/backend-performance-budget.mjs` 和 `scripts/test/backend-performance-budget.test.mjs`。

本次在最初三次调用中遗漏显式批量基数，三份都使用默认 20；这些运行保留为历史证据，但因未闭合 `1/20/100` 基数集而未纳入本基线。其余两次重复的基数 20 运行也未选入；选用同一 workload fingerprint 的一份 20 报告，并补齐基数 1 与 100。

## 3. 与前一基线的关系

本决定以新的 `decisionRef` 取代 `doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md` 对批次一当前 CP-05 build-time report 的基线引用。旧决定及其 293-operation 测量保持历史有效，不改写旧 run 或历史报告；新的唯一 build-time 预算输入仍是上述 CP-05 报告。

每个固定预算由当前三次最大值和已注册分类器计算。实施例外只能由其 own operation-scoped source record 控制；本决定不建立跨 operation 的预算例外，不改变 operation 身份闭集、业务契约或一般类别上限。
