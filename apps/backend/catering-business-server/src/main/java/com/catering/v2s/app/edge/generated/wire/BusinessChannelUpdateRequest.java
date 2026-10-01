// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BusinessChannelUpdateRequest.Deserializer.class)
public record BusinessChannelUpdateRequest(
    String channelName,
    java.util.UUID bindingRef,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BusinessChannelUpdateRequest> {
    @Override
    public BusinessChannelUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BusinessChannelUpdateRequest) context.handleUnexpectedToken(BusinessChannelUpdateRequest.class, parser);
      String channelName = null;
      java.util.UUID bindingRef = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "property value is required");
        switch (property) {
          case "channelName" -> channelName = context.readValue(parser, String.class);
          case "bindingRef" -> bindingRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "object must end with END_OBJECT");
      if (channelName == null) return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "missing required property channelName");
      if (expectedVersion == null) return context.reportInputMismatch(BusinessChannelUpdateRequest.class, "missing required property expectedVersion");
      return new BusinessChannelUpdateRequest(channelName, bindingRef, expectedVersion);
    }
  }
}
