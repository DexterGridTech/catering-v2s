# 前后台重点代码结构优化 · 当前源码适用性自审

日期：2026-10-14。Dexter 指派：结合当前代码自审完整设计包，确认问题立即调整，设计合理后准备转交 Codex 的实施授权话术。本次仅修改三份设计文档与本记录；正式需求、生产源码、测试、脚本、规范、记忆、依赖及历史审查报告未修改。未运行生成、编译、测试、verify、DEV、Web、L2、设备、reset/seed、UAT 或部署。

## 1 · 范围与独立性

本次为 Dexter 直接授权的补充静态自审，不重开已经收口的 `BACKEND_FRONTEND_STRUCTURE_ROUTE_A_20261014`，不增加其第三轮，也不改写历史 verdict。主 agent 重读原分析稿、R01–17/V01–18、完整设计包、模板、规范、当前 owning source；两名 fresh 只读子 agent（`fork_turns=none`）分别核后端/生成链与前端/foundation/验证接缝，先独立形成 findings，再由主 agent 核源、找反例、作最小文档修订。子 agent 无文件写入；最终汇总与写入由主 agent 完成。

- `/root/structure_backend_audit`：后端与生成链静态适用性 `GO_WITH_UNVERIFIED_UI，0M/0S/0N`。
- `/root/structure_frontend_audit`：修订前分域 `NO-GO，0M/1S/2N`；主 agent 核源修订后，同一授权自审的只读差量确认三项设计闭合，`GO_WITH_UNVERIFIED_UI，0M/0S/0N`。修订前结论保留，不能称旧字节已通过。

不把上述分域结论称为实现、运行或 T1 整批证明。本报告最终结论是主 agent 汇总后的当前设计适用性自审，独立性和范围如上披露。

## 2 · 输入与当前输出字节

路径均从 `catering-v2s` 仓根展开。

