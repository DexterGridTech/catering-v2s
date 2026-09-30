// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformAdminCredentialResetRequest.Deserializer.class)
public record PlatformAdminCredentialResetRequest(
    String password,
    Long expectedVersion,
    String idempotencyKey
) {
  @Override
  public String toString() {
    return "PlatformAdminCredentialResetRequest["
        + "redacted=" + "[REDACTED]"
        + ", expectedVersion=" + expectedVersion
        + ", idempotencyKey=" + idempotencyKey
        + "]";
  }


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformAdminCredentialResetRequest> {
    @Override
    public PlatformAdminCredentialResetRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformAdminCredentialResetRequest) context.handleUnexpectedToken(PlatformAdminCredentialResetRequest.class, parser);
      String password = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "property value is required");
        switch (property) {
          case "password" -> password = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "object must end with END_OBJECT");
      if (password == null) return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "missing required property password");
      if (expectedVersion == null) return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(PlatformAdminCredentialResetRequest.class, "missing required property idempotencyKey");
      return new PlatformAdminCredentialResetRequest(password, expectedVersion, idempotencyKey);
    }
  }
}
