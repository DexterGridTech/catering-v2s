// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformPasswordRecoveryCompleteRequest.Deserializer.class)
public record PlatformPasswordRecoveryCompleteRequest(
    String newPassword
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformPasswordRecoveryCompleteRequest> {
    @Override
    public PlatformPasswordRecoveryCompleteRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformPasswordRecoveryCompleteRequest) context.handleUnexpectedToken(PlatformPasswordRecoveryCompleteRequest.class, parser);
      String newPassword = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "property value is required");
        switch (property) {
          case "newPassword" -> newPassword = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "object must end with END_OBJECT");
      if (newPassword == null) return context.reportInputMismatch(PlatformPasswordRecoveryCompleteRequest.class, "missing required property newPassword");
      return new PlatformPasswordRecoveryCompleteRequest(newPassword);
    }
  }
}
