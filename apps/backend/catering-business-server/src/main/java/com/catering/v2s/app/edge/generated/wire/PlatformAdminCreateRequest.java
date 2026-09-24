// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformAdminCreateRequest.Deserializer.class)
public record PlatformAdminCreateRequest(
    String loginName,
    String userName,
    String mobile,
    String password,
    String idempotencyKey
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformAdminCreateRequest> {
    @Override
    public PlatformAdminCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformAdminCreateRequest) context.handleUnexpectedToken(PlatformAdminCreateRequest.class, parser);
      String loginName = null;
      String userName = null;
      String mobile = null;
      String password = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformAdminCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformAdminCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformAdminCreateRequest.class, "property value is required");
        switch (property) {
          case "loginName" -> loginName = context.readValue(parser, String.class);
          case "userName" -> userName = context.readValue(parser, String.class);
          case "mobile" -> mobile = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "password" -> password = context.readValue(parser, String.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformAdminCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformAdminCreateRequest.class, "object must end with END_OBJECT");
      if (loginName == null) return context.reportInputMismatch(PlatformAdminCreateRequest.class, "missing required property loginName");
      if (userName == null) return context.reportInputMismatch(PlatformAdminCreateRequest.class, "missing required property userName");
      if (password == null) return context.reportInputMismatch(PlatformAdminCreateRequest.class, "missing required property password");
      if (idempotencyKey == null) return context.reportInputMismatch(PlatformAdminCreateRequest.class, "missing required property idempotencyKey");
      return new PlatformAdminCreateRequest(loginName, userName, mobile, password, idempotencyKey);
    }
  }
}
