# TER 更新需求与 A/B/C 划分 · 独立对抗复评 R1

## 0. 对象、授权与原始结论

Dexter 本次原话：“请再次对需求文档进行对抗式review，对其完整性、合理性、可达性进行验证和优化”。前次实质范围变更原话：“这个需求内容非常多而且前后有很多依赖，请仔细分析需求的依赖关系，后续我希望分成阶段A、B、C三个阶段来依次完成详设和实施，请你在需求文档中完成三个划分并充分证明其合理性”。

本次审查当前完整正式需求，包含新增 A/B/C 依赖、R/V 子断言分配和阶段出口。旧正式需求 cycle 已关闭；本次新范围的 cycle 不将旧 R2 GO 扩展到当前字节，也不借局部改名重开旧 cycle。仅授权静态需求 review 和成立问题的最小文档优化；无源码、依赖、生成、构建、测试、verify、动态环境或联系 Codex 的授权。

原始独立结论由 fresh 子 agent `/root/update_staged_requirements_r1` 返回，主 agent 归档，不代写 verdict：**需求规格 GO；按未验证 UI 规则标记 GO_WITH_UNVERIFIED_UI，M/S/N=0/0/0。**同轮输入清单补核后结论未变，见 §7。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UPDATE_STAGED_REQUIREMENTS_ABC_2026-10-05
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-05-ter-version-and-js-apk-update-staged-requirements-review-r1-input-checklist-claude.md
REQUIREMENTS_VERDICT=GO
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
```

正式输入：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，SHA-256 `495243a73527b09b4d4ca36918419502262295a8c4ff3c5666759671e3030dd0`。原始讨论：`doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`，SHA-256 `cbbff3c584c53dce3447227244e610eb0380d3dc2fe0cf5b63d639885ebba3d3`。审查结束及主 agent 归档前复算一致。以下需求行号均属于该正式输入 SHA。

## 1. 方案合理性：问题、较小替代与成本

本专项解决的是合法工件供给、固定规则到真实 APK/JS 更新、坏 HOT 的有限启动保护与实际主机版本可见，不能以“打出了 ZIP”替代“设备确实运行目标”。A 首先消除决定工件格式的原生加载/资源/安装风险；B 建设供给与观察；C 组合自动策略和主副机行为。阶段按可验收能力而非目录切分，每阶段都有真实结果，并保留不可拆的失败闭包。

较小替代已经存在于当前要求：A 用受管固定输入替代尚未建设的 CBS 规则供给，复用最终 owner、真实下载和 UpdatePort；B 不自动触发未装配的 C；C 增加调度而不重新实现任务、下载、安装或恢复器。没有必要提前建设第二 CBS、用户手工更新页、跨规则 DAG、双机协调提交、全量备份或通用恢复框架。

A 同时做 FULL/HOT 执行与最小启动保护，成本高于“只有打包脚本”，但直接消除 HOT 无法增加原生能力、loader 决定资源格式、跨启动任务丢失的已知返工风险。保护只核本次启动，不扩展到所有业务 BUG。未发现需要本轮强制修改的更小等效方案。

## 2. 证伪清单与核验结果

没有可成立的 M/S/N finding。以下是核验反例，不虚构为 finding 计数；没有新增需 Dexter 产品裁决的问题。

| 核验对象与位置 | 触发反例 | 结论与最小边界 |
| --- | --- | --- |
| A 真实验收，§20.3，344–362 | 没有 B 的规则库，A 只给内存对象、假安装结果或直接改版本 selector | A fixture 只替代上游规则供给；真实工件、可信文件 HTTP、下载、校验、持久化、UpdatePort 和 Android 不能替代。fixture 身份与授权须在 A 计划落地，无需提前新增生产入口。 |
| A 固定执行核，351–354；R-09/10，149–165 | FULL 安装后进程重启，C 未实现，无法续接同一 HOT，或重复提交安装 | 首次落盘、boot 占用、FULL→HOT 续接、回读、失败身份、flush 和清理已归 A；不能推迟到 C。保留 N/M 字段不冒称调度已实现。 |
| A→B→C 依赖，§20.2～20.6，302–398 | A 等 B/C 才可验收；B 等 C 才能报告真实更新 | 未发现反向前置。B 可用 A 同一执行核产生真实更新事实；主机接收完整快照不自动调用 port。B 不冒称已经自动升级。 |
| 当前能力与 B 前置，§16、§20.2/20.4，213–228、302–342、364–377 | 旧 marker、reload、asset 或目录存在被当作已交付更新器 | 当前表格与 owning source 分开；B 必须真实扩展工件、规则 topic/HTTP 与版本报告。TDP 当前交付状态须按 B 准入重新核验。 |
| 配对与降级，R-06，96–119；§20.7，400–420 | 为 HOT 降 APK；FULL-only 把旧 JS 留为最终目标；runtime 不匹配暗选旧规则 | 当前要求拒绝这些路径。必要 FULL 中间 JS 可较旧，但固定兼容 HOT 的最终版本不能主动降低原始本机 JS。无需 fleet inventory 或副机上报。 |
| 每 boot 一规则与失败释放，R-09/10；V-14/15，441–442 | 失败永久占用所有后继启动，或释放后同 boot 自动再次加载坏包 | 固定任务与失败身份在 A；候选/新规则调度在 C。等待/未知不重派；失败释放后继启动但本 boot 不执行第二条，广播/启停不清坏工件事实。 |
| HOT 保护，R-14，195–204；A，352–360 | 失败页 hideSplash 被当成功；同 Activity 沿用旧 boot 确认；坏 JS timer 自救 | 原生期限从实际目标加载开始；PRIMARY 成功、必要 hydration 与 identity 一起确认；迟到隔离；仅兼容且数据可读的上一成功目标可有限恢复，不回退 APK。 |
| 权限/来源/数据，R-03/05/08/12/14；B/C，366–390 | ZIP 自报摘要自证可信；Promise fulfilled 代替落盘；投影覆盖副机本机事实 | 可信目标身份、权限失效拒绝、实际 flush 结果、有限可读恢复和 isolated 本机事实均有约束；不需要第二 store、常态轮询或恢复队列。 |
| 执行面，§17，230–267；§20.8，422–459 | A fixture 冒充 Android；B selector 变化冒充自动执行；C 汇总旧 GO 冒充全链 | 最低执行面保持：非 adapter 先 Web，再同清单设备；A 真实 application；B 两后台与 CBS/TDS/TDC/PG；C 必须真实后台规则→主副更新→主机报告。全部当前 NOT_RUN。 |
| 现在是否需写完三阶段详设，§18、§20.6/20.9，269–275、394–398、461–476 | loader 未证明即冻结 B/C 全 API/DB/页面/七方法端口 | 当前只稳定必要交接事实；完整 Journey、IA、UI 与 CP 是各阶段后续义务。未缺本轮应有的需求判据。 |

## 3. 完整性与同根扫描

R-01～R-15 全部逐条与 §20.7 对账，未发现子条款被阶段划分删除。V-01～V-30 与 §20.8 对账，首次完整闭合阶段唯一：

```text
A={01,02,16,21,22,23,24,25,26}，9项
B={03,04,05,06,11,28,29}，7项
C={07,08,09,10,12,13,14,15,17,18,19,20,27,30}，14项
```

并集恰为 01～30。部分子断言可以先完成，原场景必须到其全部最低执行面具备时才可完整记 PASS；这不是新增三个重复验收分母。

已扫描规则固定/续接/等待/失败/释放的全部同根条款；版本/配对/禁止主动降级全部条款；来源/owner/主副隔离全部条款；验收执行面和证据复用全部条款。两 application 均在范围内，剩余需求/场景遗漏 0。A 的 V-16 仍受 Web→设备约束；A 的 V-21 双屏证明不能冒充 C 双机独立更新。

## 4. 静态事实与未验证项

| 档位 | 本轮取得或未取得 |
| --- | --- |
| 静态已核实 | 当前源码能力边界、需求及原话一致性、R/V 归属、依赖方向、授权、失败闭包、owner 与本机事实隔离。 |
| 测试/动态已证明 | 无本轮新增功能证明；没有执行生成、编译、测试、verify、DEV、设备或受管 runner；不读取 .runtime。 |
| 用户可见未验证 | 两后台上传/规则/权限反馈、N 提醒、M 判闲、installer 等待/确认、双屏/双机真实操作。 |
| A 工程 OPEN | 目标 Android/API/企业分发/签名安装条件，实际 Expo/RN/Hermes 解析与官方依据，精确本地 loader/资源映射，T、有限预算与恢复可读字段。 |
| B/C 工程 OPEN | TDP 扩展的当前交付与入口、真实规则/报告/权限部署、主副投影与自动执行组合、全部真实验收及 cleanup。 |

当前 SOURCE_ONLY review 可以接受需求层的阶段可达性，不证明工程 OPEN 已解决或估算工期已可靠。需求 §16、A 详设准入和 B/C 准入已为这些项提供位置；不能靠本轮 GO 删除它们。

## 5. 模板覆盖

四份模板全文逐节已读，具体表见同轮 input checklist §5。纯需求阶段不虚构 Journey ID、IA screen、线框、testId、HTTP operation、migration、seed 或实施 CP。该 N/A 仅表示本轮不交付相应完整工件，不豁免各阶段后续模板义务。

动作 1-B 的产出包括用户目标/owner/失败应然事实、A/B/C 与 R/V 交叉表、工程阈值尚 OPEN 的清单以及四模板逐节适用性；不是零提取伪通过。没有本轮适用而缺失的模板槽位或需求判据。

## 6. 主 agent 核验与优化处置（不代写 verdict）

收到独立结论后，主 agent 重开正式需求、讨论稿裁决、HOT 默认端口、原生 reload/首屏链、异步持久化、TDC 订阅与 asset 内容约束；做只读 R/V 列表核对和 SHA 复算。没有确认新增需求缺陷，也没有需改动的产品歧义。

因此保留当前最小方案和正式需求字节，不为“做过 review”增补恢复框架、提前生成三阶段详设或改写已经闭合的阶段表。优化处置为维持已有范围收敛，并将工程未知留在准确准入位置。本轮只有两份评审归档新增，无源码或规范改动；没有必要启动第二轮，更不重开旧 cycle。

## 7. 输入清单勘误与独立性披露

首份 reviewer 返回清单将三个 native 文件写成了不存在的 `android/app/src/main/java/com/catering/terminal/` 路径。主 agent 只读存在性核验发现后，要求同轮补核。reviewer 完整重读真实路径下的 AppControl、Network、NativeLoadingRegistry（37/200/418 行），核对报告所有仓内输入路径，修正后无 MISSING；输入 SHA 不变，结论仍 GO_WITH_UNVERIFIED_UI、0/0/0。

reviewer 的压缩上下文只有先前读取摘要，无法回放压缩前工具调用来证明当时精确路径，因此**撤回不存在路径的已读声明，不武断定性仅为转录错误**。最终清单以本次真实路径完整补读为可核对依据；旧返回路径作为本节勘误保留，不能直接复制为“已经读取”的证明。

补核文件 SHA-256 由 reviewer 返回，主 agent 对真实文件复算一致：

| 文件（同一真实 native 目录） | 完整补读 | SHA-256 |
| --- | --- | --- |
| TerminalAppControlModule.kt | 1～37 | `5eb6e847801fa772e65165df8b11db984003230bb6ccfc8305c35fe9a827d940` |
| TerminalNetworkModule.kt | 1～200 | `454e59039fe3ea4e624b6cb8e9c2f5c66caead2b75d163c0b324c802c75c63ad` |
| TerminalNativeLoadingRegistry.kt | 1～418 | `1662b03aa72b5738651ead039fd7fc042507ed73980e4d5cd1460dadabecf54b` |

通用失败模式是来源清单在转录/上下文压缩时漂移。有限适用范围为本轮 reviewer input 归档；最小防再犯 checklist：逐项验证路径存在，区分全文和片段；无法回放的旧读取声明不得靠摘要补造；缺失来源回读真实 owning source 后再判断结论。本轮已完成该检查，不新增 hook、台账或伪语义门。

本 reviewer 为 fork_turns=none 的 fresh 上下文，未读当前作者 review/intake，独立结论先形成。但全局 memory quick pass 意外暴露旧约 288 行正式需求 cycle 的历史状态与旧结论，不能宣称绝对未见历史信息。reviewer 报告当时 registry 读取范围为 1–35；具体旧子行号不能映射为漂移后当前内容，已撤回这种映射。旧 rollout 仅导航暴露，未打开。未以旧 verdict/finding 证明新增 A/B/C 当前 SHA 正确；此边界如实披露，不伪造纯盲审。

```text
blindReviewDeclaration=先从当前原话、需求、规范及真实来源独立形成结论；未读当前作者review/intake；旧周期registry导航暴露如上，不作为证据
authorMaterialReadAfterIndependentVerdict=NOT_READ（本轮没有实际对照作者intake）
BLIND_BOUNDARY=NO_CURRENT_AUTHOR_REVIEW_OR_INTAKE_READ; HISTORICAL_REGISTRY_STATUS_EXPOSED; NO_HISTORICAL_VERDICT_OR_FINDING_REUSED
```

## 8. 固定结论块与结束边界

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（需求/依赖/源码边界静态核验；新增工程OPEN）
L2_USER_VISIBLE=NOT_RUN（用户任务及规格合理性已静态审视；实际UI未验证）
L3_UNVERIFIED=全部新增能力及V-01～V-30；精确loader/资源/native版本/安装/预算/恢复字段；CBS/TDP/主副组合；详见§4
SAME_ROOT_SCAN=R-01～15、V-01～30、两application及版本/任务/失败/owner/执行面条款全部核对，见§2～3
DESIGN_GAPS=NONE_WITHIN_REQUIREMENTS_STAGE
TEMPLATE_COVERAGE=四模板逐节，有或NOT_APPLICABLE，见input checklist §5
EVIDENCE_TIER=SOURCE_ONLY_STATIC_REVIEW；NEW_FUNCTION_DYNAMIC=NOT_RUN
BUSINESS_CLEANUP=NOT_APPLICABLE_TO_READ_ONLY_REVIEW
```

reviewer 同轮补核后返回完成状态，未写文件、未读 .runtime、未执行动态或资源操作；等待 timeout 仅触发读取状态，未作为异常中断理由。主 agent 已关闭本次批准的只读核查与归档项，无动态 business/cleanup 可声称 PASS。结论仅接受当前需求规格；后续 A/B/C 详设、实施及各类运行仍由 Dexter 另行明确指派。
