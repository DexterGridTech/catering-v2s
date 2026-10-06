# TER automation-agent 最终验证与证据边界

## 范围

本记录汇总 CP-01～CP-06、批次级 6b、当前授权动态范围，以及 2026-10-06 本轮修正后的针对性验证。动态范围按 Dexter 的最新指示仅覆盖两个 sample application/integration 的主要 Journey；不要求将排除项补跑或以其缺少证据阻断交付。

## 当前代码修正与检查

- `TR-R04`：`defineStateSelector` 将参数元数据与 selector 回调合并为 options 参数；`createTestId` 将 element/key 合并为 options 参数，调用点同步更新。
- `TR-R05`：JSON 值检查拆为数组和对象辅助函数；UTF-8 计数采用浅层分支；消息 schema 按类型选择后统一解析。
- Runtime selector 新增到 `RuntimeModuleContext` 的 `evaluateSelector` 已登记到 `terminal-invariants.json`；`check-static.test.mjs` 增加删除该成员时 exact-set 必须失败的红夹具。
- 首轮完整 `scripts/verify --validate-only` 的终态为 FAIL，失败于 runtime exact-set 机械门：context 新成员没有同步进 invariant。该运行完整保留于 `.runtime/terminal-automation/verification/2026-10-06-validate-only-final.log`。修正 invariant 与红夹具后，针对性门通过；没有重跑整套 validate-only。
- `scripts/verify` 默认模式未运行：它会执行与本批无关的广泛后端测试套件。没有将 validate-only 或目标包测试称为默认 verify 通过。

## 针对性静态/代码验证

| 检查 | 结果 |
|---|---|
| `TR-R04`、`TR-R05` 当前代码静态规则 | PASS，均零 finding |
| Runtime static model self-test | PASS；新增 `evaluateSelector` exact-set 红例 |
| Runtime real static checker | PASS，5 rules + 1 support check |
| 相关 13 个 workspace typecheck | PASS |
| `kernel-base-runtime` 测试 | PASS，PROD 109 tests，DEV 109 tests |
| `ui-base-primitives` 测试 | PASS，40 tests |
| `ui-base-automation-agent` 测试 | PASS，31 tests |
| 受影响 TS/MJS/JSON Prettier 检查 | PASS |
| defineStateSelector/createTestId 调用形态 AST 检查 | PASS，旧 arity 为零 |

## 动态验证

主要 Journey 的当前字节业务与 cleanup 均 PASS：

- Web console：`c32f4ee9-e7e5-4c77-a73f-3af21e4ed58d`，含 TDP `DEV-DATA-01` selector 读回及恢复。
- Web wallpaper：`58e1c8df-a928-4a3a-ae7f-ce1e08d5a04c`。
- Android console：`b7cb31f6-9f10-440c-bc13-21be8eb0fe80`，含 TDP selector 读回及恢复。
- Android wallpaper：`b74b83c8-e976-48d7-8847-5abb934abde0`。
- 受影响 F-4a Web runner 的当前字节 focused proof：`be56cf2e-02fb-4540-9a87-47c7f5ca7f13`，business PASS、cleanup PASS。

F-4b、geometry、F-1/F-2、非主要 Journey、额外拓扑及未迁移旧场景保持 `NOT_RUN` 或 `HANDOFF`。它们不是本次验收范围；Claude 静态代码 review 不得要求这些场景的运行 evidence，也不得仅因其未运行而提出 finding。静态审查仍可指出代码本身不符合详设的问题。

## 阶段对账与独立 review

- CP-01～CP-06 独立阶段对账均为 `MATCHED`。
- 修复 CP-04 旧字节 proof 后的批次级 6b 独立对账为 `MATCHED`，详见 `2026-10-06-ter-automation-agent-6b-reconciliation-codex.md`。
- 交付前逐代码与详设对账及 fresh 整批 `REVIEW_TARGET=IMPLEMENTATION` 是独立收口项；本记录不替代它们，也不把静态门结果升级为整批实现 verdict。

## 状态

- 当前字节上的最新运行：2026-10-06，`node tools/terminal-runtime/check-static.test.mjs` + `node tools/terminal-runtime/check-static.mjs`，PASS；紧随其后的受影响文件 Prettier 与 API arity 检查均 PASS。它们是当前字节的 targeted proofs，不是全仓默认 `scripts/verify`。
- 最后一次完整静态 `scripts/verify --validate-only`：`ter-local-static-59920-1791286411936`，FAIL（runtime exact-set fixture drift）；在该运行后已修正 invariant/test 并由 focused proof 证明关闭，整套模式未重跑。
- 最后一次完整默认 `scripts/verify`：本轮未运行；不将其称为 PASS。

### 13c 差量关闭

Fresh 独立差量复核记录见 `doc/review/platform/2026-10-06-ter-automation-agent-13c-delta-reconciliation-codex.md`，结论 `MATCHED`。为同步当前 `createTestId` options API 与记录直接依赖 `source-map@0.6.1`，补充运行的针对性检查为 server-config-panel 5/5、bundleAttribution 3/3、相关文件 Prettier 与 handoff checker 均 PASS。未重跑不受此文档/测试替身差异影响的 Web、Android 或 F-4a 运行。
