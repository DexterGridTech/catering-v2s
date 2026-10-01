// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspacePasswordLoginRequest.Deserializer.class)
public record WorkspacePasswordLoginRequest(
    String loginName,
    String password
) {
  @Override
  public String toString() {
    return "WorkspacePasswordLoginRequest["
        + "loginName=" + loginName
        + ", redacted=" + "[REDACTED]"
        + "]";
  }



  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspacePasswordLoginRequest> {
    @Override
    public WorkspacePasswordLoginRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspacePasswordLoginRequest) context.handleUnexpectedToken(WorkspacePasswordLoginRequest.class, parser);
      String loginName = null;
      String password = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "property value is required");
        switch (property) {
          case "loginName" -> loginName = context.readValue(parser, String.class);
          case "password" -> password = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "object must end with END_OBJECT");
      if (loginName == null) return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "missing required property loginName");
      if (password == null) return context.reportInputMismatch(WorkspacePasswordLoginRequest.class, "missing required property password");
      return new WorkspacePasswordLoginRequest(loginName, password);
    }
  }
}
