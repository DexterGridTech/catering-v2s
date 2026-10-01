# 终端激活与长连接 · 批次二 CP-02 当前字节三维对账 R2

日期：2026-10-01。当前 fresh 独立只读 reviewer `/root/cp02_source_manifest_recheck` 给出 `CP02_RECONCILIATION=MATCHED`，`M/S/N=0/0/0`。此前 reviewer `/root/cp02_recheck` 的同状态 verdict 因 source manifest 误纳生成日志而重开；当前 reviewer 已按修复后的清单和 owning source 完成复核。本结论只关闭 CP-02 阶段，不代表整批 verdict 或动态验收结果。

## 三维依据

- **需求**：R-9.6、R-11、D-16 要求终端持久身份与 server-config reset retain 范围分别明确；V-T8 要求取消激活只保留 server-config，并覆盖清理失败反例。见 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:766-778,1081-1086,1168-1184`。
- **详设/计划**：详设规定 `kernel.base.server-config` 是地址/代理配置 owner，终端凭证不进入该 owner，reset retention 由 state runtime descriptors 执行；计划 CP-02 退出要求 owner/state focused proof、TR-09 例外与 fresh MATCHED。见 `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md:146-149`、`doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md:90-102`。
- **项目记忆与规范**：TR-09 仅允许 server-config 持久 slice 声明 retain；重置仅投影持久 descriptor；不允许第二份配置/凭证存储。现行构建批次记忆中历史“server-config 不建”已被需求裁决取代。

## Current source 与 focused evidence

- `server-config` 独立 module 仅依赖 runtime/state/contracts，声明自身配置 slice 的 `resetIntent: retain`；公开 selector 对密码脱敏，只有 `network-adapter` 子路径可将受保护代理密码注入 composition。凭证仍由 terminal-data-client 持有。
- State runtime 只从 retained persistence descriptors 形成重置投影；先 flush/清理，再回初始状态并投影所保留配置；失败不派发根 reset。分区 helper 强制 clear，无法把 retain 扩散到其他 owner。
- focused tests 覆盖配置覆盖与恢复、密码脱敏/secure storage、只保留 server-config 并清除其他 owner/orphan、retain 必须有 persistence、清理失败不改变内存、partitioned helper 拒绝 retain。`state-reset-retention-only` gate 和 red fixtures 限定唯一可 retain owner。
- 历史 `.runtime/review/terminal-activation-batch-2-cp02-current/source-sha256.txt` 共 62 条；其中误纳入 `.turbo/turbo-test.log` 与 `.turbo/turbo-typecheck.log` 两类生成输出。test log 已变化，typecheck log 当时为空但同样不是源码输入。主 agent 已从 source manifest 移除全部 4 个 `.turbo` log 路径，保留原始 focused transcript 于 `.runtime/review/terminal-activation-batch-2-cp02-current/` 独立作为运行证据。修正后为 58 个 source/test/config/fixture/input 条目，manifest SHA-256=`559203eeb10a5e0cc4f05dd47c06d25289c7eb1c77b4877aa114bf0a3daa0f12`，`shasum -a 256 -c` 为 58/58 `OK`；等待 fresh CP-02 reviewer current-byte 复核。
- Focused logs：server-config test 2 files/5 tests PASS，state test 5 files/70 tests PASS；两项 typecheck 的 runner exit code 均为 0。摘要及原始日志见 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-cp02-proof-codex.md` 与 `.runtime/review/terminal-activation-batch-2-cp02-current/`。

## 证据边界

本轮 reviewer 未运行测试、build、verify 或受管环境。CP-02 focused proof 中 skeleton `check-static` 的 PASS 只有先前记录摘要、没有当前轮 raw transcript；本轮因只读 review 未补跑，也未把该门升级为新输出证据。backend-acceptance、Node/HTTP/WS、Expo Web、DEV、reset、seed、cleanup、L2 均为 `NOT_RUN`，不影响本阶段静态/focused reconciliation verdict，也不表示动态通过。

本记录未修改实现。若后续 CP 改动 state、server-config、skeleton graph/gate 或其 tests，相关 focused evidence 必须重新绑定；之后整批 6b 仍要独立完成。

## Manifest finding 的关闭

初轮 6b `N-1` 经主 agent 源码/证据重开后确认。根因是 source manifest 收入 server-config 与 state 各自的 `.turbo/turbo-test.log`、`.turbo/turbo-typecheck.log` 四个生成输出；测试日志会随 Turbo 运行变化，空 typecheck log 也不是源码输入。主 agent 从清单移除四项、保留四份独立运行 transcript，当前 source-only 清单 58 项、SHA-256=`559203eeb10a5e0cc4f05dd47c06d25289c7eb1c77b4877aa114bf0a3daa0f12`。

Fresh reviewer `/root/cp02_source_manifest_recheck` 证实 `shasum -c` 58/58 OK，并用 package inventory 与 manifest 对比确认两者无差异；其扫描未发现 `.turbo`、运行时输出、`node_modules`、`dist`、`build`、coverage 或 `.runtime` 路径。`CP02_RECONCILIATION=MATCHED` 只绑定源码与 local focused evidence；没有重新运行 package tests/build，也不提升为受管 runtime/reset/seed 证据。该 reviewer 对 TER consumer-face 记忆路由未找到适配别名，按可路由的具体维度与 terminal 规范原文重开；不影响 CP-02 的 state/server-config 规则匹配。

## 全批 6b finding intake 与最小处置

- **N-1 `CONFIRMED`（证据清单可靠性）**：current-source manifest 混入四个 Turbo `.turbo/turbo-test.log` / `.turbo/turbo-typecheck.log` 派生输出；test 日志在阶段复核后内容变化，导致按同一 manifest 再核验出现非源码漂移。最小修复是只从 source manifest 去掉四条生成日志路径；四份既有 `.runtime` 日志继续各自留作已发生的 command transcript，不混入源码哈希分母。反例检查：修正后的 manifest 不再命中 `.turbo/` 或 `.log`，其余 58 条均校验通过。无产品语义变更，需 fresh CP-02 对账确认此证据修复。
