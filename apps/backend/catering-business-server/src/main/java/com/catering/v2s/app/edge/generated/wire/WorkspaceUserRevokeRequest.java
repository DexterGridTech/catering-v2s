// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceUserRevokeRequest.Deserializer.class)
public record WorkspaceUserRevokeRequest(
    Long expectedVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceUserRevokeRequest> {
    @Override
    public WorkspaceUserRevokeRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceUserRevokeRequest) context.handleUnexpectedToken(WorkspaceUserRevokeRequest.class, parser);
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "property value is required");
        switch (property) {
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "object must end with END_OBJECT");
      if (expectedVersion == null) return context.reportInputMismatch(WorkspaceUserRevokeRequest.class, "missing required property expectedVersion");
      return new WorkspaceUserRevokeRequest(expectedVersion);
    }
  }
}
