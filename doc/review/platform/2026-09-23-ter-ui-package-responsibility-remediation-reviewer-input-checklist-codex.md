# Fresh reviewer input checklist — TER UI review remediation ledger

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`  
`REVIEWER_KIND_REQUIRED=INDEPENDENT_SUBAGENT`  
`BLIND_SEQUENCE=INDEPENDENT_FINDINGS_FIRST; AUTHOR_LEDGER_AND_PRIOR_REVIEW_AFTER`  
`READ_STATUS=PENDING_REVIEWER_AT_CHECKLIST_CREATION`

Reviewer: read the inputs below and mark each actual file read in the returned report. Before reading the author reconciliation ledger, remediation evidence, CP-3 evidence, or Claude review files, independently compare the user requirement, design/plan, current code/tests and relevant project memory. First form an independent finding list and verdict in your response; only then read the deferred author/review material and check it against your independent result. Do not edit files, run Git operations, start devices, Metro, Web, builds, or tests. The requested result is a fresh read-only check of the §3–§8 code↔design reconciliation and S-1 remediation, not a new device verdict.

## Current context, source, authorization

| Repository-relative input | SHA-256 | Read status |
| --- | --- | --- |
| `AGENTS.md` | `6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679` | Pending |
| `CLAUDE.md` | `f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a` | Pending |
| `PLATFORM-BLUEPRINT.md` | `19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396` | Pending |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | Pending |
| `doc/platform/active-document-index.json` | `97dc4965f131f31a3cb40839ce96da2bb9ef4899c80a2b0c48b11e8d4dd6ecf3` | Pending |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | Pending |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | Pending |
| `scripts/README.md` | `06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8` | Pending |
| `project-memory/index.md` | `2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029` | Pending |
| Current task authorization | User's explicit prior implementation authorization plus current pasted Claude scope; session input, no repository file/hash | Pending |

Selected Roadmap is `V2S_W0_W4_EXECUTION`, resolved through the registry. Read the actual `R*_AUTHORIZED`/`V2S_*` authorization fields. Root AGENTS says Roadmap `CURRENT_*` state fields have been removed; do not invent or use them to select this task. The current task scope is only the review remediation and evidence described in the current user message.

## Project memory and business corpus

Read all six kernels and run the six-dimensional `scripts/memory/query` route for this implementation review. Use supported values; prior valid route dimensions were `task-kind=implementation`, `domain=admin-ui`, `consumer-face=platform-admin` (retrieval-only nearest route; not TER product ownership), `owner=frontend-platform`, `impact=evidence` and `impact=governance`, `trigger=implementation`. Reopen every returned hit and each applicable owning source. Record all hit paths and whether read.

| Repository-relative input | SHA-256 | Read status |
| --- | --- | --- |
| `project-memory/required-inventory.json` | `c22297cfc543045f042e3050045bd50b01be5b03c5a2a3a8046f16f1f8c54b46` | Pending |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | Pending |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | Pending |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | Pending |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` | Pending |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | Pending |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | Pending |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | Pending |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `fbd0ed5057e2bc4936ddf042daf4924e3b9bfe68ef1d2b98ae51658202315275` | Pending |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d` | Pending; corpus search noted below |
| `project-memory/operations/terminal-coding-standard.md` | `f4620bf815b0deaa05a017e184d43102aa8a293ae1c7cf22c7fed1549233e47d` | Pending |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` | Pending |
| `project-memory/pitfalls/count-without-member-list.md` | `61e238bfdc55261156617d7a38023dbf6032ed68983080ff4de66a99c5016f8f` | Pending |
| `project-memory/pitfalls/criterion-degraded-into-list.md` | `f07ba6ef4c4b375382ca540f8fa16e906dd86d68a4019dfaa36092280b46b6e3` | Pending |
| `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` | `5ef2cf95a8116003b4f80d71c13568122abbb86421c766bed9f78b2725e6d3b9` | Pending |

