---
title: RM1 U13 diagnostic typed fields repair
status: IMPLEMENTATION_AUTHORIZED
---

Replace the foundation diagnostic event's untyped `Map<String,Object>` logging projection with a closed typed
record. The R4 gate remains unchanged and continues to reject untyped database row/command shapes; the
repair removes the false-positive source rather than weakening that invariant.
