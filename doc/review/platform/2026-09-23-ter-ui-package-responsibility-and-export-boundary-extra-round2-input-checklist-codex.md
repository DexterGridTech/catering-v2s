# TER UI 公共导出边界新增授权轮次 2 输入清单

REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923_DEXTER_EXTRA_TWO_ROUNDS
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerAgentId=01a0cc37-48d1-7e30-978f-56762d1ee3c1
CHECKLIST_STATUS=COMPLETE_WITH_APPLICABILITY_CLASSIFICATION

本清单由主 agent 原样转写独立 reviewer 在盲审 verdict 后补齐的逐项 path、64 位 SHA-256 与读取状态；主 agent 未代替 reviewer 判定已读。Roadmap 只要求授权字段，源码只要求本题 owning source；不适用的 sourceRef 按主题边界列明。六维 recall 的实际命令与 corpus 结论见末段。

## 入口、记忆、上游与决策

```text
READ_FULL  AGENTS.md  6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679
READ_FULL  PLATFORM-BLUEPRINT.md  19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396
READ_FULL  CLAUDE.md  f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a
READ_FULL  doc/platform/README.md  b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80
READ_FULL  doc/platform/roadmap-program-registry.json  f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8
READ_RELEVANT_SECTION  doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md  a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3
READ_FULL  scripts/README.md  06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8
READ_FULL  project-memory/index.md  2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029
READ_FULL  project-memory/decisions/deterministic-context-only.md  c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263
READ_FULL  project-memory/kernel/01-workspace-and-roadmap.md  f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63
READ_FULL  project-memory/kernel/02-service-shape-and-owner.md  45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032
READ_FULL  project-memory/kernel/03-transaction-data-and-dependencies.md  f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44
READ_FULL  project-memory/kernel/04-contract-consumer-and-admin.md  4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc
READ_FULL  project-memory/kernel/05-evidence-runtime-and-git.md  254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8
READ_FULL  project-memory/kernel/06-heritage-and-change.md  5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c
READ_FULL  project-memory/decisions/confirmed-business-language-corpus.md  335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d
READ_FULL  project-memory/operations/business-corpus-adoption-and-read-policy.md  d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9
READ_FULL  project-memory/operations/business-corpus-parked-domain-intake.md  739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e
READ_FULL  project-memory/pitfalls/check-repo-before-authoring.md  17f7f1dced088689ecfe20b4de2cded1b40238383ef61580d49b730663c1544c
READ_FULL  project-memory/pitfalls/criterion-degraded-into-list.md  f07ba6ef4c4b375382ca540f8fa16e906dd86d68a4019dfaa36092280b46b6e3
READ_FULL  project-memory/pitfalls/analysis-ruler-and-scope-discipline.md  69f36aa38658c89a733fd2506a6bb21b2a5a36e61ab7aa2016c4f6547022225c
N/A_WITH_REASON  project-memory/practices/drawer-form-lifecycle.md  aa7fe921a450ce4490656aee6132a4fa76aa058a7a51552929766a18a6afb0e4
READ_FULL  project-memory/operations/terminal-coding-standard.md  f4620bf815b0deaa05a017e184d43102aa8a293ae1c7cf22c7fed1549233e47d
READ_FULL  project-memory/decisions/terminal-architecture-and-stack-rulings.md  a73c5120fe102eeab34f2d339ad77d29911ec0434087e74256d9ab8f4f4aac53
N/A_WITH_REASON  project-memory/practices/detail-drawer-action-menu.md  d1d4d22c717203f77de95bff14276c7225a51f2c97a65632720212f2def6da4f
READ_RELEVANT_SECTION  doc/platform/terminal-coding-standard.md  595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03
READ_RELEVANT_SECTION  doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md  fc1344ed2d1974186c81e5035698f8d9ce523376699c24db08fdb70793f8b6a0
READ_RELEVANT_SECTION  doc/review/platform/2026-08-28-newposv1-package-analysis-claude/03-review-discipline-claude.md  6b76c119ff247dbd7a72d7c8e73c4cd6367dddaddd6afa04bab9095de77394b9
READ_RELEVANT_SECTION  doc/platform/foundation-charter.md  f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455
READ_FULL  doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md  eb8772599be4ec7c9c111c074946f0ff22ce7b73c54ba29bc17e72131eb3849b
READ_RELEVANT_SECTION  doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md  ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568
N/A_WITH_REASON  doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md  84037f1c81ae17ce51ee488723f5e230b4fe3f76c16e690c58c96606793e6c69
READ_FULL  doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md  80a82e09d76e3bdb46e36139f93440739f3402440f24b2aadab563024c62002e
READ_FULL  doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md  bb6b02257b1a1413480b7138d943972c6e189a651095eaddc8940684983d489e
READ_FULL  doc/decisions/2026-07-24-v2s-verification-governance.md  6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5
READ_FULL  doc/platform/review-standard.md  6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6
READ_FULL  doc/decisions/templates/implementation-design-template.md  ecd088315feef1048d10ecb699e2939aebbcf72f2fb8aeb926d1a74c5b87d14b
N/A_WITH_REASON  doc/decisions/templates/ia-design-template.md  f93c9edf545fc458fd933a5cba97f31e1272b7ae6e428ae6d6695f0cf92c5c6a
N/A_WITH_REASON  doc/decisions/templates/journey-decision-template.md  66c57c114333d072fab29f17bff9ad40345a6ae1e8ba96de2bf959aa23996da6
N/A_WITH_REASON  doc/decisions/templates/ui-interaction-design-template.md  87e78e6e7db1cf01e6d0bd073d91321b5a604576a2cfdf347544cd70b603d781
READ_FULL  doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md  9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751
READ_FULL  doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md  9fde426ae6a691376d16f32f0c302dbfadaeb31361dba7490c4b76cb6ba20508
READ_FULL  doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md  70c01400cbef108366894778b836daafd27bfaf1f4e3f335962473ad9324da06
READ_RELEVANT_SECTION  doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md  713149f63a154cb3c73c0c7cd46e56830cb9410d85ab3ecf5324ca988e6b438d
READ_RELEVANT_SECTION  doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md  19206962506fe0eca6328512a531863d59ea1e54eaa47e485a73b70742a46a1b
READ_RELEVANT_SECTION  doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md  1d88cf9960863a98a1877acb46403a1af0227b9cf82986b8fd545b6a8e1da60f
READ_RELEVANT_SECTION  doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md  f2f4868ceb291c792b01d23b373914b338cd027cf5c1bcef479fcf7ca5c6d74f
READ_RELEVANT_SECTION  doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md  67558141f0c006e33fc4ea8b5ee8ed6a3da903486c0faa9861853d58bba9d5c6
```

