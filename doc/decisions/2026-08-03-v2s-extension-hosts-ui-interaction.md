# UI interaction: extension hosts for commercial group, region and project

Platform-admin keeps one extension-definition page and obtains its eight host tabs from
the owner catalog. Operations-admin keeps the existing organization-structure journey:
the commercial-group initialization Drawer obtains the `COMMERCIAL_GROUP` definition;
region and project create/edit Drawers obtain `REGION`/`PROJECT` definitions; organization
details render values returned by the hierarchy readback. The user does not choose a
field schema locally, and there is no new workspace capability or raw HTTP client.

States are: definition loading (submission disabled), loaded/empty (base form usable),
loaded/non-empty (typed dynamic fields shown), and definition error (clear failure message
with no submission). The same shared helper provides Date hydration/serialization,
control selection, required rules, and detail labels.

## Extension definition identity and display semantics

`key` is the stable owner-assigned parse key for an entity's `extensionValues`; `label` is
the user-facing field name. The extension-definition configuration table and edit Drawer must
show them separately as “字段 key” and “字段名称”. A newly added field shows “保存后自动生成”
until the owner returns its allocated key; an existing key is read-only. Entity create/edit
forms and details continue to use the field name only, while serializing and resolving values
by the key. This is a display clarification, not a new client-generated identifier, schema,
capability, or generic value-write path.
