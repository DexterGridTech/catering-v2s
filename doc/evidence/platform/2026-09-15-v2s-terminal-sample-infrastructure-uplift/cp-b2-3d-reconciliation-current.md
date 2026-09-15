# CP-B2 三维对账（current）

REVIEW_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER_NICKNAME=Kierkegaard
REVIEWER_ID=01a0a41b-b9e9-7fa1-9403-78524c9a59f4
STEP=CP-B2
SCOPE=assembly/base/android;adapter/android/dual-screen;ui/base/render;native projection;U8/U10 runner oracle
SOURCE=NO_GO_AS_IS
DESIGN=NOT_MATCHED
MEMORY=matched_for_reviewed_source
STEP_RECONCILIATION=NO_GO_AS_IS
DYNAMIC_ENTRY=BLOCKED_UNTIL_DOC_AND_CURRENT_EVIDENCE_REPAIRED

本记录由 fresh 独立子 agent 只读完成。审查者没有写入、删除、移动文件，没有执行 Git，
没有启动构建、设备、DEV 或动态运行。focused green、历史动态记录和本记录均不升级为
动态或 implementation acceptance PASS。

## 首个 mismatch

当前实现已经使用 v3.7 的 failure-page identity 与文案：

- `ui.base.render:startup-failure`
- `ui.base.render:runtime-failure`
- 启动/运行期标题分别为 `终端启动失败` / `终端运行异常`
- 说明为 `请重启终端，如仍失败请联系管理员`

但当前详设仍在 `implementation-design-codex.md:427-435` 和 `:937-948` 要求旧的
`ui.base.render:splash-failure`、旧 message testID 和“终端启动失败，请重试”。这是
文档—源码—需求三维不一致，必须先修正文档 oracle。

## 其余核对

- 双屏原生 `RecoverableRemoval` 与终态 `Unavailable` 分离，recoverable 路径保留最后
  有效快照；
- ready 只在 resolved real part、目标物理 PRIMARY、有效 geometry、首次布局后上报；
- startup writer 的六组与 PRIMARY 三条件符合 v3.7；
- Activity instance loading gate 与 JS runtime 生命周期分离，两个 MainActivity 在
  `super.onCreate(null)` 之前注册；
- native projection checker 覆盖两个 App 的身份、manifest、theme、resource、asset
  和 applicationId collision；32 节点 graph 与废弃 adapter 空壳清理在源码层匹配；
- U8 runner 的断言能力已比旧 evidence 更严格，但 `u8-release-cold-start-current-rerun-04`
  标记 build skipped，且 schema 没有当前的 first-RN-content 字段，不能当当前动态 PASS；
- U10 runner 能断言冻结旅途，但现有 sample1 result 含 `business: NOT_RUN` 与首败，不能
  把既有记录升级为两个 App 全量动态 PASS。

## 关闭条件

1. 将详设的 failure-page testID、文案和 UI/testID 表更新到 v3.7；
2. 以当前源码和当前 runner 重新产出 U8 release/mobile/dual 证据；
3. U10 仅在实际 business 与 cleanup 均有记录后关闭，不使用旧 result 代替；
4. 全批 fresh 三维对账在动态前重新执行。
