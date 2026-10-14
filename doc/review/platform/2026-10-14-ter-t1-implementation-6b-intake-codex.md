# TER T1 全批 6b R1 Finding Intake

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
`BATCH_GATE=6b`
`INTAKE_OWNER=MAIN_AGENT`
`R1_VERDICT=OPEN`
`CURRENT_INTAKE=REPAIRED_PENDING_FRESH_REVIEW`

## 6b-S1 · public root 与 invariant 漂移

### 主 agent 核验

- **分类：CONFIRMED。** 正式需求 R-15/V-03/V-18 及详设 §8.4、§9、§11a 要求公开面、invariant、README、消费者和机械门与实际源码一致；终端编码规范 §8 要求结构调整同步 invariant。
- **当前根因证据：** 对当前 TypeScript module symbols 执行 exact set 比较，35 个含 `publicExports` 的 package 中 13 个缺项，合计 75 个，未有 invariant 反向多列。包括 remote-control、terminal-update、transport 等实际根导出，以及 `project-basic` 先前已独立闭合的 selector 接缝。
- **反例/边界：** manifest 缺项不说明其 root export 不应存在；这批 reviewer finding 是 source/invariant 一致性缺口。主 agent检查实际消费者与 owner边界后保留既有 API，没有根据“暂时未搜到直接命中”大规模删出口，避免把文档同步 finding 扩成产品 API 移除。
- **影响：** `terminal-invariants.publicExports` 无法承担其已有的公开面说明与后续机器核验用途；当前 6b 必须 OPEN。
- **最小修正：** 精确更新 13 份 `terminal-invariants.json`；在现有 `tools/terminal-skeleton/check-static.mjs` 加一条结构规则，使用同一 TypeScript checker 精确核对所有声明该字段的 root barrel，并拒绝 wildcard；在既有 `check-static.test.mjs` 添加少列/wildcard红例。没有创建新的门工具包、API registry、hash ledger 或通用语义分析。
- **实际验证：** 当前静态门 13/13 PASS；`tools/terminal-skeleton/check-static.test.mjs` 退出码 0、`TERMINAL_SKELETON_MODEL_TEST=PASS`；新增少列和 wildcard mutation 被目标门单独捕获。
- **相关补充：** `remote-control` 与 `automation-agent` 两个 root 原有 wildcard re-export 改成相同符号集的具名 re-export，满足 R-03 barrel 形态；实际 public API 集合未变化。现有 TDC generated-client root re-export red mutation 现在同时由既有 graph gate 与 exact export gate 捕获。

### 6b R1 缺失源码回读文件

reviewer 提到详设 §11a V-18 所列 `doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md` 原先尚未落档。已新建该文件，作为源码语义对读记录和现有 CP-05 evidence/reconciliation 的定点索引；文内声明它不是独立 verdict或动态验收。

## 当前状态（R1处置完成，等待全批差量复核）

- CP-05：R1 public-surface 差量修复后，V-01/V-18 源码回读路径和记录已补齐；fresh reviewer `/root/t1_cp05_r11` 对当前完整 CP-05 重新核验并判定 `MATCHED`，记录见 `doc/review/platform/2026-10-14-ter-t1-cp05-implementation-reconciliation-codex.md`。
- 全批 6b：R1 独立结论仍为 `OPEN`。其确认项已修复；等待 fresh 独立 reviewer 对当前整批三维范围复核。
- CP-06 与动态验收：未开始；当前不满足全批 6b MATCHED 前置。
- `node tools/terminal-skeleton/check-static.mjs` 当前字节：退出 0，13/13 gates PASS。
- `node tools/terminal-skeleton/check-static.test.mjs` 当前字节：退出 0，`TERMINAL_SKELETON_MODEL_TEST=PASS`。

此 intake 是主 agent 对独立 finding 的处置，不替代后续 CP-05 fresh 差量对账、全批 6b reviewer verdict、CP-06、13c 或整批 IMPLEMENTATION review。

## 6b R2 · public-surface 闭环复核

`/root/t1_batch_6b_r2` fresh 全批三维复核结论为 `OPEN`。主 agent 依据 R-15/V-03/V-18、详设 §8.4/§9/§11a、CP-05、TR-10/§8 及当前 package root、README、invariant 与 gate 源码重开后，将下列两项均判为 **CONFIRMED**，归入同一公开面闭环问题族；不涉及产品裁决。

