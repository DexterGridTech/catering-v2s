# 批次二残余 finding intake 与修正记录

日期：2026-09-30。作者/处置：Codex 主 agent。授权来源：Dexter 本会话明确授权，先完成 S-1/N-1 两项最小修正并核实一致，随后连续实施批次二、适用动态验收及最终非生产 reset→DEV start→完整 `r5-full` seed；无需新 DESIGN 轮次。本文记录主 agent 对 Claude 中转复评 finding 的 intake，不构成独立 verdict，也不替代后续 CP/6b/IMPLEMENTATION review。

## S-1 · reset-only dry-run 准入

- **分类**：`CONFIRMED`。
- **重开依据**：复评文件 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-four-finding-static-recheck-codex.md` §3 S-1；当前详设 §10b.5、§10b.6、CP-06；当前计划 §3、§4、§8；`doc/platform/implementation-task-template.md:212-217`；`doc/decisions/templates/implementation-design-template.md:280-281`；需求 D-34 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:1697-1701`。
- **事实与反例**：修正前详设/计划把完整 `r5-full` seed dry-run 限定在实际要执行 seed 时。reset-only 虽然不执行 seed，仍是破坏性动作，模板明确要求完整 seed 当前字节试运行在 reset 前 PASS；因此原文允许绕过既有 reset 门。backend-acceptance 与不执行 reset/seed 的 DEV 独立运行则不应被空分母或无关 dry-run 阻塞。
- **最小修正**：详设 §10b.5、§10b.6、CP-06；计划 §3、§4、§8 统一为：任何实际 reset-only、seed-only 或 reset+seed 均须先取得当前字节完整 `r5-full` seed dry-run PASS；reset 时 dry-run 必须先于 reset。保留真实 reset/seed 的 CP 与 6b `MATCHED`、资源身份/预算、日志与 cleanup；§3a 仅在真实 L2 控件分母存在时准入；无 reset/seed 的 backend-acceptance/DEV 不要求 seed dry-run。
- **核实结果**：当前详设行 359、363、计划行 155、157、171、221 已同步表达以上条件；计划行 161 仍明确 CP-06 退出不包含动态结果、cleanup 或 13c。文案没有把“只执行 reset”误读为无须完整 seed dry-run。
- **需要 Dexter 裁决**：否；按现行模板与 D-34 落实，不引入新产品语义。

## N-1 · CP-06 与批次级交付收口归属

- **分类**：`CONFIRMED`。
- **重开依据**：同一复评文件 §3 N-1；当前详设 §2/§13b/§13c/CP-06；当前计划 §3/§4/§8 与模板覆盖表。
- **事实与反例**：修正前详设 §13c 和计划相关自查表仍把 13c 或最终 review 写成“CP-06 交付前/CP-06”。但 CP-06 退出条件本身只包含判据到场景闭包、runner/focused proof 和本 CP 三维 `MATCHED`；整批动态验收、cleanup 与交付审查是在 CP-06 退出后。保留 CP-06 的阶段对账，同时在其退出前要求整批动态或最终 review，会再次混淆阶段退出与批次收口。
- **最小修正**：详设 §13c 标明“CP-06 退出后的批次级整体验收与交付收口”，并声明不是 CP-06 退出条件；计划将 13c、自查表和整批 `REVIEW_TARGET=IMPLEMENTATION` 标为 CP-06 退出后的批次级交付收口，保持退出定义单独且不附加动态结果、cleanup、13c 或最终 review。
- **核实结果**：详设行 210 的 CP-06 退出定义明确排除动态结果、cleanup、13c、整批 review；详设行 491 与计划行 158-161、266-267 将 13c/final review 放到 CP-06 退出后的批次级收口。CP-06 仅实现验收场景/runner并做 focused proof，没有重新引入阶段依赖环。
- **需要 Dexter 裁决**：否；是阶段归属和术语一致性修正。

## 授权与证据状态

详设与计划头部、§0、计划 §0.3、§5、§8 已同步当前会话授权：修复 S-1/N-1 后进入批次二实施；批内动态验证及最终非生产 reset→DEV start→完整 seed获授权；不授权生产部署、UAT、批次三、物理设备操作或修改需求/Journey 产品语义。原 DESIGN cycle 的轮次和旧独立 verdict 保留为历史；其 verdict 不覆盖修订后的文档/源码。当前文档修正只证明静态文本对齐；实施、构建、测试、受管运行、cleanup、reset、DEV 与 seed 均尚无本记录所声称的运行结果。

**处置结论**：两项 finding 均 `CONFIRMED` 并已在详设、计划同步修正；同根检索与回读后，进入批次二 CP-01。独立 CP/6b 对账及动态阶段准入仍按本次授权与项目规范执行，不因本记录跳过。
