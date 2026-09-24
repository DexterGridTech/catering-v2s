// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceSelectDataNodeRequest.Deserializer.class)
public record WorkspaceSelectDataNodeRequest(
    java.util.UUID dataNodeRef,
    String dataNodeType,
    Long requiredContextVersion
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceSelectDataNodeRequest> {
    @Override
    public WorkspaceSelectDataNodeRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceSelectDataNodeRequest) context.handleUnexpectedToken(WorkspaceSelectDataNodeRequest.class, parser);
      java.util.UUID dataNodeRef = null;
      String dataNodeType = null;
      Long requiredContextVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "property value is required");
        switch (property) {
          case "dataNodeRef" -> dataNodeRef = context.readValue(parser, java.util.UUID.class);
          case "dataNodeType" -> dataNodeType = context.readValue(parser, String.class);
          case "requiredContextVersion" -> requiredContextVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "object must end with END_OBJECT");
      if (dataNodeRef == null) return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "missing required property dataNodeRef");
      if (dataNodeType == null) return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "missing required property dataNodeType");
      if (requiredContextVersion == null) return context.reportInputMismatch(WorkspaceSelectDataNodeRequest.class, "missing required property requiredContextVersion");
      return new WorkspaceSelectDataNodeRequest(dataNodeRef, dataNodeType, requiredContextVersion);
    }
  }
}