N/A 归因：catalog 商品事实/工作台 IA 与 TER UI package public API 不同领域；Drawer lifecycle/action-menu/admin foundation 不在本批 UI 包、也不改后台页面；carryover manifest 不作为这五包公共导出决定的 owner。IA/Journey/interaction 模板不适用，因为本批不新增屏幕、Journey 或交互工件。Reviewer 仍读取了命中 routed memory 原文，再判断 sourceRef 是否适用。

## 五包源码与双 Android 宿主

```text
READ_FULL  apps/terminal/ui/feature/sample-member-desk/README.md  f21b6ca4b8d4118d094c2c2f57078e7ef48f81b01602f752279ef48bf6f487e2
READ_FULL  apps/terminal/ui/feature/sample-member-desk/package.json  749d7f5e33998bf98d4e2ca3c33b0dfd1cdd5059646a30d5706c9e6b15123f76
READ_FULL  apps/terminal/ui/feature/sample-member-desk/terminal-invariants.json  b0e6d2d44cb207718def10611262158b02bffe4f87720a6d384eb90f648fe77d
READ_FULL  apps/terminal/ui/feature/sample-member-desk/src/index.ts  3460f83a2b4cc8c19fd38918b59445707ea82f379b5e7cd2c41a939c487c6b8a
READ_FULL  apps/terminal/ui/feature/sample-staff-auth/README.md  2b1194953fd864cb0c9e19c80024902f362e6c3d3c7a03e05cd0128dc0023ad1
READ_FULL  apps/terminal/ui/feature/sample-staff-auth/package.json  15209093e2d14829b314a3e5d2b9acc4862e91ba2b22c1a90799332a08fb86d1
READ_FULL  apps/terminal/ui/feature/sample-staff-auth/terminal-invariants.json  5d25554b2c3f62a50129605eba6030269e74d20223d497eef93212384dcf06ec
READ_FULL  apps/terminal/ui/feature/sample-staff-auth/src/index.ts  deb6171dabd7375cc15c91fb31cf3aa29cbc98e0b741e3f31ddd48eb92640d0a
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/README.md  23533d5193390912712566f4f68196f681b1aff3e9f5e117c719a183ffc3837e
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/package.json  fcb527b16b876df4c2619856388f378b57375ccb15993091e4f6cd8f4881d107
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/terminal-invariants.json  922eac9b6361fffda3d367c7a6af4261cb32068864ae70d837b2d82333ff0d5c
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/src/index.ts  6b4be5f57e6e34e12b5cc462015b8303289de4d20b426640fad82c70a57d7a45
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/test/publicSurface.test.ts  4178748053b8aea7b32a5c8ab6558b64073626a8438514bf771d3843bc7b32a8
READ_FULL  apps/terminal/ui/integration/sample-console/README.md  56a9c3a6550533ce2034d8002ec74688b9bf379bf9d91ce41bd98c55e330cda7
READ_FULL  apps/terminal/ui/integration/sample-console/package.json  a58557032d70db06fe9bd34ddde04f23f535b46a6924fbf292d4fdde6b5a0d1c
READ_FULL  apps/terminal/ui/integration/sample-console/terminal-invariants.json  bc423537eafab090dcbba9a92eb1c6dd21ae7851bd02f4298be0abc1e2bec782
READ_FULL  apps/terminal/ui/integration/sample-console/src/index.ts  e242fe6eb9a484d990bb9c014531a9a3a09a40bef6fa88935094dd01250d21b9
READ_FULL  apps/terminal/ui/integration/sample-console/test/publicSurface.test.ts  074453a440c68e03b6df883109dc9f83d0d276cedc16a3b9c646019d54090fbf
READ_FULL  apps/terminal/ui/integration/sample-wallpaper-console/README.md  8735a0d370da94ec678d23c09ca2681315eca510bfc0c2237a0472650d3ee67a
READ_FULL  apps/terminal/ui/integration/sample-wallpaper-console/package.json  d427c2a5b1a768af147f3ae8446121254fbd1557d06cb509890f23a728e8add8
READ_FULL  apps/terminal/ui/integration/sample-wallpaper-console/terminal-invariants.json  8cce9ea79f857645168a4af6d8cf51c8f4569916b003de44659fedb08c62b800
READ_FULL  apps/terminal/ui/integration/sample-wallpaper-console/src/index.ts  4eb48f9dd445675bc52567038395b76564d90dc865df398062b372ac7d128e51
READ_FULL  apps/terminal/ui/integration/sample-wallpaper-console/test/publicSurface.test.ts  b6e897173e0779b8b59a8c90eaf0e912c61e7365c62c157eb24b047aced00a9a
READ_FULL  apps/terminal/assembly/android/sample-terminal/App.tsx  89301e2b14f43ce32f8ffc26d820f0de133f55f4664dc69056614ababf4aecb6
READ_FULL  apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts  bb8a1393a0574836a4c74662ae2748ca7bb162f216c2fee9cdaf5ee70ffa7b13
READ_FULL  apps/terminal/assembly/android/sample-terminal/src/dependencies.ts  e91b6a9ffedac738e27a876ce4260504cc8a6cea7ebf2f75e4eeb1835b3e603b
READ_FULL  apps/terminal/assembly/android/sample-terminal/metro.config.js  3d760f4053ab14a0297c08d85ec03458b33449810d396ae6795c8e53b09f0366
READ_FULL  apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx  e4aa855a230847a376322fbf16ade2fdd1ba77491ffa3a30c00c2df82a1b4660
READ_FULL  apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts  e18a8027535e0b9a9c265a13fb38e77318f4fdc347df015039497007e34db6d0
READ_FULL  apps/terminal/assembly/android/sample-wallpaper-terminal/src/dependencies.ts  e4bb52a35a457a8032bdc3b89f1c9eff5a67202a85b9d8ddb016403057124818
READ_FULL  apps/terminal/assembly/android/sample-wallpaper-terminal/metro.config.js  23d8e03fc6da1c3de8686f0b6c5fb331b60bde0ce9dd32c975cb3a385573e827
READ_FULL  apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberForm.tsx  cd47bdb366f4328936a4ee044b78c60ede379eb7bbeb3f3154d7fc40efec7706
READ_FULL  apps/terminal/ui/feature/sample-member-desk/src/components/mobile/MemberForm.tsx  9a3ca6722048d7155b7dadd97129f42759115bed1fb8165afb7986a4edb47a80
READ_FULL  apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberForm.ts  899b8e1947893a909ef442cdc1e7a493096fa9bb4dcc9d41e0cdcc68fb37545b
READ_FULL  apps/terminal/ui/feature/sample-member-desk/src/foundations/systemFailureDismissal.ts  7c47bfe15524ee50ad76e97513e233cab843a34fac520287bdc7af10456ee82c
READ_FULL  apps/terminal/ui/feature/sample-staff-auth/src/foundations/systemFailureDismissal.ts  98fc43280373021aa6cac36fd746c99946b1a48f67e66f1ce70d8281af61d6b6
READ_FULL  apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/systemFailureDismissal.ts  a8638f36099879efa3a5e6128d6fdb99e729591ff2bd9530033d04770b7a4545
READ_FULL  apps/terminal/ui/base/render/src/foundations/dispatchWithRequestId.ts  43d98681d25b549ba05ce1be0450ce4cd11707542630efc0f9207333cf421549
```

