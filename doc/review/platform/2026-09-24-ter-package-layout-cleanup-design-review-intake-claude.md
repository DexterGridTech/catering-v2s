# TER 包布局整理 · Codex DESIGN 评审处置（作者 intake）

```text
SOURCE_REVIEW=doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md（f6b10c497ead817d）
SOURCE_VERDICT=REVIEW_TARGET=DESIGN, VERDICT=NO-GO, M/S/N=3/7/3
INTAKE_BY=Claude（被评审文档的作者）。这是作者对独立评审的辩证处置，不是独立复核。
EVIDENCE_TIER=Claude 静态回读源码与 Codex 评审正文；M-3 的门结果来自 Codex 本轮实跑，Claude 未复跑，只做了静态抽查
WRITES=仅本文件。需求与方案未改，本轮 Codex 回复未授权修改
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接）
```

## 1. 总判断

Codex 的 NO-GO 成立。结构决策（D-1 至 D-4、D-5 的范围）没有被推翻，没闭合的是“证明接口”：AC-0、AC-2、AC-3、AC-8、AC-9、AC-10、AC-11 写了要证明什么，但没写清楚怎么证明才不会空过。

有两处被证据驳回：S-1 与 S-3 都把编码规范第 974 行当成“顶层 assembly 层”，这不对，见 §2。

其余全部接受。其中 M-2、S-2、S-6、S-7 的具体值、命令和文件清单，本就属于详设；需求 v4 只冻结判据的形状与红控制。

## 2. 逐条处置

**M-1 · AC-8 不可执行 —— PARTIALLY_CONFIRMED**
- 缺口真实：快照身份、比较文件集、映射作用域、逐文件允许差异、锁文件与被忽略文件的处理、红变异都没冻结。
- 需求 v4 的 AC-8 写成契约：
  - 仓外快照带逐文件 sha256 清单；
  - 文件集与 AC-2 的活跃文件清单相同；
  - 映射是按文件类别限定的锚定 token 表，包内 `src/assembly/`、`createXxxAssembly`、`assembly-rejection` 不参与映射；
  - 允许差异逐文件列出；
  - 锁文件归 AC-6；
  - keystore 与 `.runtime/` 按哈希比对，可重建产物不比较；
  - 以下四种红变异必须失败：快照为空、多出一行无关改动、改了一个不在允许清单里的字符串、扩大允许清单。
- 具体清单由详设给出。

**M-2 · AC-10 缺绝对期望值 —— PARTIALLY_CONFIRMED**
- 缺口真实：Web 入口、操作、证据字段和双屏证据关系都没写。
- 需求 v4 冻结判据形状：
  - Web 入口为各 integration 的 `web` 脚本，形态与屏幕模式写明；
  - 操作为冷启动到首屏，不做交互；
  - 证据为 `startup.complete` 的 `owner`、`writer`、六组 readiness、`primaryReadyPartKey`、`primaryContentFailure`，另加 SECONDARY 的 partKey；字段来源沿用 `tools/terminal-sample2/run-sample2-frozen-journey.mjs:434-448` 的现有入口；
  - 两端源码摘要相同，Web 时间早于设备；
  - 以下三种变异必须红：交换 SECONDARY partKey、清空 readiness、两端源码摘要不同。
- 具体 partKey 由运行期导航决定。需求不猜，由详设从源码列出并经评审冻结。
- 动态执行不在本轮授权内，交付前 AC-10 记为“未执行”。

**M-3 · 基线不止三项 —— CONFIRMED（DEXTER_DECISION）**
- Codex 实跑的结果：
  - typecheck 通过；
  - test 在 transport 的 `identityClient.test.ts` 有 2 处失败；
  - `verify:static` 首败为 readability；
  - layering 在 `sample-staff-auth/src/components/StaffLoginForm.tsx:13` 失败。Claude 静态抽查，此处确为 `createElement('form')`。
- 需求原文“第 0 步后三道门全绿”不成立。
- 需 Dexter 选：
  - **(a) 推荐**：把这些与本批无关的既有红冻结为基线摘要。AC-0 改为“修完本批三项后，其余既有红与基线摘要逐条一致，不新增回归”，既有红另立批次；
  - **(b)**：扩大本批范围修到全绿，需要重新授权。

