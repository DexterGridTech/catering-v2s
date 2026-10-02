# 第 1 轮设计 finding intake 与主 agent 处置

```text
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
intakeOwner=MAIN_AGENT
```

## S-1 · 统一两个 UI 包的正式住址和类型

- Reviewer 分类：`CONFIRMED`；主 agent 分类：`CONFIRMED`。
- 判据和反例：正式需求 R-03 明文指定两个 `apps/terminal/ui/base/*` 路径。初版详设/计划/线框把相同对象放到 `ui/feature`，并依赖 feature assembly 形态。`ui/base/feature-assembly/README.md` 明确 `createFeatureAssemblyModule` 只接收 `ui.feature.*` module；直接把 feature assembly 搬到 base 并不可行。反例是现有 `ui/base/admin-shell` 用 moduleName、dependencies、public exports、parts 和 `AdminSectionComponent` 承载可复用 base UI，并且依赖现有 kernel owner，因此修正路径不要求新建通用装配框架。`terminal-data-client` 与 `server-config` 均为 kernel/base owner；TR-12 的 `kernel/feature` 与 `ui/feature` 一对多约束不推翻本需求明确指定的 base UI package。
- 最小修正：不动正式需求；统一五份作者设计工件。两个 base 包只消费已有 owner command/selector。`terminal-activation` 暴露四面 parts、admin status section 与纯 UI 意图 `needToActivateTerminalCommand`，阶段路由仍由 integration 组合；`server-config-panel` 通过 `AdminSectionComponent` 接入 admin shell。sample-staff-auth/member-desk/wallpaper-picker 继续是 `ui/feature`。
- 同根范围：ACT-01..04、ADMIN-01..03 七个 screen 行；详设 CP-02/CP-03、owner API 消费映射、包来源清单；计划 CP-02/CP-03；Journey package-shape 决策；IA package ownership；交互工件 metadata 与 screen roster。其余 19 个 screen 是 sample/auth/admin-shell/mask，不含该包路径。已逐项扫描。
- 文件已修正：Journey、IA、交互线框、详设与实施计划。正式需求正本及源码未改。
- 静态验收判据：五份设计工件都将两个包定位于 `apps/terminal/ui/base/*`；检索不得再命中 `apps/terminal/ui/feature/terminal-activation` 或 `apps/terminal/ui/feature/server-config-panel`；计划不得再要求对这两个 base 包使用 `createFeatureAssemblyModule`；sample UI feature 路径保持不变。
- 本地复核：见当前 round-2 reviewer checklist 与 `rg` 同根扫描结果。没有运行代码验证。
- Dexter 裁决：不需要。

## 未验证与后续动作

首轮 verdict 为 `NO-GO / M/S/N=0/1/0`。修正后需要本 cycle 第 2 轮 fresh 独立 DESIGN 复核；不超过两轮。`V-01..V-20`、Expo Web、VM/application/device、adapter 行为及 cleanup 仍为 `NOT_RUN`，不得升级为 PASS。无实施、生成、构建、测试或运行授权。
