# TER T1 最终实施结果复核请求

## 背景

Claude 对此前 T1 当前源码整批复核给出 `NO-GO, M/S/N=0/9/4`。主 agent 按原始需求、当前详设和 owning source 逐项 intake；S-1～S-7、S-9 的确认部分已修正，S-8 与 N-1～N-4 有源码依据拒绝或关闭。后续 fresh 独立子 agent 针对 S-3 修复差量给出 `GO, M/S/N=0/0/0`。该差量 verdict 仅覆盖 remote-control 配置解释归属，不替代整批复核，也不改写此前整批 verdict。

## 评审目标

请独立核验 T1 当前生产源码、直接测试、包依赖和规范同步是否满足正式需求与批准详设；逐项重开原始 S/N，检验主 agent 的 disposition 及修复是否闭合，并判断是否存在遗漏、回归或更小修正。评审限源码与已存在测试/记录，不要求新运行完整设备矩阵；不得把测试源码当成测试通过，也不得将历史运行升级成当前字节证明。

## 需阅读文件

- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`：正式需求 R/V 判据。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md`：Dexter 原话与最终澄清。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`：批准实现边界与验收判据。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md`：CP 与实施验证路径。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md`：包 owner 与源码锚点。
- `doc/review/platform/2026-10-14-ter-t1-implementation-review-intake-codex.md`：主 agent 的 finding disposition、修复位置、聚焦验证与证据边界；仅作待核输入。
- `doc/review/platform/2026-10-14-ter-t1-implementation-review-request-codex.md`：此前实施复核范围与来源导航。
- `doc/review/platform/2026-10-14-ter-t1-final-implementation-review-request-codex.md`：本次交接范围及可复制评审请求。
- `doc/review/platform/2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md`：历史 CP-06 Web/Android 执行记录；只按其绑定字节与场景解释，不视为本轮修复后的全量运行。
- `doc/platform/terminal-coding-standard.md` 与 `project-memory/operations/terminal-coding-standard.md`：包职责、公开边界及实现约束。

## 独立核验重点

请先以正式需求、详设、计划、规范和当前源码形成自己的判断，再阅读 intake。对 S-1～S-9、N-1～N-4 逐项核验当前字节：配置拒绝分类；策略参数与协议常量的单一 owner；项目候选及 LiveKit 配置解释归属；已挂载 surface 的 Runtime retry；State 持久化队列释放；TDC HTTP 最后异步接缝后的资格复核；不确定送达的 HTTP 重试分类；Android 远控 listener 释放；资源型逻辑的 application/foundation 归属；以及四项非阻断注记。

S-3 最新差量请重点检查 `remote-control` 是否通过 server-config 的公开 selector 自行解析 LiveKit 地址和配置身份，两套 integration 是否仅绑定 `serverSpaces` 等环境输入，module/package/skeleton graph 依赖是否闭合，是否存在反向依赖或同根重复解释。核对直接测试只证明了什么。其他已修复项应检查修复后的 owning source 和实际调用者，不从 intake 的 CLOSED 结论推定正确。

当前 S-3 差量 focused proof：remote-control 36 项测试、owner lint/typecheck、两套 integration typecheck、静态 package graph 门均 PASS；fresh 独立 S-3 delta review 为 `GO, 0/0/0`。该差量未做 Expo Web、DEV、Android 或设备运行。此前 CP-06 动态记录仍是历史证据。请勿把这两类证据混写。

## 期望结论

请给出当前整批源码静态实施复核结论 `GO` 或 `NO-GO` 与 `M/S/N`。每条 finding 列当前精确文件/行号、需求及详设位置、事实/推论、触发条件、影响、最小修正和是否需 Dexter 裁决。若详设没有相应判据，单列 `DESIGN_GAPS`。明确哪些结论只覆盖源码或局部 focused proof，以及哪些历史运行仍未覆盖当前字节。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER重点代码结构T1优化》当前字节做整批 IMPLEMENTATION 独立复核。

背景：此前整批源码 review 为 NO-GO，M/S/N=0/9/4。主 agent 已按原始需求和 owning source 完成 intake 与确认项修复；fresh 独立子 agent 对最后的 S-3 配置归属差量给出 GO，M/S/N=0/0/0。该差量结论不代表整批 GO，也不改写此前整批 verdict。
目标：请独立核验当前源码、直接测试和包边界，判断原 findings 在当前字节是否真正关闭，寻找同根遗漏及回归。不要把作者 intake 或测试源码当成独立证明。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md：正式 R/V 判据；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md：原话及澄清；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md：批准设计与验收边界；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md：CP、验证和交付路径；
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md：owner 与源码定位；
- doc/review/platform/2026-10-14-ter-t1-implementation-review-intake-codex.md：待独立核验的 intake、修复与局部证明；
- doc/review/platform/2026-10-14-ter-t1-implementation-review-request-codex.md：既有复核范围；
- doc/review/platform/2026-10-14-ter-t1-final-implementation-review-request-codex.md：本次复核范围；
- doc/review/platform/2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md：历史动态记录及适用字节边界；
- doc/platform/terminal-coding-standard.md 与 project-memory/operations/terminal-coding-standard.md：包边界和规范；
- intake 所列每项当前 owning source、真实调用者与直接测试。

请先依据需求、设计、规范和当前源码形成判断，再参考 intake。逐项检查 S-1～S-9、N-1～N-4；重点核验 server-config 错误分类、参数/协议常量 owner、project-basic 候选 selector、remote-control 对 LiveKit 配置的 owner 接线、Runtime retry 的已挂载 surface、State dispose 与 persistence queue、TDC HTTP 资格末端复核、不确定送达请求重试、Android listener 释放，以及资源型逻辑的 application/foundation 归属。

对 S-3 差量，请检查 remote-control 是否通过 server-config 公开 selector 解释 LiveKit 地址和配置身份，两套 integration 是否只注入 serverSpaces 等环境值，包/运行时依赖方向是否闭合，以及是否残留重复配置逻辑。直接测试覆盖 effective override、selected space/revision 和缺地址；owner lint/typecheck、两套 integration typecheck 与静态包图门已通过。该差量没有 Expo Web/DEV/Android 运行。此前 CP-06 Web/Android 记录属于其归档字节，不要升级为当前修复后的全量 PASS。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每项问题请附当前精确路径/行号、需求与详设判据、事实或推论、触发条件、影响、最小修正及是否需 Dexter 裁决；另列 `DESIGN_GAPS` 和未验证项。区分整批源码判断、S-3 局部 focused proof 与历史动态证据。

授权边界：本请求仅为当前 T1 整批实施结果复核，不授权新增实现、动态运行、DEV、Expo Web、Android、设备、reset/seed、L2、UAT、生产部署或范围外功能。谢谢。
```