member-desk 与 staff-auth 当前没有 publicSurface test；这是设计要求未来补齐的缺口，不冒充已读文件。Root 导出复算 6+6+16+20+23=71，export-map 路径 5+2=7。

## 独立 verdict 后才读取的作者材料

```text
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-review-claude.md  e13d158185d2c81c3cf8d58387abfd2a0ef70db4209c84f25d3246673bec2bac
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-claude-intake-codex.md  61487519541d11faaa75e03c6a4aa629f40cadbfef4fd841541e69915bcc255d
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-review-round1-codex.md  1b12d81421d96e26d9d7bf028e43b8bead747f9c1d8d56795ea7fe26d40ff61d
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-review-round1-input-checklist-codex.md  3b0a70b8d3433df22a0232fcceace626ebb4815426c8b09168b1b22cce6f8cb0
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-review-round2-codex.md  fc783622a0c8cdf24939e94be1e14d699f127ed37576dbf44f3d9a36b3a20ba7
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-review-round2-input-checklist-codex.md  00dad3c35b87d36b90f7052b3cc56548e19aed6229b5e9c5a949bbbc60b49278
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round1-codex.md  529d53499664f6da8d4ee364eb9f412eba02b535e10a0cb7bb99185ecc45afc9
READ_FULL_AFTER_VERDICT  doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round1-input-checklist-codex.md  6676f579c53b67930bbec3ce88148842c4478ba7a611ed8942d2310c2e8c0385
```

## 标题列表和路由执行

```text
READ_FULL_LISTING  doc/decisions full file-title listing  31051fc0934452d42a6e1e59afa2e66a4292edcea3476d941ff8c17ec97e180a
READ_FULL_LISTING  doc/decisions/templates listing  c544e55496cecd18c772d9e5d6f1b373e52e6c2f40faac36c13a3433123f405c
RUN  scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner frontend-platform --impact governance --trigger task-start
RESULT  applicable routed originals read/classified above; business corpus search result NO_CORPUS_ENTRY_MATCHED for TER/package/export/keyboard terms
```
