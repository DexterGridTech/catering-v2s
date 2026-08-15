package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Per-item variant axes own both the selected dictionary values and their stable order. */
final class CatalogSkuVariantAxisFacts {
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;
    CatalogSkuVariantAxisFacts(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs)); String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>(); Map<UUID, ObjectNode> axes = new LinkedHashMap<>(); refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query("SELECT axis.item_ref,axis.sku_variant_axis_ref,axis.attribute_ref,attribute.code,attribute.name,axis.display_order,value.value_ref,value_entry.code,value_entry.name,value_entry.status,value.display_order FROM catalog.catalog_sku_variant_axis axis JOIN catalog.dictionary_entry attribute ON attribute.entry_ref=axis.attribute_ref LEFT JOIN catalog.catalog_sku_variant_axis_value value ON value.sku_variant_axis_ref=axis.sku_variant_axis_ref LEFT JOIN catalog.dictionary_entry value_entry ON value_entry.entry_ref=value.value_ref WHERE axis.item_ref IN (" + placeholders + ") ORDER BY axis.item_ref,axis.display_order,axis.attribute_ref,value.display_order,value.value_ref", statement -> { for (int i=0;i<refs.size();i++) statement.setObject(i+1,refs.get(i)); }, rows -> { while(rows.next()) { UUID itemRef=rows.getObject(1,UUID.class), axisRef=rows.getObject(2,UUID.class); ObjectNode axis=axes.get(axisRef); if(axis==null){ axis=result.get(itemRef).addObject(); axis.put("attributeRef",rows.getObject(3,UUID.class).toString()); axis.put("attributeCode",rows.getString(4)); axis.put("attributeName",rows.getString(5)); axis.put("displayOrder",rows.getInt(6)); axis.putArray("values"); axes.put(axisRef,axis); } UUID valueRef=rows.getObject(7,UUID.class); if(valueRef!=null){ ObjectNode value=axis.withArray("values").addObject(); value.put("valueRef",valueRef.toString()); value.put("valueCode",rows.getString(8)); value.put("valueLabel",rows.getString(9)); value.put("status",rows.getString(10)); value.put("displayOrder",rows.getInt(11)); } } return null; });
        return Map.copyOf(result);
    }

    void replace(UUID itemRef, ArrayNode submitted) {
        List<Axis> axes = normalize(submitted); Map<UUID, ExistingAxis> existing = jdbc.query("SELECT attribute_ref,sku_variant_axis_ref,display_order FROM catalog.catalog_sku_variant_axis WHERE item_ref=?", rows -> { Map<UUID,ExistingAxis> result=new LinkedHashMap<>(); while(rows.next()) result.put(rows.getObject(1,UUID.class),new ExistingAxis(rows.getObject(2,UUID.class),rows.getInt(3))); return result; }, itemRef);
        boolean shift=axes.stream().anyMatch(axis -> existing.entrySet().stream().anyMatch(entry -> entry.getValue().displayOrder()==axis.displayOrder() && !entry.getKey().equals(axis.attributeRef())) || (existing.containsKey(axis.attributeRef()) && existing.get(axis.attributeRef()).displayOrder()!=axis.displayOrder()));
        if(shift) jdbc.update("UPDATE catalog.catalog_sku_variant_axis SET display_order=display_order+1000000 WHERE item_ref=?",itemRef);
        LinkedHashSet<UUID> retained=new LinkedHashSet<>();
        for(Axis axis:axes){ retained.add(axis.attributeRef()); UUID axisRef=existing.containsKey(axis.attributeRef())?existing.get(axis.attributeRef()).ref():UUID.randomUUID(); if(!existing.containsKey(axis.attributeRef())) jdbc.update("INSERT INTO catalog.catalog_sku_variant_axis(sku_variant_axis_ref,item_ref,attribute_ref,display_order) VALUES(?,?,?,?)",axisRef,itemRef,axis.attributeRef(),axis.displayOrder()); else jdbc.update("UPDATE catalog.catalog_sku_variant_axis SET display_order=? WHERE sku_variant_axis_ref=?",axis.displayOrder(),axisRef); jdbc.update("DELETE FROM catalog.catalog_sku_variant_axis_value WHERE sku_variant_axis_ref=?",axisRef); for(Value value:axis.values()) jdbc.update("INSERT INTO catalog.catalog_sku_variant_axis_value(sku_variant_axis_ref,value_ref,display_order) VALUES(?,?,?)",axisRef,value.ref(),value.displayOrder()); }
        existing.entrySet().stream().filter(entry -> !retained.contains(entry.getKey())).map(entry -> entry.getValue().ref()).forEach(axisRef -> { jdbc.update("DELETE FROM catalog.catalog_sku_variant_axis_value WHERE sku_variant_axis_ref=?",axisRef); jdbc.update("DELETE FROM catalog.catalog_sku_variant_axis WHERE sku_variant_axis_ref=?",axisRef); });
    }

    void validateRetirements(UUID itemRef, ArrayNode submitted, ArrayNode candidateSkus) {
        List<Axis> next = normalize(submitted);
        Map<UUID, Set<UUID>> existing = jdbc.query("SELECT axis.attribute_ref, value.value_ref FROM catalog.catalog_sku_variant_axis axis LEFT JOIN catalog.catalog_sku_variant_axis_value value ON value.sku_variant_axis_ref=axis.sku_variant_axis_ref WHERE axis.item_ref=?", rows -> {
            Map<UUID, Set<UUID>> result = new LinkedHashMap<>();
            while (rows.next()) {
                UUID attributeRef = rows.getObject(1, UUID.class);
                UUID valueRef = rows.getObject(2, UUID.class);
                result.computeIfAbsent(attributeRef, ignored -> new LinkedHashSet<>());
                if (valueRef != null) result.get(attributeRef).add(valueRef);
            }
            return result;
        }, itemRef);
        Map<UUID, Set<UUID>> retainedValues = new LinkedHashMap<>();
        Set<UUID> retainedAttributes = new LinkedHashSet<>();
        for (Axis axis : next) {
            retainedAttributes.add(axis.attributeRef());
            retainedValues.put(axis.attributeRef(), axis.values().stream().map(Value::ref).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        }
        Set<String> blocked = new LinkedHashSet<>();
        for (Map.Entry<UUID, Set<UUID>> existingAxis : existing.entrySet()) {
            boolean axisRemoved = !retainedAttributes.contains(existingAxis.getKey());
            Set<UUID> removedValues = new LinkedHashSet<>(existingAxis.getValue());
            if (!axisRemoved) removedValues.removeAll(retainedValues.getOrDefault(existingAxis.getKey(), Set.of()));
            if (!axisRemoved && removedValues.isEmpty()) continue;
            if (candidateSkus == null) continue;
            for (JsonNode sku : candidateSkus) {
                if ("ARCHIVED".equals(sku.path("status").asText("ENABLED"))) continue;
                JsonNode refs = sku.path("attributeValueRefs");
                if (!refs.isArray()) continue;
                for (JsonNode ref : refs) {
                    UUID skuAttribute = parseUuid(ref.path("attributeRef").asText());
                    UUID skuValue = parseUuid(ref.path("attributeValueRef").asText());
                    if (existingAxis.getKey().equals(skuAttribute) && (axisRemoved || removedValues.contains(skuValue))) {
                        blocked.add(sku.path("skuCode").asText("<unknown>") + "(" + existingAxis.getKey() + (axisRemoved ? ":axis" : ":value") + ")");
                    }
                }
            }
        }
        if (!blocked.isEmpty()) throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "规格轴或值仍被 SKU 引用: " + String.join(", ", blocked));
    }

    private static List<Axis> normalize(ArrayNode submitted) { if(submitted==null)return List.of(); List<Axis> result=new ArrayList<>(); LinkedHashSet<UUID> attributes=new LinkedHashSet<>(); LinkedHashSet<Integer> orders=new LinkedHashSet<>(); int axisOrder=0; for(JsonNode node:submitted){ UUID attribute=uuid(node,"attributeRef"); if(!attributes.add(attribute))throw problem("skuVariantDimensions cannot contain duplicate attributeRef"); int order=node.has("displayOrder")?node.path("displayOrder").asInt():axisOrder; if(order<0||!orders.add(order))throw problem("skuVariantDimensions displayOrder must be unique and non-negative"); List<Value> values=new ArrayList<>(); LinkedHashSet<UUID> valueRefs=new LinkedHashSet<>(); LinkedHashSet<Integer> valueOrders=new LinkedHashSet<>(); int valueOrder=0; JsonNode raw=node.path("values"); if(raw.isArray()) for(JsonNode value:raw){ UUID ref=uuid(value,"valueRef"); int nestedOrder=value.has("displayOrder")?value.path("displayOrder").asInt():valueOrder; if(nestedOrder<0||!valueRefs.add(ref)||!valueOrders.add(nestedOrder))throw problem("axis values must have unique refs and displayOrder"); values.add(new Value(ref,nestedOrder)); valueOrder++; } result.add(new Axis(attribute,order,List.copyOf(values))); axisOrder++; } return List.copyOf(result); }
    private static UUID uuid(JsonNode node,String field){ try{return UUID.fromString(node.path(field).asText());}catch(Exception failure){throw problem(field+" must be UUID");} }
    private static UUID parseUuid(String value){ try{return value == null || value.isBlank() ? null : UUID.fromString(value);}catch(Exception failure){return null;} }
    private static CatalogOwnerApi.Problem problem(String detail){return new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,detail);}
    private record ExistingAxis(UUID ref,int displayOrder){} private record Axis(UUID attributeRef,int displayOrder,List<Value> values){} private record Value(UUID ref,int displayOrder){}
}
