# Kernel feature boundary

Kernel feature packages own business state, commands, actors, selectors, and
module descriptors. The sample verification slice currently contains
`sample-staff-session` and `sample-member-registry`; both remain UI-independent
and depend only on the shared kernel foundations required by their contracts.
