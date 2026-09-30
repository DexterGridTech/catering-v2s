// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = BusinessChannelCreateRequest.Deserializer.class)
public record BusinessChannelCreateRequest(
    java.util.UUID templateRef,
    String ownerNodeType,
    java.util.UUID ownerNodeRef,
    String channelCode,
    String channelName,
    java.util.UUID bindingRef
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<BusinessChannelCreateRequest> {
    @Override
    public BusinessChannelCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (BusinessChannelCreateRequest) context.handleUnexpectedToken(BusinessChannelCreateRequest.class, parser);
      java.util.UUID templateRef = null;
      String ownerNodeType = null;
      java.util.UUID ownerNodeRef = null;
      String channelCode = null;
      String channelName = null;
      java.util.UUID bindingRef = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(BusinessChannelCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(BusinessChannelCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(BusinessChannelCreateRequest.class, "property value is required");
        switch (property) {
          case "templateRef" -> templateRef = context.readValue(parser, java.util.UUID.class);
          case "ownerNodeType" -> ownerNodeType = context.readValue(parser, String.class);
          case "ownerNodeRef" -> ownerNodeRef = context.readValue(parser, java.util.UUID.class);
          case "channelCode" -> channelCode = context.readValue(parser, String.class);
          case "channelName" -> channelName = context.readValue(parser, String.class);
          case "bindingRef" -> bindingRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(BusinessChannelCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(BusinessChannelCreateRequest.class, "object must end with END_OBJECT");
      if (templateRef == null) return context.reportInputMismatch(BusinessChannelCreateRequest.class, "missing required property templateRef");
      if (ownerNodeType == null) return context.reportInputMismatch(BusinessChannelCreateRequest.class, "missing required property ownerNodeType");
      if (ownerNodeRef == null) return context.reportInputMismatch(BusinessChannelCreateRequest.class, "missing required property ownerNodeRef");
      if (channelCode == null) return context.reportInputMismatch(BusinessChannelCreateRequest.class, "missing required property channelCode");
      if (channelName == null) return context.reportInputMismatch(BusinessChannelCreateRequest.class, "missing required property channelName");
      return new BusinessChannelCreateRequest(templateRef, ownerNodeType, ownerNodeRef, channelCode, channelName, bindingRef);
    }
  }
}
