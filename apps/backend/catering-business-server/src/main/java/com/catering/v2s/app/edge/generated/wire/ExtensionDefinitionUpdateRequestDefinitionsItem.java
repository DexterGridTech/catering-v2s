// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = ExtensionDefinitionUpdateRequestDefinitionsItem.Deserializer.class)
public record ExtensionDefinitionUpdateRequestDefinitionsItem(
    String key,
    String label,
    ExtensionFieldType type,
    Boolean listDisplay,
    Boolean searchable,
    Boolean required,
    java.util.List<String> options,
    String status,
    Long displayOrder,
    String displaySuffix
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<ExtensionDefinitionUpdateRequestDefinitionsItem> {
    @Override
    public ExtensionDefinitionUpdateRequestDefinitionsItem deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (ExtensionDefinitionUpdateRequestDefinitionsItem) context.handleUnexpectedToken(ExtensionDefinitionUpdateRequestDefinitionsItem.class, parser);
      String key = null;
      String label = null;
      ExtensionFieldType type = null;
      Boolean listDisplay = null;
      Boolean searchable = null;
      Boolean required = null;
      java.util.List<String> options = null;
      String status = null;
      Long displayOrder = null;
      String displaySuffix = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "property value is required");
        switch (property) {
          case "key" -> key = context.readValue(parser, String.class);
          case "label" -> label = context.readValue(parser, String.class);
          case "type" -> type = context.readValue(parser, ExtensionFieldType.class);
          case "listDisplay" -> listDisplay = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Boolean.class));
          case "searchable" -> searchable = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, Boolean.class));
          case "required" -> required = context.readValue(parser, Boolean.class);
          case "options" -> options = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "status" -> status = context.readValue(parser, String.class);
          case "displayOrder" -> displayOrder = context.readValue(parser, Long.class);
          case "displaySuffix" -> displaySuffix = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "object must end with END_OBJECT");
      if (label == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property label");
      if (type == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property type");
      if (!seen.contains("listDisplay")) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property listDisplay");
      if (!seen.contains("searchable")) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property searchable");
      if (required == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property required");
      if (options == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property options");
      if (status == null) return context.reportInputMismatch(ExtensionDefinitionUpdateRequestDefinitionsItem.class, "missing required property status");
      return new ExtensionDefinitionUpdateRequestDefinitionsItem(key, label, type, listDisplay, searchable, required, options, status, displayOrder, displaySuffix);
    }
  }
}
