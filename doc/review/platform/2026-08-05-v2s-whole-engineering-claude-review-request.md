# catering-v2s 全工程 Claude 独立审查请求

## 背景

本轮是当前工程的全范围只读 review，不是实现或修复交付。Codex 已独立完成一份报告，但 Claude 必须先从冻结输入、业务语料、源码和测试独立推导结论，不能阅读或沿用 Codex finding。

## 评审目标

独立审查后端、双前端、OpenAPI/生成代码、迁移、scripts、tools 和 `.agents`：固定值、单一真相、职责分离、日志可追踪性、可复用边界、性能/健壮性、遗漏 Bug、过度设计与 AI-first 控制面有效性。

## 需阅读文件

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：仓内边界与执行红线；
- `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：当前权威状态；
- `project-memory/index.md` 的全部 kernel、六维 recall 命中原文、`project-memory/decisions/confirmed-business-language-corpus.md`：业务和项目记忆；
- `scripts/README.md`、`project-memory/decisions/deterministic-context-only.md`、`contracts/policy/standards-coverage-matrix.json`：运行、上下文与标准分母；
- `apps/backend/catering-business-server`、`apps/frontend/platform-admin`、`apps/frontend/operations-admin`、`libraries/frontend/admin-ui-foundation`、`contracts`、`scripts`、`tools`、`.agents`：实际审查对象。

## 独立核验重点

核验每个实际调用是否能以脱敏关联日志追踪；固定值是否有明确业务或 run-scoped 边界；手写字符串/route/error/JSON 是否该由 owner contract、codegen 或 foundation 统一；是否绕过 owner/transaction/session scope；是否存在无效 gate、错误 self-test、资源 cleanup 假 PASS、重复 UI lifecycle 或无界读模型。对每项 finding 提供源码反例和最小修复，不以 checker 或测试存在本身作为正确性证据。

## 期望结论

以 `GO` 或 `NO-GO` 开头，按 `M` / `S` / `N` 排序；每项给出仓根相对路径和行号、业务/用户影响、根因、反例、最小修复方向与 required focused proof。未发现问题的审查面也说明核验方法；明确区分 business 与 cleanup。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 catering-v2s 全工程独立代码审查。

背景：这是全范围、只读、对抗式 review，不是实现或修复交付。请不要阅读或参考 Codex 的任何报告或 finding；先从权威输入、业务语料、源码和测试独立得出结论。
目标：独立核验后端、platform-admin、operations-admin、OpenAPI/生成代码、迁移、scripts、tools、.agents 的固定值、职责分离、单一真相、契约化、日志、性能/健壮性、重复造轮子、过度设计、遗漏 Bug，以及 AI-first 控制面是否真实有效。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md；
- doc/platform/README.md、doc/platform/roadmap-program-registry.json、doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md；
- project-memory/index.md 的全部 kernel、六维 recall 命中原文、project-memory/decisions/confirmed-business-language-corpus.md；
- scripts/README.md、project-memory/decisions/deterministic-context-only.md、contracts/policy/standards-coverage-matrix.json；
- apps/backend/catering-business-server、apps/frontend/platform-admin、apps/frontend/operations-admin、libraries/frontend/admin-ui-foundation、contracts、scripts、tools、.agents。

请重点独立核验：每个实际调用是否有脱敏、关联、可读取日志；固定值是否有明确业务/run-scoped 边界；手写 route/error/JSON 是否应收敛到 owner contract、codegen 或 foundation；是否有 session scope、owner、cleanup/process-tree、gate/self-test、无界读取或 UI lifecycle 漏洞。

烦请给出明确 GO 或 NO-GO；如有问题，请按 M / S / N 标注精确相对路径与行号、业务或用户影响、反例、根因、最小修复建议、focused proof，以及是否需要 Dexter 产品裁决。请区分 business 与 cleanup，并说明未发现问题的审查面与核验方法。

授权边界：仅独立评审与报告，不修改源码、契约、脚本、Roadmap、证据或运行环境；不执行 reset、seed、start、远端操作或浏览器 L2；不做仓库控制动作。谢谢。
```
