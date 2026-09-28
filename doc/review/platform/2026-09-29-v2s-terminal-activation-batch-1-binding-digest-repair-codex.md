```text
SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
FIRST_FAILURE=scripts/verify --validate-only; exit=1; R5_VERIFY_STATIC_FIRST_FAILURE:operation-handler-bindings-self-test; cause=BP_U02_ROUTE_SOURCE_DIGEST_DRIFT
REMOTE_TOUCHED=false
NETWORK_INTERRUPTED=false
```

# CP-05 generated binding digest repair

## Failure and owning boundary

The ordinary static verify ran after CP-05 projection regeneration and stopped at
`operation-handler-bindings-self-test`. The first failure is preserved above; this was a local
static failure and it did not create a remote run or touch SSH.

`scripts/generate/operation-handler-bindings.mjs:268-270` derives `routeSources` from the complete
route registry bytes and metadata. `validateBindingContract` compares that value against
`contracts/registry/operation-handler-bindings.json` at lines 368-379. The manifest still held the
old catalog registry SHA-256 `9e1ceae30b4bc65550dcac3e5599a07b5200c8e17e1088da82cbe23446c1b600`; the current
generated catalog/inventory registry was `8ff2434bb52e9e2e47c253ef22a9231eb4fe11aa78270a27425ef3f3e6c559cd`.
The edge registry digest remained `27863dd60db0b055830f7ab431c4ae296a2e9a96dd941eb3db3260462b61102d`.
All 296 operation identities remained present. The P1 output's metadata also reflected the current
catalog contract digest; the stale binding metadata, rather than a route or identity loss, was the
failed invariant.

Root cause: CP-05 documentation named the two budget projection producers but omitted the downstream
operation-handler binding generator. That generator hashes both complete route registry files, so
regenerating either source makes the binding manifest stale even when the route identities do not
change. The first repair invocation used unsupported P1 flags, which were ignored; this was already
corrected to the generator's actual no-argument invocation plus its separate checker.

## Minimal repair

The canonical `node scripts/generate/operation-handler-bindings.mjs --write` refreshed the binding
manifest and 32 owned outputs. No generated file was hand-edited. The implementation plan's CP-05
post-calibration sequence and design §12.3 now explicitly order the binding generator after both
route registry producers and before checks. The existing operation-handler self-test is the
mechanical regression: changing a registry without refreshing its binding source digest must remain
red as `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`.

Focused current-byte proof after refresh:

- `node scripts/generate/operation-handler-bindings.mjs --self-test` — `BP_U02_BINDING_SELF_TEST=PASS`;
  the emitted red list includes `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`.
- `node scripts/generate/operation-handler-bindings.mjs --check` — `BP_U02_BINDING_CHECK=PASS`,
  `CONTEXT_KIND_NEGATIVE=PASS`, 16 JSON and 16 Java outputs.
- At the time this record was first written, ordinary `scripts/verify --validate-only` had not yet
  been rerun after this repair. It was subsequently run on these bytes and returned
  `R5_VERIFY_VALIDATE_ONLY=PASS`, `EXECUTED=46/46`, `TERMINAL_STATIC=PASS`; nested run ID
  `ter-local-static-84081-1790621140094` (started `2026-09-28T18:45:40.094Z`). Completion time and
  retained log were not captured. Current status is at the top of
  `2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md`.

## Scope and remaining evidence

Applicable output chain: edge-codegen route registry, catalog-inventory P1 route registry, then
operation-handler binding metadata and generated owner outputs. Counterexample boundary: a change
that does not regenerate either route registry does not require refreshing `routeSources`; the
binding check remains the authority that decides this from current bytes.

Prevention is recorded in the existing CP-05 design/plan and existing self-test/check; no new memory
entry or duplicate gate was added. Current CP-05 and 6b reviewer records were subsequently refreshed
by `2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md` against
source digest `3f26055416f8a1afd23c5fb6b03da95e4929dd05e03eaed5aa93ba3788359d3c`. The previous 6c
admission is stale and a fresh current-byte review is in progress. No first-current-byte managed run
has started after the repair.
