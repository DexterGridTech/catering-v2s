# RM1 P6 implementation-facing design：独立对抗审查输入清单（Round 2）

`REVIEW_CYCLE_ID=RM1-P6-IMPLEMENTATION-FACING-DESIGN-20260729`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

这是同一 cycle 的最终定向盲审。审查者是 fresh independent subagent：先独立验证当前字节及反例，再阅读
Round-1 verdict 和作者 intake 以检查处置是否过度或遗漏；不得把作者材料当作结论。只允许静态 review。

| 必读输入 | SHA-256 | 要求 |
| --- | --- | --- |
| `AGENTS.md` | `f179f36d8aade8e4cb01def3637aef3a41dc031f79720c4fa13c1a58e3384414` | 全文 |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | 全文 |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | 全文 |
| `doc/platform/README.md` + registry + current Roadmap | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e`; `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8`; `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938` | 只读 current `CURRENT_*` |
| `project-memory/index.md` + all kernel + six-dimension recall | `7b23fa36286900f8d83e892cbc826796d5504fa3406da723456dde52bffbb650` | 打开全部命中及 owning source |
| deterministic / independent review / business corpus / corpus use / verification memory | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`; `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`; `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`; `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353`; `090e9ce7b6907404103353d69474071b9dc12048f9956e3c05a7847f1397b577` | 全文/命中检索 |
| review governance + P6 authorization | `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508`; `441a8855412d29b41dd2e3356fc43430686f3166b727b707aa340e288a033bd3` | 全文 |
| IA01 / IA02 / IA03 / IA04 / IA05 | `7e2ae73f810b8a7ad75a8f0a8800f873b5ea0c9f582648b8002d5258f6bb3a67`; `8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813`; `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17`; `c75dfad9129e5bcf47de70c7bca46187dd5529cb1ba0b607c687a6aa38d7d899`; `7f2a8f2447eb7b0e40f2556b5f4361e68197e74713c5f5220e8dace7742ad960` | 全文 |
| P6 preparation + surface manifest + standards matrix | `d12503842fb9e86afb7688fcdbfab7f54312e7f5ecfa5506e96f6b4e5a06db30`; `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974`; `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` | 全文/完整分母 |
| current design plan | `adf9a0de9d8eb8c2fd14faf14fb10a89592fda8622c981e79f7a1879bb425846` | 全文 |
| current final roster | `f205310f0b33996f1ea48311da66ba7daf3c8c8ceac34e6cf484c6c3f743b7f4` | 验证所有 surface/screen contract |
| current manifest | `9a590edd67a4ff472c110126d92e9b584b8a11b0a2390d3b1decc596b4d29524` | production checker must pass |
| Round-1 verdict | `46583aef3764e677b0af61ba15643ee0e61a0b5401736a8b095d3b405992d611` | 在独立 current-byte 检查后对照 |
| author intake + prevention evidence | `c17af67cf9c4c44da2d169c9d3ba2e37cde283590c4a7111f2e6eac9a94524aa`; `4a8504fcd816201e4e162acbeb5253709c691ea21a4fe422be6c810b03f71b6d` | 在独立 current-byte 检查后对照 |

Verify M-001 all 22/25/7 records and phase assignments, M-002 exact final consumer/foundation import contracts and
red mutations, M-003 exact D1 route set. Seek counterexamples: duplicated physical surfaces, an omitted accepted
screen, invented operations, a foundation primitive unsupported by current foundation, or a roster that silently
turns P6-1 into UI work.  Record M/S/N; this is final round so write `ROUND_FINAL_DECISION=SELF_DECIDED` and
`furtherCodexAdversarialRoundAllowed=false`.
