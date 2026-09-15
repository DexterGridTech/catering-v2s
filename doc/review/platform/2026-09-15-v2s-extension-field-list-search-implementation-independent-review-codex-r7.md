# 扩展字段列表展示与类型化搜索：步骤级独立复查 r7

```text
REVIEW_TARGET=STEP_RECONCILIATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEW_ROUND=7
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Locke
agent=01a0a422-c008-7f31-9c43-db9b61702ffd
READ_ONLY=true
SOURCE_FIRST=true
VERDICT=PARTIALLY_CONFIRMED
OPEN_COUNT_BEFORE_AUTHOR_REPAIR=2
```

## 输入与盲审声明

本报告由 fresh 独立只读 verifier 生成。审查者从仓库当前字节重新读取入口约束、Roadmap 授权、全部 project-memory kernel、确定性上下文、需求、IA、interaction、implementation design 与 owning source；未把 handoff、聊天摘要或此前 reviewer 结论当作事实正本。未写文件、未调用 Git、未执行 runtime/reset/seed/DEV/L2/test command。

## 逐条 finding

### F-01：失败态可能继续渲染旧 currentData rows

```text
CLASSIFICATION=CONFIRMED
SEVERITY=CODE_LOGIC
SCOPE=operations business entity/store/contract; platform organization/contract flat lists
DESIGN_BASIS=requirements §5.2/§7.3; interaction §7; implementation-design §6.3/§7.2
```

列表或 definition/recovery 失败时，页面原先只把 error 交给 `adminListState`，dataSource 仍从 RTK `currentData` 读取，可能把旧 rows 与新错误并列显示。最小修复是把 list/definition/recovery failure 合并为同一 `listDataFailed`/failure 状态，同时传 `dataSource=[]` 和 `adminListState.failed=true`。主 agent 已在五个 operations/platform flat-list consumer 完成该修复。

### F-02：Platform detail lazy request 缺少 Tab context invalidation

```text
CLASSIFICATION=PARTIALLY_CONFIRMED
SEVERITY=CODE_LOGIC
SCOPE=PlatformReadPage organization detail path; outside flat-list stale recovery core but within current page async boundary
DESIGN_BASIS=implementation-design §7.2; interaction §1/§7
```

详情 promise 原有 generation guard，但组织 Tab 切换没有主动使旧详情请求失效并关闭旧 surface，存在旧 Tab 回调写入当前页面的反例。主 agent 已在 `changeOrganizationTab` 中 invalidate detail generation、关闭旧 detail、清理 hierarchy selection；该处不需要产品裁决。

## 主 agent intake 与后续复查入口

```text
F-01_AUTHOR_REPAIR=operations/platform flat lists clear dataSource on list/definition/recovery failure
F-02_AUTHOR_REPAIR=organization Tab change invalidates and closes stale detail request
FOCUSED_PROOF=operations architecture 42/42; operations unit 257/257; platform architecture 17/17; platform unit 26/26; foundation 56/56; all frontend typecheck PASS; organization compileJava/compileTestJava PASS
FOLLOW_UP_REVIEW=2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r8.md
```

本报告的两个 finding 不应在修复后继续作为 OPEN；是否已 MATCHED 由 r8 fresh verifier 单独核验。
