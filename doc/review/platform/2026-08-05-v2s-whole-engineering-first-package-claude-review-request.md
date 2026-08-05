# Claude 复核请求：第一包静态 implementation 收口

Dexter，请 Claude 对第一包做独立终审。Codex 已完成实现、自检，并由 fresh independent subagent 完成 final-binding implementation review：GO — M=0 / S=0 / N=0。

## 背景与范围

- 仓根：`catering-v2s`
- 第一包：`RP-09`、`RP-12-pre`、`RP-12a..n` 五集合语义收口、`RP-13`–`RP-20`、S2 `S-01`。
- 归类前置已独立 GO；最终 RP12 状态由 qualified owner-constant occurrence、raw escape 与完整 source hash 绑定。
- 关键实现证据：
  - `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-final-binding.json`
  - `doc/review/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-final-binding-review-round1.md`
  - `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json`
  - `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-exit.json`

## 请独立核验

1. RP12 五个 owner 集合是否按 D3 保持唯一真相：`ServiceNodeTypes` 仅由 OpenAPI/codegen 规范，`OrganizationNodeTypes`、`BusinessEntityTypes`、`ExtensionHostTypes`、`AuditEntityTypes` 保持 owner-local。
2. `scripts/check/rp12-final-state` 是否真实覆盖最终源码，且 self-test 有真实 red mutation；核对 occurrence digest `f3de780491f944755d26cfe40dc095840063c6a0376ab82be2e1fa0f7cb05d3a` 与 source-manifest digest `878d093aa82a7e7b0547ee7a973ca55ce2dc1d2c7671aeb5ad558ad91387c8b1`。
3. `ExtensionHostTypes` 的 `requireDefinition` / `managementDefinition` / `replaceDraft` / `replace` 调用是否没有裸 host literal。
4. D6 删除的 `ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_REQUIRED` 是否同时从 OpenAPI、generated wire、frontend feedback、owner emission/consumer 与 capability fixture 消失，且 `..._IN_USE` 保留。
5. `capability-invariants` 的 typed-owner exact inventory 是否为 `MAPPED=94`，fingerprint 为 `5aa8e91794bbc8aba87582c7bdd0561951db31e236fe62dcaaba946a2f27fc96`。
6. S2 `S-01` 是否只补 public security diagnostics 的 DB count/duration 指标，不改变既有 security observer 选择；RP-09、RP-13–RP-20 focused proof 是否与 evidence 一致。

## 机器门

```text
node scripts/check/rp12-final-state --self-test       PASS
node scripts/check/rp12-final-state                   PASS
node tools/capability-invariants/cli.mjs check        PASS
node tools/capability-invariants/cli.mjs --self-test  PASS
node scripts/generate/edge-codegen.mjs --check        PASS
scripts/check/openapi-contracts                        PASS
scripts/check/standards-coverage --phase R5            PASS
scripts/check/standards-coverage --phase RM1-P6-3      PASS (alias R5)
```

## 交付格式

请给出 `GO` 或 `NO-GO`，并按 `M/S/N` 排序列出所有 finding；每条必须有 path、行号/符号、可复现实验证据、根因、最小修复建议与是否属于本包分母。若 GO，请明确“仅静态 implementation package GO”。

**授权边界：仅静态 implementation；不授权 DEV/UAT、HTTP/L2、数据库/migration、seed/reset、runtime deployment 或 Git。** 本包 `businessStatus` 与 `cleanupStatus` 均为 `NOT_APPLICABLE_WITH_REASON`，不得将其解释为业务或环境闭环 PASS。
