# 双后台名称+编码密度实施独立终审（Round 2）

REVIEW_CYCLE_ID=DUAL-ADMIN-NAME-CODE-DENSITY-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED

## 审查声明

我是本轮 fresh 独立 implementation reviewer。审查先于作者材料进行反证式核验；本报告只核对 Round 1 的已确认 finding、其处置、当前生产源码、当前机器门和 focused proof，不修改生产代码，不把本轮结果扩展为 runtime、DEV/UAT、HTTP/L2 或 Git 授权。依据 Round 1 的硬限制，本轮为同一 `REVIEW_CYCLE_ID` 的第二轮，也是最终轮，之后不再召集第三轮。

## 用户任务

业务用户在双后台查看组织、门店、品牌、合同、用户和审计等列表/详情时，需要稳定、紧凑且一致地看到名称+编码。双后台所有生产名称+编码展示统一使用 `admin-ui-foundation` 的共享组件；路径型展示使用 `NameCodePathText`，普通名称+编码使用 `NameCodeText`；保留缺失值、单值和可访问性语义，不把非视觉请求/键值元数据误判为展示面。设计规范与实现范围分别以：

- `doc/decisions/2026-08-05-v2s-dual-admin-name-code-density-standard.md`
- `doc/plans/platform/2026-08-05-v2s-dual-admin-name-code-density-implementation-design.md`

为规范源。

## Dexter 立场

Dexter 的立场是：本包是前端展示密度和真相统一的静态实现包；foundation 是唯一共享实现，两个 app 只负责业务组合。契约、owner、edge、runtime、数据库、seed/reset 均不在批准 change surface 内。Round 1 的 S-01（机器门漏检展示变体）和 N-01（review input 缺少裸 `REVIEW_ROUND` 字段）必须闭合后才可判定本轮。

## 替代方案

未采用各页面局部 CSS、重复 formatter、或对每个表格/Drawer 另建包装组件；不选这些替代方案，因为它们会扩大维护面并破坏真相唯一性。较小且满足真相唯一性的方案是复用既有 `NameCodeText`/`NameCodePathText`，并让机器门扫描所有 production `.ts/.tsx` 的旧 formatter、手拼名称+编码和共享组件 producer coverage；本轮不引入新的 UI abstraction、契约字段或运行时依赖。

## 方案合理性

实现与规范相符：问题（多处局部组合造成密度和真相漂移）由一个共享方案解决。普通组合由 `NameCodeText` 渲染，路径组合由 `NameCodePathText` 分段渲染；`formatNameCode` 仍只作为共享组件内部的纯展示语义，`formatCodeNamePath` 仍可用于非视觉纯字符串场景。foundation 使用统一的 `var(--ant-font-size-sm)` 与 `var(--ant-color-text-tertiary)`，保留 `—`、单值和路径分隔语义。实现代价只增加一次共享组件接入和机器门维护，复杂度与收益匹配；所有应用生产 import 均来自 foundation，未发现第二套视觉实现。

## UI 与交互

APPLICABLE。覆盖 Tree、ProTable/Table、Descriptions、Drawer、Tag、Select、Modal、审计标题和 data-scope context bar 等名称+编码可见面。当前源码扫描显示 31 个 production 文件、77 个共享组件 producer site（platform-admin 10 文件/28 sites，operations-admin 21 文件/49 sites）；当前两类旧 formatter 与手拼 visual name+code 均为零。该包不改变用户操作路径、点击、路由、筛选、排序、Drawer 生命周期或请求行为，只统一展示组合和密度样式；runtime/L2 证明属于本包外授权边界，focused proof 已明确标记 N/A。

## 审查意见复核

### Round 1 S-01：机器门漏检名称+编码展示变体

**判定：CONFIRMED → CLOSED。** Round 1 证据确认旧 checker 只匹配旧 formatter 和单一精确模板，不能覆盖 `${name} (${code})`、`${name} / ${code}`、相邻 JSX 以及共享组件覆盖率不足。

**当前核验：** `scripts/check/name-code-density.mjs` 已同时执行：

1. 生产源码旧 `formatNameCode`/`formatCodeNamePath` 调用扫描；
2. 模板中名称+编码手拼扫描（排除明确的 `key:`/`key=` 元数据行）；
3. 相邻 JSX 名称/编码展示扫描；
4. `<NameCodeText>`/`<NameCodePathText>` producer site 与 producer file 计数，并要求当前分母至少 77 sites/31 files；
5. red mutation self-test，覆盖旧 formatter、带空格括号、斜杠模板和相邻 JSX。

实跑结果：

```text
NAME_CODE_DENSITY_SELF_TEST=PASS
RED_LEGACY_FORMATTER=PASS
RED_HAND_BUILT_NAME_CODE=PASS
NAME_CODE_DENSITY=PASS
LEGACY_FORMATTER_CALLS=0
HAND_BUILT_NAME_CODE=0
COMPONENT_PRODUCER_FILES=31
COMPONENT_PRODUCER_SITES=77
```