Confirmed-business corpus preliminary search returned no hits for: `sample.desk.member-form`, `TER Admin`, `TER UI`, `公共导出`, `wallpaper-picker`, `displayModes`, `包职责`. Re-run/verify; report `NO_CORPUS_ENTRY_MATCHED` only if still true.

## Applicable standards and decisions

Read `doc/decisions/` title inventory using `rg --files doc/decisions`, review every title for applicability, and open all related decisions below in full. Search/check the applicable standards checklist. The repository instructions say the former standards-coverage matrix is retired and not an entry/delivery gate; if `contracts/policy/standards-coverage-matrix.json` is absent, record `ABSENT/RETIRED_BY_AGENTS`, do not recreate or invoke it.

| Repository-relative input | SHA-256 | Read status |
| --- | --- | --- |
| `doc/platform/foundation-charter.md` | `f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455` | Pending |
| `doc/platform/terminal-coding-standard.md` | `595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03` | Pending |
| `doc/platform/frontend-coding-standard.md` | `5c72783dfa9452c8ecfcd095e438032e482cf8e16958112a4e790e572eedfe8c` | Pending |
| `doc/platform/review-standard.md` | `6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6` | Pending |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `bb6b02257b1a1413480b7138d943972c6e189a651095eaddc8940684983d489e` | Pending |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | Pending |
| `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` | `afeafcf0373bbaaa921c1de7f9ac797af71d95f1540fe5953458ef8dbe63c991` | Pending |
| `doc/decisions/2026-07-27-v2s-identified-finding-generalization-and-prevention.md` | `0aca450c2bc6e83da1d6d5e6d5bc1ec74b67245c4c1bb2f1fa65fab841b17bba` | Pending |
| `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md` | `2fe7ac4c8ba25518941d0bfbecde3d5539c4d2b9f011012db770d1edf0787b27` | Pending |
| `doc/decisions/2026-07-24-v2s-r3-specialized-design-authorization.md` | `f912ce7942646d0aca5ce7ab045734286c1c7dc4f3ff03a6047de6f7a4cc7d99` | Pending |
| `doc/decisions/2026-07-24-v2s-execution-roadmap-r0-acceptance.md` | `3f917b783b7861dc56fd4307f4a6bd3c826e07baaec6ae2b8ea7ae69c6db45a2` | Pending |
| `doc/decisions/templates/implementation-design-template.md` | `ecd088315feef1048d10ecb699e2939aebbcf72f2fb8aeb926d1a74c5b87d14b` | Pending |
| `.agents/skills/cs-review/SKILL.md` | `371ba910004f55c417c832a060f6b64edef2eccc845ce4f8882d3ecda37cb95c` | Pending |
| `.agents/skills/cs-memory-recall/SKILL.md` | `d9e4b8ca8b7ee5bdbe41037338fe3815ae024ce61c42bcb62e6684d8e4648b0f` | Pending |

## Task source and current implementation

Before seeing author conclusions, read requirements/design/plan and directly inspect the current owning sources and tests listed below. No Journey/IA interaction artifact or granularity manifest governs this package-boundary task; manifest/compliance controls are retired per current AGENTS. Do not treat absence as permission to infer behavior.

