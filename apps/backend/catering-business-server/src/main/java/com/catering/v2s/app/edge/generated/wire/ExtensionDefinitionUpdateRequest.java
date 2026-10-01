// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = ExtensionDefinitionUpdateRequest.Deserializer.class)
public record ExtensionDefinitionUpdateRequest(
    java.util.List<ExtensionDefinitionUpdateRequestDefinitionsItem> definitions,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<ExtensionDefinitionUpdateRequest> {
    @Override
    public ExtensionDefinitionUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (ExtensionDefinitionUpdateRequest) context.handleUnexpectedToken(ExtensionDefinitionUpdateRequest.class, parser);
      java.util.List<ExtensionDefinitionUpdateRequestDefinitionsItem> definitions = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "property value is required");
        switch (property) {
          case "definitions" -> definitions = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<ExtensionDefinitionUpdateRequestDefinitionsItem>>() {});
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "object must end with END_OBJECT");
      if (definitions == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "missing required property definitions");
      if (expectedVersion == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequest.class, "missing required property expectedVersion");
      return new ExtensionDefinitionUpdateRequest(definitions, expectedVersion);
    }
  }
}
