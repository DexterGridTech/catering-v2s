# U26 extension-host implementation amendment

Dexter authorized a complete extension-field host addition for commercial groups,
regions, and projects. The preceding U25 visual-theme work has no package-exit
artifact because Dexter directed that isolated bug/UI repairs do not create a package.
This package therefore resumes from the latest closed implementation package,
`RM1P6-AUTH-SURFACE-LAYOUT-U24`, and does not assert U25 closure.

U26 is limited to the eight-host definition catalog, durable organization-owner
values and readbacks, generated contract, the two admin form/detail surfaces, and
the formal owner-command seed. It adds no workspace capability, client-side raw
transport, direct seed SQL, or new owner boundary.

## Confirmed hierarchy-detail completion repair

The platform organization hierarchy had accepted the three new host definitions but
missed their final read presentation: the commercial-group root was projected with an
empty extension-field list, while the owner overview reader did not map REGION or
PROJECT values into its existing extension-display projection. This repair stays in
U26's existing authorization boundary. It reuses the existing generated definition
query and owner readback path, removes only the redundant hierarchy “所属机构” row,
and consumes the already-returned disabled status in the tree title. It adds no
endpoint, workspace capability, raw transport, seed mechanism, or owner write path.

## Confirmed extension-editor interaction completion repair

The editor already persists declaration order from the dragged card order. Its
duplicate up/down buttons were a second, unnecessary ordering control and the add
control was visually detached below the field set. The Drawer now exposes one
primary “添加字段” control in its top-right extra slot and retains drag-and-drop as
the sole ordering interaction. This is presentation-only: it preserves owner CAS,
field identity, display-order serialization, generated client use, and all field
validation.

## Confirmed organization-path presentation repair

The workspace-IAM owner intentionally transfers organization paths in canonical
`CODE name / CODE name` form. Both admin applications had consumers that rendered
that transport value directly, even though the shared user-visible identity rule is
`名称(编码)`. The finite repair denominator is the platform account list, detail,
revocation confirmation and organization candidates; the platform invitation
candidate surfaces; and the equivalent operations user and invitation surfaces.
The repair adds one tolerant shared presentation formatter and leaves owner facts,
OpenAPI, generated clients, authorization, persistence and public invitation pages
unchanged.

## Confirmed workspace selector label repair

The authenticated platform shell has a single workspace selector in the side-bar
footer. Its text label consumes unnecessary space beside the selected workspace;
the label is replaced with an accessible icon while the Select retains its
`aria-label`, test id, candidate behavior and selected-workspace semantics.

## Confirmed extension definition key/name repair

The extension owner already keeps a stable `key` for parsing entity `extensionValues` and a
separate `label` for the human-facing field name. The configuration UI previously showed only
the label, which obscured that separation. The platform extension-definition table and edit
Drawer now separately show “字段 key” and “字段名称”. Existing keys remain owner-issued and
read-only; a new row states “保存后自动生成” until owner readback allocates it. Host forms and
details continue to display the field name while binding values by key. OpenAPI, generated
clients, persistence, owner allocation and atomic CAS replacement remain unchanged.

## Confirmed formal extension seed completion repair

The formal fixture defined all eight extension hosts, but the seed executor only wrote the first
field for commercial-group, region and project. Brand, tenant, head-company, store and contract
facts had no extension values at all. The fixture now declares a local seed alias and human label
for every field, and each Aurora owner fact declares values for every applicable alias. The
executor maps aliases to keys only from the owner definition PUT readback, writes all values through
the existing owner HTTP create commands, and fail-closes on missing, partial or mismatched
definition/value readbacks. The final aggregate readback reports only host/count metadata; it does
not expose payloads or generated field keys. No owner API, workspace capability, direct SQL,
OpenAPI contract or persistence shape changed.