| Repository-relative input | SHA-256 | Read status |
| --- | --- | --- |
| `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md` | `9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751` | Pending |
| `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md` | `530e45da60d2e4c29459c2deb5a6d389b198d42c7f0687db9eeef02396030ea3` | Pending |
| `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md` | `6c4786bc8b112722567b03b895721cf0eb4ad53d654f492e9a6a02b14569eab9` | Pending |
| `apps/terminal/ui/base/render/src/foundations/definePart.ts` | `4b566cb63e81db157ab071a372ebe02fa3ccfb3909d89c49304954986fb210a7` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/README.md` | `4c00c899003e188d4e33153616d32a116514881fb5d2d1640665c3a8380b9907` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/src/index.ts` | `3460f83a2b4cc8c19fd38918b59445707ea82f379b5e7cd2c41a939c487c6b8a` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/package.json` | `749d7f5e33998bf98d4e2ca3c33b0dfd1cdd5059646a30d5706c9e6b15123f76` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/terminal-invariants.json` | `c88aa9bb9fa938e4de3ec6e63076cbce86696c90892e4952a038b8f8d4a21745` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/test/publicSurface.test.ts` | `99d0300346609cc97d9d8ea347c728ab10dfbb1a490867a62de04e239cc0dd54` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts` | `99cf17a46e360f7c01852883971d98dd5221ff68d26461040a23071e065cfb0d` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx` | `fca74b257eb0b34a06ec53cc48fb9db6252ee2187abdd5a35fec42d5a262b935` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberForm.ts` | `899b8e1947893a909ef442cdc1e7a493096fa9bb4dcc9d41e0cdcc68fb37545b` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/README.md` | `c814a4839dbee7b7bee5193cdb5b4d2b7af3bfb934636cbfa5f7b1cd71834938` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/src/index.ts` | `deb6171dabd7375cc15c91fb31cf3aa29cbc98e0b741e3f31ddd48eb92640d0a` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/package.json` | `15209093e2d14829b314a3e5d2b9acc4862e91ba2b22c1a90799332a08fb86d1` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/terminal-invariants.json` | `1c9bcee260ea7b4a203ea9efcc7346580a4c9998e926b3beac3c7cb07c8ba3a7` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/test/publicSurface.test.ts` | `59eeff4a08969318757d35cee5bb551c0911d8dc69f326ce1d4b0d62b3c19d28` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts` | `ee8f39da5e3ad3ebc1037ac24e8039672564ec461dd5bb3b545397d4343322ea` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts` | `a1ec60e5975d66c01e034dafe9a3d604eb2e0d3cc0dbebd737ccdfdc458a6dc3` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/src/foundations/systemFailureDismissal.ts` | `98fc43280373021aa6cac36fd746c99946b1a48f67e66f1ce70d8281af61d6b6` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/README.md` | `6d31322b36804c163be3c0a56971c30a47eaa0595681a757aa90a4c70d0dd463` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/src/index.ts` | `6b4be5f57e6e34e12b5cc462015b8303289de4d20b426640fad82c70a57d7a45` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/package.json` | `fcb527b16b876df4c2619856388f378b57375ccb15993091e4f6cd8f4881d107` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/terminal-invariants.json` | `2d8728e63354bb5a84dcd08759f0101eac0d0bc38fbbd3a17c46daba191a0958` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/test/publicSurface.test.ts` | `4d125e48ee7b4aa9078f9741e7149b137be4515df74479eb33bacc4e80c0b83d` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts` | `07502e6df9afeeface17eccb5e1e2fa77222fe1f22200fd96713eecd110a0eff` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/test/sampleWallpaperPicker.test.tsx` | `ae2be2dc6852e18f518f3eda71da2ab8c274b3b9fbe59729fd4ce68412498bb7` | Pending |
| `apps/terminal/ui/integration/sample-console/README.md` | `c4080db082189070dd756aa77773cd5c7958bd3b03f8fc4725c6c51771113c5e` | Pending |
| `apps/terminal/ui/integration/sample-console/src/index.ts` | `e242fe6eb9a484d990bb9c014531a9a3a09a40bef6fa88935094dd01250d21b9` | Pending |
| `apps/terminal/ui/integration/sample-console/package.json` | `a58557032d70db06fe9bd34ddde04f23f535b46a6924fbf292d4fdde6b5a0d1c` | Pending |
| `apps/terminal/ui/integration/sample-console/terminal-invariants.json` | `80188fe73866eec53150f6c254235872cf58261005c08119eff7f5e8e8ba92d9` | Pending |
| `apps/terminal/ui/integration/sample-console/test/publicSurface.test.ts` | `bba5714e95ad371e2f6f2a4604cb814bb47727ab356e1bbfa71fe13c8da040ea` | Pending |
| `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` | `3838507fbde7ad2463da800afceafa463aa91de507a2fe3e0d4a26a754bf9bf2` | Pending |
| `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` | `ea49c5e6c74e5279feda2308e27efac4477831867f8700e161bd60907a2be37f` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/README.md` | `9f27fb4309b24770e9831a23d4721886bf7a5604343e31b241b0301f91f17caa` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/index.ts` | `4eb48f9dd445675bc52567038395b76564d90dc865df398062b372ac7d128e51` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/package.json` | `d427c2a5b1a768af147f3ae8446121254fbd1557d06cb509890f23a728e8add8` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/terminal-invariants.json` | `93de8bf8ca6470059ce7a13eacccbbfaa1525c0480b27d6bc21b1613118ffc10` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/test/publicSurface.test.ts` | `6518d08732a2109b32f2fb532928638140425e54bd3ab19d4a1d6b63369998aa` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts` | `d0b19a93316ceb2be2b5213f5e6a7bb07d004489c3c0da6c5b7b2ba29132b32f` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx` | `16b56a6e796c22061c514f5a9ea8e348f60528f3df5153dde78a0dfd16196796` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/src/moduleName.ts` | `1351f6e0f2bf7e00b90b41c40df97fbbc7df535c9d78df8926f192f79922a491` | Pending |
| `apps/terminal/ui/feature/sample-member-desk/src/dependencies.ts` | `e5707bcba8777218ae8363f51b53fd46c939c6e88bf119fd888442c13383fd71` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/src/moduleName.ts` | `e4c43e0ab6b9a4d1b33d89dd82d6dc981818ad0bb9620af77399e10bffd3193a` | Pending |
| `apps/terminal/ui/feature/sample-staff-auth/src/dependencies.ts` | `f68495bb066f27ce6723fb4990e7813f40c7021a12393cc6999b10ba5b561835` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/src/moduleName.ts` | `f35b6b3015240b8867cd05a41d958d46fa23196b9e1a2858b4bbc4ea141b16f9` | Pending |
| `apps/terminal/ui/feature/sample-wallpaper-picker/src/dependencies.ts` | `2208d05ce4c89a783930c39a76f80fd96023002a894ede7671ec98a393b33daa` | Pending |
| `apps/terminal/ui/integration/sample-console/src/moduleName.ts` | `49d8381701e1d4b8ed91581ea35dfdf21e0c11ebf91312c68b7e2080612e7204` | Pending |
| `apps/terminal/ui/integration/sample-console/src/dependencies.ts` | `6490fba34128a4cfa7a8ff927f08ae1e879973c911da9070f9de5f39843fb068` | Pending |
| `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts` | `365bfe65fe80185aa955413dc93184ecfc0c5af84635b8748297428f74927ab0` | Pending |
| `apps/terminal/ui/integration/sample-console/src/application/module.ts` | `f67fa165415dab68e8b49145848e41fb776059e31422874b2c13315d4e3e5966` | Pending |
| `apps/terminal/ui/integration/sample-console/theme/global.css` | `c55deebfe6e7293cce251a294f6d349a2dfd8b5ca945ec57551923f3596ab6cb` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/moduleName.ts` | `5edef90a04c7573ec1a9f2a8b5bab93809a4dda24f1926bc82da35d7a7da5178` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/dependencies.ts` | `3a9f77bc99eb3768cbf0fe985c8e70f016e0cf39262e605f02fe788ec3e5c9f2` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts` | `5addda12be98f5416931100b6596e1336ff3b3f7a6b1522d5b76f919b1a1334c` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx` | `c8bcb78bd03b547b309cc56cebb600e96611b11ed4837c6daf8d8aeb9c0e83c9` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts` | `b90fdd2715197c0f2ca2c2d20156765eb7a04b464070aadf978a9db0a5e7c4a4` | Pending |
| `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css` | `62f3513419e8922f3c8278512f6d43833180c47c59c472ed6d180070e2684cb0` | Pending |
| `apps/terminal/assembly/android/sample-terminal/App.tsx` | `89301e2b14f43ce32f8ffc26d820f0de133f55f4664dc69056614ababf4aecb6` | Pending |
| `apps/terminal/assembly/android/sample-terminal/metro.config.js` | `3d760f4053ab14a0297c08d85ec03458b33449810d396ae6795c8e53b09f0366` | Pending |
| `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts` | `bb8a1393a0574836a4c74662ae2748ca7bb162f216c2fee9cdaf5ee70ffa7b13` | Pending |
| `apps/terminal/assembly/android/sample-terminal/src/dependencies.ts` | `e91b6a9ffedac738e27a876ce4260504cc8a6cea7ebf2f75e4eeb1835b3e603b` | Pending |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx` | `e4aa855a230847a376322fbf16ade2fdd1ba77491ffa3a30c00c2df82a1b4660` | Pending |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/metro.config.js` | `23d8e03fc6da1c3de8686f0b6c5fb331b60bde0ce9dd32c975cb3a385573e827` | Pending |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts` | `e18a8027535e0b9a9c265a13fb38e77318f4fdc347df015039497007e34db6d0` | Pending |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/src/dependencies.ts` | `e4bb52a35a457a8032bdc3b89f1c9eff5a67202a85b9d8ddb016403057124818` | Pending |

