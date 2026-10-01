// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceCurrentPasswordChangeRequest.Deserializer.class)
public record WorkspaceCurrentPasswordChangeRequest(
    String currentPassword,
    String newPassword,
    Long expectedSessionVersion
) {
  @Override
  public String toString() {
    return "WorkspaceCurrentPasswordChangeRequest["
        + "redacted=" + "[REDACTED]"
        + ", redacted=" + "[REDACTED]"
        + ", expectedSessionVersion=" + expectedSessionVersion
        + "]";
  }



  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceCurrentPasswordChangeRequest> {
    @Override
    public WorkspaceCurrentPasswordChangeRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceCurrentPasswordChangeRequest) context.handleUnexpectedToken(WorkspaceCurrentPasswordChangeRequest.class, parser);
      String currentPassword = null;
      String newPassword = null;
      Long expectedSessionVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "property value is required");
        switch (property) {
          case "currentPassword" -> currentPassword = context.readValue(parser, String.class);
          case "newPassword" -> newPassword = context.readValue(parser, String.class);
          case "expectedSessionVersion" -> expectedSessionVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "object must end with END_OBJECT");
      if (currentPassword == null) return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "missing required property currentPassword");
      if (newPassword == null) return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "missing required property newPassword");
      if (expectedSessionVersion == null) return context.reportInputMismatch(WorkspaceCurrentPasswordChangeRequest.class, "missing required property expectedSessionVersion");
      return new WorkspaceCurrentPasswordChangeRequest(currentPassword, newPassword, expectedSessionVersion);
    }
  }
}
