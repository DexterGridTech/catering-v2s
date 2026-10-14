# TER T1 · 实施结果交审请求（Codex → Dexter → Claude）

## 背景

《TER重点代码结构T1优化》已按授权完成 CP-01～CP-06。历史 fresh review 的 `NO-GO 0/2/0` 两项 finding 已由主 agent intake、最小修复，并针对最终字节完成 13c 差量对账 `MATCHED` 与 fresh 独立整批 `REVIEW_TARGET=IMPLEMENTATION` `GO 0/0/0`。当前请求是 Dexter 转交 Claude 的外部实施结果复核；不覆盖或改写历史 verdict。

## 评审目标

请 Claude 从当前生产源码及获批 T1 需求/详设/计划独立判断：包内声明和具名行为是否自闭环；application、integration、feature、base 与 adapter 的责任及公开面是否正确；同步状态、终端业务 API、可变服务地址、原生身份与 automation driver 是否保持单一事实来源；旧入口/重复名单是否按计划退役；当前证据是否足以支撑已声明的各项结果。只把符合需求和详设的行为判为通过，不把文档或旧 verdict 当作实现证明。

## 需阅读文件

- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`：正式需求与 R/V 判据。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`：获批职责、包结构、公开面与实现判据。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md`：CP、验证范围与完成条件。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md`：owner 与 owning-source 导航。
- `doc/review/platform/2026-10-14-ter-t1-implementation-6b-r3-reconciliation-codex.md`：全批 6b 范围与结论。
- `doc/review/platform/2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md`：CP-06 场景、运行身份、business/diagnostics/cleanup 证据。
- `doc/review/platform/2026-10-14-ter-t1-13c-source-reconciliation-codex.md`：当前逐代码与详设对账，状态 `MATCHED`。
- `doc/review/platform/2026-10-14-ter-t1-final-implementation-review-intake-codex.md`：前轮 findings 的主 agent intake 与最小修复。
- `doc/review/platform/2026-10-14-ter-t1-final-independent-review-codex.md`：最终 fresh 独立 13c 和整批 implementation verdict。
- 实际源码：`apps/terminal/**`、`tools/terminal-skeleton/**`、`tools/terminal-automation/**`、`.agents/skills/cs-terminal-automation/SKILL.md`、`.agents/skills/cs-code-structure-recall/SKILL.md`；请按需求和详设自行定位 owning source、消费者及测试。

## 独立核验重点

1. 按正式需求和详设重新检查 CP-01～CP-06 的当前实现，不继承作者 intake 或此前 reviewer verdict。
2. 重点复核最后差量：两个 Android application 的 automation-only `surfaceForm` 注入、source-only TypeScript/server-config 接线，以及 wallpaper application 根导出、`terminal-invariants.json.publicExports`、README 与实际包内调用者的一致性。
3. 核对 console 与 wallpaper Expo Web owner-flow、Android owner-flow 和双机 `update.pair` 运行分别覆盖了什么；逐一核对 business、diagnostics、runner/device cleanup，不扩大为未运行拓扑的证据。
4. 检查唯一 automation driver、机械门、README/规范同步、旧 runner/入口/转发壳/独占 helper 的退役与保留边界。
5. 不要求重跑未受最后公开面收窄影响的运行。没有执行的全仓 verify、L2、reset/seed、UAT 和生产部署继续标为未运行/范围外。

## 期望结论

请给出 `REVIEW_TARGET=IMPLEMENTATION`、明确 `GO` / `GO_WITH_UNVERIFIED_UI` / `NO-GO` 与 `M/S/N=x/y/z`，并列出 `DESIGN_GAPS`。每项 finding 请给精确仓根相对路径和行号、需求/详设判据、当前源码事实或推论、影响、最小修正及是否需要 Dexter 产品裁决。请区分静态判断、实际运行证据、未运行项；不得用源码存在或作者记录推断测试通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER重点代码结构T1优化》当前实施结果做整批独立 REVIEW_TARGET=IMPLEMENTATION 复核。

背景：本批按 Dexter 授权完成 CP-01～CP-06。此前 fresh review 为 NO-GO、M/S/N=0/2/0；主 agent 对两项 finding 独立 intake 并作最小修复。修复后的 13c 逐代码与详设对账由 fresh 独立 reviewer 判为 MATCHED；修复后 fresh 独立整批 implementation review 为 GO、M/S/N=0/0/0。历史 verdict 均保留，本次请只依据当前字节独立判断。

目标：判断当前实现是否覆盖正式需求与详设，职责、包内声明与具名行为、公开 API、主副机同步、可变服务地址、原生身份、生成/机械门、文档及唯一 automation driver 是否简单且一致；并核对动态证据实际覆盖范围。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md：正式需求及 R/V 判据；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md：获批详设；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md：CP 与验收计划；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md：owner/source 导航；
- doc/review/platform/2026-10-14-ter-t1-implementation-6b-r3-reconciliation-codex.md：整批 6b；
- doc/review/platform/2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md：CP-06 场景与运行证据；
- doc/review/platform/2026-10-14-ter-t1-13c-source-reconciliation-codex.md：最终 13c；
- doc/review/platform/2026-10-14-ter-t1-final-implementation-review-intake-codex.md：两项前轮 finding 的主 agent intake；
- doc/review/platform/2026-10-14-ter-t1-final-independent-review-codex.md：修复后 fresh 独立 13c 与 implementation verdict；
- apps/terminal/**、tools/terminal-skeleton/**、tools/terminal-automation/** 及两份 `.agents/skills/` 中与 T1 有关的实际 owning source、消费者和测试。

请重点核验：最后差量的两个 Android application pair surface 接线；wallpaper application 根导出与 invariants/README 是否一致、内部 assembly 是否没有多余包外调用；CP-06 Expo Web、Android owner-flow 与双机 pair 的场景覆盖及 business/diagnostics/cleanup；机械门、规范/README 和旧 runner 退役范围。请自行重开需求与源码，作者的 intake 和 reviewer verdict 都只是导航材料。

当前运行证据：最新运行与最后一次动态通过均为 wallpaper Android `update.pair`，run `052c705d-a073-47b1-8cb2-717ddb48d1d1`，2026-10-14 00:47:46–00:53:05 UTC，business、diagnostics、cleanup 均 PASS。前一个 console Android `update.pair` run 为 `d6d95c6b-c637-41b3-95bd-2c2e6d9a2124`，2026-10-14 00:42:16–00:47:36 UTC，三项均 PASS。console/wallpaper Expo Web owner-flow 与 Android owner-flow 及 CP-06 完整逐项记录见上列 CP-06 evidence；请以其中原始 manifest 与事件记录限定证据范围。公开 API 收窄后运行调用未变，当前结构门与 wallpaper application typecheck 均 PASS，见 13c 与 intake。

请输出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO|GO_WITH_UNVERIFIED_UI|NO-GO`、`M/S/N=x/y/z`、`DESIGN_GAPS`。每项 finding 请写精确路径/行号、详设判据、事实或推论、影响、最小修正和是否需要 Dexter 裁决。不要要求重跑最后公开面收窄未影响的动态场景，也不要把未执行项目写成 PASS。

授权边界：本请求仅交付当前 T1 实施结果供静态审查，不授权 Claude 修改文件或运行生成、构建、测试、verify、DEV、Web/Android、reset/seed、L2、UAT 或生产部署。完整全仓 verify、L2、reset/seed、UAT 与生产部署本轮未运行；未运行项继续如实保留，不作为已验证通过。
```
