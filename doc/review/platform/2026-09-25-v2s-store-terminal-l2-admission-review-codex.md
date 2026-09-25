---
title: 门店终端 Browser L2 脚本准入静态复核记录
status: L2_SCRIPT_ADMISSION_PASS
reviewTarget: L2_SCRIPT_ADMISSION
reviewerKind: INDEPENDENT_SUBAGENT
reviewer: Erdos
reviewerAgentId: 01a0d8a0-2697-7ab0-a2b8-9adf71656460
date: 2026-09-25
---

# 结论

本记录已由 fresh 独立 reviewer Erdos 在当前控制面字节上核验通过；失败族重试阻断、P1 运行期输出边界、HMR-free preview 与 refresh 状态复核均已纳入准入范围。动态 L2 尚未运行，现可执行受管 Browser L2。

REVIEW_TARGET=L2_SCRIPT_ADMISSION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
L2_ADMISSION_REVIEW_STATUS=PASS
ADMISSION_SOURCE_DIGEST=fad7128aca97e3935ec4368823dcbb7654381c54cc9c01a959064e0497c5a86f

# 静态核对范围

准入分母固定为六个 case：`terminal-list-detail`、`terminal-create-basic`、`terminal-create-configuration`、`terminal-edit-configuration`、`terminal-readonly-state`、`terminal-status-actions`。逐案核对 `store-terminal.spec.ts`、`operationsL2.ts`、`operationsL2.test.ts`、locator bindings、case blueprint、scenarios、execution profile 与 implementation design §3a 的对应关系。

| case | 静态结论 | 重点闭合项 |
| --- | --- | --- |
| `terminal-list-detail` | PASS | 列表选中、详情、打印机/功能/场景展示与读模型请求关联 |
| `terminal-create-basic` | PASS | 新建入口、基本信息、设备类型与普通 Tab |
| `terminal-create-configuration` | PASS | 打印机先行、功能范围、场景订单类型及场景打印机选择、保存回读 |
| `terminal-edit-configuration` | PASS | 编辑抽屉、已有子项身份、场景配置变更、版本与回读边界 |
| `terminal-readonly-state` | PASS | 无写权限下不显示写入口且保留可读详情 |
| `terminal-status-actions` | PASS | 启用/停用/作废确认、状态读回及失败恢复 |

已核对失败恢复、选择器关闭、详情头部状态动作、表单顺序、功能内逐场景打印机配置、共享 L2 helper 及 typed locator 约束；真实位置、焦点、叠层与业务行为仍留给后续 Browser L2。

## 当前字节控制面

store-terminal policy 当前包含 31 个不可变 control-plane 文件与 `apps/frontend/operations-admin/src/features/store-terminal` 当前 19 个 UI 文件，合计 50 个条目；共享 `operationsL2.test.ts`、页面静态证明与本轮新增的 L2 负向断言均已纳入控制面字节集。P1 按 run 生成的 `store-terminal-l2-execution.json` 不进入不可变准入摘要，由 P1 与 finalize 单独校验 run binding；详设的 `UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`、`L2_SCRIPT_ADMISSION=PASS` 是设计必需标记，不等于任何 Browser L2 业务场景已经 PASS。

当前摘要由 `scripts/test/store-terminal-l2-admission.mjs` 通过共享 `createL2SuiteAdmissionStrategy` 重新计算：`ADMISSION_SOURCE_DIGEST=fad7128aca97e3935ec4368823dcbb7654381c54cc9c01a959064e0497c5a86f`，`controlPlane=31`，`uiFiles=19`，`total=50`，`bytes=1,403,776`。Erdos（`01a0d8a0-2697-7ab0-a2b8-9adf71656460`）已在该摘要上 fresh 复核通过。若任一控制面或 UI 文件后续变化，摘要立即失效并必须重新复核。

## 处置记录

- `CONFIRMED`：上一版记录的摘要与当前 CP-07 控制面不一致，且详设 marker 曾保持 BLOCKED；运行器在本轮同步前应拒绝启动。
- `CONFIRMED`：focused L2 发现 `actualActionNode=TAB` 未被脚本按声明解析，已修复为点击可见 `role=tab` 祖先，并补了静态回归断言；旧摘要 `82a79da...` 已作废。
- `CONFIRMED`：候选读取重试会触发父页重渲染；修复为稳定 `openEditorConfiguration` 回调，并让 Drawer 初始化 effect 只依赖 editor 身份/模式，避免重置用户当前 Tab 与待提交草稿。
- `CONFIRMED`：Pasteur 独立复核当前源码时发现本记录仍绑定旧摘要；本次已同步至 `99ea74a5b23bd438e6e2bcbcdd0a5f7a9b1ec79373f7d2a97ae48f0f72edd913`、31 个 control-plane、18 个 UI 文件、49 个总文件、1,384,007 bytes；Lorentz fresh 复核后准入记录闭合为 PASS。
- `CONFIRMED`：focused L2 随后证明在功能与范围 Tab 直接操作打印机删除按钮会命中 hidden DOM；根因是 L2 流程未跟随两 Tab 交互，已在删除前显式点击 `TERMINAL_FORM_TAB_BASIC`，更新摘要为历史值 `5fc0379b...`；该旧摘要随本轮测试断言调整失效。
- `CONFIRMED`：focused L2 随后证明新增打印机的可见性断言仍放在功能与范围 Tab，命中基本信息页的 hidden DOM；根因是断言与当前两 Tab 交互不一致，已将断言移到切换 Tab 之前；Halley fresh 复核当前摘要 `62be3c1d530582383f9c7d08116e29cf7f4ee7a12ff98edb4231f9ea843aed36` 通过。
- `CONFIRMED`：提交前只挂载当前功能编辑器会使 Ant Design 的 `onFinish` payload 出现空占位行；生产 handler 已改为读取 preserved Form store，并由真实 AntD Form 行为测试、L2 创建请求体与创建后详情读回共同证明多功能聚合未丢失。Bohr fresh 复核当前摘要 `68c20de48e0936052c1cce1913433eceb5d6bc46a62cbf881f8326fa925d1b8a` 通过。

# 证据边界

本记录未运行 Browser L2、DEV、reset、seed、UAT 或部署；未将 focused、render、静态测试、类型检查或 P1 生成检查升级为业务运行 PASS。后续必须重新执行 readiness、P1、source-byte finalize 与六 case run，任何业务失败按真实首失败继续根因修复。
