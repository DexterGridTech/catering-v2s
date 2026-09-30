// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = StoreQrConfigurationUpdateRequest.Deserializer.class)
public record StoreQrConfigurationUpdateRequest(
    Boolean enabled,
    java.util.UUID channelRef,
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<StoreQrConfigurationUpdateRequest> {
    @Override
    public StoreQrConfigurationUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (StoreQrConfigurationUpdateRequest) context.handleUnexpectedToken(StoreQrConfigurationUpdateRequest.class, parser);
      Boolean enabled = null;
      java.util.UUID channelRef = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "property value is required");
        switch (property) {
          case "enabled" -> enabled = context.readValue(parser, Boolean.class);
          case "channelRef" -> channelRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "object must end with END_OBJECT");
      if (enabled == null) return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "missing required property enabled");
      if (expectedVersion == null) return context.reportInputMismatch(StoreQrConfigurationUpdateRequest.class, "missing required property expectedVersion");
      return new StoreQrConfigurationUpdateRequest(enabled, channelRef, expectedVersion);
    }
  }
}
