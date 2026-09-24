// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceOtpSendRequest.Deserializer.class)
public record WorkspaceOtpSendRequest(
    String mobile
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceOtpSendRequest> {
    @Override
    public WorkspaceOtpSendRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceOtpSendRequest) context.handleUnexpectedToken(WorkspaceOtpSendRequest.class, parser);
      String mobile = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "property value is required");
        switch (property) {
          case "mobile" -> mobile = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "object must end with END_OBJECT");
      if (mobile == null) return context.reportInputMismatch(WorkspaceOtpSendRequest.class, "missing required property mobile");
      return new WorkspaceOtpSendRequest(mobile);
    }
  }
}
