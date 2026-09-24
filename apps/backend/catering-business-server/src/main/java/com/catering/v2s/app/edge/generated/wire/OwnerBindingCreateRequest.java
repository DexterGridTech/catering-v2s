// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OwnerBindingCreateRequest.Deserializer.class)
public record OwnerBindingCreateRequest(
    String providerCode,
    String capabilityClass,
    String nodeType,
    java.util.UUID nodeRef,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OwnerBindingCreateRequest> {
    @Override
    public OwnerBindingCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OwnerBindingCreateRequest) context.handleUnexpectedToken(OwnerBindingCreateRequest.class, parser);
      String providerCode = null;
      String capabilityClass = null;
      String nodeType = null;
      java.util.UUID nodeRef = null;
      tools.jackson.databind.JsonNode bindingDisplayName = null;
      tools.jackson.databind.JsonNode externalOwnerId = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OwnerBindingCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OwnerBindingCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OwnerBindingCreateRequest.class, "property value is required");
        switch (property) {
          case "providerCode" -> providerCode = context.readValue(parser, String.class);
          case "capabilityClass" -> capabilityClass = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "nodeType" -> nodeType = context.readValue(parser, String.class);
          case "nodeRef" -> nodeRef = context.readValue(parser, java.util.UUID.class);
          case "bindingDisplayName" -> bindingDisplayName = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "externalOwnerId" -> externalOwnerId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OwnerBindingCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OwnerBindingCreateRequest.class, "object must end with END_OBJECT");
      if (providerCode == null) return context.reportInputMismatch(OwnerBindingCreateRequest.class, "missing required property providerCode");
      if (nodeType == null) return context.reportInputMismatch(OwnerBindingCreateRequest.class, "missing required property nodeType");
      if (nodeRef == null) return context.reportInputMismatch(OwnerBindingCreateRequest.class, "missing required property nodeRef");
      return new OwnerBindingCreateRequest(providerCode, capabilityClass, nodeType, nodeRef, bindingDisplayName, externalOwnerId);
    }
  }
}
