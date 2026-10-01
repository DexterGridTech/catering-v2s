// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceCredentialResetRequest.Deserializer.class)
public record WorkspaceCredentialResetRequest(
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceCredentialResetRequest> {
    @Override
    public WorkspaceCredentialResetRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceCredentialResetRequest) context.handleUnexpectedToken(WorkspaceCredentialResetRequest.class, parser);
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "property value is required");
        switch (property) {
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "object must end with END_OBJECT");
      if (expectedVersion == null) return context.reportInputMismatch(WorkspaceCredentialResetRequest.class, "missing required property expectedVersion");
      return new WorkspaceCredentialResetRequest(expectedVersion);
    }
  }
}