## Author/review materials — defer until the blind preliminary assessment

These are necessary to reconcile what was independently found with submitted records, but reading them before the preliminary findings would compromise the blind sequence.

| Repository-relative input | SHA-256 | Read status |
| --- | --- | --- |
| `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-diagnostic-review-claude.md` | `9271e2ae160b21b53a3613cb66d4cf6cd1f91a1d66ab1c4315e7886f48a4f50d` | Defer until preliminary verdict |
| `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-review-claude.md` | `3f898ca30251b6e6bec5971b5dae62b0fa6f7fb1fef03b3551421e77d1a5f70e` | Defer until preliminary verdict |
| `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-cp3-execution-evidence-codex.md` | `44a63bdb39b92b5a75f63184dc4d025f7de129ea5d3acf262333204f3c8f5768` | Defer until preliminary verdict |
| `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-dynamic/README.md` | `1a828a83d1f58a439df1ce2c6d5da51882ee8918a9ed1faec043b9b4e3b5e17a` | Defer until preliminary verdict |
| `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-review-remediation-evidence-codex.md` | `caaf9768497a87fc7852582b9b294f1c3ad35191a59429ad6abbc149eab2b382` | Defer until preliminary verdict |
| `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-codex.md` | `095f931c5829869c0797e30e0427304d00f4cb03d5e78ae82cc815c1f1f5d8f3` | Defer until preliminary verdict |

After the preliminary report, read all deferred materials, independently verify every ledger clause in design §§3–8 (including the exact 71 root names, seven paths and consumer distinctions), confirm current production source has no retained mutation, inspect all five part metadata snapshots and compare each field/value to its owning source, then report row-by-row corrections. The author reconciliation file is expected to have S-1 recorded as pre-fix `OPEN` and current `MATCHED`; do not accept the status without checking the actual source/test/variant evidence. Do not run tests or mutate source.

## Reviewer response requirements

- Include `reviewerKind=INDEPENDENT_SUBAGENT`, `reviewerInputChecklist={path,sha256}`, a blind-review declaration, and `authorMaterialReadAfterIndependentVerdict=true`.
- Provide the preliminary independent assessment first, then the author-ledger comparison; list each §3–§8 row or clause checked with `MATCHED` or `OPEN`, exact paths/lines, evidence, and any first failure / last known good / broken boundary / next step.
- Separate implementation mismatch from explicitly out-of-scope OPEN items (Q5, external consumers, MemberForm v2 title, dismissal-helper purity). Never upgrade either category to closed without evidence.
- State whether the reconciliation record is complete and whether S-1's `OPEN → MATCHED` transition is supported. Do not write files; return the read-only report to the main agent.
