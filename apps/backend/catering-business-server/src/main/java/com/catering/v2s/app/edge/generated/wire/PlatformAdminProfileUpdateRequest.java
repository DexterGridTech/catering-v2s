// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformAdminProfileUpdateRequest.Deserializer.class)
public record PlatformAdminProfileUpdateRequest(
    String userName,
    String mobile,
    Long expectedVersion,
    String idempotencyKey
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformAdminProfileUpdateRequest> {
    @Override
    public PlatformAdminProfileUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformAdminProfileUpdateRequest) context.handleUnexpectedToken(PlatformAdminProfileUpdateRequest.class, parser);
      String userName = null;
      String mobile = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "property value is required");
        switch (property) {
          case "userName" -> userName = context.readValue(parser, String.class);
          case "mobile" -> mobile = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "object must end with END_OBJECT");
      if (userName == null) return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "missing required property userName");
      if (expectedVersion == null) return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(PlatformAdminProfileUpdateRequest.class, "missing required property idempotencyKey");
      return new PlatformAdminProfileUpdateRequest(userName, mobile, expectedVersion, idempotencyKey);
    }
  }
}