1. 六个当前有 `src/index.ts` 与 `terminal-invariants.json` 的包缺 `publicExports`：`adapter/android/device`、`adapter/android/dual-screen`、`adapter/android/persist-kv`、`adapter/android/remote`、`application/android/sample-terminal`、`application/android/sample-wallpaper-terminal`。根因是既有门将 `publicExports === undefined` 当作不适用直接跳过，导致根导出集合和包维护资料失去机器对账。
2. `adapter/android/update/src/index.ts` 含 `requireNativeModule`、React Native 观察、wire 类型及 `createAndroidUpdatePort` 实现，不是纯显式 re-export barrel。其调用方和测试原本就使用包根 API，无须改变调用语义。

### 最小修正

- 六份 invariant 按各自实际 TypeScript root exports 填入精确名称；对应中文 README 列出同一包根 API，并注明 Expo `App.tsx` 不属于 application 的 `src/index.ts` barrel。
- 将 update adapter 原实现文件移至 `src/implementations/androidUpdatePort.ts`，根 `src/index.ts` 仅显式重导出包元数据、既有 AppControl port 与 update port；没有改公开符号或消费者路径。
- 扩展既有 `public-export-invariants` 门：有 invariant 的 package 必须声明 `publicExports`；根 index 必须仅含显式 re-export 声明，继续拒绝 wildcard 并精确比对 TypeScript module exports。未增加新门、registry、目录或语义分析。
- 在既有 `check-static.test.mjs` 增加“缺字段”和“root index 混入实现”两个真实红例，保留少列与 wildcard 红例。新增门也捕获原运行时依赖红夹具对 root index 加 import 的影响，故该夹具的预期失败向量已包含 `public-export-invariants`。

### 写后读回与 focused proof

- `node tools/terminal-skeleton/check-static.mjs`：PASS，13/13 gates，support check 与 scaffold hygiene PASS。
- `node tools/terminal-skeleton/check-static.test.mjs`：退出 0，`TERMINAL_SKELETON_MODEL_TEST=PASS`；缺字段、少列、wildcard、root 混入实现四类公开面反例均由对应门拒绝。
- `yarn workspace @catering-v2s/adapter-android-update typecheck`：修复移动后残留在实现文件的三个包元数据 export 后 PASS，退出 0。
- `yarn workspace @catering-v2s/adapter-android-update test`：PASS，1 file / 11 tests，unhandled=0。
- 写后回读确认六份 invariant 与各自 root exports 一致；update 实现只在 `implementations/androidUpdatePort.ts`，`src/index.ts` 是四条显式 re-export；package consumer/test 继续从包根调用。动态执行面没有运行。

CP-05 再次开放，需 fresh reviewer 对完整 CP-05 与该差量三维对账；之后再 fresh 重做全批 6b。CP-06 与动态验收尚未开始。

## 当前字节状态：R3 复核闭合

上段记录的是 6b R2 OPEN 刚处置后的状态，保留其原始时间边界。随后 CP-05 由 `/root/t1_cp05_r12` fresh full-stage review 判定 `MATCHED`；全批 6b 由 fresh reviewer `/root/t1_batch_6b_r3` 先独立核对当前需求、详设/计划、记忆/规范和生产源码，再参考作者 intake，判定 `MATCHED`。完整 R3 证据见 `doc/review/platform/2026-10-14-ter-t1-implementation-6b-r3-reconciliation-codex.md`。

- 当前 CP-05：`MATCHED`，见 `doc/review/platform/2026-10-14-ter-t1-cp05-implementation-reconciliation-codex.md`（R12 closure）。
- 当前全批 6b：`MATCHED`；R3 用只读 TypeScript checker 核实 41 个 invariant/root-index package 的实际导出与 `publicExports` 精确一致，issues=0，并核查 R2 六包字段、update 纯 barrel、门/红例及跨 CP owner/API 接缝。
- 聚焦证明：上一节列出的静态门、模型红例、update adapter typecheck 与测试 PASS 仍是主 agent 实际执行结果；R3 未重跑这些命令，也未执行动态环境。
- 可进入 CP-06 的静态前置已闭合。DEV、Expo Web、Android/设备、business 与 cleanup 仍 NOT_RUN；CP-06 还须完成当前日志链路审查与动态前准入，不能把 6b MATCHED 当作动态 PASS。
