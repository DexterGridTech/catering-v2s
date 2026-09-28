# Terminal activation batch 1 · CP-05 and whole-batch 6b recheck

## Current-byte correction

```text
CURRENT_WHOLE_BATCH_6B=MATCHED
CURRENT_M/S/N=0/0/0
CURRENT_REVIEWER=/root/stage1_6c_admission_retry
CURRENT_SOURCE_SET_FILES=472
CURRENT_SOURCE_SET_SHA256=0dca67eb5ce5353e11986bdb7318dc7fc990342591aa0dd06210a8101d5e43d8
```

A fresh read-only whole-batch review independently recomputed the r2 selector plus the explicit
`tools/code-layout/cli.mjs` include and confirmed the current 472-file identity above. The earlier
aggregate `3f26055416f8a1afd23c5fb6b03da95e4929dd05e03eaed5aa93ba3788359d3c` is not reproducible
from current bytes and is superseded. The new reviewer rechecked the CP-05 bound file hashes,
requirements, detailed design/IA, project memory, and implementation sources; it found no content
drift in the scoped review. The earlier computation did not retain a per-file hash manifest, so the
exact source of its aggregate discrepancy cannot be isolated retrospectively.

The first review block below preserves the earlier result as history; use the current-byte correction
above for admission decisions.

```text
CP05_RECONCILIATION=MATCHED
WHOLE_BATCH_6B=MATCHED
M/S/N=0/0/0
REVIEWER=/root/stage1_6b_projection_recheck
SOURCE_SET_FILES=472
SOURCE_SET_SHA256=3f26055416f8a1afd23c5fb6b03da95e4929dd05e03eaed5aa93ba3788359d3c
REVIEW_SCOPE=CP-05_BINDING_DIGEST_REPAIR_AND_WHOLE_BATCH_6B
DYNAMIC_PROOF=NOT_CLAIMED
```

## Current-byte independent recheck

The reviewer reopened the CP-05 projection closure and full batch after the generated binding
refresh and plan/design ordering repair. The canonical source denominator used the r2 selector plus
the r4 `tools/code-layout/cli.mjs` include, with sorted repository-relative path, byte length and
raw bytes. Volatile review/status files are excluded from that digest and the current repair record
was read separately.

### CP-05 evidence

- Runtime registries contain 238 edge rows plus 58 catalog/inventory rows: 296 unique operation
  identities, no duplicate IDs and no missing budget projections.
- The current report has three reports at cardinalities 1/20/100, each with the same exact 296
  operation set and no missing, extra or drifted rows.
- Terminal operation maxima: `activateTerminal=10`, `cancelTerminalActivation=9`,
  `cancelOperationsStoreTerminalActivation=17`.
- The single D-39 exception remains `postOperationsStoreTerminalStatus=23`, with
  `decisionRef=IMPLEMENTATION-AGENT-2026-09-29-TERMINAL-VOID-STATUS-CP05`.
- The operation-handler binding registry contains 296 operations; its generated index includes
  store-terminal and terminal-binding. The three terminal operations retain their expected faces and
  context kinds.
- The binding manifest's two complete-route-file hashes now match both runtime registries, and the
  plan/design specify this downstream regeneration.

### Whole-batch 6b evidence

The reviewer checked current requirements, design/plan, selected implementation sources, project
memory constraints and generated outputs. D-42/D-43 protocol behavior remains aligned; R-12 supports
the terminal credential context; D-41 still guards repository-root-only generated inputs. This is
static/source reconciliation only. It does not establish WebSocket, business, remote topology,
runtime, L2, reset, seed or cleanup outcomes.

### Bound current file hashes

- `contracts/registry/operation-handler-bindings.json`: `f6ec7043e9a1c45578fcf9c50632a12bc4e4656072c177b39111d91afb94ec17`
- generated binding index: `ad4d143f66fc34e3f9b90206dc31f5f5124fa8598694a463d0ee83adda9731ce`
- edge route registry: `27863dd60db0b055830f7ab431c4ae296a2e9a96dd941eb3db3260462b61102d`
- catalog route registry: `8ff2434bb52e9e2e47c253ef22a9231eb4fe11aa78270a27425ef3f3e6c559cd`
- CP-05 report: `15a70b5b15749a6221c9af42495c7167d5e2ca8afdaad2664a323c5675ebb6f4`
- design: `ba898d7569fa1c644fbc039092f214b50e4698f04deef501fa77c14cec6d57a6`
- plan: `9897bb9c0169f3159bcecfcc091b8654b3360308c2798c58e29213d3a76757b9`
- budget reconciliation test: `c9e8991a7422feb7e6f6694ebd8bbd31c2725374133cdb858793d0cb8fa299c7`

## Gate decision

CP-05 and 6b are `MATCHED`, `M/S/N=0/0/0`. The prior 6c admission was bound to an older source
digest; this recheck does not extend it. The exact first managed run stays blocked until the 6c
reviewer checks this current 6b record and issues a current-byte admission. No remote run, SSH
session, process signal or network change was made by the reviewer.
