# TER 版本更新阶段 A 修订设计包 · 外部差量静态复核

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE_STATIC_DESIGN_RECHECK（经 Dexter 中转）
PRIOR=doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-claude.md（NO-GO 0M/3S/5N，详设 1fa3f3eb…）
SESSION_PROVENANCE=续接会话（v2s 仓根），非 fresh；本会话写过上一轮外部评审
NOT_A_SUBSTITUTE_FOR=内部 DESIGN cycle（已关闭，不重开，不算第三轮）
AUTHORIZATION=仅静态差量复核；不授权实施、改需求/规范/记忆、依赖、生成、编译、测试、verify、DEV、Web、设备、reset/seed、L2、UAT、部署或 B/C
```

## 0 · 亲验哈希

本轮重新计算的 SHA-256 与 intake §2 一致：

| 文件 | 前 16 位 |
|---|---|
| 详设 | `19a52bddfac1f56b` |
| 计划 | `ab6431d1db2333ea` |
| 附件 | `aeec76715ab37cc8` |
| Journey | `65a37335a5a21488` |
| IA | `be12f8536b0759f2` |
| UI | `769ef2a87a253294` |
| 需求（只读，未变） | `f4ae511b8691710f` |

判断顺序：先读需求、当前设计与源码，形成判断后才对照 intake。源码读自当前工作区字节。TDC 文件仍在 Codex 在途改动中：`dispatchOfflineReset` 已由 L193 移到 L198-199，符号与原因码不变。

## 1 · 结论

```text
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/3
L1_ENGINEERING=PASS（静态）；3 项 N 为可在实施前补的精确化，不阻断
L2_USER_VISIBLE=PASS（文档层）：三个面的状态与边界、窄例外与 Journey/IA/UI 一致；线框 UNSET
L3_UNVERIFIED=见 §5
SAME_ROOT_SCAN=见各 finding
DESIGN_GAPS=沿用：verification-governance.md 未定义 M/S/N
TEMPLATE_COVERAGE=差量涉及的节（详设 §0、§3a、§8.1-8.7、§9a/9a.2、§11a、§12；计划 §0、CP-01/02/03/05；附件 §2-§4；Journey §4/§7；IA §2.2/§4；UI L58/L140-142）均有，与上一轮报告 §5 合并即为四模板全覆盖
EVIDENCE_TIER=静态文档 + 当前源码；官方链接重定向事实无法在本会话亲验（见 §5）
```

已知阻断全部关闭，只剩未验证项，按 review standard 给出 GO_WITH_UNVERIFIED_UI。

这个结论不授权实施，以下三项仍需各自完成：

- Dexter 看图；
- 在 CP-02 之前，于获得实施授权后把 TR-09 例外写进规范正本；
- 将来的实施授权本身。

## 2 · 八项关闭表（独立核验）

| 原项 | 判定 | 依据（当前行号） |
|---|---|---|
| S-1 APK 身份绑定 | CLOSED | 详设 L171：selection/previous/candidate 都绑定 `{applicationId, versionCode, embedded publicationId}`；冷启动 beginBoot 比对后作废资格、保留诊断，改为选择 embedded；旧 candidate 的 boot/deadline/confirmation 一并失效；身份读不回时不批准 HOT。<br>L163：readFacts 暴露 `APK_CHANGED_SELECTION_RESET`；confirmBoot 绑定 installedApkIdentity。<br>L198、L206、L209：同 runtime 的 FULL 与外部更高 APK 都会复位；旧 APK 的 token 不能确认新 APK；“显式 embedded 复位”与“隐式 fallback”分开处理。<br>§11a L330、L334 两个反例齐备；计划 L61 同步 |
| S-2 ENDED_NOT_INSTALLED | CLOSED | 详设 L190、L219、L232、L234：只有在读回成功、证明本 action 的 session 已消失且未安装时，才回到 WAITING_USER，并以新 action/session 邀请同一工件；先 flush 新 actionId，旧 action 不再 commit，旧回调不覆盖新 action。session 仍存在却无法判定，或查询本身失败，都保持 UNKNOWN，查询失败不当作空集合。<br>BUSY_UNKNOWN 的出口见 L216、L235：事件驱动读回，不轮询，不删除也不认领未知 session。<br>依然没有手工重试。§11a L331、L334 及 IA L34、L47、L56 一致 |
| S-3 embedded 走 asset | CLOSED | 详设 L141、L148、L150、L209：embedded 用 `assets://` 加 res，HOT 和文件型恢复用 file 根；获准的 embedded 恢复仍走 asset；缺 HOT 时不隐式退回默认 assets。publicationId 取自构建写入签名 APK 的 metadata。<br>F-LOAD 分两条路径证明 HBC、图片、字体离线可用（L150、L333；附件 L47） |
| N-1 TR-09 | CLOSED | 详设 L16、L168、L268、L345，计划 L15、L41：已批准、待同步；触发点只有取消激活，源码锚点为 `terminalDataClientActor.ts:198-199`，三个调用点 L1316、L1325、L1907 都经同一函数。角色切换只是 flush 加 reload；本轮未改正本 |
| N-2 Web fixture | CLOSED | 详设 L170，计划 L49：生产构建用 unavailable UpdatePort，fixture 只在 automation-enabled Web 测试构建中显式注入；production red 生效；缺 native 时不自动切 mock |
| N-3 窄例外 | CLOSED | 详设 L82、L283，计划 L88，UI L142、L58：安装、来源设置、原生失败文本三类，失败文本只读；React 节点仍走 agent。与 automation 需求 R-10（`…automation-agent-formal-requirements-claude.md:271`）一致 |
| N-4 RN 链接 | CLOSED（重定向事实 UNVERIFIED） | 附件 L35 已改为 `facebook/react-native` 的 v0.86.3 精确 tag，并补充同一 tag 的 AssetSourceResolver。作者称该链接重定向到 `react/react-native`，本会话无法联网核实；无论如何，链接已是可核实的精确 tag |
| N-5 F-LOAD 探针 | CLOSED | 详设 L96，计划 L42：可选，需单独授权；不进入产品代码，用后移除；不写产品 selection 或任务，不构成第二条 HOT 路径，也不替代 CP-03。本轮 NOT_RUN |

