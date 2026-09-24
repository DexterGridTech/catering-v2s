# 门店终端管理 DESIGN review 处置记录（Codex）

```text
SOURCE_REVIEW=doc/review/platform/2026-09-24-v2s-store-terminal-management-design-review-claude.md
SOURCE_VERDICT=NO-GO
SOURCE_M/S/N=1/5/8
RECORD_SCOPE=以上 source 与 finding table 是第 1 轮历史记录，不代表当前状态
LATEST_SOURCE_REVIEW=doc/review/platform/2026-09-24-v2s-store-terminal-management-design-review-r2-claude.md
LATEST_VERDICT=NO-GO
LATEST_M/S/N=0/3/5
CURRENT_DISPOSITION=R2 findings 已逐项核实并修订设计工件；不构成新的独立 DESIGN verdict
CURRENT_AUTHORIZATION=Dexter 2026-09-24 已授权修订完成后立即进入 CP-01..CP-06 实施与动态验证，最终 reset、DEV、seed；UAT、部署、真实设备不在范围
CURRENT_DYNAMIC=NOT_RUN
R1_AUTHORIZATION_AT_TIME=当时仅修订 IA、交互、详设、实施计划及本处置表；未改契约或代码，未运行动态验证
```

以下 `CONFIRMED` 表示 Claude 对原版文档的 finding 经对照确认成立，且修订已落到所列当前行；不表示修订后工件已获独立 GO。四份被修订工件仍须交 Claude 与 Dexter 复审。

