# BACKEND-PERFORMANCE static NO-GO Round-2 follow-up — Claude review request

## 背景

Claude 的 Round-2 静态复核给出 `NO-GO (M=1, S=0, N=2)`：P3 对所有 GET 再包 `CatalogQueryEnvelope`，而六个 model-owned GET 已有 `{revision, requestId, data}`，造成类型双层和商品抽屉/字典抽屉错误；package input 的 entry hash 也没有可核验的 current/exit 语义，命令 response 仍可能语义重复包装。

本轮从 owning source 修复全族：P3 用 read-model/OpenAPI required 判定唯一 transport-envelope owner；Local Copy 同族消费者改为 direct model decode；命令族由同一分类器限制为 model-owned direct 或两条 source-proven legacy wrapper。package input 现区分 immutable entry snapshot、current bytes 和 package-exit observed bytes；BPF-U01 source inventory 首败已由 owning generators 重建并做 196/196 对账。

新的独立盲审已完成 `GO (M=0, S=0, N=0)`，但该结论只覆盖静态整改，现请求 Claude 独立复核。

## 评审目标

请独立确认此次整改真实关闭 Claude Round-2 的 M-01/N-01/N-02 同族问题：16 个 GET 和 26 个 mutation 都恰有一层协议信封；catalog-management 消费点不再二次解包或以 cast 回避类型；package entry/current/exit 哈希能区分合法包内漂移与陈旧证据；重建后的 196 source inventory/shape matrix 仍严格 source-derived。

## 需阅读文件

- `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-recheck-round2-claude.md`：原始 M-01/N-01/N-02 finding；
- `doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-round2-followup-implementation-review-round1-codex.md`：新的独立盲审、输入 hash 与静态 verdict；
- `scripts/generate/catalog-inventory-p1.mjs`、`scripts/generate/catalog-inventory-p3-frontend.mjs`：P1/P3 envelope owner 的生成来源；
- `contracts/catalog/catalog-inventory-read-models.json`、`contracts/catalog/catalog-inventory-edge-contract.json`、`contracts/openapi/catalog-inventory.openapi.yaml`：16 GET/26 mutation 的权威模型与 wire contract；
- `scripts/test/catalog-inventory-query-envelope.test.mjs`、generated edge/RTK、`CatalogItemDrawer.tsx`、`CatalogDictionaryDrawer.tsx`、`LocalCatalogCopyDrawer.tsx`、`catalogModel.ts`：实际类型和消费者；
- `tools/compliance-control/cli.mjs`、remote package input/exit evidence：entry/current/exit hash 控制与红变异；
- source-inventory/shape generators 与两个 196 registry artifact：196 source-derived 结果。

## 独立核验重点

- 核算 GET 信封 owner：`MODEL=6`、`P1=3`、`P3=7`，合计 16；确认 shape manifest 当前 wire schema 是 P3 owner。
- 确认 P3 只为 transport-flat response 加 `CatalogQueryEnvelope`；26 mutation 中 24 model-owned direct，仅 brand-copy preflight 和 inventory target configuration 是 source-proven legacy wrapper。
- 全量搜索 consumers，确认没有 `.data.data`、GET cast 或 Local Copy 的兼容双层 decoder；重跑 query-envelope test。
- 确认 input current hashes、exit observed hashes 与当前文件一致；immutable entry snapshot 不变；sourceInventory、shapeMatrix 的两项 legal drift 精确；重跑 package-input self-test。
- 重跑 source inventory、shape 和 static-196 reconciliation，确认 196/196 而非历史字节或宽松分母。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请使用 `M` / `S` / `N`，每项写精确相对文件与行号、影响面、最小根因修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 BACKEND-PERFORMANCE 静态 NO-GO Round-2 整改。

背景：你此前对本轮静态整改给出 NO-GO（M=1/S=0/N=2）：P3 对已自带 revision/requestId/data 的 GET response 再包 CatalogQueryEnvelope，且 package input 的 entry/current/exit hash 缺少可区分语义；命令 response 也有语义双层风险。本轮已从生成器与权威 read-model/OpenAPI 修复全族，并完成新的 fresh independent static GO（M=0/S=0/N=0）。
目标：请独立核验 16 个 GET、26 个 mutation、catalog-management 消费端与 package hash 证据是否都真实关闭该同族问题，并确认重建后的 196 source inventory/shape matrix 仍 source-derived。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-recheck-round2-claude.md：原始 M-01/N-01/N-02 finding；
- doc/review/platform/2026-08-11-v2s-backend-performance-no-go-remediation-round2-followup-implementation-review-round1-codex.md：新的独立盲审、当前输入 hash 和静态 verdict；
- scripts/generate/catalog-inventory-p1.mjs、scripts/generate/catalog-inventory-p3-frontend.mjs：唯一 envelope owner 的生成逻辑；
- contracts/catalog/catalog-inventory-read-models.json、contracts/catalog/catalog-inventory-edge-contract.json、contracts/openapi/catalog-inventory.openapi.yaml：权威模型/operation/wire contract；
- scripts/test/catalog-inventory-query-envelope.test.mjs 及 generated edge/RTK、CatalogItemDrawer、CatalogDictionaryDrawer、LocalCatalogCopyDrawer、catalogModel：实际类型和消费者；
- tools/compliance-control/cli.mjs、remote package input/exit evidence、source-inventory/shape generators 与两个 196 registry artifact：current-byte hash 控制和 196 对账。

请重点独立核验：16 个 GET 是否恰有一层 envelope（MODEL=6、P1=3、P3=7）；26 个 mutation 是否只保留两条 source-proven legacy wrapper；所有 catalog-management 消费者是否清除 .data.data/cast/Local Copy 兼容双层解码；entry snapshot、current hash、exit observed state 和两项 legal drift 是否 fail-closed；并可重跑 query-envelope、package-input self-test、source inventory、shape 和 static-196 reconciliation。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小根因修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次只授权静态源码、契约、生成器、控制、测试和证据复核。即使静态 GO，也不授权 Testcontainers、DEV、L2、reset、seed、UAT、部署或手工 SQL；不得将本结论表述为动态、业务、cleanup 或性能成功。谢谢。
```