## 3 · 方案合理性

每一项修订都是删减或精确化，没有新增机制：

- **S-1**：只在已有的三类原生记录上增加安装身份。我考虑过只比较 runtime 的方案，它挡不住同 runtime 的 FULL，所以“安装身份”是最小且充分的判据。
- **S-2**：只把已有 readback 的一种结果显式写出。我考虑过“超时后转失败”的方案，它会违背 R-10 的“不因慢而失败”，所以现方案更贴合需求。
- **S-3**：删掉了复制步骤，正常启动回到 RN 默认路径，改动面变小。

CP 顺序、6b、整体验收、13c 之间没有环。可选探针排在 CP-02 之前，不改变 CP 的出口。

UI 方面三个面没有变化；ENDED_NOT_INSTALLED 只影响等待语义，用户看到的仍是同一个系统安装面，没有新增操作。

## 4 · Findings（均为 N，不阻断）

### N-a 打包门应核验 APK 中实际的内嵌 bundle 字节，不能只读 metadata

- **位置**：详设 L141、L273（“打包门读 APK 真实字段与内嵌 publication”）；计划 CP-01 第 2 步（L30）。
- **推论**：S-3 修订后，embedded 的身份完全来自构建时写入的 metadata。如果 APK 中的 `index.android.bundle` 实际来自 RN Gradle 插件的另一次 Metro 打包，而不是 HOT 所用的那份 compiled 发布树，metadata 就会声称一个与实际字节不符的 publicationId。这样一来：
  - R-01 的“同版本内容身份比较”会误判成“已达到”，从而跳过 HOT；
  - 或者把本来相同的发布判为冲突。
- **最小修正**：在 CP-01 打包门中加一条红例：从签名 APK 解出 embedded bundle，其 SHA-256 必须等于发布树中入口文件的摘要；资源至少核对文件清单与 res 名称的映射。res 中的 drawable 经 AAPT 转换后无法比较字节，这一点应写明不比较的理由。
- **需 Dexter 裁决**：否。

### N-b 旧 API 上“自有 session 仍存在但不可判定”可能长期保持 UNKNOWN，需在目标 API 决定中写明