| Finding | 处置 | 理由与当前修订落点 |
|---|---|---|
| M-1 型号候选无法录入多数实际打印机 | CONFIRMED | 按 D-35 将型号集合明确为 3 个有依据的具体型号＋7 个按纸规格通用型号＋2 个设备内置热敏型号；通用型号只声明纸规格、不声称厂商兼容。新建/编辑的型号选择不再存在未登记型号即无法创建的死路；八个 seed 样本也改用已定义型号；V-29 固定手写 12×7 全表及品牌不匹配、未登记型号负例。详设 `implementation-design-codex.md` 第 96–111、309–324 行；交互 `ui-interaction-design-codex.md` 第 219–229、371、376 行；计划 `implementation-plan-codex.md` 第 13、99、105–116 行。 |
| S-1 新增子项没有请求内身份 | CONFIRMED | 既有子项带 `ref`、新增 printer/function 带请求内唯一 `clientKey`；场景 printer 元素在 `printerRef` 与 `printerClientKey` 中恰选一个；owner 分配 ref，replace 按 ref 保留既有身份，clientKey 纳入幂等摘要。V-12/V-22 覆盖新增 printer 当场被场景引用与同键重放不产生新 ref。详设第 119–120 行；交互第 373–377 行；计划第 82、92 行。 |
| S-2 错误码未冻结且不符合命名约定 | CONFIRMED | 通用码复用三个 `PLATFORM_COMMON_*`；领域码统一 `STORE_TERMINAL_` 前缀；版本冲突固定为 `STORE_TERMINAL_VERSION_CONFLICT`，明确不使用旧 `VERSION_CONFLICT` 或 `PLATFORM_COMMON_VERSION_CONFLICT`。逐 operation 的 `x-error-codes` 与 UI 恢复面已冻结，并同步 IA 的 9 个 exact code 及静态交叉检查。详设第 135–159 行；IA 第 129–145、162–163 行。 |
| S-3 型号与纸规格约束缺 HTTP 判据 | CONFIRMED | 新增 V-29，使用手写期望矩阵验证 12 个型号×7 种纸规格，另测品牌/型号不匹配与未登记型号拒绝；接受格逐项读回，拒绝格校验版本和配置未变；通用型号覆盖每种纸规格。详设第 298、309–324 行；计划第 13、49、99 行。 |
| S-4 seed 分母与执行阶段不闭合 | CONFIRMED | 明确正本新增八个样本；`COUNT_KEYS` 和 `expectedCounts` 增 `storeTerminals:8`；四组件顺序不变，post-step 位于第四组件校验后、父 `business=PASS` 前；seed 型号、连接参数、固定码和只读角色均逐项冻结。明确 reset 是受管目标整库 `DROP DATABASE`，不再引用不存在的 schema allowlist。详设第 265–292 行；计划第 103–120 行。 |
| S-5 未比较 JSONB 聚合形态 | CONFIRMED | 增加六张规范化业务表＋回执表与终端行＋JSONB 配置＋回执两方案比较，说明本期无子项级消费者，采用 JSONB 聚合且不削弱 owner 完整校验。详设第 16–23、117 行。 |
| N-1 需求覆盖表漏品牌型号/标识规则 | CONFIRMED | 原需求作者已把增量同步进需求正本 D-28 至 D-35、§4.9、V-29；详设 §0、计划 §0、IA 与交互均改为直接引用唯一正本，不再维护独立覆盖桥。详设第 9 行；计划第 5 行；IA 第 156 行；交互第 427 行。 |
| N-2 IA 记录自相矛盾且错误码数量过期 | CONFIRMED | IA 第 151 行现在只陈述 IA-ID 数量，不再与交叉检查状态冲突；错误码数更新为 9 个 exact common/domain code，交叉检查记录为静态复核而非未开始。IA 第 149–164 行；错误语义与恢复见第 129–145 行。 |
| N-3 V-26/V-27 是否登记 acceptance catalog 不一致 | CONFIRMED | 明确 V-26 单源审阅与 V-27 前端中文呈现不登记 `BackendAcceptanceScenarioCatalog`，分别由 source review 与前端 focused/render 承载。详设第 298、307 行；计划第 17、101 行。 |
| N-4 主从布局理由不实、窄屏行为未解释 | CONFIRMED | 保留本页局部两栏而不抽 foundation primitive 的结论，但改为基于共享布局契约/行为不足以证明可复用，而非“没有第二消费者”；明确参照页目前没有窄屏堆叠，本页在内容区宽度 ≤992px 时上下排列，理由是打印机与场景信息密度更高。IA 第 29 行；交互第 61 行；详设第 163 行。 |
| N-5 激活码缺少统一脱敏机制 | CONFIRMED | 以 `toString()` 固定脱敏的 `ActivationCode` 值类型承载 owner 内部值；只有详情 mapper 显式取原值；safeLogger 敏感键黑名单增加大小写不敏感的 `activationcode` 并覆盖顶层/嵌套诊断测试。详设第 133 行；计划第 15 行。 |
| N-6 编辑改名缺并发名称锁 | CONFIRMED | create 与 replace 改名都纳入名称锁；replace 按排序后的旧名和目标名锁定，防止与创建及 A↔B 并发改名交错；唯一索引冲突统一为类型化名称冲突且不在失败事务内重试。详设第 121 行。 |
| N-7 seed 写前同码检测没有读取接口 | CONFIRMED（R1 历史处置，已被 R2 N-2 撤回） | 当时曾建议冲突后读取本店 seed 详情比对；该方案后来确认与完整 seed 的 reset-before-rerun、run-scoped 幂等键机制不符。当前执行语义以 R2 N-2 为准：任一新建冲突立即失败，报告要求先 reset 后重跑，不读冲突对象协调。 |
| N-8 作废终端详情读取语义不一致 | CONFIRMED | 已知 ref 的作废终端详情 GET 仍 200、只读展示完整配置与激活码；普通列表过滤，无编辑/状态入口；作废不再被归为对象不存在。IA 第 135 行；详设第 305 行；计划第 86 行。 |

## 第 1 轮补充静态一致性处置（非原 review finding；历史记录）

在交付前对错误码和 UI 恢复面交叉读取时，发现 `postOperationsStoreTerminalStatus` 曾列 `STORE_TERMINAL_RULE_INVALID`，但状态确认界面没有配置字段可供定位或修复。此差异已确认：状态变更不修改 JSONB 配置，且需求允许已存引用随来源对象后续停用/作废而保留；因此状态命令只验证合法状态转换、scope 与 version，不应重新判定未变更配置及跨 owner 引用。已从该 operation 的 `x-error-codes` 移除该领域码，并把三写事务分支与 V-21 判据明确为上述边界。详设第 127、141、306 行；计划第 91 行。此补充项不改变 Claude 原结论的 M/S/N 计数，供下一轮一并核验。

## 第 1 轮验证边界（历史记录）