**S-1 · AC-2 扫描范围 —— PARTIALLY_CONFIRMED**
- 成立的部分：
  - 不带 `--untracked` 的 `git grep` 只扫受控文件。v4 先用 `git ls-files -co --exclude-standard` 生成活跃文件清单，再对清单扫描；
  - 正本散文中的 assembly 靠正则抓不全，v4 改为逐处分类：层义必改，装配义进白名单并写理由；
  - Console 禁用集由旧包的标识清单生成。
- 驳回的部分：编码规范第 974 行位于 §7.1“`src/` 目录词表”（第 955–974 行），它指的是包内的 `src/assembly/`（装配），不是顶层层名，必须保留。

**S-2 · AC-9 无可执行路径 —— CONFIRMED**
- v4 写明三类证据：
  - 生成的 `ExpoModulesPackageList` 恰含三个新全名、没有旧名；
  - 每个 APK 的证书摘要（`apksigner verify --print-certs` 或等价命令）等于对应 keystore 的摘要（`keytool -printcert` 或等价命令）；
  - keystore 哈希不变。
- 红控制：改错一个类名、换一个 keystore，都必须失败。
- `check-native-projection.mjs:264-265` 写死旧包名，单列进影响面。
- 生成文件的确切路径需构建后才能确定，由详设写明。

**S-3 · 正本、记忆、skill 同步 —— PARTIALLY_CONFIRMED**
- 驳回第 974 行，理由同 S-1。
- 其余接受：
  - v4 列出三个 skill 的实际命中行；
  - `terminal-build-order-and-batches` 是 `status: active` 的记忆文件，只追加说明不够。改为追加带日期的规范性取代条目，同步 assertion、`required-inventory.json` 与 index，并运行 build-index、`build-index --check`、project-memory 检查，再用查询证明新结论优先。

**S-4 · D-4 可恢复证据 —— CONFIRMED**
- v4 要求：
  - 仓外持久根，不用 `/tmp`，位置写进记录；
  - 命名包含日期、包名和短哈希，避免碰撞；
  - 逐文件 sha256 清单与恢复命令；
  - 四个包都要有记录，包括并回的 test-support；
  - 清理只触及本批包。

**S-5 · TR-08 口径 —— CONFIRMED**
- v4 在交付要求中写明 `TR-08=OPEN/OUT_OF_SCOPE`：生产包检查器的绿，与 AC-6、AC-8 的通过，都不代表 TR-08 已关闭；后续待办写明 owner、输入与首个 gate。
- 另外，harness 在第 0 步只能搬到生产可导入的目录（`components/`），不能放 `testing/`。`testing/` 按规范不进生产导入图，而 D-5 要求行为不变。

**S-6 · 四步中间态 —— PARTIALLY_CONFIRMED**
- v4 冻结每步的契约：
  - 门的期望等于基线摘要，加上该步的预期变化；
  - 写明安装命令；
  - 锁文件只允许出现该步预定的 workspace 条目变化；
  - harness 的目标目录已按 S-5 确定。
- 每步的完整文件集由详设按 CP 给出。

**S-7 · AC-3 换靶 —— PARTIALLY_CONFIRMED**
- 需求已要求“具体 gate 与报文”。v4 另要求详设为每个夹具写明输入、唯一变异、预期 gate、报文前缀与恢复步骤，并先在基线上正向通过。
- `plannedDependencies` 删除后的红控制：用 AC-2 的字面量扫描保证活跃文件中 `plannedDependencies` 零命中，并做正控制。不为此新增检查器规则。

**N 类（3 条）**：正文未逐条展开，Codex §5 表中与 D-1、D-2、D-3、TR-08 相关的收口要求并入上述处置。

## 3. 下一步

1. **授权修订**：请 Dexter 授权 Claude 按上表把需求与方案修订为 v4，然后再交 Codex 复核。
2. **M-3 取 (a) 或 (b)**：由 Dexter 决定。

本处置不授权详设、实施、构建、安装或任何动态运行。

## 4. Dexter 决定与落地（2026-09-24 追加）

Dexter 原话：“把本批范围扩大到所有门全部通过。你拥有所有授权。接不接受修订，你决定”。据此：

- M-3 取 (b)，本批以三道门及全部子门全绿收尾；
- 需求与方案已按 §2 修订为 v4，两份文件见 `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-{formal-requirements,solution}-claude.md`。
