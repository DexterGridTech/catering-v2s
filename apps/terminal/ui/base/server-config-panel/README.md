# Terminal server configuration panel

This package renders the existing `server-config` owner in the shared admin catalog. It receives immutable app defaults from composition, reads only `selectServerConfiguration`, and writes only through the owner's select/set/clear/restore commands. It has no configuration state owner and never renders a proxy password value.

On a paired SLAVE runtime, the panel is read-only and remains on a pending state until the selector reports the master's configuration projection. The screen uses `addresses[].baseUrl` as the complete URL prefix; it has no second prefix field.

Run `yarn typecheck`, `yarn test`, and `yarn lint` in this package.