- **位置**：详设 L190、L216、L219、L235；附件 L37（静态 min24）。
- **推论**：设计只有在“平台 API 能明确证明未 commit”时才允许继续使用同一 session。如果实施时依赖的是 `SessionInfo.isCommitted()` 这类较新 API，那么在低于其 API 级别的设备上，“COMMITTING 已写入、commit 前崩溃”留下的未提交自有 session 将无法判定。该 session 只会在系统回收后消失（回收周期为外部事实，本会话 UNVERIFIED），在此之前任务一直停在 UNKNOWN。具体 API 级别同样待按第三方规范在官方文档中核实。
- **最小修正**：在 OPEN-NATIVE 的“目标 API”决定中明确二选一：
  - 把 FULL 的最低 API 定为能判定 commit 状态的级别；
  - 或写明在更低 API 上“UNKNOWN 直到系统回收”是被接受的行为，并在 `update.interruption` 中加入该 API 分支的期望。

  不需要新增机制。
- **需 Dexter 裁决**：目标 API 属于现有 OPEN-NATIVE 前提，可随实施授权一并确认。

### N-c retain 机制本身不区分 reset 原因，例外正文需要写明这一事实及新增触发点时的复核义务

- **位置**：详设 L168、L345。
- **仓内事实**：`state/src/foundations/createStateRuntime.ts:80-84` 按 slice 的 `resetIntent` 保留数据，不读 reset 原因。当前全仓只有 `terminalDataClientActor.ts:199` 一处调用 `requestApplicationReset`。
- **推论**：“只覆盖取消激活”今天之所以成立，是因为根级 reset 只有这一个调用点，而不是机制按原因过滤。将来若新增别的 `requestApplicationReset` 调用，terminal-update 的数据会被静默保留，超出 Dexter 批准的范围。
- **最小修正**：TR-09 例外正文与详设 §12 写明两点：
  - retain 按 slice 生效，当前唯一根级触发点是取消激活；
  - 新增任何 `requestApplicationReset` 调用点时，必须重新评审此例外。

  可以在已计划的 focused/red 中加一条简单断言：根级 reset 调用点集合仍等于 {TDC 取消激活}。这是对现有调用点的单点检查，不是语义门；如果判断其维护成本不值，也可以只写文字义务。
- **需 Dexter 裁决**：否，只是让已批准范围的表述保持诚实。

## 5 · 已核实 / 未验证

已核实（静态）：

- `dispatchOfflineReset` 位于 `terminalDataClientActor.ts:198-199`，调用点在 L1316、L1325、L1907；全仓 `requestApplicationReset(` 生产调用只有这一处。
- Expo 的 `jsBundleLoader` 支持 `assets://` 与 file 两条分支，`AssetSourceResolver` 区分文件路径与 res，两者与附件 §4 一致（上一轮已读 node_modules 源码）。
- 六份工件中，ENDED_NOT_INSTALLED、APK_CHANGED_SELECTION_RESET、窄例外三类、TR-09 已批准待同步这几处表述，在详设、计划、Journey、IA、UI 之间一致。Journey L13 仍为 BLOCKED_FOR_DEXTER_DECISION，指的是企业签名、设备、API 与执行授权这一外部前提，不是 TR-09。

未验证（L3_UNVERIFIED，用产品负责人能决策的话说）：

1. 三个面（系统安装/设置、启动加载、原生失败文本）的线框都没看过，状态 UNSET。
2. APK 换了之后旧热更新是否真的被作废、首启是否跑的是新内嵌 JS，在设备上没跑过。
3. 安装会话消失、或者忙碌之后能否重新邀请安装，在设备上没跑过。
4. 内嵌（asset）与热更新（file）两条路径下图片、字体能否离线显示，没验证。
5. 启动期限、旧 boot 迟到确认、一次恢复、数据兼容、各项预算，都没跑过。
6. 企业签名、目标 API、安装资格，以及 Hermes、ZIP 依赖的实际解析，都还是 OPEN。
7. TR-09 例外正文还没写进规范，要等实施授权下的 CP-02 之前完成。
8. automation 目前没有 update phase，可选的 F-LOAD 探针也没运行，状态 NOT_RUN。
9. 附件中 `facebook/react-native` 链接重定向到 `react/react-native` 这一说法，本会话无法联网核实。

所有新能力、运行与 cleanup 均 NOT_RUN。

## 6 · 处置建议

三项 N 可以在实施授权前由作者顺手补上，也可以写入实施授权话术的前置条件。N-a 与 N-c 都很小；N-b 随 OPEN-NATIVE 的目标 API 决定一起处理即可。本包的设计静态评审可以就此收口，后续进入 Dexter 看图与实施授权。