这同时证明了当前生产面无旧 formatter、无检测到的手拼展示组合，且 31/77 的实施分母未因漏站点而假绿。未发现该 checker 对现有合法 `key`、请求参数或 aria/metadata 纯字符串产生误报；foundation 与三套 app typecheck 及 focused test 均 PASS。

### Round 1 N-01：review input 缺少裸 `REVIEW_ROUND=1`

**判定：CONFIRMED → CLOSED。** `doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-independent-review-input.md` 现已包含裸字段：

```text
REVIEW_CYCLE_ID=DUAL-ADMIN-NAME-CODE-DENSITY-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
```

本报告自身声明 `REVIEW_ROUND=2` 与 `ROUND_FINAL_DECISION=SELF_DECIDED`，满足同一 cycle 的二轮硬停止条件。

**适用边界与反例：** `key:`/`key=` 的纯 metadata 例外仍可合法保留；这不应覆盖当前已扫描到的视觉 JSX。当前 production 没有该反例命中，且 red mutation 已证明旧 formatter、空格括号、斜杠和相邻 JSX 会被拒绝。更小的修复只补裸字段会留下 S-01；当前 checker 扩展的成本低于继续依赖人工名单，且没有引入过度设计。

## 闭环核验

### 规范、设计与实现对账

- `doc/decisions/2026-08-05-v2s-dual-admin-name-code-density-standard.md`：名称+编码视觉展示统一组件、路径使用 path component、样式变量和非视觉例外均与源码一致。
- `doc/plans/platform/2026-08-05-v2s-dual-admin-name-code-density-implementation-design.md`：2 个 foundation component + 31 个 app production files/77 个 producer sites 的出口分母已由当前 focused proof 和 checker 同步覆盖。
- `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts` 与 `src/index.ts`：组件实现及导出存在，类型检查通过；无新的重复 abstraction。
- 两个 app：组件 producer 计数与机器门一致，未见旧 formatter/手拼 visual 组合。

### 独立测试与门证据

本轮读取并核对 focused proof；其命令证据为：

- foundation、platform-admin、operations-admin `yarn typecheck`：PASS；
- foundation tests：3 files / 18 tests PASS；
- platform-admin Vitest：42 files / 51 tests PASS；
- operations-admin Vitest：28 files / 76 tests PASS；
- `scripts/check/standards-coverage --phase R5`：PASS，`RULES=150`；
- `scripts/check/name-code-density.mjs --self-test` 与主扫描：均 PASS。

已知 platform architecture baseline 的两条既有失败（commercial-group-boundary、platform-read-boundary）不在本包 changed surface，focused proof 已单独标注，不被本包 PASS 冒充修复。

### 反例与边界

- 非视觉 `aria`、dedup key、request 参数和 metadata 仍可使用纯 formatter/string；checker 的 `key:`/`key=` 例外仅服务于这类明确元数据，不改变视觉组合规范。
- 缺 name/code 的值继续由 foundation 统一输出 `—` 或单值；没有页面级 fallback 分叉。
- 本轮未执行 runtime/DEV/UAT/L2；这属于已批准边界，不是静态实现缺陷。

## 实施代码核验

当前源码与证据哈希已在 focused proof/input 中记录；本轮重新核对的关键 hash 包括：

- `scripts/check/name-code-density.mjs`：`a02b61c14466a98ed3c726bd3a0f4cbfecf537c3815aaf860c29ab16c0032c11`；
- `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts`：`4913b960...`；
- `libraries/frontend/admin-ui-foundation/src/index.ts`：`908345...`；
- 当前 review input：`7f02c47c37888987789e6c60a66ab9b751ed5513c122c81a22434932b737c3a5`。

修改面仅落在批准的 foundation、双 app 生产展示和机器门/证据；未发现契约、后端、数据库、脚本运行时或其他边界越界。

业务用户行为复核：名称/编码列表与详情 Journey 的查看路径保持原样，用户仍通过既有列表、树和 Drawer 入口完成识别；本包只改变视觉组合，不改变业务结果或可操作控件。

## 结论

Round 1 的唯一严重 finding S-01 已由覆盖增强、producer 分母守卫和真实 red mutation 关闭；N-01 的审查轮次元数据也已补齐。当前生产扫描、类型检查、focused tests、标准覆盖门均 PASS，未发现新的 material finding。

VERDICT=GO  
M=0 / S=0 / N=0

这是本 `REVIEW_CYCLE_ID` 的 `REVIEW_ROUND=2` 最终独立 implementation verdict；不构成 runtime、DEV/UAT、HTTP/L2、seed/reset、数据库/migration 或 Git 授权，也不替代后续若有实质变更时建立新 review cycle。