在第 1 轮处置时只完成文档静态对账；动态测试、契约生成、构建、迁移、reset、DEV、seed、Browser L2、UAT 与部署均未运行。此处“当时未获授权”仅是历史状态，已被本记录头部所列 Dexter 2026-09-24 新授权覆盖。本处置表不替代独立实现审查。

## 第 2 轮 DESIGN finding 处置（当前设计修订）

以下每项状态表示对 Claude finding 的独立核实与设计侧处置，不代表代码、契约生成、测试或运行已经完成。R2 处置后立即按 Dexter 授权进入实施；源码与动态结果须以后续 CP evidence 为准。

| Finding | 处置 | 理由与当前设计落点 |
|---|---|---|
| S-1 错误码登记与生成链不符 | CONFIRMED | 7 个 operation 逐项写明 `errorSetRef` 与 augmentation，生成集合定义为 base∪augmentation；paths 不直接登记，三份目录进入 §9a 分母，7 个本域新增领域码进入 `v2sNativeCodes`。版本冲突选 `OWNER_COMMAND` 基础集合已有的 `PLATFORM_COMMON_VERSION_CONFLICT`，不再增补 `STORE_TERMINAL_VERSION_CONFLICT`，避免违反“二选一”及生成结果同时出现两码。另为状态非法和作废不可编辑分别保留专用码；V-21 对 typed problem 与无写入作断言。IA 将服务端 500 结果未知与浏览器无响应分开。详设第 133–166、253 行；IA 第 129–150、167 行；计划第 91、99 行。 |
| S-2 型号与连接方式约束未进 contract | CONFIRMED | 每个型号的 `allowedConnectionMethodKeys` 与纸规格同在单一规则 contract，由生成器产出 Java/TS；型号候选随连接方式联动、owner 保存时复核。V-29 每型号行固定连接方式，并拒绝 `BUILTIN_THERMAL_58+NETWORK`、`GENERIC_THERMAL_58+BUILT_IN` 且证明无写入。详设第 94、113–115、316–332 行；交互第 219、371 行；计划第 13、63、99 行。 |
| S-3 seed 操作人与写权限未闭合 | CONFIRMED | `role-group` 与 `role-project` 获得页面与写 capability，`role-store` 只读；post-step 使用已完成邀请建立的 GROUP session 并切换目标门店，readback 验证角色权限。详设第 291–299 行；计划第 118–120 行。脚本与 fixture 的实际同步仍属实施工作，未宣称已完成。 |
| N-1 seed 没有单场景多打印机 | CONFIRMED | `term-kitchen-multi` 的“制作单”同场景绑定两台均为 `THERMAL_80` 的打印机，另一个场景绑定标签打印机；计划样本表同步。详设第 277 行；计划第 110 行。 |
| N-2 seed 冲突应失败并要求 reset | CONFIRMED | 覆盖并撤回 R1 N-7 处置：任何终端 create 冲突立即使本次 seed 失败，报告要求先 reset 后重跑；详情读取只用于成功创建后的 readback。详设第 285 行；计划第 118、120 行。 |
| N-3 示例名带主备含义 | CONFIRMED | 交互工件示例统一使用中性名称“吧台标签机 2”，不暗示打印优先级或备份角色。交互第 75、83、176、190、274、283 行。 |
| N-4 子项身份与回执描述不一致 | CONFIRMED | 统一为既有子项 `ref` 不变；回执只返回 terminal ref，子项 ref 由详情读取确认，不把子项映射塞进 receipt。详设第 121–123 行；计划第 82、92 行。 |
| N-5 具体型号矩阵待厂商证据冻结 | CONFIRMED | 已按 Epson 与 Zebra 官方规格冻结纸型关系；ZD411D 的 `LABEL_60_40` 明确表示 60 mm 介质宽、最大打印宽为 56 mm，不暗示满宽打印。CP-01 contract 与手写 V-29 仍须独立逐格对账。详设第 98–115、316–332 行；交互第 229 行；计划第 13 行。 |

R2 设计同步静态复核：当前四份工件相互引用 R2 口径；本领域版本码最终选择为 `PLATFORM_COMMON_VERSION_CONFLICT`，operation 精确集合按实际 base∪augmentation 计算。正式契约与生成输出、代码、测试及运行均尚未完成，状态为 `NOT_RUN`，不得从本表提升为 PASS。
