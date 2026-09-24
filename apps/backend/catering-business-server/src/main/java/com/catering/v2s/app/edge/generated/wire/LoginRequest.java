// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = LoginRequest.Deserializer.class)
public record LoginRequest(
    String accountName,
    String password
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<LoginRequest> {
    @Override
    public LoginRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (LoginRequest) context.handleUnexpectedToken(LoginRequest.class, parser);
      String accountName = null;
      String password = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(LoginRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(LoginRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(LoginRequest.class, "property value is required");
        switch (property) {
          case "accountName" -> accountName = context.readValue(parser, String.class);
          case "password" -> password = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(LoginRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(LoginRequest.class, "object must end with END_OBJECT");
      if (accountName == null) return context.reportInputMismatch(LoginRequest.class, "missing required property accountName");
      if (password == null) return context.reportInputMismatch(LoginRequest.class, "missing required property password");
      return new LoginRequest(accountName, password);
    }
  }
}
