# TER 第三方库整改 v3.4 详设与实施计划复评请求

## 背景

Claude 对 TER 第三方库整改 v3.3 详设与实施计划评审为 `NO-GO`，`M/S/N=5/12/14`，评审文件为 `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-claude.md`。Dexter 在需求 v3.4 §1.1 作出四项裁定：统一错误恢复到 `appControl.resetRuntime`；仅两台 laptop 拓扑 VM 可清 App 数据；RNTL 改 v14；采用“抓大放小”。现已按 v3.4 修订两份设计工件。本 DESIGN cycle 的两轮独立盲审已用完，本次按 Dexter 指示直接交 Claude 复评，不派第三轮子 agent。

详设阶段 RNTL v14 POC 结果为 `4/4 PASS`，耗时 1.49s，使用 TER RN stub + Vitest；POC 临时测试文件、node_modules 与独立缓存已移除。但已跟踪 `.yarn/install-state.gz` 仍为 modified，归属/来源未确认，未覆盖或回滚用户文件，cleanup 如实为 `OPEN`。

## 评审目标

请独立确认 v3.4 是否已变成可实施、可证伪且范围受控的详设与计划，重点核对 Claude 上轮 M-1 至 M-5、S-1、S-5、S-6；并核对 12 项 S、14 项 N 及小项是否与需求附表一致。尤其确认：颜色键来源与三映射 owner/四份输出分母；fflate 单次 push 上界与内存推导；双屏真机 W 场景矩阵及 runner/debug 变体；TP-A11 改前 APK 与设备冻结；TP-A9 锁外 I/O 与原因码映射；设备 serial 是否每次动态发现且不存在固定编号；N-13 的保留未文档引用与 README 登记；POC cleanup OPEN 是否如实。

## 需阅读文件

- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入 v3.4。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：本轮修订详设，含基线、POC、控件分母、逐 TP 机制与 N disposition。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：本轮修订实施计划，含 CP 门、动态场景、serial 发现与对账交付门。
- `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-claude.md`：上一轮 NO-GO findings 与边缘项处置分母。
- `doc/platform/implementation-task-template.md` 与 `doc/decisions/templates/implementation-design-template.md`：详设派活正本和模板。

## 独立核验重点

1. M-1 至 M-5：TP-A6 的公共下层正本及一键变异；TP-A8 每次 ≤1,024 compressed bytes、峰值工作集边界与 full-input 变异；W1–W11 的设备/入口/构建/注入矩阵及 CP-C 排期；TP-A11 的改前 APK、旧 marker 与新 namespace 不存在断言；TP-A9 锁外 send/close/publish 与逐路径本端意图优先原因码表及 T4 对照。
2. S-1 至 S-12：timeout 区间与 Pong 模型；独立 JVM 同步钩子；AVD 名输入、实时 serial 映射、形态阈值、角色分派与 run ownership；lint 生产源分母；RNTL v14 POC、迁移 API、cleanup/act；ErrorBoundary 的 resetRuntime 路径、Web port 不可用、首屏 `contentFailure` 与 outer boundary；完整控件分母和双向 zlib 场景。
3. 体检报告全部 N-1 至 N-37 的处置是否遵循需求附表；尤其 N-3 存量登记、新代码 React 19 写法，N-13 保留一处并 README 登记，N-19 先取 U-8，N-26 登记、N-35 权限不删、N-36/N-37 不新增依赖或改私有 API。
4. 是否落实“抓大放小”：无全仓 ignored census、无逐分母 source hash、设备身份细则不重复展开、T2 不加生产逐帧计数；动态证据统一在最终阶段，非拓扑 TR-16 Web 先于设备，拓扑先 JVM 后两台 laptop VM。
5. POC 4/4 仅证明 v14 API 组合可行，不代表正式安装或迁移；`.yarn/install-state.gz` 状态必须维持 OPEN，不能误写为 POC cleanup 完全 PASS。

## 期望结论

请给出本次字节专属的 `GO` 或 `NO-GO`，并列 `M/S/N=x/y/z`。每条 finding 请给出精确文档位置、需求/源码依据、影响、最小修正与是否需要 Dexter 裁决。设计文档复评不构成实施授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请复评 TER 第三方库整改 v3.4 的详设与实施计划。

背景：上一轮 REVIEW_TARGET=DESIGN 结论为 NO-GO，M/S/N=5/12/14，详见 doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-claude.md。Dexter 已把需求修订为 v3.4 并作出四项裁定。本轮按 v3.4 修订了详设与计划；本 DESIGN cycle 两轮盲审已用完，因此直接由您复评。

目标：请独立判断当前 v3.4 配套详设与实施计划是否可实施、可证伪且与需求一致，不沿用上一轮 verdict。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md：唯一需求输入 v3.4；
- doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md：修订后的详设；
- doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md：修订后的实施计划；
- doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-claude.md：上一轮 findings 与边缘项清单；
- doc/platform/implementation-task-template.md 与 doc/decisions/templates/implementation-design-template.md：适用模板和实施派活正本。

请重点核验 M-1 至 M-5、S-1、S-5、S-6，以及其余 S/N 和小项是否逐项闭合。特别检查：颜色正本/三映射 owner/四份输出；fflate 的 1KiB push 上限和峰值内存推导；W1–W11 设备与构建矩阵、物理双屏 runner/debug 能力及证据阶段；TP-A11 改前 APK 与旧 namespace 前置；TP-A9 锁外 I/O 和原因码对照；设备 serial 是否真正运行时发现、没有写死 emulator 编号；TP-C2/N-13 保留一处未文档引用并登记 README；RNTL v14 POC 结果与 install-state cleanup OPEN 的口径。

烦请给出明确 GO 或 NO-GO，并列 M/S/N=x/y/z。每条 finding 请写明精确文档位置、需求或源码依据、影响、最小修订建议及是否需要 Dexter 裁决。

授权边界：本轮只请求复评修订后的需求配套详设与实施计划。POC 已在详设阶段完成，4/4 focused PASS；`.yarn/install-state.gz` modified 状态的归属未确认，仍为 OPEN。当前不授权源码实施、正式依赖安装、构建、Web/Metro/Android/设备运行或清除数据；是否进入实施由 Dexter 在复评后另行决定。谢谢。
```