| 文件 | 本次修订后 SHA-256 |
|---|---|
| `doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`（只读） | `a22ecff163d12b6626f67a1e3a0b28ac3e097092e97cebb68213ab03aff8f193` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md` | `a44024e51eba0b8404ad9a6364f80036825d4862a4fdce666320fbf0fa618193` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md` | `3b3a7b2012d85d625aaf463e791362ed0500268edd0b24ef0e494f0e11a6e4f9` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md` | `9a5a56e332c76d7c9ff8bbd7a5cf1bb4aa0bf4235835219ab6c995b37e3d7039` |

修订前详设/计划/附件分别为 `7941a59b2840e049d4a4937bf08a34e73c83076a8334d88b47ae12e708739266`、`15ff1bec29c84ef0c1ed2b2cd29c6d3f5bc5f4a970a17e1eb35115ea00bd747e`、`ddaf55fa2369713f660d1c68f537bd1ccfcdec18f08fc88ecf3b12c5bd3d82d2`。历史报告中的其他 SHA 仍限于原读取字节。

## 3 · Finding intake 与最小修订

| 项 | 核源事实与影响 | 处置/当前落点 | 状态与裁决 |
|---|---|---|---|
| S-01 扩展公开边界漏列表调用者 | R09 覆盖 extension-fields 整个跨 feature 消费边界。`apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx:43`、`store-management/ui/StoreManagementPage.tsx:40`、`contract-management/ui/ContractManagementPage.tsx:42` 均 deep import `extension-fields/model/extensionList` 的两个函数。仅迁十 Drawer 会留下同族内部泄漏 | CP04 同一个 index 具名导出现 `extensionListAndSearchColumns/extensionQueryValues`，三 Page 只改引用；现 `extensionList.tsx` 及查询/排序/owner保持。详设§8.4:188、V08:261；计划CP04:63/66；附件§1:30/44与现 extensionList.test.ts/边界red | `CONFIRMED / CLOSED_DESIGN_ONLY`。不需 Dexter 产品裁决，不新增能力 |
| N-01 路线 A 档位残留 | 正文总方案为三隔离 L2＋四 W，但详设§3/4/7仍有更新/远控“L2分页/切scope”的旧措辞，可能引导实施者恢复已删除的隔离链 | 详设:85/87/88/111/112/145、计划CP06:86，统一为门店/合同 L2、更新/远控 F/W、历史分页 F/W_CONTROLLED_UI；不新增动态范围切换 | `CONFIRMED / CLOSED_DESIGN_ONLY`。Dexter 已有 A 裁决，无需新裁决 |
| N-02 并行关闭的拒绝观察时点 | `RemoteControlWorkspace.tsx:361–380` 当前先启动 endRequest，再 await disconnect，最后才观察 endRequest。普通 HTTP 拒绝早于 disconnect 完成时，可能出现未处理拒绝窗口。旧设计已要求 end/cleanup 独立失败，仅需明确观察时点 | 详设§8.5:197、计划CP05:79、附件remote oracle:96：两 Promise 启动即接拒绝观察，既定F补end先拒绝交错；保留并行精确资源清理，不串行等HTTP成功，不建队列/恢复框架 | 源码反例 `CONFIRMED`；原设计要求覆盖但细节未写清 `PARTIALLY_CONFIRMED / CLOSED_DESIGN_ONLY`。无需产品裁决 |

更小替代比较：S01 只增加两个已有函数的窄导出和三条 import 迁移，比重写列表/新增共享模型小；N01 仅修档位，不新增 suite；N02 补现 Promise 处理与既定测试交错，比新 session 管理器或关闭队列小。

同根扫描：两 App 的生产 `extension-fields/` 深引用当前仅上述三条，其余该形态已全部核清；原三组十一状态/gate/channel引用、remote宿主及十Drawer/转导出仍分别闭合，内部 orderedExtensionFields 不增加公开面。路线 A 核横切机制、CP表、声明消费表、V09–11/V14、计划CP05–06、附件§4–5，不恢复更新/远控隔离L2。远控核现 end、disconnect、effect cleanup、restart 及 A→B 迟到反例，保持各自捕获资源与最终UI身份复核。

## 4 · 当前源码为何仍需本批整改

| 问题族 | 当前真实来源 | 自审判断 |
|---|---|---|
| topic第二声明 | TDS `TerminalConnectionFrameCodec.java:24–36/288–290`；`TerminalConnectionProtocol.java:244–253`已有不可变集合加载能力 | 仍待归一，用现loader即可，binding/SQL分类保留 |
| remote运行enum第二声明 | generator:10–13/161–178/222–238仍双目标同renderer；Web Workspace:99–129手写parser | 原additive生成＋Web消费仍适用；不改TER手写消费者 |
| asset流式循环 | `PlatformAssetService.java:201–250/1389–1442`；stage:480–497/522–533 | 一个owner内private helper足够，内容wrapper、IO/事务顺序保持 |
| catalog纯规则与详情 | `CatalogItemService.java:4443–4454/2622–2783/4587–4990`；Workbench:1323–1334 | 仍需单源制作差异及有限纯提取，实际纯闭包不含JDBC；sourceScopeRef与原公开构造/事务保护正确 |
| menu隐藏名单 | `OperationsApp.tsx:69/143–153`；pageRegistry实际注册 | icon仍过滤成员，registration责任调整有效 |
| extension真实对象 | `ExtensionSubmissionWireMapper.java:15–49`；seed helper:593–599/777–792/955；十Drawer及上述三Page | 对象SET/CLEAR既有；数组/cast/私有引用仍待退役，seed与fixture必须同CP迁移 |
| 更新/远控资源分散 | Page现六读取资源及start/end；Workspace:220–221/735持第二session；foundation现async/cursor/Drawer | 四具名hook、受控session及现guard是有限可实施方案，无需新基础设施 |
| 唯一自动化/测试登记 | 当前 browser-l2-runtime 三既有suite、现update/remote Web入口；test-health仍漏附件列的五文件 | CP06只扩原L2能力和登记，旧runner不恢复；五文件写前重新核现集合，不能覆盖在途追加 |

H focused 支持 scenario id/annotation operation，现 catalog、asset、extension、terminal-update acceptance 已有登记。没有必须另造 runner/provider 的缺口。首次 L2 的当前完整 seed dry-run、artifact源与真正seed分别证明不同事项，不互相升级。最终全量 backend-acceptance 是 R-READ-07/R17 的明确义务，保留到全部改码之后；不默认全仓verify或设备矩阵。

## 5 · 模板覆盖、未验证与结论

| 模板 | 逐节覆盖 |
|---|---|
| Journey | 本批不新增产品Journey；复用详设§0点名的更新/远控、组织/合同、catalog、销售菜单正本。新流程、分支与完成块为NOT_APPLICABLE；既有交互仍需实施保持 |
| IA | 不新增页面/Tab/控件/权限；原页面归属、scope、Drawer、查询/分页在原IA＋详设§3/5/8和附件§4承接，新IA逐屏设计NOT_APPLICABLE |
| UI interaction | 原线框/文案/动作保持；本批TestId动作与控制面见§3a/附件§4–5；新UI设计NOT_APPLICABLE；优化后真实行为未验证 |
| implementation design | §0/1/2/3/3a/4/5/6/7/8/9/9a/9b/10/10b/11/11a/12/13/13b/13c/14均有当前落点；seed子项由10b.1–4及10b.5–6具名承接；无新DB迁移，§10为具因N/A。三修订已同步计划/附件 |

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取＋当前源码适用性核对
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0（当前剩余项；修订前分域0/1/2保留）
L1_ENGINEERING=PASS（仅静态设计适用性）
L2_USER_VISIBLE=PASS（应然事实沿原批准交互；不是运行PASS）
L3_UNVERIFIED=优化后菜单、Page/Drawer/cursor/dirty、远控start/restart/end/焦点/Room释放、扩展对象HTTP与真实seed提交；F/H/L2/W及动态cleanup均NOT_RUN
SAME_ROOT_SCAN=见§3–4，三扩展列表、十一原窄引用、十Drawer/十四operation、六读取资源、双目标生成、两个App与三L2/四W接缝
DESIGN_GAPS=无新增未决产品缺口
TEMPLATE_COVERAGE=见本节逐模板/详设逐节表
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_SELF_AUDIT_WITH_FRESH_READ_ONLY_SUPPORT
IMPLEMENTATION_AUTHORITY=false（本次实际动作；后续由Dexter明确授权）
```

未新增依赖或改变媒体SDK API。实际Java解析、第三方新增透传参数依据、环境资源及未来运行前提仍按设计具体OPEN处理，不以当前NOT_RUN要求先做本轮未授权的运行。方案继续满足“职责清楚、既有能力复用、当前90%主流程”的目标，未增加通用框架或极端输入专项。静态可进入后续获授权实施；交付仍需按计划完成，不把此结论当实施PASS。
